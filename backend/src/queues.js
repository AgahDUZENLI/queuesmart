// Queue operations backed by the queue and queue_entry tables.

const express = require('express')
const queueRepo = require('./queueRepo')
const placeRepo = require('./placeRepo')
const { requireAuth, requireAdmin } = require('./auth')
const { addNotification, notifyNextInLine } = require('./notifications')
const { checkOneOf, checkWholeNumber, findErrors } = require('./validation')

const PRIORITIES = ['Low', 'Normal', 'High']

function ordinal(number) {
  const lastTwo = number % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`
  return number + ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th')
}

function publicTicket(entry) {
  if (!entry) return null
  return {
    id: entry.id,
    serviceId: entry.serviceId,
    ticket: entry.ticket,
    priority: entry.priority,
    status: entry.status,
    joinedAt: entry.joinedAt,
    name: entry.name,
  }
}

function userTicketPayload(entry) {
  return {
    ...publicTicket(entry),
    position: entry.position,
    peopleAhead: entry.peopleAhead,
    estimatedWaitMinutes: entry.estimatedWaitMinutes,
    service: entry.service,
  }
}

function adminService(service) {
  return {
    ...service,
    queue: service.queue.map((entry) => ({
      ...publicTicket(entry),
      waiting: entry.waiting,
      position: entry.position,
    })),
    nowServing: service.nowServing ? {
      ...publicTicket(service.nowServing),
      started: service.nowServing.started,
      minutesIn: service.nowServing.minutesIn,
      minutesLeft: service.nowServing.minutesLeft,
    } : null,
  }
}

async function notifyIfNext(serviceId) {
  const context = await queueRepo.serviceContext(serviceId)
  if (!context) return

  const waiting = await queueRepo.entriesForQueue(context.queueId, 'waiting')
  const serving = (await queueRepo.entriesForQueue(context.queueId, 'serving'))[0] || null
  const next = waiting[0]

  if (!serving && next && !next.closeNotified) {
    await notifyNextInLine(context.service, waiting, serving)
    await queueRepo.markCloseNotified(next.id)
  }
}

async function handle(res, operation) {
  try {
    return await operation()
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    throw error
  }
}

const router = express.Router()

// GET /api/queues/me
router.get('/me', requireAuth, (req, res) => handle(res, async () => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can view a personal queue ticket.' })
  }

  const result = await queueRepo.userTicket(req.user.id)

  return res.json({
    ticket: result.ticket ? userTicketPayload(result.ticket) : null,
    recent: result.recent
      ? { ...publicTicket(result.recent), service: result.recent.service }
      : null,
  })
}))

// GET /api/queues/mine
router.get('/mine', requireAuth, requireAdmin, (req, res) => handle(res, async () => {
  const [place, services] = await Promise.all([
    placeRepo.findById(req.user.placeId),
    queueRepo.adminQueues(req.user.placeId),
  ])

  return res.json({
    place,
    services: services.map(adminService),
  })
}))

// POST /api/queues/:serviceId/join
router.post('/:serviceId/join', requireAuth, (req, res) => handle(res, async () => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can join a queue.' })
  }

  const { ticket } = await queueRepo.join(req.params.serviceId, req.user.id)

  await addNotification(
    req.user.id,
    'Queue update',
    `You joined ${ticket.service.name}. You are ${ordinal(ticket.position)} in line.`
  )

  await notifyIfNext(ticket.serviceId)

  return res.status(201).json({ ticket: userTicketPayload(ticket) })
}))

// DELETE /api/queues/tickets/:ticketId
router.delete('/tickets/:ticketId', requireAuth, (req, res) => handle(res, async () => {
  const entry = await queueRepo.removeTicket(req.params.ticketId, req.user)

  if (req.user.role === 'user') {
    await addNotification(
      entry.userId,
      'Queue update',
      `You left the queue for ${entry.serviceName}.`
    )
  } else {
    await addNotification(
      entry.userId,
      'Status change',
      'Your ticket was removed from the queue.'
    )
  }

  await notifyIfNext(entry.serviceId)

  return res.status(204).end()
}))

// PATCH /api/queues/:serviceId/tickets/:ticketId
router.patch('/:serviceId/tickets/:ticketId', requireAuth, requireAdmin, (req, res) => handle(res, async () => {
  const context = await queueRepo.serviceContext(req.params.serviceId)

  if (!context) return res.status(404).json({ error: 'Service not found.' })

  if (context.service.placeId !== req.user.placeId) {
    return res.status(403).json({ error: 'You can only manage queues at your own place.' })
  }

  const body = req.body || {}
  const waiting = await queueRepo.entriesForQueue(context.queueId, 'waiting')

  const errors = findErrors({
    ...(body.priority !== undefined
      ? { priority: checkOneOf(body.priority, PRIORITIES, 'Priority') }
      : {}),
    ...(body.position !== undefined
      ? { position: checkWholeNumber(body.position, 'Position', 1, Math.max(1, waiting.length)) }
      : {}),
  })

  if (body.priority === undefined && body.position === undefined) {
    return res.status(400).json({ error: 'Provide a priority or position to update.' })
  }

  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const result = await queueRepo.updateTicket(
    req.params.serviceId,
    req.user.placeId,
    req.params.ticketId,
    body
  )

  await notifyIfNext(req.params.serviceId)

  return res.json({
    ticket: publicTicket(result.ticket),
    queue: result.queue.map((entry, index) => ({
      ...publicTicket(entry),
      position: index + 1,
    })),
  })
}))

// POST /api/queues/:serviceId/next
router.post('/:serviceId/next', requireAuth, requireAdmin, (req, res) => handle(res, async () => {
  const entry = await queueRepo.serveNext(req.params.serviceId, req.user.placeId)

  await addNotification(
    entry.userId,
    'Status change',
    `It's your turn at ${entry.service.name}.`
  )

  const services = await queueRepo.adminQueues(req.user.placeId)

  return res.json({
    ticket: publicTicket(entry),
    service: adminService(services.find((service) => service.id === entry.serviceId)),
  })
}))

// POST /api/queues/:serviceId/complete
router.post('/:serviceId/complete', requireAuth, requireAdmin, (req, res) => handle(res, async () => {
  const entry = await queueRepo.completeCurrent(
    req.params.serviceId,
    req.user.placeId,
    'served'
  )

  await addNotification(
    entry.userId,
    'Status change',
    `You have been served at ${entry.service.name}.`
  )

  await notifyIfNext(req.params.serviceId)

  const services = await queueRepo.adminQueues(req.user.placeId)

  return res.json({
    ticket: publicTicket(entry),
    service: adminService(services.find((service) => service.id === entry.serviceId)),
  })
}))

// POST /api/queues/:serviceId/no-show
router.post('/:serviceId/no-show', requireAuth, requireAdmin, (req, res) => handle(res, async () => {
  const entry = await queueRepo.completeCurrent(
    req.params.serviceId,
    req.user.placeId,
    'no-show'
  )

  await addNotification(
    entry.userId,
    'Status change',
    'Your ticket was marked as a no-show.'
  )

  await notifyIfNext(req.params.serviceId)

  const services = await queueRepo.adminQueues(req.user.placeId)

  return res.json({
    ticket: publicTicket(entry),
    service: adminService(services.find((service) => service.id === entry.serviceId)),
  })
}))

module.exports = { router, PRIORITIES, ordinal }
