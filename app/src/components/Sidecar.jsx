import { useEffect, useState } from 'react'
import { api } from '../api.js'

function fmtWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function Sidecar({ story, onClose }) {
  const [comments, setComments] = useState(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    setComments(null)
    api.comments(story.id).then(setComments)
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
