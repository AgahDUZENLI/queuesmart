import { useState } from 'react'
import SignIn from './pages/auth/SignIn'
import CreateAccount from './pages/auth/CreateAccount'
import AdminSignIn from './pages/auth/AdminSignIn'
import AdminCreateAccount from './pages/auth/AdminCreateAccount'
import AdminWorkspace from './pages/admin/AdminWorkspace'
import UserDashboard from './pages/user/UserDashboard'
import JoinQueue from './pages/user/JoinQueue'
import QueueStatus from './pages/user/QueueStatus'
import UserHistory from './pages/user/UserHistory'
import useUserQueue from './hooks/useUserQueue'

function App() {
  const [page, setPage] = useState('sign-in')
  const queue = useUserQueue()
  // Join code from a scanned QR link, like http://localhost:5173/?code=123456
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get('code'))

  async function handleUserSignedIn() {
    if (joinCode) {
      window.history.replaceState(null, '', '/') // take ?code= out of the address bar
      setJoinCode(null)
      await queue.addPlace(joinCode)
      setPage('join-queue')
    } else {
      await queue.loadPlaces()
      setPage('user-dashboard')
    }
  }

  if (page === 'create-account') return <CreateAccount goTo={setPage} onSignedIn={handleUserSignedIn} />
  if (page === 'user-dashboard') return <UserDashboard goTo={setPage} queue={queue} />
  if (page === 'join-queue') return <JoinQueue goTo={setPage} queue={queue} />
  if (page === 'queue-status') return <QueueStatus goTo={setPage} queue={queue} />
  if (page === 'user-history') return <UserHistory goTo={setPage} queue={queue} />
  if (page === 'admin-sign-in') return <AdminSignIn goTo={setPage} />
  if (page === 'admin-create-account') return <AdminCreateAccount goTo={setPage} />
  if (page.startsWith('admin-')) return <AdminWorkspace goTo={setPage} initialPage={page.slice(6)} />

  return <SignIn goTo={setPage} onSignedIn={handleUserSignedIn} joinCode={joinCode} />
}

export default App
