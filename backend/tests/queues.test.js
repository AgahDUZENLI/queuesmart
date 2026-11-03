const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const userRepo = require('../src/userRepo')

const serviceBody = {
  name: 'Academic Advising',
  description: 'Course planning and academic goals.',
  duration: 15,
  priority: 'Normal',
  maxInLine: 2,
  status: 'Open',
}

let app
let adminAuth
let userAuth
let otherUserAuth
let serviceId
let placeId

const auth = (response) => ({ Authorization: `Bearer ${response.body.token}` })
const join = (headers = userAuth) => request(app).post(`/api/queues/${serviceId}/join`).set(headers)

beforeEach(async () => {
  app = createApp()
  const admin = await request(app).post('/api/auth/register').send({
    role: 'admin',
    firstName: 'Ada',
    lastName: 'Admin',
    placeName: 'Help Desk',
    email: 'admin@example.edu',
    password: 'correct-horse',
  })
  const user = await request(app).post('/api/auth/register').send({
    firstName: 'Uma',
    lastName: 'User',
    email: 'user@example.edu',
    password: 'correct-horse',
  })
  const other = await request(app).post('/api/auth/register').send({
    firstName: 'Max',
    lastName: 'Other',
    email: 'other@example.edu',
    password: 'correct-horse',
  })
  adminAuth = auth(admin)
  userAuth = auth(user)
  otherUserAuth = auth(other)
  placeId = admin.body.user.placeId
  const service = await request(app).post('/api/services').set(adminAuth).send(serviceBody)
  serviceId = service.body.service.id
})

