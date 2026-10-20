import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { exerciseNameFor, t } from '../lib/i18n.js'
import { programText as p } from '../lib/program-text.js'
import { useStore } from '../store/useStore.js'
import { copyProgramTemplate, personalProgramsOf } from '../lib/personal-programs.js'
import { cycleForProgram, programExerciseRequirements, trainingMaxRequirements } from '../lib/program-cycle.js'
import { EXIDX } from '../lib/exercises.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Row, Section, SearchField, Segmented } from '../components/ui.jsx'

const emptyFilters = { days: '', goal: '', level: '', phase: '', category: '' }
const textOf = program => [program.name, program.family, program.phase, program.goal, ...(program.levels || [])].filter(Boolean).join(' ').toLocaleLowerCase()
const same = (left, right) => String(left || '').toLocaleLowerCase() === String(right || '').toLocaleLowerCase()

export function filterProgramCatalog(programs, query, source = '', filters = emptyFilters) {
  const needle = query.trim().toLocaleLowerCase()
  return programs.filter(program =>
    (!source || program.source === source) &&
    (!filters.days || Number(program.daysPerWeek) === Number(filters.days)) &&
    (!filters.goal || same(program.goal, filters.goal)) &&
    (!filters.level || (program.levels || []).some(level => same(level, filters.level))) &&
    (!filters.phase || same(program.phase, filters.phase)) &&
    (!filters.category || same(program.family, filters.category)) &&
    (!needle || textOf(program).includes(needle))
  )
}

export function goalPresentation(goal = '') {
  const value = goal.toLocaleLowerCase()
  if (value === 'build muscle') return { tone: 'muscle', icon: 'dumbbell' }
  if (value === 'strength and conditioning') return { tone: 'strength-conditioning', icon: 'bolt' }
  if (value === 'strength and muscle') return { tone: 'strength-muscle', icon: 'figureStrength' }
  if (value === 'challenge' || value === 'challenges') return { tone: 'challenge', icon: 'trophy' }
  if (value === 'conditioning') return { tone: 'conditioning', icon: 'figureRun' }
  if (value === 'lose fat') return { tone: 'fat-loss', icon: 'flame' }
  return { tone: 'strength', icon: 'barbell' }
}

export function sortPrograms(programs, sort) {
  const copy = [...programs]
  if (sort === 'new') return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name))
  if (sort === 'az') return copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy.sort((a, b) => (b.userCount || 0) - (a.userCount || 0) || a.name.localeCompare(b.name))
}

export function discoveryGroups(programs) {
  const official = programs.filter(program => program.source === 'official' && program.catalogStatus === 'indexed')
  const community = programs.filter(program => program.source === 'community' && program.catalogStatus === 'indexed')
  const recommended = official.filter(program => program.weeks >= 3 && program.weeks <= 16 && program.daysPerWeek >= 3 && program.daysPerWeek <= 5 && /strength|muscle/i.test(program.goal || ''))
    .sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0) || a.name.localeCompare(b.name))
  return {
    recommended: recommended.slice(0, 8),
    popular: sortPrograms(community, 'popular').slice(0, 8),
    muscle: official.filter(program => /muscle/i.test(program.goal || '')).sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0)).slice(0, 8),
    strength: official.filter(program => /^strength$/i.test(program.goal || '')).sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0)).slice(0, 8),
    newest: sortPrograms(community, 'new').slice(0, 8),
  }
}

const compactNumber = value => Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value).toFixed(1))

