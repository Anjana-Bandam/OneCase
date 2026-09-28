import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore, computeOverall, nextAction, STATUS } from '../state/CaseStore'
import { deptById } from '../data/departments'
import { aiBrief, aiRewrite } from '../lib/ai'
import { DemoDeptSwitch } from './StaffDashboard'
import { Empty, Loading, OverallBadge, PriorityTag, Progress, Spinner, StatusBadge, Timeline, isUpcoming, slotLabel, when } from '../components/ui'
import { ReviewView } from '../components/Sessions'
import AcademicRecordPanel from '../components/AcademicRecord'

// Data sent to the AI: no student name, only what the case needs.
function aiCaseData(c) {
  return {
    issue: c.issue,
    summary: c.summary,
    priority: c.priority,
    urgent: c.urgent,
    overallStatus: STATUS[computeOverall(c.tasks)].label,
    tasks: c.tasks.map((t) => ({
      department: deptById(t.deptId).name,
      task: t.taskName,
      status: STATUS[t.status].label,
      latestNote: t.note || undefined,
      waitsFor: t.dependsOn ? deptById(c.tasks.find((x) => x.id === t.dependsOn)?.deptId)?.name : undefined,
    })),
    recentActivity: c.timeline.slice(-6).map((x) => x.text),
  }
}

// The student's booked session and review for one department task.
function SessionInfo({ c, taskId }) {
  const b = c.bookings?.find((x) => x.taskId === taskId)
  const r = c.reviews?.find((x) => x.taskId === taskId)
  if (!b && !r) return null
  return (
    <div className="session-info">
      {b && (
        <p className={`session-line${isUpcoming(b.start) ? '' : ' past'}`}>
          📅 {isUpcoming(b.start) ? 'Session' : 'Held'}: <b>{slotLabel(b.start, b.end)}</b>
        </p>
      )}
      {r && <ReviewView review={r} />}
    </div>
  )
}

