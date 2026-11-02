// Runs before every test file. Replaces PostgreSQL with pg-mem, an in-memory copy that
// loads the real db/schema.sql, so tests need no running database and still check the
// real constraints (UNIQUE, NOT NULL, enums, foreign keys).

const fs = require('fs')
const path = require('path')
const { newDb } = require('pg-mem')
const db = require('../src/db')

const memory = newDb()
memory.public.none(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'))
const { Pool } = memory.adapters.createPg()
db.setPool(new Pool())

// A clean snapshot of the empty schema, restored before every test
const emptyDatabase = memory.backup()
beforeEach(() => emptyDatabase.restore())
