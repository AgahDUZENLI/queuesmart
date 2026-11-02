const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const users = require('../src/userRepo')
const { checkPhone } = require('../src/validation')

const ada = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.edu', password: 'correct-horse' }
const boss = { ...ada, email: 'boss@example.edu', role: 'admin', placeName: 'Help Desk' }

let app
beforeEach(() => {
  app = createApp() // the empty database is restored by tests/setup.js
})

const register = (body) => request(app).post('/api/auth/register').send(body)
const authed = (token) => ({ Authorization: `Bearer ${token}` })
const getProfile = (token) => request(app).get('/api/profile/me').set(authed(token))
const putProfile = (token, body) => request(app).put('/api/profile/me').set(authed(token)).send(body)

describe('GET /api/profile/me', () => {
  test('returns the full profile with an empty phone for a new account', async () => {
    const { token, user } = (await register(ada)).body
    const res = await getProfile(token)
    expect(res.status).toBe(200)
    expect(res.body.profile).toEqual({
      id: user.id, role: 'user', firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace',
      email: 'ada@example.edu', phone: null, emailMe: true,
    })
  })

  test('401 when signed out', async () => {
    expect((await request(app).get('/api/profile/me')).status).toBe(401)
  })

  test('admins have a profile too', async () => {
    const { token } = (await register(boss)).body
    expect((await getProfile(token)).body.profile).toMatchObject({ role: 'admin', fullName: 'Ada Lovelace' })
  })
})

describe('PUT /api/profile/me', () => {
  test('updates name, phone and preference, and saves them in the database', async () => {
    const { token, user } = (await register(ada)).body
    const res = await putProfile(token, { firstName: ' Augusta ', lastName: 'King', phone: ' 555-123-4567 ', emailMe: false })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ firstName: 'Augusta', lastName: 'King', fullName: 'Augusta King', phone: '555-123-4567', emailMe: false })

    const row = (await db.query('SELECT * FROM user_profile WHERE user_id = $1', [user.id])).rows[0]
    expect(row).toMatchObject({ first_name: 'Augusta', last_name: 'King', phone: '555-123-4567', email_me: false })
  })

  test('the new name shows up on /api/auth/me and the next login', async () => {
    const { token } = (await register(ada)).body
    await putProfile(token, { firstName: 'Augusta', lastName: 'King' })
    expect((await request(app).get('/api/auth/me').set(authed(token))).body.user).toMatchObject({ firstName: 'Augusta', lastName: 'King' })
    const again = await request(app).post('/api/auth/login').send({ email: ada.email, password: ada.password })
    expect(again.body.user.firstName).toBe('Augusta')
  })

  test('leaving phone and emailMe out keeps them; an empty phone clears it', async () => {
    const { token } = (await register({ ...ada, phone: '555-123-4567', emailMe: false })).body
    expect((await putProfile(token, { firstName: 'Ada', lastName: 'L' })).body.profile).toMatchObject({ phone: '555-123-4567', emailMe: false })
    expect((await putProfile(token, { firstName: 'Ada', lastName: 'L', phone: '' })).body.profile.phone).toBeNull()
    expect((await putProfile(token, { firstName: 'Ada', lastName: 'L', phone: '555-987-6543' })).body.profile.phone).toBe('555-987-6543')
    expect((await putProfile(token, { firstName: 'Ada', lastName: 'L', phone: null })).body.profile.phone).toBeNull()
  })

  test('the email cannot be changed here', async () => {
    const { token, user } = (await register(ada)).body
    const res = await putProfile(token, { firstName: 'Ada', lastName: 'L', email: 'hacker@example.edu' })
    expect(res.body.profile.email).toBe('ada@example.edu')
    expect((await db.query('SELECT email FROM user_credentials WHERE id = $1', [user.id])).rows[0].email).toBe('ada@example.edu')
  })

  test('only changes the signed-in person, never anyone else', async () => {
    const first = (await register(ada)).body
    const second = (await register({ ...ada, email: 'grace@example.edu', firstName: 'Grace' })).body
    await putProfile(first.token, { firstName: 'Changed', lastName: 'Name' })
    expect((await getProfile(second.token)).body.profile.firstName).toBe('Grace')
  })

  test('400 lists every invalid field', async () => {
    const { token } = (await register(ada)).body
    const res = await putProfile(token, { firstName: '', lastName: 'x'.repeat(51), phone: 'call me', emailMe: 'yes' })
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual({
      firstName: 'First name is required.',
      lastName: 'Last name must be 50 characters or less.',
      phone: 'Enter a valid phone number, like 555-123-4567.',
      emailMe: 'Email me must be true or false.',
    })
  })

  test('a failed update changes nothing', async () => {
    const { token } = (await register(ada)).body
    await putProfile(token, { firstName: 'Nope', lastName: '' })
    expect((await getProfile(token)).body.profile.firstName).toBe('Ada')
  })

  test('401 when signed out', async () => {
    expect((await request(app).put('/api/profile/me').send({ firstName: 'A', lastName: 'B' })).status).toBe(401)
  })
})

describe('phone at registration', () => {
  test('is optional, and is saved when given', async () => {
    const without = (await register(ada)).body.user
    expect((await users.getProfile(without.id)).phone).toBeNull()
    const withPhone = (await register({ ...ada, email: 'p@example.edu', phone: ' +1 (555) 123-4567 ' })).body.user
    expect((await users.getProfile(withPhone.id)).phone).toBe('+1 (555) 123-4567')
  })

  test('a blank phone is stored as empty, and a bad one is rejected', async () => {
    const blank = (await register({ ...ada, phone: '   ' })).body.user
    expect((await users.getProfile(blank.id)).phone).toBeNull()
    const bad = await register({ ...ada, email: 'bad@example.edu', phone: 'abc' })
    expect(bad.status).toBe(400)
    expect(bad.body.fields).toEqual({ phone: 'Enter a valid phone number, like 555-123-4567.' })
  })
})

describe('database rules for user_profile', () => {
  test('the database refuses a phone over 20 characters or a missing name', async () => {
    const { user } = (await register(ada)).body
    await expect(db.query('UPDATE user_profile SET phone = $2 WHERE user_id = $1', [user.id, '1'.repeat(21)])).rejects.toThrow()
    await expect(db.query('UPDATE user_profile SET first_name = NULL WHERE user_id = $1', [user.id])).rejects.toThrow()
  })

  test('a profile cannot exist without a login (foreign key on user_id)', async () => {
    await expect(
      db.query("INSERT INTO user_profile (user_id, email, first_name, last_name) VALUES (111111, 'ghost@example.edu', 'G', 'H')"),
    ).rejects.toThrow()
  })

  test('getProfile and updateProfile return null for an unknown user', async () => {
    expect(await users.getProfile(424242)).toBeNull()
    expect(await users.updateProfile(424242, { firstName: 'A', lastName: 'B' })).toBeNull()
  })
})

test('checkPhone accepts common formats and rejects the rest', () => {
  for (const ok of [undefined, null, '', '   ', '555-123-4567', '(555) 123 4567', '+1 555.123.4567', '5551234567']) {
    expect(checkPhone(ok)).toBe('')
  }
  expect(checkPhone(5551234567)).toBe('Phone must be text.')
  expect(checkPhone('1'.repeat(21))).toBe('Phone must be 20 characters or less.')
  for (const bad of ['12345', 'abc-defg-hij', '555-123-4567 ext 9']) {
    expect(checkPhone(bad)).toBe('Enter a valid phone number, like 555-123-4567.')
  }
})
