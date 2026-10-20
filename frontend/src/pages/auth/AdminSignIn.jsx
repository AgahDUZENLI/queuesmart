import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'
import { checkEmail, checkRequired, hasErrors } from '../../utils/validation'
import { login, DEMO_ADMIN } from '../../api'

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

    signIn(email, password)
  }

  async function signIn(signInEmail, signInPassword) {
    try {
      await login(signInEmail, signInPassword, 'admin')
      goTo('admin-overview')
    } catch (error) {
      setErrors({ ...error.fields, form: hasErrors(error.fields) ? '' : error.message })
    }
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
        {errors.form && <p className="error" role="alert">{errors.form}</p>}
        <Button type="submit">Sign in</Button>
        <p>
          New here?{' '}
          <button type="button" className="link-button" onClick={() => goTo('admin-create-account')}>
            Create an admin account
          </button>
        </p>
        {/* Demo shortcut: signs in with the demo account from backend/src/demo.js */}
        <p>
          <button type="button" className="link-button" onClick={() => signIn(DEMO_ADMIN.email, DEMO_ADMIN.password)}>
            Sign in as demo admin
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default AdminSignIn
