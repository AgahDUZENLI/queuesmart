function TextInput({ id, label, type = 'text', value, onChange, placeholder, hint, error, required, maxLength }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className={error ? 'invalid' : ''}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <span id={`${id}-error`} className="error">{error}</span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  )
}

export default TextInput
