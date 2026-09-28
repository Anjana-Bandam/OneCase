// Intake question options and how each answer maps to a department.
export const AREAS = [
  { id: 'academic', label: 'Academic / Studies', issue: 'Academic stress', dept: 'academic', reason: 'You indicated that your studies are affected.' },
  { id: 'emotional', label: 'Emotional / Mental Wellbeing', issue: 'Emotional wellbeing', dept: 'counseling', reason: 'You indicated emotional or wellbeing concerns.' },
  { id: 'health', label: 'Physical Health', issue: 'Physical health', dept: 'medical', reason: 'You indicated a physical health concern.' },
  { id: 'financial', label: 'Financial', issue: 'Financial difficulty', dept: 'financial', reason: 'You indicated financial difficulty.' },
  { id: 'accommodation', label: 'Accommodation / Hostel', issue: 'Accommodation issue', dept: 'accommodation', reason: 'You indicated an accommodation or hostel issue.' },
  { id: 'safety', label: 'Safety', issue: 'Safety concern', dept: 'safety', reason: 'You indicated a safety concern.' },
  { id: 'disability', label: 'Disability / Accessibility', issue: 'Accessibility needs', dept: 'disability', reason: 'You indicated accessibility or disability-related needs.' },
  { id: 'career', label: 'Career', issue: 'Career concern', dept: 'career', reason: 'You indicated a career-related concern.' },
  { id: 'international', label: 'International Student Support', issue: 'International student support', dept: 'international', reason: 'You indicated you need international student support.' },
  { id: 'social', label: 'Social / Feeling isolated', issue: 'Feeling isolated', dept: 'peer', reason: 'You indicated you are feeling isolated or need peer support.' },
  { id: 'grievance', label: 'Grievance / Other', issue: 'Grievance', dept: 'legal', reason: 'You indicated a grievance or complaint.' },
  { id: 'unsure', label: 'Not sure', issue: 'General support', dept: 'affairs', reason: 'You were not sure where to start, so Student Affairs can guide you.' },
]

export const DURATIONS = [
  { id: 'recent', label: 'Today / Recently' },
  { id: 'days', label: 'A few days' },
  { id: 'weeks', label: 'A few weeks' },
  { id: 'month', label: 'More than a month' },
]

export const IMPACTS = [
  { id: 'slight', label: 'Slightly' },
  { id: 'moderate', label: 'Moderately' },
  { id: 'significant', label: 'Significantly' },
]

export const HELP_TYPES = [
  { id: 'talk', label: 'Someone to talk to', dept: 'counseling', reason: 'You would like someone to talk to.' },
  { id: 'academic', label: 'Academic guidance', dept: 'academic', reason: 'You asked for academic guidance.' },
  { id: 'medical', label: 'Medical help', dept: 'medical', reason: 'You asked for medical help.' },
  { id: 'financial', label: 'Financial assistance', dept: 'financial', reason: 'You asked for financial assistance.' },
  { id: 'accommodation', label: 'Accommodation assistance', dept: 'accommodation', reason: 'You asked for accommodation assistance.' },
  { id: 'career', label: 'Career guidance', dept: 'career', reason: 'You asked for career guidance.' },
  { id: 'accessibility', label: 'Accessibility support', dept: 'disability', reason: 'You asked for accessibility support.' },
  { id: 'safety', label: 'Safety assistance', dept: 'safety', reason: 'You asked for safety assistance.' },
  { id: 'unsure', label: 'Not sure', dept: null },
]

export const URGENCY = [
  { id: 'no', label: 'No' },
  { id: 'unsure', label: "I'm not sure" },
  { id: 'yes', label: 'Yes' },
]

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? id
