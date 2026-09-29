import Button from '../../components/Button'
import AdminStatus from './AdminStatus'

function ServiceManagement({ services, selectedService, selectedServiceId, draft, editing, onOpenEditor, onDraftChange, onSave, onCancel, onDelete }) {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Services</h1>
          <p>What people can line up for, how long it takes, and who goes first.</p>
        </div>
        <Button onClick={() => onOpenEditor(null)}>New service</Button>
      </div>
      <div className="services-layout">
        <div className="admin-table-wrap">
          <table className="admin-table services-table">
            <thead><tr><th>Service</th><th>Length</th><th>Priority</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className={selectedServiceId === service.id ? 'selected-row' : ''}>
                  <th scope="row">{service.name}</th><td>{service.duration} min</td><td>{service.priority}</td>
                  <td><AdminStatus status={service.status} /></td>
                  <td><button className="admin-text-action" type="button" onClick={() => onOpenEditor(service)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing ? (
          <form className="service-editor" onSubmit={onSave}>
            <h2>{selectedServiceId ? `Edit ${draft.name}` : 'New service'}</h2>
            <label className="field admin-field">
              <span>Name</span>
              <input autoFocus type="text" required maxLength="100" value={draft.name} onChange={(event) => onDraftChange('name', event.target.value)} />
              <small>{draft.name.length}/100 characters</small>
            </label>
            <label className="field admin-field">
              <span>Description</span>
              <textarea required rows="3" value={draft.description} onChange={(event) => onDraftChange('description', event.target.value)} />
            </label>
            <div className="admin-field-grid">
              <label className="field admin-field">
                <span>Visit length (min)</span>
                <input type="number" required min="1" max="480" value={draft.duration} onChange={(event) => onDraftChange('duration', event.target.value)} />
              </label>
              <label className="field admin-field">
                <span>Max in line</span>
                <input type="number" required min="1" max="500" value={draft.maxInLine} onChange={(event) => onDraftChange('maxInLine', event.target.value)} />
              </label>
            </div>
            <fieldset className="priority-field">
              <legend>Priority</legend>
              <div className="priority-options">
                {['Low', 'Normal', 'High'].map((priority) => (
                  <label key={priority}>
                    <input type="radio" name="priority" value={priority} checked={draft.priority === priority} onChange={() => onDraftChange('priority', priority)} />
                    {priority}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="admin-field-grid">
              <label className="field admin-field"><span>Opens</span><input type="time" required value={draft.opens} onChange={(event) => onDraftChange('opens', event.target.value)} /></label>
              <label className="field admin-field"><span>Closes</span><input type="time" required value={draft.closes} onChange={(event) => onDraftChange('closes', event.target.value)} /></label>
            </div>
            <label className="checkbox appointments-option">
              <input type="checkbox" checked={draft.appointments} onChange={(event) => onDraftChange('appointments', event.target.checked)} />
              Allow appointments
            </label>
            <div className="editor-footer">
              <div className="editor-primary-actions">
                <Button type="submit">Save</Button>
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
              </div>
              <button className="delete-service" type="button" onClick={onDelete}>Delete</button>
            </div>
          </form>
        ) : (
          <div className="service-editor editor-empty">
            <h2>{selectedService ? selectedService.name : 'No service selected'}</h2>
            <p>{selectedService?.description ?? 'Create a service to begin managing queues.'}</p>
            <div className="editor-primary-actions">
              {selectedService && <Button variant="secondary" onClick={() => onOpenEditor(selectedService)}>Edit service</Button>}
              <Button onClick={() => onOpenEditor(null)}>New service</Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ServiceManagement