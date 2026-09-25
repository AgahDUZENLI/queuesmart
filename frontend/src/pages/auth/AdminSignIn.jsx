import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'

function AdminSignIn({ goTo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    console.log('Admin sign in', { email })
  }

  return (
    <AuthLayout title="Admin sign in" role="Admin" onRoleChange={() => goTo('sign-in')}>
      <form onSubmit={handleSubmit}>
        <TextInput
          id="email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@yourplace.com"
        />
        <TextInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <Button type="submit">Sign in</Button>
        <p>
          New here?{' '}
          <button type="button" className="link-button" onClick={() => goTo('admin-create-account')}>
            Create an admin account
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default AdminSignIn
