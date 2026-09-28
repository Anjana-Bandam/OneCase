import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DURATIONS, IMPACTS, URGENCY } from '../data/intake'
import { DEPARTMENTS } from '../data/departments'
import { detectCrisis } from '../lib/recommend'
import { useStore } from '../state/CaseStore'
import { initials } from '../components/ui'
import LiveSuggestions from '../components/LiveSuggestions'
import { useLiveSuggestions } from '../lib/useLiveSuggestions'

const EMPTY = {
  description: '',
  areas: [],
  duration: '',
  impact: '',
  multi: '',
  extraAreas: [],
  helpTypes: [],
  contacted: '',
  contactedDepts: [],
  urgent: '',
  removedDepts: [],
  addedDepts: [],
}

function Chips({ options, value, onChange, multi = false }) {
  const selected = (id) => (multi ? value.includes(id) : value === id)
  const toggle = (id) => {
    if (!multi) return onChange(id)
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }
  return (
    <div className="chips" role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          className={`chip${selected(o.id) ? ' on' : ''}`}
          aria-pressed={selected(o.id)}
          onClick={() => toggle(o.id)}
        >
          {selected(o.id) && multi ? '✓ ' : ''}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CrisisBanner() {
  return (
    <div className="crisis" role="alert">
      <b>If you are in immediate danger or thinking about harming yourself, please get help now.</b>
      <span>
        Emergency: <a href="tel:112">112</a> · Tele-MANAS mental health helpline (24/7, free): <a href="tel:14416">14416</a> · Campus security desk
      </span>
      <small>Your case will be marked urgent so the Counseling team can reach you the same day.</small>
    </div>
  )
}

export default function GetSupport() {
  const { user, draft, setDraft } = useStore()
  const navigate = useNavigate()
  // Teams come from the description + live suggestions, so the old
  // "which area / more than one area / type of help" questions are gone.
  const [a, setA] = useState(() => ({ ...EMPTY, ...(draft || {}), areas: [], multi: '', extraAreas: [], helpTypes: [] }))
  const [error, setError] = useState('')
  const set = (k) => (v) => setA((prev) => ({ ...prev, [k]: v }))

  const { suggested, aiStatus, aiError } = useLiveSuggestions(a.description)
  const crisis = a.urgent === 'yes' || detectCrisis(a.description)
  const teamCount = suggested.filter((s) => !a.removedDepts.includes(s.id)).length + a.addedDepts.filter((id) => !suggested.some((s) => s.id === id)).length
  const answered = [a.description.trim() || teamCount > 0, a.duration, a.impact, a.contacted, a.urgent].filter(Boolean).length

  const submit = (e) => {
    e.preventDefault()
    // Teams the student kept from the live suggestions, plus any they added.
    const kept = suggested.filter((s) => !a.removedDepts.includes(s.id))
    const deptPicks = [...new Set([...kept.map((s) => s.id), ...a.addedDepts])]
    const pickReasons = Object.fromEntries(kept.map((s) => [s.id, { reasons: s.reasons, ai: s.ai }]))
    if (!a.description.trim() && deptPicks.length === 0) {
      setError('Tell us what’s going on, or add at least one support team yourself.')
      return
    }
    setDraft({ ...a, deptPicks, pickReasons })
    navigate('/support/review')
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <p className="eyebrow">Student · Get support</p>
        <h1 className="display-md">tell us once.</h1>
        <p className="lead">Describe it once in your own words. We’ll suggest the right teams as you type, and everyone involved works from the same case.</p>
      </div>

      <div className="form-progress" aria-label={`${answered} of 5 steps done`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < answered ? 'on' : ''} />
        ))}
        <small>{answered}/5 done</small>
      </div>

      <form onSubmit={submit} className="intake">
        <div className="q-card ai-card">
          <div className="q-head">
            <span className="ai-tag">✨ AI-assisted</span>
            <h3><span className="q-num">1</span>In your own words, what’s going on?</h3>
          </div>
          <textarea
            rows={4}
            value={a.description}
            onChange={(e) => set('description')(e.target.value)}
            placeholder="e.g. I’ve been falling behind on assignments for a few weeks and I feel really overwhelmed. I can’t sleep and I’m worried about my exams."
          />
          <LiveSuggestions
            text={a.description}
            suggested={suggested}
            aiStatus={aiStatus}
            aiError={aiError}
            removed={a.removedDepts}
            added={a.addedDepts}
            onChange={({ removed, added }) => setA((prev) => ({ ...prev, removedDepts: removed, addedDepts: added }))}
          />
          <div className="submitting-as">
            <span className="avatar">{initials(user.name)}</span>
            <span>
              Submitting as <b>{user.name}</b> · {user.roll}
              <small>From your account, so you don’t type it again.</small>
            </span>
          </div>
        </div>

        {crisis && <CrisisBanner />}

        <p className="q-divider">A few quick questions to help teams prioritise:</p>

        <div className="q-grid">
          <div className="q-card">
            <h3><span className="q-num">2</span>How long have you been experiencing this?</h3>
            <Chips options={DURATIONS} value={a.duration} onChange={set('duration')} />
          </div>
          <div className="q-card">
            <h3><span className="q-num">3</span>How much is this affecting your studies or daily life?</h3>
            <Chips options={IMPACTS} value={a.impact} onChange={set('impact')} />
          </div>
        </div>

        <div className="q-grid">
          <div className="q-card">
            <h3><span className="q-num">4</span>Have you already contacted any university support service about this?</h3>
            <Chips options={[{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }]} value={a.contacted} onChange={set('contacted')} />
            {a.contacted === 'yes' && (
              <div className="sub-q">
                <p>Which service?</p>
                <Chips options={DEPARTMENTS.map((d) => ({ id: d.short, label: d.short }))} value={a.contactedDepts} onChange={set('contactedDepts')} multi />
              </div>
            )}
          </div>
          <div className="q-card">
            <h3><span className="q-num">5</span>Do you feel you need urgent attention?</h3>
            <Chips options={URGENCY} value={a.urgent} onChange={set('urgent')} />
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { setA(EMPTY); setDraft(null) }}>
            Clear
          </button>
          <button type="submit" className="btn btn-primary btn-lg">
            Find the right support teams →
          </button>
        </div>
      </form>
    </div>
  )
}
