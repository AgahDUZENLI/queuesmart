// Past visits at the admin's place, from GET /api/history and GET /api/history/stats
import { useEffect, useState } from 'react'
import { getPlaceHistory, getPlaceStats } from '../../api'
import Metric from './Metric'

const OUTCOMES = {
  waiting: 'Waiting',
  serving: 'Being served',
  served: 'Served',
  left: 'Left queue',
  removed: 'Removed by staff',
  'no-show': 'No-show',
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function AdminHistory() {
  const [status, setStatus] = useState('') // '' shows every outcome
  const [page, setPage] = useState(null) // { total, history }
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getPlaceHistory(status), getPlaceStats()])
      .then(([history, totals]) => {
        setPage(history)
        setStats(totals)
        setError('')
      })
      .catch((loadError) => setError(loadError.message))
  }, [status])

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>History</h1>
          <p>Everyone who has joined a queue at your place.</p>
        </div>
        <div className="admin-heading-actions">
          <label className="sr-only" htmlFor="history-status">Show outcome</label>
          <select id="history-status" className="admin-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All outcomes</option>
            {Object.entries(OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {stats && (
        <section className="admin-metrics" aria-label="Queue totals">
          <Metric label="Served" value={stats.served} />
          <Metric label="Average wait" value={`${stats.averageWaitMinutes} min`} />
          <Metric label="Left queue" value={stats.left} />
          <Metric label="No-shows" value={stats.noShow} />
        </section>
      )}
      {page && (
        <section className="admin-section">
          <div className="admin-section-heading">
            <h2>Visits</h2>
            <span className="admin-muted">Showing {page.history.length} of {page.total}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Joined</th><th>Ticket</th><th>Name</th><th>Service</th><th>Outcome</th><th>Waited</th></tr></thead>
              <tbody>
                {page.history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTime(item.joinedAt)}</td><th scope="row">{item.ticket}</th><td>{item.name}</td>
                    <td>{item.serviceName}</td><td>{OUTCOMES[item.status] || item.status}</td>
                    <td>{item.waitedMinutes === null ? '—' : `${item.waitedMinutes} min`}</td>
                  </tr>
                ))}
                {page.history.length === 0 && <tr><td className="empty-queue" colSpan="6">No visits yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default AdminHistory
