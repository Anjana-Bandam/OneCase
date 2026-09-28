// Roll number format: 1602-YY-BBB-NNN
//   1602 = college code · YY = year of joining · BBB = branch (733 CSE, 737 IT, 735 ECE) · NNN = 3-digit number
// e.g. 1602-24-733-005 = CSE student who joined in 2024, roll 005.
export const BRANCHES = { 733: 'CSE', 737: 'IT', 735: 'ECE' }
export const ROLL_PATTERN = /^1602-(\d{2})-(733|735|737)-(\d{3})$/
export const ROLL_HINT = '1602-YY-BBB-NNN · branch 733 CSE, 737 IT, 735 ECE · e.g. 1602-24-733-005'

export function parseRoll(roll = '') {
  const m = String(roll).trim().match(ROLL_PATTERN)
  if (!m) return null
  return { roll: m[0], joined: 2000 + Number(m[1]), branchCode: m[2], branch: BRANCHES[m[2]], number: m[3] }
}

export const ACTIVITY_TYPES = ['Hackathon', 'Coding contest', 'Tech fest', 'Workshop', 'Paper presentation']
