// History module: queue participation history, built from the tickets kept in data.queueEntries.

const express = require('express')
const { data } = require('./data')
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
  const service = data.services.find((candidate) => candidate.id === entry.serviceId)
  const place = data.places.find((candidate) => candidate.id === entry.placeId)
  const user = data.users.find((candidate) => candidate.id === entry.userId)
  return {
    id: entry.id,
    ticket: entry.ticket,
    status: entry.status,
    priority: entry.priority,
    joinedAt: entry.joinedAt,
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    waitedMinutes: minutesBetween(entry.joinedAt, entry.startedAt),
    serviceName: service ? service.name : entry.serviceName || 'Removed service',
    placeName: place ? place.name : null,
    name: user ? `${user.firstName} ${user.lastName}` : 'Guest',
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

// GET /api/history/me?status=&limit= - the signed-in user's own queue history
router.get('/me', requireAuth, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users have a personal queue history.' })

  const filters = readFilters(req.query)
  if (filters.errors) return res.status(400).json({ error: 'Validation failed.', fields: filters.errors })

  const entries = data.queueEntries.filter((entry) => entry.userId === req.user.id)
  res.json(buildPage(entries, filters))
})

// GET /api/history/stats - usage statistics for the signed-in admin's place
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const entries = data.queueEntries.filter((entry) => entry.placeId === req.user.placeId)
  res.json(buildStats(entries))
})

// GET /api/history?status=&limit= - queue history for the signed-in admin's place
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const filters = readFilters(req.query)
  if (filters.errors) return res.status(400).json({ error: 'Validation failed.', fields: filters.errors })

  const entries = data.queueEntries.filter((entry) => entry.placeId === req.user.placeId)
  res.json(buildPage(entries, filters))
})

module.exports = { router, minutesBetween, historyItem, readFilters, buildPage, buildStats }