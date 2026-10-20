import { describe, expect, it } from 'vitest'
import { copyProgramTemplate, personalProgramsOf } from './personal-programs.js'

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
})
