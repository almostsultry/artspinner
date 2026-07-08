export const DIMENSIONS = [
  {
    key: 'businessValue', label: 'Business Value', short: 'BV', defaultWeight: 0.35,
    criteria: 'Revenue, margin, speed, risk reduction, customer impact',
  },
  {
    key: 'feasibility', label: 'Feasibility', short: 'FE', defaultWeight: 0.25,
    criteria: 'Data availability, technical complexity, integration effort',
  },
  {
    key: 'readiness', label: 'Readiness', short: 'RD', defaultWeight: 0.2,
    criteria: 'Organizational maturity, process clarity, sponsorship, alignment to in-flight roadmap',
  },
  {
    key: 'strategicFit', label: 'Strategic Fit', short: 'SF', defaultWeight: 0.2,
    criteria: 'How well it supports ERP/CRM modernization and long-term AI platform goals',
  },
]

export function isFullyScored(score) {
  return !!score && DIMENSIONS.every((d) => score[d.key] >= 1 && score[d.key] <= 5)
}

// Returns the weighted priority score, or null until all four dimensions are set.
export function priorityScore(score, weights) {
  if (!isFullyScored(score)) return null
  const total = DIMENSIONS.reduce((sum, d) => {
    const w = weights?.[d.key] ?? d.defaultWeight
    return sum + score[d.key] * w
  }, 0)
  return Math.round(total * 100) / 100
}

// Sort order for story lists: manually ranked items first (by rank),
// then everything else by priority score descending, then by id for stability.
export function storyComparator(scores, weights, rankIndex) {
  return (a, b) => {
    const ra = rankIndex.get(a.id)
    const rb = rankIndex.get(b.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    const sa = priorityScore(scores[a.id], weights) ?? -1
    const sb = priorityScore(scores[b.id], weights) ?? -1
    if (sb !== sa) return sb - sa
    return a.id - b.id
  }
}
