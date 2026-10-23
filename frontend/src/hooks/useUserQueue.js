import { useEffect, useState } from 'react'
import { initialTicket } from "../data/userQueue";
import * as api from '../api'

// How each finished ticket status is shown in the History table
const OUTCOMES = { served: 'Served', left: 'Left queue', 'no-show': 'No-show', removed: 'Removed by staff' }

// Turns a ticket from GET /api/history/me into a row for the History table
function toHistoryRow(item) {
  return {
    Date: new Date(item.joinedAt).toLocaleDateString('en-CA'), // local date as YYYY-MM-DD
    Place: item.placeName || '',
    Service: item.serviceName,
    Outcome: OUTCOMES[item.status] || item.status,
  }
}

// Turns a notification from GET /api/notifications/me into what the Notifications list shows
function toNotification(item) {
  return { ...item, time: new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
}

function toTicket(ticket) {
  if (!ticket) return null
  return {
    ...ticket,
    number: ticket.ticket,
    waitAtJoin: ticket.estimatedWaitMinutes,
    joinedAt: new Date(ticket.joinedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

// Everything the user pages share: places, services, the user's ticket, history and notifications.
function useUserQueue() {
  const [places, setPlaces] = useState([]) // places the user added with a code or QR scan
  const [services, setServices] = useState([]) // services at those places
  const [placeError, setPlaceError] = useState('')
  const [ticket, setTicket] = useState(initialTicket)
  const [lastOutcome, setLastOutcome] = useState('')
  const [queueError, setQueueError] = useState('')
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([])
  const [pickedPlaceId, setPickedPlaceId] = useState('') // place chosen on Home before opening Join a queue
  const activeTicketId = ticket?.id
  const service = ticket ? services.find((s) => s.id === ticket.serviceId) : null
  const place = service ? places.find((p) => p.id === service.placeId) : null

    // Loads the user's past queues from the backend (tickets still waiting or being served are not history yet)
  async function loadHistory() {
    try {
      const result = await api.getMyHistory()
      setHistory(result.history.filter((item) => !['waiting', 'serving'].includes(item.status)).map(toHistoryRow))
    } catch {
      // keep what is already on screen if the history cannot be loaded
    }
  }

  // Loads the user's places and their services from the backend
  async function loadPlaces() {
    const saved = await api.getSavedPlaces()
    const lists = await Promise.all(saved.places.map((p) => api.getServices(p.id)))
    setPlaces(saved.places)
    setServices(lists.flatMap((list) => list.services))
    const current = await api.getMyQueueTicket()
    setQueueError('')
    setTicket(toTicket(current.ticket))
    setLastOutcome(current.ticket ? '' : current.recent?.status || '')
    await loadHistory()
    await loadNotifications()
  }

  // Notifications are created by the backend (joined, next in line, served...)
  async function loadNotifications() {
    try {
      const result = await api.getMyNotifications()
      setNotifications(result.notifications.map(toNotification))
    } catch {
      // keep what is already on screen if notifications cannot be loaded
    }
  }

  // Adds a place by its join code. Returns true when it worked.
  async function addPlace(code) {
    setPlaceError('')
    try {
      const { place } = await api.addPlace(code)
      await loadPlaces()
      setPickedPlaceId(place.id)
      return true
    } catch (error) {
      setPlaceError(error.fields.code || error.message)
      return false
    }
  }

  async function removePlace(placeId) {
    await api.removePlace(placeId)
    if (pickedPlaceId === placeId) setPickedPlaceId('')
    await loadPlaces()
  }

  function markAsRead(id) {
    api.markNotificationRead(id).catch(() => {})
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  // The backend creates the ticket and calculates its current position.
  async function join(newService) {
    setQueueError('')
    const result = await api.joinQueue(newService.id)
    setTicket(toTicket(result.ticket))
    setLastOutcome('')
    setServices((current) => current.map((service) => (
      service.id === result.ticket.serviceId ? { ...service, ...result.ticket.service } : service
    )))
    loadNotifications()
  }

  async function leave() {
    if (!ticket) return
    setQueueError('')
    try {
      await api.leaveQueue(ticket.id)
    } catch (error) {
      setQueueError(error.message)
      throw error
    }
    loadHistory()
    loadNotifications()
    setTicket(null)
    setLastOutcome('left')
  }

  const minutesLeft = ticket?.estimatedWaitMinutes ?? 0

  useEffect(() => {
    if (!activeTicketId) return undefined
    let active = true

    async function refreshTicket() {
      try {
        const result = await api.getMyQueueTicket()
        if (!active) return
        setQueueError('')
        loadNotifications()
        if (result.ticket) {
          const updated = toTicket(result.ticket)
          setTicket(updated)
          setServices((current) => current.map((item) => (
            item.id === updated.serviceId ? { ...item, ...result.ticket.service } : item
          )))
        } else {
          setTicket(null)
          setLastOutcome(result.recent?.status || 'inactive')
          loadHistory()
        }
      } catch (error) {
        if (!active) return
        if (error.status === 401 || error.status === 403) {
          setTicket(null)
          setQueueError('')
          return
        }
        setQueueError(error.message)
      }
    }

    const intervalId = setInterval(refreshTicket, 5000)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [activeTicketId])

  return {
    places, services, ticket, service, place, minutesLeft, history, notifications, pickedPlaceId, placeError,
    queueError, lastOutcome, join, leave, markAsRead, setPickedPlaceId, loadPlaces, addPlace, removePlace,
  }
}

export default useUserQueue
