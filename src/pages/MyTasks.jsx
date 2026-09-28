import { useState } from 'react'
import { useStore } from '../state/CaseStore'
import { deptById } from '../data/departments'
import { Empty } from '../components/ui'
import { StaffHeader, TaskList, useDeptTasks } from './StaffDashboard'

const FILTERS = [
  { id: 'open', label: 'Open', test: (s) => s !== 'completed' },
  { id: 'waiting', label: 'Waiting', test: (s) => s === 'waiting' },
  { id: 'completed', label: 'Completed', test: (s) => s === 'completed' },
  { id: 'all', label: 'All', test: () => true },
]

export default function MyTasks() {
  const { deptId } = useStore()
  const [filter, setFilter] = useState('open')
  const items = useDeptTasks(deptId)
  const f = FILTERS.find((x) => x.id === filter)
  const shown = items.filter((x) => f.test(x.task.status))

  return (
    <div className="page">
      <StaffHeader title="my tasks" />
      <div className="tabs" role="tablist">
        {FILTERS.map((x) => (
          <button key={x.id} role="tab" aria-selected={filter === x.id} className={filter === x.id ? 'on' : ''} onClick={() => setFilter(x.id)}>
            {x.label} <b>{items.filter((i) => x.test(i.task.status)).length}</b>
          </button>
        ))}
      </div>
      <div className="card">
        {shown.length ? (
          <TaskList items={shown} />
        ) : (
          <Empty icon="✅" title={`No ${f.label.toLowerCase()} tasks for ${deptById(deptId).name}`} />
        )}
      </div>
    </div>
  )
}
