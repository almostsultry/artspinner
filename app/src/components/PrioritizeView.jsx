import { useMemo } from 'react'
import PrioritizedList from './PrioritizedList.jsx'
import Backlog from './Backlog.jsx'

// One screen, two sections:
//  1. The user's sprint prioritization — a flat, numbered, drag-sortable list.
//     Epic appears as a tag on each row, not as a container.
//  2. The unprioritized backlog — grouped by Epic. Stories move up via
//     "Prioritize", back down via "Remove".
export default function PrioritizeView({
  epics, stories, scores, weights, ranks, onScore, onComment, disabled,
  lockedIds, currentSprint, onToggleLock, onReorder,
}) {
  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories])
  const prioritized = ranks.map((id) => byId.get(id)).filter(Boolean)
  const rankedSet = new Set(ranks)
  const backlog = stories.filter((s) => !rankedSet.has(s.id))

  const shared = { scores, weights, onScore, onComment, disabled, lockedIds, currentSprint, onToggleLock }

  return (
    <>
      <PrioritizedList
        {...shared}
        stories={prioritized}
        onReorder={onReorder}
        onRemove={(id) => onReorder(ranks.filter((r) => r !== id))}
      />
      <Backlog
        {...shared}
        epics={epics}
        stories={backlog}
        onAdd={(id) => onReorder([...ranks, id])}
      />
    </>
  )
}
