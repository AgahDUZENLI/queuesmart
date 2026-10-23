const { data, reset } = require('../src/data')
const {
  NEAR_SERVICE_THRESHOLD,
  notifyQueueJoined,
  notifyNearlyServed,
  notificationsForUser,
} = require('../src/notifications')

const service = {
  id: 123456,
  name: 'Help Desk',
}

const entry = {
  id: 234567,
  userId: 345678,
  serviceId: service.id,
  ticket: 'H-001',
  status: 'waiting',
}

beforeEach(() => {
  reset()
})

describe('queue joined notifications', () => {
  test('creates a notification when a user joins a queue', () => {
    const notification = notifyQueueJoined(entry, service)

    expect(notification).toMatchObject({
      userId: entry.userId,
      serviceId: service.id,
      ticketId: entry.id,
      type: 'queue_joined',
      message: expect.stringContaining('H-001'),
    })

    expect(data.notifications).toHaveLength(1)
  })

  test('does not create duplicate join notifications', () => {
    notifyQueueJoined(entry, service)
    notifyQueueJoined(entry, service)

    expect(data.notifications).toHaveLength(1)
  })
})

describe('nearly served notifications', () => {
  test('notifies a waiting user with two people ahead', () => {
    const notification = notifyNearlyServed(
      entry,
      service,
      2
    )

    expect(notification.type).toBe('nearly_served')
    expect(notification.message).toContain('2 people ahead')
  })

  test('uses the configured default threshold', () => {
    expect(NEAR_SERVICE_THRESHOLD).toBe(2)

    expect(
      notifyNearlyServed(entry, service, 3)
    ).toBeNull()

    expect(data.notifications).toHaveLength(0)
  })

  test('does not notify a user who is already being served', () => {
    const servingEntry = { ...entry, status: 'serving' }

    expect(
      notifyNearlyServed(servingEntry, service, 0)
    ).toBeNull()

    expect(data.notifications).toHaveLength(0)
  })

  test('does not create duplicate nearly served notifications', () => {
    notifyNearlyServed(entry, service, 2)
    notifyNearlyServed(entry, service, 1)

    expect(
      data.notifications.filter(
        (item) => item.type === 'nearly_served'
      )
    ).toHaveLength(1)
  })

  test('does not notify for an invalid people-ahead count', () => {
    expect(
      notifyNearlyServed(entry, service, -1)
    ).toBeNull()

    expect(
      notifyNearlyServed(entry, service, Infinity)
    ).toBeNull()

    expect(data.notifications).toHaveLength(0)
  })
})

describe('notificationsForUser', () => {
  test('returns only notifications belonging to that user', () => {
    notifyQueueJoined(entry, service)

    notifyQueueJoined({
      ...entry,
      id: 456789,
      userId: 567890,
      ticket: 'H-002',
    }, service)

    const notifications = notificationsForUser(entry.userId)

    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe(entry.userId)
  })

  test('returns an empty array when the user has no notifications', () => {
    expect(notificationsForUser(999999)).toEqual([])
  })
})