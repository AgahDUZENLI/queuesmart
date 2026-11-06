const express = require('express')
const crypto = require('crypto')
const db = require('./db')
const { newId } = require('./data')
const { requireAuth } = require('./auth')
const users = require('./userRepo')

// Convert database rows into the format expected by the frontend.
function formatNotification(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    type: row.type,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
    read: row.status === 'viewed',
    emailed: row.emailed === true,
  }
}

async function newNotificationId() {
  while (true) {
    const id = crypto.randomInt(100000, 1000000)

    const { rows } = await db.query(
      'SELECT id FROM notification WHERE id = $1',
      [id]
    )

    if (rows.length === 0) {
      return id
    }
  }
}

// Save a notification in PostgreSQL.
async function addNotification(userId, type, message) {
  const id = await newNotificationId()

  const { rows } = await db.query(
    `INSERT INTO notification
       (id, user_id, type, message, status, emailed)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, userId, type, message, 'sent', false]
  )

  return formatNotification(rows[0])
}

// Notify the first waiting user when nobody is being served.
async function notifyNextInLine(service, queue, serving) {
  const next = queue[0]

  if (serving || !next || next.closeNotified) return

  next.closeNotified = true

  const notification = await addNotification(
    next.userId,
    'Status change',
    `You are next in line for ${service.name}. Please get ready.`
  )

  await sendMockEmail(notification)
}

// No real email is sent. Store whether a mock email was triggered.
async function sendMockEmail(notification) {
  const user = await users.findById(notification.userId)

  if (!user || !user.emailMe) return

  await db.query(
    'UPDATE notification SET emailed = TRUE WHERE id = $1',
    [notification.id]
  )

  notification.emailed = true

  if (process.env.NODE_ENV !== 'test') {
    console.log(
      `[mock email] to ${user.email}: ${notification.message}`
    )
  }
}

const router = express.Router()

// GET /api/notifications/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT *
       FROM notification
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    )

    res.json({
      notifications: rows.map(formatNotification),
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(404).json({
        error: 'Notification not found.',
      })
    }

    const { rows } = await db.query(
      `UPDATE notification
       SET status = 'viewed'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Notification not found.',
      })
    }

    res.json({
      notification: formatNotification(rows[0]),
    })
  } catch (error) {
    next(error)
  }
})

module.exports = {
  router,
  addNotification,
  notifyNextInLine,
}
