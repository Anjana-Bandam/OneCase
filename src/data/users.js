// Fictional demo accounts. Staff accounts are pre-provisioned with a department:
// staff never sign up themselves. Prototype only: passwords are not hashed.
import { DEPARTMENTS } from './departments.js'

export const DEMO_PASSWORD = 'demo123'

export function makeUsers() {
  return [
    { id: 's-ananya', role: 'student', name: 'Ananya Rao', email: 'ananya@vasavi.edu', roll: '1602-24-733-014', password: DEMO_PASSWORD },
    { id: 's-rahul', role: 'student', name: 'Rahul Mehta', email: 'rahul@vasavi.edu', roll: '1602-24-735-027', password: DEMO_PASSWORD },
    { id: 's-demo', role: 'student', name: 'Demo Student', email: 'student@vasavi.edu', roll: '1602-25-733-100', password: DEMO_PASSWORD },
    { id: 's-sneha', role: 'student', name: 'Sneha Kulkarni', email: 'sneha@vasavi.edu', roll: '1602-23-737-042', password: DEMO_PASSWORD },
    ...DEPARTMENTS.map((d) => ({
      id: `staff-${d.id}`,
      role: 'staff',
      name: d.staff,
      email: `${d.id}@vasavi.edu`,
      deptId: d.id,
      password: DEMO_PASSWORD,
    })),
    { id: 'coordinator', role: 'coordinator', name: 'Support Coordinator', email: 'coordinator@vasavi.edu', deptId: 'counseling', password: DEMO_PASSWORD },
  ]
}

export const ROLE_LABEL = { student: 'Student', staff: 'Staff', coordinator: 'Coordinator' }
