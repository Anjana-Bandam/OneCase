import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../state/CaseStore'
import { deptById } from '../data/departments'
import { Spinner, Stars, dayLabel, slotLabel } from './ui'

// Book (or move) a session with one department. Slot availability comes from the server:
// a slot another student holds shows "Taken", and a time you're already booked elsewhere shows "Busy".
export function SlotPicker({ c, task, onDone }) {
  const { getSlots, bookSlot } = useStore()
  const d = deptById(task.deptId)
  const current = c.bookings?.find((b) => b.taskId === task.id)
  const [data, setData] = useState(null)
  const [day, setDay] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [state, setState] = useState({})

  const load = useCallback(async () => {
    try {
      const r = await getSlots(c.caseId, task.id)
      setData(r)
      setDay((prev) => prev || (current ? current.start.slice(0, 10) : r.days.find((x) => x.slots.some((s) => s.state === 'free'))?.day) || r.days[0]?.day)
    } catch (e) {
      setState({ error: e.message })
    }
  }, [getSlots, c.caseId, task.id, current])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirm = async () => {
    setState({ busy: true })
    try {
      await bookSlot(c.caseId, task.id, chosen)
      onDone?.(`Booked: ${d.short}, ${slotLabel(chosen)}`)
    } catch (e) {
      // Someone may have taken it a moment ago: show why and refresh the grid.
      setState({ error: e.message })
      setChosen(null)
      load()
    }
  }

  if (!data) {
    return <div className="slot-picker">{state.error ? <p className="error-text">⚠️ {state.error}</p> : <Spinner label="Loading available times…" />}</div>
  }
  const shown = data.days.find((x) => x.day === day) || data.days[0]

  return (
    <div className="slot-picker">
      <div className="slot-head">
        <b>{current ? 'Move your session' : 'Book a session'} with {d.name}</b>
        <small>30-minute sessions. Each slot can be booked by only one student, and you can’t book two sessions at the same time.</small>
      </div>
      <div className="day-tabs" role="tablist">
        {data.days.map((x) => {
          const free = x.slots.filter((s) => s.state === 'free').length
          return (
            <button key={x.day} type="button" role="tab" aria-selected={x.day === shown.day} className={x.day === shown.day ? 'on' : ''} onClick={() => { setDay(x.day); setChosen(null) }}>
              <b>{dayLabel(x.day)}</b>
              <small>{free} free</small>
            </button>
          )
        })}
      </div>
      <div className="slot-grid">
        {shown.slots.map((s) => {
          const label =
            s.state === 'taken' ? 'Taken' : s.state === 'busy' ? `Busy: ${deptById(s.busyWith)?.short}` : s.state === 'yours' ? 'Your booking' : 'Free'
          return (
            <button
              key={s.start}
              type="button"
              className={`slot st-${s.state}${chosen === s.start ? ' chosen' : ''}`}
              disabled={s.state !== 'free'}
              onClick={() => setChosen(s.start)}
              title={s.state === 'taken' ? 'Another student has this slot' : s.state === 'busy' ? 'You have another session at this time' : ''}
            >
              <b>{s.start.slice(11)}</b>
              <small>{label}</small>
            </button>
          )
        })}
      </div>
      <div className="slot-legend">
        <span><i className="lg-free" /> Free</span>
        <span><i className="lg-taken" /> Taken by another student</span>
        <span><i className="lg-busy" /> Clashes with your other session</span>
      </div>
      {state.error && <p className="error-text">⚠️ {state.error}</p>}
      <div className="row gap wrap">
        <button type="button" className="btn btn-primary btn-sm" disabled={!chosen || state.busy} onClick={confirm}>
          {state.busy ? 'Booking…' : chosen ? `Confirm ${slotLabel(chosen)}` : 'Pick a time'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone?.()}>Close</button>
      </div>
    </div>
  )
}

// Star rating + comment for a department whose part of the support is complete.
export function ReviewForm({ c, task, existing, onDone }) {
  const { saveReview } = useStore()
  const [rating, setRating] = useState(existing?.rating || 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(existing?.comment || '')
  const [state, setState] = useState({})
  const words = ['', 'Poor', 'Could be better', 'Okay', 'Good', 'Excellent']

  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true })
    try {
      await saveReview(c.caseId, task.id, rating, comment)
      onDone?.('Thank you! Your review helps the team improve.')
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <b>How was your support from {deptById(task.deptId).name}?</b>
      <div className="star-input" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= (hover || rating) ? 'on' : ''}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
          >
            ★
          </button>
        ))}
        <small>{words[hover || rating]}</small>
      </div>
      <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything you’d like to tell the team? (optional)" maxLength={500} />
      {state.error && <p className="error-text">⚠️ {state.error}</p>}
      <div className="row gap">
        <button className="btn btn-primary btn-sm" type="submit" disabled={!rating || state.busy}>
          {state.busy ? 'Saving…' : existing ? 'Update review' : 'Submit review'}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onDone?.()}>Cancel</button>
      </div>
    </form>
  )
}

export function ReviewView({ review }) {
  return (
    <div className="review-view">
      <Stars value={review.rating} size="sm" />
      {review.comment && <span>“{review.comment}”</span>}
    </div>
  )
}