function oneSetText(set) {
  const parts = []
  const reps = Number(set.reps)
  const min = Number(set.minRepsProgression)
  const max = Number(set.maxReps)
  if (min > 0 && max >= min) parts.push(`${min}–${max} ${p('reps')}`)
  else if (reps > 0) parts.push(`${compactNumber(reps)} ${p('reps')}`)
  else if (Number(set.duration) > 0) parts.push(`${compactNumber(set.duration)} ${p('seconds')}`)
  else if (Number(set.distance) > 0) parts.push(`${compactNumber(set.distance)} ${set.distanceUnits || ''}`.trim())
  if (Number(set.percentage) > 0) parts.push(`@ ${compactNumber(Number(set.percentage) * 100)}% TM`)
  else if (Number(set.weight) > 0) parts.push(`@ ${compactNumber(set.weight)}`)
  if (Number(set.repsInReserve) >= 0 && set.repsInReserve !== null && set.repsInReserve !== '') parts.push(`RIR ${compactNumber(set.repsInReserve)}`)
  if (Number(set.ratePerceivedExertion) > 0) parts.push(`RPE ${compactNumber(set.ratePerceivedExertion)}`)
  const type = String(set.type || '').toLocaleLowerCase()
  if (type && type !== 'regular') parts.push(p(type === 'pr' ? 'PR set' : type[0].toLocaleUpperCase() + type.slice(1)))
  return parts.join(' · ') || p('Set')
}

export function setPrescription(sets = []) {
  const groups = []
  for (const set of sets) {
    const text = oneSetText(set)
    const last = groups.at(-1)
    if (last?.text === text) last.count++
    else groups.push({ text, count: 1 })
  }
  return groups.map(group => group.count > 1 ? `${group.count} × ${group.text}` : group.text).join(' · ')
}

export function programExerciseName(exercise) {
  return exercise.name || exercise.exerciseName || exercise.sets?.find(set => set.exerciseName)?.exerciseName || (exercise.category ? p('Choose {0}', exercise.category) : exercise.recommendation) || p('Assistance exercise')
}

const sourceName = source => source === 'official' ? p('Official') : source === 'personal' ? p('Personal') : p('Community')
const familyName = family => family === '531' ? '5/3/1' : family
const programMeta = program => [familyName(program.family), program.weeks && p('{0} weeks', program.weeks), program.daysPerWeek && p('{0} days/week', program.daysPerWeek)].filter(Boolean).join(' · ')

