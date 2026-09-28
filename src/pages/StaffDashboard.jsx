import { Link } from 'react-router-dom'
import { useStore, computeOverall } from '../state/CaseStore'
import { DEPARTMENTS, deptById } from '../data/departments'
import { ReviewView } from '../components/Sessions'
import { dayLabel, isUpcoming } from '../components/ui'
import { DeptSelect, DeptChip, Empty, Loading, OverallBadge, PriorityTag, StatusBadge, when } from '../components/ui'

const ORDER = { in_progress: 0, ready: 1, not_started: 2, waiting: 3, completed: 4 }

export function useDeptTasks(deptId) {
  const { cases } = useStore()
  return cases
    .flatMap((c) => c.tasks.filter((t) => t.deptId === deptId).map((t) => ({ task: t, c })))
    .sort((a, b) => ORDER[a.task.status] - ORDER[b.task.status] || b.task.updatedAt.localeCompare(a.task.updatedAt))
}

export function TaskList({ items }) {
  return (
    <div className="task-list">
      {items.map(({ task, c }) => {
        const dep = task.dependsOn && c.tasks.find((x) => x.id === task.dependsOn)
        return (
          <Link to={`/staff/case/${c.caseId}`} key={task.id} className={`task-item st-${task.status}`}>
            <span className="case-id">#{c.caseId}</span>
            <div className="grow">
              <b>{task.taskName}</b>
              <small>
                {c.studentName} · {c.issue}
                {task.status === 'waiting' && dep ? ` · waiting for ${deptById(dep.deptId).short}` : ''}
              </small>
            </div>
            {c.urgent && <span className="urgent-dot" title="Urgent">⚡</span>}
            <StatusBadge status={task.status} />
            <span className="chev" aria-hidden="true">›</span>
          </Link>
        )
      })}
    </div>
  )
}

// Department comes from the login. The switch exists only so the live demo can
// hop between teams without logging out each time.
export function DemoDeptSwitch() {
  const { user, deptId, setDept } = useStore()
  const home = user?.role === 'staff' ? deptById(user.deptId) : null
  return (
    <div className="demo-switch">
      <DeptSelect value={deptId} onChange={setDept} />
      <small>
        🔁 Demo switch{home ? ` · your account: ${home.short}` : ' · coordinator can view any team'}
        {home && deptId !== user.deptId && (
          <button type="button" className="link-btn" onClick={() => setDept(user.deptId)}>back to mine</button>
        )}
      </small>
    </div>
  )
}

export function StaffHeader({ title, sub }) {
  const { deptId } = useStore()
  const d = deptById(deptId)
  return (
    <div className="staff-head">
      <div>
        <p className="eyebrow">Staff · {d.name}</p>
        <h1 className="display-md">{title}</h1>
        {sub && <p className="lead">{sub}</p>}
      </div>
      <DemoDeptSwitch />
    </div>
  )
}

