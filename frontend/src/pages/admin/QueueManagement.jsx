import Button from '../../components/Button'
import AdminStatus from './AdminStatus'

function QueueManagement({ services, selectedService, nowServing, onSelectService, onUpdateService, onSetNowServing, onServeNext, onMoveQueue, onRemoveFromQueue, onCreateService }) {
  if (!selectedService) {
    return (
      <section className="empty-admin-state">
        <h1>No services yet</h1>
        <p>Create a service before managing its queue.</p>
        <Button onClick={onCreateService}>Create a service</Button>
      </section>
    )
  }

  return (
    <>
      <div className="admin-page-heading queue-heading">
        <div>
          <h1>Queues</h1>
          <p><AdminStatus status={selectedService.status} /> · {selectedService.waiting} waiting · new joiners wait about {selectedService.wait || 0} min</p>
        </div>
        <div className="admin-heading-actions">
          <label className="sr-only" htmlFor="queue-service">Choose service</label>
          <select id="queue-service" className="admin-select queue-service-select" value={selectedService.id} onChange={(event) => onSelectService(event.target.value)}>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          <Button variant="secondary" onClick={() => onUpdateService(selectedService.id, { status: selectedService.status === 'Open' ? 'Paused' : 'Open' })}>
            {selectedService.status === 'Open' ? 'Pause' : 'Open queue'}
          </Button>
          <Button variant="secondary" onClick={() => onUpdateService(selectedService.id, { status: 'Closed' })}>Close for today</Button>
        </div>
      </div>
      <section className="now-serving" aria-label="Currently serving">
        <div className="serving-person">
          <p className="admin-muted">Now serving at Desk 2</p>
          <p><strong>{nowServing.ticket}</strong><span>{nowServing.name}</span></p>
          <p className="admin-muted">Started {nowServing.started} · 4 min</p>
        </div>
        <div className="serving-actions">
          <Button variant="secondary" onClick={() => onSetNowServing({ ticket: 'No show', name: 'Call next guest', started: 'Now' })}>No-show</Button>
          <Button variant="secondary" onClick={() => onSetNowServing({ ticket: 'Complete', name: nowServing.name, started: 'Served' })}>Done</Button>
          <Button onClick={onServeNext}>Call next{selectedService.queue[0] ? `: ${selectedService.queue[0].ticket}` : ''}</Button>
        </div>
      </section>
      <section className="admin-section queue-section">
        <div className="admin-section-heading">
          <h2>Waiting</h2>
          <span className="admin-muted">High priority goes first, then by join time.</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table queue-table">
            <thead><tr><th>#</th><th>Ticket</th><th>Name</th><th>Priority</th><th>Waiting</th><th><span className="sr-only">Queue actions</span></th></tr></thead>
            <tbody>
              {selectedService.queue.map((person, index) => (
                <tr key={person.ticket}>
                  <td>{index + 1}</td><th scope="row">{person.ticket}</th><td>{person.name}</td>
                  <td className={person.priority === 'High' ? 'priority-high' : 'admin-muted'}>{person.priority}</td>
                  <td>{person.waiting} min</td>
                  <td className="queue-actions">
                    <button type="button" aria-label={`Move ${person.name} up`} disabled={index === 0} onClick={() => onMoveQueue(index, -1)}>Up</button>
                    <button type="button" aria-label={`Move ${person.name} down`} disabled={index === selectedService.queue.length - 1} onClick={() => onMoveQueue(index, 1)}>Down</button>
                    <button className="remove-action" type="button" onClick={() => onRemoveFromQueue(index)}>Remove</button>
                  </td>
                </tr>
              ))}
              {selectedService.queue.length === 0 && <tr><td className="empty-queue" colSpan="6">No one is waiting in this queue.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default QueueManagement