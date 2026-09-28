// Rule-based department recommendation. Always runs, even when AI is unavailable.
import { AREAS, HELP_TYPES, DURATIONS, IMPACTS, URGENCY, labelOf } from '../data/intake.js'
import { DEPARTMENTS } from '../data/departments.js'

const CRISIS = /suicid|kill myself|end my life|self[- ]?harm|hurt myself|no reason to live|want to die|can'?t go on/i

export const detectCrisis = (text = '') => CRISIS.test(text)

export function recommend(a) {
  const recs = new Map()
  const add = (dept, reason) => {
    if (!dept) return
    const r = recs.get(dept) || { id: dept, reasons: [] }
    if (!r.reasons.includes(reason)) r.reasons.push(reason)
    recs.set(dept, r)
  }
  const areaIds = [...new Set([...(a.areas || []), ...(a.multi === 'yes' ? a.extraAreas || [] : [])])]
  areaIds.forEach((id) => {
    const area = AREAS.find((x) => x.id === id)
    if (area) add(area.dept, area.reason)
  })
  ;(a.helpTypes || []).forEach((id) => {
    const h = HELP_TYPES.find((x) => x.id === id)
    if (h?.dept) add(h.dept, h.reason)
  })
  // Fallback only when nothing else points anywhere (no answers and no teams picked while typing).
  if (recs.size === 0 && !(a.deptPicks || []).length) add('affairs', 'Student Affairs can help work out the right support for you.')
  return [...recs.values()]
}

export function rulePriority(a) {
  const crisis = detectCrisis(a.description)
  if (a.urgent === 'yes' || crisis) return 'High'
  if (a.impact === 'significant' && (a.duration === 'weeks' || a.duration === 'month')) return 'High'
  if (a.impact === 'significant' || a.impact === 'moderate' || a.urgent === 'unsure') return 'Medium'
  return 'Low'
}

export function ruleIssueTitle(a) {
  const ids = [...new Set([...(a.areas || []), ...(a.multi === 'yes' ? a.extraAreas || [] : [])])]
  let issues = ids.map((id) => AREAS.find((x) => x.id === id)?.issue).filter(Boolean)
  // No area questions any more: describe the case from the teams the student chose.
  if (!issues.length) issues = (a.deptPicks || []).map((d) => AREAS.find((x) => x.dept === d)?.issue).filter(Boolean)
  return issues.length ? issues.slice(0, 3).join(' + ') : 'General support request'
}

export function ruleSummary(a) {
  const parts = [`Student reports: ${ruleIssueTitle(a).toLowerCase()}.`]
  if (a.duration) parts.push(`Ongoing: ${labelOf(DURATIONS, a.duration).toLowerCase()}.`)
  if (a.impact) parts.push(`Impact on studies/daily life: ${labelOf(IMPACTS, a.impact).toLowerCase()}.`)
  if (a.urgent) parts.push(`Needs urgent attention: ${labelOf(URGENCY, a.urgent).toLowerCase()}.`)
  return parts.join(' ')
}

export const PRIORITY_RANK = { Low: 0, Medium: 1, High: 2 }
export const maxPriority = (p1, p2) => (PRIORITY_RANK[p2] > PRIORITY_RANK[p1] ? p2 : p1)

// Readable answers for the AI prompt
export function readableAnswers(a) {
  const areaLabels = (ids = []) => ids.map((id) => labelOf(AREAS, id))
  return {
    teamsChosenByStudent: (a.deptPicks || []).map((id) => DEPARTMENTS.find((d) => d.id === id)?.name).filter(Boolean),
    mainAreas: areaLabels(a.areas),
    duration: a.duration ? labelOf(DURATIONS, a.duration) : null,
    impact: a.impact ? labelOf(IMPACTS, a.impact) : null,
    moreThanOneArea: a.multi || null,
    otherAreas: a.multi === 'yes' ? areaLabels(a.extraAreas) : [],
    preferredHelp: (a.helpTypes || []).map((id) => labelOf(HELP_TYPES, id)),
    alreadyContacted: a.contacted === 'yes' ? a.contactedDepts || [] : 'No',
    urgent: a.urgent ? labelOf(URGENCY, a.urgent) : null,
  }
}
