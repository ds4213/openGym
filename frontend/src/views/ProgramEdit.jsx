import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, NumberField, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { exerciseNameFor } from '../lib/i18n.js'
import { programText as p } from '../lib/program-text.js'
import { uid } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { blankPersonalProgram, savePersonalProgramDraft, validatePersonalProgram } from '../lib/personal-programs.js'
import { useStore } from '../store/useStore.js'

const copy = value => structuredClone(value)
const exerciseName = exercise => exercise.exerciseId && EXIDX[exercise.exerciseId] ? exerciseNameFor(EXIDX[exercise.exerciseId]) : exercise.name || exercise.exerciseName || p('Exercise')

const newSet = source => ({ id: 'ps' + uid(), reps: Number(source?.reps) || 8, order: 0, weight: Number(source?.weight) || 0, percentage: Number(source?.percentage) || 0, ...(source?.type ? { type: source.type } : {}) })
const newExercise = (programId, exercise) => {
  const id = 'pe' + uid()
  return { id, name: exercise.n, exerciseName: exercise.n, referenceExerciseId: `personal:${programId}:${id}`, exerciseId: exercise.id, sets: [newSet()] }
}
const newDay = week => ({ id: 'pd' + uid(), name: p('Day {0}', (week.days?.length || 0) + 1), week: week.number, exercises: [] })

function duplicateWeek(week) {
  const next = copy(week)
  next.days.forEach(day => {
    day.id = 'pd' + uid()
    day.exercises.forEach(exercise => {
      exercise.id = 'pe' + uid()
      if (exercise.exerciseId) exercise.referenceExerciseId = `personal:${exercise.id}`
      exercise.sets.forEach(set => { set.id = 'ps' + uid() })
    })
  })
  return next
}

