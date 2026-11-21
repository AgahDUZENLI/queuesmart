const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const { readReportFilters, csvCell, reportToCsv, buildReport, localTime } = require('../src/reports')

const auth = (response) => ({ Authorization: `Bearer ${response.body.token}` })

let app
let adminAuth
let userAuth
let transcriptsId
let advisingId

async function register(body) {
  return request(app).post('/api/auth/register').send({ lastName: 'Test', password: 'correct-horse', ...body })
}

async function addService(headers, name, priority = 'Normal') {
  const result = await request(app).post('/api/services').set(headers).send({
    name, description: 'Report fixture.', duration: 15, priority, status: 'Open',
  })
  return result.body.service.id
}

beforeEach(async () => {
  app = createApp()
  const admin = await register({ role: 'admin', firstName: 'Cara', placeName: 'Advising Office', email: 'admin@example.edu' })
  const otherAdmin = await register({ role: 'admin', firstName: 'Dan', placeName: 'Clinic', email: 'other@example.edu' })
  const user = await register({ firstName: 'Ada', email: 'ada@example.edu' })
  await register({ firstName: 'Bob', email: 'bob@example.edu' })
  adminAuth = auth(admin)
  userAuth = auth(user)
  transcriptsId = await addService(adminAuth, 'Transcripts')
  advisingId = await addService(adminAuth, 'Advising', 'High')
  const clinicId = await addService(auth(otherAdmin), 'Checkup')

  const { rows: queues } = await db.query('SELECT id, service_id FROM queue')
  const queueOf = new Map(queues.map((queue) => [queue.service_id, queue.id]))
  const { rows: users } = await db.query('SELECT id, email FROM user_credentials')
  const userOf = new Map(users.map((row) => [row.email, row.id]))

  const fixture = [
    [1, transcriptsId, 'Transcripts', 'ada@example.edu', 'T-001', 'served', '2026-11-02T15:00:00Z', '2026-11-02T15:10:00Z', '2026-11-02T15:30:00Z'],
    [2, transcriptsId, 'Transcripts', 'bob@example.edu', 'T-002', 'no-show', '2026-11-02T16:00:00Z', '2026-11-02T16:20:00Z', null],
    [3, advisingId, 'Advising', 'ada@example.edu', 'A-001', 'left', '2026-11-10T15:00:00Z', null, null],
    [4, advisingId, 'Advising', 'bob@example.edu', 'A-002', 'served', '2026-11-15T15:00:00Z', '2026-11-15T15:04:00Z', '2026-11-15T15:14:00Z'],
    [5, clinicId, 'Checkup', 'bob@example.edu', 'C-001', 'served', '2026-11-15T15:00:00Z', '2026-11-15T15:01:00Z', '2026-11-15T15:02:00Z'],
  ]
  for (const [id, serviceId, serviceName, email, ticket, status, joinedAt, startedAt, completedAt] of fixture) {
    await db.query(
      `INSERT INTO queue_entry
        (id, queue_id, user_id, ticket, service_name, priority, position, status, joined_at, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'Normal', $1, $6, $7, $8, $9)`,
      [id, queueOf.get(serviceId), userOf.get(email), ticket, serviceName, status, joinedAt, startedAt, completedAt],
    )
  }
})

describe('report filters', () => {
  test('accepts empty or valid filters', () => {
    expect(readReportFilters({})).toMatchObject({ errors: null, from: null, to: null, serviceId: null })
    expect(readReportFilters({ from: '2026-11-01', to: '2026-11-30', serviceId: '7' })).toMatchObject({ errors: null, serviceId: 7 })
  })

  test('rejects bad dates, reversed ranges and bad service ids', () => {
    expect(readReportFilters({ from: '11/01/2026' }).errors.from).toMatch(/date/)
    expect(readReportFilters({ to: '2026-13-45' }).errors.to).toMatch(/date/)
    expect(readReportFilters({ from: '2026-11-10', to: '2026-11-01' }).errors.to).toMatch(/after/)
    expect(readReportFilters({ serviceId: 'abc' }).errors.serviceId).toBeTruthy()
  })
})

describe('CSV helpers', () => {
  test('quotes cells with commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(null)).toBe('')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  test('builds an empty report without visits', () => {
    const report = buildReport({ id: 1, name: 'Empty' }, [], [], { from: null, to: null, serviceId: null })
    expect(report.summary).toMatchObject({ total: 0, customers: 0, averageWaitMinutes: 0, averageServiceMinutes: 0 })
    expect(reportToCsv(report)).toContain('All services')
  })
})

describe('time zone', () => {
  test('tests run on Houston time, like the Docker backend', () => {
    expect(process.env.TZ).toBe('America/Chicago')
  })

  test('CSV times are local office time, not UTC', () => {
    expect(localTime('2026-11-15T15:00:00Z')).toBe('2026-11-15 09:00') // CST
    expect(localTime('2026-07-01T15:00:00Z')).toBe('2026-07-01 10:00') // CDT
    expect(localTime(null)).toBe('')
  })
})

