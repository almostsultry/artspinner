import { DIMENSIONS, priorityScore } from '../scoring.js'
import { isFullyScored } from '../scoring.js'
import ScoreStepper from './ScoreStepper.jsx'

export default function StoryRow({
  story, score, weights, rank, onScore, onComment, disabled, gripProps,
  locked, currentSprint, onToggleLock, showEpic, onAdd, onRemove,
}) {
  const total = priorityScore(score, weights)
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
        {DIMENSIONS.map((d) => (
          <ScoreStepper
            key={d.key} dim={d} value={score?.[d.key]} disabled={disabled || locked}
            onChange={(v) => onScore(story.id, d.key, v)}
          />
        ))}
      </div>
      <span className={`score-badge ${total === null ? 'empty' : ''}`} title="Weighted priority score">
        {total === null ? '—' : total.toFixed(2)}
      </span>
      {onAdd && !locked && (
        <button
          className="add-btn" disabled={disabled || !isFullyScored(score)}
          title={isFullyScored(score) ? 'Add to your sprint prioritization' : 'Score all four dimensions first'}
          onClick={() => onAdd(story.id)}
        >
          ↑ Prioritize
        </button>
      )}
      {onRemove && (
        <button className="comment-btn" title="Send back to the backlog" onClick={() => onRemove(story.id)}>✕</button>
      )}
      <button className="comment-btn" onClick={() => onComment(story)}>💬 Discuss</button>
    </div>
  )
}
