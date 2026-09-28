import { useEffect, useState } from 'react'
import { useStore } from '../state/CaseStore'
import { Empty, Loading } from '../components/ui'
import { RecordBody, yearOfStudy } from '../components/AcademicRecord'

const WIN = /winner|runner|best|finalist|qualified/i

// The academic database, visible to the Academic Support department only (enforced by the server).
export default function AcademicRecords() {
  const { user, listAcademic } = useStore()
  const [s, setS] = useState({ status: 'loading' })
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('All')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    listAcademic()
      .then((r) => setS({ status: 'done', records: r.records }))
      .catch((e) => setS({ status: 'error', error: e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (user.deptId !== 'academic' || s.status === 'error') {
    return (
      <div className="page narrow">
        <div className="card">
          <Empty icon="🔒" title="Academic records are for Academic Support only">
            {s.error || 'Log in with the Academic Support account to view the academic database.'}
          </Empty>
        </div>
      </div>
    )
  }
  if (s.status === 'loading') return <Loading label="Loading academic records…" />

  const term = q.trim().toLowerCase()
  const rows = s.records.filter((r) => (branch === 'All' || r.branch === branch) && (!term || r.name.toLowerCase().includes(term) || r.roll.includes(term)))

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Staff · Academic Support</p>
        <h1 className="display-md">academic records.</h1>
        <p className="lead">
          {s.records.length} students. Roll numbers follow <b className="mono">1602-YY-BBB-NNN</b>, where branch 733 = CSE, 737 = IT and 735 = ECE. When a student contacts Academic Support, their record appears on the case automatically.
        </p>
      </div>

      <div className="acad-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or roll number…" aria-label="Search" />
        <div className="tabs" role="tablist">
          {['All', 'CSE', 'IT', 'ECE'].map((b) => (
            <button key={b} role="tab" aria-selected={branch === b} className={branch === b ? 'on' : ''} onClick={() => setBranch(b)}>{b}</button>
          ))}
        </div>
      </div>

      <div className="card acad-list">
        <table className="acad-table big">
          <thead>
            <tr><th>Roll no.</th><th>Name</th><th>Branch</th><th>Year</th><th>CGPA</th><th>Attendance</th><th>Hackathons</th><th>Events</th><th>Wins</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hk = r.activities.filter((a) => a.type === 'Hackathon').length
              const wins = r.activities.filter((a) => WIN.test(a.result || '')).length
              return [
                <tr key={r.roll} className={`clickable${open === r.roll ? ' open' : ''}`} onClick={() => setOpen(open === r.roll ? null : r.roll)}>
                  <td className="mono">{r.roll}</td>
                  <td><b>{r.name}</b></td>
                  <td>{r.branch}</td>
                  <td>{yearOfStudy(r.joined)}</td>
                  <td className={r.cgpa < 6 ? 'bad' : ''}>{r.cgpa.toFixed(1)}</td>
                  <td className={r.attendance < 75 ? 'bad' : ''}>{r.attendance}%</td>
                  <td>{hk}</td>
                  <td>{r.activities.length}</td>
                  <td>{wins}</td>
                </tr>,
                open === r.roll && (
                  <tr key={`${r.roll}-detail`} className="detail">
                    <td colSpan={9}><RecordBody record={r} /></td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted small">No students match.</p>}
      </div>
    </div>
  )
}
