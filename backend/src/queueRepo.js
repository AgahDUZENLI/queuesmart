// Database access for service queues and their ticket entries.

const crypto = require('crypto')
const db = require('./db')
const services = require('./serviceRepo')

const PRIORITY_ORDER = { High: 0, Normal: 1, Low: 2 }
const ACTIVE_STATUSES = ['waiting', 'serving']
const MAX_ID_TRIES = 10

class QueueError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function mapEntry(row) {
  return {
    id: row.entry_id,
    queueId: row.queue_id,
    serviceId: row.service_id,
    placeId: row.place_id,
    userId: row.user_id,
    ticket: row.ticket,
    serviceName: row.service_name,
    priority: row.entry_priority,
    status: row.entry_status,
    queueOrder: row.position,
    joinedAt: new Date(row.joined_at).toISOString(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    closeNotified: row.close_notified,
    name: `${row.first_name} ${row.last_name}`,
  }
}

// Cast the queue FK join because pg-mem doesn't match its integer values directly.
const ENTRY_SELECT = `
  SELECT e.id AS entry_id, e.queue_id, q.service_id, s.place_id, e.user_id,
         e.ticket, e.service_name, e.priority AS entry_priority,
         e.status AS entry_status, e.position, e.joined_at, e.started_at,
         e.completed_at, e.close_notified, p.first_name, p.last_name
  FROM queue_entry e
  JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text)
  JOIN service s ON s.id = q.service_id
  JOIN user_profile p ON p.user_id = e.user_id`

// A no-op update acquires the queue row lock in both PostgreSQL and pg-mem.
async function lockQueue(client, queueId) {
  await client.query('UPDATE queue SET status = status WHERE id = $1', [queueId])
}

async function serviceContext(serviceId, queryFn = db.query) {
  const service = await services.findById(serviceId, queryFn)
  if (!service) return null
  const { rows } = await queryFn('SELECT id FROM queue WHERE service_id = $1', [Number(serviceId)])
  if (!rows[0]) return null
  return { service, queueId: rows[0].id }
}

async function entriesForQueue(queueId, status) {
  const { rows } = await db.query(
    `${ENTRY_SELECT} WHERE q.id = $1
     ORDER BY CASE e.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END,
              e.position, e.id`,
    [queueId],
  )
  const entries = rows.map(mapEntry)
  return status ? entries.filter((entry) => entry.status === status) : entries
}

async function entriesForUser(userId) {
  const { rows } = await db.query(
    `${ENTRY_SELECT} WHERE CAST(e.user_id AS text) = CAST($1 AS text)
     ORDER BY e.joined_at DESC, e.id DESC`,
    [userId],
  )
  return rows.map(mapEntry)
}

async function recentVisitMinutes(serviceId) {
  const { rows } = await db.query(
    `SELECT started_at, completed_at FROM queue_entry e
     JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text)
     WHERE q.service_id = $1 AND e.status = 'served'
       AND e.started_at IS NOT NULL AND e.completed_at IS NOT NULL
     ORDER BY e.completed_at DESC, e.id DESC`,
    [Number(serviceId)],
  )
  const today = new Date().toDateString()
  return rows
    .filter((row) => new Date(row.completed_at).toDateString() === today)
    .slice(0, 5)
    .map((row) => Math.max(0, Date.parse(row.completed_at) - Date.parse(row.started_at)) / 60000)
}

async function minutesPerPerson(service) {
  const visits = await recentVisitMinutes(service.id)
  return [...visits, ...Array(5 - visits.length).fill(service.duration)]
    .reduce((sum, minutes) => sum + minutes, 0) / 5
}

async function servingMinutesLeft(service, serving) {
  if (!serving) return 0
  const elapsed = (Date.now() - Date.parse(serving.startedAt)) / 60000
  return Math.max(1, await minutesPerPerson(service) - elapsed)
}

async function waitFromNow(service, waitingAhead, serving) {
  const average = await minutesPerPerson(service)
  return Math.ceil(Number(((await servingMinutesLeft(service, serving)) + average * Math.max(0, waitingAhead)).toFixed(2)))
}

async function summary(service, queueId) {
  const [waiting, servingRows, average, visits] = await Promise.all([
    entriesForQueue(queueId, 'waiting'),
    entriesForQueue(queueId, 'serving'),
    minutesPerPerson(service),
    recentVisitMinutes(service.id),
  ])
  return {
    waiting: waiting.length,
    wait: await waitFromNow(service, waiting.length, servingRows[0]),
    averageDuration: Math.round(average),
    measuredVisits: visits.length,
  }
}

async function userTicket(userId) {
  const entries = await entriesForUser(userId)
  const active = entries.find((entry) => ACTIVE_STATUSES.includes(entry.status))
  const entry = active || entries[0]
  if (!entry) return { ticket: null, recent: null }

  const context = await serviceContext(entry.serviceId)
  const service = context ? context.service : null
  if (!active) {
    return {
      ticket: null,
      recent: {
        ...entry,
        service: service || { name: entry.serviceName },
      },
    }
  }
  if (!service || !context) return { ticket: null, recent: null }

  const waiting = await entriesForQueue(context.queueId, 'waiting')
  const servingRows = await entriesForQueue(context.queueId, 'serving')
  const serving = servingRows[0]
  const position = entry.status === 'serving'
    ? 0
    : waiting.findIndex((ticket) => ticket.id === entry.id) + 1
  const peopleAhead = entry.status === 'serving' ? 0 : position - 1 + (serving ? 1 : 0)
  return {
    ticket: {
      ...entry,
      position,
      peopleAhead,
      estimatedWaitMinutes: entry.status === 'serving' ? 0 : await waitFromNow(service, position - 1, serving),
      service: { ...service, ...await summary(service, context.queueId) },
    },
    recent: null,
  }
}

async function orderByPriorityAndWait(listedServices) {
  const ranked = await Promise.all(listedServices.map(async (service) => {
    const context = await serviceContext(service.id)
    if (!context) return { service, oldest: Infinity }
    const waiting = await entriesForQueue(context.queueId, 'waiting')
    return {
      service,
      oldest: waiting.length ? Math.min(...waiting.map((entry) => Date.parse(entry.joinedAt))) : Infinity,
    }
  }))
  return ranked
    .sort((a, b) => PRIORITY_ORDER[a.service.priority] - PRIORITY_ORDER[b.service.priority]
      || a.oldest - b.oldest || a.service.name.localeCompare(b.service.name))
    .map(({ service }) => service)
}

async function adminQueues(placeId) {
  const listedServices = await services.listByPlace(placeId)
  const queues = await Promise.all(listedServices.map(async (service) => {
    const context = await serviceContext(service.id)
    const [waiting, servingRows, stats] = await Promise.all([
      entriesForQueue(context.queueId, 'waiting'),
      entriesForQueue(context.queueId, 'serving'),
      summary(service, context.queueId),
    ])
    const serving = servingRows[0]
    return {
      ...service,
      ...stats,
      queue: waiting.map((entry, index) => ({
        ...entry,
        waiting: Math.max(0, Math.floor((Date.now() - Date.parse(entry.joinedAt)) / 60000)),
        position: index + 1,
      })),
      nowServing: serving ? {
        ...serving,
        started: new Date(serving.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        minutesIn: Math.max(0, Math.floor((Date.now() - Date.parse(serving.startedAt)) / 60000)),
        minutesLeft: Math.ceil(await servingMinutesLeft(service, serving)),
      } : null,
    }
  }))

  return orderByPriorityAndWait(queues)
}

async function insertId(table, client) {
  for (let attempt = 0; attempt < MAX_ID_TRIES; attempt += 1) {
    const id = crypto.randomInt(100000, 1000000)
    const { rows } = await client.query(`SELECT id FROM ${table} WHERE id = $1`, [id])
    if (rows.length === 0) return id
  }
  throw new Error(`Could not generate a unique ${table} id.`)
}

async function join(serviceId, userId) {
  if (!Number.isInteger(Number(serviceId))) throw new QueueError(404, 'Service not found.')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows: contexts } = await client.query(
      `SELECT s.id AS service_id, s.place_id, s.name, s.max_in_line, q.id AS queue_id, q.status
       FROM service s JOIN queue q ON q.service_id = s.id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [Number(serviceId)],
    )
    let context = contexts[0]
    if (!context) throw new QueueError(404, 'Service not found.')
    await lockQueue(client, context.queue_id)
    const { rows: currentContexts } = await client.query(
      `SELECT s.id AS service_id, s.place_id, s.name, s.max_in_line, q.id AS queue_id, q.status
       FROM service s JOIN queue q ON q.service_id = s.id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [Number(serviceId)],
    )
    context = currentContexts[0]
    if (!context) throw new QueueError(404, 'Service not found.')
    if (context.status !== 'Open') throw new QueueError(409, `This service is ${context.status.toLowerCase()} and is not accepting new tickets.`)

    const { rows: existing } = await client.query(
      'SELECT status FROM queue_entry WHERE CAST(user_id AS text) = CAST($1 AS text)',
      [userId],
    )
    if (existing.some((entry) => ACTIVE_STATUSES.includes(entry.status))) {
      throw new QueueError(409, 'You are already in a queue. Leave it before joining another one.')
    }

    const { rows: queueEntries } = await client.query(
      `SELECT e.id, e.position, e.status FROM queue_entry e
       JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text) WHERE q.id = $1`,
      [context.queue_id],
    )
    const waiting = queueEntries.filter((entry) => entry.status === 'waiting')
    if (waiting.length >= context.max_in_line) throw new QueueError(409, 'This queue is full.')

    const nextNumber = queueEntries.length + 1
    const position = Math.max(0, ...queueEntries
      .filter((entry) => ACTIVE_STATUSES.includes(entry.status))
      .map((entry) => entry.position)) + 1
    const id = await insertId('queue_entry', client)
    await client.query(
      `INSERT INTO queue_entry
        (id, queue_id, user_id, ticket, service_name, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, context.queue_id, userId, `${context.name[0].toUpperCase()}-${String(nextNumber).padStart(3, '0')}`,
        context.name, position],
    )
    await client.query('COMMIT')
    const result = await userTicket(userId)
    return { ticket: result.ticket, serviceId: Number(serviceId) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505' && error.constraint === 'one_active_ticket_per_user') {
      throw new QueueError(409, 'You are already in a queue. Leave it before joining another one.')
    }
    throw error
  } finally {
    client.release()
  }
}

async function findTicket(ticketId) {
  if (!Number.isInteger(Number(ticketId))) return null
  const { rows } = await db.query(`${ENTRY_SELECT} WHERE e.id = $1`, [Number(ticketId)])
  return rows[0] ? mapEntry(rows[0]) : null
}

async function removeTicket(ticketId, user) {
  if (!Number.isInteger(Number(ticketId))) throw new QueueError(404, 'Active queue ticket not found.')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT queue_id FROM queue_entry WHERE id = $1',
      [Number(ticketId)],
    )
    if (!rows[0]) throw new QueueError(404, 'Active queue ticket not found.')
    await lockQueue(client, rows[0].queue_id)
    const { rows: entryRows } = await client.query(
      `${ENTRY_SELECT} WHERE e.id = $1 AND e.status IN ('waiting', 'serving')`,
      [Number(ticketId)],
    )
    if (!entryRows[0]) throw new QueueError(404, 'Active queue ticket not found.')
    const entry = mapEntry(entryRows[0])
    if (user.role === 'user' && entry.userId !== user.id) {
      throw new QueueError(403, 'You can only leave your own queue ticket.')
    }
    if (user.role === 'admin' && entry.placeId !== user.placeId) {
      throw new QueueError(403, 'You can only manage queues at your own place.')
    }
    const status = user.role === 'user' ? 'left' : 'removed'
    await client.query('UPDATE queue_entry SET status = $2 WHERE id = $1', [entry.id, status])
    await client.query('COMMIT')
    return { ...entry, status }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function updateTicket(serviceId, placeId, ticketId, { priority, position }) {
  if (!Number.isInteger(Number(serviceId))) throw new QueueError(404, 'Service not found.')
  if (!Number.isInteger(Number(ticketId))) throw new QueueError(404, 'Waiting queue ticket not found.')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows: contexts } = await client.query(
      `SELECT q.id AS queue_id FROM queue q JOIN service s ON s.id = q.service_id
       WHERE s.id = $1 AND s.place_id = $2 AND s.deleted_at IS NULL`,
      [Number(serviceId), placeId],
    )
    if (!contexts[0]) {
      const { rows } = await client.query('SELECT id FROM service WHERE id = $1 AND deleted_at IS NULL', [Number(serviceId)])
      throw new QueueError(rows[0] ? 403 : 404, rows[0] ? 'You can only manage queues at your own place.' : 'Service not found.')
    }
    const queueId = contexts[0].queue_id
    await lockQueue(client, queueId)
    const { rows: owned } = await client.query(
      `SELECT id FROM service WHERE id = $1 AND place_id = $2 AND deleted_at IS NULL`,
      [Number(serviceId), placeId],
    )
    if (!owned[0]) throw new QueueError(404, 'Service not found.')
    const { rows: targetRows } = await client.query(
      `${ENTRY_SELECT} WHERE e.id = $1 AND q.id = $2 AND e.status = 'waiting'`,
      [Number(ticketId), queueId],
    )
    if (!targetRows[0]) throw new QueueError(404, 'Waiting queue ticket not found.')

    const { rows } = await client.query(
      `${ENTRY_SELECT} WHERE q.id = $1 AND e.status = 'waiting'
       ORDER BY CASE e.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END, e.position, e.id`,
      [queueId],
    )
    const tickets = rows.map(mapEntry)
    const current = tickets.find((ticket) => ticket.id === Number(ticketId))
    const nextPriority = priority === undefined ? current.priority : priority
    if (position !== undefined && (position < 1 || position > tickets.length || !Number.isInteger(position))) {
      throw new QueueError(400, 'Position must be a whole number between 1 and the number of waiting tickets.')
    }
    if (position !== undefined) {
      const proposed = [...tickets]
      proposed.splice(proposed.findIndex((ticket) => ticket.id === current.id), 1)
      proposed.splice(position - 1, 0, { ...current, priority: nextPriority })
      if (proposed[position - 1].priority !== nextPriority) {
        throw new QueueError(409, 'A ticket can only move within its priority group.')
      }
      const sameGroup = proposed.slice(0, position - 1).every((ticket) => PRIORITY_ORDER[ticket.priority] <= PRIORITY_ORDER[nextPriority])
        && proposed.slice(position).every((ticket) => PRIORITY_ORDER[ticket.priority] >= PRIORITY_ORDER[nextPriority])
      if (!sameGroup) throw new QueueError(409, 'A ticket can only move within its priority group.')
      await client.query(
        'UPDATE queue_entry SET priority = $2 WHERE id = $1',
        [current.id, nextPriority],
      )
      for (let index = 0; index < proposed.length; index += 1) {
        await client.query('UPDATE queue_entry SET position = $2 WHERE id = $1', [proposed[index].id, index + 1])
      }
    } else if (priority !== undefined) {
      await client.query('UPDATE queue_entry SET priority = $2 WHERE id = $1', [current.id, nextPriority])
    }
    await client.query('COMMIT')
    const queue = await entriesForQueue(queueId, 'waiting')
    const updated = queue.find((ticket) => ticket.id === current.id)
    return { ticket: updated, queue }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function serveNext(serviceId, placeId) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const context = await ownedQueue(client, serviceId, placeId)
    const { rows: serving } = await client.query(
      `${ENTRY_SELECT} WHERE q.id = $1 AND e.status = 'serving'`,
      [context.queueId],
    )
    if (serving.length) throw new QueueError(409, 'Complete the current ticket before calling the next person.')
    const { rows } = await client.query(
      `${ENTRY_SELECT} WHERE q.id = $1 AND e.status = 'waiting'
       ORDER BY CASE e.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END, e.position, e.id
       LIMIT 1`,
      [context.queueId],
    )
    if (!rows[0]) throw new QueueError(409, 'There are no waiting tickets.')
    const entry = mapEntry(rows[0])
    await client.query("UPDATE queue_entry SET status = 'serving', started_at = now() WHERE id = $1", [entry.id])
    await client.query('COMMIT')
    return { ...entry, status: 'serving', startedAt: new Date().toISOString(), service: context.service }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function completeCurrent(serviceId, placeId, status) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const context = await ownedQueue(client, serviceId, placeId)
    const { rows } = await client.query(
      `${ENTRY_SELECT} WHERE q.id = $1 AND e.status = 'serving'`,
      [context.queueId],
    )
    if (!rows[0]) throw new QueueError(409, 'There is no ticket currently being served.')
    const entry = mapEntry(rows[0])
    await client.query(
      "UPDATE queue_entry SET status = $2, completed_at = CASE WHEN $2 = 'served' THEN now() ELSE completed_at END WHERE id = $1",
      [entry.id, status],
    )
    await client.query('COMMIT')
    return { ...entry, status, completedAt: status === 'served' ? new Date().toISOString() : null, service: context.service }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function ownedQueue(client, serviceId, placeId) {
  if (!Number.isInteger(Number(serviceId))) throw new QueueError(404, 'Service not found.')
  const { rows: initial } = await client.query(
    `SELECT q.id AS queue_id, s.id AS service_id, s.place_id, s.name, s.description,
            s.duration, s.priority, s.max_in_line, s.opens, s.closes, s.appointments,
            q.status
     FROM queue q JOIN service s ON s.id = q.service_id
     WHERE s.id = $1 AND s.place_id = $2 AND s.deleted_at IS NULL`,
    [Number(serviceId), placeId],
  )
  if (initial[0]) await lockQueue(client, initial[0].queue_id)
  const { rows } = await client.query(
    `SELECT q.id AS queue_id, s.id AS service_id, s.place_id, s.name, s.description,
            s.duration, s.priority, s.max_in_line, s.opens, s.closes, s.appointments,
            q.status
     FROM queue q JOIN service s ON s.id = q.service_id
     WHERE s.id = $1 AND s.place_id = $2 AND s.deleted_at IS NULL`,
    [Number(serviceId), placeId],
  )
  if (!rows[0]) {
    const { rows: found } = await client.query('SELECT id FROM service WHERE id = $1 AND deleted_at IS NULL', [Number(serviceId)])
    throw new QueueError(found[0] ? 403 : 404, found[0] ? 'You can only manage queues at your own place.' : 'Service not found.')
  }
  return {
    queueId: rows[0].queue_id,
    service: {
      id: rows[0].service_id,
      placeId: rows[0].place_id,
      name: rows[0].name,
      description: rows[0].description,
      duration: rows[0].duration,
      priority: rows[0].priority,
      maxInLine: rows[0].max_in_line,
      status: rows[0].status,
      opens: String(rows[0].opens).slice(0, 5),
      closes: String(rows[0].closes).slice(0, 5),
      appointments: rows[0].appointments,
    },
  }
}

async function markCloseNotified(ticketId) {
  await db.query('UPDATE queue_entry SET close_notified = true WHERE id = $1', [ticketId])
}

module.exports = {
  QueueError,
  serviceContext,
  entriesForQueue,
  entriesForUser,
  userTicket,
  adminQueues,
  join,
  findTicket,
  removeTicket,
  updateTicket,
  serveNext,
  completeCurrent,
  markCloseNotified,
  summary,
  waitFromNow,
  minutesPerPerson,
  orderByPriorityAndWait,
}
