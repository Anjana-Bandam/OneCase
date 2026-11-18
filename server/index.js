// OneCase server: SQLite-backed case API + 3 AI endpoints (the Groq key never reaches the browser).
import express from 'express'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEPARTMENTS, deptByName } from '../src/data/departments.js'
import { openDb, stats, DB_FILE } from './db.js'
import { api, authenticate, requireUser, HttpError } from './api.js'

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true })

const KEY = process.env.GROQ_API_KEY
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const IS_REASONING = /gpt-oss|qwen3/i.test(MODEL)
const PORT = process.env.PORT || 8787

async function groqJSON(system, user, { temperature = 0.3, maxTokens = 2000 } = {}) {
  if (!KEY) throw new HttpError(503, 'AI is not configured. Add GROQ_API_KEY to onecase/server/.env and restart.')
  let res
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        ...(IS_REASONING ? { reasoning_effort: /gpt-oss/i.test(MODEL) ? 'low' : 'none' } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    })
  } catch (e) {
    throw new HttpError(502, `Could not reach Groq (${e.name === 'TimeoutError' ? 'timed out' : 'network error'}).`)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `Groq returned ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  try {
    return JSON.parse(content)
  } catch {
    throw new HttpError(502, 'AI returned an unreadable response. Please try again.')
  }
}

const GUARDRAILS = `You support a university student-support team. Never diagnose medical or mental health conditions. Never promise outcomes. Be calm, respectful and concise. Respond with a single JSON object only.`

const app = express()
app.use(express.json({ limit: '200kb' }))
app.use('/api', authenticate)
app.use('/api', api)
// AI calls cost money: only logged-in users may use them.
app.use('/api/ai', requireUser())

app.get('/api/health', (_req, res) => {
  res.json({ ai: Boolean(KEY), provider: 'Groq', model: MODEL, db: { engine: 'SQLite', ...stats() } })
})

// 1) Intake triage: student's own words + answers -> relevant departments, priority, summary
app.post('/api/ai/triage', async (req, res, next) => {
  try {
    const { description = '', answers = {} } = req.body || {}
    const system = `${GUARDRAILS}
You are the intake assistant for "OneCase", a joined-up case management system. A student describes their situation once; you suggest which of these 12 university departments MAY be relevant:
${DEPARTMENTS.map((d) => `- ${d.name}`).join('\n')}

Rules:
- Use the exact department names above. Suggest 1 to 4 departments, only those clearly supported by what the student said.
- Each reason is ONE short sentence addressed to the student (e.g. "You mentioned falling behind on assignments.").
- priority is "Low", "Medium" or "High". Use "High" if there is any risk to safety or signs of crisis.
- urgent is true only if the student may need same-day attention.
- caseSummary: 1-2 neutral sentences in third person for support staff. No diagnosis, no speculation.
- title: a short case title of 2-5 words (e.g. "Academic stress + wellbeing").

JSON shape: {"departments":[{"name":"","reason":""}],"priority":"","urgent":false,"caseSummary":"","title":""}`
    const user = `Student's own words: """${String(description).slice(0, 2000)}"""
Form answers: ${JSON.stringify(answers)}`
    const out = await groqJSON(system, user)
    const seen = new Set()
    const departments = (Array.isArray(out.departments) ? out.departments : [])
      .map((d) => ({ dept: deptByName(d?.name), reason: String(d?.reason || '').slice(0, 240) }))
      .filter((d) => d.dept && !seen.has(d.dept.id) && seen.add(d.dept.id))
      .map((d) => ({ id: d.dept.id, reason: d.reason }))
    res.json({
      departments,
      priority: ['Low', 'Medium', 'High'].includes(out.priority) ? out.priority : 'Medium',
      urgent: Boolean(out.urgent),
      caseSummary: String(out.caseSummary || '').slice(0, 600),
      title: String(out.title || '').slice(0, 60),
      model: MODEL,
    })
  } catch (e) {
    next(e)
  }
})

// 2) Case brief: summarise the shared case for one department
app.post('/api/ai/brief', async (req, res, next) => {
  try {
    const { caseData, department } = req.body || {}
    if (!caseData || !department) throw new HttpError(400, 'caseData and department are required.')
    const system = `${GUARDRAILS}
You write short case briefs for staff in a joined-up student support system. The reader works in "${department}".
Focus on what THEIR team needs to know and do, and how their work connects with the other teams on the same case.
JSON shape: {"bullets":["","",""],"nextAction":"","watchOut":""}
- bullets: exactly 3 short bullet points (max 20 words each).
- nextAction: one concrete next step for ${department}.
- watchOut: one short coordination risk or dependency to be aware of, or "" if none.`
    const out = await groqJSON(system, `Case data: ${JSON.stringify(caseData).slice(0, 6000)}`)
    res.json({
      bullets: (Array.isArray(out.bullets) ? out.bullets : []).slice(0, 4).map(String),
      nextAction: String(out.nextAction || ''),
      watchOut: String(out.watchOut || ''),
      model: MODEL,
    })
  } catch (e) {
    next(e)
  }
})

// 3) Rewrite an internal staff note as a warm, student-friendly update
app.post('/api/ai/rewrite', async (req, res, next) => {
  try {
    const { note = '', department = '', studentName = '' } = req.body || {}
    if (!note.trim()) throw new HttpError(400, 'Write an internal note first.')
    const system = `${GUARDRAILS}
Rewrite an internal staff note from the "${department}" team into a message the student will read in their case tracker.
- 2-3 sentences, warm and plain English, addressed to ${String(studentName).split(' ')[0] || 'the student'} by first name.
- Remove internal jargon and sensitive clinical detail. Mention the next step if there is one.
JSON shape: {"message":""}`
    const out = await groqJSON(system, `Internal note: """${note.slice(0, 1500)}"""`, { temperature: 0.5 })
    res.json({ message: String(out.message || ''), model: MODEL })
  } catch (e) {
    next(e)
  }
})

// Production: serve the built React app (dist/) from this same server, so one Render service runs everything.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  // Client-side routes (React Router): any non-API GET returns index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(join(DIST, 'index.html'))
  })
}

app.use((err, _req, res, _next) => {
  const status = err.status || 500
  if (status >= 500) console.error('[server]', err.message)
  res.status(status).json({ error: err.message || 'Something went wrong.' })
})

const dbStats = await openDb()
console.log(`OneCase database: ${DB_FILE} (${dbStats.users} users, ${dbStats.cases} cases, ${dbStats.tasks} tasks)`)

app.listen(PORT, () => {
  console.log(`OneCase AI server on http://localhost:${PORT} (Groq model: ${MODEL}, key ${KEY ? 'loaded' : 'MISSING - add server/.env'})`)
})
