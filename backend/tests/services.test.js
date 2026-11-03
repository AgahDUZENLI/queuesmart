const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const serviceRepo = require('../src/serviceRepo')
const userRepo = require('../src/userRepo')
const { loadDemoData } = require('../src/demo')

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
let placeId
let serviceId

function auth(response) {
  return { Authorization: `Bearer ${response.body.token}` }
}

async function createService(body = serviceBody, headers = adminAuth) {
  const response = await request(app).post('/api/services').set(headers).send(body)
  if (response.status === 201 && headers === adminAuth) serviceId = response.body.service.id
  return response
}

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
  adminAuth = auth(admin)
  userAuth = auth(user)
  placeId = admin.body.user.placeId
  serviceId = null
})

describe('database-backed services', () => {
  test('creates service and queue together and applies optional defaults', async () => {
    const response = await createService({ ...serviceBody, name: '  Advising  ', unknown: 'ignored' })
    expect(response.status).toBe(201)
    expect(response.body.service).toMatchObject({
      id: expect.any(Number),
      placeId,
      name: 'Advising',
      description: serviceBody.description,
      duration: 15,
      priority: 'Normal',
      maxInLine: 2,
      status: 'Open',
      opens: '09:00',
      closes: '16:30',
      appointments: false,
    })
    const { rows } = await db.query(
      'SELECT s.id, q.service_id FROM service s JOIN queue q ON q.service_id = s.id WHERE s.id = $1',
      [response.body.service.id],
    )
    expect(rows).toEqual([{ id: response.body.service.id, service_id: response.body.service.id }])
    expect(response.body.service.unknown).toBeUndefined()
  })

  test('validates input and protects management routes', async () => {
    expect((await createService({}, {})).status).toBe(401)
    expect((await createService({}, userAuth)).status).toBe(403)
    expect((await createService({})).body.fields).toEqual({
      name: 'Name is required.',
      description: 'Description is required.',
      duration: 'Duration is required.',
      priority: 'Priority is required.',
    })
    expect((await createService({ ...serviceBody, closes: '09:00' })).body.fields).toEqual({
      closes: 'Closing time must be after opening time.',
    })
  })

  test('lists services in priority order, gets by id, and persists updates', async () => {
    await createService(serviceBody)
    const low = await createService({ ...serviceBody, name: 'Career Coaching', priority: 'Low' })
    const high = await createService({ ...serviceBody, name: 'Counseling', priority: 'High' })
    const list = await request(app).get(`/api/services?placeId=${placeId}`)
    expect(list.body.services.map((service) => service.name)).toEqual(['Counseling', 'Academic Advising', 'Career Coaching'])
    expect((await request(app).get(`/api/services/${high.body.service.id}`)).body.service.name).toBe('Counseling')

    const updated = await request(app).put(`/api/services/${low.body.service.id}`).set(adminAuth).send({ priority: 'High' })
    expect(updated.body.service.priority).toBe('High')
    expect((await serviceRepo.findById(low.body.service.id)).priority).toBe('High')
  })

  test('rejects invalid updates and restricts services to their owning admin', async () => {
    await createService()
    const secondAdmin = await request(app).post('/api/auth/register').send({
      role: 'admin',
      firstName: 'Tia',
      lastName: 'Admin',
      placeName: 'Other place',
      email: 'other-admin@example.edu',
      password: 'correct-horse',
    })
    const otherAuth = auth(secondAdmin)
    expect((await request(app).put(`/api/services/${serviceId}`).set(adminAuth).send({ duration: 0 })).status).toBe(400)
    expect((await request(app).put(`/api/services/${serviceId}`).set(otherAuth).send({ status: 'Open' })).status).toBe(403)
    expect((await request(app).delete(`/api/services/${serviceId}`).set(otherAuth)).status).toBe(403)
    expect((await request(app).put('/api/services/999999').set(adminAuth).send({ status: 'Open' })).status).toBe(404)
  })

  test('soft-deletes the service, closes its queue and removes active entries without losing history', async () => {
    await createService()
    const user = await userRepo.findByEmail('user@example.edu')
    const joined = await request(app).post(`/api/queues/${serviceId}/join`).set(userAuth)
    const deleted = await request(app).delete(`/api/services/${serviceId}`).set(adminAuth)
    expect(deleted.status).toBe(204)

    const { rows } = await db.query(
      `SELECT s.deleted_at, q.status AS queue_status, e.status AS entry_status
       FROM service s JOIN queue q ON q.service_id = s.id
       JOIN queue_entry e ON e.queue_id = q.id WHERE s.id = $1`,
      [serviceId],
    )
    expect(rows[0].deleted_at).not.toBeNull()
    expect(rows[0]).toMatchObject({ queue_status: 'Closed', entry_status: 'removed' })
    const { rows: owners } = await db.query('SELECT user_id FROM queue_entry WHERE id = $1', [joined.body.ticket.id])
    expect(owners[0].user_id).toBe(user.id)
    expect((await request(app).get(`/api/services/${serviceId}`)).status).toBe(404)
    expect((await request(app).get('/api/queues/me').set(userAuth)).body.recent).toMatchObject({
      id: joined.body.ticket.id,
      status: 'removed',
      service: { name: serviceBody.name },
    })
    expect((await request(app).get('/api/history/me').set(userAuth)).body.history[0].serviceName).toBe(serviceBody.name)
  })

  test('demo services and accounts are persistent and seeded only once', async () => {
    await loadDemoData()
    await loadDemoData()
    expect((await serviceRepo.listAll()).filter((service) => service.placeId === 123456)).toHaveLength(6)
    expect(await userRepo.findByEmail('user4@queuesmart.test')).toMatchObject({
      email: 'user4@queuesmart.test',
      savedPlaceIds: [123456],
    })
  })
})
