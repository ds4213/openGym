// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { StartChooser } from './Workout.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Start workout — active program', () => {
  it('puts the program workout first and labels routines as alternatives', () => {
    const cycle = {
      id: 'c1', programName: '5/3/1 Beginner', status: 'active', currentWeek: 0, currentDay: 0,
      startedAt: '2026-10-20T00:00:00Z', schedule: [{ number: 1, days: [{ name: 'Squat Day', exercises: [] }] }],
    }
    useStore.setState(state => ({ S: {
      ...state.S, active: null, activeProgramCycleId: cycle.id, programCycles: { [cycle.id]: cycle },
      routines: [{ id: 'r1', name: 'Push', emoji: null, ex: [] }],
      week: { [new Date().getDay()]: ['r1'] }, dayPlan: {},
    } }))

    act(() => root.render(<StartChooser />))
    expect(host.textContent).toContain('Active Program')
    expect(host.textContent).toContain('5/3/1 Beginner')
    expect(host.textContent).toContain('Squat Day')
    expect(host.textContent).toContain('Scheduled routines')
    expect(host.textContent).toContain('Routines below are optional alternatives')
  })
})
