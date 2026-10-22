const request = require('supertest')
const { createApp } = require('../src/app')
const { data, reset } = require('../src/data')
const { loadDemoData } = require('../src/demo')

const advising = {
  name: 'Academic Advising',
  description: 'Meet with an advisor about course planning.',
  duration: 15,
  priority: 'Normal',
}

let app
let adminAuth
let userAuth

beforeEach(async () => {
  reset()
  app = createApp()

  const admin = await request(app).post('/api/auth/register').send({
    role: 'admin', firstName: 'Ada', lastName: 'Admin', placeName: 'Help Desk', email: 'admin@example.edu', password: 'correct-horse',
  })
  const user = await request(app).post('/api/auth/register').send({
    firstName: 'Uma', lastName: 'User', email: 'user@example.edu', password: 'correct-horse',
  })
  adminAuth = { Authorization: `Bearer ${admin.body.token}` }
  userAuth = { Authorization: `Bearer ${user.body.token}` }
})

// Ids are random, so tests look them up instead of assuming 1, 2, 3
const firstId = () => data.services[0].id

const createService = (body, auth = adminAuth) => request(app).post('/api/services').set(auth).send(body)

describe('create', () => {
  test('admin creates a service; optional fields get defaults', async () => {
    const res = await createService({ ...advising, name: '  Academic Advising  ' })
    expect(res.status).toBe(201)
    expect(res.body.service).toEqual({
      id: expect.any(Number),
      placeId: data.places[0].id, // the admin's place
      ...advising,
      maxInLine: 25,
      status: 'Closed',
      opens: '09:00',
      closes: '16:30',
      appointments: false,
    })
  })

  test('ignores fields that are not part of a service', async () => {
    const res = await createService({ ...advising, id: 99, hacked: true })
    expect(res.body.service.id).not.toBe(99)
    expect(res.body.service.hacked).toBeUndefined()
  })

  test('400 when required fields are missing', async () => {
    const res = await createService({})
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual({
      name: 'Name is required.',
      description: 'Description is required.',
      duration: 'Duration is required.',
      priority: 'Priority is required.',
    })
  })

  test('400 for wrong types, lengths and values', async () => {
    const res = await createService({
      name: 'x'.repeat(101),
      description: 42,
      duration: '15',
      priority: 'Urgent',
      maxInLine: 0,
      status: 'Busy',
      opens: '9am',
      appointments: 'yes',
    })
    expect(res.body.fields).toEqual({
      name: 'Name must be 100 characters or less.',
      description: 'Description must be text.',
      duration: 'Duration must be a whole number.',
      priority: 'Priority must be one of: Low, Normal, High.',
      maxInLine: 'Max in line must be between 1 and 500.',
      status: 'Status must be one of: Open, Paused, Closed.',
      opens: 'Opening time must be a time like 09:00.',
      appointments: 'Allow appointments must be true or false.',
    })
  })

  test('400 when duration is out of range or not whole', async () => {
    expect((await createService({ ...advising, duration: 0 })).body.fields.duration).toBe('Duration must be between 1 and 480.')
    expect((await createService({ ...advising, duration: 481 })).body.fields.duration).toBe('Duration must be between 1 and 480.')
    expect((await createService({ ...advising, duration: 7.5 })).body.fields.duration).toBe('Duration must be a whole number.')
  })

  test('400 when closing time is not after opening time', async () => {
    const res = await createService({ ...advising, opens: '16:00', closes: '09:00' })
    expect(res.body.fields).toEqual({ closes: 'Closing time must be after opening time.' })
  })

  test('401 when signed out, 403 for regular users', async () => {
    expect((await createService(advising, {})).status).toBe(401)
    expect((await createService(advising, userAuth)).status).toBe(403)
  })
})