describe('database-backed queue lifecycle', () => {
  test('joins a queue, persists the entry, and computes position and wait estimates', async () => {
    const first = await join()
    const second = await join(otherUserAuth)
    expect(first.status).toBe(201)
    expect(first.body.ticket).toMatchObject({
      serviceId,
      ticket: 'A-001',
      status: 'waiting',
      position: 1,
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      service: { duration: 15 },
    })
    expect(second.body.ticket).toMatchObject({
      ticket: 'A-002',
      position: 2,
      peopleAhead: 1,
      estimatedWaitMinutes: 15,
    })

    const { rows } = await db.query(
      `SELECT e.user_id, e.status, q.service_id
       FROM queue_entry e JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text)
       WHERE q.service_id = $1 ORDER BY e.position`,
      [serviceId],
    )
    expect(rows).toEqual([
      { user_id: (await userRepo.findByEmail('user@example.edu')).id, status: 'waiting', service_id: serviceId },
      { user_id: (await userRepo.findByEmail('other@example.edu')).id, status: 'waiting', service_id: serviceId },
    ])
    const services = await request(app).get(`/api/services?placeId=${placeId}`)
    expect(services.body.services[0]).toMatchObject({ waiting: 2, wait: 30 })
  })

  test('rejects duplicate tickets, closed services, full queues, and unauthorized joins', async () => {
    expect((await join({})).status).toBe(401)
    await join()
    expect((await join()).status).toBe(409)
    await request(app).put(`/api/services/${serviceId}`).set(adminAuth).send({ status: 'Closed' })
    expect((await join(otherUserAuth)).status).toBe(409)
    await request(app).put(`/api/services/${serviceId}`).set(adminAuth).send({ status: 'Open' })
    await join(otherUserAuth)
    const third = await request(app).post('/api/auth/register').send({
      firstName: 'Tia',
      lastName: 'Third',
      email: 'third@example.edu',
      password: 'correct-horse',
    })
    expect((await join(auth(third))).body.error).toBe('This queue is full.')
    expect((await join(adminAuth)).status).toBe(403)
    expect((await request(app).post('/api/queues/999999/join').set(userAuth)).status).toBe(404)
  })

  test('leaves own ticket, rejects another user, and keeps ticket numbering across rejoin', async () => {
    const first = (await join()).body.ticket
    expect((await request(app).delete(`/api/queues/tickets/${first.id}`).set(otherUserAuth)).status).toBe(403)
    expect((await request(app).delete(`/api/queues/tickets/${first.id}`).set(userAuth)).status).toBe(204)
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.ticket).toBeNull()
    const second = await join()
    expect(second.body.ticket.ticket).toBe('A-002')
    const { rows } = await db.query('SELECT status FROM queue_entry WHERE id = $1', [first.id])
    expect(rows[0].status).toBe('left')
  })

  test('admins prioritize and reorder waiting tickets within the same priority group', async () => {
    const first = (await join()).body.ticket
    const second = (await join(otherUserAuth)).body.ticket
    const rejected = await request(app).patch(`/api/queues/${serviceId}/tickets/${second.id}`)
      .set(adminAuth).send({ priority: 'High', position: 2 })
    expect(rejected.status).toBe(409)

    const changed = await request(app).patch(`/api/queues/${serviceId}/tickets/${second.id}`)
      .set(adminAuth).send({ priority: 'High', position: 1 })
    expect(changed.status).toBe(200)
    expect(changed.body.queue.map((ticket) => ticket.ticket)).toEqual(['A-002', 'A-001'])
    expect((await request(app).patch(`/api/queues/${serviceId}/tickets/${first.id}`)
      .set(adminAuth).send({ priority: 'Urgent' })).status).toBe(400)
    expect((await request(app).patch(`/api/queues/${serviceId}/tickets/${first.id}`)
      .set(adminAuth).send({ position: 1.5 })).status).toBe(400)

    const next = await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)
    expect(next.body.ticket.ticket).toBe('A-002')
  })

  test('serves, completes, and records the user history and queue lifecycle', async () => {
    const first = (await join()).body.ticket
    const second = (await join(otherUserAuth)).body.ticket
    expect((await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)).body.ticket.ticket).toBe(first.ticket)
    expect((await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)).status).toBe(409)
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.ticket)
      .toMatchObject({ status: 'waiting', peopleAhead: 1, estimatedWaitMinutes: 15 })
    expect((await request(app).post(`/api/queues/${serviceId}/complete`).set(adminAuth)).body.ticket.status).toBe('served')
    expect((await request(app).get('/api/queues/me').set(userAuth)).body)
      .toMatchObject({ ticket: null, recent: { status: 'served', ticket: first.ticket } })
    expect((await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)).body.ticket.ticket).toBe(second.ticket)
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.ticket)
      .toMatchObject({ status: 'serving', position: 0, estimatedWaitMinutes: 0 })

    const { rows } = await db.query('SELECT status FROM queue_entry WHERE id = $1', [first.id])
    expect(rows[0].status).toBe('served')
    expect((await request(app).get('/api/history/me').set(userAuth)).body.history[0])
      .toMatchObject({ status: 'served', serviceName: serviceBody.name })
  })

  test('admin queue view is scoped to the admin place and supports no-show and removal', async () => {
    const ticket = (await join()).body.ticket
    const queues = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(queues.body.services).toHaveLength(1)
    expect(queues.body.services[0]).toMatchObject({
      id: serviceId,
      waiting: 1,
      queue: [{ id: ticket.id, ticket: 'A-001', name: 'Uma User', position: 1 }],
    })
    expect((await request(app).delete(`/api/queues/tickets/${ticket.id}`).set(adminAuth)).status).toBe(204)
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.recent.status).toBe('removed')

    await join(otherUserAuth)
    await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)
    expect((await request(app).post(`/api/queues/${serviceId}/no-show`).set(adminAuth)).body.ticket.status).toBe('no-show')
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.recent.status).toBe('no-show')
  })

  test('wait estimates learn from served visits and count down during service', async () => {
    await join()
    await join(otherUserAuth)
    await request(app).post(`/api/queues/${serviceId}/next`).set(adminAuth)
    const { rows: entries } = await db.query(
      "SELECT id, started_at FROM queue_entry WHERE status = 'serving'",
    )
    const startedAt = new Date(Date.now() - 10 * 60000).toISOString()
    await db.query('UPDATE queue_entry SET started_at = $2 WHERE id = $1', [entries[0].id, startedAt])
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.ticket.estimatedWaitMinutes).toBe(5)
    expect((await request(app).get(`/api/services?placeId=${placeId}`)).body.services[0].wait).toBe(20)

    await request(app).post(`/api/queues/${serviceId}/complete`).set(adminAuth)
    const summary = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(summary.body.services[0]).toMatchObject({ waiting: 1, averageDuration: 14, measuredVisits: 1 })
  })
})
