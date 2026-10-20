// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import ProgramEdit from './ProgramEdit.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => structuredClone(value)
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const program = {
  id: 'p1', name: 'My copy', source: 'personal', detailStatus: 'full',
  schedule: [{ number: 1, days: [{ id: 'd1', name: 'Day 1', exercises: [{ id: 'e1', name: 'Squat', referenceExerciseId: 'sq', sets: [{ id: 's1', reps: 5, percentage: .65 }] }] }] }],
}

let host, root
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  useStore.setState({ S: { ...clone(DEF), personalPrograms: { p1: clone(program) } }, user: null })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('personal program editor', () => {
  it('opens a blank unsaved program and requires an exercise before saving', () => {
    act(() => root.render(<MemoryRouter initialEntries={['/programs/new/edit']}><Routes>
      <Route path="/programs/:id/edit" element={<ProgramEdit />} />
    </Routes></MemoryRouter>))
    expect(host.textContent).toContain('Build my own')
    expect(host.textContent).toContain('Every training day needs at least one exercise.')
    expect(Object.keys(useStore.getState().S.personalPrograms)).toEqual(['p1'])
    expect([...host.querySelectorAll('button')].find(button => button.textContent.includes('Save changes')).disabled).toBe(true)
  })

  it('saves a renamed prescription as a new version and returns to its detail', () => {
    act(() => root.render(<MemoryRouter initialEntries={['/programs/p1/edit']}><Routes>
      <Route path="/programs/:id/edit" element={<ProgramEdit />} />
      <Route path="/programs/:id" element={<div>Program saved</div>} />
    </Routes></MemoryRouter>))
    const name = host.querySelector('.program-edit-field input')
    act(() => type(name, 'Updated plan'))
    const reps = host.querySelector('[aria-label="Reps"]')
    act(() => type(reps, '8'))
    act(() => [...host.querySelectorAll('button')].find(button => button.textContent.includes('Save changes')).click())
    const saved = useStore.getState().S.personalPrograms.p1
    expect(saved).toMatchObject({ name: 'Updated plan', personalRevision: 1, weeks: 1, workoutCount: 1 })
    expect(saved.schedule[0].days[0].exercises[0].sets[0].reps).toBe(8)
    expect(host.textContent).toContain('Program saved')
  })
})
