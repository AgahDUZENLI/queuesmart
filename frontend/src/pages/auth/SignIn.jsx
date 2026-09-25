import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Button from '../../components/Button'

function SignIn({ goTo }) {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    console.log('Sign in', { emailOrPhone })
  }

  return (
    <AuthLayout title="Sign in" role="User" onRoleChange={() => goTo('admin-sign-in')}>
      <form onSubmit={handleSubmit}>
        <TextInput
          id="email-or-phone"
          label="Email or phone"
          value={emailOrPhone}
          onChange={setEmailOrPhone}
          placeholder="you@example.edu"
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
          No account yet?{' '}
          <button type="button" className="link-button" onClick={() => goTo('create-account')}>
            Create one
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default SignIn
