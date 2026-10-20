import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listPrograms, programById } from '../program-catalog.js'

test('catalog exposes every active official and community program', () => {
  const result = listPrograms({ limit: '500' })
  assert.equal(result.total, 498)
  assert.deepEqual(result.counts, { total: 498, official: 179, community: 319, metadataOnly: 1 })
  assert.equal(new Set(result.programs.map(program => program.id)).size, 498)
})

test('catalog filters source and searchable metadata', () => {
  assert.equal(listPrograms({ source: 'official', limit: '500' }).total, 179)
  const matches = listPrograms({ q: 'boring but strong', source: 'community', limit: '500' })
  assert.ok(matches.total > 0)
  assert.ok(matches.programs.every(program => program.source === 'community'))
  assert.match(matches.programs[0].createdAt, /^20\d\d-/)
  assert.ok(matches.programs.every(program => Array.isArray(program.levels)))
  assert.ok(matches.programs.flatMap(program => program.levels).every(level => ['Beginner', 'Intermediate', 'Advanced'].includes(level)))
})

test('catalog validates paging and returns a program by id', () => {
  assert.throws(() => listPrograms({ source: 'private' }), /invalid source/)
  assert.throws(() => listPrograms({ limit: '501' }), /invalid limit/)
  const first = listPrograms({ limit: '1' }).programs[0]
  assert.deepEqual(programById(first.id), first)
  assert.equal(programById('missing'), null)
})
