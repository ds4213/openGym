import { CATALOGUE } from './exercises.js'
import { uid, isoOf } from './format.js'

const clone = value => JSON.parse(JSON.stringify(value))
const clean = value => String(value || '').toLocaleLowerCase().replace(/[•·]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

const COMMON_LIFTS = {
  squat: '0043',
  'back squat': '0043',
  'barbell squat': '0043',
  'bench press': '0025',
  bench: '0025',
  deadlift: '0032',
  press: '1162',
  'overhead press': '1162',
  'military press': '1162',
}

const exactExercises = new Map()
for (const exercise of CATALOGUE) {
  const key = clean(exercise.n)
  const current = exactExercises.get(key)
  exactExercises.set(key, current === undefined ? exercise.id : null)
}

export const programExerciseKey = exercise => exercise?.referenceExerciseId || clean(exercise?.name || exercise?.exerciseName)

export function resolveProgramExercise(exercise, mappings = {}) {
  const mapped = mappings?.[programExerciseKey(exercise)]
  if (mapped?.exerciseId && !mapped.deleted) return mapped.exerciseId
  const name = clean(exercise?.name || exercise?.exerciseName)
  return COMMON_LIFTS[name] || exactExercises.get(name) || null
}

export function programExerciseRequirements(program, mappings = {}) {
  const seen = new Set()
  const out = []
  for (const week of program?.schedule || []) for (const day of week.days || []) for (const exercise of day.exercises || []) {
    const key = programExerciseKey(exercise)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, name: exercise.name || exercise.exerciseName || 'Exercise', exerciseId: resolveProgramExercise(exercise, mappings), needsTrainingMax: (exercise.sets || []).some(set => Number(set.percentage) > 0) })
  }
  return out
}

export const trainingMaxRequirements = (program, mappings = {}) => programExerciseRequirements(program, mappings).filter(item => item.needsTrainingMax)

export function createProgramCycle(program, trainingMaxes, unit, now = Date.now(), id = 'c' + uid(), mappings = {}) {
  const exercises = programExerciseRequirements(program, mappings)
  const requirements = exercises.filter(item => item.needsTrainingMax)
  if (exercises.some(item => !item.exerciseId) || requirements.some(item => !(Number(trainingMaxes?.[item.key]) > 0))) throw new Error('Program setup is incomplete')
  return {
    id,
    programId: program.id,
    programName: program.name,
    templateVersion: program.contentVersion || program.sourceProgram?.contentVersion || null,
    schedule: clone(program.schedule || []),
    exerciseMap: Object.fromEntries(exercises.map(item => [item.key, item.exerciseId])),
    trainingMaxes: Object.fromEntries(requirements.map(item => [item.key, { exerciseId: item.exerciseId, name: item.name, value: Number(trainingMaxes[item.key]), unit }])),
    unit,
    status: 'active',
    currentWeek: 0,
    currentDay: 0,
    startedAt: new Date(now).toISOString(),
    _ts: now,
  }
}

const snap = (value, unit) => {
  const step = unit === 'lb' ? 5 : 2.5
  return Math.round((Number(value) || 0) / step) * step
}

function workoutRow(set, tm, unit) {
  const weight = Number(set.percentage) > 0 ? snap(tm * Number(set.percentage), unit) : Number(set.weight) || 0
  const type = String(set.type || '').toLocaleLowerCase()
  const row = Number(set.duration) > 0 && !(Number(set.reps) > 0)
    ? { sec: Number(set.duration), w: weight, done: false }
    : { r: Number(set.reps) || 0, w: weight, done: false }
  if (type === 'warmup') row.phase = 'warmup'
  if (type === 'failure') row.failure = true
  if (type && type !== 'regular') row.programSetType = type
  if (Number(set.repsInReserve) >= 0 && set.repsInReserve !== null && set.repsInReserve !== '') row.rir = Number(set.repsInReserve)
  if (Number(set.ratePerceivedExertion) > 0) row.rpe = Number(set.ratePerceivedExertion)
  return row
}

export function currentProgramDay(cycle) {
  const week = cycle?.schedule?.[cycle.currentWeek || 0]
  const day = week?.days?.[cycle.currentDay || 0]
  return week && day ? { week, day } : null
}

export function buildProgramWorkout(cycle, workoutView = 'cards', now = Date.now(), id = uid()) {
  const current = currentProgramDay(cycle)
  if (!current) throw new Error('Program has no current workout')
  const entries = (current.day.exercises || []).map(exercise => {
    const key = programExerciseKey(exercise)
    const exerciseId = cycle.exerciseMap?.[key]
    if (!exerciseId) throw new Error(`Unmapped exercise: ${exercise.name || key}`)
    const tm = Number(cycle.trainingMaxes?.[key]?.value) || 0
    const sets = (exercise.sets || []).map(set => workoutRow(set, tm, cycle.unit))
    const work = sets.filter(set => set.phase !== 'warmup')
    const timed = work.length > 0 && work.every(set => set.sec > 0)
    const first = work[0] || sets[0] || {}
    return {
      id: exerciseId,
      target: { mode: timed ? 'time' : 'reps', sets: work.length, ...(timed ? { sec: first.sec || 0 } : { reps: first.r || 0 }), weight: first.w || 0 },
      sets,
      programExercise: { key, name: exercise.name || exercise.exerciseName || key, referenceExerciseId: exercise.referenceExerciseId || null },
    }
  })
  return {
    id,
    d: isoOf(new Date(now)),
    start: now,
    routineIds: [],
    name: `${cycle.programName} · ${current.day.name || `Day ${(cycle.currentDay || 0) + 1}`}`,
    bw: null,
    cur: 0,
    entries,
    workoutView,
    programCycle: { id: cycle.id, week: cycle.currentWeek || 0, day: cycle.currentDay || 0, dayId: current.day.id || null },
  }
}

export function advanceProgramCycle(cycle, now = Date.now()) {
  const next = clone(cycle)
  const week = next.schedule?.[next.currentWeek || 0]
  if ((next.currentDay || 0) + 1 < (week?.days?.length || 0)) next.currentDay++
  else if ((next.currentWeek || 0) + 1 < (next.schedule?.length || 0)) { next.currentWeek++; next.currentDay = 0 }
  else { next.status = 'completed'; next.completedAt = new Date(now).toISOString() }
  next._ts = now
  return next
}

export const cycleForProgram = (state, programId) => Object.values(state?.programCycles || {})
  .filter(cycle => cycle && !cycle.deleted && cycle.programId === programId)
  .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0] || null
