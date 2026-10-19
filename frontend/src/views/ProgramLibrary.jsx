import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { programText as p } from '../lib/program-text.js'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section, SearchField, Segmented } from '../components/ui.jsx'

const textOf = program => [program.name, program.family, program.phase, program.goal].filter(Boolean).join(' ').toLocaleLowerCase()
const goalMatches = (program, goal) => {
  const value = (program.goal || '').toLocaleLowerCase()
  if (!goal) return true
  if (goal === 'muscle') return value.includes('muscle')
  if (goal === 'strength') return value.includes('strength')
  if (goal === 'conditioning') return value.includes('conditioning') || value.includes('challenge')
  return value.includes('fat')
}

export function filterProgramCatalog(programs, query, source = '', goal = '') {
  const needle = query.trim().toLocaleLowerCase()
  return programs.filter(program =>
    (!source || program.source === source) && goalMatches(program, goal) && (!needle || textOf(program).includes(needle))
  )
}

export function sortPrograms(programs, sort) {
  const copy = [...programs]
  if (sort === 'new') return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name))
  if (sort === 'az') return copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy.sort((a, b) => (b.userCount || 0) - (a.userCount || 0) || a.name.localeCompare(b.name))
}

export function discoveryGroups(programs) {
  const official = programs.filter(program => program.source === 'official' && program.catalogStatus === 'indexed')
  const community = programs.filter(program => program.source === 'community' && program.catalogStatus === 'indexed')
  const recommended = official.filter(program => program.weeks >= 3 && program.weeks <= 16 && program.daysPerWeek >= 3 && program.daysPerWeek <= 5 && /strength|muscle/i.test(program.goal || ''))
    .sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0) || a.name.localeCompare(b.name))
  return {
    recommended: recommended.slice(0, 8),
    popular: sortPrograms(community, 'popular').slice(0, 8),
    muscle: official.filter(program => /muscle/i.test(program.goal || '')).sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0)).slice(0, 8),
    strength: official.filter(program => /^strength$/i.test(program.goal || '')).sort((a, b) => (b.workoutCount || 0) - (a.workoutCount || 0)).slice(0, 8),
    newest: sortPrograms(community, 'new').slice(0, 8),
  }
}

const sourceName = source => source === 'official' ? p('Official') : p('Community')
const programMeta = program => [program.family, program.weeks && p('{0} weeks', program.weeks), program.daysPerWeek && p('{0} days/week', program.daysPerWeek)].filter(Boolean).join(' · ')

function ProgramDetail({ id }) {
  const nav = useNavigate()
  const [program, setProgram] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    api('/api/program?id=' + encodeURIComponent(id))
      .then(result => { if (current) setProgram(result.program) })
      .catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [id])

  if (error) return <div className="narrow"><div className="empty">{p('Could not load programs')}: {error}</div></div>
  if (!program) return <div className="narrow"><div className="empty">{t('Loading…')}</div></div>

  const facts = [
    [p('Source'), sourceName(program.source)], [p('Family'), program.family], [p('Phase'), program.phase],
    [p('Goal'), program.goal], [p('Weeks'), program.weeks], [p('Days per week'), program.daysPerWeek],
    [p('Workouts'), program.workoutCount], [p('People using it'), program.userCount],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return <div className="narrow programs-page">
    <div className="hdr">
      <div><h1>{program.name}</h1><div className="sub">{sourceName(program.source)}</div></div>
      <Button size="sm" icon="chevronLeft" onClick={() => nav('/programs')}>{p('Programs')}</Button>
    </div>
    <Section title={p('Program details')}>{facts.map(([label, value]) => <Row key={label} title={label} value={String(value)} />)}</Section>
    <p className="small dim program-note">{program.catalogStatus === 'metadata-only'
      ? p('Only catalogue information is available for this community program right now.')
      : p('Workout import and Start Program will be added in the next implementation step.')}</p>
  </div>
}

function ProgramCard({ program, onOpen }) {
  return <button className="program-card" onClick={() => onOpen(program)}>
    <strong>{program.name}</strong>
    <span className="program-card-meta">{programMeta(program) || program.goal}</span>
    <span className="program-card-foot"><span>{sourceName(program.source)}</span><span>{program.userCount ? p('{0} people', program.userCount) : program.goal}</span></span>
  </button>
}

function DiscoverySection({ title, subtitle, programs, onOpen }) {
  if (!programs.length) return null
  return <section className="program-discovery">
    <div className="program-section-head"><h2>{p(title)}</h2><p>{p(subtitle)}</p></div>
    <div className="program-rail">{programs.map(program => <ProgramCard key={program.id} program={program} onOpen={onOpen} />)}</div>
  </section>
}

