// AI calls go through the OneCase server (Groq runs server-side; the key never reaches the browser).
import { request } from './api'

const post = (path, body) => request(`/ai/${path}`, { method: 'POST', body })

export const aiTriage = (payload) => post('triage', payload)
export const aiBrief = (payload) => post('brief', payload)
export const aiRewrite = (payload) => post('rewrite', payload)

export async function aiHealth() {
  try {
    return await request('/health')
  } catch {
    return { ai: false, offline: true }
  }
}
