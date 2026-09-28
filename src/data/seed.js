// Fictional demo data only. No real student information.
const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString()

export function makeSeed() {
  return [
    {
      caseId: '1024',
      studentId: 's-ananya',
      studentName: 'Ananya Rao',
      issue: 'Academic stress + emotional wellbeing',
      summary: 'Third-year student reports falling behind on coursework and feeling overwhelmed for several weeks. Studies are significantly affected.',
      priority: 'Medium',
      urgent: false,
      createdAt: ago(30),
      tasks: [
        { id: '1024-counseling', deptId: 'counseling', taskName: 'Initial counseling session', status: 'in_progress', note: 'Session booked for today.', dependsOn: null, assignedStaff: 'Dr. Meera Nair', updatedAt: ago(20) },
        { id: '1024-academic', deptId: 'academic', taskName: 'Academic guidance plan', status: 'in_progress', note: 'Reviewing coursework deadlines with the student.', dependsOn: null, assignedStaff: 'Prof. Vikram Shah', updatedAt: ago(18) },
      ],
      timeline: [
        { at: ago(30), text: 'Case created. Student told their story once.', kind: 'created' },
        { at: ago(30), text: 'Relevant teams identified: Counseling, Academic Support', kind: 'identified' },
        { at: ago(29), text: 'Counseling assigned', kind: 'assigned' },
        { at: ago(29), text: 'Academic Support assigned', kind: 'assigned' },
        { at: ago(20), text: 'Counseling → In Progress', kind: 'in_progress' },
        { at: ago(18), text: 'Academic Support → In Progress (working in parallel)', kind: 'in_progress' },
      ],
      notes: [
        { at: ago(20), deptId: 'counseling', text: 'Session booked for today.', studentMessage: 'Hi Ananya, your first counseling session is booked for today. We are here to listen.' },
      ],
    },
    {
      caseId: '1025',
      studentId: 's-rahul',
      studentName: 'Rahul Mehta',
      issue: 'Financial difficulty',
      summary: 'Student reports difficulty paying this semester’s hostel and tuition fees after a change in family circumstances.',
      priority: 'Medium',
      urgent: false,
      createdAt: ago(50),
      tasks: [
        { id: '1025-financial', deptId: 'financial', taskName: 'Hardship fund review', status: 'in_progress', note: 'Documents received, eligibility check under way.', dependsOn: null, assignedStaff: 'Suresh Pillai', updatedAt: ago(26) },
      ],
      timeline: [
        { at: ago(50), text: 'Case created. Student told their story once.', kind: 'created' },
        { at: ago(50), text: 'Relevant teams identified: Financial Aid', kind: 'identified' },
        { at: ago(49), text: 'Financial Aid assigned', kind: 'assigned' },
        { at: ago(26), text: 'Financial Aid → In Progress', kind: 'in_progress' },
      ],
      notes: [
        { at: ago(26), deptId: 'financial', text: 'Documents received, eligibility check under way.', studentMessage: 'Hi Rahul, we have your documents and are checking your eligibility for the hardship fund.' },
      ],
    },
    {
      caseId: '1026',
      studentId: 's-demo',
      studentName: 'Demo Student',
      issue: 'Wellbeing + academic concern',
      summary: 'Student reports low mood and missed classes. A wellbeing assessment is needed before academic adjustments are planned.',
      priority: 'High',
      urgent: false,
      createdAt: ago(8),
      tasks: [
        { id: '1026-counseling', deptId: 'counseling', taskName: 'Wellbeing assessment', status: 'in_progress', note: '', dependsOn: null, assignedStaff: 'Dr. Meera Nair', updatedAt: ago(6) },
        { id: '1026-academic', deptId: 'academic', taskName: 'Academic intervention plan', status: 'waiting', note: '', dependsOn: '1026-counseling', assignedStaff: 'Prof. Vikram Shah', updatedAt: ago(7) },
      ],
      timeline: [
        { at: ago(8), text: 'Case created. Student told their story once.', kind: 'created' },
        { at: ago(8), text: 'Relevant teams identified: Counseling, Academic Support', kind: 'identified' },
        { at: ago(7), text: 'Academic Support → Waiting for Counseling (dependency)', kind: 'waiting' },
        { at: ago(6), text: 'Counseling → In Progress', kind: 'in_progress' },
      ],
      notes: [],
    },
    {
      caseId: '1023',
      studentId: 's-sneha',
      studentName: 'Sneha Kulkarni',
      issue: 'Hostel issue + physical health',
      summary: 'Student reported damp hostel room and recurring respiratory symptoms.',
      priority: 'Low',
      urgent: false,
      createdAt: ago(120),
      tasks: [
        { id: '1023-accommodation', deptId: 'accommodation', taskName: 'Room transfer', status: 'completed', note: 'Moved to Block C, room 214.', dependsOn: null, assignedStaff: 'Lakshmi Reddy', updatedAt: ago(70) },
        { id: '1023-medical', deptId: 'medical', taskName: 'Health check-in', status: 'completed', note: 'Check-up done, no further action.', dependsOn: null, assignedStaff: 'Dr. Farah Khan', updatedAt: ago(60) },
      ],
      timeline: [
        { at: ago(120), text: 'Case created. Student told their story once.', kind: 'created' },
        { at: ago(120), text: 'Relevant teams identified: Hostel, Medical', kind: 'identified' },
        { at: ago(70), text: 'Hostel → Completed', kind: 'completed' },
        { at: ago(60), text: 'Medical → Completed', kind: 'completed' },
        { at: ago(60), text: 'Overall case → Resolved', kind: 'resolved' },
      ],
      notes: [
        { at: ago(70), deptId: 'accommodation', text: 'Moved to Block C, room 214.', studentMessage: 'Hi Sneha, your room transfer to Block C is complete.' },
      ],
    },
  ]
}
