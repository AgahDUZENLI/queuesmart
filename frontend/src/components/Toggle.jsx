// A row of options where one is selected, e.g. User | Admin
function Toggle({ options, selected, onChange }) {
  return (
    <div className="toggle">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={option === selected ? 'selected' : ''}
          aria-pressed={option === selected}
          onClick={() => option !== selected && onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export default Toggle
