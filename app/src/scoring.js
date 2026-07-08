// Scoring is split by who owns the knowledge:
//  - EXEC_DIMENSIONS: judgment calls, scored 1-5 by each executive.
//  - SHARED_DIMENSIONS: analyzed facts, set once per story by the facilitator
//    in the Admin tab after business analysis / consultative review.
// The weighted formula is unchanged: BV 35% + FE 25% + RD 20% + SF 20%.
export const EXEC_DIMENSIONS = [
  {
    key: 'businessValue', label: 'Business Value', short: 'BV', defaultWeight: 0.35,
    noteKey: 'businessValueNote',
    criteria: 'Revenue, margin, speed, risk reduction, customer impact',
  },
  {
    key: 'strategicFit', label: 'Strategic Fit', short: 'SF', defaultWeight: 0.2,
    noteKey: 'strategicFitNote',
    criteria: 'How well it supports ERP/CRM modernization and long-term AI platform goals',
  },
]

export const SHARED_DIMENSIONS = [
  {
    key: 'feasibility', label: 'Feasibility', short: 'FE', defaultWeight: 0.25,
    noteKey: 'feasibilityNote',
    criteria: 'Data availability, technical complexity, integration effort — set by the facilitator after analysis',
  },
  {
    key: 'readiness', label: 'Readiness', short: 'RD', defaultWeight: 0.2,
    noteKey: 'readinessNote',
    criteria: 'Organizational maturity, process clarity, sponsorship, roadmap alignment — set after consultative review with the requester and executives',
  },
]

// Suggested feasibility from t-shirt size — a starting point for the
// facilitator, never a substitute for their judgment.
export const SIZE_TO_FEASIBILITY = { XS: 5, S: 5, M: 4, L: 2, XL: 1 }

const inRange = (v) => v >= 1 && v <= 5

// True once the executive has supplied both of their inputs.
export function isExecScored(score) {
  return !!score && EXEC_DIMENSIONS.every((d) => inRange(score[d.key]))
}

// True once the facilitator has supplied both shared values.
export function hasFacts(facts) {
  return !!facts && SHARED_DIMENSIONS.every((d) => inRange(facts[d.key]))
}

// Weighted priority score; null until exec inputs AND shared facts exist.
export function priorityScore(score, facts, weights) {
  if (!isExecScored(score) || !hasFacts(facts)) return null
  const w = (d) => weights?.[d.key] ?? d.defaultWeight
  const total =
    EXEC_DIMENSIONS.reduce((sum, d) => sum + score[d.key] * w(d), 0) +
    SHARED_DIMENSIONS.reduce((sum, d) => sum + facts[d.key] * w(d), 0)
  return Math.round(total * 100) / 100
}

// Sort order: manually ranked items first (by rank), then priority score
// descending, then id for stability.
export function storyComparator(scores, factsMap, weights, rankIndex) {
  return (a, b) => {
    const ra = rankIndex.get(a.id)
    const rb = rankIndex.get(b.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    const sa = priorityScore(scores[a.id], factsMap[a.id], weights) ?? -1
    const sb = priorityScore(scores[b.id], factsMap[b.id], weights) ?? -1
    if (sb !== sa) return sb - sa
    return a.id - b.id
  }
}
