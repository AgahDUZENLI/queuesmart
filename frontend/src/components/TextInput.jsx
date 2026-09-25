function TextInput({ id, label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export default TextInput
