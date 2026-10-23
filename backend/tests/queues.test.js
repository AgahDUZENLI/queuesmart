const request = require('supertest')
const { createApp } = require('../src/app')
const { data, reset } = require('../src/data')
const { estimateWaitMinutes, minutesPerPerson, queueSummary } = require('../src/queues')

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

function authorization(response) {
  return 'Bearer ' + response.body.token
}

beforeEach(async () => {
  reset()
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
  const otherUser = await request(app).post('/api/auth/register').send({
    firstName: 'Max',
    lastName: 'Other',
    email: 'other@example.edu',
    password: 'correct-horse',
  })
  adminAuth = { Authorization: authorization(admin) }
  userAuth = { Authorization: authorization(user) }
  otherUserAuth = { Authorization: authorization(otherUser) }

  await request(app).post('/api/services').set(adminAuth).send(serviceBody)
})

const serviceId = () => data.services[0].id
const join = (auth = userAuth) => request(app).post(`/api/queues/${serviceId()}/join`).set(auth)

describe('joining and leaving a queue', () => {
  test('a user joins an open queue and receives a position and wait estimate', async () => {
    const res = await join()

    expect(res.status).toBe(201)
    expect(res.body.ticket).toMatchObject({
      serviceId: serviceId(),
      ticket: 'A-001',
      status: 'waiting',
      position: 1,
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      service: { duration: 15 },
    })
  })

  test('queue summaries include the number waiting and expected wait for a new arrival', async () => {
    await join()
    await join(otherUserAuth)

    const res = await request(app).get(`/api/services?placeId=${data.places[0].id}`)
    expect(res.body.services[0]).toMatchObject({ waiting: 2, wait: 30 })
  })

  test('a user can leave only their own active ticket', async () => {
    const ticket = (await join()).body.ticket

    expect((await request(app).delete(`/api/queues/tickets/${ticket.id}`).set(otherUserAuth)).status).toBe(403)
    expect((await request(app).delete(`/api/queues/tickets/${ticket.id}`).set(userAuth)).status).toBe(204)
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.ticket).toBeNull()
  })

  test('blocks duplicate tickets, closed services, full queues and users without a session', async () => {
    expect((await join({})).status).toBe(401)
    await join()
    expect((await join()).status).toBe(409)

    await request(app).put(`/api/services/${serviceId()}`).set(adminAuth).send({ status: 'Closed' })
    expect((await join(otherUserAuth)).status).toBe(409)

    await request(app).put(`/api/services/${serviceId()}`).set(adminAuth).send({ status: 'Open' })
    await join(otherUserAuth)
    expect((await request(app).post(`/api/queues/${serviceId()}/join`).set(adminAuth)).status).toBe(403)
    expect((await request(app).post('/api/queues/999999/join').set(otherUserAuth)).status).toBe(404)
  })

  test('rejects a ticket when the configured maximum is reached', async () => {
    await join()
    await join(otherUserAuth)
    const third = await request(app).post('/api/auth/register').send({
      firstName: 'Tia',
      lastName: 'Third',
      email: 'third@example.edu',
      password: 'correct-horse',
    })

    const res = await request(app).post(`/api/queues/${serviceId()}/join`)
      .set({ Authorization: authorization(third) })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('This queue is full.')
  })

  test('ticket numbers do not repeat after a user leaves and rejoins', async () => {
    const first = (await join()).body.ticket
    await request(app).delete(`/api/queues/tickets/${first.id}`).set(userAuth)
    const second = (await join()).body.ticket
    expect(second.ticket).toBe('A-002')
  })
})

