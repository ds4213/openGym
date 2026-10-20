import { uid } from './format.js'

const clone = value => JSON.parse(JSON.stringify(value))

export function blankPersonalProgram(now = Date.now(), id = 'p' + uid()) {
  return {
    id, name: 'My program', source: 'personal', detailStatus: 'full', personalRevision: 0,
    savedAt: new Date(now).toISOString(), _ts: now,
    schedule: [{ id: 'pw' + uid(), number: 1, days: [{ id: 'pd' + uid(), name: 'Day 1', week: 1, exercises: [] }] }],
  }
}

export function copyProgramTemplate(program, now = Date.now(), id = 'p' + uid()) {
  const copy = clone(program)
  return {
    ...copy,
    id,
    name: `${program.name} (Copy)`,
    source: 'personal',
    sourceProgram: {
      id: program.id,
      source: program.source,
      contentVersion: program.contentVersion || null,
    },
    savedAt: new Date(now).toISOString(),
    detailStatus: 'full',
    _ts: now,
  }
}

export function personalProgramsOf(state) {
  return Object.values(state?.personalPrograms || {})
    .filter(program => program && !program.deleted)
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || '') || a.name.localeCompare(b.name))
}

export function validatePersonalProgram(program) {
  if (!String(program?.name || '').trim()) return 'Give this program a name.'
  if (!(program?.schedule || []).length) return 'Add at least one week.'
  for (const week of program.schedule) {
    if (!(week.days || []).length) return 'Every week needs at least one training day.'
    for (const day of week.days) {
      if (!(day.exercises || []).length) return 'Every training day needs at least one exercise.'
      if (day.exercises.some(exercise => !(exercise.sets || []).length)) return 'Every exercise needs at least one set.'
    }
  }
  return ''
}

export function savePersonalProgramDraft(original, draft, now = Date.now()) {
  if (original?.source !== 'personal' || draft?.id !== original.id) throw new Error('Only a matching personal program can be edited.')
  const error = validatePersonalProgram(draft)
  if (error) throw new Error(error)
  const next = clone(draft)
  next.name = next.name.trim()
  next.schedule.forEach((week, weekIndex) => {
    week.number = weekIndex + 1
    week.days.forEach(day => {
      day.week = week.number
      day.exercises.forEach(exercise => exercise.sets.forEach((set, setIndex) => { set.order = setIndex }))
    })
  })
  next.weeks = next.schedule.length
  next.daysPerWeek = Math.max(...next.schedule.map(week => week.days.length))
  next.workoutCount = next.schedule.reduce((count, week) => count + week.days.length, 0)
  next.personalRevision = (Number(original.personalRevision) || 0) + 1
  next.contentVersion = `personal-${next.personalRevision}-${now}`
  next.editedAt = new Date(now).toISOString()
  next._ts = now
  return next
}
