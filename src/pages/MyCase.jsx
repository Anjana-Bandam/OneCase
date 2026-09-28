import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore, computeOverall, nextAction } from '../state/CaseStore'
import { deptById } from '../data/departments'
import { Empty, Loading, OverallBadge, Progress, StatusBadge, Timeline, isUpcoming, slotLabel, when } from '../components/ui'
import { ReviewForm, ReviewView, SlotPicker } from '../components/Sessions'

function studentLine(t, c) {
  switch (t.status) {
    case 'completed':
      return 'This part of your support is complete.'
    case 'in_progress':
      return `Working on: ${t.taskName.toLowerCase()}.`
    case 'ready':
      return 'Ready to start. They will contact you shortly.'
    case 'waiting': {
      const dep = c.tasks.find((x) => x.id === t.dependsOn)
      return dep ? `Will start after ${deptById(dep.deptId).short} completes.` : 'Waiting for more information.'
    }
    default:
      return 'Assigned. The team will be in touch soon.'
  }
}

// One support team on the student's case, with its session booking and review actions.
function TeamRow({ c, t, canAct }) {
  const { cancelBooking } = useStore()
  const d = deptById(t.deptId)
  const [mode, setMode] = useState(null) // null | 'book' | 'review'
  const [flash, setFlash] = useState('')
  const [err, setErr] = useState('')
  const booking = c.bookings?.find((b) => b.taskId === t.id)
  const review = c.reviews?.find((r) => r.taskId === t.id)
  const dep = t.status === 'waiting' && c.tasks.find((x) => x.id === t.dependsOn)
  const bookable = ['not_started', 'in_progress', 'ready'].includes(t.status)

  const done = (msg) => {
    setMode(null)
    setErr('')
    if (msg) {
      setFlash(msg)
      setTimeout(() => setFlash(''), 5000)
    }
  }
  const cancel = async () => {
    if (!window.confirm(`Cancel your ${d.short} session on ${slotLabel(booking.start)}?`)) return
    try {
      await cancelBooking(booking.id)
      done('Session cancelled. The slot is free for other students again.')
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className={`team-row st-${t.status}`}>
      <div className="team-main">
        <span className="team-icon" aria-hidden="true">{t.status === 'completed' ? '✅' : d.icon}</span>
        <div className="grow">
          <b>{d.name}</b>
          <p>{studentLine(t, c)}</p>
          {booking && (
            <p className={`session-line${isUpcoming(booking.start) ? '' : ' past'}`}>
              📅 {isUpcoming(booking.start) ? 'Session booked' : 'Session held'}: <b>{slotLabel(booking.start, booking.end)}</b>
            </p>
          )}
          {review && mode !== 'review' && <ReviewView review={review} />}
        </div>
        <StatusBadge status={t.status} />
      </div>

      {canAct && mode === null && (
        <div className="team-actions">
          {bookable && !booking && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode('book')}>📅 Book a session</button>
          )}
          {bookable && booking && isUpcoming(booking.start) && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('book')}>Reschedule</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Cancel session</button>
            </>
          )}
          {dep && <small className="muted">📅 Booking opens once {deptById(dep.deptId).short} completes.</small>}
          {t.status === 'completed' && (
            <button type="button" className={`btn btn-sm ${review ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setMode('review')}>
              {review ? 'Edit your review' : '⭐ Rate this support'}
            </button>
          )}
        </div>
      )}
      {mode === 'book' && <SlotPicker c={c} task={t} onDone={done} />}
      {mode === 'review' && <ReviewForm c={c} task={t} existing={review} onDone={done} />}
      {flash && <div className="toast" role="status">✅ {flash}</div>}
      {err && <p className="error-text">⚠️ {err}</p>}
    </div>
  )
}

export default function MyCase() {
  const { id: paramId } = useParams()
  const [params] = useSearchParams()
  const { user, myCases, getCase, canViewCase, casesLoaded } = useStore()
  const isStudent = user.role === 'student'
  if (!casesLoaded) return <Loading label="Loading your case…" />

  // Students default to their latest case; staff must name the case they preview.
  const c = paramId ? getCase(paramId) : myCases[0]

  if (!c && isStudent && !paramId) {
    return (
      <div className="page narrow">
        <Empty icon="📝" title="You haven’t asked for support yet">
          When you do, your case and its progress will appear here. <Link to="/support">Get support →</Link>
        </Empty>
      </div>
    )
  }

  // The server only sends cases this account may see, so a missing case means "no access".
  if (!c || !canViewCase(c)) {
    return (
      <div className="page narrow">
        <div className="card">
          <Empty icon="🔒" title={`You don’t have access to case #${paramId}`}>
            {isStudent ? 'Students can only see their own cases.' : 'Only departments that are part of this case can view it.'}
          </Empty>
        </div>
      </div>
    )
  }

  const overall = computeOverall(c.tasks)
  const latest = [...c.notes].reverse().find((n) => n.studentMessage)
  const upcoming = (c.bookings || []).filter((b) => isUpcoming(b.start))

  return (
    <div className="page narrow">
      {!isStudent && (
        <div className="preview-banner" role="status">
          👁 <b>Student preview.</b> This is exactly what {c.studentName} sees. Internal notes are hidden.{' '}
          <Link to={`/staff/case/${c.caseId}`}>← Back to the staff case view</Link>
        </div>
      )}
      {params.get('new') && (
        <div className="success-banner" role="status">
          🎉 <b>Case #{c.caseId} created.</b> You told us once. {c.tasks.length} team{c.tasks.length === 1 ? ' has' : 's have'} been assigned and will coordinate on this one case.
        </div>
      )}

      <div className="row between wrap gap page-head">
        <div>
          <p className="eyebrow">{isStudent ? 'Student · My case' : 'Student view'}</p>
          <h1 className="display-md">{isStudent ? 'my case' : 'case'} #{c.caseId}</h1>
        </div>
        {isStudent && myCases.length > 1 && (
          <div className="case-switch" aria-label="Your cases">
            {myCases.map((x) => (
              <Link key={x.caseId} to={`/my-case/${x.caseId}`} className={x.caseId === c.caseId ? 'on' : ''}>
                #{x.caseId}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={`card case-hero overall-${overall}`}>
        <div className="row between wrap gap">
          <div>
            <div className="case-name">{c.studentName}</div>
            <div className="case-issue">{c.issue}</div>
          </div>
          <div className="overall">
            <small>Overall status</small>
            <OverallBadge c={c} big />
          </div>
        </div>
        <Progress tasks={c.tasks} />
        {overall === 'resolved' && <div className="resolved-note">✅ Your support journey is complete. Every team has finished their part.</div>}
      </div>

      <div className="card team-card">
        <h3 className="card-title">Your support teams</h3>
        <p className="muted small">Book a session with each team, and rate their support once they’ve finished.</p>
        <div className="team-list">
          {c.tasks.map((t) => (
            <TeamRow key={t.id} c={c} t={t} canAct={isStudent} />
          ))}
        </div>
      </div>

      <div className="two-col">
          <div className="card highlight">
            <h3 className="card-title">Latest update</h3>
            {latest ? (
              <>
                <p className="quote">“{latest.studentMessage}”</p>
                <small className="muted">{deptById(latest.deptId)?.name} · {when(latest.at)}</small>
              </>
            ) : (
              <p className="muted">Your teams have been notified. Updates will appear here.</p>
            )}
          </div>
          <div className="card">
            <h3 className="card-title">Next step</h3>
            <p>{nextAction(c)}</p>
            {upcoming.length > 0 && (
              <ul className="upcoming-mini">
                {upcoming.map((b) => (
                  <li key={b.id}>📅 {deptById(b.deptId).short}: <b>{slotLabel(b.start, b.end)}</b></li>
                ))}
              </ul>
            )}
          </div>
      </div>

      <div className="card">
        <h3 className="card-title">Case timeline</h3>
        <Timeline items={c.timeline} />
      </div>
    </div>
  )
}
