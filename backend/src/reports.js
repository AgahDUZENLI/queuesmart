// Reports module: one admin report for their place, as JSON or as a CSV download.
// Built from the persisted queue entries, filtered by date range and service.

const express = require('express')
const db = require('./db')
const { requireAuth, requireAdmin } = require('./auth')
const { checkWholeNumber, findErrors } = require('./validation')
const { minutesBetween, buildStats } = require('./history')

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Validates ?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId= (all optional)
function readReportFilters(query) {
  const q = query || {}
  const checkDate = (value, label) => (value === undefined || (DATE.test(value) && !Number.isNaN(Date.parse(value)))
    ? ''
    : `${label} must be a date like 2026-11-20.`)
  const errors = findErrors({
    from: checkDate(q.from, 'From'),
    to: checkDate(q.to, 'To') || (q.from && q.to && q.to < q.from ? 'To must be on or after From.' : ''),
    serviceId: q.serviceId === undefined ? '' : checkWholeNumber(Number(q.serviceId), 'Service', 1, Number.MAX_SAFE_INTEGER),
  })
  return {
    errors,
    from: q.from || null,
    to: q.to || null,
    serviceId: q.serviceId === undefined ? null : Number(q.serviceId),
  }
}

// Keeps visits whose join day (server time) is inside the range and that match the service
function inRange(visit, { from, to, serviceId }) {
  const joined = new Date(visit.joinedAt)
  if (from && joined < new Date(`${from}T00:00:00`)) return false
  if (to && joined > new Date(`${to}T23:59:59.999`)) return false
  return !serviceId || visit.serviceId === serviceId
}

const average = (numbers) => (numbers.length ? Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length) : 0)
const count = (visits, status) => visits.filter((visit) => visit.status === status).length

// Turns the place's services and visits into the report's three sections
function buildReport(place, services, allVisits, filters) {
  const visits = allVisits
    .filter((visit) => inRange(visit, filters))
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt) || b.id - a.id)

  const currentNames = new Map(services.map((service) => [service.id, service.name]))
  const servicesReport = services
    .filter((service) => !filters.serviceId || service.id === filters.serviceId)
    .map((service) => {
      const mine = visits.filter((visit) => visit.serviceId === service.id)
      return {
        name: service.name,
        priority: service.priority,
        duration: service.duration,
        status: service.deleted ? 'Deleted' : service.status,
        hours: `${service.opens}-${service.closes}`,
        tickets: mine.length,
        served: count(mine, 'served'),
        noShow: count(mine, 'no-show'),
        left: count(mine, 'left'),
        averageWaitMinutes: average(mine.map((visit) => visit.waitedMinutes).filter((wait) => wait !== null)),
      }
    })

  const customers = new Map()
  for (const visit of visits) {
    const customer = customers.get(visit.email) || { name: visit.name, email: visit.email, visits: 0, served: 0, noShow: 0, left: 0, lastVisit: visit.joinedAt }
    customer.visits += 1
    if (visit.status === 'served') customer.served += 1
    if (visit.status === 'no-show') customer.noShow += 1
    if (visit.status === 'left') customer.left += 1
    customers.set(visit.email, customer)
  }

  const stats = buildStats(visits)
  return {
    place,
    generatedAt: new Date().toISOString(),
    filters: { from: filters.from, to: filters.to, serviceId: filters.serviceId },
    summary: {
      ...stats,
      customers: customers.size,
      averageServiceMinutes: average(visits.map((visit) => visit.servedMinutes).filter((minutes) => minutes !== null)),
    },
    services: servicesReport,
    customers: [...customers.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)),
    // serviceName is the name when the person joined; currentServiceName is today's name.
    // Totals above group by service id, so a rename never splits a service's numbers.
    visits: visits.map(({ id, serviceId, startedAt, ...visit }) => ({
      ...visit,
      currentServiceName: currentNames.get(serviceId) || visit.serviceName,
    })),
  }
}

// "Transcripts & Records (now Registrar)" when the service was renamed after the visit
function serviceLabel(visit) {
  return visit.serviceName === visit.currentServiceName
    ? visit.serviceName
    : `${visit.serviceName} (now ${visit.currentServiceName})`
}

// "2026-11-19 14:52" in the server's time zone (TZ), which spreadsheets read as a date and time
function localTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Quotes a CSV cell when it has a comma, quote or line break
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const csvRows = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\n')