describe('places', () => {
  test('?placeId= lists only that place\'s services', async () => {
    await createService(advising)
    const other = await request(app).post('/api/auth/register').send({
      role: 'admin', firstName: 'Tia', lastName: 'Tires', placeName: 'Tire Shop', email: 'tires@example.edu', password: 'correct-horse',
    })
    await createService({ ...advising, name: 'Oil change' }, { Authorization: `Bearer ${other.body.token}` })

    const res = await request(app).get(`/api/services?placeId=${data.places[1].id}`)
    expect(res.body.services.map((s) => s.name)).toEqual(['Oil change'])
  })

  test('an admin cannot change or delete another place\'s service', async () => {
    await createService(advising)
    const other = await request(app).post('/api/auth/register').send({
      role: 'admin', firstName: 'Tia', lastName: 'Tires', placeName: 'Tire Shop', email: 'tires@example.edu', password: 'correct-horse',
    })
    const otherAuth = { Authorization: `Bearer ${other.body.token}` }

    expect((await request(app).put(`/api/services/${firstId()}`).set(otherAuth).send({ status: 'Open' })).status).toBe(403)
    expect((await request(app).delete(`/api/services/${firstId()}`).set(otherAuth)).status).toBe(403)
    expect(data.services[0].status).toBe('Closed')
  })
})

describe('list and get', () => {
  test('anyone can list services and get one by id', async () => {
    await createService(advising)
    await createService({ ...advising, name: 'Registrar' })

    const list = await request(app).get('/api/services')
    expect(list.body.services.map((s) => s.name)).toEqual(['Academic Advising', 'Registrar'])

    const one = await request(app).get(`/api/services/${data.services[1].id}`)
    expect(one.body.service.name).toBe('Registrar')
  })

  test('404 for an unknown id', async () => {
    expect((await request(app).get('/api/services/999')).status).toBe(404)
  })

  test('service priority puts High services first, then Normal, then Low', async () => {
    await createService({ ...advising, name: 'Career Coaching', priority: 'Low' })
    await createService({ ...advising, name: 'Registrar', priority: 'Normal' })
    await createService({ ...advising, name: 'Counseling', priority: 'High' })
    await createService({ ...advising, name: 'Academic Advising', priority: 'Normal' })
    const expected = ['Counseling', 'Academic Advising', 'Registrar', 'Career Coaching']

    const list = await request(app).get(`/api/services?placeId=${data.places[0].id}`)
    expect(list.body.services.map((s) => s.name)).toEqual(expected)
    // Staff see their queues in the same order
    const queues = await request(app).get('/api/queues/mine').set(adminAuth)
    expect(queues.body.services.map((s) => s.name)).toEqual(expected)

    // Raising a service's priority moves it up the list
    const coaching = data.services.find((s) => s.name === 'Career Coaching')
    await request(app).put(`/api/services/${coaching.id}`).set(adminAuth).send({ priority: 'High' })
    const updated = await request(app).get(`/api/services?placeId=${data.places[0].id}`)
    expect(updated.body.services.map((s) => s.name)).toEqual(['Career Coaching', 'Counseling', 'Academic Advising', 'Registrar'])
  })

  test('within a priority, the queue whose first person has waited longest comes first', async () => {
    await createService({ ...advising, name: 'Academic Advising' })
    await createService({ ...advising, name: 'Registrar' })
    await createService({ ...advising, name: 'Financial Aid' })
    await createService({ ...advising, name: 'Career Coaching', priority: 'Low' })
    // Adds a waiting ticket to a service, joined `minutesAgo` minutes ago
    const waitIn = (name, minutesAgo) => {
      const service = data.services.find((s) => s.name === name)
      data.queueEntries.push({
        id: data.queueEntries.length + 1, serviceId: service.id, placeId: service.placeId, userId: 0, ticket: 'X-001',
        priority: 'Normal', status: 'waiting', joinedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(), queueOrder: 0,
      })
    }
    waitIn('Academic Advising', 2)
    waitIn('Registrar', 10)
    waitIn('Registrar', 1)
    waitIn('Career Coaching', 60) // waited longest, but Low priority stays below Normal

    const list = await request(app).get(`/api/services?placeId=${data.places[0].id}`)
    // Registrar (10 min) before Advising (2 min); Financial Aid has nobody waiting, so it goes last in its group
    expect(list.body.services.map((s) => s.name)).toEqual(['Registrar', 'Academic Advising', 'Financial Aid', 'Career Coaching'])
  })
})

