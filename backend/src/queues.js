// Queue tickets are kept in memory until the data layer is added in A4.

const express = require('express')
const { data, newId } = require('./data')
const { requireAuth, requireAdmin } = require('./auth')
const { checkOneOf, checkWholeNumber, findErrors } = require('./validation')

const PRIORITIES = ['Low', 'Normal', 'High']
const PRIORITY_ORDER = { High: 0, Normal: 1, Low: 2 }

// Service priority decides which queues are listed first for staff and users:
// waited longest comes first; queues with nobody waiting go last, by name.
function byServicePriority(a, b) {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || oldestJoinTime(a) - oldestJoinTime(b)
    || a.name.localeCompare(b.name)
}

// When the longest-waiting person in this service's line joined, or Infinity if nobody is waiting
function oldestJoinTime(service) {
  const times = waitingTickets(service.id).map((entry) => Date.parse(entry.joinedAt))
  return times.length > 0 ? Math.min(...times) : Infinity
}

function findService(id) {
  return data.services.find((service) => service.id === Number(id))
}

function waitingTickets(serviceId) {
  return data.queueEntries
    .filter((entry) => entry.serviceId === Number(serviceId) && entry.status === 'waiting')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.queueOrder - b.queueOrder || a.id - b.id)
}

function servingTicket(serviceId) {
  return data.queueEntries.find((entry) => entry.serviceId === Number(serviceId) && entry.status === 'serving') || null
}

// How many recent visits the wait estimate learns from
const RECENT_VISITS = 5

// True when an ISO timestamp falls on today's date (server time)
function isToday(timestamp) {
  return new Date(timestamp).toDateString() === new Date().toDateString()
}

// Only today's visits count, so every morning starts again from the set duration.
function recentVisitMinutes(serviceId) {
  return data.queueEntries
    .filter((entry) => entry.serviceId === Number(serviceId) && entry.status === 'served' && entry.startedAt && entry.completedAt && isToday(entry.completedAt))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || b.id - a.id)
    .slice(0, RECENT_VISITS)
    .map((entry) => Math.max(0, Date.parse(entry.completedAt) - Date.parse(entry.startedAt)) / 60000)
}

// Minutes per person used for wait estimates: the average of today's last 5 served
// visits. Until a service has 5 visits today, its expected duration fills the missing
// ones, so a single very short or very long visit can't swing the estimate.
function minutesPerPerson(service) {
  const visits = recentVisitMinutes(service.id)
  const filled = [...visits, ...Array(RECENT_VISITS - visits.length).fill(service.duration)]
  return filled.reduce((sum, minutes) => sum + minutes, 0) / RECENT_VISITS
}

function estimateWaitMinutes(service, peopleAhead) {
  return Math.ceil(Number((minutesPerPerson(service) * Math.max(0, peopleAhead)).toFixed(2)))
}

function queueSummary(service) {
  const waiting = waitingTickets(service.id)
  const serving = servingTicket(service.id)
  return {
    waiting: waiting.length,
    wait: estimateWaitMinutes(service, waiting.length + (serving ? 1 : 0)),
    averageDuration: Math.round(minutesPerPerson(service)), // learned minutes per visit
    measuredVisits: recentVisitMinutes(service.id).length, // how many of today's visits that average uses (max 5)
  }
}

function publicTicket(entry) {
  const user = data.users.find((candidate) => candidate.id === entry.userId)
  return {
    id: entry.id,
    serviceId: entry.serviceId,
    ticket: entry.ticket,
    priority: entry.priority,
    status: entry.status,
    joinedAt: entry.joinedAt,
    name: user ? `${user.firstName} ${user.lastName}` : 'Guest',
  }
}

function currentTicketForUser(userId) {
  const entry = data.queueEntries.find((candidate) => candidate.userId === userId && ['waiting', 'serving'].includes(candidate.status))
  if (!entry) return null

  const service = findService(entry.serviceId)
  if (!service) return null

  const serving = servingTicket(service.id)
  const queue = waitingTickets(service.id)
  const position = entry.status === 'serving' ? 0 : queue.findIndex((candidate) => candidate.id === entry.id) + 1
  const peopleAhead = entry.status === 'serving' ? 0 : position - 1 + (serving ? 1 : 0)

  return {
    ...publicTicket(entry),
    position: entry.status === 'serving' ? 0 : position,
    peopleAhead,
    estimatedWaitMinutes: estimateWaitMinutes(service, peopleAhead),
    service: { ...service, ...queueSummary(service) },
  }
}

