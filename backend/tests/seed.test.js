const request = require('supertest')
const { createApp } = require('../src/app')
const db = require('../src/db')
const { seedDemoHistory, randomGenerator, zoneOffsetMinutes } = require('../src/seed')

// A fixed Wednesday afternoon in Houston
const NOW = new Date('2026-11-18T20:00:00Z')

async function adminReport(query = '') {
  const app = createApp()
  const login = await request(app).post('/api/auth/login')
    .send({ email: 'admin@queuesmart.test', password: 'demo-pass-123', role: 'admin' })
  return (await request(app).get(`/api/reports${query}`).set({ Authorization: `Bearer ${login.body.token}` })).body
}

describe('seed helpers', () => {
  test('the random generator repeats for the same seed', () => {
    const a = randomGenerator(7)
    const b = randomGenerator(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  test('knows the Houston offset in summer and winter', () => {
    expect(zoneOffsetMinutes('America/Chicago', new Date('2026-07-01T12:00:00Z'))).toBe(300)
    expect(zoneOffsetMinutes('America/Chicago', new Date('2026-12-01T12:00:00Z'))).toBe(360)
  })
})

describe('seedDemoHistory', () => {
  jest.setTimeout(30000)

  test('loads users, history and live queues once, with the planned edge cases', async () => {
    const first = await seedDemoHistory({ now: NOW })
    expect(first.skipped).toBe(false)
    expect(first.tickets).toBeGreaterThan(300)
    expect(await seedDemoHistory({ now: NOW })).toEqual({ skipped: true })

    const { rows: active } = await db.query("SELECT user_id, queue_id, status FROM queue_entry WHERE status IN ('waiting', 'serving')")
    expect(new Set(active.map((row) => row.user_id)).size).toBe(active.length) // one active ticket per person
    expect(active.filter((row) => row.status === 'serving')).toHaveLength(1)

    const report = await adminReport()
    const names = report.customers.map((customer) => customer.name)
    expect(names).toEqual(expect.arrayContaining(["Liam O'Connor", 'José Núñez', 'Chris "CJ" Johnson', 'Robert Davis, Jr.']))
    expect(names).not.toContain('Noah Kim') // never joined
    expect(names).not.toContain('Zoe Patel') // other places only
    expect(report.customers[0].name).toBe('Jordan Lee') // most visits

    const service = (name) => report.services.find((item) => item.name === name)
    expect(service('Career Coaching').tickets).toBe(0)
    expect(service('Library Help Desk')).toMatchObject({ status: 'Deleted' })
    expect(service('Library Help Desk').tickets).toBeGreaterThan(0)
    expect(report.visits.some((visit) => visit.serviceName === 'Transcripts & Records')).toBe(true)
    expect(Math.max(...report.visits.map((visit) => visit.waitedMinutes ?? 0))).toBeGreaterThan(90)
    expect(report.visits.some((visit) => visit.waitedMinutes === 0)).toBe(true)
    expect(Math.max(...report.visits.map((visit) => visit.servedMinutes ?? 0))).toBeGreaterThanOrEqual(60)
    expect(report.summary.noShow).toBeGreaterThan(0)
    expect(report.summary.removed).toBeGreaterThan(0)
  })
})
