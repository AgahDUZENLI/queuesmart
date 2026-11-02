const { createApp } = require('./app')
const { loadDemoData } = require('./demo')

const PORT = process.env.PORT || 4000

loadDemoData()
  .then(() => {
    createApp().listen(PORT, () => {
      console.log(`QueueSmart API listening on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Could not start: is the database running? (DATABASE_URL)', err.message)
    process.exit(1)
  })
