const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const { minutesBetween, buildStats } = require('../src/history')

const auth = (response) => ({ Authorization: `Bearer ${response.body.token}` })

let app
let userAuth
let otherUserAuth
let adminAuth
let otherAdminAuth
let serviceId

async function register(body) {
  return request(app).post('/api/auth/register').send({
    lastName: 'Test',
    password: 'correct-horse',
    ...body,
  })
}

async function addService(headers, name) {
  const result = await request(app).post('/api/services').set(headers).send({
    name,
    description: 'Queue history fixture.',
    duration: 15,
    priority: 'Normal',
    status: 'Open',
  })
  return result.body.service.id
}

beforeEach(async () => {
  app = createApp()
  const admin = await register({
    role: 'admin',
    firstName: 'Cara',
    placeName: 'Advising Office',
    email: 'admin@example.edu',
  })
  const otherAdmin = await register({
    role: 'admin',
    firstName: 'Dan',
    placeName: 'Clinic',
    email: 'other-admin@example.edu',
  })
  const user = await register({ firstName: 'Ada', email: 'ada@example.edu' })
  const otherUser = await register({ firstName: 'Bob', email: 'bob@example.edu' })
  adminAuth = auth(admin)
  otherAdminAuth = auth(otherAdmin)
  userAuth = auth(user)
  otherUserAuth = auth(otherUser)
  serviceId = await addService(adminAuth, 'Transcripts')
  const otherServiceId = await addService(otherAdminAuth, 'Checkup')
  const { rows: queues } = await db.query('SELECT id, service_id FROM queue')
  const queueByService = new Map(queues.map((queue) => [queue.service_id, queue.id]))
  const { rows: users } = await db.query('SELECT id, email FROM user_credentials')
  const userIds = new Map(users.map((row) => [row.email, row.id]))

  const fixture = [
    [1, queueByService.get(serviceId), userIds.get('ada@example.edu'), 'T-001', 'served', '2026-10-21T10:00:00Z', '2026-10-21T10:12:00Z', '2026-10-21T10:20:00Z'],
    [2, queueByService.get(serviceId), userIds.get('ada@example.edu'), 'T-002', 'left', '2026-10-21T11:00:00Z', null, null],
    [3, queueByService.get(serviceId), userIds.get('bob@example.edu'), 'T-003', 'waiting', '2026-10-21T11:30:00Z', null, null],
    [4, queueByService.get(otherServiceId), userIds.get('bob@example.edu'), 'C-001', 'no-show', '2026-10-21T09:00:00Z', '2026-10-21T09:30:00Z', null],
  ]
  for (const [id, queueId, userId, ticket, status, joinedAt, startedAt, completedAt] of fixture) {
    await db.query(
      `INSERT INTO queue_entry
        (id, queue_id, user_id, ticket, service_name, priority, position, status, joined_at, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'Normal', $1, $6, $7, $8, $9)`,
      [id, queueId, userId, ticket, ticket.startsWith('C') ? 'Checkup' : 'Transcripts', status, joinedAt, startedAt, completedAt],
    )
  }
})

describe('history helpers', () => {
  test('calculates whole, nonnegative minutes and handles missing timestamps', () => {
    expect(minutesBetween('2026-10-21T10:00:00.000Z', '2026-10-21T10:12:20.000Z')).toBe(12)
    expect(minutesBetween('2026-10-21T10:00:00.000Z', undefined)).toBeNull()
    expect(minutesBetween('2026-10-21T10:10:00.000Z', '2026-10-21T10:00:00.000Z')).toBe(0)
  })

  test('zeroes statistics for an empty history', () => {
    expect(buildStats([])).toMatchObject({ total: 0, served: 0, averageWaitMinutes: 0 })
  })
})

describe('database-backed history routes', () => {
  test('requires a user session and returns only the signed-in user tickets newest first', async () => {
    await request(app).get('/api/history/me').expect(401)
    await request(app).get('/api/history/me').set(adminAuth).expect(403)
    const response = await request(app).get('/api/history/me').set(userAuth).expect(200)
    expect(response.body.total).toBe(2)
    expect(response.body.history.map((item) => item.id)).toEqual([2, 1])
  })

  test('includes service/place/customer labels and wait time', async () => {
    const response = await request(app).get('/api/history/me').set(userAuth).expect(200)
    expect(response.body.history[1]).toMatchObject({
      serviceName: 'Transcripts',
      placeName: 'Advising Office',
      name: 'Ada Test',
      status: 'served',
      waitedMinutes: 12,
    })
    expect(response.body.history[0].waitedMinutes).toBeNull()
  })

  test('filters by status, validates query values, and applies limit with full total', async () => {
    expect((await request(app).get('/api/history/me?status=left').set(userAuth)).body.history.map((item) => item.id)).toEqual([2])
    const limited = await request(app).get('/api/history/me?limit=1').set(userAuth)
    expect(limited.body).toMatchObject({ total: 2, history: [{ id: 2 }] })
    expect((await request(app).get('/api/history/me?status=nope').set(userAuth)).status).toBe(400)
    expect((await request(app).get('/api/history/me?limit=2.5').set(userAuth)).status).toBe(400)
  })

  test('restricts admin history and statistics to their place', async () => {
    await request(app).get('/api/history').set(userAuth).expect(403)
    const ownHistory = await request(app).get('/api/history').set(adminAuth)
    expect(ownHistory.body.history.map((item) => item.id)).toEqual([3, 2, 1])
    expect(ownHistory.body.history[0].name).toBe('Bob Test')
    const stats = await request(app).get('/api/history/stats').set(adminAuth)
    expect(stats.body).toMatchObject({ total: 3, waiting: 1, served: 1, left: 1, averageWaitMinutes: 12 })
    const otherStats = await request(app).get('/api/history/stats').set(otherAdminAuth)
    expect(otherStats.body).toMatchObject({ total: 1, noShow: 1, averageWaitMinutes: 30 })
  })
})
