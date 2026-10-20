import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listPrograms, programById, programDetailById } from '../program-catalog.js'

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

test('detail cache adds a valid full prescription and reports missing or invalid files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-program-details-'))
  const first = listPrograms({ limit: '1' }).programs[0]
  const detail = { schemaVersion: 1, id: first.id, name: first.name, contentVersion: 'v1', schedule: [{ number: 1, days: [] }] }
  fs.writeFileSync(path.join(directory, first.id + '.json'), JSON.stringify(detail))
  assert.deepEqual(programDetailById(first.id, directory), { ...first, ...detail, detailStatus: 'full' })

  const second = listPrograms({ offset: '1', limit: '1' }).programs[0]
  assert.equal(programDetailById(second.id, directory).detailStatus, 'metadata-only')
  const third = listPrograms({ offset: '2', limit: '1' }).programs[0]
  fs.writeFileSync(path.join(directory, third.id + '.json'), '{}')
  assert.equal(programDetailById(third.id, directory).detailStatus, 'invalid')
  fs.rmSync(directory, { recursive: true, force: true })
})

test('catalog can be loaded from an external deployment file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-program-catalog-'))
  const catalogFile = path.join(directory, 'catalog.json')
  fs.writeFileSync(catalogFile, JSON.stringify({
    sourceCheckedAt: '2026-10-20T00:00:00Z', counts: { total: 1, official: 0, community: 1, metadataOnly: 1 },
    programs: [{ id: 'external-1', name: 'External Program', source: 'community', levels: [] }],
  }))
  const moduleFile = fileURLToPath(new URL('../program-catalog.js', import.meta.url))
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    const { listPrograms } = await import(${JSON.stringify(pathToFileURL(moduleFile).href)})
    process.stdout.write(JSON.stringify(listPrograms()))
  `], { env: { ...process.env, PROGRAM_CATALOG_FILE: catalogFile }, encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).programs[0].id, 'external-1')
  fs.rmSync(directory, { recursive: true, force: true })
})
