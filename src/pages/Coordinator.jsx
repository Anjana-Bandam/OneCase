import { Link } from 'react-router-dom'
import { useStore, computeOverall } from '../state/CaseStore'
import { DEPARTMENTS, deptById } from '../data/departments'
import { Loading, OverallBadge, PriorityTag } from '../components/ui'

export default function Coordinator() {
  const { cases, casesLoaded, workload, setDept } = useStore()
  const overall = cases.map((c) => computeOverall(c.tasks))
  const count = (s) => overall.filter((o) => o === s).length
  const active = cases.filter((c) => computeOverall(c.tasks) !== 'resolved')

  const attention = active.filter((c) => c.urgent || c.priority === 'High' || c.tasks.some((t) => t.status === 'waiting' || t.status === 'ready'))
  const load = DEPARTMENTS.map((d) => ({
    d,
    open: cases.reduce((n, c) => n + c.tasks.filter((t) => t.deptId === d.id && t.status !== 'completed').length, 0),
    done: cases.reduce((n, c) => n + c.tasks.filter((t) => t.deptId === d.id && t.status === 'completed').length, 0),
    rating: workload.find((w) => w.deptId === d.id)?.rating ?? null,
  }))
  const maxLoad = Math.max(1, ...load.map((x) => x.open + x.done))
  if (!casesLoaded) return <Loading label="Loading overview…" />

  const reason = (c) => {
    if (c.urgent) return 'Marked urgent'
    const ready = c.tasks.find((t) => t.status === 'ready')
    if (ready) return `${deptById(ready.deptId).short} is unlocked and ready to start`
    const waiting = c.tasks.find((t) => t.status === 'waiting')
    if (waiting) return `${deptById(waiting.deptId).short} is waiting on a dependency`
    return 'High priority'
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Coordinator · Operational view</p>
        <h1 className="display-md">all cases at a glance.</h1>
        <p className="lead">Live counts from the same shared case data. Operational only, with no analytics or predictions.</p>
      </div>

      <div className="stat-row five">
        <div className="stat"><small>Active cases</small><b>{active.length}</b></div>
        <div className="stat tone-blue"><small>In progress</small><b>{count('in_progress')}</b></div>
        <div className="stat tone-amber"><small>Waiting</small><b>{count('waiting')}</b></div>
        <div className="stat tone-green"><small>Resolved</small><b>{count('resolved')}</b></div>
        <div className="stat tone-pink"><small>Needs attention</small><b>{attention.length}</b></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="card-title">Needs attention</h3>
          {attention.length === 0 ? (
            <p className="muted">Nothing needs attention right now.</p>
          ) : (
            <div className="task-list">
              {attention.map((c) => (
                <Link
                  key={c.caseId}
                  to={`/staff/case/${c.caseId}`}
                  className="task-item"
                  onClick={() => setDept(c.tasks.find((t) => t.status !== 'completed')?.deptId || c.tasks[0].deptId)}
                >
                  <span className="case-id">#{c.caseId}</span>
                  <div className="grow">
                    <b>{c.studentName}</b>
                    <small>{reason(c)}</small>
                  </div>
                  <PriorityTag priority={c.priority} urgent={c.urgent} />
                  <OverallBadge c={c} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Department workload <small className="muted">(12 departments)</small></h3>
          <div className="workload">
            {load.map(({ d, open, done, rating }) => (
              <div className="wl-row" key={d.id}>
                <span className="wl-name">{d.icon} {d.short}</span>
                <div className="wl-bar" aria-label={`${open} open, ${done} completed`}>
                  <span className="wl-open" style={{ width: `${(open / maxLoad) * 100}%` }} />
                  <span className="wl-done" style={{ width: `${(done / maxLoad) * 100}%` }} />
                </div>
                <span className="wl-num">{open}</span>
                <span className="wl-rating" title="Average student rating">{rating ? `★ ${rating}` : ''}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            <span><i className="wl-open" /> Open</span>
            <span><i className="wl-done" /> Completed</span>
          </div>
        </div>
      </div>
    </div>
  )
}