describe('administrator queue management', () => {
  test('only admins can view queues, and admins only see their own services', async () => {
    await join()
    expect((await request(app).get('/api/queues/mine')).status).toBe(401)
    expect((await request(app).get('/api/queues/mine').set(userAuth)).status).toBe(403)

    const res = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(res.body.services).toHaveLength(1)
    expect(res.body.services[0]).toMatchObject({
      id: serviceId(),
      waiting: 1,
      queue: [{ ticket: 'A-001', name: 'Uma User', priority: 'Normal', position: 1 }],
      nowServing: null,
    })
  })

  test('admins can prioritize tickets and high priority is called first, preserving arrival order within a priority', async () => {
    const first = (await join()).body.ticket
    const second = (await join(otherUserAuth)).body.ticket

    const changed = await request(app).patch(`/api/queues/${serviceId()}/tickets/${second.id}`)
      .set(adminAuth).send({ priority: 'High' })
    expect(changed.status).toBe(200)
    expect(changed.body.queue.map((ticket) => ticket.ticket)).toEqual(['A-002', 'A-001'])

    const invalid = await request(app).patch(`/api/queues/${serviceId()}/tickets/${first.id}`)
      .set(adminAuth).send({ priority: 'Urgent' })
    expect(invalid.status).toBe(400)
    expect(invalid.body.fields.priority).toBe('Priority must be one of: Low, Normal, High.')
  })

  test('admins can change queue position within a priority group', async () => {
    const first = (await join()).body.ticket
    const second = (await join(otherUserAuth)).body.ticket
    const rejected = await request(app).patch(`/api/queues/${serviceId()}/tickets/${second.id}`)
      .set(adminAuth).send({ priority: 'High', position: 2 })
    expect(rejected.status).toBe(409)
    expect(data.queueEntries.find((entry) => entry.id === second.id).priority).toBe('Normal')

    const res = await request(app).patch(`/api/queues/${serviceId()}/tickets/${second.id}`)
      .set(adminAuth).send({ position: 1 })

    expect(res.status).toBe(200)
    expect(res.body.queue.map((ticket) => ticket.ticket)).toEqual(['A-002', 'A-001'])
    expect((await request(app).patch(`/api/queues/${serviceId()}/tickets/${second.id}`).set(adminAuth).send({ position: 0 })).status).toBe(400)
    expect((await request(app).patch(`/api/queues/${serviceId()}/tickets/${first.id}`).set(adminAuth).send({ position: 1.5 })).status).toBe(400)
  })

  test('admins can serve then complete the next ticket, updating the user estimate', async () => {
    const first = (await join()).body.ticket
    const second = (await join(otherUserAuth)).body.ticket

    const next = await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    expect(next.status).toBe(200)
    expect(next.body.ticket.ticket).toBe(first.ticket)
    expect((await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)).status).toBe(409)

    const secondCurrent = await request(app).get('/api/queues/me').set(otherUserAuth)
    expect(secondCurrent.body.ticket).toMatchObject({ status: 'waiting', peopleAhead: 1, estimatedWaitMinutes: 15 })
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.ticket.status).toBe('serving')

    expect((await request(app).post(`/api/queues/${serviceId()}/complete`).set(adminAuth)).body.ticket.status).toBe('served')
    expect((await request(app).get('/api/queues/me').set(userAuth)).body).toMatchObject({
      ticket: null,
      recent: { status: 'served', ticket: first.ticket },
    })
    expect((await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)).body.ticket.ticket).toBe(second.ticket)
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.ticket).toMatchObject({
      status: 'serving',
      position: 0,
      estimatedWaitMinutes: 0,
    })
  })

  test('admins can mark the person being served as a no-show', async () => {
    const first = (await join()).body.ticket
    await join(otherUserAuth)
    const noShow = () => request(app).post(`/api/queues/${serviceId()}/no-show`).set(adminAuth)

    expect((await noShow()).status).toBe(409) // nobody is being served yet
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    const res = await noShow()
    expect(res.status).toBe(200)
    expect(res.body.ticket).toMatchObject({ id: first.id, status: 'no-show' })
    expect(res.body.service.nowServing).toBeNull()

    // The user sees the outcome, the next person can be called, and users cannot do this
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.recent.status).toBe('no-show')
    expect((await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)).status).toBe(200)
    expect((await request(app).post(`/api/queues/${serviceId()}/no-show`).set(userAuth)).status).toBe(403)
  })

  test('admins can remove a ticket and cannot manage another place', async () => {
    const ticket = (await join()).body.ticket
    expect((await request(app).delete(`/api/queues/tickets/${ticket.id}`).set(adminAuth)).status).toBe(204)

    const otherAdmin = await request(app).post('/api/auth/register').send({
      role: 'admin',
      firstName: 'Tia',
      lastName: 'Admin',
      placeName: 'Other Place',
      email: 'other-admin@example.edu',
      password: 'correct-horse',
    })
    const response = await request(app).post('/api/services')
      .set({ Authorization: authorization(otherAdmin) })
      .send({ ...serviceBody, name: 'Different service' })
    const otherServiceId = response.body.service.id
    expect((await request(app).post(`/api/queues/${otherServiceId}/next`).set(adminAuth)).status).toBe(403)
  })
})

