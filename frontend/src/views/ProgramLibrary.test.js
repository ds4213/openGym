import { describe, expect, it } from 'vitest'
import { filterProgramCatalog } from './ProgramLibrary.jsx'

const programs = [
  { name: 'Boring But Big', source: 'official', family: '531', phase: 'Leader', goal: 'Strength' },
  { name: 'GZCL Rippler', source: 'community', family: 'GZCL', phase: 'Strength', goal: 'Lose Fat' },
]

describe('program catalogue filtering', () => {
  it('searches metadata without case sensitivity', () => {
    expect(filterProgramCatalog(programs, 'lose fat', '')).toEqual([programs[1]])
    expect(filterProgramCatalog(programs, 'BORING', '')).toEqual([programs[0]])
  })

  it('combines search and source filters', () => {
    expect(filterProgramCatalog(programs, 'strength', 'official')).toEqual([programs[0]])
    expect(filterProgramCatalog(programs, '', 'community')).toEqual([programs[1]])
  })
})
