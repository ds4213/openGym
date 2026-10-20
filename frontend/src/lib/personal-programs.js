import { uid } from './format.js'

const clone = value => JSON.parse(JSON.stringify(value))

export function copyProgramTemplate(program, now = Date.now(), id = 'p' + uid()) {
  const copy = clone(program)
  return {
    ...copy,
    id,
    name: `${program.name} (Copy)`,
    source: 'personal',
    sourceProgram: {
      id: program.id,
      source: program.source,
      contentVersion: program.contentVersion || null,
    },
    savedAt: new Date(now).toISOString(),
    detailStatus: 'full',
    _ts: now,
  }
}

export function personalProgramsOf(state) {
  return Object.values(state?.personalPrograms || {})
    .filter(program => program && !program.deleted)
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || '') || a.name.localeCompare(b.name))
}
