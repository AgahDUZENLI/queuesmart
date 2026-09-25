import { useState } from 'react'
import AuthLayout from '../../components/AuthLayout'
import TextInput from '../../components/TextInput'
import Checkbox from '../../components/Checkbox'
import Button from '../../components/Button'

function CreateAccount({ goTo }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [textMe, setTextMe] = useState(true)

  function handleSubmit(event) {
    event.preventDefault()
    console.log('Create account', { firstName, lastName, emailOrPhone, textMe })
  }

  return (
    <AuthLayout title="Create an account" role="User" onRoleChange={() => goTo('admin-create-account')}>
      <form onSubmit={handleSubmit}>
        <div className="two-columns">
          <TextInput id="first-name" label="First name" value={firstName} onChange={setFirstName} />
          <TextInput id="last-name" label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <TextInput
          id="email-or-phone"
          label="Email or phone"
          value={emailOrPhone}
          onChange={setEmailOrPhone}
          placeholder="you@example.edu"
          hint="We send your queue updates here."
        />
        <TextInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          hint="At least 8 characters."
        />
        <Checkbox
          id="text-me"
          label="Text me when it’s my turn"
          checked={textMe}
          onChange={setTextMe}
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
