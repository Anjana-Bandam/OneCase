import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore, homeFor } from '../state/CaseStore'
import { DEPARTMENTS, deptById } from '../data/departments'
import { DEMO_PASSWORD, ROLE_LABEL } from '../data/users'
import { initials } from '../components/ui'
import { parseRoll } from '../data/academic'

const STUDENT_DEMOS = [
  { email: 'ananya@vasavi.edu', label: 'Ananya Rao', hint: 'owns Case #1024' },
  { email: 'student@vasavi.edu', label: 'Demo Student', hint: 'owns Case #1026' },
]
const STAFF_DEMOS = [
  { email: 'counseling@vasavi.edu', dept: 'counseling' },
  { email: 'academic@vasavi.edu', dept: 'academic' },
  { email: 'financial@vasavi.edu', dept: 'financial' },
]

export default function Login() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, login, loginAs, signup, logout } = useStore()
  const tab = params.get('tab') === 'staff' ? 'staff' : 'student'
  const mode = tab === 'student' && params.get('mode') === 'signup' ? 'signup' : 'login'
  const next = params.get('next')

  const [form, setForm] = useState({ name: '', email: '', roll: '', password: '' })
  const [error, setError] = useState('')
  const [otherDept, setOtherDept] = useState('')
  const [busy, setBusy] = useState(false)
  const rollInfo = parseRoll(form.roll)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const go = (u, isNew = false) => {
    // Only follow ?next= if it belongs to the role that just logged in.
    const staffPath = next && (next.startsWith('/staff') || next.startsWith('/coordinator'))
    const fits = next && (u.role === 'student' ? !staffPath : staffPath || next.startsWith('/my-case'))
    if (fits) return navigate(next)
    if (isNew) return navigate('/support')
    navigate(homeFor(u))
  }

  const switchTo = (t, m) => {
    const p = new URLSearchParams(params)
    p.set('tab', t)
    m ? p.set('mode', m) : p.delete('mode')
    setParams(p, { replace: true })
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = mode === 'signup' ? await signup(form) : await login(form.email, form.password)
    setBusy(false)
    if (res.error) return setError(res.error)
    if (tab === 'staff' && res.user.role === 'student') {
      setError('That is a student account. Use the Student tab.')
      logout()
      return
    }
    if (tab === 'student' && res.user.role !== 'student') {
      setError('That is a staff account. Use the Staff tab.')
      logout()
      return
    }
    go(res.user, mode === 'signup')
  }

  const quick = async (email) => {
    if (busy) return
    setBusy(true)
    const res = await loginAs(email)
    setBusy(false)
    if (res.error) return setError(res.error)
    go(res.user)
  }

  if (user) {
    return (
      <div className="page narrow">
        <div className="card center-card">
          <div className="avatar lg">{initials(user.name)}</div>
          <h2>You’re logged in as {user.name}</h2>
          <p className="muted">{ROLE_LABEL[user.role]}{user.deptId && user.role === 'staff' ? ` · ${deptById(user.deptId).name}` : ''}{user.roll ? ` · ${user.roll}` : ''}</p>
          <div className="row gap center">
            <button className="btn btn-primary" onClick={() => go(user)}>Continue →</button>
            <button className="btn btn-ghost" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="auth">
        <aside className="auth-side">
          <h1 className="display-md">one login.<br />every role.</h1>
          <ul>
            <li><b>Students</b> sign up once with their college email.</li>
            <li><b>Staff</b> don’t sign up. The university creates their account and assigns their department.</li>
            <li>Your account decides what you see: your own case, your department’s cases, or the coordinator overview.</li>
          </ul>
          <p className="auth-note">In production this would use the university’s single sign-on (SSO). This prototype stores demo accounts in the browser.</p>
        </aside>

        <div className="auth-card card">
          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'student'} className={tab === 'student' ? 'on' : ''} onClick={() => switchTo('student')}>🎓 Student</button>
            <button role="tab" aria-selected={tab === 'staff'} className={tab === 'staff' ? 'on' : ''} onClick={() => switchTo('staff')}>🏛️ Staff</button>
          </div>

          <h2 className="auth-title">
            {tab === 'staff' ? 'Staff log in' : mode === 'signup' ? 'Create your student account' : 'Student log in'}
          </h2>
          {next && <p className="muted small">Log in to continue.</p>}

          <form onSubmit={submit} className="auth-form">
            {mode === 'signup' && (
              <label className="field">
                <span>Full name</span>
                <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Priya Sharma" />
              </label>
            )}
            <label className="field">
              <span>{tab === 'staff' ? 'Staff email' : 'College email'}</span>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder={tab === 'staff' ? 'counseling@vasavi.edu' : 'you@vasavi.edu'} />
            </label>
            {mode === 'signup' && (
              <label className="field">
                <span>Roll number</span>
                <input value={form.roll} onChange={set('roll')} placeholder="e.g. 1602-24-733-005" />
                <small className={`roll-hint${form.roll && !rollInfo ? ' bad' : ''}`}>
                  {rollInfo
                    ? `✓ ${rollInfo.branch}, joined ${rollInfo.joined}, roll ${rollInfo.number}`
                    : 'Format 1602-YY-BBB-NNN · branch 733 CSE, 737 IT, 735 ECE'}
                </small>
              </label>
            )}
            <label className="field">
              <span>Password</span>
              <input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 6 characters' : ''} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue →' : 'Log in →'}
            </button>
          </form>

          {tab === 'student' ? (
            <p className="auth-switch">
              {mode === 'signup' ? (
                <>Already have an account? <button className="link-btn" onClick={() => switchTo('student')}>Log in</button></>
              ) : (
                <>New here? <button className="link-btn" onClick={() => switchTo('student', 'signup')}>Create a student account</button></>
              )}
            </p>
          ) : (
            <p className="auth-switch muted">🔒 Staff accounts are created by the university and linked to one department. There’s no public sign-up.</p>
          )}

          <div className="demo-accounts">
            <p className="eyebrow">Demo accounts · one click (password: {DEMO_PASSWORD})</p>
            {tab === 'student' ? (
              <div className="demo-acc-grid">
                {STUDENT_DEMOS.map((d) => (
                  <button key={d.email} className="demo-acc" onClick={() => quick(d.email)}>
                    <span className="avatar">{initials(d.label)}</span>
                    <span><b>{d.label}</b><small>{d.hint}</small></span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="demo-acc-grid">
                  {STAFF_DEMOS.map((d) => (
                    <button key={d.email} className="demo-acc" onClick={() => quick(d.email)}>
                      <span className="avatar">{deptById(d.dept).icon}</span>
                      <span><b>{deptById(d.dept).short}</b><small>{d.email}</small></span>
                    </button>
                  ))}
                  <button className="demo-acc coord" onClick={() => quick('coordinator@vasavi.edu')}>
                    <span className="avatar">🧭</span>
                    <span><b>Coordinator</b><small>coordinator@vasavi.edu</small></span>
                  </button>
                </div>
                <div className="row gap other-dept">
                  <select value={otherDept} onChange={(e) => setOtherDept(e.target.value)} aria-label="Other department accounts">
                    <option value="">Other departments (12 total)…</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-ghost btn-sm" disabled={!otherDept} onClick={() => quick(`${otherDept}@vasavi.edu`)}>Log in</button>
                </div>
              </>
            )}
          </div>
          <p className="muted small center">
            <Link to="/">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
