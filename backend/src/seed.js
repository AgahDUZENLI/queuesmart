// Example data for demos and reports: extra users plus six weeks of realistic queue history
// at the Student Services Center, with deliberate edge cases (see EDGE CASES below).
//
//   npm run seed                                  (local, uses DATABASE_URL)
//   docker compose exec backend npm run seed      (Docker)
//
// Runs once: if the seed users already exist it does nothing. Start over with
// `docker compose down -v && docker compose up -d`, then seed again.
//
// EDGE CASES
// - Names with an apostrophe, accents, quotes and a comma (CSV escaping, UTF-8)
// - Two different people with the same last name
// - Noah Kim has an account but never joined a queue (not in the Customers table)
// - Zoe Patel only visited other places (must not appear in the campus report)
// - Jordan Lee is a frequent visitor; Ethan Brooks keeps not showing up; Sofia Martinez keeps leaving
// - A deadline-day rush at Financial Aid: very long waits, and people still waiting at closing are removed
// - First person of the day waits 0 minutes; some visits last 1 minute, Counseling ones over an hour
// - Staff-raised High priority tickets served ahead of earlier Normal ones
// - Registrar was renamed: older tickets keep the old name "Transcripts & Records"
// - Library Help Desk was deleted: its history stays and it shows as Deleted
// - Career Coaching never had a visitor
// - Live queues right now: someone being served at Academic Advising, a line behind them
//   (one High priority), plus people waiting at Counseling Intake and Registrar
// - Weekends have no visits; Mondays are busier, Fridays quieter

const crypto = require('crypto')
const db = require('./db')
const { createUser } = require('./auth')
const users = require('./userRepo')
const services = require('./serviceRepo')
const { loadDemoData } = require('./demo')

const PASSWORD = 'demo-pass-123'
const CAMPUS = 123456
const TIRES = 234567
const CLINIC = 345678
const DAYS_BACK = 42

const SEED_USERS = [
  { firstName: 'Liam', lastName: "O'Connor", email: 'liam@queuesmart.test' },
  { firstName: 'José', lastName: 'Núñez', email: 'jose@queuesmart.test' },
  { firstName: 'Chris "CJ"', lastName: 'Johnson', email: 'cj@queuesmart.test' },
  { firstName: 'Robert', lastName: 'Davis, Jr.', email: 'robert@queuesmart.test' },
  { firstName: 'Marcus', lastName: 'Johnson', email: 'marcus@queuesmart.test' },
  { firstName: 'Aaliyah', lastName: 'Washington', email: 'aaliyah@queuesmart.test' },
  { firstName: 'Minh', lastName: 'Nguyen', email: 'minh@queuesmart.test' },
  { firstName: 'Fatima', lastName: 'Al-Sayed', email: 'fatima@queuesmart.test' },
  { firstName: 'Ethan', lastName: 'Brooks', email: 'ethan@queuesmart.test' },
  { firstName: 'Sofia', lastName: 'Martinez', email: 'sofia@queuesmart.test' },
  { firstName: 'Daniel', lastName: 'Okafor', email: 'daniel@queuesmart.test' },
  { firstName: 'Grace', lastName: 'Chen', email: 'grace@queuesmart.test' },
  { firstName: 'Hannah', lastName: 'Müller', email: 'hannah@queuesmart.test' },
  { firstName: 'Omar', lastName: 'Haddad', email: 'omar@queuesmart.test' },
  { firstName: 'Xavier', lastName: 'Thompson-Reyes', email: 'xavier@queuesmart.test' },
  { firstName: 'Noah', lastName: 'Kim', email: 'noah@queuesmart.test' },
  { firstName: 'Zoe', lastName: 'Patel', email: 'zoe@queuesmart.test' },
]

// Who visits the campus, and how often (higher weight = more visits)
const CAMPUS_VISITORS = {
  'user2@queuesmart.test': 6, // Jordan Lee, frequent visitor
  'user@queuesmart.test': 2,
  'user3@queuesmart.test': 2,
  'user4@queuesmart.test': 1,
  'liam@queuesmart.test': 2,
  'jose@queuesmart.test': 2,
  'cj@queuesmart.test': 2,
  'robert@queuesmart.test': 2,
  'marcus@queuesmart.test': 2,
  'aaliyah@queuesmart.test': 2,
  'minh@queuesmart.test': 2,
  'fatima@queuesmart.test': 2,
  'ethan@queuesmart.test': 2,
  'sofia@queuesmart.test': 2,
  'daniel@queuesmart.test': 2,
  'grace@queuesmart.test': 2,
  'hannah@queuesmart.test': 2,
  'omar@queuesmart.test': 1,
  'xavier@queuesmart.test': 1,
}