function recentTicketForUser(userId) {
  const entry = [...data.queueEntries]
    .reverse()
    .find((candidate) => candidate.userId === userId && !['waiting', 'serving'].includes(candidate.status))
  return entry ? { ...publicTicket(entry), service: findService(entry.serviceId) || null } : null
}

function adminQueueForService(service) {
  const serving = servingTicket(service.id)
  const queue = waitingTickets(service.id)
  return {
    ...service,
    ...queueSummary(service),
    queue: queue.map((entry, index) => ({
      ...publicTicket(entry),
      waiting: Math.max(0, Math.floor((Date.now() - Date.parse(entry.joinedAt)) / 60000)),
      position: index + 1,
    })),
    nowServing: serving
      ? {
          ...publicTicket(serving),
          started: new Date(serving.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        }
      : null,
  }
}

function reindexQueue(queue) {
  queue.forEach((entry, index) => { entry.queueOrder = index })
}

function ownedService(req, res) {
  const service = findService(req.params.serviceId)
  if (!service) {
    res.status(404).json({ error: 'Service not found.' })
    return null
  }
  if (service.placeId !== req.user.placeId) {
    res.status(403).json({ error: 'You can only manage queues at your own place.' })
    return null
  }
  return service
}

function activeTicket(serviceId, ticketId) {
  return data.queueEntries.find((entry) => (
    entry.serviceId === Number(serviceId) &&
    entry.id === Number(ticketId) &&
    ['waiting', 'serving'].includes(entry.status)
  ))
}

const router = express.Router()

// GET /api/queues/me - the signed-in user's active ticket and current estimate
router.get('/me', requireAuth, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can view a personal queue ticket.' })
  const ticket = currentTicketForUser(req.user.id)
  res.json({ ticket, recent: ticket ? null : recentTicketForUser(req.user.id) })
})

// GET /api/queues/mine - all queue state for the signed-in admin's place
router.get('/mine', requireAuth, requireAdmin, (req, res) => {
  const services = data.services
    .filter((service) => service.placeId === req.user.placeId)
    .sort(byServicePriority)
    .map(adminQueueForService)
  const place = data.places.find((candidate) => candidate.id === req.user.placeId)
  res.json({ place, services })
})

// POST /api/queues/:serviceId/join - join the end of a service queue
router.post('/:serviceId/join', requireAuth, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can join a queue.' })

  const service = findService(req.params.serviceId)
  if (!service) return res.status(404).json({ error: 'Service not found.' })
  if (service.status !== 'Open') return res.status(409).json({ error: `This service is ${service.status.toLowerCase()} and is not accepting new tickets.` })

  const existing = data.queueEntries.find((entry) => entry.userId === req.user.id && ['waiting', 'serving'].includes(entry.status))
  if (existing) return res.status(409).json({ error: 'You are already in a queue. Leave it before joining another one.' })

  const queue = waitingTickets(service.id)
  if (queue.length >= service.maxInLine) return res.status(409).json({ error: 'This queue is full.' })

  const queueOrder = Math.max(-1, ...queue.map((entry) => entry.queueOrder)) + 1
  const nextNumber = data.queueEntries.filter((entry) => entry.serviceId === service.id).length + 1
  const entry = {
    id: newId(data.queueEntries),
    serviceId: service.id,
    placeId: service.placeId,
    userId: req.user.id,
    ticket: `${service.name[0].toUpperCase()}-${String(nextNumber).padStart(3, '0')}`,
    serviceName: service.name, // kept for history if the service is deleted later
    priority: 'Normal',
    status: 'waiting',
    joinedAt: new Date().toISOString(),
    queueOrder,
  }
  data.queueEntries.push(entry)

  res.status(201).json({ ticket: currentTicketForUser(req.user.id) })
})

