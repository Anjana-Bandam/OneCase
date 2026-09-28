import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useStore, homeFor } from '../state/CaseStore'
import { ROLE_LABEL } from '../data/users'
import { Empty, Loading } from './ui'

// Route guard: sends logged-out users to /login and blocks the wrong role.
export default function RequireAuth({ roles, children }) {
  const { user, ready, logout } = useStore()
  const location = useLocation()
  const navigate = useNavigate()

  if (!ready) return <Loading />

  if (!user) {
    const next = encodeURIComponent(location.pathname)
    const tab = roles.includes('student') ? '' : '&tab=staff'
    return <Navigate to={`/login?next=${next}${tab}`} replace />
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="page narrow">
        <div className="card">
          <Empty icon="🔒" title="This page isn’t available for your account">
            You’re logged in as <b>{user.name}</b> ({ROLE_LABEL[user.role]}). Each account only sees what its role needs.
          </Empty>
          <div className="row gap center">
            <button className="btn btn-ghost" onClick={() => navigate(homeFor(user))}>Go to my home</button>
            <button className="btn btn-primary" onClick={() => { logout(); navigate(`/login?next=${encodeURIComponent(location.pathname)}`) }}>
              Log in with another account
            </button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
