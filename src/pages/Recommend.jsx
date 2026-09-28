import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../state/CaseStore'
import { DEPARTMENTS, deptById } from '../data/departments'
import { recommend, rulePriority, ruleIssueTitle, ruleSummary, maxPriority, readableAnswers, detectCrisis } from '../lib/recommend'
import { aiTriage } from '../lib/ai'
import { Empty, PriorityTag, Spinner } from '../components/ui'
import { CrisisBanner } from './GetSupport'

export default function Recommend() {
  const { draft, createCase } = useStore()
  const navigate = useNavigate()
  const rules = useMemo(() => (draft ? recommend(draft) : []), [draft])
  // Teams the student removed while typing stay unticked unless they re-add them here.
  const removed = useMemo(() => new Set(draft?.removedDepts || []), [draft])
  const [selected, setSelected] = useState(
    () => new Set([...rules.map((r) => r.id).filter((id) => !removed.has(id)), ...(draft?.deptPicks || [])])
  )
  const [ai, setAi] = useState({ status: 'idle' })
  const [summary, setSummary] = useState(null) // null = not edited by the student
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState({})
  const started = useRef(false)

  const runAi = () => {
    setAi({ status: 'loading' })
    aiTriage({ description: draft.description, answers: readableAnswers(draft) })
      .then((data) => {
        setAi({ status: 'done', data })
        setSelected((prev) => new Set([...prev, ...data.departments.map((d) => d.id).filter((id) => !removed.has(id))]))
      })
      .catch((e) => setAi({ status: 'error', error: e.message }))
  }

  useEffect(() => {
    if (!draft || started.current) return
    started.current = true
    runAi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) {
    return (
      <div className="page narrow">
        <Empty icon="📝" title="No request yet">
          <Link to="/support">Start a support request</Link> first.
        </Empty>
      </div>
    )
  }

  const aiData = ai.status === 'done' ? ai.data : null
  const crisis = draft.urgent === 'yes' || detectCrisis(draft.description)
  const priority = maxPriority(rulePriority(draft), aiData?.priority || 'Low')
  const urgent = crisis || Boolean(aiData?.urgent)
  const title = aiData?.title || ruleIssueTitle(draft)
  const summaryText = summary ?? (aiData?.caseSummary || ruleSummary(draft))

  // Merge rule-based and AI suggestions into one list.
  const merged = new Map()
  rules.forEach((r) => merged.set(r.id, { id: r.id, reasons: [...r.reasons], rules: true, ai: false }))
  ;(draft.deptPicks || []).forEach((id) => {
    const m = merged.get(id) || { id, reasons: [], rules: false, ai: false }
    const p = draft.pickReasons?.[id]
    if (p) {
      m.intake = true
      p.reasons.forEach((x) => !m.reasons.includes(x) && m.reasons.push(x))
    } else if (draft.addedDepts?.includes(id)) {
      m.manual = true
      if (!m.reasons.length) m.reasons.push('Added by you.')
    }
    merged.set(id, m)
  })
  aiData?.departments.forEach((d) => {
    const m = merged.get(d.id) || { id: d.id, reasons: [], rules: false, ai: false }
    m.ai = true
    m.aiReason = d.reason
    merged.set(d.id, m)
  })
  selected.forEach((id) => {
    if (!merged.has(id)) merged.set(id, { id, reasons: ['Added by you.'], rules: false, ai: false, manual: true })
  })
  const recs = [...merged.values()]
  const others = DEPARTMENTS.filter((d) => !merged.has(d.id))

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const confirm = async () => {
    const deptIds = DEPARTMENTS.map((d) => d.id).filter((id) => selected.has(id))
    setSaving({ busy: true })
    try {
      const id = await createCase({ issue: title, summary: summaryText, priority, urgent, deptIds })
      navigate(`/my-case/${id}?new=1`)
    } catch (e) {
      setSaving({ error: e.message })
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <p className="eyebrow">Student · Review</p>
        <h1 className="display-md">your support team.</h1>
        <p className="lead">Based on your responses, these support teams may be relevant to your case. You can add or remove any of them.</p>
      </div>

      {crisis && <CrisisBanner />}

      <div className={`ai-status ai-${ai.status}`}>
        {ai.status === 'loading' && <Spinner label="✨ AI assistant is reading your request…" />}
        {ai.status === 'done' && (
          <span>✨ AI assistant reviewed your request and suggested <b>{aiData.departments.length}</b> team{aiData.departments.length === 1 ? '' : 's'}. Suggestions from your answers are shown too.</span>
        )}
        {ai.status === 'error' && (
          <span>
            ⚠️ AI assistant unavailable: {ai.error} Showing recommendations based on your answers.{' '}
            <button type="button" className="link-btn" onClick={runAi}>Retry AI</button>
          </span>
        )}
      </div>

      <div className="rec-list">
        {recs.map((r) => {
          const d = deptById(r.id)
          const on = selected.has(r.id)
          return (
            <label key={r.id} className={`rec-card${on ? ' on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />
              <span className="rec-icon" aria-hidden="true">{d.icon}</span>
              <div className="rec-body">
                <div className="rec-title">
                  <b>{d.name}</b>
                  {r.rules && <span className="src src-rules">From your answers</span>}
                  {r.ai && <span className="src src-ai">✨ AI suggested</span>}
                  {r.intake && <span className="src src-intake">From your description</span>}
                  {r.manual && <span className="src">Added by you</span>}
                  {removed.has(r.id) && !on && <span className="src">Removed by you</span>}
                </div>
                <ul className="reasons">
                  {r.reasons.map((x) => <li key={x}>{x}</li>)}
                  {r.aiReason && <li className="ai-reason">{r.aiReason}</li>}
                </ul>
              </div>
              <span className="check" aria-hidden="true">{on ? '✓' : '+'}</span>
            </label>
          )
        })}
      </div>

      <div className="add-more">
        <button type="button" className="link-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? '− Hide other teams' : `+ Add another support team (${others.length} more)`}
        </button>
        {showAll && (
          <div className="chips">
            {others.map((d) => (
              <button type="button" key={d.id} className="chip" onClick={() => toggle(d.id)}>
                {d.icon} {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card summary-card">
        <div className="row between wrap gap">
          <div>
            <p className="eyebrow">Your case</p>
            <h3 className="case-title">{title}</h3>
          </div>
          <PriorityTag priority={priority} urgent={urgent} />
        </div>
        <label className="field">
          <span>
            How your case will be described to the teams {aiData?.caseSummary && summary === null && <em className="ai-inline">✨ drafted by AI</em>} (you can edit this)
          </span>
          <textarea rows={3} value={summaryText} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <p className="muted small">
          🔒 Only the {selected.size} team{selected.size === 1 ? '' : 's'} you confirm can see this case. The other {12 - selected.size} departments can’t.
        </p>
      </div>

      <div className="form-actions">
        <Link to="/support" className="btn btn-ghost">← Edit answers</Link>
        <button type="button" className="btn btn-primary btn-lg" disabled={selected.size === 0 || saving.busy} onClick={confirm}>
          {saving.busy ? 'Creating your case…' : `Create my case with ${selected.size} team${selected.size === 1 ? '' : 's'} →`}
        </button>
      </div>
      {saving.error && <p className="form-error" role="alert">⚠️ {saving.error}</p>}
    </div>
  )
}