// One CSV file with a block per section, separated by blank lines
function reportToCsv(report) {
  const { summary } = report
  return [
    csvRows([
      ['QueueSmart report', report.place.name],
      ['Generated', localTime(report.generatedAt)],
      ['From', report.filters.from || 'All time'],
      ['To', report.filters.to || 'All time'],
      ['Service', report.filters.serviceId ? report.services[0]?.name : 'All services'],
    ]),
    csvRows([
      ['Summary'],
      ['Total tickets', 'Customers', 'Served', 'Left', 'No-shows', 'Removed', 'Average wait (min)', 'Average visit (min)'],
      [summary.total, summary.customers, summary.served, summary.left, summary.noShow, summary.removed, summary.averageWaitMinutes, summary.averageServiceMinutes],
    ]),
    csvRows([
      ['Services'],
      ['Service', 'Priority', 'Duration (min)', 'Status', 'Hours', 'Tickets', 'Served', 'No-shows', 'Left', 'Average wait (min)'],
      ...report.services.map((s) => [s.name, s.priority, s.duration, s.status, s.hours, s.tickets, s.served, s.noShow, s.left, s.averageWaitMinutes]),
    ]),
    csvRows([
      ['Customers'],
      ['Name', 'Email', 'Visits', 'Served', 'No-shows', 'Left', 'Last visit'],
      ...report.customers.map((c) => [c.name, c.email, c.visits, c.served, c.noShow, c.left, localTime(c.lastVisit)]),
    ]),
    csvRows([
      ['Visits'],
      ['Joined', 'Ticket', 'Name', 'Email', 'Service', 'Outcome', 'Waited (min)', 'Visit length (min)', 'Completed'],
      ...report.visits.map((v) => [localTime(v.joinedAt), v.ticket, v.name, v.email, serviceLabel(v), v.status, v.waitedMinutes, v.servedMinutes, localTime(v.completedAt)]),
    ]),
  ].join('\n\n') + '\n'
}

async function loadPlaceData(placeId) {
  const [{ rows: places }, { rows: services }, { rows: entries }] = await Promise.all([
    db.query('SELECT id, name FROM place WHERE CAST(id AS text) = CAST($1 AS text)', [placeId]),
    db.query(
      `SELECT s.id, s.name, s.priority, s.duration, s.opens, s.closes, s.deleted_at, q.status
       FROM service s JOIN queue q ON q.service_id = s.id
       WHERE CAST(s.place_id AS text) = CAST($1 AS text)
       ORDER BY s.name, s.id`,
      [placeId],
    ),
    db.query(
      `SELECT e.id, e.ticket, e.status, e.joined_at, e.started_at, e.completed_at, e.service_name,
              s.id AS service_id, u.first_name || ' ' || u.last_name AS name, u.email
       FROM queue_entry e
       JOIN queue q ON CAST(q.id AS text) = CAST(e.queue_id AS text)
       JOIN service s ON s.id = q.service_id
       JOIN user_profile u ON u.user_id = e.user_id
       WHERE CAST(s.place_id AS text) = CAST($1 AS text)`,
      [placeId],
    ),
  ])
  const time = (value) => String(value).slice(0, 5)
  return {
    place: places[0],
    services: services.map((row) => ({
      id: row.id,
      name: row.name,
      priority: row.priority,
      duration: row.duration,
      opens: time(row.opens),
      closes: time(row.closes),
      status: row.status,
      deleted: Boolean(row.deleted_at),
    })),
    visits: entries.map((row) => {
      const iso = (value) => (value ? new Date(value).toISOString() : null)
      const joinedAt = iso(row.joined_at)
      const startedAt = iso(row.started_at)
      const completedAt = iso(row.completed_at)
      return {
        id: row.id,
        serviceId: row.service_id,
        ticket: row.ticket,
        status: row.status,
        name: row.name,
        email: row.email,
        serviceName: row.service_name,
        joinedAt,
        startedAt,
        completedAt,
        waitedMinutes: minutesBetween(joinedAt, startedAt),
        servedMinutes: minutesBetween(startedAt, completedAt),
      }
    }),
  }
}

const router = express.Router()

// GET /api/reports?from=&to=&serviceId=&format=csv - report for the signed-in admin's place
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const filters = readReportFilters(req.query)
  if (filters.errors) return res.status(400).json({ error: 'Validation failed.', fields: filters.errors })

  const data = await loadPlaceData(req.user.placeId)
  const report = buildReport(data.place, data.services, data.visits, filters)

  if (req.query.format === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', 'attachment; filename="queuesmart-report.csv"')
    return res.send(reportToCsv(report))
  }
  res.json(report)
})

module.exports = { router, readReportFilters, buildReport, reportToCsv, csvCell, serviceLabel, localTime }
