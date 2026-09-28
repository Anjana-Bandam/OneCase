import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { request, setAuthToken } from '../lib/api'

export { STATUS, computeOverall, nextAction } from './caseLogic'

// All shared data (accounts, cases, tasks, notes) lives in the server's SQLite database.
// Only per-window UI state is kept in the browser: login token, department view, draft request.
const UI_KEY = 'onecase-ui-v3'
const POLL_MS = 3000

function readUi() {
  try {
    return JSON.parse(sessionStorage.getItem(UI_KEY)) || {}
  } catch {
    return {}
  }
}

export function homeFor(user) {
  if (!user) return '/login'
  if (user.role === 'staff') return '/staff'
  if (user.role === 'coordinator') return '/coordinator'
  return '/my-case'
}

const Ctx = createContext(null)

export function CaseStoreProvider({ children }) {
  const [ui] = useState(readUi)
  const [token, setToken] = useState(() => {
    setAuthToken(ui.token)
    return ui.token || null
  })
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(!ui.token)
  const [deptId, setDeptId] = useState(ui.deptId || 'counseling')
  const [draft, setDraft] = useState(ui.draft || null)
  const [cases, setCases] = useState([])
  const [casesLoaded, setCasesLoaded] = useState(false)
  const [workload, setWorkload] = useState([])
  const [serverDown, setServerDown] = useState(false)
  const fetchId = useRef(0)

  useEffect(() => {
    try {
      sessionStorage.setItem(UI_KEY, JSON.stringify({ token, deptId, draft }))
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [token, deptId, draft])

  const clearSession = useCallback(() => {
    setAuthToken(null)
    setToken(null)
    setUser(null)
    setCases([])
    setCasesLoaded(false)
    setWorkload([])
    setDraft(null)
  }, [])

  const startSession = useCallback((res) => {
    setAuthToken(res.token)
    setToken(res.token)
    setUser(res.user)
    if (res.user.deptId) setDeptId(res.user.deptId)
    setCases([])
    setCasesLoaded(false)
    setDraft(null)
    return { user: res.user }
  }, [])

  // Restore the session from a saved token.
  useEffect(() => {
    if (!ui.token) return
    request('/me')
      .then((r) => setUser(r.user))
      .catch((e) => (e.status === 401 ? clearSession() : setServerDown(true)))
      .finally(() => setAuthChecked(true))
  }, [ui.token, clearSession])

  const refresh = useCallback(async () => {
    if (!user) return
    const id = ++fetchId.current
    try {
      const q = user.role === 'staff' ? `?dept=${encodeURIComponent(deptId)}` : ''
      const [c, w] = await Promise.all([
        request(`/cases${q}`),
        user.role === 'student' ? Promise.resolve({ workload: [] }) : request('/workload'),
      ])
      if (id !== fetchId.current) return // a newer request is in flight
      setCases(c.cases)
      setWorkload(w.workload)
      setCasesLoaded(true)
      setServerDown(false)
    } catch (e) {
      if (id !== fetchId.current) return
      if (e.status === 401) clearSession()
      else if (e.status === 0) setServerDown(true)
    }
  }, [user, deptId, clearSession])

  // Load on login / department switch, then poll so other devices' updates appear live.
  useEffect(() => {
    if (!user) return
    setCasesLoaded(false)
    refresh()
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [user, deptId, refresh])

  const replaceCase = (c) => setCases((prev) => (prev.some((x) => x.caseId === c.caseId) ? prev.map((x) => (x.caseId === c.caseId ? c : x)) : [c, ...prev]))

  const api = useMemo(() => {
    const getCase = (id) => cases.find((c) => c.caseId === String(id))
    const myCases = user?.role === 'student' ? cases.filter((c) => c.studentId === user.id) : []
    const canViewCase = (c) => {
      if (!user || !c) return false
      if (user.role === 'student') return c.studentId === user.id
      if (user.role === 'coordinator') return true
      return c.tasks.some((t) => t.deptId === deptId)
    }
    const auth = async (path, body) => {
      try {
        return startSession(await request(path, { method: 'POST', body }))
      } catch (e) {
        return { error: e.message }
      }
    }

    return {
      user,
      ready: authChecked,
      cases,
      casesLoaded,
      workload,
      serverDown,
      deptId,
      draft,
      myCases,
      getCase,
      canViewCase,
      studentOf: (c) => (c ? { roll: c.studentRoll } : null),
      refresh,
      login: (email, password) => auth('/auth/login', { email, password }),
      signup: (form) => auth('/auth/signup', form),
      loginAs: (email) => auth('/auth/demo-login', { email }),
      logout: () => {
        request('/auth/logout', { method: 'POST' }).catch(() => {})
        clearSession()
      },
      setDept: setDeptId,
      setDraft,
      resetDemo: async () => {
        await request('/demo/reset', { method: 'POST' })
        setDraft(null)
        try {
          const r = await request('/me')
          setUser({ ...r.user })
        } catch {
          clearSession() // a signed-up account was removed by the reset
        }
      },
      createCase: async ({ issue, summary, priority, urgent, deptIds }) => {
        const r = await request('/cases', { method: 'POST', body: { issue, summary, priority, urgent, deptIds } })
        replaceCase(r.case)
        setDraft(null)
        return r.case.caseId
      },
      getAcademic: (caseId) => request(`/cases/${encodeURIComponent(caseId)}/academic?dept=academic`),
      listAcademic: () => request('/academic/records?dept=academic'),
      getSlots: (caseId, taskId) => request(`/slots?caseId=${encodeURIComponent(caseId)}&taskId=${encodeURIComponent(taskId)}`),
      bookSlot: async (caseId, taskId, start) => {
        const r = await request('/bookings', { method: 'POST', body: { caseId, taskId, start } })
        replaceCase(r.case)
        return r.case
      },
      cancelBooking: async (bookingId) => {
        const r = await request(`/bookings/${bookingId}`, { method: 'DELETE' })
        replaceCase(r.case)
        return r.case
      },
      saveReview: async (caseId, taskId, rating, comment) => {
        const r = await request('/reviews', { method: 'POST', body: { caseId, taskId, rating, comment } })
        replaceCase(r.case)
        return r.case
      },
      updateTask: async (caseId, { taskId, status, note, studentMessage }) => {
        const r = await request(`/cases/${caseId}/tasks/${taskId}`, { method: 'POST', body: { status, note, studentMessage, dept: deptId } })
        replaceCase(r.case)
        refresh()
        return r.case
      },
    }
  }, [user, authChecked, cases, casesLoaded, workload, serverDown, deptId, draft, refresh, startSession, clearSession])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
