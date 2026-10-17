// Shared frame for the user pages: top nav (same look as the admin side),
// then the page title and the page content.
const links = [
  { page: 'user-dashboard', label: 'Home' },
  { page: 'join-queue', label: 'Join a queue' },
  { page: 'queue-status', label: 'Queue status' },
  { page: 'user-history', label: 'History' },
]

function UserLayout({ title, subtitle, active, goTo, queue, children }) {
  // Notification bar: the newest notification, until it is read
  const latest = queue?.notifications[0]
  const showBar = latest && !latest.read

  return (
    <div>
      <header className="nav">
        <a href="/" className="nav-brand">QueueSmart</a>
        <nav className="nav-links" aria-label="User navigation">
          {links.map((link) => (
            <button
              key={link.page}
              type="button"
              className={link.page === active ? 'nav-link active' : 'nav-link'}
              aria-current={link.page === active ? 'page' : undefined}
              onClick={() => goTo(link.page)}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="nav-account">
          <span>Maya Robinson</span>
          <button type="button" className="link-button" onClick={() => goTo('sign-in')}>
            Sign out
          </button>
        </div>
      </header>
      {showBar && (
        <div className="notification-bar" role="status">
          <p><strong>{latest.type}:</strong> {latest.message}</p>
          <button type="button" className="link-button" onClick={() => queue.markAsRead(latest.id)}>
            Dismiss
          </button>
        </div>
      )}
      <main className="page">
        <div className="page-heading">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}

export default UserLayout