export default function ProgramEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const creating = id === 'new'
  const program = useStore(state => state.S.personalPrograms?.[id])
  const unit = useStore(state => state.S.unit)
  const update = useStore(state => state.update)
  const [draft, setDraft] = useState(() => creating ? blankPersonalProgram() : program ? copy(program) : null)
  const [weekIndex, setWeekIndex] = useState(0)
  const [saveError, setSaveError] = useState('')
  const validation = useMemo(() => validatePersonalProgram(draft), [draft])

  if ((!creating && (!program || program.deleted)) || !draft) return <Navigate to="/programs" replace />
  const week = draft.schedule[weekIndex]
  const edit = fn => {
    setSaveError('')
    setDraft(current => { const next = copy(current); fn(next); return next })
  }
  const pickExercise = async (dayIndex, exerciseIndex = null) => {
    const { exercisePicker } = await import('../sheets.jsx')
    const current = exerciseIndex == null ? null : draft.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex]
    const picker = exercisePicker(exercise => {
      edit(next => {
        const exercises = next.schedule[weekIndex].days[dayIndex].exercises
        if (exerciseIndex == null) exercises.push(newExercise(next.id, exercise))
        else exercises[exerciseIndex] = { ...current, name: exercise.n, exerciseName: exercise.n, referenceExerciseId: `personal:${next.id}:${current.id}`, exerciseId: exercise.id }
      })
      picker.close()
    }, { title: current ? p('Replace {0}', exerciseName(current)) : p('Add exercise'), like: current?.exerciseId })
  }
  const save = () => {
    try {
      const saved = savePersonalProgramDraft(program || draft, draft)
      update(state => { state.personalPrograms = { ...(state.personalPrograms || {}), [saved.id]: saved } })
      nav('/programs/' + encodeURIComponent(saved.id))
    } catch (error) { setSaveError(error.message) }
  }

  return <div className="narrow programs-page program-editor">
    <div className="hdr">
      <div><h1>{p(creating ? 'Build my own' : 'Edit program')}</h1><div className="sub">{p(creating ? 'Create a multi-week program from scratch.' : 'Changes affect future cycles only.')}</div></div>
      <Button size="sm" onClick={() => nav(creating ? '/programs' : '/programs/' + encodeURIComponent(id))}>{p('Cancel')}</Button>
    </div>
    <label className="program-edit-field"><span>{p('Program name')}</span><TextField value={draft.name} maxLength={100} onChange={event => edit(next => { next.name = event.target.value })} /></label>
    <div className="program-schedule-head"><h2>{p('Workout schedule')}</h2><span>{p('{0} weeks', draft.schedule.length)}</span></div>
    <div className="chips program-week-picker" aria-label={p('Choose week')}>
      {draft.schedule.map((item, index) => <button key={item.id || index} className={'chip nocap' + (index === weekIndex ? ' on' : '')} onClick={() => setWeekIndex(index)}>{p('Week {0}', index + 1)}</button>)}
    </div>
    <div className="program-edit-actions">
      <Button size="sm" icon="copy" onClick={() => { edit(next => { next.schedule.splice(weekIndex + 1, 0, duplicateWeek(next.schedule[weekIndex])) }); setWeekIndex(weekIndex + 1) }}>{p('Duplicate week')}</Button>
      <Button size="sm" icon="minus" disabled={draft.schedule.length === 1} onClick={() => { edit(next => { next.schedule.splice(weekIndex, 1) }); setWeekIndex(Math.max(0, weekIndex - 1)) }}>{p('Remove week')}</Button>
    </div>
    <div className="program-days">{week?.days.map((day, dayIndex) => <article className="program-day program-edit-day" key={day.id || dayIndex}>
      <div className="program-day-head">
        <TextField aria-label={p('Day name')} value={day.name || ''} onChange={event => edit(next => { next.schedule[weekIndex].days[dayIndex].name = event.target.value })} />
        <button className="iconbtn" aria-label={p('Remove day')} disabled={week.days.length === 1} onClick={() => edit(next => { next.schedule[weekIndex].days.splice(dayIndex, 1) })}><Icon name="trash" /></button>
      </div>
      <div className="program-exercises">{(day.exercises || []).map((exercise, exerciseIndex) => <div className="program-exercise program-edit-exercise" key={exercise.id || exerciseIndex}>
        <div><button className="program-edit-exercise-name" onClick={() => pickExercise(dayIndex, exerciseIndex)}><strong>{exerciseName(exercise)}</strong><small>{p('Replace exercise')}</small></button>
          <button className="iconbtn" aria-label={p('Remove exercise')} onClick={() => edit(next => { next.schedule[weekIndex].days[dayIndex].exercises.splice(exerciseIndex, 1) })}><Icon name="trash" /></button></div>
        <div className="program-edit-sets">{(exercise.sets || []).map((set, setIndex) => <div className="program-edit-set" key={set.id || setIndex}>
          <span className="program-set-number">{setIndex + 1}</span>
          <label><span>{p('Reps')}</span><NumberField aria-label={p('Reps')} decimal={false} value={set.reps || 0} onChange={value => edit(next => { next.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex].sets[setIndex].reps = value || 0 })} /></label>
          <label><span>% TM</span><NumberField aria-label="% TM" value={Number(set.percentage) > 0 ? Number(set.percentage) * 100 : 0} onChange={value => edit(next => { const target = next.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex].sets[setIndex]; target.percentage = (value || 0) / 100; if (value > 0) target.weight = 0 })} /></label>
          <label><span>{unit}</span><NumberField aria-label={unit} value={set.weight || 0} onChange={value => edit(next => { const target = next.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex].sets[setIndex]; target.weight = value || 0; if (value > 0) target.percentage = 0 })} /></label>
          <button className="iconbtn" aria-label={p('Remove set')} disabled={exercise.sets.length === 1} onClick={() => edit(next => { next.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex].sets.splice(setIndex, 1) })}><Icon name="minus" /></button>
        </div>)}</div>
        <Button size="sm" icon="plus" onClick={() => edit(next => { const sets = next.schedule[weekIndex].days[dayIndex].exercises[exerciseIndex].sets; sets.push(newSet(sets.at(-1))) })}>{p('Add set')}</Button>
      </div>)}</div>
      <Button size="sm" variant="tinted" icon="plus" onClick={() => pickExercise(dayIndex)}>{p('Add exercise')}</Button>
    </article>)}</div>
    <Button icon="plus" onClick={() => edit(next => { next.schedule[weekIndex].days.push(newDay(next.schedule[weekIndex])) })}>{p('Add training day')}</Button>
    {(saveError || validation) && <p className="program-compat-warning"><Icon name="warning" /> {p(saveError || validation)}</p>}
    <Button variant="primary" icon="check" disabled={!!validation} onClick={save}>{p('Save changes')}</Button>
  </div>
}
