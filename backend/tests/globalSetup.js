// Runs once before the test workers start, so every test sees the same time zone
// as Docker (docker-compose.yml), no matter where the tests are run.
module.exports = () => {
  process.env.TZ = 'America/Chicago'
}
