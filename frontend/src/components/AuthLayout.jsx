import Toggle from './Toggle'

// Shared frame for the sign in and create account pages:
// role is "User" or "Admin"; onRoleChange is called when the toggle is clicked.
function AuthLayout({ title, role, onRoleChange, children }) {
  return (
    <div>
      <header className="header">
        <a href="/" className="logo">QueueSmart</a>
      </header>
      <main className="container">
        <Toggle options={['User', 'Admin']} selected={role} onChange={onRoleChange} />
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  )
}

export default AuthLayout
