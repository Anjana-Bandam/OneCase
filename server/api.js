// OneCase data API: accounts, sessions and shared cases, backed by SQLite.
import { Router } from 'express'
import * as db from './db.js'
import { DEPARTMENTS, deptById } from '../src/data/departments.js'
import { applyTaskUpdate, buildCase, TASK_STATUSES } from '../src/state/caseLogic.js'
import { SLOT_TIMES, isBookableSlot, slotEnd, upcomingDays } from './schedule.js'
import { parseRoll } from '../src/data/academic.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const DEMO_LOGIN = process.env.DEMO_LOGIN !== 'false'
const PRIORITIES = ['Low', 'Medium', 'High']

// Attach req.user from "Authorization: Bearer <token>".
export function authenticate(req, _res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '')
  req.token = token || null
  req.user = db.userForToken(token)
  next()
}

export const requireUser = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please log in.'))
  if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'Your account can’t do that.'))
  next()
}

// Which department a staff request acts as. Staff may use the demo switch;
// coordinators see everything.
function viewingDept(req) {
  const d = req.query.dept || req.body?.dept || req.user.deptId
  if (!deptById(d)) throw new HttpError(400, 'Unknown department.')
  return d
}

// Students never receive internal staff notes.
function forStudent(c) {
  return {
    ...c,
    tasks: c.tasks.map((t) => ({ ...t, note: '' })),
    notes: c.notes.filter((n) => n.studentMessage).map((n) => ({ ...n, text: '' })),
  }
}

function canAccess(user, c, deptId) {
  if (user.role === 'student') return c.studentId === user.id
  if (user.role === 'coordinator') return true
  return c.tasks.some((t) => t.deptId === deptId)
}

const session = (user) => ({ token: db.createSession(user.id), user })
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res)
    if (out !== undefined) res.json(out)
  } catch (e) {
    next(e)
  }
}

export const api = Router()

// ---------- auth ----------
api.post('/auth/login', wrap((req) => {
  const { email = '', password = '' } = req.body || {}
  const r = db.checkLogin(email, password)
  if (r.error) throw new HttpError(401, r.error)
  return session(r.user)
}))

api.post('/auth/signup', wrap((req) => {
  const { name = '', email = '', roll = '', password = '' } = req.body || {}
  const e = String(email).trim().toLowerCase()
  if (!name.trim()) throw new HttpError(400, 'Please enter your full name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Please enter a valid college email.')
  if (!roll.trim()) throw new HttpError(400, 'Please enter your roll number.')
  if (!parseRoll(roll)) throw new HttpError(400, `Roll number must look like 1602-24-733-005 (branch 733 CSE, 737 IT, 735 ECE).`)
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.')
  if (db.findUserByEmail(e)) throw new HttpError(409, 'An account with this email already exists. Log in instead.')
  return session(db.createStudent({ name: name.trim(), email: e, roll: parseRoll(roll).roll, password }))
}))

// One-click demo accounts for the live presentation (set DEMO_LOGIN=false to disable).
api.post('/auth/demo-login', wrap((req) => {
  if (!DEMO_LOGIN) throw new HttpError(403, 'Demo login is disabled.')
  const u = db.findUserByEmail(req.body?.email || '')
  if (!u || !u.email.endsWith('@vasavi.edu')) throw new HttpError(404, 'Demo account not found.')
  return session({ id: u.id, role: u.role, name: u.name, email: u.email, roll: u.roll, deptId: u.dept_id })
}))

api.post('/auth/logout', wrap((req) => {
  if (req.token) db.deleteSession(req.token)
  return { ok: true }
}))

api.get('/me', requireUser(), wrap((req) => ({ user: req.user })))

// ---------- cases ----------
api.get('/cases', requireUser(), wrap((req) => {
  const u = req.user
  const dept = u.role === 'staff' ? viewingDept(req) : null
  const cases = db.listCases(u, dept)
  return { cases: u.role === 'student' ? cases.map(forStudent) : cases }
}))

