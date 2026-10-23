// Each check returns an error message, or '' when the value is fine.
// Same limits as backend/src/validation.js; the backend checks everything again.

export function checkRequired(value, label) {
  if (value.trim() === '') return `${label} is required.`
  return ''
}

export function checkName(value, label) {
  if (value.trim() === '') return `${label} is required.`
  if (value.length > 50) return `${label} must be 50 characters or less.`
  return ''
}

export function checkEmail(value) {
  if (value.trim() === '') return 'Email is required.'
  if (value.length > 254) return 'Email must be 254 characters or less.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email, like you@example.edu.'
  return ''
}

export function checkPassword(value) {
  if (value === '') return 'Password is required.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (value.length > 64) return 'Password must be 64 characters or less.'
  return ''
}

// True when at least one field has an error message
export function hasErrors(errors) {
  return Object.values(errors).some((message) => message !== '')
}
