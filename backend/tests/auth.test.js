const request = require('supertest')
const express = require('express')
const { createApp } = require('../src/app')
const { data, reset } = require('../src/data')
const { requireAuth, requireAdmin } = require('../src/auth')

const ada = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.edu', password: 'correct-horse' }
const admin = { ...ada, email: 'boss@example.edu', role: 'admin', placeName: 'Help Desk' }

let app
beforeEach(() => {
  reset()
  app = createApp()
})

const register = (body) => request(app).post('/api/auth/register').send(body)
const login = (body) => request(app).post('/api/auth/login').send(body)

describe('register', () => {
  test('creates a user and returns a token, without the password', async () => {
    const res = await register(ada)
    expect(res.status).toBe(201)
    expect(res.body.user).toEqual({ id: expect.any(Number), role: 'user', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.edu', emailMe: true, savedPlaceIds: [] })
    expect(res.body.token).toEqual(expect.any(String))
  })

  test('stores a salted hash, never the plain password', async () => {
    await register(ada)
    await register({ ...ada, email: 'twin@example.edu' }) // same password
    const [first, second] = data.users.map((user) => user.password)
    expect(first).not.toContain(ada.password)
    expect(first).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(first).not.toBe(second) // different salt each time
  })

  test('creates an admin and their place; the place id is a 6-digit join code', async () => {
    const res = await register(admin)
    const placeId = res.body.user.placeId
    expect(res.body.user.role).toBe('admin')
    expect(placeId).toBeGreaterThanOrEqual(100000)
    expect(placeId).toBeLessThanOrEqual(999999)
    expect(data.places).toEqual([{ id: placeId, name: 'Help Desk' }])
  })

  test('trims names, lowercases the email and keeps emailMe', async () => {
    const res = await register({ ...ada, firstName: ' Ada ', email: 'ADA@Example.edu', emailMe: false })
    expect(res.body.user).toMatchObject({ firstName: 'Ada', email: 'ada@example.edu', emailMe: false })
  })

  test('400 lists every invalid field', async () => {
    const res = await register({ firstName: 7, email: 'bad', password: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual({
      firstName: 'First name must be text.',
      lastName: 'Last name is required.',
      email: 'Enter a valid email, like you@example.edu.',
      password: 'Password must be at least 8 characters.',
    })
  })

  test('400 when an admin has no place name, or the role is unknown', async () => {
    expect((await register({ ...admin, placeName: '' })).body.fields).toEqual({ placeName: 'Place name is required.' })
    expect((await register({ ...ada, role: 'owner' })).body.fields).toEqual({ role: 'Role must be user or admin.' })
  })

  test('400 when emailMe is not true or false', async () => {
    expect((await register({ ...ada, emailMe: 'yes' })).body.fields).toEqual({ emailMe: 'Email me must be true or false.' })
  })

  test('409 when the email is already registered', async () => {
    await register(ada)
    const res = await register({ ...ada, email: 'ADA@example.edu' })
    expect(res.status).toBe(409)
  })
})

describe('login', () => {
  beforeEach(async () => {
    await register(ada)
    await register(admin)
  })

  test('returns a token for correct credentials', async () => {
    const res = await login({ email: ada.email, password: ada.password })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(ada.email)
  })

  test('401 for a wrong password or unknown email', async () => {
    expect((await login({ email: ada.email, password: 'wrong-pass' })).status).toBe(401)
    expect((await login({ email: 'nobody@example.edu', password: 'wrong-pass' })).status).toBe(401)
  })

  test('400 for missing fields', async () => {
    const res = await login({})
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.fields)).toEqual(['email', 'password'])
  })

  test('checks the role when one is sent', async () => {
    expect((await login({ ...ada, role: 'admin' })).body.error).toBe('This is not an admin account.')
    expect((await login({ ...admin, role: 'user' })).body.error).toBe('This is not a user account.')
    expect((await login({ ...admin, role: 'admin' })).status).toBe(200)
  })

  test('400 for an unknown role', async () => {
    expect((await login({ ...ada, role: 'owner' })).body.fields).toEqual({ role: 'Role must be user or admin.' })
  })
})

describe('sessions', () => {
  test('/me returns the signed-in user, and logout ends the session', async () => {
    const { token } = (await register(ada)).body
    const auth = { Authorization: `Bearer ${token}` }

    expect((await request(app).get('/api/auth/me').set(auth)).body.user.email).toBe(ada.email)
    expect((await request(app).post('/api/auth/logout').set(auth)).status).toBe(204)
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401)
  })

  test('401 without a valid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer fake')).status).toBe(401)
  })

  test('requireAdmin lets admins through and blocks users', async () => {
    const userToken = (await register(ada)).body.token
    const adminToken = (await register(admin)).body.token
    const guarded = express().get('/admin-only', requireAuth, requireAdmin, (req, res) => res.json({ ok: true }))

    expect((await request(guarded).get('/admin-only').set('Authorization', `Bearer ${userToken}`)).status).toBe(403)
    expect((await request(guarded).get('/admin-only').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200)
  })
})

describe('app', () => {
  test('health check, 404 and bad JSON', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' })
    expect((await request(app).get('/api/nope')).status).toBe(404)
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Request body must be valid JSON.')
  })
})
