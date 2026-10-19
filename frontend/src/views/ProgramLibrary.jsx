import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { programText as p } from '../lib/program-text.js'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section, SearchField } from '../components/ui.jsx'

export function filterProgramCatalog(programs, query, source) {
  const needle = query.trim().toLocaleLowerCase()
  return programs.filter(program =>
    (!source || program.source === source) &&
    (!needle || [program.name, program.family, program.phase, program.goal].some(value => value?.toLocaleLowerCase().includes(needle)))
  )
}

const sourceName = source => source === 'official' ? p('Official') : p('Community')

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
    [p('Source'), sourceName(program.source)],
    [p('Family'), program.family],
    [p('Phase'), program.phase],
    [p('Goal'), program.goal],
    [p('Weeks'), program.weeks],
    [p('Days per week'), program.daysPerWeek],
    [p('Workouts'), program.workoutCount],
    [p('People using it'), program.userCount],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{program.name}</h1><div className="sub">{sourceName(program.source)}</div></div>
      <Button size="sm" icon="chevronLeft" onClick={() => nav('/programs')}>{p('Programs')}</Button>
    </div>
    <Section title={p('Program details')}>
      {facts.map(([label, value]) => <Row key={label} title={label} value={String(value)} />)}
    </Section>
    <p className="small dim" style={{ margin: '12px 4px' }}>
      {program.catalogStatus === 'metadata-only'
        ? p('Only catalogue information is available for this community program right now.')
        : p('Workout import and Start Program will be added in the next implementation step.')}
    </p>
  </div>
}

export default function ProgramLibrary() {
  const { id } = useParams()
  const nav = useNavigate()
  const [programs, setPrograms] = useState([])
  const [counts, setCounts] = useState(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) return
    let current = true
    api('/api/programs?limit=500')
      .then(result => { if (current) { setPrograms(result.programs); setCounts(result.counts) } })
      .catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [id])

  const shown = useMemo(() => filterProgramCatalog(programs, query, source), [programs, query, source])
  if (id) return <ProgramDetail id={id} />

  return <div className="narrow">
    <div className="hdr"><div><h1>{p('Programs')}</h1><div className="sub">{counts ? p('{0} KeyLifts programs', counts.total) : p('KeyLifts program catalogue')}</div></div></div>
    <SearchField value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder={p('Search programs…')} />
    <div className="chips" style={{ margin: '10px 0 12px' }}>
      {[
        ['', t('All'), counts?.total],
        ['official', p('Official'), counts?.official],
        ['community', p('Community'), counts?.community],
      ].map(([value, label, count]) => <button key={value} className={'chip nocap' + (source === value ? ' on' : '')} onClick={() => setSource(value)}>{label}{count != null ? ` ${count}` : ''}</button>)}
    </div>
    {error && <div className="empty">{p('Could not load programs')}: {error}</div>}
    {!error && !counts && <div className="empty">{t('Loading…')}</div>}
    {counts && <div className="list">
      {shown.map(program => <div key={program.id} className="item" role="button" tabIndex="0" onClick={() => nav('/programs/' + encodeURIComponent(program.id))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') nav('/programs/' + encodeURIComponent(program.id)) }}>
        <div className="grow">
          <div className="tt">{program.name}</div>
          <div className="ss">{[sourceName(program.source), program.family, program.weeks && p('{0} weeks', program.weeks), program.daysPerWeek && p('{0} days/week', program.daysPerWeek)].filter(Boolean).join(' · ')}</div>
        </div>
        <Icon name="chevronRight" className="chev" />
      </div>)}
      {!shown.length && <div className="empty"><Icon name="magnifier" /> {t('No match')}</div>}
    </div>}
  </div>
}
