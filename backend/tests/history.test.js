const express = require('express')
const request = require('supertest')
const { data } = require('../src/data')
const { router, minutesBetween, buildStats } = require('../src/history')

const app = express()
app.use(express.json())
app.use('/api/history', router)

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeEach(() => {
  data.users.length = 0
  data.places.length = 0
  data.services.length = 0
  data.queueEntries.length = 0
  Object.keys(data.sessions).forEach((token) => delete data.sessions[token])

  data.users.push(
    { id: 1, role: 'user', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    { id: 2, role: 'user', firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' },
    { id: 3, role: 'admin', firstName: 'Cara', lastName: 'Admin', email: 'cara@example.com', placeId: 1 },
    { id: 4, role: 'admin', firstName: 'Dan', lastName: 'Admin', email: 'dan@example.com', placeId: 2 },
  )
  data.sessions['ada-token'] = 1
  data.sessions['bob-token'] = 2
  data.sessions['cara-token'] = 3
  data.sessions['dan-token'] = 4

  data.places.push({ id: 1, name: 'Advising Office' }, { id: 2, name: 'Clinic' })
  data.services.push(
    { id: 1, name: 'Transcripts', placeId: 1, duration: 10 },
    { id: 2, name: 'Checkup', placeId: 2, duration: 15 },
  )
  data.queueEntries.push(
    { id: 1, serviceId: 1, placeId: 1, userId: 1, ticket: 'T-001', priority: 'Normal', status: 'served', joinedAt: '2026-10-21T10:00:00.000Z', startedAt: '2026-10-21T10:12:00.000Z', completedAt: '2026-10-21T10:20:00.000Z', queueOrder: 0 },
    { id: 2, serviceId: 1, placeId: 1, userId: 1, ticket: 'T-002', priority: 'Normal', status: 'left', joinedAt: '2026-10-21T11:00:00.000Z', queueOrder: 0 },
    { id: 3, serviceId: 1, placeId: 1, userId: 2, ticket: 'T-003', priority: 'High', status: 'waiting', joinedAt: '2026-10-21T11:30:00.000Z', queueOrder: 1 },
    { id: 4, serviceId: 2, placeId: 2, userId: 2, ticket: 'C-001', priority: 'Normal', status: 'no-show', joinedAt: '2026-10-21T09:00:00.000Z', startedAt: '2026-10-21T09:30:00.000Z', queueOrder: 0 },
  )
})

describe('minutesBetween', () => {
  test('returns whole minutes', () => {
    expect(minutesBetween('2026-10-21T10:00:00.000Z', '2026-10-21T10:12:20.000Z')).toBe(12)
  })

  test('returns null when either time is missing', () => {
    expect(minutesBetween('2026-10-21T10:00:00.000Z', undefined)).toBeNull()
    expect(minutesBetween(undefined, '2026-10-21T10:00:00.000Z')).toBeNull()
  })

  test('never goes negative', () => {
    expect(minutesBetween('2026-10-21T10:10:00.000Z', '2026-10-21T10:00:00.000Z')).toBe(0)
  })
})

describe('buildStats', () => {
  test('is zeroed with no tickets', () => {
    expect(buildStats([])).toMatchObject({ total: 0, served: 0, averageWaitMinutes: 0 })
  })
})

describe('GET /api/history/me', () => {
  test('requires sign in', async () => {
    await request(app).get('/api/history/me').expect(401)
  })

  test('is not available to admins', async () => {
    await request(app).get('/api/history/me').set(auth('cara-token')).expect(403)
  })

  test('returns only the user\'s own tickets, newest first', async () => {
    const res = await request(app).get('/api/history/me').set(auth('ada-token')).expect(200)
    expect(res.body.total).toBe(2)
    expect(res.body.history.map((item) => item.id)).toEqual([2, 1])
  })

  test('includes service name, place name and wait time', async () => {
    const res = await request(app).get('/api/history/me').set(auth('ada-token')).expect(200)
    const served = res.body.history.find((item) => item.id === 1)
    expect(served).toMatchObject({ serviceName: 'Transcripts', placeName: 'Advising Office', status: 'served', waitedMinutes: 12 })
  })

  test('has a null wait time for tickets that were never called', async () => {
    const res = await request(app).get('/api/history/me').set(auth('ada-token')).expect(200)
    expect(res.body.history.find((item) => item.id === 2).waitedMinutes).toBeNull()
  })

  test('filters by status', async () => {
    const res = await request(app).get('/api/history/me?status=left').set(auth('ada-token')).expect(200)
    expect(res.body.history.map((item) => item.id)).toEqual([2])
  })

  test('applies the limit but keeps the full total', async () => {
    const res = await request(app).get('/api/history/me?limit=1').set(auth('ada-token')).expect(200)
    expect(res.body.history).toHaveLength(1)
    expect(res.body.total).toBe(2)
  })

  test('returns an empty list for a user with no tickets', async () => {
    data.queueEntries.length = 0
    const res = await request(app).get('/api/history/me').set(auth('ada-token')).expect(200)
    expect(res.body).toEqual({ total: 0, history: [] })
  })

  test.each([
    ['status=bogus', 'status'],
    ['limit=0', 'limit'],
    ['limit=101', 'limit'],
    ['limit=abc', 'limit'],
    ['limit=2.5', 'limit'],
  ])('rejects invalid filter %s', async (query, field) => {
    const res = await request(app).get(`/api/history/me?${query}`).set(auth('ada-token')).expect(400)
    expect(res.body.fields[field]).toBeTruthy()
  })
})

describe('GET /api/history (admin)', () => {
  test('is not available to regular users', async () => {
    await request(app).get('/api/history').set(auth('ada-token')).expect(403)
  })

  test('shows only tickets for the admin\'s own place', async () => {
    const res = await request(app).get('/api/history').set(auth('cara-token')).expect(200)
    expect(res.body.history.map((item) => item.id)).toEqual([3, 2, 1])
    const other = await request(app).get('/api/history').set(auth('dan-token')).expect(200)
    expect(other.body.history.map((item) => item.id)).toEqual([4])
  })

  test('includes the customer name', async () => {
    const res = await request(app).get('/api/history').set(auth('cara-token')).expect(200)
    expect(res.body.history.find((item) => item.id === 3).name).toBe('Bob Stone')
  })

  test('uses fallback labels for deleted services and users', async () => {
    data.queueEntries.push({ id: 5, serviceId: 99, placeId: 1, userId: 99, ticket: 'X-001', priority: 'Low', status: 'removed', joinedAt: '2026-10-21T12:00:00.000Z', queueOrder: 0 })
    const res = await request(app).get('/api/history?status=removed').set(auth('cara-token')).expect(200)
    expect(res.body.history[0]).toMatchObject({ serviceName: 'Removed service', name: 'Guest' })
  })

  test('rejects an invalid status', async () => {
    await request(app).get('/api/history?status=nope').set(auth('cara-token')).expect(400)
  })
})

describe('GET /api/history/stats (admin)', () => {
  test('is not available to regular users', async () => {
    await request(app).get('/api/history/stats').set(auth('ada-token')).expect(403)
  })

  test('summarizes the admin\'s own place', async () => {
    const res = await request(app).get('/api/history/stats').set(auth('cara-token')).expect(200)
    expect(res.body).toEqual({
      total: 3,
      waiting: 1,
      serving: 0,
      served: 1,
      left: 1,
      removed: 0,
      noShow: 0,
      averageWaitMinutes: 12,
    })
  })

  test('counts no-shows for the other place', async () => {
    const res = await request(app).get('/api/history/stats').set(auth('dan-token')).expect(200)
    expect(res.body).toMatchObject({ total: 1, noShow: 1, averageWaitMinutes: 30 })
  })
})