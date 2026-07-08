// In-browser mock backend. Mirrors the Functions API contract exactly and
// persists the demo user's work in localStorage. Two simulated peers have
// already submitted scoresheets so aggregation views have data.
import seed from '../../../mock-data/workitems.json'
import delivery from '../../../mock-data/delivery.json'
import {
  EXEC_DIMENSIONS, SHARED_DIMENSIONS, priorityScore,
} from '../scoring.js'

const KEY = `etc-prio:${seed.round.id}:v2`
const USER = { id: 'demo-user', name: 'Demo Executive', isAdmin: true }
const WEIGHTS = Object.fromEntries(
  [...EXEC_DIMENSIONS, ...SHARED_DIMENSIONS].map((d) => [d.key, d.defaultWeight]),
)
const PEERS = ['Dana Whitfield', 'Marcus Lee']
const NOT_SUBMITTED = ['Priya Nair', 'Tom Ovesen']

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to fresh state */ }
  return {
    scores: {}, ranks: [], submission: null, comments: {}, factEdits: {},
    roundStatus: seed.round.status, unlocks: [], nextCommentId: 100,
  }
}
function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

// Facilitator-analyzed shared values: seed data overlaid with admin edits.
function factsMap(state) {
  const merged = {}
  for (const s of seed.stories) {
    merged[s.id] = { ...(seed.storyFacts?.[s.id] || {}), ...(state.factEdits[s.id] || {}) }
  }
  return merged
}

