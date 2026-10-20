import { describe, expect, it } from 'vitest'
import { advanceProgramCycle, buildProgramWorkout, createProgramCycle, programExerciseRequirements, resolveProgramExercise, trainingMaxRequirements } from './program-cycle.js'

const exercise = (name, referenceExerciseId, percentage = .65) => ({ name, referenceExerciseId, sets: [{ type: 'warmup', reps: 5, percentage: .4 }, { type: 'regular', reps: 5, percentage }] })
const program = {
  id: 'p1', name: '5/3/1', contentVersion: 'v1',
  schedule: [
    { number: 1, days: [{ id: 'd1', name: 'Day 1', exercises: [exercise('Squat', 'sq')] }, { id: 'd2', name: 'Day 2', exercises: [exercise('Bench Press', 'bp', .75)] }] },
    { number: 2, days: [{ id: 'd3', name: 'Day 1', exercises: [exercise('Deadlift', 'dl', .85)] }] },
  ],
}

describe('program cycle', () => {
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

  it('freezes the schedule and builds the first openGym workout from TM percentages', () => {
    const cycle = createProgramCycle(program, { sq: 100, bp: 80, dl: 120 }, 'kg', 1000, 'c1')
    program.schedule[0].days[0].exercises[0].sets[1].reps = 99
    const workout = buildProgramWorkout(cycle, 'cards', 2000, 'w1')
    expect(workout.programCycle).toEqual({ id: 'c1', week: 0, day: 0, dayId: 'd1' })
    expect(workout.entries[0]).toMatchObject({ id: '0043', sets: [{ w: 40, r: 5, phase: 'warmup' }, { w: 65, r: 5 }] })
    expect(workout.entries[0].sets[1].r).toBe(5)
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
