// Field checks. Each returns an error message, or '' when the value is fine.
// Same rules as frontend/src/utils/validation.js.

function checkText(value, label, maxLength = 50) {
  if (value === undefined || value === null) return `${label} is required.`
  if (typeof value !== 'string') return `${label} must be text.`
  if (value.trim() === '') return `${label} is required.`
  if (value.length > maxLength) return `${label} must be ${maxLength} characters or less.`
  return ''
}

function checkEmail(value) {
  const error = checkText(value, 'Email', 254)
  if (error) return error
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email, like you@example.edu.'
  return ''
}

function checkPassword(value) {
  const error = checkText(value, 'Password', 64)
  if (error) return error
  if (value.length < 8) return 'Password must be at least 8 characters.'
  return ''
}

function checkWholeNumber(value, label, min, max) {
  if (value === undefined || value === null || value === '') return `${label} is required.`
  if (!Number.isInteger(value)) return `${label} must be a whole number.`
  if (value < min || value > max) return `${label} must be between ${min} and ${max}.`
  return ''
}

function checkOneOf(value, options, label) {
  if (value === undefined || value === null || value === '') return `${label} is required.`
  if (!options.includes(value)) return `${label} must be one of: ${options.join(', ')}.`
  return ''
}

// 24-hour time like "09:00" or "16:30"
function checkTime(value, label) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return `${label} must be a time like 09:00.`
  return ''
}

function checkTrueFalse(value, label) {
  if (typeof value !== 'boolean') return `${label} must be true or false.`
  return ''
}

// Place join codes are 6-digit numbers, e.g. 482913. Accepts "482913" or 482913.
function checkJoinCode(value) {
  if (value === undefined || value === null || value === '') return 'Code is required.'
  if (!/^\d{6}$/.test(String(value).trim())) return 'Code must be 6 digits.'
  return ''
}

// Keeps only the fields that failed. Returns null when everything passed.
function findErrors(checks) {
  const errors = {}
  for (const [field, message] of Object.entries(checks)) {
    if (message) errors[field] = message
  }
  return Object.keys(errors).length > 0 ? errors : null
}

module.exports = {
  checkText,
  checkEmail,
  checkPassword,
  checkWholeNumber,
  checkOneOf,
  checkTime,
  checkTrueFalse,
  checkJoinCode,
  findErrors,
}
