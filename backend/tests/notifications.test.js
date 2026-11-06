const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const { ordinal } = require('../src/queues')

let app
let adminAuth
let userAuth
let otherUserAuth
let serviceIdValue

async function register(body) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      lastName: 'Test',
      password: 'correct-horse',
      ...body,
    })

  expect(res.status).toBe(201)
  return { Authorization: 'Bearer ' + res.body.token }
}

beforeEach(async () => {
  app = createApp()

  adminAuth = await register({
    role: 'admin',
    firstName: 'Ada',
    placeName: 'Help Desk',
    email: 'admin@example.edu',
  })

  userAuth = await register({
    firstName: 'Uma',
    email: 'user@example.edu',
  })

  otherUserAuth = await register({
    firstName: 'Max',
    email: 'other@example.edu',
  })

  const service = await request(app)
    .post('/api/services')
    .set(adminAuth)
    .send({
      name: 'Advising',
      description: 'Course planning.',
      duration: 15,
      priority: 'Normal',
      status: 'Open',
    })

  expect(service.status).toBe(201)
  serviceIdValue = service.body.service.id
})

const serviceId = () => serviceIdValue

const join = (auth) =>
  request(app)
    .post(`/api/queues/${serviceId()}/join`)
    .set(auth)

const myNotifications = async (auth) => {
  const res = await request(app)
    .get('/api/notifications/me')
    .set(auth)

  expect(res.status).toBe(200)
  return res.body.notifications
}

const messages = async (auth) =>
  (await myNotifications(auth)).map((n) => n.message)

const currentUser = async (auth) => {
  const res = await request(app)
    .get('/api/auth/me')
    .set(auth)

  expect(res.status).toBe(200)
  return res.body.user
}

// Assignment 3: Existing notification functionality

describe('notifications', () => {

  test('joining a queue sends a joined notification', async () => {
    await join(otherUserAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    await join(userAuth)

    const notifications = await myNotifications(userAuth)

    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'Queue update',
          message: 'You joined Advising. You are 1st in line.',
          read: false,
        }),
      ])
    )
  })

  test('the first person waiting is notified once', async () => {
    const next =
      'You are next in line for Advising. Please get ready.'

    await join(userAuth)
    await join(otherUserAuth)

    expect(await messages(userAuth)).toContain(next)
    expect(await messages(otherUserAuth)).not.toContain(next)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    expect(await messages(userAuth)).toContain(
      "It's your turn at Advising."
    )

    expect(await messages(otherUserAuth)).not.toContain(next)

    await request(app)
      .post(`/api/queues/${serviceId()}/complete`)
      .set(adminAuth)

    expect(await messages(userAuth)).toContain(
      'You have been served at Advising.'
    )

    expect(await messages(otherUserAuth)).toContain(next)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/no-show`)
      .set(adminAuth)

    const otherMessages = await messages(otherUserAuth)

    expect(
      otherMessages.filter((message) => message === next)
    ).toHaveLength(1)
  })

  test('a user behind someone being served is not told they are next', async () => {
    await join(otherUserAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    await join(userAuth)

    expect(await messages(userAuth)).not.toContain(
      'You are next in line for Advising. Please get ready.'
    )
  })

  test('leaving, removal and no-show notify users', async () => {
    const mine = await join(userAuth)

    await request(app)
      .delete(`/api/queues/tickets/${mine.body.ticket.id}`)
      .set(userAuth)

    expect(await messages(userAuth)).toContain(
      'You left the queue for Advising.'
    )

    const other = await join(otherUserAuth)

    await request(app)
      .delete(`/api/queues/tickets/${other.body.ticket.id}`)
      .set(adminAuth)

    expect(await messages(otherUserAuth)).toContain(
      'Your ticket was removed from the queue.'
    )

    await join(userAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/no-show`)
      .set(adminAuth)

    expect(await messages(userAuth)).toContain(
      'Your ticket was marked as a no-show.'
    )
  })

  test('notifications are retrieved newest first', async () => {
    const response = await join(userAuth)
    expect(response.status).toBe(201)

    const notifications = await myNotifications(userAuth)

    expect(notifications).toHaveLength(2)

    expect(notifications.map((n) => n.message)).toContain(
      'You are next in line for Advising. Please get ready.'
    )

    const timestamps = notifications.map((n) =>
      new Date(n.createdAt).getTime()
    )

    expect(timestamps.every(Number.isFinite)).toBe(true)

    expect(timestamps).toEqual(
      [...timestamps].sort((a, b) => b - a)
    )

    expect(await myNotifications(otherUserAuth)).toEqual([])
  })

  test('a user can mark their own notification as read', async () => {
    await join(userAuth)

    const before = await myNotifications(userAuth)
    const first = before[0]

    const res = await request(app)
      .post(`/api/notifications/${first.id}/read`)
      .set(userAuth)

    expect(res.status).toBe(200)
    expect(res.body.notification.read).toBe(true)

    const after = await myNotifications(userAuth)

    expect(after).toHaveLength(before.length)

    expect(
      after.find((n) => n.id === first.id).status
    ).toBe('viewed')

    const other = await request(app)
      .post(`/api/notifications/${first.id}/read`)
      .set(otherUserAuth)

    expect(other.status).toBe(404)
  })

  test('mock email respects user preferences', async () => {
    const noEmailAuth = await register({
      firstName: 'Nia',
      email: 'noemail@example.edu',
      emailMe: false,
    })

    await join(userAuth)

    const notifications = await myNotifications(userAuth)

    const next = notifications.find((n) =>
      n.message ===
      'You are next in line for Advising. Please get ready.'
    )

    expect(next).toBeDefined()
    expect(next.emailed).toBe(true)

    await request(app)
      .post(`/api/queues/${serviceId()}/next`)
      .set(adminAuth)

    await request(app)
      .post(`/api/queues/${serviceId()}/complete`)
      .set(adminAuth)

    await join(noEmailAuth)

    const noEmailNotifications =
      await myNotifications(noEmailAuth)

    expect(
      noEmailNotifications.every((n) => n.emailed === false)
    ).toBe(true)
  })

  test('ordinal generates correct suffixes', () => {
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 111].map(ordinal)
    ).toEqual([
      '1st', '2nd', '3rd', '4th',
      '11th', '12th', '13th',
      '21st', '22nd', '111th',
    ])
  })

  test('notifications require authentication', async () => {
    const res = await request(app)
      .get('/api/notifications/me')

    expect(res.status).toBe(401)
  })
})

