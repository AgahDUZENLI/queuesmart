// Database access for user_credentials, user_profile, session and saved_place.
// Routes call these functions and never write SQL themselves.
// Every function returns the same "user" shape the API already sends:
//   { id, role, firstName, lastName, email, emailMe, placeId? (admin), savedPlaceIds? (user) }
// The password hash is only returned by findCredentialsByEmail.

const crypto = require('crypto')
const db = require('./db')

class EmailTakenError extends Error {}

const UNIQUE_VIOLATION = '23505'
const MAX_ID_TRIES = 10

// A random 6-digit id. Uniqueness is enforced by the primary key, not by scanning a list.
const randomId = () => crypto.randomInt(100000, 1000000)

const USER_COLUMNS = `
  c.id, c.role, c.email, p.first_name, p.last_name, p.email_me, p.place_id
  FROM user_credentials c JOIN user_profile p ON p.user_id = c.id`

async function toUser(row, queryFn = db.query) {
  if (!row) return null
  const user = {
    id: row.id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailMe: row.email_me,
  }
  if (row.role === 'admin') user.placeId = row.place_id
  if (row.role === 'user') {
    const saved = await queryFn('SELECT place_id FROM saved_place WHERE user_id = $1 ORDER BY place_id', [row.id])
    user.savedPlaceIds = saved.rows.map((r) => r.place_id)
  }
  return user
}

async function findByEmail(email) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} WHERE c.email = $1`, [email])
  return toUser(rows[0])
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} WHERE c.id = $1`, [id])
  return toUser(rows[0])
}

// The only place the password hash is read: used by login
async function findCredentialsByEmail(email) {
  const { rows } = await db.query('SELECT id, password_hash FROM user_credentials WHERE email = $1', [email])
  return rows[0] ? { id: rows[0].id, passwordHash: rows[0].password_hash } : null
}

// Inserts the credentials row, the profile row and (for admins) their place in ONE transaction,
// so a failure never leaves half an account behind. Retries when the random id is already taken.
// placeId can be passed to give an admin's place a fixed join code (used by the demo data).
async function createUser({ role, firstName, lastName, email, passwordHash, emailMe, placeName, placeId, phone = null }) {
  for (let attempt = 0; attempt < MAX_ID_TRIES; attempt++) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const userId = randomId()
      let adminPlaceId = null
      if (role === 'admin') {
        adminPlaceId = placeId || randomId()
        await client.query('INSERT INTO place (id, name) VALUES ($1, $2)', [adminPlaceId, placeName])
      }
      await client.query(
        'INSERT INTO user_credentials (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [userId, email, passwordHash, role],
      )
      await client.query(
        'INSERT INTO user_profile (user_id, email, first_name, last_name, phone, email_me, place_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, email, firstName, lastName, phone, emailMe, adminPlaceId],
      )
      await client.query('COMMIT')
      return await findById(userId)
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      if (err.code !== UNIQUE_VIOLATION) throw err
      // Duplicate email, or just a random id collision? Only a collision is worth retrying.
      if (await findByEmail(email)) throw new EmailTakenError('Email is already registered.')
    } finally {
      client.release()
    }
  }
  throw new Error('Could not generate a unique id.')
}

async function createSession(userId) {
  const token = crypto.randomUUID()
  await db.query('INSERT INTO session (token, user_id) VALUES ($1, $2)', [token, userId])
  return token
}

// Returns the signed-in user for a token, or null. Anything that is not a valid UUID is
// rejected before it reaches the uuid column.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findUserByToken(token) {
  if (!UUID_PATTERN.test(token)) return null
  const { rows } = await db.query('SELECT user_id FROM session WHERE token = $1', [token])
  return rows[0] ? findById(rows[0].user_id) : null
}

async function deleteSession(token) {
  if (!UUID_PATTERN.test(token)) return
  await db.query('DELETE FROM session WHERE token = $1', [token])
}

// ---- Profile (user_profile table): name, contact info and preferences ----

function toProfile(row) {
  return {
    id: row.user_id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    phone: row.phone,
    emailMe: row.email_me,
  }
}

async function getProfile(userId) {
  const { rows } = await db.query(
    `SELECT p.user_id, c.role, p.email, p.first_name, p.last_name, p.phone, p.email_me
     FROM user_profile p JOIN user_credentials c ON c.id = p.user_id WHERE p.user_id = $1`,
    [userId],
  )
  return rows[0] ? toProfile(rows[0]) : null
}

// Changes the editable profile fields. Fields left undefined keep their current value.
// phone: null clears it. The email is never changed here: it belongs to the login.
async function updateProfile(userId, { firstName, lastName, phone, emailMe }) {
  const current = await getProfile(userId)
  if (!current) return null
  await db.query(
    'UPDATE user_profile SET first_name = $2, last_name = $3, phone = $4, email_me = $5 WHERE user_id = $1',
    [
      userId,
      firstName === undefined ? current.firstName : firstName,
      lastName === undefined ? current.lastName : lastName,
      phone === undefined ? current.phone : phone,
      emailMe === undefined ? current.emailMe : emailMe,
    ],
  )
  return getProfile(userId)
}

async function savePlace(userId, placeId) {
  await db.query('INSERT INTO saved_place (user_id, place_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, placeId])
}

module.exports = {
  EmailTakenError,
  findByEmail,
  findById,
  findCredentialsByEmail,
  createUser,
  createSession,
  findUserByToken,
  deleteSession,
  getProfile,
  updateProfile,
  savePlace,
}
