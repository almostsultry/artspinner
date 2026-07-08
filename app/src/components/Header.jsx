const TABS = [
  { id: 'prioritize', label: 'Prioritize' },
  { id: 'dashboard', label: 'Dashboard' },
]

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Header({ view, onView, user, round, onRoundAction, onCopilot }) {
  const open = round?.status === 'Open'
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Portfolio Prioritization
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => onView(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="header-right">
        <button className="copilot-btn" onClick={onCopilot}>✦ Copilot</button>
        {round && (
          <span className="round-chip">
            {round.name} · {open ? <>closes <b>{fmtDate(round.closesOn)}</b></> : <b>Closed</b>}
          </span>
        )}
        {onRoundAction && (
          <button className="admin-btn" onClick={() => onRoundAction(open ? 'close' : 'open')}>
            {open ? 'Close round' : 'Reopen round'}
          </button>
        )}
        <span className="user-chip">{user.name}</span>
      </div>
    </header>
  )
}
