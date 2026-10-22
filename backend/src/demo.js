// Demo data loaded when the server starts, so the UI can be tried right away.
// Matches the sample places and services in the front end.

const { data } = require('./data')
const { createUser } = require('./auth')
const { addService } = require('./services')

const hours = { opens: '09:00', closes: '16:30' }
const DEMO_USERS = [
  { firstName: 'Demo', lastName: 'User', email: 'user@queuesmart.test' },
  { firstName: 'Demo', lastName: 'User2', email: 'user2@queuesmart.test' },
  { firstName: 'Demo', lastName: 'User3', email: 'user3@queuesmart.test' },
  { firstName: 'Demo', lastName: 'User4', email: 'user4@queuesmart.test' },
]

function addAdmin(firstName, placeName, email, code) {
  const admin = createUser({ role: 'admin', firstName, lastName: 'Admin', placeName, email, password: 'demo-pass-123' })
  // Swap the random code for a fixed one so the demo is easy to try
  const place = data.places.find((p) => p.id === admin.placeId)
  place.id = code
  admin.placeId = code
  return place
}

function loadDemoData() {
  const campus = addAdmin('Demo', 'Student Services Center', 'admin@queuesmart.test', 123456)
  addAdmin('Tia', 'Main Street Tire Shop', 'tires@queuesmart.test', 234567)
  addAdmin('Cal', 'Eastside Health Clinic', 'clinic@queuesmart.test', 345678)

  for (const account of DEMO_USERS) {
    const user = createUser({ role: 'user', ...account, password: 'demo-pass-123' })
    user.savedPlaceIds.push(campus.id)
  }

  const atCampus = { placeId: campus.id, ...hours }
  addService({
    name: 'Academic Advising',
    description: 'Meet with an advisor about course planning and academic goals.',
    duration: 15, priority: 'Normal', maxInLine: 40, status: 'Open', appointments: true, ...atCampus,
  })
  addService({
    name: 'Financial Aid',
    description: 'Get help with financial aid applications and awards.',
    duration: 20, priority: 'Normal', maxInLine: 35, status: 'Open', appointments: true, ...atCampus,
  })
  addService({
    name: 'Registrar',
    description: 'Support for records, transcripts, and enrollment.',
    duration: 10, priority: 'Normal', maxInLine: 30, status: 'Open', appointments: false, ...atCampus,
  })
  addService({
    name: 'Counseling Intake',
    description: 'Start a confidential conversation with Counseling Services.',
    duration: 30, priority: 'High', maxInLine: 20, status: 'Open', appointments: true, ...atCampus,
  })
  addService({
    name: 'IT Help Desk',
    description: 'Troubleshoot account, device, and campus technology issues.',
    duration: 12, priority: 'Normal', maxInLine: 25, status: 'Paused', appointments: false, ...atCampus,
  })
  addService({
    name: 'Career Coaching',
    description: 'Get guidance on resumes, interviews, and career planning.',
    duration: 25, priority: 'Low', maxInLine: 25, status: 'Closed', appointments: true, ...atCampus,
  })
}

module.exports = { loadDemoData }
