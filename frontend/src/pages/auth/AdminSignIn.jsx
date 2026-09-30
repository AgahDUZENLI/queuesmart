import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'
import { checkEmail, checkRequired, hasErrors } from '../../utils/validation'

function AdminSignIn({ goTo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})

  function handleSubmit(event) {
    event.preventDefault()
    const newErrors = {
      email: checkEmail(email),
      password: checkRequired(password, 'Password'),
    }
    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    goTo('admin-overview')
  }

  return (
    <AuthLayout title="Admin sign in" role="Admin" onRoleChange={() => goTo('sign-in')}>
      <form onSubmit={handleSubmit} noValidate>
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
          required
          error={errors.password}
        />
        <Button type="submit">Sign in</Button>
        <p>
          New here?{' '}
          <button type="button" className="link-button" onClick={() => goTo('admin-create-account')}>
            Create an admin account
          </button>
        </p>
        {/* Demo shortcut: skips the form until the backend exists (A3) */}
        <p>
          <button type="button" className="link-button" onClick={() => goTo('admin-overview')}>
            Skip sign in (demo)
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default AdminSignIn
