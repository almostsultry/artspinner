import { DIMENSIONS } from '../scoring.js'

export default function SubmitBar({ scoredCount, total, prioritizedCount, submission, roundOpen, onSubmit }) {
  const pct = total ? Math.round((scoredCount / total) * 100) : 0
  const weightsLabel = DIMENSIONS.map((d) => `${d.short} ${Math.round(d.defaultWeight * 100)}%`).join(' · ')
  return (
    <div className="submit-bar">
      <span>{scoredCount} of {total} scored · {prioritizedCount} prioritized</span>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      <span style={{ color: '#8f8e88', fontSize: 12 }}>Priority Score = {weightsLabel}</span>
      {submission && (
        <span className="submitted-note">
          Submitted {new Date(submission.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {roundOpen && ' — you can still edit and resubmit until the round closes'}
        </span>
      )}
      <button
        className="submit-btn" onClick={onSubmit}
        disabled={!roundOpen || scoredCount === 0}
        title={!roundOpen ? 'Round is closed' : scoredCount < total ? 'You can submit a partial scoresheet' : ''}
      >
        {submission ? 'Resubmit' : 'Submit'} prioritization
      </button>
    </div>
  )
}
