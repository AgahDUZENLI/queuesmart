// Places: the offices, shops and clinics that use QueueSmart.
//
// A place's id is a 6-digit number that doubles as its join code. Users add a
// place to "My places" by typing the code or scanning the place's QR code.
// The QR code is just a link to the front end with the code in it

const express = require('express')
const placeRepo = require('./placeRepo')
const serviceRepo = require('./serviceRepo')
const { requireAuth, requireAdmin } = require('./auth')
const { checkJoinCode } = require('./validation')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const router = express.Router()

// GET /api/places/code/:code - look up a place and its services by join code
router.get('/code/:code', async (req, res) => {
  const place = await placeRepo.findById(req.params.code)
  if (!place) return res.status(404).json({ error: 'No place has that code.' })
  res.json({ place, services: await serviceRepo.listByPlace(place.id) })
})

// GET /api/places/saved - the signed-in user's places
router.get('/saved', requireAuth, async (req, res) => {
  res.json({ places: await placeRepo.listSaved(req.user.id) })
})

// POST /api/places/saved  { code } - add a place by its join code
router.post('/saved', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can add places.' })
  const code = (req.body || {}).code
  const error = checkJoinCode(code)
  if (error) return res.status(400).json({ error: 'Validation failed.', fields: { code: error } })

  const place = await placeRepo.findById(code)
  if (!place) return res.status(404).json({ error: 'No place has that code.' })

  await placeRepo.addSaved(req.user.id, place.id)
  res.status(201).json({ place, services: await serviceRepo.listByPlace(place.id) })
})

// DELETE /api/places/saved/:id - remove a place from the user's list
router.delete('/saved/:id', requireAuth, async (req, res) => {
  const placeId = Number(req.params.id)
  if (!await placeRepo.removeSaved(req.user.id, placeId)) {
    return res.status(404).json({ error: 'That place is not in your list.' })
  }
  res.status(204).end()
})

// GET /api/places/mine (admin) - the admin's place (its id is the code) and the QR link to share
router.get('/mine', requireAuth, requireAdmin, async (req, res) => {
  const place = await placeRepo.findById(req.user.placeId)
  res.json({ place, joinLink: `${FRONTEND_URL}/?code=${place.id}` })
})

module.exports = { router }