describe('GET /api/reports', () => {
  test('is for admins only', async () => {
    await request(app).get('/api/reports').expect(401)
    await request(app).get('/api/reports').set(userAuth).expect(403)
  })

  test('reports customers, services and statistics for the admin place only', async () => {
    const { body } = await request(app).get('/api/reports').set(adminAuth).expect(200)
    expect(body.place.name).toBe('Advising Office')
    expect(body.summary).toMatchObject({ total: 4, customers: 2, served: 2, noShow: 1, left: 1, averageWaitMinutes: 11, averageServiceMinutes: 15 })
    expect(body.visits.map((visit) => visit.ticket)).toEqual(['A-002', 'A-001', 'T-002', 'T-001'])
    expect(body.visits[0]).toMatchObject({ name: 'Bob Test', email: 'bob@example.edu', serviceName: 'Advising', waitedMinutes: 4, servedMinutes: 10 })
    expect(body.services).toEqual([ // sorted by name
      expect.objectContaining({ name: 'Advising', priority: 'High', tickets: 2, served: 1, left: 1, averageWaitMinutes: 4 }),
      expect.objectContaining({ name: 'Transcripts', tickets: 2, served: 1, noShow: 1, averageWaitMinutes: 15, hours: '09:00-16:30', status: 'Open' }),
    ])
    expect(body.customers).toEqual([
      expect.objectContaining({ name: 'Ada Test', visits: 2, served: 1, left: 1 }),
      expect.objectContaining({ name: 'Bob Test', visits: 2, served: 1, noShow: 1 }),
    ])
  })

  test('filters by date range and service', async () => {
    const dated = await request(app).get('/api/reports?from=2026-11-05&to=2026-11-12').set(adminAuth).expect(200)
    expect(dated.body.visits.map((visit) => visit.ticket)).toEqual(['A-001'])

    const byService = await request(app).get(`/api/reports?serviceId=${transcriptsId}`).set(adminAuth).expect(200)
    expect(byService.body.services.map((service) => service.name)).toEqual(['Transcripts'])
    expect(byService.body.summary.total).toBe(2)

    // 9 PM in Houston on Nov 2 is already Nov 3 in UTC, but it still counts as Nov 2
    await db.query("UPDATE queue_entry SET joined_at = '2026-11-03T03:00:00Z' WHERE id = 2")
    const lateNight = await request(app).get('/api/reports?from=2026-11-02&to=2026-11-02').set(adminAuth).expect(200)
    expect(lateNight.body.visits.map((visit) => visit.ticket)).toEqual(['T-002', 'T-001'])

    const bad = await request(app).get('/api/reports?from=yesterday').set(adminAuth).expect(400)
    expect(bad.body.fields.from).toBeTruthy()
  })

  test('marks deleted services and keeps their history', async () => {
    await request(app).delete(`/api/services/${advisingId}`).set(adminAuth).expect(204)
    const { body } = await request(app).get('/api/reports').set(adminAuth).expect(200)
    expect(body.services.find((service) => service.name === 'Advising').status).toBe('Deleted')
    expect(body.summary.total).toBe(4)
  })

  test('keeps old service names on past tickets but groups them under the renamed service', async () => {
    await request(app).put(`/api/services/${transcriptsId}`).set(adminAuth).send({ name: 'Registrar' }).expect(200)
    const { body } = await request(app).get(`/api/reports?serviceId=${transcriptsId}`).set(adminAuth).expect(200)
    expect(body.services).toEqual([expect.objectContaining({ name: 'Registrar', tickets: 2, served: 1 })])
    expect(body.visits[0]).toMatchObject({ serviceName: 'Transcripts', currentServiceName: 'Registrar' })

    const csv = (await request(app).get(`/api/reports?format=csv&serviceId=${transcriptsId}`).set(adminAuth)).text
    expect(csv).toContain(',Transcripts (now Registrar),served,')
    expect(csv).toContain('Registrar,Normal,15,Open,')
  })

  test('downloads the report as CSV', async () => {
    const response = await request(app).get(`/api/reports?format=csv&serviceId=${advisingId}`).set(adminAuth).expect(200)
    expect(response.headers['content-type']).toMatch(/text\/csv/)
    expect(response.headers['content-disposition']).toMatch(/queuesmart-report\.csv/)
    const csv = response.text
    expect(csv).toContain('QueueSmart report,Advising Office')
    expect(csv).toContain('Service,Advising')
    expect(csv).toMatch(/Summary\nTotal tickets/)
    expect(csv).toContain('Advising,High,15,Open,09:00-16:30,2,1,0,1,4')
    expect(csv).toContain('Bob Test,bob@example.edu,1,1,0,0,')
    expect(csv).toContain('2026-11-15 09:00,A-002,Bob Test,bob@example.edu,Advising,served,4,10,2026-11-15 09:14')
    expect(csv).not.toContain('T-001')
  })
})
