// Clock-style wheel: the green ring fills as the wait goes by.
// minutesLeft: big number in the middle. progress: 0 (just joined) to 1 (your turn).
const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = 105
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ticks = Array.from({ length: 60 }, (_, i) => i)

function WaitWheel({ minutesLeft, progress, label }) {
  return (
    <svg className="wait-wheel" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${minutesLeft} minutes left. ${label}`}>
      {ticks.map((i) => {
        const angle = (i * 6 - 90) * (Math.PI / 180)
        const long = i % 5 === 0
        const inner = long ? 122 : 126
        return (
          <line
            key={i}
            x1={CENTER + inner * Math.cos(angle)}
            y1={CENTER + inner * Math.sin(angle)}
            x2={CENTER + 132 * Math.cos(angle)}
            y2={CENTER + 132 * Math.sin(angle)}
            className={i / 60 < progress ? 'tick done' : long ? 'tick long' : 'tick'}
          />
        )
      })}
      <circle className="wheel-track" cx={CENTER} cy={CENTER} r={RADIUS} />
      <circle
        className="wheel-progress"
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
      <text className="wheel-number" x={CENTER} y={CENTER + 4}>{minutesLeft}</text>
      <text className="wheel-unit" x={CENTER} y={CENTER + 34}>minutes left</text>
      <text className="wheel-label" x={CENTER} y={CENTER + 60}>{label}</text>
    </svg>
  )
}

export default WaitWheel
