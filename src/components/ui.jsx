import { STATUS, computeOverall } from '../state/CaseStore'
import { DEPARTMENTS, deptById } from '../data/departments'

export function StatusBadge({ status, overall = false, big = false }) {
  const s = STATUS[status] ?? STATUS.not_started
  const label = overall && status === 'not_started' ? 'Submitted' : s.label
  return (
    <span className={`badge tone-${s.tone}${big ? ' big' : ''}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export function PriorityTag({ priority, urgent }) {
  return (
    <span className={`prio prio-${priority?.toLowerCase()}`}>
      {urgent ? '⚡ Urgent · ' : ''}
      {priority} priority
    </span>
  )
}

export function DeptChip({ deptId, active, onClick, count }) {
  const d = deptById(deptId)
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag className={`dept-chip${active ? ' active' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span aria-hidden="true">{d.icon}</span> {d.short}
      {count !== undefined && <b className="count">{count}</b>}
    </Tag>
  )
}

export function DeptSelect({ value, onChange, id = 'dept-select' }) {
  return (
    <div className="dept-select">
      <label htmlFor={id}>Viewing as</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {DEPARTMENTS.map((d, i) => (
          <option key={d.id} value={d.id}>
            {String(i + 1).padStart(2, '0')} · {d.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Progress({ tasks }) {
  const done = tasks.filter((t) => t.status === 'completed').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  return (
    <div className="progress" aria-label={`${done} of ${tasks.length} tasks completed`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {done} of {tasks.length} support tasks complete
      </span>
    </div>
  )
}

export function OverallBadge({ c, big }) {
  return <StatusBadge status={computeOverall(c.tasks)} overall big={big} />
}

export function when(iso) {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function Timeline({ items }) {
  const list = [...items].reverse()
  return (
    <ol className="timeline">
      {list.map((t, i) => (
        <li key={i} className={`tl-${t.kind}`}>
          <span className="tl-dot" aria-hidden="true" />
          <div>
            <div className="tl-text">{t.text}</div>
            <div className="tl-time">{when(t.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Empty({ icon = '🗂️', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const asLocal = (s) => new Date(s.length === 10 ? `${s}T00:00:00` : `${s}:00`)

// "Tue 30 Sep" from "2026-09-30" or "2026-09-30T10:30"
export function dayLabel(s) {
  const d = asLocal(s)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// "Tue 30 Sep, 10:30–11:00"
export function slotLabel(start, end) {
  return `${dayLabel(start)}, ${start.slice(11)}${end ? `–${end.slice(11)}` : ''}`
}

export const isUpcoming = (start) => asLocal(start).getTime() > Date.now()

export function Stars({ value, size = 'md' }) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'on' : ''} aria-hidden="true">★</span>
      ))}
    </span>
  )
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="page narrow">
      <div className="loading-box"><Spinner label={label} /></div>
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </span>
  )
}
