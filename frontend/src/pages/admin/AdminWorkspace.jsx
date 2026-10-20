import { useEffect, useState } from 'react'
import './admin.css'
import AdminDashboard from './AdminDashboard'
import QueueManagement from './QueueManagement'
import ServiceManagement from './ServiceManagement'
import * as api from '../../api'
import { signOut } from '../../api'

const emptyService = {
  name: '',
  description: '',
  duration: '',
  maxInLine: 25,
  priority: 'Normal',
  status: 'Closed',
  opens: '09:00',
  closes: '16:30',
  appointments: false,
}

function AdminWorkspace({ goTo, initialPage = 'overview' }) {
  const [activePage, setActivePage] = useState(initialPage)
  const [services, setServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [draft, setDraft] = useState({ ...emptyService })
  const [editing, setEditing] = useState(false)
  const [placeName, setPlaceName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]

  async function refreshQueues() {
    const result = await api.getAdminQueues()
    setError('')
    setServices(result.services)
    setPlaceName(result.place?.name || '')
    setSelectedServiceId((current) => (
      result.services.some((service) => service.id === current) ? current : result.services[0]?.id ?? null
    ))
  }

  useEffect(() => {
    let active = true
    api.getAdminQueues()
      .then((result) => {
        if (!active) return
        setServices(result.services)
        setPlaceName(result.place?.name || '')
        setError('')
        setSelectedServiceId(result.services[0]?.id ?? null)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const intervalId = setInterval(() => {
      api.getAdminQueues()
        .then((result) => {
          if (!active) return
          setServices(result.services)
          setPlaceName(result.place?.name || '')
        })
        .catch((refreshError) => {
          if (active) setError(refreshError.message)
        })
    }, 5000)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [])

  function openEditor(service) {
    setSelectedServiceId(service?.id ?? null)
    setDraft(service ? { ...emptyService, ...service } : { ...emptyService })
    setEditing(true)
    setError('')
  }

  async function updateService(serviceId, updates) {
    setError('')
    try {
      await api.updateService(serviceId, updates)
      await refreshQueues()
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  async function saveService(event) {
    event.preventDefault()
    const values = {
      name: draft.name,
      description: draft.description,
      duration: Number(draft.duration),
      maxInLine: Number(draft.maxInLine),
      priority: draft.priority,
      status: draft.status,
      opens: draft.opens,
      closes: draft.closes,
      appointments: draft.appointments,
    }

    setError('')
    try {
      const result = selectedServiceId
        ? await api.updateService(selectedServiceId, values)
        : await api.createService(values)
      await refreshQueues()
      const service = result.service
      if (service) setSelectedServiceId(service.id)
      setEditing(false)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function deleteService() {
    if (!selectedServiceId) {
      setEditing(false)
      return
    }
    setError('')
    try {
      await api.deleteService(selectedServiceId)
      await refreshQueues()
      setEditing(false)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function runQueueAction(action) {
    setError('')
    try {
      await action()
      await refreshQueues()
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  function navigateTo(page) {
    setActivePage(page)
    if (page === 'services' && !selectedServiceId && services[0]) openEditor(services[0])
  }

  function createService() {
    navigateTo('services')
    openEditor(null)
  }

  const totalWaiting = services.reduce((total, service) => total + service.waiting, 0)
  const openServices = services.filter((service) => service.status === 'Open').length
  const averageWait = services.length
    ? Math.round(services.reduce((total, service) => total + service.wait, 0) / services.length)
    : 0
  const currentlyServing = services.filter((service) => service.nowServing).length
  const averageDuration = services.length
    ? Math.round(services.reduce((total, service) => total + service.duration, 0) / services.length)
    : 0

  return (
    <div className="admin-shell">
      <header className="admin-nav">
        <a className="admin-brand" href="#overview" onClick={(event) => { event.preventDefault(); navigateTo('overview') }}>
          QueueSmart
        </a>
        <nav className="admin-tabs" aria-label="Administrator navigation">
          {['overview', 'queues', 'services'].map((page) => (
            <button key={page} type="button" className={activePage === page ? 'admin-tab active' : 'admin-tab'} onClick={() => navigateTo(page)}>
              {page === 'overview' ? 'Overview' : page === 'queues' ? 'Queues' : 'Services'}
            </button>
          ))}
        </nav>
        <div className="admin-account">
          <span>{placeName || 'Administrator'}</span>
          <button className="admin-signout" type="button" onClick={() => { signOut(); goTo('admin-sign-in') }}>Sign out</button>
        </div>
      </header>

      <main className="admin-main">
        {error && <p className="error" role="alert">{error}</p>}
        {loading ? <p role="status">Loading queue data…</p> : (
          <>
            {activePage === 'overview' && (
              <AdminDashboard
                services={services}
                today={`${placeName} · ${today}`}
                totalWaiting={totalWaiting}
                openServices={openServices}
                averageWait={averageWait}
                currentlyServing={currentlyServing}
                averageDuration={averageDuration}
                onCreate={createService}
                onManage={(serviceId) => { setSelectedServiceId(serviceId); navigateTo('queues') }}
                onToggleStatus={(service) => updateService(service.id, { status: service.status === 'Open' ? 'Paused' : 'Open' })}
              />
            )}
            {activePage === 'queues' && (
              <QueueManagement
                services={services}
                selectedService={selectedService}
                nowServing={selectedService?.nowServing}
                onSelectService={(serviceId) => setSelectedServiceId(Number(serviceId))}
                onUpdateService={updateService}
                onServeNext={() => runQueueAction(() => api.serveNext(selectedService.id))}
                onComplete={() => runQueueAction(() => api.completeServing(selectedService.id))}
                onNoShow={() => runQueueAction(() => api.markNoShow(selectedService.id))}
                onMoveQueue={(ticketId, position) => runQueueAction(() => api.updateQueueTicket(selectedService.id, ticketId, { position }))}
                onUpdatePriority={(ticketId, priority) => runQueueAction(() => api.updateQueueTicket(selectedService.id, ticketId, { priority }))}
                onRemoveFromQueue={(ticketId) => runQueueAction(() => api.removeQueueTicket(ticketId))}
                onCreateService={createService}
              />
            )}
            {activePage === 'services' && (
              <ServiceManagement
                services={services}
                selectedService={selectedService}
                selectedServiceId={selectedServiceId}
                draft={draft}
                editing={editing}
                onOpenEditor={openEditor}
                onDraftChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
                onSave={saveService}
                onCancel={() => setEditing(false)}
                onDelete={deleteService}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default AdminWorkspace
