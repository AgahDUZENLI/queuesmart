import './Notifications.css'

// List of queue updates and status changes.
// notifications: [{ id, type, message, time, read }]
function Notifications({ notifications, onMarkAsRead }) {
  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <section className="notifications">
      <div className="notifications-header">
        <h2>Notifications</h2>
        {unreadCount > 0 && <span className="notification-count">{unreadCount} new</span>}
      </div>

      {notifications.length === 0 ? (
        <p className="hint">No notifications yet.</p>
      ) : (
        <ul className="notification-list">
          {notifications.map((notification) => (
            <li key={notification.id} className={notification.read ? '' : 'unread'}>
              <div className="notification-top">
                <span className="notification-type">{notification.type}</span>
                <span className="notification-time">{notification.time}</span>
              </div>
              <p>{notification.message}</p>
              {!notification.read && (
                <button type="button" className="link-button" onClick={() => onMarkAsRead(notification.id)}>
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Notifications
