import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'

function AdminCreateAccount({ goTo }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    console.log('Create admin account', { firstName, lastName, placeName, email })
  }

  return (
    <AuthLayout title="Create an admin account" role="Admin" onRoleChange={() => goTo('create-account')}>
      <form onSubmit={handleSubmit}>
        <div className="two-columns">
          <TextInput id="first-name" label="First name" value={firstName} onChange={setFirstName} />
          <TextInput id="last-name" label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <TextInput
          id="place-name"
          label="Place name"
          value={placeName}
          onChange={setPlaceName}
          placeholder="Student Services Center"
          hint="The office, clinic or help desk people will line up for."
        />
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
          hint="At least 8 characters."
        />
        <Button type="submit">Create admin account</Button>
        <p>
          Already an admin?{' '}
          <button type="button" className="link-button" onClick={() => goTo('admin-sign-in')}>
            Admin sign in
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default AdminCreateAccount
