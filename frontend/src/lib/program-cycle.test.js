import { describe, expect, it } from 'vitest'
import { activeProgramCycle, advanceProgramCycle, buildProgramWorkout, createProgramCycle, programExerciseRequirements, resolveProgramExercise, trainingMaxRequirements } from './program-cycle.js'

const exercise = (name, referenceExerciseId, percentage = .65) => ({ name, referenceExerciseId, sets: [{ type: 'warmup', reps: 5, percentage: .4 }, { type: 'regular', reps: 5, percentage }] })
const program = {
  id: 'p1', name: '5/3/1', contentVersion: 'v1',
  schedule: [
    { number: 1, days: [{ id: 'd1', name: 'Day 1', exercises: [exercise('Squat', 'sq')] }, { id: 'd2', name: 'Day 2', exercises: [exercise('Bench Press', 'bp', .75)] }] },
    { number: 2, days: [{ id: 'd3', name: 'Day 1', exercises: [exercise('Deadlift', 'dl', .85)] }] },
  ],
}

describe('program cycle', () => {
  it('finds the selected active program and recovers from a stale selected id', () => {
    const older = { id: 'older', status: 'active', startedAt: '2026-01-01' }
    const newer = { id: 'newer', status: 'active', startedAt: '2026-02-01' }
    const state = { activeProgramCycleId: 'older', programCycles: { older, newer } }
    expect(activeProgramCycle(state)).toBe(older)
    expect(activeProgramCycle({ ...state, activeProgramCycleId: 'missing' })).toBe(newer)
  })

  it('maps common KeyLifts lifts and requires one TM per referenced exercise', () => {
    expect(resolveProgramExercise({ name: 'Overhead • Press' })).toBe('1162')
    expect(resolveProgramExercise({ name: 'Romanian Deadlift (Barbell)' })).toBe('0085')
    expect(resolveProgramExercise({ name: 'Bent-over Row (Dumbbell)' })).toBe('0293')
    expect(resolveProgramExercise({ name: 'Face Pull (Cable)' })).toBe('5609')
    expect(resolveProgramExercise({ name: 'Wheel Rollout' })).toBe('0857')
    expect(trainingMaxRequirements(program)).toEqual([
      { key: 'sq', name: 'Squat', exerciseId: '0043', needsTrainingMax: true },
      { key: 'bp', name: 'Bench Press', exerciseId: '0025', needsTrainingMax: true },
      { key: 'dl', name: 'Deadlift', exerciseId: '0032', needsTrainingMax: true },
    ])
  })

  it('reuses a manual mapping and requires every scheduled exercise to be mapped', () => {
    const custom = { id: 'custom', name: 'Custom plan', schedule: [{ number: 1, days: [{ name: 'Day 1', exercises: [{ name: 'Mystery pull', referenceExerciseId: 'mystery', sets: [{ reps: 10 }] }] }] }] }
    expect(programExerciseRequirements(custom)[0].exerciseId).toBeNull()
    expect(() => createProgramCycle(custom, {}, 'kg')).toThrow('Program setup is incomplete')
    const mappings = { mystery: { exerciseId: '0032', _ts: 10 } }
    expect(resolveProgramExercise({ name: 'Squat', referenceExerciseId: 'sq' }, { sq: { exerciseId: '0025' } })).toBe('0025')
    expect(resolveProgramExercise({ name: 'Front Squat', referenceExerciseId: 'front-squat' }, { 'front-squat': { exerciseId: '0043' } })).toBe('0043')
    expect(createProgramCycle(custom, {}, 'kg', 1000, 'c2', mappings).exerciseMap).toEqual({ mystery: '0032' })
  })

  it('maps a unique exercise when KeyLifts puts the equipment last', () => {
    expect(resolveProgramExercise({ name: 'Front Squat (Barbell)' })).toBe('0042')
    expect(resolveProgramExercise({ name: 'Bench Press (Dumbbell)' })).toBe('0289')
    expect(resolveProgramExercise({ name: 'Biceps Curl' })).toBeNull()
  })

  it('freezes the schedule and builds the first openGym workout from TM percentages', () => {
    const cycle = createProgramCycle(program, { sq: 100, bp: 80, dl: 120 }, 'kg', 1000, 'c1')
    program.schedule[0].days[0].exercises[0].sets[1].reps = 99
    const workout = buildProgramWorkout(cycle, 'cards', 2000, 'w1')
    expect(workout.programCycle).toEqual({ id: 'c1', week: 0, day: 0, dayId: 'd1' })
    expect(workout.entries[0]).toMatchObject({ id: '0043', sets: [{ w: 40, r: 5, phase: 'warmup' }, { w: 65, r: 5 }] })
    expect(workout.entries[0].sets[1].r).toBe(5)
  })

  it('keeps KeyLifts set roles and uses fixed weights for the profile unit', () => {
    const special = {
      id: 'special', name: 'Special sets',
      schedule: [{ number: 1, days: [{ name: 'Day 1', exercises: [{
        name: 'Squat', referenceExerciseId: 'sq', sets: [
          { type: 'pr', reps: 5, weight: { kg: 50, lb: 110 } },
          { type: 'joker', reps: 1, percentage: 1.05 },
          { type: 'drop', reps: 8, weight: { kg: 40, lb: 90 } },
          { type: 'restPause', reps: 20, weight: 30 },
          { type: 'failed', reps: 5, weight: 55 },
        ],
      }] }] }],
    }
    const cycle = createProgramCycle(special, { sq: 100 }, 'lb', 1000, 'special-cycle')
    expect(buildProgramWorkout(cycle, 'cards', 2000, 'special-workout').entries[0].sets).toEqual([
      { r: 5, w: 110, done: false, programSetType: 'pr' },
      { r: 1, w: 105, done: false, programSetType: 'joker' },
      { r: 8, w: 90, done: false, type: 'dropset', programSetType: 'drop' },
      { r: 20, w: 30, done: false, type: 'restpause', programSetType: 'restpause' },
      { r: 5, w: 55, done: false, failure: true, programSetType: 'failed' },
    ])
  })

  it('advances across days and weeks, then completes once', () => {
    let cycle = createProgramCycle(program, { sq: 100, bp: 80, dl: 120 }, 'kg', 1000, 'c1')
    cycle = advanceProgramCycle(cycle, 2000)
    expect([cycle.currentWeek, cycle.currentDay, cycle.status]).toEqual([0, 1, 'active'])
    cycle = advanceProgramCycle(cycle, 3000)
    expect([cycle.currentWeek, cycle.currentDay]).toEqual([1, 0])
    cycle = advanceProgramCycle(cycle, 4000)
    expect(cycle).toMatchObject({ status: 'completed', completedAt: new Date(4000).toISOString() })
  })

  it('refuses an incomplete TM setup', () => {
    expect(() => createProgramCycle(program, { sq: 100 }, 'kg')).toThrow('Program setup is incomplete')
  })
})