describe('learning visit length from real visits', () => {
  // Adds a finished visit that took `minutes`. It ends at noon `daysAgo` days ago,
  // plus `order` minutes, so tests never cross midnight.
  function addServedVisit(minutes, { status = 'served', daysAgo = 0, order = 0 } = {}) {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    noon.setDate(noon.getDate() - daysAgo)
    const end = noon.getTime() + order * 60000
    data.queueEntries.push({
      id: data.queueEntries.length + 1,
      serviceId: serviceId(),
      placeId: data.places[0].id,
      userId: 0,
      ticket: 'X-000',
      priority: 'Normal',
      status,
      joinedAt: new Date(end - (minutes + 5) * 60000).toISOString(),
      startedAt: new Date(end - minutes * 60000).toISOString(),
      completedAt: new Date(end).toISOString(),
      queueOrder: 0,
    })
  }

  test('uses the expected duration until real visits are measured', () => {
    expect(minutesPerPerson(data.services[0])).toBe(15)
    expect(queueSummary(data.services[0])).toMatchObject({ averageDuration: 15, measuredVisits: 0 })
  })

  test('averages real visits, filling missing ones with the expected duration', () => {
    addServedVisit(5)
    addServedVisit(5)
    // (5 + 5 + 15 + 15 + 15) / 5 = 11
    expect(minutesPerPerson(data.services[0])).toBe(11)
    expect(estimateWaitMinutes(data.services[0], 3)).toBe(33)
  })

  test('only the 5 most recent visits count', () => {
    addServedVisit(60, { order: -120 })
    for (let i = 0; i < 5; i += 1) addServedVisit(4, { order: i })
    expect(minutesPerPerson(data.services[0])).toBe(4)
    expect(queueSummary(data.services[0]).measuredVisits).toBe(5)
  })

  test('starts each day again from the set duration', () => {
    for (let i = 0; i < 5; i += 1) addServedVisit(4, { daysAgo: 1, order: i })
    expect(minutesPerPerson(data.services[0])).toBe(15)
    expect(queueSummary(data.services[0]).measuredVisits).toBe(0)

    addServedVisit(5)
    // Yesterday's visits are ignored: (5 + 15 * 4) / 5 = 13
    expect(minutesPerPerson(data.services[0])).toBe(13)
  })

  test('no-shows and people who left are not measured', () => {
    addServedVisit(2, { status: 'no-show' })
    addServedVisit(2, { status: 'left' })
    expect(minutesPerPerson(data.services[0])).toBe(15)
  })

  test('completing a ticket updates the estimate for everyone still waiting', async () => {
    await join()
    await join(otherUserAuth)
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    // Pretend the first visit started 5 minutes ago
    data.queueEntries.find((entry) => entry.status === 'serving').startedAt = new Date(Date.now() - 5 * 60000).toISOString()
    await request(app).post(`/api/queues/${serviceId()}/complete`).set(adminAuth)

    // (5 + 15 * 4) / 5 = 13 minutes per person, 1 person waiting
    const res = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(res.body.services[0]).toMatchObject({ waiting: 1, wait: 13, averageDuration: 13, measuredVisits: 1 })
    expect((await request(app).get('/api/queues/me').set(otherUserAuth)).body.ticket.peopleAhead).toBe(0)
  })
})

describe('wait estimate counts down during the current visit', () => {
  // Pretend the person being served was called `minutes` ago
  function startedMinutesAgo(minutes) {
    const serving = data.queueEntries.find((entry) => entry.status === 'serving')
    serving.startedAt = new Date(Date.now() - minutes * 60000).toISOString()
  }

  beforeEach(async () => {
    await join()
    await join(otherUserAuth)
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
  })

  test('the time already spent is taken off the next person\'s wait', async () => {
    startedMinutesAgo(10)
    const res = await request(app).get('/api/queues/me').set(otherUserAuth)
    expect(res.body.ticket).toMatchObject({ peopleAhead: 1, estimatedWaitMinutes: 5 })

    const services = await request(app).get(`/api/services?placeId=${data.places[0].id}`)
    expect(services.body.services[0].wait).toBe(20) // 5 left + 15 for the person waiting
  })

  test('a visit that runs over still counts as 1 minute left', async () => {
    startedMinutesAgo(30)
    const res = await request(app).get('/api/queues/me').set(otherUserAuth)
    expect(res.body.ticket.estimatedWaitMinutes).toBe(1)
  })

  test('the person being served has no wait left', async () => {
    const res = await request(app).get('/api/queues/me').set(userAuth)
    expect(res.body.ticket).toMatchObject({ status: 'serving', estimatedWaitMinutes: 0 })
  })

  test('admins see how long the current visit has run and about how long is left', async () => {
    startedMinutesAgo(10)
    const res = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(res.body.services[0].nowServing).toMatchObject({ minutesIn: 10, minutesLeft: 5 })
  })
})
