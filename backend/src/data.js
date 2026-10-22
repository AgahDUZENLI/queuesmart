// In-memory data (no database until A4). Restarting the server resets it.

const crypto = require('crypto')

const data = {
  users: [],
  sessions: {}, // token -> user id
  places: [], // offices, shops, clinics... each run by an admin. id = 6-digit join code
  services: [],
  queueEntries: [],
}

// A random, unused 6-digit id, e.g. 482913. Used for users, places, services and
// tickets, and can become the primary key when a database is added in A4.
function newId(list) {
  let id
  do {
    id = crypto.randomInt(100000, 1000000)
  } while (list.some((item) => item.id === id))
  return id
}

// Used by tests to start each one from empty data
function reset() {
  data.users = []
  data.sessions = {}
  data.places = []
  data.services = []
  data.queueEntries = []
}

module.exports = { data, newId, reset }
