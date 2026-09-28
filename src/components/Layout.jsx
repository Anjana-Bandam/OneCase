import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../state/CaseStore'
import { aiHealth } from '../lib/ai'
import { deptById } from '../data/departments'
import { initials } from './ui'

const TICKER = ['12 DEPARTMENTS', 'ONE CASE', 'TELL YOUR STORY ONCE', 'NO MORE 3-WEEK WAITS', 'TEAMS WORK IN PARALLEL', 'SHARED PROGRESS', '✨ AI-ASSISTED TRIAGE']

function Ticker() {
  const items = [...TICKER, ...TICKER, ...TICKER]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((k) => (
          <div className="ticker-group" key={k}>
            {items.map((t, i) => (
              <span key={i}>
                <i>●</i> {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useStore()
  const navigate = useNavigate()
  if (!user) {
    return (
      <div className="user-menu">
        <Link to="/login" className="nav-cta">Log in</Link>
        <Link to="/login?mode=signup" className="nav-cta ghost">Sign up</Link>
      </div>
    )
  }
  const sub = user.role === 'student' ? user.roll : user.role === 'staff' ? deptById(user.deptId).short : 'Coordinator'
  return (
    <div className="user-menu">
      <div className="user-chip" title={user.email}>
        <span className="avatar">{initials(user.name)}</span>
        <span className="user-text">
          <b>{user.name}</b>
          <small>{sub}</small>
        </span>
      </div>
      <button
        type="button"
        className="nav-cta ghost"
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        Log out
      </button>
    </div>
  )
}

export default function Layout() {
  const { user, resetDemo, serverDown } = useStore()
  const navigate = useNavigate()
  const reset = async () => {
    if (!window.confirm('Reset all demo cases in the database to their starting state?')) return
    try {
      await resetDemo()
      navigate('/')
    } catch (e) {
      window.alert(e.message)
    }
  }
  const role = user?.role
  const [health, setHealth] = useState(null)
  useEffect(() => {
    aiHealth().then(setHealth)
  }, [])

  return (
    <div className="app">
      <header className="site-header">
        <nav className="nav">
          <div className="nav-links">
            {(!role || role === 'student') && (
              <>
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/support">Get Support</NavLink>
                {role === 'student' && <NavLink to="/my-case">My Case</NavLink>}
              </>
            )}
            {role === 'coordinator' && <NavLink to="/coordinator">Overview</NavLink>}
            {(role === 'staff' || role === 'coordinator') && (
              <>
                <NavLink to="/staff" end>Dashboard</NavLink>
                <NavLink to="/staff/tasks">My Tasks</NavLink>
                {user?.deptId === 'academic' && role === 'staff' && <NavLink to="/staff/academic">Academic Records</NavLink>}
              </>
            )}
          </div>
          <Link to="/" className="logo" aria-label="OneCase home">
            One<span>Case</span>
          </Link>
          <UserMenu />
        </nav>
        <Ticker />
      </header>

      {serverDown && (
        <div className="server-down" role="alert">
          ⚠️ Can’t reach the OneCase server. Retrying automatically. Check that <code>npm run dev</code> is running.
        </div>
      )}

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div>
          <b>OneCase</b> · Joined-Up Case Management · ServiceNow Co-Innovation Day · Track 3
        </div>
        <div className="footer-right">
          <span className={`ai-pill ${health?.ai ? 'on' : 'off'}`} title={health?.model || ''}>
            ✨ AI {health === null ? '…' : health.ai ? `online · Groq` : health.offline ? 'server offline' : 'key missing'}
          </span>
          {health?.db && <span className="ai-pill on" title={`${health.db.users} users · ${health.db.cases} cases · ${health.db.tasks} tasks`}>🗄️ {health.db.engine}</span>}
          <span className="muted">Fictional demo data</span>
          {user && (
            <button type="button" className="link-btn" onClick={reset}>
              Reset demo
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
