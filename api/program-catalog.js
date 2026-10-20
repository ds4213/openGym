import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const catalog = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./programs/catalog.json', import.meta.url)), 'utf8'))
const byId = new Map(catalog.programs.map(program => [program.id, program]))

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