// Deterministic pseudo-random 1–5 so peer scoresheets are stable across loads.
function peerValue(peerIdx, storyId, dimIdx) {
  let h = storyId * 73856093 + (peerIdx + 1) * 19349663 + (dimIdx + 1) * 83492791
  h = (h ^ (h >> 13)) * 1274126177
  return (Math.abs(h) % 5) + 1
}
function peerScoresheet(peerIdx) {
  const sheet = {}
  for (const s of seed.stories) {
    sheet[s.id] = Object.fromEntries(EXEC_DIMENSIONS.map((d, i) => [d.key, peerValue(peerIdx, s.id, i)]))
  }
  return sheet
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const round2 = (v) => (v === null ? null : Math.round(v * 100) / 100)

// Per-story stats across all submitted scoresheets: mean priority score,
// score spread (divergence), and mean/shared dimension values.
function storyStats(state) {
  const facts = factsMap(state)
  const sheets = PEERS.map((_, i) => peerScoresheet(i))
  if (state.submission) sheets.push(state.scores)
  return seed.stories.map((story) => {
    const entries = sheets.map((sheet) => sheet[story.id]).filter(Boolean)
    const ps = entries.map((e) => priorityScore(e, facts[story.id], WEIGHTS)).filter((v) => v !== null)
    return {
      ...story,
      score: round2(mean(ps)),
      min: ps.length ? Math.min(...ps) : null,
      max: ps.length ? Math.max(...ps) : null,
      spread: ps.length ? round2(Math.max(...ps) - Math.min(...ps)) : null,
      bv: round2(mean(entries.map((e) => e.businessValue).filter(Boolean))),
      fe: facts[story.id]?.feasibility ?? null,
    }
  })
}

function dashboard(state) {
  const round = { ...seed.round, status: state.roundStatus }
  // Round-transition rule: items carried over from the previous sprint keep
  // their priority position ahead of newly prioritized backlog.
  const carryoverIds = new Map((seed.carryover || []).map((c) => [c.workItemId, c.fromSprint]))
  const stats = storyStats(state).filter((s) => s.score !== null)
  const ranked = [...stats].sort((a, b) => {
    const ca = carryoverIds.has(a.id) ? 0 : 1
    const cb = carryoverIds.has(b.id) ? 0 : 1
    return ca !== cb ? ca - cb : b.score - a.score
  })
  const top10 = ranked.slice(0, 10).map((s, i) => ({
    rank: i + 1, id: s.id, title: s.title,
    businessLine: s.businessLine, tshirtSize: s.tshirtSize, score: s.score,
    overridden: false, carryoverFrom: carryoverIds.get(s.id) || null,
  }))
  const lines = [...new Set(seed.epics.map((e) => e.businessLine))]
  const epicsByBusinessLine = lines.map((line) => ({
    businessLine: line,
    epics: seed.epics.filter((e) => e.businessLine === line).length,
    stories: seed.stories.filter((s) => s.businessLine === line).length,
  }))

  const divergence = [...stats]
    .filter((s) => s.spread !== null)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 5)
    .map(({ id, title, min, max, spread }) => ({ id, title, min, max, spread }))

  const quadrant = stats
    .filter((s) => s.bv !== null && s.fe !== null)
    .map(({ id, title, bv, fe, tshirtSize }) => ({ id, title, bv, fe, tshirtSize }))

  const prevRanks = seed.previousRanks || {}
  const movers = ranked
    .map((s, i) => ({ id: s.id, title: s.title, from: prevRanks[s.id] ?? null, to: i + 1 }))
    .filter((m) => m.from !== null && m.from !== m.to)
    .map((m) => ({ ...m, delta: m.from - m.to }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6)

  return {
    round, top10, epicsByBusinessLine,
    velocity: delivery.velocity,
    sprints: delivery.sprints,
    divergence, quadrant, movers,
    awaitingAnalysis: seed.stories.length - Object.values(factsMap(state))
      .filter((f) => f.feasibility >= 1 && f.readiness >= 1).length,
    participation: {
      submitted: PEERS.length + (state.submission ? 1 : 0),
      total: PEERS.length + NOT_SUBMITTED.length + 1,
      submittedNames: state.submission ? [...PEERS, USER.name] : PEERS,
      waitingOn: state.submission ? NOT_SUBMITTED : [...NOT_SUBMITTED, USER.name],
    },
  }
}

// Data-aware assistant for the Copilot sidecar. Mock mode answers from the
// app's own aggregates with simple intent matching; live mode swaps this for
// an LLM (Azure OpenAI / Copilot Studio) — see api/src/shared/assistant.js.
function assistantAnswer(question, state) {
  const q = (question || '').toLowerCase()
  const d = dashboard(state)
  const fmt = (rows) => rows.map((r) => `${r.rank}. ${r.title} (${r.businessLine}, ${r.tshirtSize}) — ${r.score.toFixed(2)}`).join('\n')

  if (/(disagree|diverg|consensus|conflict)/.test(q)) {
    const top = d.divergence.map((s) => `• ${s.title}: scores range ${s.min.toFixed(2)}–${s.max.toFixed(2)} (spread ${s.spread.toFixed(2)})`).join('\n')
    return `Leadership disagrees most on:\n${top}\n\nSince Feasibility and Readiness are shared values, the spread is pure value/fit disagreement — good candidates for the discussion threads.`
  }
  if (/(velocity|cadence|sprint history|committed|completed)/.test(q)) {
    const last = d.velocity[d.velocity.length - 1]
    const avg = d.velocity.reduce((a, v) => a + v.completed, 0) / d.velocity.length
    return `Average completed velocity over the last ${d.velocity.length} sprints is ${avg.toFixed(1)} points. Most recent (${last.sprint}): ${last.completed} of ${last.committed} committed points completed.`
  }
  if (/(who|submit|particip|waiting)/.test(q)) {
    const p = d.participation
    return `${p.submitted} of ${p.total} scoresheets are in (${p.submittedNames.join(', ')}). Still waiting on: ${p.waitingOn.join(', ') || 'no one'}.`
  }
  if (/(analy[sz]|awaiting|feasibility|readiness|facts)/.test(q)) {
    return d.awaitingAnalysis
      ? `${d.awaitingAnalysis} stories are still awaiting facilitator analysis (Feasibility/Readiness not yet set) — they can't produce a priority score until that's done.`
      : 'All stories have facilitator-set Feasibility and Readiness values.'
  }
  if (/(carryover|carried|remaining|unfinished)/.test(q)) {
    const c = d.top10.filter((r) => r.carryoverFrom)
    return c.length
      ? `Carryover items holding their position at the top of the list:\n${fmt(c)}`
      : 'No carryover items in the current round.'
  }
  if (/(mover|change|shift|since last)/.test(q)) {
    const m = d.movers.map((x) => `• ${x.title}: ${x.from} → ${x.to} (${x.delta > 0 ? '▲ up' : '▼ down'} ${Math.abs(x.delta)})`).join('\n')
    return `Biggest rank changes since the previous round:\n${m}`
  }
  if (/(epic|business line|distribution|portfolio)/.test(q)) {
    return 'Portfolio distribution:\n' + d.epicsByBusinessLine
      .map((l) => `• ${l.businessLine}: ${l.epics} epics, ${l.stories} stories`).join('\n')
  }
  if (/(top|priorit|rank|list)/.test(q)) {
    return `Current top priorities (aggregate of submitted scoresheets):\n${fmt(d.top10.slice(0, 5))}`
  }
  return 'I can analyze this round\'s data — try asking about: top priorities, where leadership disagrees, movers since last round, carryover items, stories awaiting analysis, velocity, portfolio distribution, or who still needs to submit.'
}

export function handle(path, { method = 'GET', body } = {}) {
  const state = load()
  const parts = path.replace(/^\//, '').split('/')

  if (parts[0] === 'bootstrap') {
    return {
      user: USER,
      round: { ...seed.round, status: state.roundStatus },
      weights: WEIGHTS,
      epics: seed.epics,
      stories: seed.stories,
      facts: factsMap(state),
      myScores: state.scores,
      myRanks: state.ranks,
      submission: state.submission,
      unlocks: state.unlocks || [],
      dataSource: 'mock',
    }
  }

  if (parts[0] === 'scores' && method === 'PUT') {
    const id = Number(parts[1])
    state.scores[id] = body
    save(state)
    return { ok: true }
  }

  if (parts[0] === 'facts' && method === 'PUT') {
    const id = Number(parts[1])
    state.factEdits[id] = { ...state.factEdits[id], ...body }
    save(state)
    return { ok: true, facts: factsMap(state)[id] }
  }

  if (parts[0] === 'rationales' && method === 'GET') {
    const id = Number(parts[1])
    const peer = (seed.rationales || []).filter((r) => r.workItemId === id)
    const mine = []
    const myScore = state.scores[id] || {}
    for (const d of EXEC_DIMENSIONS) {
      if (myScore[d.noteKey]) {
        mine.push({ workItemId: id, author: USER.name, dimension: d.key, value: myScore[d.key] ?? null, note: myScore[d.noteKey] })
      }
    }
    return [...peer, ...mine]
  }

  if (parts[0] === 'ranks' && method === 'PUT') {
    state.ranks = body.order
    save(state)
    return { ok: true }
  }

  if (parts[0] === 'submit' && method === 'POST') {
    state.submission = { submittedAt: new Date().toISOString() }
    save(state)
    return { ok: true, submission: state.submission }
  }

  if (parts[0] === 'comments') {
    const id = Number(parts[1])
    const seeded = seed.comments.filter((c) => c.workItemId === id)
    const mine = state.comments[id] || []
    if (method === 'GET') {
      return [...seeded, ...mine].sort((a, b) => a.postedAt.localeCompare(b.postedAt))
    }
    if (method === 'POST') {
      const comment = {
        id: state.nextCommentId++, workItemId: id, author: USER.name,
        postedAt: new Date().toISOString(), text: body.text,
      }
      state.comments[id] = [...mine, comment]
      save(state)
      return comment
    }
  }

  if (parts[0] === 'locks' && method === 'PUT') {
    const id = Number(parts[1])
    const unlocks = new Set(state.unlocks || [])
    if (body.unlocked) unlocks.add(id)
    else unlocks.delete(id)
    state.unlocks = [...unlocks]
    save(state)
    return { ok: true, unlocks: state.unlocks }
  }

  if (parts[0] === 'dashboard') return dashboard(state)

  if (parts[0] === 'assistant' && method === 'POST') {
    return { reply: assistantAnswer(body.question, state) }
  }

  if (parts[0] === 'round' && method === 'POST') {
    state.roundStatus = body.action === 'close' ? 'Closed' : 'Open'
    save(state)
    return { ok: true, status: state.roundStatus }
  }

  throw new Error(`Mock API: unhandled ${method} ${path}`)
}
