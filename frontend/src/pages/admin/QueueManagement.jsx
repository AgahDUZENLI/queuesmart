import Button from '../../components/Button'
import AdminStatus from './AdminStatus'

function AllServiceQueues({ services, onManageService }) {
  return services.map((service) => (
    <section className="admin-section queue-section" key={service.id}>
      <div className="admin-section-heading">
        <div>
          <h2>{service.name}</h2>
          <span><AdminStatus status={service.status} /> · {service.waiting} waiting · about {service.wait} min for a new arrival</span>
        </div>
        <Button variant="secondary" onClick={() => onManageService(service.id)}>Manage queue</Button>
      </div>
      {service.nowServing && (
        <p className="admin-muted">
          Now serving: <strong>{service.nowServing.ticket}</strong> · {service.nowServing.name}
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table queue-table">
          <thead><tr><th>#</th><th>Ticket</th><th>Name</th><th>Priority</th><th>Waiting</th></tr></thead>
          <tbody>
            {service.queue.map((person, index) => (
              <tr key={person.id}>
                <td>{index + 1}</td>
                <th scope="row">{person.ticket}</th>
                <td>{person.name}</td>
                <td className={person.priority === 'High' ? 'priority-high' : 'admin-muted'}>{person.priority}</td>
                <td>{person.waiting} min</td>
              </tr>
            ))}
            {service.queue.length === 0 && (
              <tr><td className="empty-queue" colSpan="5">No one is waiting in this queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  ))
}

function QueueManagement({ services, selectedService, showAllQueues, nowServing, onSelectService, onUpdateService, onServeNext, onComplete, onNoShow, onMoveQueue, onUpdatePriority, onRemoveFromQueue, onCreateService }) {
  if (services.length === 0) {
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
          {showAllQueues ? (
            <p>{services.length} services · {services.reduce((count, service) => count + service.waiting, 0)} people waiting</p>
          ) : selectedService && (
            <p><AdminStatus status={selectedService.status} /> · {selectedService.waiting} waiting · new joiners wait about {selectedService.wait || 0} min</p>
          )}
        </div>
        <div className="admin-heading-actions">
          <label className="sr-only" htmlFor="queue-service">Choose service</label>
          <select id="queue-service" className="admin-select queue-service-select" value={showAllQueues ? 'all' : selectedService?.id ?? ''} onChange={(event) => onSelectService(event.target.value)}>
            <option value="all">All Services</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          {!showAllQueues && selectedService && (
            <>
              <Button variant="secondary" onClick={() => onSelectService('all')}>Show all services</Button>
              <Button variant="secondary" onClick={() => onUpdateService(selectedService.id, { status: selectedService.status === 'Open' ? 'Paused' : 'Open' })}>
                {selectedService.status === 'Open' ? 'Pause' : 'Open queue'}
              </Button>
              <Button variant="secondary" onClick={() => onUpdateService(selectedService.id, { status: 'Closed' })}>Close for today</Button>
            </>
          )}
        </div>
      </div>
      {showAllQueues ? (
        <AllServiceQueues services={services} onManageService={(serviceId) => onSelectService(String(serviceId))} />
      ) : !selectedService ? (
        <section className="empty-admin-state">
          <h2>Service not found</h2>
          <p>Select a service to manage its queue.</p>
        </section>
      ) : (
        <section className="now-serving" aria-label="Currently serving">
          <div className="serving-person">
            <p className="admin-muted">{nowServing ? 'Now serving' : 'No one is being served'}</p>
            {nowServing && <p><strong>{nowServing.ticket}</strong><span>{nowServing.name}</span></p>}
            {nowServing && <p className="admin-muted">Started {nowServing.started}</p>}
          </div>
          <div className="serving-actions">
            <Button variant="secondary" disabled={!nowServing} onClick={onNoShow}>No-show</Button>
            <Button variant="secondary" disabled={!nowServing} onClick={onComplete}>Done</Button>
            <Button disabled={Boolean(nowServing) || selectedService.queue.length === 0} onClick={onServeNext}>
              Call next{selectedService.queue[0] ? `: ${selectedService.queue[0].ticket}` : ''}
            </Button>
          </div>
        </section>
      )}
      {!showAllQueues && selectedService && (
        <section className="admin-section queue-section">
          <div className="admin-section-heading">
            <h2>Waiting</h2>
            <span className="admin-muted">Priority ranks first; arrival order breaks ties.</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table queue-table">
              <thead><tr><th>#</th><th>Ticket</th><th>Name</th><th>Priority</th><th>Waiting</th><th><span className="sr-only">Queue actions</span></th></tr></thead>
              <tbody>
                {selectedService.queue.map((person, index) => (
                  <tr key={person.id}>
                    <td>{index + 1}</td><th scope="row">{person.ticket}</th><td>{person.name}</td>
                    <td>
                      <label className="sr-only" htmlFor={`priority-${person.id}`}>Priority for {person.name}</label>
                      <select id={`priority-${person.id}`} value={person.priority} onChange={(event) => onUpdatePriority(person.id, event.target.value)}>
                        {['High', 'Normal', 'Low'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
                    </td>
                    <td>{person.waiting} min</td>
                    <td className="queue-actions">
                      <button
                        type="button"
                        aria-label={`Move ${person.name} up`}
                        disabled={index === 0 || selectedService.queue[index - 1].priority !== person.priority}
                        onClick={() => onMoveQueue(person.id, index)}
                      >Up</button>
                      <button
                        type="button"
                        aria-label={`Move ${person.name} down`}
                        disabled={index === selectedService.queue.length - 1 || selectedService.queue[index + 1].priority !== person.priority}
                        onClick={() => onMoveQueue(person.id, index + 2)}
                      >Down</button>
                      <button className="remove-action" type="button" onClick={() => onRemoveFromQueue(person.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
                {selectedService.queue.length === 0 && <tr><td className="empty-queue" colSpan="6">No one is waiting in this queue.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default QueueManagement