export default function StaffDashboard() {
  const { cases, casesLoaded, workload, deptId, setDept } = useStore()
  const d = deptById(deptId)
  const items = useDeptTasks(deptId)
  const open = items.filter((x) => x.task.status !== 'completed')
  const myCases = cases.filter((c) => c.tasks.some((t) => t.deptId === deptId))
  // Counts for all 12 teams come from an aggregate endpoint: no other department's case details.
  const openCount = (id) => workload.find((w) => w.deptId === id)?.open ?? 0
  const mine = workload.find((w) => w.deptId === deptId)
  // This department's booked sessions, soonest first.
  const sessions = myCases
    .flatMap((c) => (c.bookings || []).filter((b) => b.deptId === deptId && isUpcoming(b.start)).map((b) => ({ b, c })))
    .sort((x, y) => x.b.start.localeCompare(y.b.start))
  const reviews = myCases.flatMap((c) => (c.reviews || []).filter((r) => r.deptId === deptId).map((r) => ({ r, c })))
  if (!casesLoaded) return <Loading label="Loading dashboard…" />

  return (
    <div className="page">
      <StaffHeader title="staff dashboard" sub="One dashboard for all 12 departments. Each team only sees the cases it’s part of." />

      <div className="dept-grid" aria-label="Switch department">
        {DEPARTMENTS.map((x) => (
          <DeptChip key={x.id} deptId={x.id} active={x.id === deptId} onClick={() => setDept(x.id)} count={openCount(x.id)} />
        ))}
      </div>

      <div className="stat-row five">
        <div className="stat"><small>Open tasks</small><b>{open.length}</b></div>
        <div className="stat"><small>In progress / ready</small><b>{open.filter((x) => ['in_progress', 'ready'].includes(x.task.status)).length}</b></div>
        <div className="stat"><small>Waiting</small><b>{open.filter((x) => x.task.status === 'waiting').length}</b></div>
        <div className="stat"><small>Sessions booked</small><b>{sessions.length}</b></div>
        <div className="stat"><small>Student rating</small><b>{mine?.rating ? `★ ${mine.rating}` : '–'}</b>{mine?.reviews ? <small className="muted"> {mine.reviews} review{mine.reviews === 1 ? '' : 's'}</small> : null}</div>
      </div>

      {myCases.length > 0 && (
        <div className="card sessions-card">
          <h3 className="card-title">Upcoming sessions <small className="muted">(booked by students, no double bookings)</small></h3>
          {sessions.length === 0 ? (
            <p className="muted small">No sessions booked yet. Students book from their case page.</p>
          ) : (
            <div className="session-list">
              {sessions.map(({ b, c }) => (
                <Link key={b.id} to={`/staff/case/${c.caseId}`} className="session-item">
                  <span className="session-when"><b>{dayLabel(b.start)}</b><small>{b.start.slice(11)}–{b.end.slice(11)}</small></span>
                  <span className="grow"><b>{c.studentName}</b><small>#{c.caseId} · {c.tasks.find((t) => t.id === b.taskId)?.taskName}</small></span>
                  <span className="chev" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div className="recent-reviews">
              <b className="small">Latest student feedback</b>
              {reviews.slice(-3).reverse().map(({ r, c }) => (
                <div key={r.taskId} className="row gap wrap"><ReviewView review={r} /><small className="muted">#{c.caseId}</small></div>
              ))}
            </div>
          )}
        </div>
      )}

      {myCases.length === 0 ? (
        <div className="card">
          <Empty icon="🔒" title={`No cases involve ${d.name} right now`}>
            Cases are only shared with departments that are part of a student’s support plan. That keeps student information private.
          </Empty>
        </div>
      ) : (
        <div className="two-col wide-left">
          <div className="card">
            <div className="row between">
              <h3 className="card-title">My tasks</h3>
              <Link to="/staff/tasks" className="link-btn">View all →</Link>
            </div>
            {open.length ? <TaskList items={open} /> : <p className="muted">All tasks complete. 🎉</p>}
          </div>

          <div className="card">
            <h3 className="card-title">Recent cases</h3>
            <div className="case-cards">
              {myCases.map((c) => (
                <Link to={`/staff/case/${c.caseId}`} key={c.caseId} className={`case-card overall-${computeOverall(c.tasks)}`}>
                  <div className="row between">
                    <b>#{c.caseId} · {c.studentName}</b>
                    <OverallBadge c={c} />
                  </div>
                  <small>{c.issue}</small>
                  <div className="mini-tasks">
                    {c.tasks.map((t) => (
                      <span key={t.id} className={`mini st-${t.status}${t.deptId === deptId ? ' mine' : ''}`} title={`${deptById(t.deptId).name}: ${t.status}`}>
                        {deptById(t.deptId).icon} {deptById(t.deptId).short}
                      </span>
                    ))}
                  </div>
                  <div className="row between">
                    <PriorityTag priority={c.priority} urgent={c.urgent} />
                    <small className="muted">{when(c.createdAt)}</small>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
