import Button from '../../components/Button'
import AdminStatus from './AdminStatus'

function Metric({ label, value }) {
  return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>
}

function AdminOverview({ services, today, totalWaiting, openServices, onCreate, onManage, onToggleStatus }) {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Overview</h1>
          <p>Student Services Center · {today}</p>
        </div>
        <Button onClick={onCreate}>New service</Button>
      </div>
      <section className="admin-metrics" aria-label="Today's queue summary">
        <Metric label="People waiting" value={totalWaiting} />
        <Metric label="Average wait" value="14 min" />
        <Metric label="Served today" value="86" />
        <Metric label="Average visit" value="11 min" />
      </section>
      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Queues</h2>
          <span className="admin-muted">{openServices} services open</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table overview-table">
            <thead><tr><th>Service</th><th>Waiting</th><th>Wait</th><th>Staff</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <th scope="row">{service.name}</th><td>{service.waiting}</td>
                  <td>{service.wait ? `${service.wait} min` : '—'}</td><td>{service.staff}</td>
                  <td><AdminStatus status={service.status} /></td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="admin-text-action" type="button" onClick={() => onManage(service.id)}>Manage</button>
                      <button className="admin-text-action" type="button" onClick={() => onToggleStatus(service)}>
                        {service.status === 'Open' ? 'Pause' : 'Open'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default AdminOverview