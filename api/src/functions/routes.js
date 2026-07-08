// All HTTP routes. DATA_MODE=mock (default) serves the bundled demo data;
// DATA_MODE=live reads Azure DevOps and persists to Dataverse.
const { app } = require('@azure/functions')
const { getUser } = require('../shared/user')
const { priorityScore } = require('../shared/scoring')
const mockStore = require('../shared/mockStore')

const live = () => (process.env.DATA_MODE || 'mock') === 'live'

// The live store composes ado.js + dataverse.js behind the same interface as
// mockStore. Bootstrap/dashboard aggregation for live mode lands in Phase 2 —
// endpoints below fail loudly rather than returning half-real data.
function liveStore() {
  const ado = require('../shared/ado')
  const dv = require('../shared/dataverse')
  return {
    async bootstrap(user) {
      const [{ epics, stories }, round] = await Promise.all([ado.getWorkItems(), dv.currentRound()])
      if (!round) throw new Error('No open etc_round in Dataverse — create one or run seed-config.')
      const roundId = round.etc_roundid
      const [scores, ranks] = await Promise.all([
        dv.dv('GET', `/etc_scores?$filter=_etc_roundid_value eq ${roundId} and etc_userid eq '${user.id}'`),
        dv.dv('GET', `/etc_manualranks?$filter=_etc_roundid_value eq ${roundId} and etc_userid eq '${user.id}'&$orderby=etc_rank asc`),
      ])
      const myScores = {}
      let submission = null
      for (const s of scores.value) {
        myScores[s.etc_workitemid] = {
          businessValue: s.etc_businessvalue, feasibility: s.etc_feasibility,
          readiness: s.etc_readiness, strategicFit: s.etc_strategicfit,
        }
        if (s.etc_submittedon) submission = { submittedAt: s.etc_submittedon }
      }
      return {
        user,
        round: {
          id: roundId, name: round.etc_name, targetSprint: round.etc_targetsprint,
          currentSprint: round.etc_currentsprint, status: 'Open',
          opensOn: round.etc_openson, closesOn: round.etc_closeson,
        },
        weights: require('../shared/scoring').WEIGHTS,
        epics, stories,
        myScores,
        myRanks: ranks.value.map((r) => r.etc_workitemid),
        submission,
        unlocks: [],
        dataSource: 'live',
      }
    },
    async saveScore(user, workItemId, values) {
      const round = await dv.currentRound()
      await dv.saveScore(round.etc_roundid, user, workItemId, values, priorityScore(values))
      return { ok: true, priorityScore: priorityScore(values) }
    },
    async saveRanks(user, order) {
      const round = await dv.currentRound()
      await dv.saveRanks(round.etc_roundid, user, order)
      return { ok: true }
    },
    async submit(user) {
      const round = await dv.currentRound()
      const submission = await dv.markSubmitted(round.etc_roundid, user)
      return { ok: true, submission }
    },
    getComments: (_user, id) => dv.getComments(id),
    postComment: (user, id, text) => dv.postComment(user, id, text),
    async setLock() { throw new Error('Lock overrides in live mode land with Phase 2 (stored on etc_round).') },
    async roundAction() { throw new Error('Round open/close in live mode lands with Phase 2.') },
    async dashboard() { throw new Error('Live dashboard aggregation lands with Phase 2.') },
  }
}

const store = () => (live() ? liveStore() : mockStore)

function json(handler) {
  return async (request, context) => {
    try {
      return { jsonBody: await handler(request, context) }
    } catch (err) {
      context.error(err)
      return { status: 500, jsonBody: { error: err.message } }
    }
  }
}

app.http('bootstrap', {
  methods: ['GET'], authLevel: 'anonymous', route: 'bootstrap',
  handler: json((req) => store().bootstrap(getUser(req))),
})

app.http('saveScore', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'scores/{workItemId:int}',
  handler: json(async (req) =>
    store().saveScore(getUser(req), Number(req.params.workItemId), await req.json())),
})

app.http('saveRanks', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'ranks',
  handler: json(async (req) => {
    const { order } = await req.json()
    return store().saveRanks(getUser(req), order)
  }),
})

app.http('submit', {
  methods: ['POST'], authLevel: 'anonymous', route: 'submit',
  handler: json((req) => store().submit(getUser(req))),
})

app.http('comments', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'comments/{workItemId:int}',
  handler: json(async (req) => {
    const id = Number(req.params.workItemId)
    if (req.method === 'GET') return store().getComments(getUser(req), id)
    const { text } = await req.json()
    return store().postComment(getUser(req), id, text)
  }),
})

app.http('locks', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'locks/{workItemId:int}',
  handler: json(async (req) => {
    const user = getUser(req)
    if (!user.isAdmin) return { error: 'Admin only' }
    const { unlocked } = await req.json()
    return store().setLock(user, Number(req.params.workItemId), unlocked)
  }),
})

app.http('round', {
  methods: ['POST'], authLevel: 'anonymous', route: 'round',
  handler: json(async (req) => {
    const user = getUser(req)
    if (!user.isAdmin) return { error: 'Admin only' }
    const { action } = await req.json()
    return store().roundAction(user, action)
  }),
})

app.http('dashboard', {
  methods: ['GET'], authLevel: 'anonymous', route: 'dashboard',
  handler: json(() => store().dashboard()),
})

app.http('assistant', {
  methods: ['POST'], authLevel: 'anonymous', route: 'assistant',
  handler: json(async (req) => {
    const { question } = await req.json()
    const data = await store().dashboard()
    return { reply: await require('../shared/assistant').ask(question, data) }
  }),
})