api.get('/cases/:id', requireUser(), wrap((req) => {
  const c = db.getCase(req.params.id)
  const dept = req.user.role === 'staff' ? viewingDept(req) : null
  if (!c || !canAccess(req.user, c, dept)) throw new HttpError(404, 'Case not found or not shared with you.')
  return { case: req.user.role === 'student' ? forStudent(c) : c }
}))

api.post('/cases', requireUser('student'), wrap((req) => {
  const { issue = '', summary = '', priority = 'Medium', urgent = false, deptIds = [] } = req.body || {}
  const ids = [...new Set(deptIds)].filter((id) => deptById(id))
  if (!ids.length) throw new HttpError(400, 'Choose at least one support team.')
  const ordered = DEPARTMENTS.map((d) => d.id).filter((id) => ids.includes(id))
  const c = buildCase({
    caseId: db.nextCaseId(),
    student: req.user,
    issue: String(issue).slice(0, 120) || 'Support request',
    summary: String(summary).slice(0, 1000),
    priority: PRIORITIES.includes(priority) ? priority : 'Medium',
    urgent: Boolean(urgent),
    deptIds: ordered,
  })
  // Contacting Academic Support links the student's academic record automatically (by roll number).
  if (ordered.includes('academic')) {
    const found = db.hasAcademicRecord(req.user.roll)
    c.timeline.push({
      at: c.createdAt,
      text: found ? 'Academic record linked for Academic Support' : 'No academic record matched this roll number: Academic Support will verify',
      kind: 'identified',
    })
  }
  return { case: forStudent(db.saveCase(c)) }
}))

