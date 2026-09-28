import { useEffect, useState } from 'react'
import { useStore } from '../state/CaseStore'
import { Spinner } from './ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const WIN = /winner|runner|best|finalist|qualified/i
const ORD = ['1st', '2nd', '3rd', '4th']

// Year of study from the year of joining (the academic year starts in July).
export function yearOfStudy(joined, now = new Date()) {
  const y = now.getFullYear() - joined + (now.getMonth() >= 6 ? 1 : 0)
  return y > 4 ? 'Graduated' : `${ORD[Math.max(0, y - 1)]} year`
}

const attendanceTone = (a) => (a < 75 ? 'critical' : a < 80 ? 'warning' : 'good')
const cgpaTone = (g) => (g < 6 ? 'critical' : g < 7 ? 'warning' : 'good')

export function RecordBody({ record, compact = false }) {
  const acts = record.activities || []
  const counts = acts.reduce((m, a) => ({ ...m, [a.type]: (m[a.type] || 0) + 1 }), {})
  const wins = acts.filter((a) => WIN.test(a.result || '')).length
  const hackathons = counts.Hackathon || 0
  return (
    <div className="acad-body">
      <div className="acad-id">
        <div><small>Name</small><b>{record.name}</b></div>
        <div><small>Roll no.</small><b className="mono">{record.roll}</b></div>
        <div><small>Branch</small><b>{record.branch}</b></div>
        <div><small>Year</small><b>{yearOfStudy(record.joined)}</b><em> · joined {record.joined}</em></div>
      </div>

      <div className="acad-metrics">
        <div className={`metric tone-${cgpaTone(record.cgpa)}`}>
          <small>Academic score (CGPA)</small>
          <b>{record.cgpa.toFixed(1)}<span>/10</span></b>
          <div className="meter"><span style={{ width: `${record.cgpa * 10}%` }} /></div>
          {record.cgpa < 6 && <em>Below 6.0: academic probation risk</em>}
        </div>
        <div className={`metric tone-${attendanceTone(record.attendance)}`}>
          <small>Attendance</small>
          <b>{record.attendance}<span>%</span></b>
          <div className="meter">
            <span style={{ width: `${record.attendance}%` }} />
            <i className="req" style={{ left: '75%' }} title="75% minimum" />
          </div>
          {record.attendance < 75 ? <em>Below the 75% requirement: detention risk</em> : record.attendance < 80 ? <em>Close to the 75% minimum</em> : null}
        </div>
        <div className="metric">
          <small>Hackathons &amp; college events</small>
          <b>{acts.length}<span> events</span></b>
          <p className="acad-counts">
            {hackathons} hackathon{hackathons === 1 ? '' : 's'} · {counts['Coding contest'] || 0} coding contest{counts['Coding contest'] === 1 ? '' : 's'} · {wins} win{wins === 1 ? '' : 's'} / placing{wins === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {!compact && (
        acts.length === 0 ? (
          <p className="muted small">No hackathons or college events recorded yet.</p>
        ) : (
          <table className="acad-table">
            <thead>
              <tr><th>When</th><th>Type</th><th>Event</th><th>Result</th></tr>
            </thead>
            <tbody>
              {acts.map((a, i) => (
                <tr key={i}>
                  <td>{monthLabel(a.month)}</td>
                  <td>{a.type}</td>
                  <td>{a.event}</td>
                  <td className={WIN.test(a.result || '') ? 'win' : ''}>{a.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}

// Shown on a shared case to Academic Support staff: fetched automatically by the student's roll number.
export default function AcademicRecordPanel({ caseId }) {
  const { getAcademic } = useStore()
  const [s, setS] = useState({ status: 'loading' })

  useEffect(() => {
    let live = true
    getAcademic(caseId)
      .then((r) => live && setS({ status: 'done', ...r }))
      .catch((e) => live && setS({ status: 'error', error: e.message }))
    return () => {
      live = false
    }
    // getAcademic changes identity on every poll; fetch once per case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  return (
    <div className="card acad-card">
      <div className="row between wrap gap">
        <h3 className="card-title">🎓 Academic record</h3>
        <span className="acad-lock">🔒 Academic Support only</span>
      </div>
      <p className="muted small acad-src">Fetched automatically from the academic database using the student’s roll number.</p>
      {s.status === 'loading' && <Spinner label="Fetching academic record…" />}
      {s.status === 'error' && <p className="error-text">⚠️ {s.error}</p>}
      {s.status === 'done' && !s.record && (
        <p className="muted">No academic record matches roll number <b className="mono">{s.roll || 'unknown'}</b>. Please verify the student’s details.</p>
      )}
      {s.status === 'done' && s.record && <RecordBody record={s.record} />}
    </div>
  )
}
