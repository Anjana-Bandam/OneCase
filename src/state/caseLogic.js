// Pure case-workflow logic (no React), shared by the store and tests.
import { deptById } from '../data/departments.js'

export const STATUS = {
  not_started: { label: 'Not Started', tone: 'grey' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  ready: { label: 'Ready', tone: 'blue' },
  waiting: { label: 'Waiting', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  resolved: { label: 'Resolved', tone: 'green' },
}

const short = (id) => deptById(id)?.short ?? id

// Overall case status is always derived from the department tasks.
export function computeOverall(tasks = []) {
  if (tasks.length && tasks.every((t) => t.status === 'completed')) return 'resolved'
  if (tasks.some((t) => t.status === 'in_progress' || t.status === 'ready')) return 'in_progress'
  if (tasks.some((t) => t.status === 'waiting')) return 'waiting'
  if (tasks.some((t) => t.status === 'completed')) return 'in_progress'
  return 'not_started'
}

export function nextAction(c) {
  if (computeOverall(c.tasks) === 'resolved') return 'All support work is complete. The case is resolved.'
  const open = c.tasks.filter((t) => t.status !== 'completed')
  const t = open.find((x) => x.status === 'in_progress') || open.find((x) => x.status === 'ready') || open.find((x) => x.status === 'not_started') || open[0]
  if (!t) return ''
  if (t.status === 'in_progress') return `${short(t.deptId)} is working on: ${t.taskName.toLowerCase()}.`
  if (t.status === 'ready') return `${short(t.deptId)} can now start: ${t.taskName.toLowerCase()}.`
  if (t.status === 'waiting') {
    const dep = c.tasks.find((x) => x.id === t.dependsOn)
    return dep ? `${short(t.deptId)} will start once ${short(dep.deptId)} completes.` : `${short(t.deptId)} is waiting on more information.`
  }
  return `${short(t.deptId)} will pick up: ${t.taskName.toLowerCase()}.`
}

export const TASK_STATUSES = ['not_started', 'in_progress', 'waiting', 'ready', 'completed']

// One student request becomes ONE case with one task per chosen department.
export function buildCase({ caseId, student, issue, summary, priority, urgent, deptIds }) {
  const at = new Date().toISOString()
  const tasks = deptIds.map((id) => {
    const d = deptById(id)
    const taskName = urgent && id === 'counseling' ? 'Same-day wellbeing check-in' : d.task
    return { id: `${caseId}-${id}`, deptId: id, taskName, status: 'not_started', note: '', dependsOn: null, assignedStaff: d.staff, updatedAt: at }
  })
  const shorts = deptIds.map(short)
  return {
    caseId,
    studentId: student.id,
    studentName: student.name,
    issue,
    summary,
    priority,
    urgent: Boolean(urgent),
    createdAt: at,
    tasks,
    timeline: [
      { at, text: 'Case created. Student told their story once.', kind: 'created' },
      { at, text: `Relevant teams identified: ${shorts.join(', ')}`, kind: 'identified' },
      ...shorts.map((s) => ({ at, text: `${s} assigned`, kind: 'assigned' })),
    ],
    notes: [],
  }
}

// A department updates its own task on the shared case.
export function applyTaskUpdate(c, { taskId, status, note, studentMessage, deptId }) {
  const before = computeOverall(c.tasks)
  const task = c.tasks.find((t) => t.id === taskId)
  if (!task) return c
  const at = new Date().toISOString()
  const timeline = [...c.timeline]
  const notes = [...c.notes]

  let tasks = c.tasks.map((t) => (t.id === taskId ? { ...t, status, note: note?.trim() || t.note, updatedAt: at } : t))
  if (status !== task.status) timeline.push({ at, text: `${short(task.deptId)} → ${STATUS[status].label}`, kind: status })
  if (note?.trim() || studentMessage?.trim()) {
    notes.push({ at, deptId, text: note?.trim() || '', studentMessage: studentMessage?.trim() || '' })
  }
  // Dependency: completing a task unlocks tasks waiting on it.
  if (status === 'completed') {
    tasks = tasks.map((t) => {
      if (t.dependsOn === taskId && t.status === 'waiting') {
        timeline.push({ at, text: `${short(t.deptId)} unlocked → Ready (${short(task.deptId)} completed)`, kind: 'ready' })
        return { ...t, status: 'ready', updatedAt: at }
      }
      return t
    })
  }
  const after = computeOverall(tasks)
  if (after !== before) timeline.push({ at, text: `Overall case → ${STATUS[after].label}`, kind: after })
  return { ...c, tasks, timeline, notes }
}
