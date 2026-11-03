// Notifications remain in memory; account and queue data use PostgreSQL.

const crypto = require('crypto')

const data = {
  notifications: [],
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
  data.notifications = []
}

module.exports = { data, newId, reset }
