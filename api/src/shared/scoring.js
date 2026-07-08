// Server-side twin of app/src/scoring.js — keep the two in sync.
const DIMENSIONS = [
  { key: 'businessValue', weight: 0.35 },
  { key: 'feasibility', weight: 0.25 },
  { key: 'readiness', weight: 0.2 },
  { key: 'strategicFit', weight: 0.2 },
]

const WEIGHTS = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.weight]))

function priorityScore(score, weights = WEIGHTS) {
  if (!score || !DIMENSIONS.every((d) => score[d.key] >= 1 && score[d.key] <= 5)) return null
  const total = DIMENSIONS.reduce((sum, d) => sum + score[d.key] * (weights[d.key] ?? d.weight), 0)
  return Math.round(total * 100) / 100
}

module.exports = { DIMENSIONS, WEIGHTS, priorityScore }
