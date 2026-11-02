const request = require('supertest')
const express = require('express')
const { createApp } = require('../src/app')
const db = require('../src/db')
const users = require('../src/userRepo')
const { requireAuth, requireAdmin, hashPassword, passwordMatches } = require('../src/auth')

const ada = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.edu', password: 'correct-horse' }
const admin = { ...ada, email: 'boss@example.edu', role: 'admin', placeName: 'Help Desk' }

let app
beforeEach(() => {
  app = createApp() // the empty database is restored by tests/setup.js
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
    const { rows } = await db.query('SELECT password_hash FROM user_credentials ORDER BY id')
    const [first, second] = rows.map((row) => row.password_hash)
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
    const { rows } = await db.query('SELECT id, name FROM place')
    expect(rows).toEqual([{ id: placeId, name: 'Help Desk' }])
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

describe('database', () => {
  test('register writes a credentials row and a profile row', async () => {
    const { user } = (await register(ada)).body
    const credentials = (await db.query('SELECT * FROM user_credentials WHERE id = $1', [user.id])).rows[0]
    const profile = (await db.query('SELECT * FROM user_profile WHERE user_id = $1', [user.id])).rows[0]
    expect(credentials).toMatchObject({ email: 'ada@example.edu', role: 'user' })
    expect(profile).toMatchObject({ email: 'ada@example.edu', first_name: 'Ada', last_name: 'Lovelace', email_me: true, place_id: null })
  })

  test('data survives across requests: a new login finds the stored account', async () => {
    await register(ada)
    const res = await login({ email: 'ADA@example.edu', password: ada.password })
    expect(res.body.user).toMatchObject({ firstName: 'Ada', email: 'ada@example.edu', savedPlaceIds: [] })
  })

  test('sessions are stored in the session table and removed on logout', async () => {
    const { token } = (await register(ada)).body
    expect((await db.query('SELECT token FROM session')).rows).toEqual([{ token }])
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    expect((await db.query('SELECT token FROM session')).rows).toEqual([])
  })

  test('the UNIQUE constraint on email rejects a duplicate even without the route check', async () => {
    await register(ada)
    await expect(
      users.createUser({ role: 'user', firstName: 'Eve', lastName: 'Two', email: 'ada@example.edu', passwordHash: 'x', emailMe: true }),
    ).rejects.toBeInstanceOf(users.EmailTakenError)
  })

  test('a failed registration is wrapped in a transaction: BEGIN, then ROLLBACK, never COMMIT', async () => {
    // pg-mem cannot undo rows on ROLLBACK (real PostgreSQL does), so check the statements sent instead
    await register(ada)
    const statements = []
    const realConnect = db.connect
    jest.spyOn(db, 'connect').mockImplementation(async () => {
      const client = await realConnect()
      const realQuery = client.query.bind(client)
      client.query = (text, params) => (statements.push(String(text).trim().split(' ')[0]), realQuery(text, params))
      return client
    })
    await register({ ...admin, email: 'ada@example.edu' }) // 409: inserts a place, then fails on the duplicate email
    jest.restoreAllMocks()
    expect(statements[0]).toBe('BEGIN')
    expect(statements).toContain('ROLLBACK')
    expect(statements).not.toContain('COMMIT')
  })

  test('the database refuses an unknown role, a missing email and an over-long name', async () => {
    const insert = (role, email) => db.query('INSERT INTO user_credentials (id, email, password_hash, role) VALUES (999999, $1, $2, $3)', [email, 'x', role])
    await expect(insert('owner', 'a@example.edu')).rejects.toThrow()
    await expect(insert('user', null)).rejects.toThrow()
    await register(ada)
    const { rows } = await db.query('SELECT id FROM user_credentials')
    await expect(
      db.query('INSERT INTO user_profile (user_id, email, first_name, last_name) VALUES ($1, $2, $3, $4)', [rows[0].id, 'z@example.edu', 'x'.repeat(51), 'Y']),
    ).rejects.toThrow()
  })

  test('admins can be given a fixed join code, but a request cannot choose one', async () => {
    const fixed = await users.createUser({ role: 'admin', firstName: 'A', lastName: 'B', email: 'fixed@example.edu', passwordHash: 'x', emailMe: true, placeName: 'Fixed', placeId: 123456 })
    expect(fixed.placeId).toBe(123456)
    const res = await register({ ...admin, email: 'other@example.edu', placeId: 111111 })
    expect(res.body.user.placeId).not.toBe(111111)
  })

  test('saved places are returned with a user and not duplicated', async () => {
    const boss = (await register(admin)).body.user
    const { user } = (await register(ada)).body
    await users.savePlace(user.id, boss.placeId)
    await users.savePlace(user.id, boss.placeId)
    expect((await users.findById(user.id)).savedPlaceIds).toEqual([boss.placeId])
  })

  test('findByEmail and findById return null for unknown accounts', async () => {
    expect(await users.findByEmail('nobody@example.edu')).toBeNull()
    expect(await users.findById(424242)).toBeNull()
  })

  test('createUser gives up with an error if ids keep colliding', async () => {
    jest.spyOn(require('crypto'), 'randomInt').mockReturnValue(555555)
    await users.createUser({ role: 'user', firstName: 'A', lastName: 'B', email: 'one@example.edu', passwordHash: 'x', emailMe: true })
    await expect(
      users.createUser({ role: 'user', firstName: 'C', lastName: 'D', email: 'two@example.edu', passwordHash: 'x', emailMe: true }),
    ).rejects.toThrow('Could not generate a unique id.')
    jest.restoreAllMocks()
  })

  test('a malformed token is rejected without touching the database', async () => {
    expect(await users.findUserByToken('not-a-uuid')).toBeNull()
    await users.deleteSession('not-a-uuid') // does not throw
  })

  test('passwordMatches handles correct, wrong and corrupted hashes', async () => {
    const stored = await hashPassword('correct-horse')
    expect(await passwordMatches('correct-horse', stored)).toBe(true)
    expect(await passwordMatches('wrong-horse', stored)).toBe(false)
    expect(await passwordMatches('anything', 'corrupted')).toBe(false)
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
