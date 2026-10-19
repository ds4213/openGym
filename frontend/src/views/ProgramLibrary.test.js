import { describe, expect, it } from 'vitest'
import { discoveryGroups, filterProgramCatalog, sortPrograms } from './ProgramLibrary.jsx'

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

  it('filters the goal groups used by the browse chips', () => {
    expect(filterProgramCatalog(programs, '', '', 'muscle')).toEqual([])
    expect(filterProgramCatalog(programs, '', '', 'fat')).toEqual([programs[1]])
  })
})

describe('program discovery ordering', () => {
  const official = { id: 'o', name: 'Official', source: 'official', catalogStatus: 'indexed', goal: 'Strength and Muscle', weeks: 8, daysPerWeek: 4, workoutCount: 32 }
  const older = { id: 'a', name: 'Older', source: 'community', catalogStatus: 'indexed', goal: 'Strength', userCount: 4, createdAt: '2026-01-01T00:00:00Z' }
  const newer = { id: 'b', name: 'Newer', source: 'community', catalogStatus: 'indexed', goal: 'Build Muscle', userCount: 20, createdAt: '2026-09-01T00:00:00Z' }

  it('sorts community programs by real usage or creation time', () => {
    expect(sortPrograms([older, newer], 'popular').map(program => program.id)).toEqual(['b', 'a'])
    expect(sortPrograms([older, newer], 'new').map(program => program.id)).toEqual(['b', 'a'])
  })

  it('builds every discovery section from catalogue metadata', () => {
    const groups = discoveryGroups([official, older, newer])
    expect(groups.recommended).toEqual([official])
    expect(groups.popular[0]).toBe(newer)
    expect(groups.muscle).toEqual([official])
    expect(groups.newest[0]).toBe(newer)
  })
})
