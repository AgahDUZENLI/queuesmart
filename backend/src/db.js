// PostgreSQL connection. DATABASE_URL is set in docker-compose.yml.
// Tests swap in an in-memory database with setPool (see tests/setup.js).

const { Pool } = require('pg')

let pool = null

function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

function setPool(replacement) {
  pool = replacement
}

const query = (text, params) => getPool().query(text, params)
const connect = () => getPool().connect()

module.exports = { query, connect, setPool }
