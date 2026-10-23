// Notification module: messages for users about their queue tickets.
// Nothing is emailed or texted; notifications are kept in memory and returned to the front end.

const express = require('express')
const { data, newId } = require('./data')
const { requireAuth } = require('./auth')

function addNotification(userId, type, message) {
  const notification = {
    id: newId(data.notifications),
    userId,
    type, // 'Queue update' or 'Status change'
    message,
    createdAt: new Date().toISOString(),
    read: false,
    emailed: false,
  }
  data.notifications.push(notification)
  return notification
}

// Tells the first person waiting that they are next, once per ticket. Only sent when
// nobody is being served, so it matches "Almost ready" on the Queue status page.
// `queue` is the service's waiting tickets in order (see waitingTickets in queues.js).
function notifyNextInLine(service, queue, serving) {
  const next = queue[0]
  if (serving || !next || next.closeNotified) return
  next.closeNotified = true
  const notification = addNotification(next.userId, 'Status change', `You are next in line for ${service.name}. Please get ready.`)
  sendMockEmail(notification)
}

// Users who ticked "Email me when it's almost my turn" (emailMe) also get the
// "you are next" message by email. No real email is sent yet: it is logged instead.
function sendMockEmail(notification) {
  const user = data.users.find((u) => u.id === notification.userId)
  if (!user || !user.emailMe) return
  notification.emailed = true
  if (process.env.NODE_ENV !== 'test') console.log(`[mock email] to ${user.email}: ${notification.message}`)
}

const router = express.Router()

// GET /api/notifications/me - the signed-in user's notifications, newest first
router.get('/me', requireAuth, (req, res) => {
  const notifications = data.notifications.filter((n) => n.userId === req.user.id).reverse()
  res.json({ notifications })
})

// POST /api/notifications/:id/read - mark one notification as read
router.post('/:id/read', requireAuth, (req, res) => {
  const notification = data.notifications.find((n) => n.id === Number(req.params.id) && n.userId === req.user.id)
  if (!notification) return res.status(404).json({ error: 'Notification not found.' })
  notification.read = true
  res.json({ notification })
})

module.exports = { router, addNotification, notifyNextInLine }
