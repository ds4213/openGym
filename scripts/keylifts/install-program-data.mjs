import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = fileURLToPath(new URL('../..', import.meta.url))
const source = path.join(app, 'api', 'programs')
const target = path.join(app, 'program-data')
const staging = target + '.tmp'
const backup = target + '.old'
const catalog = JSON.parse(fs.readFileSync(path.join(source, 'catalog.json'), 'utf8'))
const details = fs.readdirSync(path.join(source, 'details')).filter(name => name.endsWith('.json'))

if (catalog.programs.length !== catalog.counts.total || details.length < catalog.counts.total - catalog.counts.metadataOnly) {
  throw new Error(`Incomplete source data: ${catalog.programs.length} catalogue rows and ${details.length} detail files`)
}

fs.rmSync(staging, { recursive: true, force: true })
fs.rmSync(backup, { recursive: true, force: true })
fs.mkdirSync(staging, { recursive: true })
fs.copyFileSync(path.join(source, 'catalog.json'), path.join(staging, 'catalog.json'))
fs.cpSync(path.join(source, 'details'), path.join(staging, 'details'), { recursive: true })
if (fs.existsSync(target)) fs.renameSync(target, backup)
try {
  fs.renameSync(staging, target)
  fs.rmSync(backup, { recursive: true, force: true })
} catch (error) {
  if (fs.existsSync(backup)) fs.renameSync(backup, target)
  throw error
}
console.log(`Installed ${catalog.programs.length} programs and ${details.length} full details in ${target}`)
