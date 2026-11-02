// Authentication module: register, login, logout, and route guards.
// Accounts and sessions are stored in PostgreSQL (see userRepo.js and db/schema.sql).

const crypto = require('crypto')
const { promisify } = require('util')
const express = require('express')
const users = require('./userRepo')
const { checkText, checkEmail, checkPassword, checkPhone, checkTrueFalse, findErrors } = require('./validation')

const scrypt = promisify(crypto.scrypt)

// Passwords are stored as "salt:hash" using Node's built-in scrypt, never as plain text.
// The async version keeps the server responsive while a password is being hashed.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`
}

async function passwordMatches(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = await scrypt(password, salt, 64)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

// Used when the email is unknown, so a miss takes as long as a wrong password
// and the response time does not reveal which emails have accounts.
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`

async function createUser({ role, firstName, lastName, email, password, placeName, emailMe, placeId, phone }) {
  return users.createUser({
    role,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await hashPassword(password),
    emailMe: emailMe !== false,
    placeName: role === 'admin' ? placeName.trim() : undefined,
    placeId,
    phone: phone && phone.trim() ? phone.trim() : null,
  })
}

async function startSession(user) {
  return { user, token: await users.createSession(user.id) }
}

async function requireAuth(req, res, next) {
  const token = (req.get('Authorization') || '').replace('Bearer ', '')
  const user = await users.findUserByToken(token)
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' })
  req.user = user
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
// { firstName, lastName, email, password, phone?, emailMe?, role? ('user' or 'admin'), placeName (admins only) }
router.post('/register', async (req, res) => {
  const body = req.body || {}
  const role = body.role || 'user'
  const errors = findErrors({
    role: role === 'user' || role === 'admin' ? '' : 'Role must be user or admin.',
    firstName: checkText(body.firstName, 'First name'),
    lastName: checkText(body.lastName, 'Last name'),
    email: checkEmail(body.email),
    password: checkPassword(body.password),
    phone: checkPhone(body.phone),
    placeName: role === 'admin' ? checkText(body.placeName, 'Place name') : '',
    emailMe: body.emailMe === undefined ? '' : checkTrueFalse(body.emailMe, 'Email me'),
  })
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  try {
    // placeId is not accepted from the request: only the demo loader may choose a join code
    const user = await createUser({ ...body, role, placeId: undefined })
    res.status(201).json(await startSession(user))
  } catch (err) {
    // The UNIQUE constraint on user_credentials.email is what really stops duplicates
    if (err instanceof users.EmailTakenError) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }
    throw err
  }
})

// POST /api/auth/login  { email, password, role? }
router.post('/login', async (req, res) => {
  const body = req.body || {}
  const errors = findErrors({
    email: checkEmail(body.email),
    password: checkText(body.password, 'Password', 64),
    role: body.role === undefined || body.role === 'user' || body.role === 'admin' ? '' : 'Role must be user or admin.',
  })
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const credentials = await users.findCredentialsByEmail(body.email.trim().toLowerCase())
  const matches = await passwordMatches(body.password, credentials ? credentials.passwordHash : DUMMY_HASH)
  if (!credentials || !matches) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }

  const user = await users.findById(credentials.id)
  // The admin sign-in page sends role: 'admin' so regular users can't sign in there
  if (body.role && body.role !== user.role) {
    return res.status(403).json({ error: `This is not ${body.role === 'admin' ? 'an admin' : 'a user'} account.` })
  }

  res.json(await startSession(user))
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await users.deleteSession(req.token)
  res.status(204).end()
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

module.exports = { router, createUser, requireAuth, requireAdmin, hashPassword, passwordMatches }
