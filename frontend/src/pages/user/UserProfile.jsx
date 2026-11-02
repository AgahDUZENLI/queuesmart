// Profile page: shows the saved profile from the database and lets the user edit it.
// Full name, optional phone and the email preference are saved with PUT /api/profile/me.
// The email is shown but cannot be changed (it is the login).

import { useEffect, useState } from 'react'
import UserLayout from '../../components/UserLayout'
import TextInput from '../../components/TextInput'
import Checkbox from '../../components/Checkbox'
import Button from '../../components/Button'
import { checkName, checkPhone, hasErrors } from '../../utils/validation'
import { getProfile, updateProfile } from '../../api'

function UserProfile({ goTo, queue }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [emailMe, setEmailMe] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  function showProfile(profile) {
    setEmail(profile.email)
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setPhone(profile.phone || '')
    setEmailMe(profile.emailMe)
  }

  // Load the saved profile from the database when the page opens
  useEffect(() => {
    getProfile()
      .then((data) => {
        showProfile(data.profile)
        setLoaded(true)
      })
      .catch((error) => setErrors({ form: error.message }))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaved(false)
    const newErrors = {
      firstName: checkName(firstName, 'First name'),
      lastName: checkName(lastName, 'Last name'),
      phone: checkPhone(phone),
    }
    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    try {
      showProfile(await updateProfile({ firstName, lastName, phone, emailMe }))
      setSaved(true)
    } catch (error) {
      setErrors({ ...error.fields, form: hasErrors(error.fields) ? '' : error.message })
    }
  }

  return (
    <UserLayout title="Profile" subtitle="Your name, contact details and notification preference." active="user-profile" goTo={goTo} queue={queue}>
      {!loaded && !errors.form && <p>Loading your profile…</p>}
      {errors.form && <p className="error" role="alert">{errors.form}</p>}
      {loaded && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="two-columns">
            <TextInput id="profile-first-name" label="First name" value={firstName} onChange={setFirstName} required maxLength={50} error={errors.firstName} />
            <TextInput id="profile-last-name" label="Last name" value={lastName} onChange={setLastName} required maxLength={50} error={errors.lastName} />
          </div>
          <div className="field">
            <span>Email</span>
            <p><strong>{email}</strong></p>
            <span className="hint">This is your sign-in email, so it can’t be changed here.</span>
          </div>
          <TextInput
            id="profile-phone"
            label="Phone (optional)"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="555-123-4567"
            maxLength={20}
            error={errors.phone}
          />
          <Checkbox id="profile-email-me" label="Email me when it’s almost my turn" checked={emailMe} onChange={setEmailMe} />
          <Button type="submit">Save changes</Button>
          {saved && <p role="status">Saved.</p>}
        </form>
      )}
    </UserLayout>
  )
}

export default UserProfile