// DELETE /api/queues/tickets/:ticketId - a user leaves, or an admin removes, a ticket
router.delete('/tickets/:ticketId', requireAuth, (req, res) => {
  const entry = data.queueEntries.find((candidate) => (
    candidate.id === Number(req.params.ticketId) && ['waiting', 'serving'].includes(candidate.status)
  ))
  if (!entry) return res.status(404).json({ error: 'Active queue ticket not found.' })

  if (req.user.role === 'user') {
    if (entry.userId !== req.user.id) return res.status(403).json({ error: 'You can only leave your own queue ticket.' })
    entry.status = 'left'
  } else {
    const service = findService(entry.serviceId)
    if (!service || service.placeId !== req.user.placeId) {
      return res.status(403).json({ error: 'You can only manage queues at your own place.' })
    }
    entry.status = 'removed'
  }

  res.status(204).end()
})

// PATCH /api/queues/:serviceId/tickets/:ticketId - admins can set priority or position
router.patch('/:serviceId/tickets/:ticketId', requireAuth, requireAdmin, (req, res) => {
  const service = ownedService(req, res)
  if (!service) return

  const entry = activeTicket(service.id, req.params.ticketId)
  if (!entry || entry.status !== 'waiting') return res.status(404).json({ error: 'Waiting queue ticket not found.' })

  const body = req.body || {}
  const errors = findErrors({
    ...(body.priority !== undefined ? { priority: checkOneOf(body.priority, PRIORITIES, 'Priority') } : {}),
    ...(body.position !== undefined ? { position: checkWholeNumber(body.position, 'Position', 1, Math.max(1, waitingTickets(service.id).length)) } : {}),
  })
  if (body.priority === undefined && body.position === undefined) {
    return res.status(400).json({ error: 'Provide a priority or position to update.' })
  }
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const nextPriority = body.priority === undefined ? entry.priority : body.priority
  if (body.position !== undefined) {
    const queue = waitingTickets(service.id).sort((a, b) => {
      const aPriority = a.id === entry.id ? nextPriority : a.priority
      const bPriority = b.id === entry.id ? nextPriority : b.priority
      return PRIORITY_ORDER[aPriority] - PRIORITY_ORDER[bPriority] || a.queueOrder - b.queueOrder || a.id - b.id
    })
    const target = queue[body.position - 1]
    const targetPriority = target.id === entry.id ? nextPriority : target.priority
    if (targetPriority !== nextPriority) {
      return res.status(409).json({ error: 'A ticket can only move within its priority group.' })
    }
    const from = queue.findIndex((ticket) => ticket.id === entry.id)
    queue.splice(from, 1)
    queue.splice(body.position - 1, 0, entry)
    entry.priority = nextPriority
    reindexQueue(queue)
  } else {
    entry.priority = nextPriority
  }

  res.json({ ticket: publicTicket(entry), queue: adminQueueForService(service).queue })
})

// POST /api/queues/:serviceId/next - call the first waiting ticket to service
router.post('/:serviceId/next', requireAuth, requireAdmin, (req, res) => {
  const service = ownedService(req, res)
  if (!service) return
  if (servingTicket(service.id)) return res.status(409).json({ error: 'Complete the current ticket before calling the next person.' })

  const [next] = waitingTickets(service.id)
  if (!next) return res.status(409).json({ error: 'There are no waiting tickets.' })
  next.status = 'serving'
  next.startedAt = new Date().toISOString()
  res.json({ ticket: publicTicket(next), service: adminQueueForService(service) })
})

// POST /api/queues/:serviceId/complete - finish the current ticket
router.post('/:serviceId/complete', requireAuth, requireAdmin, (req, res) => {
  const service = ownedService(req, res)
  if (!service) return
  const current = servingTicket(service.id)
  if (!current) return res.status(409).json({ error: 'There is no ticket currently being served.' })
  current.status = 'served'
  current.completedAt = new Date().toISOString()
  res.json({ ticket: publicTicket(current), service: adminQueueForService(service) })
})

// POST /api/queues/:serviceId/no-show - remove the current ticket as a no-show
router.post('/:serviceId/no-show', requireAuth, requireAdmin, (req, res) => {
  const service = ownedService(req, res)
  if (!service) return
  const current = servingTicket(service.id)
  if (!current) return res.status(409).json({ error: 'There is no ticket currently being served.' })
  current.status = 'no-show'
  res.json({ ticket: publicTicket(current), service: adminQueueForService(service) })
})

module.exports = { router, byServicePriority, estimateWaitMinutes, minutesPerPerson, queueSummary, waitingTickets, servingTicket }
