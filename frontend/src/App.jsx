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

  if (page === 'create-account') return <CreateAccount goTo={setPage} />
  if (page === 'user-dashboard') return <UserDashboard goTo={setPage} queue={queue} />
  if (page === 'join-queue') return <JoinQueue goTo={setPage} queue={queue} />
  if (page === 'queue-status') return <QueueStatus goTo={setPage} queue={queue} />
  if (page === 'user-history') return <UserHistory goTo={setPage} queue={queue} />
  if (page === 'admin-sign-in') return <AdminSignIn goTo={setPage} />
  if (page === 'admin-create-account') return <AdminCreateAccount goTo={setPage} />
  if (page.startsWith('admin-')) return <AdminWorkspace goTo={setPage} initialPage={page.slice(6)} />

  return <SignIn goTo={setPage} />
}

export default App
