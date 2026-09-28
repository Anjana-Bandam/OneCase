// Instant, offline department suggestions from the student's own words.
// Runs on every keystroke; the AI refines these a moment later.
const RULES = [
  { id: 'counseling', re: /\b(stress(ed|ful)?|anxi(ety|ous)|depress\w*|overwhelm\w*|panic\w*|burn ?out|burnt out|can'?t sleep|not sleeping|insomnia|self[- ]doubt|doubt(ing)? myself|hopeless|mental health|crying|low mood|sad(ness)?|worried|pressure|demotivated|no motivation)\b/i },
  { id: 'academic', re: /\b(class(es)?|lectures?|exams?|mid[- ]?sems?|internals?|study(ing)?|studies|revis\w*|assignments?|attendance|marks|grades?|backlogs?|syllabus|fail(ing|ed)?|focus|concentrat\w*|falling behind|detain\w*|lab sessions?|cgpa|sgpa)\b/i },
  { id: 'medical', re: /\b(fever|sick|ill(ness)?|pain|headaches?|injur\w*|health|doctor|stomach|vomit\w*|asthma|hospital|medicines?|loose motions?|allerg\w*)\b/i },
  { id: 'financial', re: /\b(fees?|money|afford\w*|loans?|scholarships?|pay(ing)? (the |my )?fees?|payments?|financial\w*|expens\w*|debt|lost (his|her|their) job|shop (has been )?closed|can'?t pay)\b/i },
  { id: 'accommodation', re: /\b(hostel|roommates?|room|warden|mess food|accommodation|pg|day scholar|commut\w*|travel(l?ing)?|hours? (of )?travel|far from (the )?college|college bus)\b/i },
  { id: 'disability', re: /\b(dyslexi\w*|disabilit\w*|wheelchair|hearing|visual(ly)? impair\w*|impair\w*|adhd|autis\w*|scribe|extra time|accessib\w*)\b/i },
  { id: 'career', re: /\b(careers?|jobs?|internships?|placements?|resume|cv|interviews?|hackathons?|competitions?|startup|future plans?)\b/i },
  { id: 'international', re: /\b(visa|frro|passport|international student|foreign national|homesick)\b/i },
  { id: 'affairs', re: /\b(bonafide|id card|certificates?|clubs?|bus pass|student affairs)\b/i },
  { id: 'safety', re: /\b(unsafe|harass\w*|ragging|threat\w*|stalk\w*|bull(y|ied|ying)|abuse\w*|attack\w*|pushed me|hit me|scared to go)\b/i },
  { id: 'peer', re: /\b(lonely|loneliness|alone|no friends|isolated|homesick|fit in|left out|don'?t know anyone)\b/i },
  { id: 'legal', re: /\b(complain\w*|grievance|unfair\w*|discriminat\w*|injustice|appeal)\b/i },
]

export function suggestFromText(text = '') {
  if (text.trim().length < 8) return []
  return RULES.map((r) => {
    const m = text.match(r.re)
    return m ? { id: r.id, reason: `You mentioned “${m[0].toLowerCase()}”.`, at: m.index } : null
  })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .map(({ id, reason }) => ({ id, reason }))
}
