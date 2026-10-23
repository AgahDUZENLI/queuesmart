// Business rules for joining and waiting in a queue.

// Priority levels for services and tickets (same list as backend/src/queues.js)
export const PRIORITIES = ['Low', 'Normal', 'High']

// Wait estimates come from the backend (estimatedWaitMinutes on the ticket, wait on each service).

// Returns why the user can't join, or '' when they can
export function checkCanJoin(service, ticket) {
  if (!service) return 'Please pick a service.'
  if (ticket) return 'You are already in a queue. Leave it before joining another one.'
  if (service.status !== 'Open') return `${service.name} is ${service.status.toLowerCase()} right now.`
  return ''
}

// Waiting → Almost ready (you are next) → Served
export function queueStatus(peopleAhead) {
  if (peopleAhead === 0) return 'Almost ready'
  return 'Waiting'
}

// How much of the wait has passed: 0 = just joined, 1 = your turn
export function waitProgress(ticket, minutesLeft) {
  if (!ticket.waitAtJoin) return 1
  return Math.min(1, Math.max(0, 1 - minutesLeft / ticket.waitAtJoin))
}

// 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th, 11 → 11th, 21 → 21st (same as ordinal in backend/src/queues.js)
export function ordinal(number) {
  const lastTwo = number % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`
  return number + ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th')
}
