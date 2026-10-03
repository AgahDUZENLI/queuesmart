import { useState } from 'react'
import './Notifications.css'

function Notifications() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'queue',
      message: 'Your queue position changed to #4.',
      time: 'Just now',
      read: false,
    },
    {
      id: 2,
      type: 'status',
      message: 'Your appointment status changed to Confirmed.',
      time: '2 minutes ago',
      read: false,
    },
  ])

  const [queuePosition, setQueuePosition] = useState(4)

  function addQueueNotification() {
    if (queuePosition <= 1) {
      return
    }

    const newPosition = queuePosition - 1

    setQueuePosition(newPosition)

    const newNotification = {
      id: Date.now(),
      type: 'queue',
      message: `Your queue position changed to #${newPosition}.`,
      time: 'Just now',
      read: false,
    }

    setNotifications((current) => [
      newNotification,
      ...current.filter((notification) => notification.type !== 'queue'),
    ])
  }

  function addStatusNotification() {
    const newNotification = {
      id: Date.now(),
      type: 'status',
      message: 'Your appointment is Ready. ✔️',
      time: 'Just now',
      read: false,
    }

    setNotifications((current) => [
      newNotification,
      ...current.filter((notification) => notification.type !== 'status'),
    ])
  }

  function markAsRead(id) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length

  return (
    <section className="notifications">
      <div className="notifications-header">
        <div>
          <h2>Notifications</h2>
          <p>Updates about your queue and appointments</p>
        </div>

        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="empty-notifications">
            <p>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-card ${
                !notification.read ? 'unread' : ''
              }`}
            >
              <div className="notification-icon">
                {notification.type === 'queue' ? '👥' : '📅'}
              </div>

              <div className="notification-content">
                <div className="notification-top">
                  <span className="notification-type">
                    {notification.type === 'queue'
                      ? 'Queue Update'
                      : 'Status Update'}
                  </span>

                  <span className="notification-time">
                    {notification.time}
                  </span>
                </div>

                <p>{notification.message}</p>

                {!notification.read && (
                  <button
                    type="button"
                    className="mark-read-button"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="notification-tests">
        <button type="button" onClick={addQueueNotification}>
          Test Queue Update
        </button>

        <button type="button" onClick={addStatusNotification}>
          Test Status Change
        </button>
      </div>
    </section>
  )
}

export default Notifications