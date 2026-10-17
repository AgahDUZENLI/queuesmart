import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'
import { checkEmail, checkName, checkPassword, hasErrors } from '../../utils/validation'

function AdminCreateAccount({ goTo }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})

  function handleSubmit(event) {
    event.preventDefault()
    const newErrors = {
      firstName: checkName(firstName, 'First name'),
      lastName: checkName(lastName, 'Last name'),
      placeName: checkName(placeName, 'Place name'),
      email: checkEmail(email),
      password: checkPassword(password),
    }
    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    goTo('admin-overview')
  }

  return (
    <AuthLayout title="Create an admin account" role="Admin" onRoleChange={() => goTo('create-account')}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="two-columns">
          <TextInput id="first-name" label="First name" value={firstName} onChange={setFirstName} required maxLength={50} error={errors.firstName} />
          <TextInput id="last-name" label="Last name" value={lastName} onChange={setLastName} required maxLength={50} error={errors.lastName} />
        </div>
        <TextInput
          id="place-name"
          label="Place name"
          value={placeName}
          onChange={setPlaceName}
          placeholder="Student Services Center"
          hint="The office, clinic or help desk people will line up for."
          required
          maxLength={50}
          error={errors.placeName}
        />
        <TextInput
          id="email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@yourplace.com"
          required
          error={errors.email}
        />
        <TextInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          hint="At least 8 characters."
          required
          maxLength={64}
          error={errors.password}
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
