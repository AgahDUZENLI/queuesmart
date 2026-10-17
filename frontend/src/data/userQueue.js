// Mock data for the user side.
// Places and services now come from the backend. These mock line numbers stay
// until the Queue module is built, and are matched to services by name.
// waiting = people in line now, wait = estimated wait in minutes for someone joining now.
export const mockQueueNumbers = [
  { id: 'advising', placeId: 'student-services', name: 'Academic Advising', room: 'Room 210', status: 'Open', waiting: 6, wait: 18 },
  { id: 'financial-aid', placeId: 'student-services', name: 'Financial Aid', room: 'Room 114', status: 'Open', waiting: 4, wait: 22 },
  { id: 'registrar', placeId: 'student-services', name: 'Registrar', room: 'Room 102', status: 'Open', waiting: 2, wait: 6 },
  { id: 'counseling', placeId: 'student-services', name: 'Counseling Intake', room: 'Room 305', status: 'Open', waiting: 3, wait: 35 },
  { id: 'it-help', placeId: 'student-services', name: 'IT Help Desk', room: 'Room 120', status: 'Paused', waiting: 0, wait: 0 },
  { id: 'career', placeId: 'student-services', name: 'Career Coaching', room: 'Room 220', status: 'Closed', waiting: 0, wait: 0 },
]

// The queue the user is in when the app starts (null = not in a queue yet).
// Example of a ticket: { serviceId: 'advising', number: 'A-042', peopleAhead: 2, waitAtJoin: 18, joinedAt: '2:21 PM' }
export const initialTicket = null

export const initialNotifications = []

export const initialHistory = [
  { Date: '2026-09-25', Place: 'Student Services Center', Service: 'Registrar', Outcome: 'Served' },
  { Date: '2026-09-16', Place: 'Student Services Center', Service: 'IT Help Desk', Outcome: 'Served' },
  { Date: '2026-09-09', Place: 'Student Services Center', Service: 'Academic Advising', Outcome: 'Left queue' },
  { Date: '2026-08-29', Place: 'Student Services Center', Service: 'Financial Aid', Outcome: 'No-show' },
]
