import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { EXEC_DIMENSIONS } from '../scoring.js'

function fmtWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const DIM_SHORT = { businessValue: 'BV', strategicFit: 'SF', feasibility: 'FE', readiness: 'RD' }

export default function Sidecar({ story, score, onScore, disabled, userName, onClose }) {
  const [comments, setComments] = useState(null)
  const [rationales, setRationales] = useState([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    setComments(null)
    api.comments(story.id).then(setComments)
    api.rationales(story.id).then(setRationales)
  }, [story.id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function post() {
    const text = draft.trim()
    if (!text) return
    setPosting(true)
    try {
      const comment = await api.postComment(story.id, text)
      setComments((prev) => [...(prev || []), comment])
      setDraft('')
    } finally {
      setPosting(false)
    }
  }

  // Rationales from others (own notes are edited in the form above the list).
  const peerRationales = rationales.filter((r) => r.author !== userName)

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="sidecar" role="dialog" aria-label={`Discussion: ${story.title}`}>
        <div className="sidecar-head">
          <button className="sidecar-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="sidecar-title">{story.title}</div>
          <div className="story-chips" style={{ marginTop: 6 }}>
            <span className="chip">#{story.id}</span>
            <span className="chip">{story.businessLine}</span>
            <span className="chip">Size {story.tshirtSize}</span>
          </div>
        </div>
        <div className="comments">
          <div className="rationale-block">
            <div className="rationale-head">Your score rationale</div>
            <div className="rationale-hint">
              Quantify your scores where you can — “$2MM/yr margin”, “50% of 4 headcount weekly”,
              “5 hours/month”. Shown to the other executives with your score.
            </div>
            {EXEC_DIMENSIONS.map((d) => (
              <div className="rationale-row" key={d.key}>
                <span className="rationale-dim" title={d.label}>
                  {d.short}{score?.[d.key] ? ` ${score[d.key]}` : ' —'}
                </span>
                <input
                  className="note-input" style={{ width: '100%' }}
                  placeholder={`Why this ${d.label} score…`}
                  disabled={disabled}
                  value={score?.[d.noteKey] || ''}
                  onChange={(e) => onScore(story.id, d.noteKey, e.target.value)}
                />
              </div>
            ))}
          </div>

          {peerRationales.length > 0 && (
            <div className="rationale-block">
              <div className="rationale-head">Score rationales from the group</div>
              {peerRationales.map((r, i) => (
                <div className="comment" key={i}>
                  <div className="comment-meta">
                    <b>{r.author}</b> · {DIM_SHORT[r.dimension] || r.dimension}{r.value ? ` ${r.value}/5` : ''}
                  </div>
                  <div className="comment-body">{r.note}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rationale-head" style={{ marginTop: 4 }}>Discussion</div>
          {comments === null && <span style={{ color: 'var(--muted)' }}>Loading discussion…</span>}
          {comments?.length === 0 && (
            <span style={{ color: 'var(--muted)' }}>No comments yet — start the discussion.</span>
          )}
          {comments?.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-meta"><b>{c.author}</b> · {fmtWhen(c.postedAt)}</div>
              <div className="comment-body">{c.text}</div>
            </div>
          ))}
        </div>
        <div className="comment-form">
          <textarea
            className="comment-input" value={draft} placeholder="Share your thinking with the group…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post() }}
          />
          <button className="post-btn" onClick={post} disabled={posting || !draft.trim()}>Post</button>
        </div>
      </aside>
    </>
  )
}
