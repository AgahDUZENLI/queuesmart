// Demo data loaded when the server starts, so the UI can be tried right away.
// Matches the sample places and services in the front end.

const { createUser } = require('./auth')
const users = require('./userRepo')
const services = require('./serviceRepo')

const hours = { opens: '09:00', closes: '16:30' }
const DEMO_USERS = [
  { firstName: 'Maya', lastName: 'Robinson', email: 'user@queuesmart.test' },
  { firstName: 'Jordan', lastName: 'Lee', email: 'user2@queuesmart.test' },
  { firstName: 'Priya', lastName: 'Shah', email: 'user3@queuesmart.test' },
  { firstName: 'Sam', lastName: 'Carter', email: 'user4@queuesmart.test' },
]

// Admins get a fixed join code so the demo is easy to try
function addAdmin(firstName, placeName, email, placeId) {
  return createUser({ role: 'admin', firstName, lastName: 'Admin', placeName, email, password: 'demo-pass-123', placeId })
}

// The database keeps accounts between restarts, so they are only created once.
async function loadDemoAccounts() {
  const existing = await users.findByEmail('admin@queuesmart.test')
  if (existing) return existing

  const campus = await addAdmin('Demo', 'Student Services Center', 'admin@queuesmart.test', 123456)
  await addAdmin('Tia', 'Main Street Tire Shop', 'tires@queuesmart.test', 234567)
  await addAdmin('Cal', 'Eastside Health Clinic', 'clinic@queuesmart.test', 345678)

  for (const account of DEMO_USERS) {
    const user = await createUser({ role: 'user', ...account, password: 'demo-pass-123' })
    await users.savePlace(user.id, campus.placeId)
  }
  return campus
}

async function loadDemoData() {
  const campus = await loadDemoAccounts()

  const atCampus = { placeId: campus.placeId, ...hours }
  const demoServices = [{
    name: 'Academic Advising',
    description: 'Meet with an advisor about course planning and academic goals.',
    duration: 15, priority: 'Normal', maxInLine: 40, status: 'Open', appointments: true, ...atCampus,
  }, {
    name: 'Financial Aid',
    description: 'Get help with financial aid applications and awards.',
    duration: 20, priority: 'Normal', maxInLine: 35, status: 'Open', appointments: true, ...atCampus,
  }, {
    name: 'Registrar',
    description: 'Support for records, transcripts, and enrollment.',
    duration: 10, priority: 'Normal', maxInLine: 30, status: 'Open', appointments: false, ...atCampus,
  }, {
    name: 'Counseling Intake',
    description: 'Start a confidential conversation with Counseling Services.',
    duration: 30, priority: 'High', maxInLine: 20, status: 'Open', appointments: true, ...atCampus,
  }, {
    name: 'IT Help Desk',
    description: 'Troubleshoot account, device, and campus technology issues.',
    duration: 12, priority: 'Normal', maxInLine: 25, status: 'Paused', appointments: false, ...atCampus,
  }, {
    name: 'Career Coaching',
    description: 'Get guidance on resumes, interviews, and career planning.',
    duration: 25, priority: 'Low', maxInLine: 25, status: 'Closed', appointments: true, ...atCampus,
  }]
  const existing = await services.listByPlace(campus.placeId)
  for (const service of demoServices) {
    if (!existing.some((candidate) => candidate.name === service.name)) {
      await services.create(service)
    }
  }
}

module.exports = { loadDemoData }
