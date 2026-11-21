// Admin report for their place, from GET /api/reports. Filter by date and service,
// then download as CSV or print / save as PDF from the browser.
import { useEffect, useState } from 'react'
import { downloadReportCsv, getReport } from '../../api'
import Button from '../../components/Button'
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
  return iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
}

// Old tickets keep the name the person saw; show today's name next to it after a rename
const serviceLabel = (visit) => (visit.serviceName === visit.currentServiceName
  ? visit.serviceName
  : `${visit.serviceName} (now ${visit.currentServiceName})`)

const minutes = (value) => (value === null || value === undefined ? '—' : `${value} min`)

// A titled table; rows are arrays of cells, the first cell is the row heading
function ReportTable({ title, note, headers, rows }) {
  return (
    <section className="admin-section report-section">
      <div className="admin-section-heading">
        <h2>{title}</h2>
        {note && <span className="admin-muted">{note}</span>}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {rows.map(([first, ...rest], index) => (
              <tr key={index}><th scope="row">{first}</th>{rest.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
            ))}
            {rows.length === 0 && <tr><td className="empty-queue" colSpan={headers.length}>Nothing in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AdminReports({ services }) {
  const [filters, setFilters] = useState({ from: '', to: '', serviceId: '' })
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReport(filters)
      .then((result) => { setReport(result); setError('') })
      .catch((loadError) => setError(loadError.message))
  }, [filters])

  const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }))

  async function download() {
    try {
      await downloadReportCsv(filters)
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  const range = filters.from || filters.to ? `${filters.from || 'start'} to ${filters.to || 'today'}` : 'All time'
  const serviceName = services.find((service) => String(service.id) === filters.serviceId)?.name || 'All services'

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Reports</h1>
          <p>Customers, services and queue statistics for your place.</p>
        </div>
        <div className="admin-heading-actions">
          <Button variant="secondary" onClick={() => window.print()} disabled={!report}>Print / PDF</Button>
          <Button onClick={download} disabled={!report}>Download CSV</Button>
        </div>
      </div>
      <div className="report-filters">
        <label>From<input className="admin-select" type="date" value={filters.from} onChange={setFilter('from')} /></label>
        <label>To<input className="admin-select" type="date" value={filters.to} onChange={setFilter('to')} /></label>
        <label>Service
          <select className="admin-select" value={filters.serviceId} onChange={setFilter('serviceId')}>
            <option value="">All services</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {report && (
        <>
          <p className="report-meta">{report.place.name} · {range} · {serviceName} · Generated {formatTime(report.generatedAt)}</p>
          <section className="admin-metrics" aria-label="Queue usage statistics">
            <Metric label="People served" value={report.summary.served} />
            <Metric label="Average wait" value={minutes(report.summary.averageWaitMinutes)} />
            <Metric label="Average visit" value={minutes(report.summary.averageServiceMinutes)} />
            <Metric label="No-shows" value={report.summary.noShow} />
          </section>
          <ReportTable
            title="Services"
            headers={['Service', 'Priority', 'Duration', 'Status', 'Hours', 'Tickets', 'Served', 'No-shows', 'Left', 'Avg wait']}
            rows={report.services.map((s) => [s.name, s.priority, minutes(s.duration), s.status, s.hours, s.tickets, s.served, s.noShow, s.left, minutes(s.averageWaitMinutes)])}
          />
          <ReportTable
            title="Customers"
            note={`${report.customers.length} customers`}
            headers={['Name', 'Email', 'Visits', 'Served', 'No-shows', 'Left', 'Last visit']}
            rows={report.customers.map((c) => [c.name, c.email, c.visits, c.served, c.noShow, c.left, formatTime(c.lastVisit)])}
          />
          <ReportTable
            title="Queue history"
            note={`${report.visits.length} tickets`}
            headers={['Ticket', 'Joined', 'Name', 'Service', 'Outcome', 'Waited', 'Visit length']}
            rows={report.visits.map((v) => [v.ticket, formatTime(v.joinedAt), v.name, serviceLabel(v), OUTCOMES[v.status] || v.status, minutes(v.waitedMinutes), minutes(v.servedMinutes)])}
          />
        </>
      )}
    </>
  )
}

export default AdminReports
