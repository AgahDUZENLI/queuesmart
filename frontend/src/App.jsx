import { useState } from 'react'
import SignIn from './pages/auth/SignIn'
import CreateAccount from './pages/auth/CreateAccount'
import AdminSignIn from './pages/auth/AdminSignIn'
import AdminCreateAccount from './pages/auth/AdminCreateAccount'
import AdminWorkspace from './pages/admin/AdminWorkspace'

function App() {
  const [page, setPage] = useState('sign-in')

  if (page === 'create-account') return <CreateAccount goTo={setPage} />
  if (page === 'admin-sign-in') return <AdminSignIn goTo={setPage} />
  if (page === 'admin-create-account') return <AdminCreateAccount goTo={setPage} />
  if (page.startsWith('admin-')) return <AdminWorkspace goTo={setPage} initialPage={page.slice(6)} />

  return <SignIn goTo={setPage} />
}

export default App
