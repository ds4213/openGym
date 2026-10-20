import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const catalogFile = process.env.PROGRAM_CATALOG_FILE || fileURLToPath(new URL('./programs/catalog.json', import.meta.url))
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'))
const byId = new Map(catalog.programs.map(program => [program.id, program]))
const detailsDir = process.env.PROGRAM_DETAILS_DIR || fileURLToPath(new URL('./programs/details', import.meta.url))
const detailCache = new Map()

export function listPrograms({ q = '', source = '', offset = '0', limit = '100' } = {}) {
  if (source && source !== 'official' && source !== 'community') throw new TypeError('invalid source')
  const start = Number(offset), size = Number(limit)
  if (!Number.isInteger(start) || start < 0) throw new TypeError('invalid offset')
  if (!Number.isInteger(size) || size < 1 || size > 500) throw new TypeError('invalid limit')
  const needle = String(q).trim().toLocaleLowerCase()
  const matches = catalog.programs.filter(program =>
    (!source || program.source === source) &&
    (!needle || [program.name, program.family, program.phase, program.goal, ...(program.levels || [])].some(value => value?.toLocaleLowerCase().includes(needle)))
  )
  return {
    programs: matches.slice(start, start + size),
    total: matches.length,
    offset: start,
    limit: size,
    counts: catalog.counts,
    sourceCheckedAt: catalog.sourceCheckedAt,
  }
}

export const programById = id => byId.get(id) || null

export function programDetailById(id, directory = detailsDir) {
  const program = programById(id)
  if (!program) return null
  const key = directory + '\0' + id
  if (detailCache.has(key)) return detailCache.get(key)
  let result
  try {
    const detail = JSON.parse(fs.readFileSync(path.join(directory, id + '.json'), 'utf8'))
    result = detail?.schemaVersion === 1 && detail.id === id && Array.isArray(detail.schedule)
      ? { ...program, ...detail, detailStatus: 'full' }
      : { ...program, detailStatus: 'invalid' }
  } catch (error) {
    result = { ...program, detailStatus: error?.code === 'ENOENT' ? 'metadata-only' : 'invalid' }
  }
  detailCache.set(key, result)
  return result
}
