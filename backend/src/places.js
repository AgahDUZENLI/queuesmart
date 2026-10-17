// Places: the offices, shops and clinics that use QueueSmart.
//
// A place's id is a 6-digit number that doubles as its join code. Users add a
// place to "My places" by typing the code or scanning the place's QR code.
// The QR code is just a link to the front end with the code in it,
// e.g. http://localhost:5173/?code=482913

const express = require('express')
const { data } = require('./data')
const { requireAuth, requireAdmin } = require('./auth')
const { checkJoinCode } = require('./validation')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

function findPlaceByCode(code) {
  return data.places.find((place) => place.id === Number(code))
}

function servicesAt(place) {
  return data.services.filter((service) => service.placeId === place.id)
}

const router = express.Router()

// GET /api/places/code/:code - look up a place and its services by join code
router.get('/code/:code', (req, res) => {
  const place = findPlaceByCode(req.params.code)
  if (!place) return res.status(404).json({ error: 'No place has that code.' })
  res.json({ place, services: servicesAt(place) })
})

// GET /api/places/saved - the signed-in user's places
router.get('/saved', requireAuth, (req, res) => {
  const savedIds = req.user.savedPlaceIds || []
  res.json({ places: data.places.filter((place) => savedIds.includes(place.id)) })
})

// POST /api/places/saved  { code } - add a place by its join code
router.post('/saved', requireAuth, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can add places.' })
  const code = (req.body || {}).code
  const error = checkJoinCode(code)
  if (error) return res.status(400).json({ error: 'Validation failed.', fields: { code: error } })

  const place = findPlaceByCode(code)
  if (!place) return res.status(404).json({ error: 'No place has that code.' })

  const user = data.users.find((u) => u.id === req.user.id)
  if (!user.savedPlaceIds.includes(place.id)) user.savedPlaceIds.push(place.id)
  res.status(201).json({ place, services: servicesAt(place) })
})

// DELETE /api/places/saved/:id - remove a place from the user's list
router.delete('/saved/:id', requireAuth, (req, res) => {
  const user = data.users.find((u) => u.id === req.user.id)
  if (user.savedPlaceIds) user.savedPlaceIds = user.savedPlaceIds.filter((id) => id !== Number(req.params.id))
  res.status(204).end()
})

// GET /api/places/mine (admin) - the admin's place (its id is the code) and the QR link to share
router.get('/mine', requireAuth, requireAdmin, (req, res) => {
  const place = data.places.find((p) => p.id === req.user.placeId)
  res.json({ place, joinLink: `${FRONTEND_URL}/?code=${place.id}` })
})

module.exports = { router }
