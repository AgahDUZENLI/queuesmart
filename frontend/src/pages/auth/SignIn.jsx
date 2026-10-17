import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'
import { checkEmail, checkRequired, hasErrors } from '../../utils/validation'

function SignIn({ goTo }) {
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

    goTo('user-dashboard')
  }

  return (
    <AuthLayout title="Sign in" role="User" onRoleChange={() => goTo('admin-sign-in')}>
      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.edu"
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
          No account yet?{' '}
          <button type="button" className="link-button" onClick={() => goTo('create-account')}>
            Create one
          </button>
        </p>
        {/* Demo shortcut: skips the form until the backend exists (A3) */}
        <p>
          <button type="button" className="link-button" onClick={() => goTo('user-dashboard')}>
            Skip sign in (demo)
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default SignIn
