// One 1–5 segmented control per scoring dimension. Clicking the selected
// value clears it back to unscored.
export default function ScoreStepper({ dim, value, onChange, disabled }) {
  return (
    <div className="stepper" title={`${dim.label}: ${dim.criteria}`}>
      <span className="stepper-label">{dim.short}</span>
      <div className="segs" role="radiogroup" aria-label={dim.label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`seg ${value === n ? 'on' : ''}`}
            disabled={disabled}
            aria-checked={value === n}
            role="radio"
            onClick={() => onChange(value === n ? undefined : n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
