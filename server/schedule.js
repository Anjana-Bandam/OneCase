// Session slots every department offers: 30-minute sessions, Mon–Sat, 10:00–13:00 and 14:00–16:00
// (lunch 13:00–14:00), bookable from tomorrow for the next 6 working days.
// Times are local wall-clock strings ("2026-09-29T10:30"), the same on the server and in the browser.
export const SLOT_MINUTES = 30
export const SLOT_TIMES = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30']
export const BOOKING_DAYS = 6

const pad = (n) => String(n).padStart(2, '0')
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function upcomingDays(count = BOOKING_DAYS, from = new Date()) {
  const days = []
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  while (days.length < count) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) days.push(localDate(d)) // no Sunday sessions
  }
  return days
}

export function slotEnd(start) {
  const [h, m] = start.slice(11).split(':').map(Number)
  const t = h * 60 + m + SLOT_MINUTES
  return `${start.slice(0, 11)}${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

export function isBookableSlot(start, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(start))) return false
  const [day, time] = start.split('T')
  return upcomingDays(BOOKING_DAYS, now).includes(day) && SLOT_TIMES.includes(time)
}
