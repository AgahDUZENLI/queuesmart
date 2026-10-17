// Authentication module: register, login, logout, and route guards.

const crypto = require('crypto')
const express = require('express')
const { data, newId } = require('./data')
const { checkText, checkEmail, checkPassword, findErrors } = require('./validation')

// Never send the password back to the client
function publicUser({ password, ...user }) {
  return user
}

function findUserByEmail(email) {
  return data.users.find((user) => user.email === email.trim().toLowerCase())
}

// Every admin runs one place. It is created when they register.
// The place's id is also the join code people type, or scan as a QR code.
function createPlace(name) {
  const place = { id: newId(data.places), name: name.trim() }
  data.places.push(place)
  return place
}

function createUser({ role, firstName, lastName, email, password, placeName, emailMe }) {
  const user = {
    id: newId(data.users),
    role,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    password,
    emailMe: emailMe !== false,
  }
  if (role === 'admin') user.placeId = createPlace(placeName).id
  if (role === 'user') user.savedPlaceIds = [] // places added with a code or QR scan
  data.users.push(user)
  return user
}

function startSession(user) {
  const token = crypto.randomUUID()
  data.sessions[token] = user.id
  return { user: publicUser(user), token }
}

function requireAuth(req, res, next) {
  const token = (req.get('Authorization') || '').replace('Bearer ', '')
  const user = data.users.find((u) => u.id === data.sessions[token])
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' })
  req.user = publicUser(user)
  req.token = token
  next()
}

// Use after requireAuth
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can do that.' })
  next()
}

const router = express.Router()

// POST /api/auth/register
// { firstName, lastName, email, password, emailMe?, role? ('user' or 'admin'), placeName (admins only) }
router.post('/register', (req, res) => {
  const body = req.body || {}
  const role = body.role || 'user'
  const errors = findErrors({
    role: role === 'user' || role === 'admin' ? '' : 'Role must be user or admin.',
    firstName: checkText(body.firstName, 'First name'),
    lastName: checkText(body.lastName, 'Last name'),
    email: checkEmail(body.email),
    password: checkPassword(body.password),
    placeName: role === 'admin' ? checkText(body.placeName, 'Place name') : '',
  })
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })
  if (findUserByEmail(body.email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' })
  }

  const user = createUser({ ...body, role })
  res.status(201).json(startSession(user))
})

// POST /api/auth/login  { email, password, role? }
router.post('/login', (req, res) => {
  const body = req.body || {}
  const errors = findErrors({
    email: checkEmail(body.email),
    password: checkText(body.password, 'Password', 64),
  })
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const user = findUserByEmail(body.email)
  if (!user || user.password !== body.password) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  // The admin sign-in page sends role: 'admin' so regular users can't sign in there
  if (body.role && body.role !== user.role) {
    return res.status(403).json({ error: `This is not ${body.role === 'admin' ? 'an admin' : 'a user'} account.` })
  }

  res.json(startSession(user))
})

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  delete data.sessions[req.token]
  res.status(204).end()
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

module.exports = { router, createUser, requireAuth, requireAdmin }
