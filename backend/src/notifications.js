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
  }
  data.notifications.push(notification)
  return notification
}

// Tells the first person waiting in a line that they are next, once per ticket.
// `queue` is the service's waiting tickets in order (see waitingTickets in queues.js).
function notifyNextInLine(service, queue) {
  const next = queue[0]
  if (!next || next.closeNotified) return
  next.closeNotified = true
  addNotification(next.userId, 'Status change', `You are next in line for ${service.name}. Please get ready.`)
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
