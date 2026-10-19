import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { boundPort } from './helpers.mjs'

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

async function startServer(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-programs-'))
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' },
  })
  let log = ''
  child.stdout.on('data', data => { log += data })
  child.stderr.on('data', data => { log += data })
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }) })
  return `http://127.0.0.1:${await boundPort(child, () => log)}`
}

test('program catalogue routes serve the imported snapshot', async t => {
  const origin = await startServer(t)
  const listResponse = await fetch(origin + '/api/programs?source=official&limit=500')
  assert.equal(listResponse.status, 200)
  const list = await listResponse.json()
  assert.equal(list.total, 179)
  assert.ok(list.programs.every(program => program.source === 'official'))

  const detailResponse = await fetch(origin + '/api/program?id=' + encodeURIComponent(list.programs[0].id))
  assert.equal(detailResponse.status, 200)
  assert.equal((await detailResponse.json()).program.id, list.programs[0].id)
  assert.equal((await fetch(origin + '/api/programs?limit=501')).status, 400)
  assert.equal((await fetch(origin + '/api/program')).status, 400)
})
