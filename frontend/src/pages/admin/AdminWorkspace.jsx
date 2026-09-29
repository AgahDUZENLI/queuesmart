import { useState } from 'react'
import './admin.css'
import AdminDashboard from './AdminDashboard'
import QueueManagement from './QueueManagement'
import ServiceManagement from './ServiceManagement'

const initialServices = [
  {
    id: 'advising', name: 'Academic Advising',
    description: 'Meet with an advisor about course planning and academic goals.',
    duration: 15, maxInLine: 40, priority: 'Normal', status: 'Open', waiting: 6, wait: 18, staff: 2,
    opens: '09:00', closes: '16:30', appointments: true,
    queue: [
      { ticket: 'C-011', name: 'Priya Shah', priority: 'High', waiting: 18 },
      { ticket: 'A-040', name: 'Luis Ortega', priority: 'Normal', waiting: 26 },
      { ticket: 'A-041', name: 'Hannah Cole', priority: 'Normal', waiting: 21 },
      { ticket: 'A-042', name: 'Maya Robinson', priority: 'Normal', waiting: 19 },
      { ticket: 'A-043', name: 'Ben Adeyemi', priority: 'Normal', waiting: 11 },
      { ticket: 'A-044', name: 'Grace Kim', priority: 'Normal', waiting: 5 },
    ],
  },
  {
    id: 'financial-aid', name: 'Financial Aid', description: 'Get help with financial aid applications and awards.',
    duration: 20, maxInLine: 35, priority: 'Normal', status: 'Open', waiting: 4, wait: 22, staff: 1,
    opens: '09:00', closes: '16:30', appointments: true,
    queue: [
      { ticket: 'F-021', name: 'Avery Brooks', priority: 'High', waiting: 22 },
      { ticket: 'F-022', name: 'Noah Patel', priority: 'Normal', waiting: 17 },
      { ticket: 'F-023', name: 'Sofia Martinez', priority: 'Normal', waiting: 12 },
      { ticket: 'F-024', name: 'Ethan Wilson', priority: 'Normal', waiting: 6 },
    ],
  },
  {
    id: 'registrar', name: 'Registrar', description: 'Support for records, transcripts, and enrollment.',
    duration: 10, maxInLine: 30, priority: 'Normal', status: 'Open', waiting: 2, wait: 6, staff: 1,
    opens: '09:00', closes: '16:30', appointments: false,
    queue: [
      { ticket: 'R-008', name: 'Olivia Chen', priority: 'Normal', waiting: 6 },
      { ticket: 'R-009', name: 'Mateo Garcia', priority: 'Normal', waiting: 3 },
    ],
  },
  {
    id: 'counseling', name: 'Counseling Intake', description: 'Start a confidential conversation with Counseling Services.',
    duration: 30, maxInLine: 20, priority: 'High', status: 'Open', waiting: 3, wait: 35, staff: 1,
    opens: '09:00', closes: '16:30', appointments: true,
    queue: [
      { ticket: 'C-031', name: 'Taylor Johnson', priority: 'High', waiting: 35 },
      { ticket: 'C-032', name: 'Morgan Davis', priority: 'Normal', waiting: 29 },
      { ticket: 'C-033', name: 'Riley Thompson', priority: 'Normal', waiting: 18 },
    ],
  },
  {
    id: 'it-help', name: 'IT Help Desk', description: 'Troubleshoot account, device, and campus technology issues.',
    duration: 12, maxInLine: 25, priority: 'Normal', status: 'Paused', waiting: 0, wait: 0, staff: 0,
    opens: '09:00', closes: '16:30', appointments: false, queue: [],
  },
  {
    id: 'career', name: 'Career Coaching', description: 'Get guidance on resumes, interviews, and career planning.',
    duration: 25, maxInLine: 25, priority: 'Low', status: 'Closed', waiting: 0, wait: 0, staff: 0,
    opens: '09:00', closes: '16:30', appointments: true, queue: [],
  },
]

