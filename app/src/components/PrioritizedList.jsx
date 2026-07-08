import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import StoryRow from './StoryRow.jsx'

function SortableRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.story.id, disabled: props.disabled })
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'dragging' : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <StoryRow {...props} gripProps={{ ...attributes, ...listeners, disabled: props.disabled }} />
    </div>
  )
}

export default function PrioritizedList({
  stories, scores, facts, weights, onScore, onComment, onReorder, onRemove, disabled,
  lockedIds, currentSprint, onToggleLock,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const ids = stories.map((s) => s.id)
    onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  return (
    <section style={{ marginBottom: 26 }}>
      <h2 className="section-title">Sprint prioritization <span className="count-chip">{stories.length}</span></h2>
      <p className="view-note">
        Your numbered priority order for future sprints — drag the ⠿ grip to reorder.
        This order outranks the priority-score sort and persists with your submission.
      </p>
      {stories.length === 0 ? (
        <div className="empty-list">
          Nothing prioritized yet — score stories in the backlog below, then click <b>Prioritize</b> to build your numbered list.
        </div>
      ) : (
        <div className="rank-list">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {stories.map((story, i) => (
                <SortableRow
                  key={story.id} story={story} score={scores[story.id]} facts={facts[story.id]} weights={weights}
                  rank={i} showEpic onScore={onScore} onComment={onComment}
                  disabled={disabled} locked={lockedIds.has(story.id)}
                  currentSprint={currentSprint} onToggleLock={onToggleLock}
                  onRemove={onRemove}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </section>
  )
}
