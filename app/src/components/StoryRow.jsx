import {
  EXEC_DIMENSIONS, SHARED_DIMENSIONS, priorityScore, isExecScored, hasFacts,
} from '../scoring.js'
import ScoreStepper from './ScoreStepper.jsx'

export default function StoryRow({
  story, score, facts, weights, rank, onScore, onComment, disabled, gripProps,
  locked, currentSprint, onToggleLock, showEpic, onAdd, onRemove,
}) {
  const total = priorityScore(score, facts, weights)
  const analyzed = hasFacts(facts)
  const inCurrentSprint = story.sprint && story.sprint === currentSprint
  return (
    <div className="story-row" style={locked ? { opacity: 0.72 } : undefined}>
      {gripProps && (
        <button className="grip" aria-label={`Reorder ${story.title}`} {...gripProps}>⠿</button>
      )}
      {rank !== undefined && (
        <span className="rank-badge" title="Your manual priority position">{rank + 1}</span>
      )}
      <div className="story-main">
        <div className="story-title">{story.title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>#{story.id}</span></div>
        <div className="story-summary">{story.summary}</div>
        <div className="story-chips">
          {showEpic && story.epicTitle && <span className="chip epic">{story.epicTitle}</span>}
          <span className="chip">{story.businessLine}</span>
          <span className="chip">Size {story.tshirtSize}</span>
          <span className="chip state">{story.state}</span>
          {locked && <span className="chip" title="In the current sprint — planning targets future sprints">🔒 {story.sprint} · locked</span>}
          {inCurrentSprint && !locked && <span className="chip">🔓 {story.sprint} · admin unlocked</span>}
          {inCurrentSprint && onToggleLock && (
            <button className="link-btn" style={{ fontSize: 11 }} onClick={() => onToggleLock(story.id, locked)}>
              {locked ? 'Unlock for re-prioritization' : 'Relock'}
            </button>
          )}
        </div>
      </div>
      <div className="steppers">
        {EXEC_DIMENSIONS.map((d) => (
          <div key={d.key} className="stepper-wrap">
            <ScoreStepper
              dim={d} value={score?.[d.key]} disabled={disabled || locked}
              onChange={(v) => onScore(story.id, d.key, v)}
            />
            {score?.[d.noteKey] && <span className="note-dot" title={`Your rationale: ${score[d.noteKey]}`}>📝</span>}
          </div>
        ))}
        <div className="shared-chips" title="Set by the facilitator after analysis — see the Admin tab">
          {SHARED_DIMENSIONS.map((d) => (
            <span
              key={d.key}
              className={`fact-chip ${facts?.[d.key] ? '' : 'pending'}`}
              title={facts?.[d.key]
                ? `${d.label} ${facts[d.key]}/5${facts[d.noteKey] ? ` — ${facts[d.noteKey]}` : ''}`
                : `${d.label}: awaiting facilitator analysis`}
            >
              {d.short} {facts?.[d.key] ?? '—'}
            </span>
          ))}
        </div>
      </div>
      <span
        className={`score-badge ${total === null ? 'empty' : ''}`}
        title={total !== null ? 'Weighted priority score'
          : !analyzed ? 'Awaiting facilitator analysis (Feasibility/Readiness)'
          : 'Score Business Value and Strategic Fit to compute'}
      >
        {total === null ? (analyzed ? '—' : '…') : total.toFixed(2)}
      </span>
      {onAdd && !locked && (
        <button
          className="add-btn" disabled={disabled || !isExecScored(score) || !analyzed}
          title={!analyzed ? 'Awaiting facilitator analysis'
            : isExecScored(score) ? 'Add to your sprint prioritization'
            : 'Score Business Value and Strategic Fit first'}
          onClick={() => onAdd(story.id)}
        >
          ↑ Prioritize
        </button>
      )}
      {onRemove && (
        <button className="comment-btn" title="Send back to the backlog" onClick={() => onRemove(story.id)}>✕</button>
      )}
      <button className="comment-btn" onClick={() => onComment(story)} title="Discussion & score rationale">💬 Discuss</button>
    </div>
  )
}
