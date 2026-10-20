function Button({ children, variant = 'primary', type = 'button', onClick, disabled = false }) {
  return (
    <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default Button
