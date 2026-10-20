import { describe, expect, it } from 'vitest'
import { blankPersonalProgram, copyProgramTemplate, personalProgramsOf, savePersonalProgramDraft, validatePersonalProgram } from './personal-programs.js'

describe('personal program copies', () => {
  it('pins the source version and deep-copies its prescription', () => {
    const source = { id: 'source', name: '10/5/1', source: 'official', contentVersion: 'abc', schedule: [{ number: 1, days: [] }] }
    const copy = copyProgramTemplate(source, Date.parse('2026-10-20T12:00:00Z'), 'personal')
    expect(copy).toMatchObject({ id: 'personal', name: '10/5/1 (Copy)', source: 'personal', sourceProgram: { id: 'source', source: 'official', contentVersion: 'abc' }, detailStatus: 'full' })
    copy.schedule[0].number = 2
    expect(source.schedule[0].number).toBe(1)
  })

  it('hides deletion tombstones and puts recent copies first', () => {
    expect(personalProgramsOf({ personalPrograms: {
      a: { id: 'a', name: 'A', savedAt: '2026-01-01' },
      b: { id: 'b', name: 'B', savedAt: '2026-02-01' },
      c: { id: 'c', name: 'C', deleted: true, _ts: 3 },
    } }).map(program => program.id)).toEqual(['b', 'a'])
  })

  it('saves an edited prescription as a new personal version without changing the source copy', () => {
    const original = { id: 'p1', name: 'Original', source: 'personal', personalRevision: 2, schedule: [{ number: 9, days: [{ id: 'd1', name: 'Day', exercises: [{ id: 'e1', name: 'Squat', sets: [{ id: 's1', reps: 5, order: 8 }] }] }] }] }
    const draft = structuredClone(original)
    draft.name = '  My program  '
    draft.schedule[0].days[0].exercises[0].sets[0].reps = 8
    const saved = savePersonalProgramDraft(original, draft, 1000)
    expect(saved).toMatchObject({ name: 'My program', weeks: 1, daysPerWeek: 1, workoutCount: 1, personalRevision: 3, contentVersion: 'personal-3-1000', _ts: 1000 })
    expect(saved.schedule[0]).toMatchObject({ number: 1, days: [{ week: 1, exercises: [{ sets: [{ reps: 8, order: 0 }] }] }] })
    expect(original.name).toBe('Original')
  })

  it('refuses incomplete personal schedules', () => {
    expect(validatePersonalProgram({ name: '', schedule: [] })).toBe('Give this program a name.')
    expect(validatePersonalProgram({ name: 'Plan', schedule: [{ days: [] }] })).toBe('Every week needs at least one training day.')
    expect(() => savePersonalProgramDraft({ id: 'p1', source: 'official' }, { id: 'p1', name: 'Plan', schedule: [] })).toThrow('Only a matching personal program can be edited.')
  })

  it('starts a blank personal program without saving an invalid library entry', () => {
    const blank = blankPersonalProgram(1000, 'p1')
    expect(blank).toMatchObject({ id: 'p1', name: 'My program', source: 'personal', personalRevision: 0, detailStatus: 'full' })
    expect(blank.schedule).toHaveLength(1)
    expect(blank.schedule[0].days[0].exercises).toEqual([])
    expect(validatePersonalProgram(blank)).toBe('Every training day needs at least one exercise.')
  })
})
