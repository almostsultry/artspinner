import { EXEC_DIMENSIONS, SHARED_DIMENSIONS } from '../scoring.js'

export default function SubmitBar({
  scoredCount, total, prioritizedCount, awaitingAnalysis, submission, roundOpen, onSubmit,
}) {
  const pct = total ? Math.round((scoredCount / total) * 100) : 0
  const weightsLabel = [EXEC_DIMENSIONS[0], SHARED_DIMENSIONS[0], SHARED_DIMENSIONS[1], EXEC_DIMENSIONS[1]]
    .map((d) => `${d.short} ${Math.round(d.defaultWeight * 100)}%`).join(' · ')
  return (
    <div className="submit-bar">
      <span>{scoredCount} of {total} scored · {prioritizedCount} prioritized</span>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      <span style={{ color: '#8f8e88', fontSize: 12 }}>Priority Score = {weightsLabel}</span>
      {awaitingAnalysis > 0 && (
        <span style={{ color: '#e8c96a', fontSize: 12 }} title="Feasibility/Readiness not yet set by the facilitator">
          {awaitingAnalysis} awaiting analysis
        </span>
      )}
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
