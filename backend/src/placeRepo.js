// Database access for places and users' saved places.

const db = require('./db')

async function findById(id) {
  const placeId = Number(id)
  if (!Number.isInteger(placeId)) return null
  const { rows } = await db.query('SELECT id, name FROM place WHERE id = $1', [placeId])
  return rows[0] || null
}

async function listSaved(userId) {
  const { rows } = await db.query(
    `SELECT p.id, p.name FROM saved_place sp
     JOIN place p ON p.id = sp.place_id
     WHERE sp.user_id = $1 ORDER BY p.name, p.id`,
    [userId],
  )
  return rows
}

async function addSaved(userId, placeId) {
  await db.query(
    'INSERT INTO saved_place (user_id, place_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, placeId],
  )
}

async function removeSaved(userId, placeId) {
  const parsedPlaceId = Number(placeId)
  if (!Number.isInteger(parsedPlaceId)) return false
  const result = await db.query('DELETE FROM saved_place WHERE user_id = $1 AND place_id = $2', [userId, parsedPlaceId])
  return result.rowCount > 0
}

module.exports = { findById, listSaved, addSaved, removeSaved }
