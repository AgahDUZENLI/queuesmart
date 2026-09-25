function Button({ children, variant = 'primary', type = 'button', onClick }) {
  return (
    <button type={type} className={`button ${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}

export default Button