describe('update', () => {
  beforeEach(() => createService(advising))

  test('changes only the fields that are sent', async () => {
    const res = await request(app).put(`/api/services/${firstId()}`).set(adminAuth).send({ status: 'Open', duration: 20 })
    expect(res.status).toBe(200)
    expect(res.body.service).toMatchObject({ ...advising, status: 'Open', duration: 20 })
    expect(data.services[0].status).toBe('Open')
  })

  test('cannot change the id', async () => {
    const id = firstId()
    const res = await request(app).put(`/api/services/${id}`).set(adminAuth).send({ id: 5 })
    expect(res.body.service.id).toBe(id)
  })

  test('400 for invalid changes, and nothing is saved', async () => {
    const res = await request(app).put(`/api/services/${firstId()}`).set(adminAuth).send({ name: '', priority: 'Low' })
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual({ name: 'Name is required.' })
    expect(data.services[0]).toMatchObject({ name: 'Academic Advising', priority: 'Normal' })
  })

  test('404 for an unknown id, 403 for regular users', async () => {
    expect((await request(app).put('/api/services/999').set(adminAuth).send({})).status).toBe(404)
    expect((await request(app).put(`/api/services/${firstId()}`).set(userAuth).send({})).status).toBe(403)
  })
})

describe('delete', () => {
  test('admin deletes a service', async () => {
    await createService(advising)
    const id = firstId()
    expect((await request(app).delete(`/api/services/${id}`).set(adminAuth)).status).toBe(204)
    expect(data.services).toEqual([])
    expect((await request(app).delete(`/api/services/${id}`).set(adminAuth)).status).toBe(404)
  })

  test('403 for regular users', async () => {
    await createService(advising)
    expect((await request(app).delete(`/api/services/${firstId()}`).set(userAuth)).status).toBe(403)
  })

  test('keeps history: people in line are removed, finished visits stay with the service name', async () => {
    await createService({ ...advising, status: 'Open' })
    await createService({ ...advising, name: 'Registrar', status: 'Open' })
    const id = firstId()
    const other = await request(app).post('/api/auth/register').send({
      firstName: 'Max', lastName: 'Other', email: 'other@example.edu', password: 'correct-horse',
    })
    const otherAuth = { Authorization: `Bearer ${other.body.token}` }

    // Uma is served, Max is still waiting when the service is deleted
    await request(app).post(`/api/queues/${id}/join`).set(userAuth)
    await request(app).post(`/api/queues/${id}/next`).set(adminAuth)
    await request(app).post(`/api/queues/${id}/complete`).set(adminAuth)
    await request(app).post(`/api/queues/${id}/join`).set(otherAuth)
    await request(app).delete(`/api/services/${id}`).set(adminAuth)

    expect(data.queueEntries.map((entry) => entry.status)).toEqual(['served', 'removed'])
    const history = await request(app).get('/api/history/me').set(userAuth)
    expect(history.body.history[0]).toMatchObject({ serviceName: 'Academic Advising', status: 'served' })
    // Max's ticket shows as removed, and Max can join another queue
    expect((await request(app).get('/api/queues/me').set(otherAuth)).body.recent.status).toBe('removed')
    expect((await request(app).post(`/api/queues/${data.services[0].id}/join`).set(otherAuth)).status).toBe(201)
  })
})

test('demo data has valid accounts and the six sample services', async () => {
  reset()
  loadDemoData()
  expect(data.places.map((p) => p.id)).toEqual([123456, 234567, 345678])
  expect(data.users.find((u) => u.role === 'user').savedPlaceIds).toEqual([123456])
  expect(data.services.every((s) => s.placeId === 123456)).toBe(true)
  expect(data.services.map((s) => s.name)).toEqual([
    'Academic Advising', 'Financial Aid', 'Registrar', 'Counseling Intake', 'IT Help Desk', 'Career Coaching',
  ])
})
