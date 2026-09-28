import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestFromText } from './suggest'
import { aiTriage } from './ai'

const MIN_AI_CHARS = 30
const DEBOUNCE_MS = 1200

// Live department suggestions: instant keyword matches, refined by AI once typing pauses.
export function useLiveSuggestions(text) {
  const local = useMemo(() => suggestFromText(text), [text])
  const [ai, setAi] = useState({ status: 'idle', list: [], error: '' })
  const lastSent = useRef('')
  const reqId = useRef(0)

  useEffect(() => {
    const t = text.trim()
    if (t.length < MIN_AI_CHARS) {
      reqId.current++
      lastSent.current = ''
      setAi((s) => (s.status === 'idle' && s.list.length === 0 ? s : { status: 'idle', list: [], error: '' }))
      return
    }
    if (t === lastSent.current) return
    const timer = setTimeout(() => {
      const id = ++reqId.current
      lastSent.current = t
      setAi((s) => ({ ...s, status: 'loading' }))
      aiTriage({ description: t, answers: {} })
        .then((r) => id === reqId.current && setAi({ status: 'done', list: r.departments, error: '' }))
        .catch((e) => id === reqId.current && setAi((s) => ({ ...s, status: 'error', error: e.message })))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const suggested = useMemo(() => {
    const m = new Map()
    const get = (id) => m.get(id) || m.set(id, { id, reasons: [], keyword: false, ai: false }).get(id)
    local.forEach((s) => {
      const e = get(s.id)
      e.keyword = true
      e.reasons.push(s.reason)
    })
    ai.list.forEach((s) => {
      const e = get(s.id)
      e.ai = true
      if (s.reason) e.reasons.push(s.reason)
    })
    return [...m.values()]
  }, [local, ai.list])

  return { suggested, aiStatus: ai.status, aiError: ai.error }
}
