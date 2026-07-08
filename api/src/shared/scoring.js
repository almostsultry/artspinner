// Server-side twin of app/src/scoring.js — keep the two in sync.
// Exec dimensions are scored per executive; shared dimensions are analyzed
// facts set once per story by the facilitator (admin).
const EXEC_DIMENSIONS = [
  { key: 'businessValue', weight: 0.35, noteKey: 'businessValueNote' },
  { key: 'strategicFit', weight: 0.2, noteKey: 'strategicFitNote' },
]
const SHARED_DIMENSIONS = [
  { key: 'feasibility', weight: 0.25, noteKey: 'feasibilityNote' },
  { key: 'readiness', weight: 0.2, noteKey: 'readinessNote' },
]

const WEIGHTS = Object.fromEntries(
  [...EXEC_DIMENSIONS, ...SHARED_DIMENSIONS].map((d) => [d.key, d.weight]),
)

const inRange = (v) => v >= 1 && v <= 5

function priorityScore(score, facts, weights = WEIGHTS) {
  if (!score || !EXEC_DIMENSIONS.every((d) => inRange(score[d.key]))) return null
  if (!facts || !SHARED_DIMENSIONS.every((d) => inRange(facts[d.key]))) return null
  const w = (d) => weights[d.key] ?? d.weight
  const total =
    EXEC_DIMENSIONS.reduce((sum, d) => sum + score[d.key] * w(d), 0) +
    SHARED_DIMENSIONS.reduce((sum, d) => sum + facts[d.key] * w(d), 0)
  return Math.round(total * 100) / 100
}

module.exports = { EXEC_DIMENSIONS, SHARED_DIMENSIONS, WEIGHTS, priorityScore }