const emptyService = {
  name: '', description: '', duration: '', maxInLine: '', priority: 'Normal',
  opens: '09:00', closes: '16:30', appointments: false,
}

function AdminWorkspace({ goTo, initialPage = 'overview' }) {
  const [activePage, setActivePage] = useState(initialPage)
  const [services, setServices] = useState(initialServices)
  const [selectedServiceId, setSelectedServiceId] = useState('advising')
  const [draft, setDraft] = useState({ ...initialServices[0] })
  const [editing, setEditing] = useState(true)
  const [nowServing, setNowServing] = useState({ ticket: 'A-039', name: 'Jordan Lee', started: '2:36 PM' })
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  function openEditor(service) {
    setSelectedServiceId(service?.id ?? '')
    setDraft(service ? { ...service } : { ...emptyService })
    setEditing(true)
  }

  function updateService(serviceId, updates) {
    setServices((current) => current.map((service) => (
      service.id === serviceId ? { ...service, ...updates } : service
    )))
  }

  function saveService(event) {
    event.preventDefault()
    const values = {
      ...draft,
      duration: Number(draft.duration),
      maxInLine: Number(draft.maxInLine),
      status: draft.status ?? 'Closed',
      waiting: draft.waiting ?? 0,
      wait: draft.wait ?? 0,
      staff: draft.staff ?? 0,
      queue: draft.queue ?? [],
    }

    if (selectedServiceId) {
      updateService(selectedServiceId, values)
    } else {
      const id = `service-${Date.now()}`
      setServices((current) => [...current, { ...values, id }])
      setSelectedServiceId(id)
      setDraft({ ...values })
    }
    setEditing(false)
  }

  function deleteService() {
    if (!selectedServiceId) {
      setEditing(false)
      return
    }
    const remaining = services.filter((service) => service.id !== selectedServiceId)
    setServices(remaining)
    setSelectedServiceId(remaining[0]?.id ?? '')
    setDraft(remaining[0] ? { ...remaining[0] } : { ...emptyService })
    setEditing(false)
  }

  function changeQueuePosition(index, offset) {
    if (!selectedService) return
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= selectedService.queue.length) return
    const queue = [...selectedService.queue]
    ;[queue[index], queue[nextIndex]] = [queue[nextIndex], queue[index]]
    updateService(selectedService.id, { queue })
  }

  function removeFromQueue(index) {
    if (!selectedService) return
    const queue = selectedService.queue.filter((_, queueIndex) => queueIndex !== index)
    updateService(selectedService.id, { queue, waiting: queue.length })
  }

  function serveNext() {
    if (!selectedService?.queue.length) return
    const [next, ...queue] = selectedService.queue
    setNowServing({ ticket: next.ticket, name: next.name, started: 'Just now' })
    updateService(selectedService.id, { queue, waiting: queue.length })
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
          <span>Jordan Park, staff</span>
          <button className="admin-signout" type="button" onClick={() => goTo('admin-sign-in')}>Sign out</button>
        </div>
      </header>

      <main className="admin-main">
        {activePage === 'overview' && (
          <AdminDashboard
            services={services}
            today={today}
            totalWaiting={totalWaiting}
            openServices={openServices}
            onCreate={createService}
            onManage={(serviceId) => { setSelectedServiceId(serviceId); navigateTo('queues') }}
            onToggleStatus={(service) => updateService(service.id, { status: service.status === 'Open' ? 'Paused' : 'Open' })}
          />
        )}
        {activePage === 'queues' && (
          <QueueManagement
            services={services}
            selectedService={selectedService}
            nowServing={nowServing}
            onSelectService={setSelectedServiceId}
            onUpdateService={updateService}
            onSetNowServing={setNowServing}
            onServeNext={serveNext}
            onMoveQueue={changeQueuePosition}
            onRemoveFromQueue={removeFromQueue}
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
      </main>
    </div>
  )
}

export default AdminWorkspace