export default function ProgramLibrary() {
  const { id } = useParams()
  const nav = useNavigate()
  const [programs, setPrograms] = useState([])
  const [counts, setCounts] = useState(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('discover')
  const [goal, setGoal] = useState('')
  const [sort, setSort] = useState('popular')
  const [shown, setShown] = useState(40)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) return
    let current = true
    api('/api/programs?limit=500')
      .then(result => { if (current) { setPrograms(result.programs); setCounts(result.counts) } })
      .catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [id])

  const groups = useMemo(() => discoveryGroups(programs), [programs])
  const source = tab === 'community' ? 'community' : ''
  const filtered = useMemo(() => sortPrograms(filterProgramCatalog(programs, query, source, goal), tab === 'community' ? sort : 'az'), [programs, query, source, goal, sort, tab])
  const open = program => nav('/programs/' + encodeURIComponent(program.id))
  const chooseTab = value => { setTab(value); setGoal(''); setQuery(''); setShown(40) }
  const chooseGoal = value => { setGoal(value); setShown(40) }
  if (id) return <ProgramDetail id={id} />

  return <div className="narrow programs-page">
    <div className="hdr program-title"><div><h1>{p('Programs')}</h1><div className="sub">{counts ? p('{0} KeyLifts programs', counts.total) : p('KeyLifts program catalogue')}</div></div></div>
    <Segmented className="program-tabs" value={tab} onChange={chooseTab} options={[
      { value: 'discover', label: p('Discover') }, { value: 'community', label: p('Community') },
    ]} />
    <SearchField value={query} onChange={event => { setQuery(event.target.value); setShown(40) }} onClear={() => setQuery('')} placeholder={p('Search programs…')} />

    {error && <div className="empty">{p('Could not load programs')}: {error}</div>}
    {!error && !counts && <div className="program-skeleton" aria-label={t('Loading…')}><i /><i /><i /></div>}

    {counts && tab === 'discover' && !query && !goal && <div className="program-discover-sections">
      <DiscoverySection title="Recommended" subtitle="Complete official programs for a strong start" programs={groups.recommended} onOpen={open} />
      <DiscoverySection title="Popular" subtitle="Most used by the KeyLifts community" programs={groups.popular} onOpen={open} />
      <DiscoverySection title="Build muscle" subtitle="Programs focused on size and hypertrophy" programs={groups.muscle} onOpen={open} />
      <DiscoverySection title="Strength" subtitle="Programs focused on getting stronger" programs={groups.strength} onOpen={open} />
      <DiscoverySection title="New discoveries" subtitle="Recently shared with the community" programs={groups.newest} onOpen={open} />
    </div>}

    {counts && <section className="program-browser">
      <div className="program-browser-head"><h2>{tab === 'community' ? p('Community programs') : p('Browse all')}</h2><span>{p('{0} programs', filtered.length)}</span></div>
      <div className="chips program-goals">
        {[["", p('All goals')], ['strength', p('Strength')], ['muscle', p('Build muscle')], ['conditioning', p('Conditioning')], ['fat', p('Fat loss')]].map(([value, label]) =>
          <button key={value} className={'chip nocap' + (goal === value ? ' on' : '')} onClick={() => chooseGoal(value)}>{label}</button>)}
      </div>
      {tab === 'community' && <div className="chips program-sort">
        {[['popular', p('Most popular')], ['new', p('Newest')], ['az', p('A–Z')]].map(([value, label]) =>
          <button key={value} className={'chip nocap' + (sort === value ? ' on' : '')} onClick={() => { setSort(value); setShown(40) }}>{label}</button>)}
      </div>}
      <div className="list program-list">
        {filtered.slice(0, shown).map(program => <button key={program.id} className="item program-row" onClick={() => open(program)}>
          <div className="grow"><div className="tt">{program.name}</div><div className="ss">{[sourceName(program.source), programMeta(program)].filter(Boolean).join(' · ')}</div></div>
          {program.userCount > 0 && <span className="program-users">{p('{0} people', program.userCount)}</span>}
          <Icon name="chevronRight" className="chev" />
        </button>)}
        {!filtered.length && <div className="empty"><Icon name="magnifier" /> {t('No match')}</div>}
      </div>
      {filtered.length > shown && <Button className="program-more" onClick={() => setShown(value => value + 40)}>{t('Show more')}</Button>}
    </section>}
  </div>
}