function ProgramDetail({ id }) {
  const nav = useNavigate()
  const personal = useStore(state => state.S.personalPrograms?.[id])
  const programCycles = useStore(state => state.S.programCycles)
  const exerciseMappings = useStore(state => state.S.programExerciseMap || {})
  const active = useStore(state => state.S.active)
  const unit = useStore(state => state.S.unit)
  const update = useStore(state => state.update)
  const [program, setProgram] = useState(null)
  const [error, setError] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [setup, setSetup] = useState(false)
  const [trainingMaxes, setTrainingMaxes] = useState({})

  useEffect(() => {
    if (personal && !personal.deleted) { setProgram(personal); setSelectedWeek(personal.schedule?.[0]?.number || 1); return }
    let current = true
    api('/api/program?id=' + encodeURIComponent(id))
      .then(result => { if (current) { setProgram(result.program); setSelectedWeek(result.program.schedule?.[0]?.number || 1) } })
      .catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [id, personal])

  if (error) return <div className="narrow"><div className="empty">{p('Could not load programs')}: {error}</div></div>
  if (!program) return <div className="narrow"><div className="empty">{t('Loading…')}</div></div>

  const facts = [
    [p('Source'), sourceName(program.source)], [p('Family'), program.family], [p('Phase'), program.phase],
    [p('Goal'), program.goal], [p('Weeks'), program.weeks], [p('Days per week'), program.daysPerWeek],
    [p('Level'), (program.levels || []).map(level => p(level)).join(', ')],
    [p('Workouts'), program.workoutCount], [p('People using it'), program.userCount],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')
  const week = program.schedule?.find(item => item.number === selectedWeek)
  const cycle = cycleForProgram({ programCycles }, program.id)
  const exerciseRequirements = programExerciseRequirements(program, exerciseMappings)
  const tmRequirements = trainingMaxRequirements(program, exerciseMappings)
  const unmapped = exerciseRequirements.filter(item => !item.exerciseId)
  const ready = exerciseRequirements.length > 0 && !unmapped.length && tmRequirements.every(item => Number(trainingMaxes[item.key]) > 0)
  const copy = () => {
    const saved = copyProgramTemplate(program)
    update(state => { state.personalPrograms = { ...(state.personalPrograms || {}), [saved.id]: saved } })
    nav('/programs/' + encodeURIComponent(saved.id))
  }
  const start = async () => {
    const { startProgram } = await import('../sheets.jsx')
    startProgram(program, trainingMaxes)
  }
  const chooseExercise = async item => {
    const { exercisePicker } = await import('../sheets.jsx')
    const picker = exercisePicker(exercise => {
      update(state => {
        state.programExerciseMap = { ...(state.programExerciseMap || {}), [item.key]: { exerciseId: exercise.id, exerciseName: exercise.n, sourceName: item.name, _ts: Date.now() } }
      })
      picker.close()
    }, { title: p('Map {0}', item.name), like: item.exerciseId })
  }
  const mappedName = item => EXIDX[item.exerciseId] ? exerciseNameFor(EXIDX[item.exerciseId]) : exerciseMappings[item.key]?.exerciseName
  const viewExercise = async item => {
    if (!EXIDX[item.exerciseId]) return
    const { exerciseDetailSheet } = await import('../sheets.jsx')
    exerciseDetailSheet(EXIDX[item.exerciseId])
  }
  const resume = async () => {
    if (active?.programCycle?.id === cycle.id) { nav('/workout'); return }
    const { continueProgram } = await import('../sheets.jsx')
    continueProgram(cycle.id)
  }

  return <div className="narrow programs-page">
    <div className="hdr">
      <div><h1>{program.name}</h1><div className="sub">{sourceName(program.source)}</div></div>
      <Button size="sm" icon="chevronLeft" onClick={() => nav('/programs')}>{p('Programs')}</Button>
    </div>
    <Section title={p('Program details')}>{facts.map(([label, value]) => <Row key={label} title={label} value={String(value)} />)}</Section>
    {program.detailStatus === 'full' && program.source !== 'personal' && <Button className="program-copy" icon="plus" onClick={copy}>{p('Copy to My Plans')}</Button>}
    {program.source === 'personal' && program.sourceProgram && <p className="small dim program-origin">{p('Copied from {0}', program.sourceProgram.source === 'official' ? p('Official') : p('Community'))} · {p('Your copied programs are independent from future source updates.')}</p>}
    {program.source === 'personal' && <Button className="program-copy" icon="pencil" onClick={() => nav('/programs/' + encodeURIComponent(program.id) + '/edit')}>{p('Edit program')}</Button>}
    {program.source === 'personal' && program.detailStatus === 'full' && <section className="program-start">
      {cycle?.status === 'active' || cycle?.status === 'paused' ? <>
        <div className="program-schedule-head"><h2>{p('Current cycle')}</h2><span>{p('Week {0}', cycle.currentWeek + 1)} · {p('Day {0}', cycle.currentDay + 1)}</span></div>
        <Button variant="primary" icon="play" onClick={resume}>{active?.programCycle?.id === cycle.id ? p('Continue workout') : p('Start next workout')}</Button>
      </> : <>
        <Button variant="primary" icon="play" onClick={() => setSetup(value => !value)}>{cycle?.status === 'completed' ? p('Start again') : p('Start Program')}</Button>
        {setup && <div className="program-tm-setup">
          <h2>{p('Exercise mapping')}</h2>
          <p className="small dim">{p('Choose the openGym exercise used for history, PRs, and AI analysis. Your choices sync and are reused in other programs.')}</p>
          {exerciseRequirements.map(item => <div className="program-map-row" key={item.key}>
            <span><strong>{item.name}</strong>{item.exerciseId && EXIDX[item.exerciseId]
              ? <button type="button" className="program-map-link" onClick={() => viewExercise(item)}>{mappedName(item)}</button>
              : <small className="missing">{mappedName(item) || p('Exercise mapping required')}</small>}</span>
            <Button size="sm" onClick={() => chooseExercise(item)}>{item.exerciseId ? p('Change') : p('Choose exercise')}</Button>
          </div>)}
          <h2>{p('Training Max')}</h2>
          <p className="small dim">{p('Set the Training Max used to calculate this cycle. It stays separate from your estimated 1RM.')}</p>
          {tmRequirements.map(item => <label className="program-tm-row" key={item.key}>
            <span><strong>{item.name}</strong></span>
            <span><NumberField value={trainingMaxes[item.key] ?? ''} nullable onChange={value => setTrainingMaxes(current => ({ ...current, [item.key]: value }))} aria-label={`${item.name} TM`} /> {unit}</span>
          </label>)}
          {!!unmapped.length && <p className="program-compat-warning"><Icon name="warning" /> {p('Map every exercise to openGym before starting this program.')}</p>}
          <Button variant="primary" disabled={!ready || !!active} onClick={start}>{active ? p('Finish the current workout first') : p('Create cycle and start Day 1')}</Button>
        </div>}
      </>}
    </section>}
    {program.detailStatus === 'full' && <section className="program-schedule">
      <div className="program-schedule-head"><h2>{p('Workout schedule')}</h2><span>{p('{0} workouts', program.workoutCount || 0)}</span></div>
      <div className="chips program-week-picker" aria-label={p('Choose week')}>
        {program.schedule.map(item => <button key={item.number} className={'chip nocap' + (item.number === selectedWeek ? ' on' : '')} onClick={() => setSelectedWeek(item.number)}>{p('Week {0}', item.number)}</button>)}
      </div>
      <div className="program-days">{week?.days.map((day, dayIndex) => <article className="program-day" key={day.id || dayIndex}>
        <div className="program-day-head"><strong>{day.name || p('Day {0}', dayIndex + 1)}</strong><span>{p('{0} exercises', day.exercises?.length || 0)}</span></div>
        <div className="program-exercises">{(day.exercises || []).map((exercise, exerciseIndex) => <div className="program-exercise" key={exercise.id || exerciseIndex}>
          <div><strong>{programExerciseName(exercise)}</strong><span>{[exercise.type, exercise.category, exercise.superset != null ? p('Superset {0}', exercise.superset) : ''].filter(Boolean).join(' · ')}</span></div>
          <p>{setPrescription(exercise.sets)}</p>
          {exercise.recommendation && <small>{exercise.recommendation}</small>}
        </div>)}</div>
      </article>)}</div>
    </section>}
    {!!program.compatibilityIssues?.length && <p className="program-compat-warning"><Icon name="warning" /> {p('Some source fields need verification before this program can be started automatically.')}</p>}
    {program.source !== 'personal' && <p className="small dim program-note">{program.detailStatus === 'full'
      ? p('This is the source prescription. Copy and Start Program come next so your active cycle stays independent from source updates.')
      : program.detailStatus === 'invalid'
        ? p('The saved workout details could not be read. Rebuild the program cache before starting this program.')
        : p('Only catalogue information is available for this program right now.')}</p>}
  </div>
}

function ProgramCard({ program, onOpen }) {
  const presentation = goalPresentation(program.goal)
  return <button className={`program-card goal-${presentation.tone}`} onClick={() => onOpen(program)}>
    <span className="program-card-top"><span className="program-icon"><Icon name={presentation.icon} /></span><span className="program-goal-label">{program.goal}</span></span>
    <strong>{program.name}</strong>
    <span className="program-card-meta">{programMeta(program) || program.goal}</span>
    <span className="program-card-foot"><span>{sourceName(program.source)}</span><span>{program.userCount ? p('{0} people', program.userCount) : program.goal}</span></span>
  </button>
}

function FilterGroup({ label, value, options, onChange, translate = false, format = String }) {
  if (!options.length) return null
  return <div className="program-filter-group">
    <div className="program-filter-label">{p(label)}</div>
    <div className="chips program-filter-options">
      {options.map(option => <button key={option} className={'chip nocap' + (String(value) === String(option) ? ' on' : '')} onClick={() => onChange(String(value) === String(option) ? '' : option)}>{translate ? p(String(option)) : format(option)}</button>)}
    </div>
  </div>
}

function DiscoverySection({ title, subtitle, programs, onOpen }) {
  if (!programs.length) return null
  return <section className="program-discovery">
    <div className="program-section-head"><h2>{p(title)}</h2><p>{p(subtitle)}</p></div>
    <div className="program-rail">{programs.map(program => <ProgramCard key={program.id} program={program} onOpen={onOpen} />)}</div>
  </section>
}

export default function ProgramLibrary() {
  const { id } = useParams()
  const nav = useNavigate()
  const [programs, setPrograms] = useState([])
  const [counts, setCounts] = useState(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('discover')
  const [filters, setFilters] = useState(emptyFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState('popular')
  const [shown, setShown] = useState(40)
  const [error, setError] = useState('')
  const personalProgramMap = useStore(state => state.S.personalPrograms)
  const personalPrograms = useMemo(() => personalProgramsOf({ personalPrograms: personalProgramMap }), [personalProgramMap])

  useEffect(() => {
    if (id) return
    let current = true
    api('/api/programs?limit=500')
      .then(result => { if (current) { setPrograms(result.programs); setCounts(result.counts) } })
      .catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [id])

  const groups = useMemo(() => discoveryGroups(programs), [programs])
  const source = tab === 'community' ? 'community' : ''
  const visiblePrograms = useMemo(() => tab === 'mine' ? personalPrograms : programs.filter(program => !source || program.source === source), [programs, source, tab, personalPrograms])
  const options = useMemo(() => ({
    days: [...new Set(visiblePrograms.map(program => program.daysPerWeek).filter(Boolean))].sort((a, b) => a - b),
    goals: [...new Set(visiblePrograms.map(program => program.goal).filter(Boolean))].sort(),
    levels: ['Beginner', 'Intermediate', 'Advanced'],
    phases: [...new Set(visiblePrograms.map(program => program.phase).filter(Boolean))].sort(),
    categories: [...new Set(visiblePrograms.map(program => program.family).filter(Boolean))].sort(),
  }), [visiblePrograms])
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const filtered = useMemo(() => sortPrograms(filterProgramCatalog(tab === 'mine' ? personalPrograms : programs, query, source, filters), tab === 'community' ? sort : 'az'), [programs, personalPrograms, query, source, filters, sort, tab])
  const open = program => nav('/programs/' + encodeURIComponent(program.id))
  const chooseTab = value => { setTab(value); setFilters(emptyFilters); setQuery(''); setShown(40) }
  const setFilter = (name, value) => { setFilters(current => ({ ...current, [name]: value })); setShown(40) }
  if (id) return <ProgramDetail id={id} />

  return <div className="narrow programs-page">
    <div className="hdr program-title"><div><h1>{p('Programs')}</h1><div className="sub">{counts ? p('{0} KeyLifts programs', counts.total) : p('KeyLifts program catalogue')}</div></div></div>
    <Segmented className="program-tabs" value={tab} onChange={chooseTab} options={[
      { value: 'discover', label: p('Discover') }, { value: 'community', label: p('Community') }, { value: 'mine', label: p('My Plans') },
    ]} />
    <div className="program-search-row">
      <SearchField value={query} onChange={event => { setQuery(event.target.value); setShown(40) }} onClear={() => setQuery('')} placeholder={p('Search programs…')} />
      <Button className={'program-filter-toggle' + (activeFilterCount ? ' active' : '')} icon="slider" onClick={() => setShowFilters(value => !value)} aria-label={p('Filters')} aria-expanded={showFilters}>{p('Filters')}{activeFilterCount ? ` · ${activeFilterCount}` : ''}</Button>
    </div>
    {showFilters && <div className="program-filter-panel">
      <FilterGroup label="Days per week" value={filters.days} options={options.days} onChange={value => setFilter('days', value)} />
      <FilterGroup label="Goal" value={filters.goal} options={options.goals} onChange={value => setFilter('goal', value)} />
      <FilterGroup label="Level" value={filters.level} options={options.levels} onChange={value => setFilter('level', value)} translate />
      <FilterGroup label="Phase" value={filters.phase} options={options.phases} onChange={value => setFilter('phase', value)} />
      <FilterGroup label="Category" value={filters.category} options={options.categories} onChange={value => setFilter('category', value)} format={familyName} />
      {activeFilterCount > 0 && <Button className="program-filter-clear" onClick={() => { setFilters(emptyFilters); setShown(40) }}>{p('Clear all filters')}</Button>}
    </div>}

    {error && tab !== 'mine' && <div className="empty">{p('Could not load programs')}: {error}</div>}
    {!error && !counts && tab !== 'mine' && <div className="program-skeleton" aria-label={t('Loading…')}><i /><i /><i /></div>}

    {counts && tab === 'discover' && !query && !activeFilterCount && <div className="program-discover-sections">
      <DiscoverySection title="Recommended" subtitle="Complete official programs for a strong start" programs={groups.recommended} onOpen={open} />
      <DiscoverySection title="Popular" subtitle="Most used by the KeyLifts community" programs={groups.popular} onOpen={open} />
      <DiscoverySection title="Build muscle" subtitle="Programs focused on size and hypertrophy" programs={groups.muscle} onOpen={open} />
      <DiscoverySection title="Strength" subtitle="Programs focused on getting stronger" programs={groups.strength} onOpen={open} />
      <DiscoverySection title="New discoveries" subtitle="Recently shared with the community" programs={groups.newest} onOpen={open} />
    </div>}

    {(counts || tab === 'mine') && <section className="program-browser">
      <div className="program-browser-head"><h2>{tab === 'community' ? p('Community programs') : tab === 'mine' ? p('My Plans') : p('Browse all')}</h2><span>{p('{0} programs', filtered.length)}</span></div>
      {tab === 'community' && <div className="chips program-sort">
        {[['popular', p('Most popular')], ['new', p('Newest')], ['az', p('A–Z')]].map(([value, label]) =>
          <button key={value} className={'chip nocap' + (sort === value ? ' on' : '')} onClick={() => { setSort(value); setShown(40) }}>{label}</button>)}
      </div>}
      <div className="list program-list">
        {filtered.slice(0, shown).map(program => { const presentation = goalPresentation(program.goal); return <button key={program.id} className={`item program-row goal-${presentation.tone}`} onClick={() => open(program)}>
          <span className="program-row-icon"><Icon name={presentation.icon} /></span>
          <div className="grow"><div className="tt">{program.name}</div><div className="ss">{[sourceName(program.source), programMeta(program)].filter(Boolean).join(' · ')}</div></div>
          {program.userCount > 0 && <span className="program-users">{p('{0} people', program.userCount)}</span>}
          <Icon name="chevronRight" className="chev" />
        </button>})}
        {!filtered.length && (tab === 'mine' && !personalPrograms.length
          ? <div className="empty">{p('No personal programs yet. Open a complete program and copy it here.')}</div>
          : <div className="empty"><Icon name="magnifier" /> {t('No match')}</div>)}
      </div>
      {filtered.length > shown && <Button className="program-more" onClick={() => setShown(value => value + 40)}>{t('Show more')}</Button>}
    </section>}
  </div>
}