// Average arrivals per weekday at each campus service (Career Coaching: none)
const DAILY_ARRIVALS = {
  'Academic Advising': 7,
  'Financial Aid': 4,
  Registrar: 5,
  'Counseling Intake': 1.5,
  'IT Help Desk': 3,
  'Library Help Desk': 2,
}

// Small deterministic random generator (mulberry32), so every seed run matches
function randomGenerator(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Minutes the time zone is behind UTC at a given moment (300 for CDT, 360 for CST)
function zoneOffsetMinutes(timeZone, date) {
  const inZone = Date.parse(date.toLocaleString('en-US', { timeZone }))
  const inUtc = Date.parse(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  return Math.round((inUtc - inZone) / 60000)
}

// The calendar day (in the zone) that is `daysAgo` before `now`: { y, m, d, weekday }
function zoneDay(now, daysAgo, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now)
  const get = (type) => Number(parts.find((part) => part.type === type).value)
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') - daysAgo))
  return { y: day.getUTCFullYear(), m: day.getUTCMonth(), d: day.getUTCDate(), weekday: day.getUTCDay() }
}

// A Date for `minutes` after midnight on that zone day
function atMinute(day, minutes, timeZone) {
  const guess = new Date(Date.UTC(day.y, day.m, day.d) + minutes * 60000)
  return new Date(guess.getTime() + zoneOffsetMinutes(timeZone, guess) * 60000)
}

const OPEN = 9 * 60
const CLOSE = 16 * 60 + 30

// Plays one day of one queue: arrivals line up, staff serve High priority first, then
// in arrival order. Returns queue entries with realistic timestamps.
function simulateDay({ day, service, arrivals, random, pickVisitor, timeZone, rush = false }) {
  const people = Array.from({ length: arrivals }, () => {
    const email = pickVisitor()
    const roll = random()
    let outcome = 'served'
    if (email === 'ethan@queuesmart.test' && roll < 0.5) outcome = 'no-show'
    else if (email === 'sofia@queuesmart.test' && roll < 0.5) outcome = 'left'
    else if (roll < 0.06) outcome = 'left'
    else if (roll < 0.11) outcome = 'no-show'
    else if (roll < 0.13) outcome = 'removed'
    const at = rush ? OPEN + random() * 90 : OPEN + random() * (CLOSE - 30 - OPEN)
    return { email, outcome, at, priority: random() < 0.07 ? 'High' : 'Normal' }
  }).sort((a, b) => a.at - b.at)

  const done = []
  const waiting = []
  let clock = OPEN
  let next = 0
  while (next < people.length || waiting.length) {
    while (next < people.length && people[next].at <= clock) waiting.push(people[next++])
    if (!waiting.length) { clock = people[next].at; continue }
    const index = Math.max(0, waiting.findIndex((person) => person.priority === 'High'))
    const [person] = waiting.splice(index, 1)
    const entry = { ...person, serviceName: service.name, joinedAt: atMinute(day, person.at, timeZone) }

    if (clock > CLOSE + 15) entry.status = 'removed' // still in line when the office closed
    else if (person.outcome === 'left' || person.outcome === 'removed') entry.status = person.outcome
    else {
      const start = Math.max(clock, person.at)
      entry.startedAt = atMinute(day, start, timeZone)
      if (person.outcome === 'no-show') {
        entry.status = 'no-show'
        clock = start + 3
      } else {
        const longVisit = service.name === 'Counseling Intake' && random() < 0.3
        const length = longVisit ? 60 + random() * 20 : Math.max(1, Math.round(service.duration * (0.4 + random() * 1.1)))
        entry.status = 'served'
        entry.completedAt = atMinute(day, start + length, timeZone)
        clock = start + length
      }
    }
    done.push(entry)
  }
  return done
}

async function ensureService(placeId, fields) {
  const existing = (await services.listByPlace(placeId)).find((service) => service.name === fields.name)
  return existing || services.create({ placeId, opens: '09:00', closes: '16:30', maxInLine: 25, appointments: false, ...fields })
}

// Inserts entries in batches with unique random ids and per-queue ticket numbers
async function insertEntries(entries) {
  const { rows: idRows } = await db.query('SELECT id FROM queue_entry')
  const usedIds = new Set(idRows.map((row) => row.id))
  const { rows: countRows } = await db.query('SELECT queue_id, COUNT(*) AS count FROM queue_entry GROUP BY queue_id')
  const ticketCount = new Map(countRows.map((row) => [row.queue_id, Number(row.count)]))

  const rows = [...entries].sort((a, b) => a.joinedAt - b.joinedAt).map((entry) => {
    let id
    do id = crypto.randomInt(100000, 1000000); while (usedIds.has(id))
    usedIds.add(id)
    const number = (ticketCount.get(entry.queueId) || 0) + 1
    ticketCount.set(entry.queueId, number)
    const iso = (date) => (date ? date.toISOString() : null)
    return [id, entry.queueId, entry.userId, `${entry.serviceName[0].toUpperCase()}-${String(number).padStart(3, '0')}`,
      entry.serviceName, entry.priority, entry.position || number, entry.status,
      iso(entry.joinedAt), iso(entry.startedAt), iso(entry.completedAt)]
  })

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const values = batch.map((_, r) => `(${Array.from({ length: 11 }, (__, c) => `$${r * 11 + c + 1}`).join(', ')})`)
    await db.query(
      `INSERT INTO queue_entry
        (id, queue_id, user_id, ticket, service_name, priority, position, status, joined_at, started_at, completed_at)
       VALUES ${values.join(', ')}`,
      batch.flat(),
    )
  }
  return rows.length
}

