// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { finishWorkout, startProgram } from './sheets.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
const program = {
  id: 'personal-1', name: 'Simple 5/3/1', source: 'personal', contentVersion: 'v1', detailStatus: 'full',
  schedule: [{ number: 1, days: [{ id: 'day-1', name: 'Squat day', exercises: [{ name: 'Squat', referenceExerciseId: 'sq', sets: [
    { type: 'warmup', reps: 5, percentage: .4 }, { type: 'regular', reps: 5, percentage: .65 },
  ] }] }] }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T17:00:00'))
  useStore.setState({ S: { ...clone(DEF), weighIn: false, personalPrograms: { [program.id]: clone(program) } }, user: null })
  useUI.setState({ sheets: [], toastMsg: '' })
})

afterEach(() => vi.useRealTimers())

describe('starting and completing a program day', () => {
  it('creates a fixed cycle, opens its prescription, saves it, and completes the cycle', () => {
    act(() => startProgram(program, { sq: 100 }))
    let state = useStore.getState().S
    const cycleId = state.activeProgramCycleId
    expect(state.programCycles[cycleId]).toMatchObject({ programId: 'personal-1', currentWeek: 0, currentDay: 0, status: 'active' })
    expect(state.active.entries[0]).toMatchObject({ id: '0043', sets: [{ w: 40, r: 5, phase: 'warmup' }, { w: 65, r: 5 }] })

    act(() => useStore.getState().update(s => s.active.entries[0].sets.forEach(set => { set.done = true })))
    act(() => finishWorkout())
    state = useStore.getState().S
    expect(state.active).toBeNull()
    expect(state.workouts[0].programCycle).toMatchObject({ id: cycleId, week: 0, day: 0, dayId: 'day-1' })
    expect(state.programCycles[cycleId].status).toBe('completed')
    expect(state.activeProgramCycleId).toBeNull()
  })
})
