// OneCase SQLite database (sql.js = SQLite compiled to WebAssembly, no native build needed).
// The whole database lives in server/data/onecase.db and is saved after every write.
import initSqlJs from 'sql.js'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { makeSeed } from '../src/data/seed.js'
import { makeUsers } from '../src/data/users.js'
import { slotEnd, upcomingDays } from './schedule.js'
import { ACADEMIC_RECORDS } from './academicSeed.js'
import { parseRoll } from '../src/data/academic.js'

const DATA_DIR = fileURLToPath(new URL('./data/', import.meta.url))
export const DB_FILE = `${DATA_DIR}onecase.db`

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('student','staff','coordinator')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  roll          TEXT,
  dept_id       TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  case_id      TEXT PRIMARY KEY,
  student_id   TEXT REFERENCES users(id),
  student_name TEXT NOT NULL,
  issue        TEXT,
  summary      TEXT,
  priority     TEXT,
  urgent       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  dept_id        TEXT NOT NULL,
  task_name      TEXT NOT NULL,
  status         TEXT NOT NULL,
  note           TEXT,
  depends_on     TEXT,
  assigned_staff TEXT,
  updated_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timeline (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  at      TEXT NOT NULL,
  text    TEXT NOT NULL,
  kind    TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id         TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  at              TEXT NOT NULL,
  dept_id         TEXT,
  text            TEXT,
  student_message TEXT
);
-- Session slots a student books with a department. task_id is not a foreign key on purpose:
-- tasks are rewritten as a set when a case is saved, and bookings must survive that.
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  task_id    TEXT NOT NULL,
  dept_id    TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
  created_at TEXT NOT NULL
);
-- No clashes, enforced by the database itself:
--   a department slot can be held by only ONE student ...
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dept_slot ON bookings(dept_id, starts_at) WHERE status = 'booked';
--   ... and a student can never be in two sessions at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_slot ON bookings(student_id, starts_at) WHERE status = 'booked';
--   one active booking per department task.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_booking ON bookings(task_id) WHERE status = 'booked';
-- A student's rating of a department's support, once that task is completed.
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  task_id    TEXT NOT NULL UNIQUE,
  dept_id    TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TEXT NOT NULL
);
-- Academic database (read only by the Academic Support department).
-- roll format 1602-YY-BBB-NNN, branch codes 733 CSE, 737 IT, 735 ECE.
CREATE TABLE IF NOT EXISTS academic_records (
  roll       TEXT PRIMARY KEY CHECK (roll GLOB '1602-[0-9][0-9]-73[357]-[0-9][0-9][0-9]'),
  name       TEXT NOT NULL,
  branch     TEXT NOT NULL CHECK (branch IN ('CSE','IT','ECE')),
  joined     INTEGER NOT NULL,
  cgpa       REAL NOT NULL CHECK (cgpa BETWEEN 0 AND 10),
  attendance REAL NOT NULL CHECK (attendance BETWEEN 0 AND 100),
  updated_at TEXT NOT NULL
);
-- Hackathons, coding contests and other college events, one row per participation.
CREATE TABLE IF NOT EXISTS activities (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  roll   TEXT NOT NULL REFERENCES academic_records(roll) ON DELETE CASCADE,
  type   TEXT NOT NULL,
  event  TEXT NOT NULL,
  month  TEXT NOT NULL,
  result TEXT
);
CREATE INDEX IF NOT EXISTS idx_activities_roll ON activities(roll);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(dept_id);
CREATE INDEX IF NOT EXISTS idx_cases_student ON cases(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dept ON bookings(dept_id, starts_at);
`

let db

// ---------- low-level helpers ----------
function all(sql, params = {}) {
  const st = db.prepare(sql)
  st.bind(params)
  const rows = []
  while (st.step()) rows.push(st.getAsObject())
  st.free()
  return rows
}
const one = (sql, params) => all(sql, params)[0]
const run = (sql, params = {}) => db.run(sql, params)

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function persist() {
  mkdirSync(DATA_DIR, { recursive: true })
  const bytes = Buffer.from(db.export())
  const tmp = `${DB_FILE}.tmp`
  writeFileSync(tmp, bytes)
  // Atomic replace. Sync tools like OneDrive can briefly lock the file, so retry, then fall back.
  for (let i = 0; i < 5; i++) {
    try {
      renameSync(tmp, DB_FILE)
      return
    } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e
      sleep(40 * (i + 1))
    }
  }
  writeFileSync(DB_FILE, bytes)
}

function tx(fn) {
  run('BEGIN')
  let out
  try {
    out = fn()
    run('COMMIT')
  } catch (e) {
    run('ROLLBACK')
    throw e
  }
  try {
    persist()
  } catch (e) {
    // Data is committed in memory; the next successful write will save it.
    console.error('[db] could not save database file:', e.message)
  }
  return out
}

// ---------- passwords ----------
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const a = scryptSync(pw, salt, 32)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// ---------- mapping ----------
const publicUser = (u) => u && { id: u.id, role: u.role, name: u.name, email: u.email, roll: u.roll || null, deptId: u.dept_id || null }

function insertUser(u) {
  run(
    `INSERT INTO users (id, role, name, email, roll, dept_id, password_hash, created_at)
     VALUES ($id, $role, $name, $email, $roll, $dept, $hash, $at)`,
    { $id: u.id, $role: u.role, $name: u.name, $email: u.email.toLowerCase(), $roll: u.roll ?? null, $dept: u.deptId ?? null, $hash: u.passwordHash ?? hashPassword(u.password), $at: new Date().toISOString() }
  )
}

function writeCase(c) {
  run(
    `INSERT INTO cases (case_id, student_id, student_name, issue, summary, priority, urgent, created_at)
     VALUES ($id, $sid, $sname, $issue, $summary, $priority, $urgent, $at)
     ON CONFLICT(case_id) DO UPDATE SET issue = excluded.issue, summary = excluded.summary,
       priority = excluded.priority, urgent = excluded.urgent`,
    { $id: c.caseId, $sid: c.studentId ?? null, $sname: c.studentName, $issue: c.issue, $summary: c.summary, $priority: c.priority, $urgent: c.urgent ? 1 : 0, $at: c.createdAt }
  )
  // Child rows are rewritten as a set: simple and correct for case-sized data.
  for (const t of ['tasks', 'timeline', 'notes']) run(`DELETE FROM ${t} WHERE case_id = $id`, { $id: c.caseId })
  c.tasks.forEach((t, i) =>
    run(
      `INSERT INTO tasks (id, case_id, position, dept_id, task_name, status, note, depends_on, assigned_staff, updated_at)
       VALUES ($id, $case, $pos, $dept, $name, $status, $note, $dep, $staff, $at)`,
      { $id: t.id, $case: c.caseId, $pos: i, $dept: t.deptId, $name: t.taskName, $status: t.status, $note: t.note || '', $dep: t.dependsOn ?? null, $staff: t.assignedStaff ?? null, $at: t.updatedAt }
    )
  )
  c.timeline.forEach((e) => run('INSERT INTO timeline (case_id, at, text, kind) VALUES ($case, $at, $text, $kind)', { $case: c.caseId, $at: e.at, $text: e.text, $kind: e.kind ?? null }))
  c.notes.forEach((n) =>
    run('INSERT INTO notes (case_id, at, dept_id, text, student_message) VALUES ($case, $at, $dept, $text, $msg)', { $case: c.caseId, $at: n.at, $dept: n.deptId ?? null, $text: n.text || '', $msg: n.studentMessage || '' })
  )
}

function readCase(row) {
  const $id = row.case_id
  const student = row.student_id && one('SELECT roll FROM users WHERE id = $id', { $id: row.student_id })
  return {
    caseId: row.case_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentRoll: student?.roll ?? null,
    issue: row.issue,
    summary: row.summary,
    priority: row.priority,
    urgent: Boolean(row.urgent),
    createdAt: row.created_at,
    tasks: all('SELECT * FROM tasks WHERE case_id = $id ORDER BY position', { $id }).map((t) => ({
      id: t.id,
      deptId: t.dept_id,
      taskName: t.task_name,
      status: t.status,
      note: t.note || '',
      dependsOn: t.depends_on,
      assignedStaff: t.assigned_staff,
      updatedAt: t.updated_at,
    })),
    timeline: all('SELECT at, text, kind FROM timeline WHERE case_id = $id ORDER BY id', { $id }),
    notes: all('SELECT at, dept_id, text, student_message FROM notes WHERE case_id = $id ORDER BY id', { $id }).map((n) => ({
      at: n.at,
      deptId: n.dept_id,
      text: n.text || '',
      studentMessage: n.student_message || '',
    })),
    bookings: all("SELECT id, task_id, dept_id, starts_at, ends_at FROM bookings WHERE case_id = $id AND status = 'booked' ORDER BY starts_at", { $id }).map((b) => ({
      id: b.id,
      taskId: b.task_id,
      deptId: b.dept_id,
      start: b.starts_at,
      end: b.ends_at,
    })),
    reviews: all('SELECT task_id, dept_id, rating, comment, created_at FROM reviews WHERE case_id = $id ORDER BY id', { $id }).map((r) => ({
      taskId: r.task_id,
      deptId: r.dept_id,
      rating: r.rating,
      comment: r.comment || '',
      at: r.created_at,
    })),
  }
}

function insertBooking({ caseId, taskId, deptId, studentId, start }) {
  run(
    `INSERT INTO bookings (case_id, task_id, dept_id, student_id, starts_at, ends_at, status, created_at)
     VALUES ($case, $task, $dept, $student, $start, $end, 'booked', $at)`,
    { $case: caseId, $task: taskId, $dept: deptId, $student: studentId, $start: start, $end: slotEnd(start), $at: new Date().toISOString() }
  )
}

function upsertReview({ caseId, taskId, deptId, studentId, rating, comment }) {
  run(
    `INSERT INTO reviews (case_id, task_id, dept_id, student_id, rating, comment, created_at)
     VALUES ($case, $task, $dept, $student, $rating, $comment, $at)
     ON CONFLICT(task_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at`,
    { $case: caseId, $task: taskId, $dept: deptId, $student: studentId, $rating: rating, $comment: comment || '', $at: new Date().toISOString() }
  )
}

function seedAcademic() {
  const at = new Date().toISOString()
  ACADEMIC_RECORDS.forEach((r) => {
    const p = parseRoll(r.roll)
    run(
      'INSERT INTO academic_records (roll, name, branch, joined, cgpa, attendance, updated_at) VALUES ($roll, $name, $branch, $joined, $cgpa, $att, $at)',
      { $roll: p.roll, $name: r.name, $branch: p.branch, $joined: p.joined, $cgpa: r.cgpa, $att: r.attendance, $at: at }
    )
    r.activities.forEach(([type, event, month, result]) =>
      run('INSERT INTO activities (roll, type, event, month, result) VALUES ($roll, $type, $event, $month, $result)', { $roll: p.roll, $type: type, $event: event, $month: month, $result: result })
    )
  })
}

function seed() {
  seedAcademic()
  makeUsers().forEach(insertUser)
  makeSeed().forEach(writeCase)
  // Demo sessions on the first bookable day, so Counseling already shows taken slots.
  const day = upcomingDays()[0]
  insertBooking({ caseId: '1024', taskId: '1024-counseling', deptId: 'counseling', studentId: 's-ananya', start: `${day}T10:00` })
  insertBooking({ caseId: '1026', taskId: '1026-counseling', deptId: 'counseling', studentId: 's-demo', start: `${day}T10:30` })
  insertBooking({ caseId: '1025', taskId: '1025-financial', deptId: 'financial', studentId: 's-rahul', start: `${day}T11:00` })
  upsertReview({ caseId: '1023', taskId: '1023-accommodation', deptId: 'accommodation', studentId: 's-sneha', rating: 5, comment: 'Moved to a dry room within two days. Thank you!' })
  upsertReview({ caseId: '1023', taskId: '1023-medical', deptId: 'medical', studentId: 's-sneha', rating: 4, comment: 'Quick check-up, very kind doctor.' })
}

// ---------- public API ----------
export async function openDb() {
  const SQL = await initSqlJs()
  db = existsSync(DB_FILE) ? new SQL.Database(readFileSync(DB_FILE)) : new SQL.Database()
  db.exec(SCHEMA)
  if (!one('SELECT COUNT(*) AS n FROM users').n) tx(seed)
  else if (!one('SELECT COUNT(*) AS n FROM academic_records').n) tx(seedAcademic) // database created before this table existed
  return stats()
}

export function stats() {
  return {
    users: one('SELECT COUNT(*) AS n FROM users').n,
    cases: one('SELECT COUNT(*) AS n FROM cases').n,
    tasks: one('SELECT COUNT(*) AS n FROM tasks').n,
  }
}

export const findUserByEmail = (email) => one('SELECT * FROM users WHERE email = $e', { $e: String(email).trim().toLowerCase() })

export function checkLogin(email, password) {
  const u = findUserByEmail(email)
  if (!u) return { error: 'No account found with that email.' }
  if (!verifyPassword(password, u.password_hash)) return { error: 'Incorrect password. Try again.' }
  return { user: publicUser(u) }
}

export function createStudent({ name, email, roll, password }) {
  const id = `s-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`
  tx(() => insertUser({ id, role: 'student', name, email, roll, password }))
  return publicUser(one('SELECT * FROM users WHERE id = $id', { $id: id }))
}

export function createSession(userId) {
  const token = randomBytes(24).toString('hex')
  tx(() => run('INSERT INTO sessions (token, user_id, created_at) VALUES ($t, $u, $at)', { $t: token, $u: userId, $at: new Date().toISOString() }))
  return token
}

export function userForToken(token) {
  if (!token) return null
  return publicUser(one('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $t', { $t: token }))
}

export const deleteSession = (token) => tx(() => run('DELETE FROM sessions WHERE token = $t', { $t: token }))

// Role-based case access, enforced in SQL.
export function listCases(user, deptId) {
  let rows
  if (user.role === 'student') rows = all('SELECT * FROM cases WHERE student_id = $u ORDER BY created_at DESC', { $u: user.id })
  else if (user.role === 'coordinator') rows = all('SELECT * FROM cases ORDER BY created_at DESC')
  else rows = all('SELECT DISTINCT c.* FROM cases c JOIN tasks t ON t.case_id = c.case_id WHERE t.dept_id = $d ORDER BY c.created_at DESC', { $d: deptId })
  return rows.map(readCase)
}

export function getCase(caseId) {
  const row = one('SELECT * FROM cases WHERE case_id = $id', { $id: String(caseId) })
  return row ? readCase(row) : null
}

export function saveCase(c) {
  tx(() => writeCase(c))
  return getCase(c.caseId)
}

export function nextCaseId() {
  const r = one('SELECT MAX(CAST(case_id AS INTEGER)) AS m FROM cases')
  return String(Math.max(1023, r.m || 0) + 1)
}

// Aggregate counts and average ratings only, no student details: safe to show every staff member.
export function workload() {
  const ratings = all('SELECT dept_id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews GROUP BY dept_id')
  return all(
    `SELECT dept_id AS deptId,
            SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS open,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done
     FROM tasks GROUP BY dept_id`
  ).map((w) => {
    const r = ratings.find((x) => x.dept_id === w.deptId)
    return { ...w, rating: r ? Math.round(r.avg * 10) / 10 : null, reviews: r?.n ?? 0 }
  })
}

// ---------- slot booking ----------
// Which of a department's slots are taken (by anyone) and which times this student is already busy.
export function slotUsage(deptId, studentId) {
  return {
    deptTaken: all("SELECT starts_at, task_id FROM bookings WHERE dept_id = $d AND status = 'booked'", { $d: deptId }),
    studentBusy: all("SELECT starts_at, dept_id FROM bookings WHERE student_id = $s AND status = 'booked'", { $s: studentId }),
  }
}

export class ClashError extends Error {}

// Book (or move) the session for one task. The unique indexes make clashes impossible,
// even if two students press "Book" on the same slot at the same moment.
export function bookSlot({ updatedCase, taskId, deptId, studentId, start }) {
  try {
    tx(() => {
      run("UPDATE bookings SET status = 'cancelled' WHERE task_id = $t AND status = 'booked'", { $t: taskId })
      insertBooking({ caseId: updatedCase.caseId, taskId, deptId, studentId, start })
      writeCase(updatedCase)
    })
  } catch (e) {
    const msg = String(e.message)
    if (msg.includes('bookings.dept_id')) throw new ClashError('Sorry, another student has just booked that slot. Please pick another time.')
    if (msg.includes('bookings.student_id')) throw new ClashError('You already have another session at that time. Please pick a different slot.')
    throw e
  }
  return getCase(updatedCase.caseId)
}

export function findBooking(id) {
  return one("SELECT * FROM bookings WHERE id = $id AND status = 'booked'", { $id: Number(id) })
}

export function cancelBooking(id, updatedCase) {
  tx(() => {
    run("UPDATE bookings SET status = 'cancelled' WHERE id = $id", { $id: Number(id) })
    writeCase(updatedCase)
  })
  return getCase(updatedCase.caseId)
}

// ---------- academic records ----------
const readActivities = (roll) =>
  all('SELECT type, event, month, result FROM activities WHERE roll = $r ORDER BY month DESC', { $r: roll })

export function academicByRoll(roll) {
  const r = one('SELECT * FROM academic_records WHERE roll = $r', { $r: String(roll || '').trim() })
  if (!r) return null
  return { roll: r.roll, name: r.name, branch: r.branch, joined: r.joined, cgpa: r.cgpa, attendance: r.attendance, updatedAt: r.updated_at, activities: readActivities(r.roll) }
}

export function listAcademic() {
  return all('SELECT * FROM academic_records ORDER BY roll').map((r) => ({
    roll: r.roll, name: r.name, branch: r.branch, joined: r.joined, cgpa: r.cgpa, attendance: r.attendance, activities: readActivities(r.roll),
  }))
}

export const hasAcademicRecord = (roll) => Boolean(one('SELECT 1 AS x FROM academic_records WHERE roll = $r', { $r: String(roll || '') }))

// ---------- reviews ----------
export function saveReview(review, updatedCase) {
  tx(() => {
    upsertReview(review)
    writeCase(updatedCase)
  })
  return getCase(updatedCase.caseId)
}

// Restore the demo data but keep existing logins for demo accounts.
export function resetDemo() {
  tx(() => {
    const sessions = all('SELECT * FROM sessions')
    for (const t of ['reviews', 'bookings', 'notes', 'timeline', 'tasks', 'cases', 'sessions', 'users', 'activities', 'academic_records']) run(`DELETE FROM ${t}`)
    seed()
    const ids = new Set(all('SELECT id FROM users').map((u) => u.id))
    sessions.filter((s) => ids.has(s.user_id)).forEach((s) => run('INSERT INTO sessions (token, user_id, created_at) VALUES ($t, $u, $at)', { $t: s.token, $u: s.user_id, $at: s.created_at }))
  })
  return stats()
}
