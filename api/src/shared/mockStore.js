// Mock data source for the Functions API (DATA_MODE=mock). State lives in
// process memory — it resets on cold start, which is fine for demo/review.
// The live implementation persists to Dataverse instead.
const fs = require('fs')
const path = require('path')
const { EXEC_DIMENSIONS, WEIGHTS, priorityScore } = require('./scoring')

function readSeed(name) {
  // Repo layout in dev; pipeline copies mock-data/ into api/ for deployment.
  for (const p of [path.join(__dirname, '../../mock-data', name), path.join(__dirname, '../../../mock-data', name)]) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  }
  throw new Error(`mock seed not found: ${name}`)
}

const seed = readSeed('workitems.json')
const delivery = readSeed('delivery.json')

const PEERS = ['Dana Whitfield', 'Marcus Lee']
const NOT_SUBMITTED = ['Priya Nair', 'Tom Ovesen']

// Per-user state, keyed by user id.
const users = new Map()
const factEdits = {}
let roundStatus = seed.round.status
let unlocks = new Set()
let nextCommentId = 100
const postedComments = []

function userState(userId) {
  if (!users.has(userId)) users.set(userId, { scores: {}, ranks: [], submission: null })
  return users.get(userId)
}

// Facilitator-analyzed shared values: seed data overlaid with admin edits.
function factsMap() {
  const merged = {}
  for (const s of seed.stories) {
    merged[s.id] = { ...(seed.storyFacts?.[s.id] || {}), ...(factEdits[s.id] || {}) }
  }
  return merged
}

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

module.exports = {
  async bootstrap(user) {
    const state = userState(user.id)
    return {
      user,
      round: { ...seed.round, status: roundStatus },
      weights: WEIGHTS,
      epics: seed.epics,
      stories: seed.stories,
      facts: factsMap(),
      myScores: state.scores,
      myRanks: state.ranks,
      submission: state.submission,
      unlocks: [...unlocks],
      dataSource: 'mock',
    }
  },

  async saveScore(user, workItemId, values) {
    userState(user.id).scores[workItemId] = values
    return { ok: true }
  },

  async saveFacts(_user, workItemId, patch) {
    factEdits[workItemId] = { ...factEdits[workItemId], ...patch }
    return { ok: true, facts: factsMap()[workItemId] }
  },

  async getRationales(user, workItemId) {
    const peer = (seed.rationales || []).filter((r) => r.workItemId === workItemId)
    const mine = []
    const myScore = userState(user.id).scores[workItemId] || {}
    for (const d of EXEC_DIMENSIONS) {
      if (myScore[d.noteKey]) {
        mine.push({ workItemId, author: user.name, dimension: d.key, value: myScore[d.key] ?? null, note: myScore[d.noteKey] })
      }
    }
    return [...peer, ...mine]
  },

  async saveRanks(user, order) {
    userState(user.id).ranks = order
    return { ok: true }
  },

  async submit(user) {
    const state = userState(user.id)
    state.submission = { submittedAt: new Date().toISOString() }
    return { ok: true, submission: state.submission }
  },

  async getComments(_user, workItemId) {
    return [...seed.comments, ...postedComments]
      .filter((c) => c.workItemId === workItemId)
      .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
  },

  async postComment(user, workItemId, text) {
    const comment = { id: nextCommentId++, workItemId, author: user.name, postedAt: new Date().toISOString(), text }
    postedComments.push(comment)
    return comment
  },

  async setLock(_user, workItemId, unlocked) {
    if (unlocked) unlocks.add(workItemId)
    else unlocks.delete(workItemId)
    return { ok: true, unlocks: [...unlocks] }
  },

  async roundAction(_user, action) {
    roundStatus = action === 'close' ? 'Closed' : 'Open'
    return { ok: true, status: roundStatus }
  },

  async dashboard() {
    const facts = factsMap()
    const carryoverIds = new Map((seed.carryover || []).map((c) => [c.workItemId, c.fromSprint]))
    const sheets = PEERS.map((_, i) => peerScoresheet(i))
    for (const state of users.values()) if (state.submission) sheets.push(state.scores)
    const submittedUsers = [...users.values()].filter((s) => s.submission).length

    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    const round2 = (v) => (v === null ? null : Math.round(v * 100) / 100)

    const stats = seed.stories
      .map((story) => {
        const entries = sheets.map((sheet) => sheet[story.id]).filter(Boolean)
        const ps = entries.map((e) => priorityScore(e, facts[story.id])).filter((v) => v !== null)
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
      .filter((s) => s.score !== null)

    // Carryover items keep their position ahead of newly prioritized work.
    const ranked = [...stats].sort((a, b) => {
      const ca = carryoverIds.has(a.id) ? 0 : 1
      const cb = carryoverIds.has(b.id) ? 0 : 1
      return ca !== cb ? ca - cb : b.score - a.score
    })

    const prevRanks = seed.previousRanks || {}
    const lines = [...new Set(seed.epics.map((e) => e.businessLine))]
    return {
      round: { ...seed.round, status: roundStatus },
      top10: ranked.slice(0, 10).map((s, i) => ({
        rank: i + 1, id: s.id, title: s.title, businessLine: s.businessLine,
        tshirtSize: s.tshirtSize, score: s.score, overridden: false,
        carryoverFrom: carryoverIds.get(s.id) || null,
      })),
      epicsByBusinessLine: lines.map((line) => ({
        businessLine: line,
        epics: seed.epics.filter((e) => e.businessLine === line).length,
        stories: seed.stories.filter((s) => s.businessLine === line).length,
      })),
      velocity: delivery.velocity,
      sprints: delivery.sprints,
      divergence: [...stats]
        .filter((s) => s.spread !== null)
        .sort((a, b) => b.spread - a.spread)
        .slice(0, 5)
        .map(({ id, title, min, max, spread }) => ({ id, title, min, max, spread })),
      quadrant: stats
        .filter((s) => s.bv !== null && s.fe !== null)
        .map(({ id, title, bv, fe, tshirtSize }) => ({ id, title, bv, fe, tshirtSize })),
      movers: ranked
        .map((s, i) => ({ id: s.id, title: s.title, from: prevRanks[s.id] ?? null, to: i + 1 }))
        .filter((m) => m.from !== null && m.from !== m.to)
        .map((m) => ({ ...m, delta: m.from - m.to }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 6),
      awaitingAnalysis: seed.stories.length - Object.values(facts)
        .filter((f) => f.feasibility >= 1 && f.readiness >= 1).length,
      participation: {
        submitted: PEERS.length + submittedUsers,
        total: PEERS.length + NOT_SUBMITTED.length + 1,
        submittedNames: PEERS,
        waitingOn: NOT_SUBMITTED,
      },
    }
  },
}
