const crypto = require('crypto')
const { data } = require('./data')

const NEAR_SERVICE_THRESHOLD = 2

function createNotification({
  userId,
  serviceId,
  ticketId,
  type,
  message,
}) {
  const existing = data.notifications.find(
    (notification) =>
      notification.ticketId === ticketId &&
      notification.type === type
  )

  if (existing) return existing

  const notification = {
    id: crypto.randomUUID(),
    userId,
    serviceId,
    ticketId,
    type,
    message,
    createdAt: new Date().toISOString(),
  }

  data.notifications.push(notification)
  return notification
}

function notifyQueueJoined(entry, service) {
  return createNotification({
    userId: entry.userId,
    serviceId: entry.serviceId,
    ticketId: entry.id,
    type: 'queue_joined',
    message: `You have joined the ${service.name} queue. Your ticket number is ${entry.ticket}.`,
  })
}

function notifyNearlyServed(
  entry,
  service,
  peopleAhead,
  threshold = NEAR_SERVICE_THRESHOLD
) {
  if (entry.status !== 'waiting') return null

  if (
    !Number.isFinite(peopleAhead) ||
    peopleAhead < 0 ||
    peopleAhead > threshold
  ) {
    return null
  }

  return createNotification({
    userId: entry.userId,
    serviceId: entry.serviceId,
    ticketId: entry.id,
    type: 'nearly_served',
    message: `Your turn at ${service.name} is approaching. There ${
      peopleAhead === 1 ? 'is' : 'are'
    } ${peopleAhead} ${
      peopleAhead === 1 ? 'person' : 'people'
    } ahead of you.`,
  })
}

function notificationsForUser(userId) {
  return data.notifications
    .filter((notification) => notification.userId === userId)
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
    )
}

module.exports = {
  NEAR_SERVICE_THRESHOLD,
  notifyQueueJoined,
  notifyNearlyServed,
  notificationsForUser,
}