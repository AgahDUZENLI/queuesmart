// Database access for service rows and their one-to-one queues.

const crypto = require('crypto')
const db = require('./db')

const UNIQUE_VIOLATION = '23505'
const MAX_ID_TRIES = 10

const SERVICE_SELECT = `
  SELECT s.id, s.place_id, s.name, s.description, s.duration, s.priority,
         s.max_in_line, s.opens, s.closes, s.appointments, q.status
  FROM service s
  JOIN queue q ON q.service_id = s.id`

function mapService(row) {
  if (!row) return null
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    description: row.description,
    duration: row.duration,
    priority: row.priority,
    maxInLine: row.max_in_line,
    status: row.status,
    opens: String(row.opens).slice(0, 5),
    closes: String(row.closes).slice(0, 5),
    appointments: row.appointments,
  }
}

async function findById(id, queryFn = db.query) {
  const serviceId = Number(id)
  if (!Number.isInteger(serviceId)) return null
  const { rows } = await queryFn(`${SERVICE_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL`, [serviceId])
  return mapService(rows[0])
}

async function listByPlace(placeId) {
  if (!Number.isInteger(Number(placeId))) return []
  const { rows } = await db.query(
    `${SERVICE_SELECT} WHERE s.place_id = $1 AND s.deleted_at IS NULL ORDER BY
      CASE s.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END,
      s.name, s.id`,
    [placeId],
  )
  return rows.map(mapService)
}

async function listAll() {
  const { rows } = await db.query(
    `${SERVICE_SELECT} WHERE s.deleted_at IS NULL ORDER BY
      CASE s.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END,
      s.name, s.id`,
  )
  return rows.map(mapService)
}

async function create(fields) {
  for (let attempt = 0; attempt < MAX_ID_TRIES; attempt += 1) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const id = crypto.randomInt(100000, 1000000)
      await client.query(
        `INSERT INTO service
          (id, place_id, name, description, duration, priority, max_in_line, opens, closes, appointments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, fields.placeId, fields.name, fields.description, fields.duration, fields.priority,
          fields.maxInLine, fields.opens, fields.closes, fields.appointments],
      )
      await client.query(
        'INSERT INTO queue (id, service_id, status) VALUES ($1, $2, $3)',
        [crypto.randomInt(100000, 1000000), id, fields.status],
      )
      await client.query('COMMIT')
      return findById(id)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error.code !== UNIQUE_VIOLATION) throw error
      continue
    } finally {
      client.release()
    }
  }
  throw new Error('Could not generate unique service and queue ids.')
}

const SERVICE_COLUMNS = {
  name: 'name',
  description: 'description',
  duration: 'duration',
  priority: 'priority',
  maxInLine: 'max_in_line',
  opens: 'opens',
  closes: 'closes',
  appointments: 'appointments',
}

async function update(id, placeId, fields) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // The no-op update locks the service while it is validated and changed.
    await client.query(
      'UPDATE service SET name = name WHERE id = $1 AND place_id = $2 AND deleted_at IS NULL',
      [Number(id), placeId],
    )
    const { rows } = await client.query(
      `${SERVICE_SELECT} WHERE s.id = $1 AND s.place_id = $2 AND s.deleted_at IS NULL`,
      [Number(id), placeId],
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return null
    }

    const updates = Object.entries(SERVICE_COLUMNS).filter(([key]) => fields[key] !== undefined)
    if (updates.length > 0) {
      const assignments = updates.map(([key, column], index) => `${column} = $${index + 2}`)
      await client.query(
        `UPDATE service SET ${assignments.join(', ')} WHERE id = $1`,
        [Number(id), ...updates.map(([key]) => fields[key])],
      )
    }
    if (fields.status !== undefined) {
      await client.query('UPDATE queue SET status = status WHERE service_id = $1', [Number(id)])
      await client.query('UPDATE queue SET status = $2 WHERE service_id = $1', [Number(id), fields.status])
    }
    await client.query('COMMIT')
    return findById(id)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function remove(id, placeId) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // Lock the service before its queue to serialize deletion with service edits.
    await client.query(
      'UPDATE service SET name = name WHERE id = $1 AND place_id = $2 AND deleted_at IS NULL',
      [Number(id), placeId],
    )
    const { rows } = await client.query(
      'SELECT id FROM service WHERE id = $1 AND place_id = $2 AND deleted_at IS NULL',
      [Number(id), placeId],
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return false
    }
    await client.query('UPDATE queue SET status = status WHERE service_id = $1', [Number(id)])
    await client.query('UPDATE service SET deleted_at = now() WHERE id = $1', [Number(id)])
    await client.query("UPDATE queue SET status = 'Closed' WHERE service_id = $1", [Number(id)])
    await client.query(
      `UPDATE queue_entry SET status = 'removed'
       WHERE queue_id = (SELECT id FROM queue WHERE service_id = $1)
         AND status IN ('waiting', 'serving')`,
      [Number(id)],
    )
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

module.exports = { findById, listByPlace, listAll, create, update, remove }
