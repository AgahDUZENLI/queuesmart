import { useEffect, useState } from 'react'
import { initialTicket, initialHistory, initialNotifications } from '../data/userQueue'
import * as api from '../api'
import { ordinal } from '../utils/queueRules'

function today() {
  return new Date().toLocaleDateString('en-CA') // local date as YYYY-MM-DD
}

function timeNow() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
  const [history, setHistory] = useState(initialHistory)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [pickedPlaceId, setPickedPlaceId] = useState('') // place chosen on Home before opening Join a queue
  const activeTicketId = ticket?.id
  const service = ticket ? services.find((s) => s.id === ticket.serviceId) : null
  const place = service ? places.find((p) => p.id === service.placeId) : null

  // Loads the user's places and their services from the backend
  async function loadPlaces() {
    const saved = await api.getSavedPlaces()
    const lists = await Promise.all(saved.places.map((p) => api.getServices(p.id)))
    setPlaces(saved.places)
    setServices(lists.flatMap((list) => list.services.map((service) => ({ ...service, room: service.room || '' }))))
    const current = await api.getMyQueueTicket()
    setQueueError('')
    setTicket(toTicket(current.ticket))
    setLastOutcome(current.ticket ? '' : current.recent?.status || '')
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

  function addToHistory(outcome) {
    setHistory((current) => [{ Date: today(), Place: place.name, Service: service.name, Outcome: outcome }, ...current])
  }

  // type: 'Queue update' or 'Status change'
  function notify(type, message) {
    setNotifications((current) => [{ id: Date.now(), type, message, time: timeNow(), read: false }, ...current])
  }

  function markAsRead(id) {
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
    const newPlace = places.find((p) => p.id === newService.placeId)
    notify('Queue update', `You joined ${newService.name} at ${newPlace.name}. You are ${ordinal(result.ticket.position)} in line.`)
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
    addToHistory('Left queue')
    notify('Queue update', `You left the queue for ${service.name}.`)
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
        if (result.ticket) {
          const updated = toTicket(result.ticket)
          setTicket(updated)
          setServices((current) => current.map((item) => (
            item.id === updated.serviceId ? { ...item, ...result.ticket.service } : item
          )))
        } else {
          setTicket(null)
          setLastOutcome(result.recent?.status || 'inactive')
          if (result.recent?.status === 'served') notify('Status change', `You have been served at ${result.recent.service?.name || 'the service'}.`)
          else if (result.recent?.status === 'no-show') notify('Status change', 'Your ticket was marked as a no-show.')
          else if (result.recent?.status === 'removed') notify('Status change', 'Your ticket was removed from the queue.')
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
