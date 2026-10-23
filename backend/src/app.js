const express = require('express')
const cors = require('cors')
const auth = require('./auth')
const places = require('./places')
const services = require('./services')
const queues = require('./queues')
const history = require('./history')
const notifications = require('./notifications')
function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))


  app.use('/api/auth', auth.router)
  app.use('/api/places', places.router)
  app.use('/api/services', services.router)
  app.use('/api/queues', queues.router)
  app.use('/api/history', history.router)
  app.use('/api/notifications', notifications.router)
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }))

  // Bad JSON bodies (status 400) and unexpected errors (500)
  app.use((err, req, res, next) => {
    const status = err.status || 500
    res.status(status).json({ error: status === 500 ? 'Something went wrong.' : 'Request body must be valid JSON.' })
  })

  return app
}

module.exports = { createApp }