async function seedDemoHistory({ now = new Date(), timeZone = process.env.SEED_TZ || 'America/Chicago' } = {}) {
  await loadDemoData()
  if (await users.findByEmail(SEED_USERS[0].email)) return { skipped: true }

  const userIds = {}
  for (const account of SEED_USERS) {
    const user = await createUser({ role: 'user', ...account, password: PASSWORD })
    if (account.email !== 'zoe@queuesmart.test') await users.savePlace(user.id, CAMPUS)
    userIds[account.email] = user.id
  }
  for (const email of ['user@queuesmart.test', 'user2@queuesmart.test', 'user3@queuesmart.test', 'user4@queuesmart.test']) {
    userIds[email] = (await users.findByEmail(email)).id
  }

  const library = await ensureService(CAMPUS, {
    name: 'Library Help Desk', description: 'Research help and study room bookings.', duration: 10, priority: 'Low', status: 'Open',
  })
  const checkup = await ensureService(CLINIC, {
    name: 'General Checkup', description: 'Walk-in checkups.', duration: 20, priority: 'High', status: 'Open',
  })
  const oilChange = await ensureService(TIRES, {
    name: 'Oil Change', description: 'Quick oil change.', duration: 30, priority: 'Normal', status: 'Open',
  })

  const { rows: queueRows } = await db.query('SELECT id, service_id FROM queue')
  const queueOf = new Map(queueRows.map((row) => [row.service_id, row.id]))
  const campusServices = await services.listByPlace(CAMPUS)
  const byName = (name) => campusServices.find((service) => service.name === name)

  const random = randomGenerator(4353)
  const visitorPool = Object.entries(CAMPUS_VISITORS).flatMap(([email, weight]) => Array(weight).fill(email))
  const pickVisitor = () => visitorPool[Math.floor(random() * visitorPool.length)]
  const entries = []
  const add = (service, list) => list.forEach((entry) => entries.push({
    ...entry, queueId: queueOf.get(service.id), userId: userIds[entry.email],
  }))

  for (let daysAgo = DAYS_BACK; daysAgo >= 1; daysAgo -= 1) {
    const day = zoneDay(now, daysAgo, timeZone)
    if (day.weekday === 0 || day.weekday === 6) continue
    const busyness = day.weekday === 1 ? 1.4 : day.weekday === 5 ? 0.7 : 1
    for (const [name, average] of Object.entries(DAILY_ARRIVALS)) {
      const service = byName(name)
      if (!service) continue
      if (name === 'Library Help Desk' && daysAgo < 28) continue // deleted four weeks ago
      const rush = name === 'Financial Aid' && daysAgo === 22 // aid deadline rush
      const arrivals = rush ? 24 : Math.round(average * busyness * (0.5 + random()))
      const list = simulateDay({ day, service, arrivals, random, pickVisitor, timeZone, rush })
      if (name === 'Registrar' && daysAgo > 21) list.forEach((entry) => { entry.serviceName = 'Transcripts & Records' })
      add(service, list)
    }
    // Zoe Patel only goes to the clinic and the tire shop
    if (daysAgo % 9 === 0) {
      const start = atMinute(day, OPEN + 60, timeZone)
      const later = (minutes) => new Date(start.getTime() + minutes * 60000)
      add(checkup, [{ email: 'zoe@queuesmart.test', serviceName: checkup.name, priority: 'Normal', status: 'served', joinedAt: start, startedAt: later(8), completedAt: later(25) }])
      add(oilChange, [{ email: 'zoe@queuesmart.test', serviceName: oilChange.name, priority: 'Normal', status: 'no-show', joinedAt: later(120), startedAt: later(150) }])
    }
  }

  // Live queues right now (skipping anyone who already has an active ticket)
  const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60000)
  const { rows: activeRows } = await db.query("SELECT user_id FROM queue_entry WHERE status IN ('waiting', 'serving')")
  const busy = new Set(activeRows.map((row) => row.user_id))
  const { rows: positionRows } = await db.query(
    "SELECT queue_id, MAX(position) AS position FROM queue_entry WHERE status IN ('waiting', 'serving') GROUP BY queue_id",
  )
  const lastPosition = new Map(positionRows.map((row) => [row.queue_id, Number(row.position)]))
  const { rows: servingRows } = await db.query("SELECT queue_id FROM queue_entry WHERE status = 'serving'")
  const servingQueues = new Set(servingRows.map((row) => row.queue_id))
  const live = [
    ['Academic Advising', 'aaliyah@queuesmart.test', 'serving', 18, 'Normal'],
    ['Academic Advising', 'minh@queuesmart.test', 'waiting', 14, 'Normal'],
    ['Academic Advising', 'grace@queuesmart.test', 'waiting', 9, 'Normal'],
    ['Academic Advising', 'fatima@queuesmart.test', 'waiting', 5, 'High'],
    ['Academic Advising', 'hannah@queuesmart.test', 'waiting', 2, 'Normal'],
    ['Counseling Intake', 'omar@queuesmart.test', 'waiting', 25, 'Normal'],
    ['Counseling Intake', 'xavier@queuesmart.test', 'waiting', 7, 'Normal'],
    ['Registrar', 'marcus@queuesmart.test', 'waiting', 4, 'Normal'],
  ]
  for (const [name, email, status, joined, priority] of live) {
    const service = byName(name)
    const queueId = queueOf.get(service.id)
    if (busy.has(userIds[email]) || (status === 'serving' && servingQueues.has(queueId))) continue
    const position = (lastPosition.get(queueId) || 0) + 1
    lastPosition.set(queueId, position)
    entries.push({
      email, queueId, userId: userIds[email], serviceName: name, priority, status, position,
      joinedAt: minutesAgo(joined), startedAt: status === 'serving' ? minutesAgo(6) : null,
    })
  }

  const inserted = await insertEntries(entries)
  await services.remove(library.id, CAMPUS)
  await db.query("UPDATE service SET deleted_at = $2 WHERE id = $1", [library.id, minutesAgo(28 * 24 * 60).toISOString()])
  return { skipped: false, users: SEED_USERS.length, tickets: inserted }
}

if (require.main === module) {
  seedDemoHistory()
    .then((result) => {
      console.log(result.skipped
        ? 'Seed data is already loaded. To start over: docker compose down -v && docker compose up -d'
        : `Seeded ${result.users} users and ${result.tickets} queue tickets. Every password is ${PASSWORD}.`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seeding failed:', error.message)
      process.exit(1)
    })
}

module.exports = { seedDemoHistory, simulateDay, randomGenerator, zoneOffsetMinutes, SEED_USERS }
