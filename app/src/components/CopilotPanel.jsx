import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

const SUGGESTIONS = [
  'What are the top priorities?',
  'Where does leadership disagree?',
  'What moved since last round?',
  'Who still needs to submit?',
]

// Second use of the sidecar: a copilot that analyzes this round's data.
// Backed by /api/assistant — deterministic aggregate answers in mock mode,
// an LLM (Azure OpenAI) or an embedded Copilot Studio agent in live mode.
export default function CopilotPanel({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi — I can analyze this prioritization round: top priorities, disagreement between scorers, movers, carryover, velocity, and participation. What would you like to know?' },
  ])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function ask(question) {
    const text = (question ?? draft).trim()
    if (!text || busy) return
    setDraft('')
    setBusy(true)
    setMessages((m) => [...m, { role: 'user', text }])
    try {
      const { reply } = await api.askAssistant(text)
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'bot', text: `Something went wrong: ${err.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="sidecar" role="dialog" aria-label="Copilot">
        <div className="sidecar-head">
          <button className="sidecar-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="sidecar-title">✦ Copilot</div>
          <div className="card-sub" style={{ margin: '4px 0 0' }}>Analyzes this round's scores, ranks, and delivery data</div>
        </div>
        <div className="comments" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="chat-msg bot">…</div>}
          {messages.length === 1 && (
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="comment-form">
          <textarea
            className="comment-input" value={draft} placeholder="Ask about this round's data…"
            style={{ minHeight: 44 }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          />
          <button className="post-btn" onClick={() => ask()} disabled={busy || !draft.trim()}>Ask</button>
        </div>
      </aside>
    </>
  )
}
