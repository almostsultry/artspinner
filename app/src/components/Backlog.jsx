import { useState } from 'react'
import { priorityScore } from '../scoring.js'
import StoryRow from './StoryRow.jsx'

function EpicGroup({
  epic, stories, scores, facts, weights, onScore, onComment, onAdd, disabled,
  lockedIds, currentSprint, onToggleLock,
}) {
  const [open, setOpen] = useState(true)
  const score = (s) => priorityScore(scores[s.id], facts[s.id], weights)
  const scored = stories.map(score).filter((v) => v !== null)
  const avg = scored.length ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(2) : null
  const sorted = [...stories].sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1) || a.id - b.id)

  return (
    <section className="epic-group">
      <button className="epic-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`epic-caret ${open ? 'open' : ''}`}>▶</span>
        <span className="epic-title">{epic.title}</span>
        <span className="epic-meta">
          <span className="chip">{epic.businessLine}</span>
          <span className="chip">{stories.length} stories</span>
          {avg && <span className="chip" title="Average of your priority scores in this epic">avg {avg}</span>}
        </span>
      </button>
      {open && sorted.map((story) => (
        <StoryRow
          key={story.id} story={story} score={scores[story.id]} facts={facts[story.id]} weights={weights}
          onScore={onScore} onComment={onComment} onAdd={onAdd} disabled={disabled}
          locked={lockedIds.has(story.id)} currentSprint={currentSprint} onToggleLock={onToggleLock}
        />
      ))}
    </section>
  )
}

export default function Backlog({
  epics, stories, scores, facts, weights, onScore, onComment, onAdd, disabled,
  lockedIds, currentSprint, onToggleLock,
}) {
  return (
    <section>
      <h2 className="section-title">Unprioritized backlog <span className="count-chip">{stories.length}</span></h2>
      <p className="view-note">
        Grouped by Epic. Score <b>Business Value</b> and <b>Strategic Fit</b> 1–5 (hover a label
        for its criteria — drafts autosave); Feasibility and Readiness are set by the facilitator
        after analysis. Then <b>Prioritize</b> to add a story to your numbered list above.
        Current-sprint stories are locked; this round plans future sprints.
      </p>
      {epics.map((epic) => {
        const epicStories = stories.filter((s) => s.epicId === epic.id)
        if (!epicStories.length) return null
        return (
          <EpicGroup
            key={epic.id} epic={epic} stories={epicStories} scores={scores} facts={facts} weights={weights}
            onScore={onScore} onComment={onComment} onAdd={onAdd} disabled={disabled}
            lockedIds={lockedIds} currentSprint={currentSprint} onToggleLock={onToggleLock}
          />
        )
      })}
    </section>
  )
}