// A department updates ITS OWN task. The server checks the task belongs to that department.
api.post('/cases/:id/tasks/:taskId', requireUser('staff', 'coordinator'), wrap((req) => {
  const { status, note = '', studentMessage = '' } = req.body || {}
  if (!TASK_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.')
  const dept = viewingDept(req)
  const c = db.getCase(req.params.id)
  if (!c || !canAccess(req.user, c, dept)) throw new HttpError(404, 'Case not found or not shared with you.')
  const task = c.tasks.find((t) => t.id === req.params.taskId)
  if (!task) throw new HttpError(404, 'Task not found.')
  if (task.deptId !== dept) throw new HttpError(403, `Only ${deptById(task.deptId).name} can update this task.`)
  const updated = applyTaskUpdate(c, { taskId: task.id, status, note: String(note).slice(0, 2000), studentMessage: String(studentMessage).slice(0, 2000), deptId: dept })
  return { case: db.saveCase(updated) }
}))

// Aggregate counts only (no student details), so every staff member can see the 12-department picture.
api.get('/workload', requireUser('staff', 'coordinator'), wrap(() => ({ workload: db.workload() })))

api.post('/demo/reset', requireUser(), wrap(() => ({ ok: true, stats: db.resetDemo() })))

// ---------- slot booking ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const slotLabel = (start) => {
  const d = new Date(`${start}:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${start.slice(11)}`
}
const BOOKABLE = ['not_started', 'in_progress', 'ready']
const now = () => new Date().toISOString()

// The student's own case and one of its department tasks, or a clear error.
function studentTask(req, caseId, taskId) {
  const c = db.getCase(caseId)
  if (!c || c.studentId !== req.user.id) throw new HttpError(404, 'Case not found.')
  const task = c.tasks.find((t) => t.id === taskId)
  if (!task) throw new HttpError(404, 'Task not found.')
  return { c, task }
}

// A department's slots for the next working days, marked taken / busy for this student.
// Other students' bookings show only as "taken": never who booked them.
api.get('/slots', requireUser('student'), wrap((req) => {
  const { caseId, taskId } = req.query
  const { task } = studentTask(req, caseId, taskId)
  const { deptTaken, studentBusy } = db.slotUsage(task.deptId, req.user.id)
  const days = upcomingDays().map((day) => ({
    day,
    slots: SLOT_TIMES.map((time) => {
      const start = `${day}T${time}`
      const held = deptTaken.find((b) => b.starts_at === start)
      const busy = studentBusy.find((b) => b.starts_at === start)
      let state = 'free'
      if (held?.task_id === task.id) state = 'yours'
      else if (held) state = 'taken'
      else if (busy) state = 'busy'
      return { start, end: slotEnd(start), state, busyWith: state === 'busy' ? busy.dept_id : undefined }
    }),
  }))
  return { deptId: task.deptId, days }
}))

api.post('/bookings', requireUser('student'), wrap((req) => {
  const { caseId, taskId, start } = req.body || {}
  const { c, task } = studentTask(req, caseId, taskId)
  if (!BOOKABLE.includes(task.status)) {
    throw new HttpError(409, task.status === 'waiting' ? 'This team starts after another team finishes. Booking opens then.' : 'This part of your support is already complete.')
  }
  if (!isBookableSlot(start)) throw new HttpError(400, 'That time is not an available session slot.')
  const dept = deptById(task.deptId)
  const moving = c.bookings.some((b) => b.taskId === task.id)
  const updated = { ...c, timeline: [...c.timeline, { at: now(), text: `${dept.short} session ${moving ? 'moved to' : 'booked for'} ${slotLabel(start)}`, kind: 'booked' }] }
  try {
    return { case: forStudent(db.bookSlot({ updatedCase: updated, taskId: task.id, deptId: task.deptId, studentId: req.user.id, start })) }
  } catch (e) {
    if (e instanceof db.ClashError) throw new HttpError(409, e.message)
    throw e
  }
}))

api.delete('/bookings/:id', requireUser('student'), wrap((req) => {
  const b = db.findBooking(req.params.id)
  if (!b || b.student_id !== req.user.id) throw new HttpError(404, 'Booking not found.')
  const c = db.getCase(b.case_id)
  const dept = deptById(b.dept_id)
  const updated = { ...c, timeline: [...c.timeline, { at: now(), text: `${dept.short} session on ${slotLabel(b.starts_at)} cancelled by the student`, kind: 'cancelled' }] }
  return { case: forStudent(db.cancelBooking(b.id, updated)) }
}))

// ---------- academic records (Academic Support department ONLY) ----------
// Checked against the logged-in account's own department, so the demo department switch
// and the coordinator account cannot open academic data.
function requireAcademicDept(req) {
  if (req.user.role !== 'staff' || req.user.deptId !== 'academic') {
    throw new HttpError(403, 'Academic records are only available to the Academic Support department.')
  }
}

// Auto-fetch: the academic record of the student on this case, looked up by their roll number.
api.get('/cases/:id/academic', requireUser('staff', 'coordinator'), wrap((req) => {
  requireAcademicDept(req)
  const c = db.getCase(req.params.id)
  if (!c || !c.tasks.some((t) => t.deptId === 'academic')) throw new HttpError(404, 'This case does not involve Academic Support.')
  return { roll: c.studentRoll, record: c.studentRoll ? db.academicByRoll(c.studentRoll) : null }
}))

// The whole academic database, for the Academic Records page.
api.get('/academic/records', requireUser('staff', 'coordinator'), wrap((req) => {
  requireAcademicDept(req)
  return { records: db.listAcademic() }
}))

// ---------- reviews ----------
api.post('/reviews', requireUser('student'), wrap((req) => {
  const { caseId, taskId, rating, comment = '' } = req.body || {}
  const { c, task } = studentTask(req, caseId, taskId)
  if (task.status !== 'completed') throw new HttpError(409, 'You can review a team once it has completed its part of your support.')
  const stars = Number(rating)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Please choose 1 to 5 stars.')
  const dept = deptById(task.deptId)
  const again = c.reviews.some((r) => r.taskId === task.id)
  const updated = { ...c, timeline: [...c.timeline, { at: now(), text: `Student ${again ? 'updated their review of' : 'rated'} ${dept.short}: ${stars}/5`, kind: 'review' }] }
  const saved = db.saveReview({ caseId: c.caseId, taskId: task.id, deptId: task.deptId, studentId: req.user.id, rating: stars, comment: String(comment).slice(0, 500) }, updated)
  return { case: forStudent(saved) }
}))