function MyTaskPanel({ c, task }) {
  const { updateTask } = useStore()
  const d = deptById(task.deptId)
  const [status, setStatus] = useState(task.status)
  const [note, setNote] = useState('')
  const [studentMsg, setStudentMsg] = useState('')
  const [rw, setRw] = useState({ status: 'idle' })
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState({})
  const [touched, setTouched] = useState(false)
  const dep = task.dependsOn && c.tasks.find((x) => x.id === task.dependsOn)

  // Follow live updates (another device, or a dependency unlock) until the user picks a status.
  useEffect(() => {
    if (!touched) setStatus(task.status)
  }, [task.status, touched])

  const options = ['not_started', 'in_progress', 'waiting', ...(task.status === 'ready' ? ['ready'] : []), 'completed']
  const dirty = status !== task.status || note.trim() || studentMsg.trim()

  const rewrite = () => {
    setRw({ status: 'loading' })
    aiRewrite({ note, department: d.name, studentName: c.studentName.split(' ')[0] })
      .then((r) => {
        setStudentMsg(r.message)
        setRw({ status: 'done' })
      })
      .catch((e) => setRw({ status: 'error', error: e.message }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving({ busy: true })
    try {
      const updated = await updateTask(c.caseId, { taskId: task.id, status, note, studentMessage: studentMsg })
      const unlocked = updated.tasks.filter((t) => t.dependsOn === task.id && t.status === 'ready' && c.tasks.find((x) => x.id === t.id)?.status === 'waiting')
      setNote('')
      setStudentMsg('')
      setRw({ status: 'idle' })
      setTouched(false)
      setSaving({})
      setSaved(
        `Saved to the shared case.${unlocked.length ? ` ${unlocked.map((t) => deptById(t.deptId).short).join(', ')} is now Ready.` : ''} The student’s view reflects this now.`
      )
      setTimeout(() => setSaved(''), 5000)
    } catch (err) {
      setSaving({ error: err.message })
    }
  }

  return (
    <form className="card my-task" onSubmit={save}>
      <div className="row between">
        <h3 className="card-title">My task · {d.short}</h3>
        <StatusBadge status={task.status} />
      </div>
      <p className="task-name">{task.taskName}</p>
      <small className="muted">Assigned to {task.assignedStaff}</small>
      <SessionInfo c={c} taskId={task.id} />
      {task.status === 'waiting' && dep && (
        <div className="dep-note">⏳ Waiting for <b>{deptById(dep.deptId).name}</b> to complete “{dep.taskName}”. This task unlocks automatically.</div>
      )}
      {task.status === 'ready' && <div className="dep-note ready">🔓 Dependency met. You can start this task now.</div>}

      <label className="field">
        <span>Status</span>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setTouched(true)
          }}
        >
          {options.map((s) => (
            <option key={s} value={s}>{STATUS[s].label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Internal note <em>(visible to teams on this case only)</em></span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Initial counseling session completed. Follow-up recommended in 2 weeks." />
      </label>
      <div className="field">
        <div className="row between">
          <span>Update for the student <em>(optional)</em></span>
          <button type="button" className="btn btn-ai btn-sm" onClick={rewrite} disabled={!note.trim() || rw.status === 'loading'}>
            {rw.status === 'loading' ? <Spinner label="Writing…" /> : '✨ Write it for the student'}
          </button>
        </div>
        <textarea rows={3} value={studentMsg} onChange={(e) => setStudentMsg(e.target.value)} placeholder="Write a note first, then let AI turn it into a friendly, jargon-free update." />
        {rw.status === 'error' && <small className="error-text">⚠️ {rw.error}</small>}
        {rw.status === 'done' && <small className="ai-inline">✨ Drafted by AI. Review before saving. Only the first name was shared.</small>}
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={!dirty || saving.busy}>
        {saving.busy ? 'Saving…' : 'Update shared case'}
      </button>
      {saving.error && <small className="error-text">⚠️ {saving.error}</small>}
      {saved && <div className="toast" role="status">✅ {saved}</div>}
    </form>
  )
}

function AiBrief({ c, deptId }) {
  const [s, setS] = useState({ status: 'idle' })
  const d = deptById(deptId)
  const run = () => {
    setS({ status: 'loading' })
    aiBrief({ caseData: aiCaseData(c), department: d.name })
      .then((data) => setS({ status: 'done', data }))
      .catch((e) => setS({ status: 'error', error: e.message }))
  }
  return (
    <div className="card ai-brief">
      <div className="row between wrap gap">
        <h3 className="card-title">✨ AI case brief</h3>
        <button type="button" className="btn btn-ai btn-sm" onClick={run} disabled={s.status === 'loading'}>
          {s.status === 'loading' ? <Spinner label="Reading case…" /> : s.status === 'done' ? 'Refresh' : `Brief me as ${d.short}`}
        </button>
      </div>
      {s.status === 'idle' && <p className="muted small">Get a 3-point summary of this case and a suggested next step for your team. The student’s name is never sent to the AI.</p>}
      {s.status === 'error' && <p className="error-text">⚠️ {s.error}</p>}
      {s.status === 'done' && (
        <div className="brief">
          <ul>{s.data.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          {s.data.nextAction && <p><b>Suggested next step:</b> {s.data.nextAction}</p>}
          {s.data.watchOut && <p className="watch"><b>Watch out:</b> {s.data.watchOut}</p>}
          <small className="muted">AI suggestion. Use your professional judgement.</small>
        </div>
      )}
    </div>
  )
}

export default function CaseView() {
  const { id } = useParams()
  const { user, getCase, canViewCase, studentOf, deptId, casesLoaded } = useStore()
  const navigate = useNavigate()
  const c = getCase(id)
  const d = deptById(deptId)

  const header = (
    <div className="staff-head">
      <div>
        <Link to="/staff" className="back">← Dashboard</Link>
        <p className="eyebrow">Staff · Shared case</p>
      </div>
      <DemoDeptSwitch />
    </div>
  )

  if (!c) {
    if (!casesLoaded) return <Loading label="Loading case…" />
    // The server only sends cases shared with this department, so we can't (and shouldn't) say more.
    return (
      <div className="page">
        {header}
        <div className="card restricted">
          <Empty icon="🔒" title={`Case #${id} isn’t shared with ${d.name}`}>
            Cases are only visible to the departments on the student’s support plan. Switch department above if your team is involved.
          </Empty>
        </div>
      </div>
    )
  }

  const myTask = c.tasks.find((t) => t.deptId === deptId)
  const isCoordinator = user.role === 'coordinator'
  const student = studentOf(c)
  if (!canViewCase(c)) {
    return (
      <div className="page">
        {header}
        <div className="card restricted">
          <Empty icon="🔒" title={`${d.name} is not part of Case #${c.caseId}`}>
            Only the {c.tasks.length} department{c.tasks.length === 1 ? '' : 's'} on this student’s support plan can open it:{' '}
            {c.tasks.map((t) => deptById(t.deptId).short).join(', ')}. Switch department above to continue.
          </Empty>
        </div>
      </div>
    )
  }

  const overall = computeOverall(c.tasks)
  const viewAsStudent = () => navigate(`/my-case/${c.caseId}`)
  // Academic data is shown only to the Academic Support account, on cases that involve it.
  const showAcademic = user.role === 'staff' && user.deptId === 'academic' && deptId === 'academic' && c.tasks.some((t) => t.deptId === 'academic')

  return (
    <div className="page">
      {header}

      <div className={`card case-hero overall-${overall}`}>
        <div className="row between wrap gap">
          <div>
            <div className="case-id-lg">Case #{c.caseId}</div>
            <div className="case-name">{c.studentName}</div>
            <div className="case-issue">{c.issue}</div>
            {student?.roll && <small className="muted">Roll no. {student.roll}</small>}
          </div>
          <div className="overall">
            <small>Overall status</small>
            <OverallBadge c={c} big />
            <PriorityTag priority={c.priority} urgent={c.urgent} />
          </div>
        </div>
        <p className="case-summary">{c.summary}</p>
        <Progress tasks={c.tasks} />
        <div className="row between wrap gap">
          <p className="next"><b>Next action:</b> {nextAction(c)}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={viewAsStudent}>👁 See the student’s view</button>
        </div>
      </div>

      {showAcademic && <AcademicRecordPanel caseId={c.caseId} />}

      <h2 className="section-label">
        one case · {c.tasks.length} team{c.tasks.length === 1 ? '' : 's'} working together
      </h2>
      <div className="dept-tasks">
        {c.tasks.map((t) => {
          const td = deptById(t.deptId)
          const dep = t.dependsOn && c.tasks.find((x) => x.id === t.dependsOn)
          return (
            <div key={t.id} className={`dept-task st-${t.status}${t.deptId === deptId ? ' mine' : ''}`}>
              {t.deptId === deptId && <span className="mine-tag">Your team</span>}
              <div className="row gap">
                <span className="dt-icon" aria-hidden="true">{td.icon}</span>
                <div>
                  <b>{td.name}</b>
                  <small>{t.assignedStaff}</small>
                </div>
              </div>
              <p className="dt-task">{t.taskName}</p>
              <StatusBadge status={t.status} />
              {dep && <small className="dt-dep">{t.status === 'waiting' ? '⏳ Waits for' : '🔗 Depended on'} {deptById(dep.deptId).short}</small>}
              {t.note && <p className="dt-note">“{t.note}”</p>}
              <SessionInfo c={c} taskId={t.id} />
              <small className="muted">Updated {when(t.updatedAt)}</small>
            </div>
          )
        })}
      </div>

      <div className="two-col wide-right">
        <div className="stack">
          {myTask ? (
            <MyTaskPanel key={`${c.caseId}-${myTask.id}`} c={c} task={myTask} />
          ) : (
            <div className="card">
              <h3 className="card-title">🧭 Coordinator view</h3>
              <p className="muted">
                {isCoordinator
                  ? 'Read-only: departments update their own tasks. Switch “Viewing as” to a department on this case to act as that team.'
                  : 'Your department has no task on this case.'}
              </p>
            </div>
          )}
        </div>
        <div className="stack">
          <AiBrief key={`${c.caseId}-${deptId}`} c={c} deptId={deptId} />
          <div className="card">
            <h3 className="card-title">Shared timeline</h3>
            <Timeline items={c.timeline} />
          </div>
          <div className="card">
            <h3 className="card-title">Team notes <small className="muted">(internal, case teams only)</small></h3>
            {c.notes.filter((n) => n.text).length === 0 ? (
              <p className="muted small">No notes yet.</p>
            ) : (
              <ul className="notes">
                {[...c.notes].reverse().filter((n) => n.text).map((n, i) => (
                  <li key={i}>
                    <b>{deptById(n.deptId)?.short}</b> · <small className="muted">{when(n.at)}</small>
                    <p>{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
