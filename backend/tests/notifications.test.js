const request = require('supertest')
const { createApp } = require('../src/app')
const { data, reset } = require('../src/data')

let app
let adminAuth
let userAuth
let otherUserAuth

async function register(body) {
  const res = await request(app).post('/api/auth/register').send({ lastName: 'Test', password: 'correct-horse', ...body })
  return { Authorization: 'Bearer ' + res.body.token }
}

beforeEach(async () => {
  reset()
  app = createApp()
  adminAuth = await register({ role: 'admin', firstName: 'Ada', placeName: 'Help Desk', email: 'admin@example.edu' })
  userAuth = await register({ firstName: 'Uma', email: 'user@example.edu' })
  otherUserAuth = await register({ firstName: 'Max', email: 'other@example.edu' })
  await request(app).post('/api/services').set(adminAuth).send({
    name: 'Advising', description: 'Course planning.', duration: 15, priority: 'Normal', status: 'Open',
  })
})

const serviceId = () => data.services[0].id
const join = (auth) => request(app).post(`/api/queues/${serviceId()}/join`).set(auth)
const myNotifications = async (auth) => (await request(app).get('/api/notifications/me').set(auth)).body.notifications
const messages = async (auth) => (await myNotifications(auth)).map((n) => n.message)

describe('notifications', () => {
  test('joining a queue sends a joined notification', async () => {
    await join(otherUserAuth)
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    await join(userAuth)

    const notifications = await myNotifications(userAuth)
    expect(notifications[notifications.length - 1]).toMatchObject({
      type: 'Queue update',
      message: 'You joined Advising. You are number 1 in line.',
      read: false,
    })
  })

  test('the first person waiting is told they are next, only once', async () => {
    await join(userAuth)
    await join(otherUserAuth)
    expect(await messages(userAuth)).toContain('You are next in line for Advising. Please get ready.')
    expect(await messages(otherUserAuth)).not.toContain('You are next in line for Advising. Please get ready.')

    // Serving the first person moves the second to the front of the line
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    expect(await messages(userAuth)).toContain("It's your turn at Advising.")
    expect(await messages(otherUserAuth)).toContain('You are next in line for Advising. Please get ready.')

    await request(app).post(`/api/queues/${serviceId()}/complete`).set(adminAuth)
    const nextCount = (await messages(otherUserAuth)).filter((m) => m.startsWith('You are next')).length
    expect(nextCount).toBe(1)
    expect(await messages(userAuth)).toContain('You have been served at Advising.')
  })

  test('leaving, removal and no-show each notify the user', async () => {
    const mine = await join(userAuth)
    await request(app).delete(`/api/queues/tickets/${mine.body.ticket.id}`).set(userAuth)
    expect(await messages(userAuth)).toContain('You left the queue for Advising.')

    const other = await join(otherUserAuth)
    await request(app).delete(`/api/queues/tickets/${other.body.ticket.id}`).set(adminAuth)
    expect(await messages(otherUserAuth)).toContain('Your ticket was removed from the queue.')

    await join(userAuth)
    await request(app).post(`/api/queues/${serviceId()}/next`).set(adminAuth)
    await request(app).post(`/api/queues/${serviceId()}/no-show`).set(adminAuth)
    expect(await messages(userAuth)).toContain('Your ticket was marked as a no-show.')
  })

  test('notifications are listed newest first and only to their owner', async () => {
    await join(userAuth)
    const notifications = await myNotifications(userAuth)
    expect(notifications[0].message).toMatch(/next in line/)
    expect(await myNotifications(otherUserAuth)).toEqual([])
  })

  test('a user can mark their own notification as read', async () => {
    await join(userAuth)
    const [first] = await myNotifications(userAuth)

    const res = await request(app).post(`/api/notifications/${first.id}/read`).set(userAuth)
    expect(res.status).toBe(200)
    expect(res.body.notification.read).toBe(true)

    const other = await request(app).post(`/api/notifications/${first.id}/read`).set(otherUserAuth)
    expect(other.status).toBe(404)
  })

  test('notifications require sign-in', async () => {
    const res = await request(app).get('/api/notifications/me')
    expect(res.status).toBe(401)
  })
})
