// Service management module: the services people can line up for.
// Each service belongs to a place. Anyone can list services; only the admin
// who runs the place can create, update or delete its services.

const express = require('express')
const serviceRepo = require('./serviceRepo')
const queueRepo = require('./queueRepo')
const { PRIORITIES } = require('./queues')
const { requireAuth, requireAdmin } = require('./auth')
const { checkText, checkWholeNumber, checkOneOf, checkTime, checkTrueFalse, findErrors } = require('./validation')

const STATUSES = ['Open', 'Paused', 'Closed']

// Used when a new service leaves out one of the optional fields
const DEFAULTS = { maxInLine: 25, status: 'Closed', opens: '09:00', closes: '16:30', appointments: false }

// Copies only the service fields from a request body, so clients can't set
// things like `id`
function pickServiceFields(body) {
  const fields = {}
  for (const key of ['name', 'description', 'duration', 'priority', 'maxInLine', 'status', 'opens', 'closes', 'appointments']) {
    if (body[key] !== undefined) fields[key] = body[key]
  }
  return fields
}

// Returns an object of error messages, or null when the service is valid
function validateService(service) {
  const errors = findErrors({
    name: checkText(service.name, 'Name', 100),
    description: checkText(service.description, 'Description', 500),
    duration: checkWholeNumber(service.duration, 'Duration', 1, 480), // minutes
    priority: checkOneOf(service.priority, PRIORITIES, 'Priority'),
    maxInLine: checkWholeNumber(service.maxInLine, 'Max in line', 1, 500),
    status: checkOneOf(service.status, STATUSES, 'Status'),
    opens: checkTime(service.opens, 'Opening time'),
    closes: checkTime(service.closes, 'Closing time'),
    appointments: checkTrueFalse(service.appointments, 'Allow appointments'),
  })
  if (errors) return errors
  if (service.closes <= service.opens) return { closes: 'Closing time must be after opening time.' }
  return null
}

// Call after validating, once name and description are known to be text
function trimText(service) {
  service.name = service.name.trim()
  service.description = service.description.trim()
  return service
}

const router = express.Router()

// GET /api/services, or /api/services?placeId=1 for one place's services.
// High-priority services come first.
router.get('/', async (req, res) => {
  const listed = req.query.placeId
    ? await serviceRepo.listByPlace(Number(req.query.placeId))
    : await serviceRepo.listAll()
  const withSummaries = await Promise.all(listed.map(async (service) => ({
    ...service,
    ...await queueRepo.summary(service, (await queueRepo.serviceContext(service.id)).queueId),
  })))
  res.json({ services: await queueRepo.orderByPriorityAndWait(withSummaries) })
})

// GET /api/services/:id
router.get('/:id', async (req, res) => {
  const service = await serviceRepo.findById(req.params.id)
  if (!service) return res.status(404).json({ error: 'Service not found.' })
  res.json({ service })
})

// POST /api/services  (admin)
// { name, description, duration, priority, maxInLine?, status?, opens?, closes?, appointments? }
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const fields = { ...DEFAULTS, ...pickServiceFields(req.body || {}) }
  const errors = validateService(fields)
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  res.status(201).json({ service: await serviceRepo.create(trimText({ placeId: req.user.placeId, ...fields })) })
})

// PUT /api/services/:id  (admin) - send only the fields that change
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const service = await serviceRepo.findById(req.params.id)
  if (!service) return res.status(404).json({ error: 'Service not found.' })
  if (service.placeId !== req.user.placeId) {
    return res.status(403).json({ error: 'You can only change services at your own place.' })
  }

  const updated = { ...service, ...pickServiceFields(req.body || {}) }
  const errors = validateService(updated)
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const changes = pickServiceFields(req.body || {})
  if (changes.name !== undefined) changes.name = changes.name.trim()
  if (changes.description !== undefined) changes.description = changes.description.trim()
  const saved = await serviceRepo.update(req.params.id, req.user.placeId, changes)
  if (!saved) return res.status(404).json({ error: 'Service not found.' })
  res.json({ service: saved })
})

// DELETE /api/services/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const service = await serviceRepo.findById(req.params.id)
  if (!service) return res.status(404).json({ error: 'Service not found.' })
  if (service.placeId !== req.user.placeId) {
    return res.status(403).json({ error: 'You can only change services at your own place.' })
  }
  await serviceRepo.remove(req.params.id, req.user.placeId)
  res.status(204).end()
})

module.exports = { router, STATUSES }
