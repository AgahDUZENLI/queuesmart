// PLACEHOLDER: replace this page with the real user dashboard
import Notifications from '../../components/Notifications'


// (current queue status, available services, notifications summary).
function UserDashboard({ goTo }) {
  return (
    <div>
      <header className="header">
        <a href="/" className="logo">QueueSmart</a>
      </header>
      <main className="container">
        <h1>User dashboard</h1>
        <p>This page is coming soon.</p>

        <Notifications />

        <p>
          <button type="button" className="link-button" onClick={() => goTo('sign-in')}>
            Sign out
          </button>
        </p>
      </main>
    </div>
  )
}

export default UserDashboard
