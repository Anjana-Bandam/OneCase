// The 12 university support departments from the challenge scenario.
// Shared by the React app and the AI server.
export const DEPARTMENTS = [
  { id: 'counseling', name: 'Counseling & Mental Wellbeing', short: 'Counseling', icon: '💬', task: 'Initial counseling session', staff: 'Dr. Meera Nair' },
  { id: 'academic', name: 'Academic Support', short: 'Academic Support', icon: '📚', task: 'Academic guidance plan', staff: 'Prof. Vikram Shah' },
  { id: 'medical', name: 'Medical / Health Services', short: 'Medical', icon: '🩺', task: 'Health check-in', staff: 'Dr. Farah Khan' },
  { id: 'financial', name: 'Financial Aid', short: 'Financial Aid', icon: '💰', task: 'Financial assistance review', staff: 'Suresh Pillai' },
  { id: 'accommodation', name: 'Accommodation / Hostel Support', short: 'Hostel', icon: '🏠', task: 'Accommodation review', staff: 'Lakshmi Reddy' },
  { id: 'disability', name: 'Disability & Accessibility Support', short: 'Accessibility', icon: '♿', task: 'Accessibility needs assessment', staff: 'Anil Joseph' },
  { id: 'career', name: 'Career Services', short: 'Career', icon: '🎯', task: 'Career guidance session', staff: 'Neha Kapoor' },
  { id: 'international', name: 'International Student Support', short: 'International', icon: '🌍', task: 'International student check-in', staff: 'Daniel Mensah' },
  { id: 'affairs', name: 'Student Affairs', short: 'Student Affairs', icon: '🎓', task: 'General support follow-up', staff: 'Ritu Agarwal' },
  { id: 'safety', name: 'Safety & Security', short: 'Safety', icon: '🛡️', task: 'Safety assessment', staff: 'Rajesh Kumar' },
  { id: 'peer', name: 'Social / Peer Support', short: 'Peer Support', icon: '🤝', task: 'Peer mentor match', staff: 'Campus Peer Team' },
  { id: 'legal', name: 'Student Legal / Grievance Support', short: 'Grievance', icon: '⚖️', task: 'Grievance review', staff: 'Kavita Menon' },
]

export const deptById = (id) => DEPARTMENTS.find((d) => d.id === id)

export const deptByName = (name = '') => {
  const n = name.trim().toLowerCase()
  return DEPARTMENTS.find((d) => d.name.toLowerCase() === n || d.short.toLowerCase() === n)
}
