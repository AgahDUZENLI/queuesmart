// Calls to the QueueSmart backend (backend/README.md lists every endpoint).

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Session token from login/register, sent on every request
let token = null

// Sends a request and returns the JSON body.
// Throws an Error with `fields` (per-field messages) when the backend says no.
async function request(method, path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = response.status === 204 ? {} : await response.json()
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.')
    error.fields = data.fields || {}
    error.status = response.status
    throw error
  }
  return data
}

// Demo accounts loaded by backend/src/demo.js
export const DEMO_USER = { email: 'user@queuesmart.test', password: 'demo-pass-123' }
export const DEMO_ADMIN = { email: 'admin@queuesmart.test', password: 'demo-pass-123' }

export async function login(email, password, role) {
  const data = await request('POST', '/api/auth/login', { email, password, role })
  token = data.token
  return data.user
}

export async function register(account) {
  const data = await request('POST', '/api/auth/register', account)
  token = data.token
  return data.user
}

export function signOut() {
  if (token) request('POST', '/api/auth/logout').catch(() => {})
  token = null
}

export const getSavedPlaces = () => request('GET', '/api/places/saved')
export const addPlace = (code) => request('POST', '/api/places/saved', { code })
export const removePlace = (placeId) => request('DELETE', `/api/places/saved/${placeId}`)
export const getMyPlace = () => request('GET', '/api/places/mine')
export const getServices = (placeId) => request('GET', `/api/services?placeId=${placeId}`)
export const createService = (service) => request('POST', '/api/services', service)
export const updateService = (serviceId, updates) => request('PUT', `/api/services/${serviceId}`, updates)
export const deleteService = (serviceId) => request('DELETE', `/api/services/${serviceId}`)

export const getMyQueueTicket = () => request('GET', '/api/queues/me')
export const joinQueue = (serviceId) => request('POST', `/api/queues/${serviceId}/join`)
export const leaveQueue = (ticketId) => request('DELETE', `/api/queues/tickets/${ticketId}`)
export const getAdminQueues = () => request('GET', '/api/queues/mine')
export const serveNext = (serviceId) => request('POST', `/api/queues/${serviceId}/next`)
export const completeServing = (serviceId) => request('POST', `/api/queues/${serviceId}/complete`)
export const markNoShow = (serviceId) => request('POST', `/api/queues/${serviceId}/no-show`)
export const updateQueueTicket = (serviceId, ticketId, updates) => request('PATCH', `/api/queues/${serviceId}/tickets/${ticketId}`, updates)
export const removeQueueTicket = (ticketId) => request('DELETE', `/api/queues/tickets/${ticketId}`)
export const getMyHistory = () => request('GET', '/api/history/me?limit=100')