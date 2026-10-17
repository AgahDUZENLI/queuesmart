const { createApp } = require('./app')
const { loadDemoData } = require('./demo')

const PORT = process.env.PORT || 4000

loadDemoData()

createApp().listen(PORT, () => {
  console.log(`QueueSmart API listening on http://localhost:${PORT}`)
})
