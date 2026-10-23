import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'
import { checkEmail, checkRequired, hasErrors } from '../../utils/validation'
import { login, DEMO_USERS } from '../../api'

function SignIn({ goTo, onSignedIn, joinCode }) {
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
      await login(signInEmail, signInPassword, 'user')
      onSignedIn()
    } catch (error) {
      setErrors({ ...error.fields, form: hasErrors(error.fields) ? '' : error.message })
    }
  }

  return (
    <AuthLayout title="Sign in" role="User" onRoleChange={() => goTo('admin-sign-in')}>
      <form onSubmit={handleSubmit} noValidate>
        {joinCode && <p className="notice">Sign in to add the place with code {joinCode}.</p>}
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
        {errors.form && <p className="error" role="alert">{errors.form}</p>}
        <Button type="submit">Sign in</Button>
        <p>
          No account yet?{' '}
          <button type="button" className="link-button" onClick={() => goTo('create-account')}>
            Create one
          </button>
        </p>
        <div className="demo-logins">
          {DEMO_USERS.map((account) => (
            <p key={account.email}>
              <button type="button" className="link-button" onClick={() => signIn(account.email, account.password)}>
                Sign in as {account.name} (demo user)
              </button>
            </p>
          ))}
        </div>
      </form>
    </AuthLayout>
  )
}

export default SignIn
