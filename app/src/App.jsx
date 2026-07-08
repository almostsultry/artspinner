import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { isFullyScored } from './scoring.js'
import Header from './components/Header.jsx'
import PrioritizeView from './components/PrioritizeView.jsx'
import Sidecar from './components/Sidecar.jsx'
import CopilotPanel from './components/CopilotPanel.jsx'
import SubmitBar from './components/SubmitBar.jsx'

const Dashboard = lazy(() => import('./components/Dashboard.jsx'))

export default function App() {
  const [boot, setBoot] = useState(null)
  const [view, setView] = useState('prioritize')
  const [scores, setScores] = useState({})
  const [ranks, setRanks] = useState([])
  const [submission, setSubmission] = useState(null)
  const [round, setRound] = useState(null)
  const [sidecarStory, setSidecarStory] = useState(null)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [unlocks, setUnlocks] = useState([])
  const saveTimers = useRef({})

  useEffect(() => {
    api.bootstrap().then((b) => {
      setBoot(b)
      setScores(b.myScores || {})
      setRanks(b.myRanks || [])
      setSubmission(b.submission)
      setRound(b.round)
      setUnlocks(b.unlocks || [])
    })
  }, [])

  const roundOpen = round?.status === 'Open'

  // Stories enriched with their epic title — shown as a tag once a story is
  // in the prioritized list (epic grouping only exists in the backlog).
  const stories = useMemo(() => {
    if (!boot) return []
    const epicTitle = new Map(boot.epics.map((e) => [e.id, e.title]))
    return boot.stories.map((s) => ({ ...s, epicTitle: epicTitle.get(s.epicId) }))
  }, [boot])

  // Current-sprint items are locked for executives (planning targets future
  // sprints only) unless an admin has explicitly unlocked them.
  const lockedIds = useMemo(() => {
    if (!round) return new Set()
    const unlocked = new Set(unlocks)
    return new Set(
      stories
        .filter((s) => s.sprint && s.sprint === round.currentSprint && !unlocked.has(s.id))
        .map((s) => s.id),
    )
  }, [stories, round, unlocks])

  const setScore = useCallback((storyId, dimKey, value) => {
    setScores((prev) => {
      const next = { ...prev, [storyId]: { ...prev[storyId], [dimKey]: value } }
      clearTimeout(saveTimers.current[storyId])
      saveTimers.current[storyId] = setTimeout(() => api.saveScore(storyId, next[storyId]), 400)
      return next
    })
  }, [])

  const setOrder = useCallback((order) => {
    setRanks(order)
    api.saveRanks(order)
  }, [])

  const submit = async () => {
    const r = await api.submit()
    setSubmission(r.submission)
  }

  const roundAction = async (action) => {
    const r = await api.roundAction(action)
    setRound((prev) => ({ ...prev, status: r.status }))
  }

  const toggleLock = useCallback(async (storyId, currentlyLocked) => {
    const r = await api.setLock(storyId, currentlyLocked)
    setUnlocks(r.unlocks)
  }, [])

  if (!boot) return <div className="loading">Loading…</div>

  const plannable = stories.filter((s) => !lockedIds.has(s.id))
  const scoredCount = plannable.filter((s) => isFullyScored(scores[s.id])).length

  return (
    <>
      <Header
        view={view} onView={setView}
        user={boot.user} round={round}
        onRoundAction={boot.user.isAdmin ? roundAction : null}
        onCopilot={() => { setSidecarStory(null); setCopilotOpen(true) }}
      />
      <main className="main">
        {view === 'prioritize' && (
          <PrioritizeView
            epics={boot.epics} stories={stories} scores={scores} weights={boot.weights}
            ranks={ranks} onReorder={setOrder} onScore={setScore} onComment={setSidecarStory}
            disabled={!roundOpen} lockedIds={lockedIds}
            currentSprint={round?.currentSprint}
            onToggleLock={boot.user.isAdmin ? toggleLock : null}
          />
        )}
        {view === 'dashboard' && (
          <Suspense fallback={<div className="loading">Loading dashboard…</div>}>
            <Dashboard />
          </Suspense>
        )}
      </main>
      {view === 'prioritize' && (
        <SubmitBar
          scoredCount={scoredCount} total={plannable.length} prioritizedCount={ranks.length}
          submission={submission} roundOpen={roundOpen} onSubmit={submit}
        />
      )}
      {sidecarStory && <Sidecar story={sidecarStory} onClose={() => setSidecarStory(null)} />}
      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
    </>
  )
}