// Assignment 4: Database integration tests

describe('notification database integration (Assignment 4)', () => {

  test('joining a queue saves a notification in PostgreSQL', async () => {
    const joined = await join(userAuth)
    expect(joined.status).toBe(201)

    const user = await currentUser(userAuth)

    const { rows } = await db.query(
      `SELECT id, user_id, message, status, created_at
       FROM notification
       WHERE user_id = $1`,
      [user.id]
    )

    expect(rows.length).toBeGreaterThanOrEqual(1)

    const record = rows.find((row) =>
      row.message.includes('You joined Advising.')
    )

    expect(record).toBeDefined()
    expect(Number.isInteger(Number(record.id))).toBe(true)
    expect(Number(record.user_id)).toBe(Number(user.id))
    expect(record.status).toBe('sent')

    expect(
      Number.isFinite(new Date(record.created_at).getTime())
    ).toBe(true)
  })

  test('API retrieves the same notifications stored in the database', async () => {
    await join(userAuth)

    const user = await currentUser(userAuth)

    const { rows } = await db.query(
      'SELECT id FROM notification WHERE user_id = $1',
      [user.id]
    )

    const response = await request(app)
      .get('/api/notifications/me')
      .set(userAuth)

    expect(response.status).toBe(200)

    expect(response.body.notifications).toHaveLength(rows.length)

    expect(
      response.body.notifications
        .map((n) => Number(n.id))
        .sort((a, b) => a - b)
    ).toEqual(
      rows.map((row) => Number(row.id))
        .sort((a, b) => a - b)
    )
  })

  test('marking a notification read updates database status', async () => {
    await join(userAuth)

    const before = await myNotifications(userAuth)
    const first = before[0]

    const response = await request(app)
      .post(`/api/notifications/${first.id}/read`)
      .set(userAuth)

    expect(response.status).toBe(200)
    expect(response.body.notification.read).toBe(true)
    expect(response.body.notification.status).toBe('viewed')

    const { rows } = await db.query(
      'SELECT status FROM notification WHERE id = $1',
      [first.id]
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('viewed')

    const after = await myNotifications(userAuth)

    expect(after).toHaveLength(before.length)

    expect(
      after.find((n) => n.id === first.id)
    ).toMatchObject({
      status: 'viewed',
      read: true,
    })
  })

  test('users cannot access another users notifications', async () => {
    await join(userAuth)

    const [notification] = await myNotifications(userAuth)

    expect(notification).toBeDefined()

    expect(await myNotifications(otherUserAuth)).toEqual([])

    const response = await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set(otherUserAuth)

    expect(response.status).toBe(404)

    const { rows } = await db.query(
      'SELECT status FROM notification WHERE id = $1',
      [notification.id]
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('sent')
  })

  test('database rejects notifications for nonexistent users', async () => {
    await expect(
      db.query(
        `INSERT INTO notification
         (id, user_id, type, message)
         VALUES ($1, $2, $3, $4)`,
        [987654, 999999, 'Queue update', 'Invalid recipient']
      )
    ).rejects.toThrow()
  })

  test('invalid notification IDs cannot be marked as read', async () => {
    for (const id of ['not-a-number', '0', '-1']) {
      const response = await request(app)
        .post(`/api/notifications/${id}/read`)
        .set(userAuth)

      expect(response.status).toBe(404)
    }
  })
})
