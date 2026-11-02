// Profile routes: the signed-in person's name, contact info and preferences.
// Stored in the user_profile table (see userRepo.js). Works for users and admins.

const express = require('express')
const users = require('./userRepo')
const { requireAuth } = require('./auth')
const { checkText, checkPhone, checkTrueFalse, findErrors } = require('./validation')

const router = express.Router()

// GET /api/profile/me
// -> 200 { profile: { id, role, firstName, lastName, fullName, email, phone, emailMe } }
router.get('/me', requireAuth, async (req, res) => {
  res.json({ profile: await users.getProfile(req.user.id) })
})

// PUT /api/profile/me  { firstName, lastName, phone?, emailMe? }
// phone: '' or null clears it; leaving phone or emailMe out keeps the current value.
// The email cannot be changed here (it is the login), so it is ignored if sent.
router.put('/me', requireAuth, async (req, res) => {
  const body = req.body || {}
  const errors = findErrors({
    firstName: checkText(body.firstName, 'First name'),
    lastName: checkText(body.lastName, 'Last name'),
    phone: checkPhone(body.phone),
    emailMe: body.emailMe === undefined ? '' : checkTrueFalse(body.emailMe, 'Email me'),
  })
  if (errors) return res.status(400).json({ error: 'Validation failed.', fields: errors })

  const phone = body.phone === undefined ? undefined : (body.phone || '').trim() || null
  const profile = await users.updateProfile(req.user.id, {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    phone,
    emailMe: body.emailMe,
  })
  res.json({ profile })
})

module.exports = { router }
