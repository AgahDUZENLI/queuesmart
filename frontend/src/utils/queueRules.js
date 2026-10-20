// Business rules for joining and waiting in a queue.

// Basic estimate: each person ahead takes one service-duration interval.
export function minutesPerPerson(service) {
  return Math.max(0, Number(service.duration) || 0)
}

// Estimated wait = people ahead of you × minutes per person
export function estimateWait(service, peopleAhead) {
  return Math.ceil(Math.max(0, peopleAhead) * minutesPerPerson(service))
}

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

// 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th ...
export function ordinal(number) {
  if (number === 1) return '1st'
  if (number === 2) return '2nd'
  if (number === 3) return '3rd'
  return `${number}th`
}
