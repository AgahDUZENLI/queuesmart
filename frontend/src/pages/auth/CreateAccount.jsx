import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Checkbox from '../../components/Checkbox'
import Button from '../../components/Button'
import { checkEmail, checkName, checkPassword, hasErrors } from '../../utils/validation'

function CreateAccount({ goTo }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailMe, setEmailMe] = useState(true)
  const [errors, setErrors] = useState({})

  function handleSubmit(event) {
    event.preventDefault()
    const newErrors = {
      firstName: checkName(firstName, 'First name'),
      lastName: checkName(lastName, 'Last name'),
      email: checkEmail(email),
      password: checkPassword(password),
    }
    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    goTo('user-dashboard')
  }

  return (
    <AuthLayout title="Create an account" role="User" onRoleChange={() => goTo('admin-create-account')}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="two-columns">
          <TextInput id="first-name" label="First name" value={firstName} onChange={setFirstName} required maxLength={50} error={errors.firstName} />
          <TextInput id="last-name" label="Last name" value={lastName} onChange={setLastName} required maxLength={50} error={errors.lastName} />
        </div>
        <TextInput
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.edu"
          hint="You’ll use this to sign in."
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
        <Checkbox
          id="email-me"
          label="Email me when it’s almost my turn"
          checked={emailMe}
          onChange={setEmailMe}
        />
        <Button type="submit">Create account</Button>
        <p>
          Already have an account?{' '}
          <button type="button" className="link-button" onClick={() => goTo('sign-in')}>
            Sign in
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}

export default CreateAccount
