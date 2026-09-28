import { useState } from 'react'
import { DEPARTMENTS, deptById } from '../data/departments'
import { Spinner } from './ui'

// Suggested teams shown under the free-text box while the student types.
// The student can remove any suggestion (with undo) or add any of the 12 teams.
export default function LiveSuggestions({ text, suggested, aiStatus, aiError, removed, added, onChange }) {
  const [adding, setAdding] = useState(false)
  const shown = [
    ...suggested.filter((s) => !removed.includes(s.id)),
    ...added.filter((id) => !suggested.some((s) => s.id === id)).map((id) => ({ id, reasons: ['Added by you.'], manual: true })),
  ]
  const shownIds = new Set(shown.map((s) => s.id))
  const removedShown = suggested.filter((s) => removed.includes(s.id))
  const others = DEPARTMENTS.filter((d) => !shownIds.has(d.id))

  const remove = (id) =>
    onChange(added.includes(id) ? { removed, added: added.filter((x) => x !== id) } : { removed: [...removed, id], added })
  const restore = (id) => onChange({ removed: removed.filter((x) => x !== id), added })
  const add = (id) => onChange({ removed: removed.filter((x) => x !== id), added: [...added, id] })

  const addPanel = (
    <>
      <button type="button" className="link-btn" onClick={() => setAdding((v) => !v)}>
        {adding ? '− Done adding' : '+ Add a team yourself'}
      </button>
      {adding && (
        <div className="chips live-add">
          {others.map((d) => (
            <button key={d.id} type="button" className="chip chip-sm" onClick={() => add(d.id)}>
              {d.icon} {d.short}
            </button>
          ))}
        </div>
      )}
    </>
  )

  if (!text.trim() && added.length === 0) {
    return (
      <div className="live-empty">
        <p className="live-hint">💡 Start typing and we’ll suggest the right support teams as you go. Prefer not to write? Pick teams directly.</p>
        {addPanel}
      </div>
    )
  }

  return (
    <div className="live" aria-live="polite">
      <div className="live-head">
        <b>Suggested support teams</b>
        <span className="live-status">
          {aiStatus === 'loading' && <Spinner label="✨ AI is reading…" />}
          {aiStatus === 'done' && '✨ Refined by AI'}
          {aiStatus === 'error' && <span title={aiError}>⚠️ AI unavailable, using keywords</span>}
          {aiStatus === 'idle' && text.trim().length > 0 && text.trim().length < 30 && 'Keep typing for AI suggestions…'}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="muted small">No teams matched yet. Tell us a bit more, or add a team yourself.</p>
      ) : (
        <div className="live-list">
          {shown.map((s) => {
            const d = deptById(s.id)
            return (
              <div key={s.id} className={`live-chip${s.manual ? ' manual' : ''}`}>
                <span className="live-icon" aria-hidden="true">{d.icon}</span>
                <span className="live-text">
                  <b>{d.name}</b>
                  <small>
                    {s.reasons[0]}
                    {s.ai && !s.manual && <em className="src src-ai">✨ AI</em>}
                  </small>
                </span>
                <button type="button" className="live-x" onClick={() => remove(s.id)} aria-label={`Remove ${d.name}`} title="Remove">
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {removedShown.length > 0 && (
        <div className="live-removed">
          <small>Removed:</small>
          {removedShown.map((s) => (
            <button key={s.id} type="button" className="chip chip-sm" onClick={() => restore(s.id)} title="Undo">
              ↺ {deptById(s.id).short}
            </button>
          ))}
        </div>
      )}

      {addPanel}
    </div>
  )
}
