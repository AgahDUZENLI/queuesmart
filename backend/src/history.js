// History module: queue participation history, built from persisted queue entries.

const express = require('express')
const db = require('./db')
const { requireAuth, requireAdmin } = require('./auth')
const { checkOneOf, checkWholeNumber, findErrors } = require('./validation')

const STATUSES = ['waiting', 'serving', 'served', 'left', 'removed', 'no-show']
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// Whole minutes between two ISO timestamps, or null if either is missing
function minutesBetween(start, end) {
  if (!start || !end) return null
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000))
}

function historyItem(entry) {
  return {
    id: entry.id,
    ticket: entry.ticket,
    status: entry.status,
    priority: entry.priority,
    joinedAt: entry.joinedAt,
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    waitedMinutes: minutesBetween(entry.joinedAt, entry.startedAt),
    serviceName: entry.serviceName || 'Removed service',
    placeName: entry.placeName || null,
    name: entry.name || 'Guest',
  }
}

// Validates ?status= and ?limit= from the query string
function readFilters(query) {
  const q = query || {}
  const limit = q.limit === undefined ? DEFAULT_LIMIT : Number(q.limit)
  const errors = findErrors({
    status: q.status === undefined ? '' : checkOneOf(q.status, STATUSES, 'Status'),
    limit: q.limit === undefined ? '' : checkWholeNumber(limit, 'Limit', 1, MAX_LIMIT),
  })
  return { errors, status: q.status, limit }
}

// Newest first, filtered by status, trimmed to the limit
function buildPage(entries, { status, limit }) {
  const matching = entries
    .filter((entry) => !status || entry.status === status)
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt) || b.id - a.id)
  return { total: matching.length, history: matching.slice(0, limit).map(historyItem) }
}

function buildStats(entries) {
  const count = (status) => entries.filter((entry) => entry.status === status).length
  const waits = entries.map((entry) => minutesBetween(entry.joinedAt, entry.startedAt)).filter((wait) => wait !== null)
  return {
    total: entries.length,
    waiting: count('waiting'),
    serving: count('serving'),
    served: count('served'),
    left: count('left'),
    removed: count('removed'),
    noShow: count('no-show'),
    averageWaitMinutes: waits.length ? Math.round(waits.reduce((sum, wait) => sum + wait, 0) / waits.length) : 0,
  }
}

const router = express.Router()

async function getEntries(where, params, filters) {
  const statusClause = filters.status
    ? ` AND CAST(e.status AS text) = CAST($${params.length + 1} AS text)`
    : ''
  const queryParams = filters.status ? [...params, filters.status] : params
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS count
     FROM queue_entry e JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text) JOIN service s ON s.id = q.service_id
     WHERE ${where}${statusClause}`,
    queryParams,
  )
  const { rows } = await db.query(
    `SELECT e.id, e.ticket, e.status, e.priority, e.joined_at, e.started_at,
            e.completed_at, e.service_name, pl.name AS place_name,
            u.first_name || ' ' || u.last_name AS name
     FROM queue_entry e
     JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text)
     JOIN service s ON s.id = q.service_id
     JOIN place pl ON pl.id = s.place_id
     JOIN user_profile u ON u.user_id = e.user_id
     WHERE ${where}${statusClause}
     ORDER BY e.joined_at DESC, e.id DESC
     LIMIT $${queryParams.length + 1}`,
    [...queryParams, filters.limit],
  )
  return {
    total: Number(countRows[0].count),
    history: rows.map((row) => historyItem({
      id: row.id,
      ticket: row.ticket,
      status: row.status,
      priority: row.priority,
      joinedAt: row.joined_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      serviceName: row.service_name,
      placeName: row.place_name,
      name: row.name,
    })),
  }
}

async function getStats(where, params) {
  const { rows } = await db.query(
    `SELECT e.id, e.status, e.joined_at, e.started_at
     FROM queue_entry e JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text) JOIN service s ON s.id = q.service_id
     WHERE ${where}`,
    params,
  )
  return buildStats(rows.map((row) => ({
    id: row.id,
    status: row.status,
    joinedAt: row.joined_at,
    startedAt: row.started_at,
  })))
}

// GET /api/history/me?status=&limit= - the signed-in user's own queue history
router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users have a personal queue history.' })

  const filters = readFilters(req.query)
  if (filters.errors) return res.status(400).json({ error: 'Validation failed.', fields: filters.errors })

  res.json(await getEntries('CAST(e.user_id AS text) = CAST($1 AS text)', [req.user.id], filters))
})

// GET /api/history/stats - usage statistics for the signed-in admin's place
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  res.json(await getStats('CAST(s.place_id AS text) = CAST($1 AS text)', [req.user.placeId]))
})

// GET /api/history?status=&limit= - queue history for the signed-in admin's place
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const filters = readFilters(req.query)
  if (filters.errors) return res.status(400).json({ error: 'Validation failed.', fields: filters.errors })

  res.json(await getEntries('CAST(s.place_id AS text) = CAST($1 AS text)', [req.user.placeId], filters))
})

module.exports = { router, minutesBetween, historyItem, readFilters, buildPage, buildStats }