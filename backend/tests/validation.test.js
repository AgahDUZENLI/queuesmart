const { checkText, checkEmail, checkPassword, findErrors } = require('../src/validation')

test('checkText requires a non-blank string within the length limit', () => {
  expect(checkText(undefined, 'Name')).toBe('Name is required.')
  expect(checkText('   ', 'Name')).toBe('Name is required.')
  expect(checkText(42, 'Name')).toBe('Name must be text.')
  expect(checkText('a'.repeat(51), 'Name')).toBe('Name must be 50 characters or less.')
  expect(checkText('a'.repeat(50), 'Name')).toBe('')
})

test('checkEmail accepts valid emails and rejects bad ones', () => {
  expect(checkEmail('you@example.edu')).toBe('')
  expect(checkEmail(' padded@example.com ')).toBe('')
  expect(checkEmail('')).toBe('Email is required.')
  expect(checkEmail('no-at.example.com')).toBe('Enter a valid email, like you@example.edu.')
  expect(checkEmail('has space@example.com')).toBe('Enter a valid email, like you@example.edu.')
})

test('checkPassword requires 8 to 64 characters', () => {
  expect(checkPassword('short')).toBe('Password must be at least 8 characters.')
  expect(checkPassword('a'.repeat(65))).toBe('Password must be 64 characters or less.')
  expect(checkPassword('a'.repeat(8))).toBe('')
  expect(checkPassword(12345678)).toBe('Password must be text.')
})

test('findErrors keeps only failed fields, or returns null', () => {
  expect(findErrors({ email: 'Email is required.', password: '' })).toEqual({ email: 'Email is required.' })
  expect(findErrors({ email: '', password: '' })).toBeNull()
})
