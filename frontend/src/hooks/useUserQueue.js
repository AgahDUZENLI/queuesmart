import { useState } from 'react'
import { places, services, initialTicket, initialHistory, initialNotifications } from '../data/userQueue'
import { estimateWait, ordinal } from '../utils/queueRules'

function today() {
  return new Date().toLocaleDateString('en-CA') // local date as YYYY-MM-DD
}

function timeNow() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Everything the user pages share: places, services, the user's ticket, history and notifications.
function useUserQueue() {
  const [ticket, setTicket] = useState(initialTicket)
  const [history, setHistory] = useState(initialHistory)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [pickedPlaceId, setPickedPlaceId] = useState('') // place chosen on Home before opening Join a queue
  const service = ticket ? services.find((s) => s.id === ticket.serviceId) : null
  const place = service ? places.find((p) => p.id === service.placeId) : null

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

  // Joining puts you at the end of the line
  function join(newService) {
    setTicket({
      serviceId: newService.id,
      number: `${newService.name[0]}-${String(newService.waiting + 41).padStart(3, '0')}`,
      peopleAhead: newService.waiting,
      waitAtJoin: newService.wait,
      joinedAt: timeNow(),
    })
    const newPlace = places.find((p) => p.id === newService.placeId)
    notify('Queue update', `You joined ${newService.name} at ${newPlace.name}. You are ${ordinal(newService.waiting + 1)} in line.`)
  }

  function leave() {
    addToHistory('Left queue')
    notify('Queue update', `You left the queue for ${service.name}.`)
    setTicket(null)
  }

  // UI simulation: the person in front of you is served
  function nextPersonServed() {
    const ahead = ticket.peopleAhead - 1
    if (ahead >= 0) {
      setTicket({ ...ticket, peopleAhead: ahead })
      if (ahead === 0) {
        notify('Status change', `Almost ready: you are next for ${service.name}. Head to ${service.room}.`)
      } else {
        notify('Queue update', `You moved up to ${ordinal(ahead + 1)} in line for ${service.name}.`)
      }
    } else {
      addToHistory('Served')
      notify('Status change', `Served: it's your turn at ${service.name}.`)
      setTicket(null)
    }
  }

  const minutesLeft = service ? estimateWait(service, ticket.peopleAhead) : 0

  return {
    places, services, ticket, service, place, minutesLeft, history, notifications, pickedPlaceId,
    join, leave, nextPersonServed, markAsRead, setPickedPlaceId,
  }
}

export default useUserQueue
