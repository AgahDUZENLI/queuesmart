const request = require('supertest')
const { createApp } = require('../src/app')
const { data, reset } = require('../src/data')

let app
let adminAuth
let userAuth
let code

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
  code = data.places[0].id // the place id is its join code

  await request(app).post('/api/services').set(adminAuth).send({
    name: 'Walk-in help', description: 'Quick questions.', duration: 10, priority: 'Normal',
  })
})

const addPlace = (body, auth = userAuth) => request(app).post('/api/places/saved').set(auth).send(body)

test('join codes are unique 6-digit numbers', async () => {
  for (let i = 0; i < 20; i++) {
    await request(app).post('/api/auth/register').send({
      role: 'admin', firstName: 'A', lastName: 'B', placeName: `Place ${i}`, email: `a${i}@example.edu`, password: 'correct-horse',
    })
  }
  const codes = data.places.map((p) => p.id)
  expect(new Set(codes).size).toBe(codes.length)
  codes.forEach((c) => expect(String(c)).toMatch(/^\d{6}$/))
})

describe('look up by code', () => {
  test('returns the place and its services', async () => {
    const res = await request(app).get(`/api/places/code/${code}`)
    expect(res.status).toBe(200)
    expect(res.body.place).toEqual({ id: code, name: 'Help Desk' })
    expect(res.body.services.map((s) => s.name)).toEqual(['Walk-in help'])
  })

  test('404 for an unknown code', async () => {
    expect((await request(app).get('/api/places/code/999999')).status).toBe(404)
    expect((await request(app).get('/api/places/code/abc')).status).toBe(404)
  })
})

describe('my places', () => {
  test('a user adds a place by code (typed as text) and sees it in their list', async () => {
    const res = await addPlace({ code: ` ${code} ` })
    expect(res.status).toBe(201)
    expect(res.body.place.name).toBe('Help Desk')
    expect(res.body.services).toHaveLength(1)

    const list = await request(app).get('/api/places/saved').set(userAuth)
    expect(list.body.places.map((p) => p.name)).toEqual(['Help Desk'])
  })

  test('adding the same place twice keeps one copy', async () => {
    await addPlace({ code })
    await addPlace({ code: String(code) })
    expect((await request(app).get('/api/places/saved').set(userAuth)).body.places).toHaveLength(1)
  })

  test('a user removes a place', async () => {
    await addPlace({ code })
    expect((await request(app).delete(`/api/places/saved/${code}`).set(userAuth)).status).toBe(204)
    expect((await request(app).get('/api/places/saved').set(userAuth)).body.places).toEqual([])
    // Removing it again, or a place that was never added, is a 404
    expect((await request(app).delete(`/api/places/saved/${code}`).set(userAuth)).status).toBe(404)
  })

  test('400 for a missing or invalid code, 404 for an unknown one', async () => {
    expect((await addPlace({})).body.fields).toEqual({ code: 'Code is required.' })
    expect((await addPlace({ code: '12345' })).body.fields).toEqual({ code: 'Code must be 6 digits.' })
    expect((await addPlace({ code: 'ABC123' })).body.fields).toEqual({ code: 'Code must be 6 digits.' })
    expect((await addPlace({ code: 999999 })).status).toBe(404)
  })

  test('401 when signed out, 403 for admins', async () => {
    expect((await addPlace({ code }, {})).status).toBe(401)
    expect((await addPlace({ code }, adminAuth)).status).toBe(403)
    expect((await request(app).get('/api/places/saved')).status).toBe(401)
  })

  test('admins have no saved places', async () => {
    expect((await request(app).get('/api/places/saved').set(adminAuth)).body.places).toEqual([])
    expect((await request(app).delete('/api/places/saved/1').set(adminAuth)).status).toBe(404)
  })
})

describe('admin place', () => {
  test('an admin gets their place, code and the QR link to share', async () => {
    const res = await request(app).get('/api/places/mine').set(adminAuth)
    expect(res.body).toEqual({
      place: { id: code, name: 'Help Desk' },
      joinLink: `http://localhost:5173/?code=${code}`,
    })
  })

  test('403 for regular users', async () => {
    expect((await request(app).get('/api/places/mine').set(userAuth)).status).toBe(403)
  })
})
