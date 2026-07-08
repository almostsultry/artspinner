import { useRef } from 'react'
import { SHARED_DIMENSIONS, SIZE_TO_FEASIBILITY } from '../scoring.js'
import ScoreStepper from './ScoreStepper.jsx'

// Facilitator interface: Feasibility and Readiness are analyzed facts, set
// here (only) after business analysis and consultative review — executives
// see them read-only. T-shirt size suggests a feasibility starting point.
export default function AdminView({ stories, facts, onSaveFacts }) {
  const timers = useRef({})

  function update(storyId, patch) {
    clearTimeout(timers.current[storyId])
    timers.current[storyId] = setTimeout(() => onSaveFacts(storyId, patch), 500)
  }

  const pending = stories.filter((s) => !(facts[s.id]?.feasibility >= 1 && facts[s.id]?.readiness >= 1))

  return (
    <>
      <h2 className="section-title">
        Story analysis
        {pending.length > 0 && <span className="count-chip" title="Stories awaiting analysis">{pending.length} pending</span>}
      </h2>
      <p className="view-note">
        Set the shared Feasibility and Readiness values after your analysis and consultative
        review — executives see these read-only, and stories can't produce a priority score
        without them. The suggested feasibility from t-shirt size is a starting point, not an answer.
      </p>
      <div className="rank-list">
        {stories.map((story) => {
          const f = facts[story.id] || {}
          const suggested = SIZE_TO_FEASIBILITY[story.tshirtSize]
          return (
            <div className="admin-row" key={story.id}>
              <div className="story-main">
                <div className="story-title">{story.title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>#{story.id}</span></div>
                <div className="story-chips">
                  <span className="chip">{story.businessLine}</span>
                  <span className="chip">Size {story.tshirtSize}</span>
                  <span className="chip state">{story.state}</span>
                  {suggested && !f.feasibility && (
                    <button
                      className="link-btn" style={{ fontSize: 11 }}
                      title={`Size ${story.tshirtSize} suggests feasibility ${suggested}`}
                      onClick={() => onSaveFacts(story.id, { feasibility: suggested })}
                    >
                      Suggest FE {suggested} from size
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-facts">
                {SHARED_DIMENSIONS.map((d) => (
                  <div className="admin-fact" key={d.key}>
                    <ScoreStepper
                      dim={d} value={f[d.key]}
                      onChange={(v) => onSaveFacts(story.id, { [d.key]: v ?? null })}
                    />
                    <input
                      className="note-input"
                      placeholder={`${d.label} rationale…`}
                      defaultValue={f[d.noteKey] || ''}
                      onChange={(e) => update(story.id, { [d.noteKey]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
