// Tiny client for the OneCase server. The login token is attached automatically.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let authToken = null
export const setAuthToken = (t) => {
  authToken = t || null
}

export async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Can’t reach the OneCase server. Is `npm run dev` running?')
  }
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`)
  return data
}
