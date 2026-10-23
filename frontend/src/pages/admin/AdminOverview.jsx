import Button from '../../components/Button'
import AdminStatus from './AdminStatus'
import JoinCodeCard from './JoinCodeCard'
import Metric from './Metric'

function AdminOverview({ services, today, totalWaiting, openServices, averageWait, currentlyServing, averageDuration, onCreate, onManage, onToggleStatus, onServeNext, onComplete, onNoShow }) {
  // Open services, plus any still finishing someone after being paused
  const servingServices = services.filter((service) => service.status === 'Open' || service.nowServing)
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Overview</h1>
          <p>{today}</p>
        </div>
        <Button onClick={onCreate}>New service</Button>
      </div>
      <JoinCodeCard />
      <section className="admin-metrics" aria-label="Today's queue summary">
        <Metric label="People waiting" value={totalWaiting} />
        <Metric label="Average wait" value={`${averageWait} min`} />
        <Metric label="Currently serving" value={currentlyServing} />
        <Metric label="Average visit"value={`${averageDuration} min`} />
      </section>
      {servingServices.length > 0 && (
        <section className="admin-section overview-serving">
          <div className="admin-section-heading">
            <h2>Serving now</h2>
            <span className="admin-muted">Call people in, then press Done when they leave</span>
          </div>
          {servingServices.map((service) => {
            const serving = service.nowServing
            const next = service.queue[0]
            return (
              <div key={service.id} className="now-serving" aria-label={`${service.name} serving`}>
                <div className="serving-person">
                  <p className="admin-muted">{service.name} · {service.waiting} waiting</p>
                  {serving ? (
                    <>
                      <p><strong>{serving.ticket}</strong><span>{serving.name}</span></p>
                      <p className="admin-muted">Started {serving.started} · {serving.minutesIn} min in · about {serving.minutesLeft} min left</p>
                    </>
                  ) : (
                    <p className="admin-muted">{next ? `No one is being served. Next up: ${next.ticket} · ${next.name}` : 'No one in line'}</p>
                  )}
                </div>
                <div className="serving-actions">
                  {serving ? (
                    <>
                      <Button variant="secondary" onClick={() => onNoShow(service.id)}>No-show</Button>
                      <Button onClick={() => onComplete(service.id)}>Done</Button>
                    </>
                  ) : next && (
                    <Button onClick={() => onServeNext(service.id)}>Call next: {next.ticket}</Button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}
      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Queues</h2>
          <span className="admin-muted">{openServices} services open</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table overview-table">
            <thead><tr><th>Service</th><th>Waiting</th><th>Wait</th><th>Avg visit</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <th scope="row">{service.name}</th><td>{service.waiting}</td>
                  <td>{service.wait ? `${service.wait} min` : '—'}</td><td>
                    {service.averageDuration} min
                    {service.measuredVisits > 0 && <span className="admin-muted"> · set {service.duration}</span>}
                  </td>
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
