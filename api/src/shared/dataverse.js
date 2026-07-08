// Dataverse persistence layer (DATA_MODE=live). Server-to-server auth with
// the app registration; tables are created by setup/dataverse-init.mjs
// (publisher prefix etc_, option value prefix 12345).
const DV = () => process.env.DV_URL
const API = () => `${DV()}/api/data/v9.2`

const OPT = { draft: 123450000, submitted: 123450001, open: 123450000, closed: 123450001 }

let cachedToken = null
async function token() {
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.value
  const res = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.DV_CLIENT_ID,
      client_secret: process.env.DV_CLIENT_SECRET,
      scope: `${DV()}/.default`,
    }),
  })
  if (!res.ok) throw new Error(`Dataverse token ${res.status}: ${await res.text()}`)
  const data = await res.json()
  cachedToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

async function dv(method, path, body) {
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Dataverse ${res.status} ${method} ${path}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function currentRound() {
  const r = await dv('GET', `/etc_rounds?$filter=etc_status eq ${OPT.open}&$orderby=createdon desc&$top=1`)
  return r.value[0] || null
}

async function saveScore(roundId, user, workItemId, values) {
  const existing = await dv('GET',
    `/etc_scores?$filter=_etc_roundid_value eq ${roundId} and etc_userid eq '${user.id}' and etc_workitemid eq ${workItemId}&$top=1`)
  // Priority score is computed at read time from exec inputs + shared facts,
  // so it's never stale when the facilitator updates Feasibility/Readiness.
  const record = {
    etc_businessvalue: values.businessValue ?? null,
    etc_strategicfit: values.strategicFit ?? null,
    etc_businessvaluenote: values.businessValueNote ?? null,
    etc_strategicfitnote: values.strategicFitNote ?? null,
  }
  if (existing.value.length) {
    await dv('PATCH', `/etc_scores(${existing.value[0].etc_scoreid})`, record)
  } else {
    await dv('POST', '/etc_scores', {
      ...record,
      etc_name: `${workItemId} · ${user.name}`,
      etc_workitemid: workItemId,
      etc_userid: user.id,
      etc_username: user.name,
      etc_status: OPT.draft,
      'etc_RoundId@odata.bind': `/etc_rounds(${roundId})`,
    })
  }
}

async function saveRanks(roundId, user, order) {
  const existing = await dv('GET',
    `/etc_manualranks?$filter=_etc_roundid_value eq ${roundId} and etc_userid eq '${user.id}'`)
  for (const row of existing.value) await dv('DELETE', `/etc_manualranks(${row.etc_manualrankid})`)
  for (let i = 0; i < order.length; i++) {
    await dv('POST', '/etc_manualranks', {
      etc_name: `${order[i]} · ${user.name}`,
      etc_workitemid: order[i],
      etc_rank: i + 1,
      etc_userid: user.id,
      etc_username: user.name,
      'etc_RoundId@odata.bind': `/etc_rounds(${roundId})`,
    })
  }
}

async function markSubmitted(roundId, user) {
  const submittedAt = new Date().toISOString()
  const rows = await dv('GET',
    `/etc_scores?$filter=_etc_roundid_value eq ${roundId} and etc_userid eq '${user.id}'`)
  for (const row of rows.value) {
    await dv('PATCH', `/etc_scores(${row.etc_scoreid})`, { etc_status: OPT.submitted, etc_submittedon: submittedAt })
  }
  return { submittedAt }
}

// Shared per-story facts (Feasibility/Readiness + rationale), admin-set.
async function getFacts(roundId) {
  const rows = await dv('GET', `/etc_storyfacts?$filter=_etc_roundid_value eq ${roundId}`)
  const map = {}
  for (const f of rows.value) {
    map[f.etc_workitemid] = {
      feasibility: f.etc_feasibility, readiness: f.etc_readiness,
      feasibilityNote: f.etc_feasibilitynote, readinessNote: f.etc_readinessnote,
    }
  }
  return map
}

async function saveFacts(roundId, user, workItemId, patch) {
  const record = {}
  if ('feasibility' in patch) record.etc_feasibility = patch.feasibility
  if ('readiness' in patch) record.etc_readiness = patch.readiness
  if ('feasibilityNote' in patch) record.etc_feasibilitynote = patch.feasibilityNote
  if ('readinessNote' in patch) record.etc_readinessnote = patch.readinessNote
  const existing = await dv('GET',
    `/etc_storyfacts?$filter=_etc_roundid_value eq ${roundId} and etc_workitemid eq ${workItemId}&$top=1`)
  if (existing.value.length) {
    await dv('PATCH', `/etc_storyfacts(${existing.value[0].etc_storyfactid})`, record)
  } else {
    await dv('POST', '/etc_storyfacts', {
      ...record,
      etc_name: `${workItemId}`,
      etc_workitemid: workItemId,
      etc_userid: user.id,
      etc_username: user.name,
      'etc_RoundId@odata.bind': `/etc_rounds(${roundId})`,
    })
  }
  return { ok: true }
}

// All executives' score rationale notes for one work item.
async function getRationales(roundId, workItemId) {
  const rows = await dv('GET',
    `/etc_scores?$filter=_etc_roundid_value eq ${roundId} and etc_workitemid eq ${workItemId}`)
  const out = []
  for (const s of rows.value) {
    if (s.etc_businessvaluenote) {
      out.push({ workItemId, author: s.etc_username, dimension: 'businessValue', value: s.etc_businessvalue, note: s.etc_businessvaluenote })
    }
    if (s.etc_strategicfitnote) {
      out.push({ workItemId, author: s.etc_username, dimension: 'strategicFit', value: s.etc_strategicfit, note: s.etc_strategicfitnote })
    }
  }
  return out
}

async function getComments(workItemId) {
  const rows = await dv('GET',
    `/etc_comments?$filter=etc_workitemid eq ${workItemId}&$orderby=createdon asc`)
  return rows.value.map((c) => ({
    id: c.etc_commentid, workItemId, author: c.etc_username, postedAt: c.createdon, text: c.etc_text,
  }))
}

async function postComment(user, workItemId, text) {
  const c = await dv('POST', '/etc_comments', {
    etc_name: `${workItemId} · ${user.name}`,
    etc_workitemid: workItemId,
    etc_userid: user.id,
    etc_username: user.name,
    etc_text: text,
  })
  return { id: c.etc_commentid, workItemId, author: user.name, postedAt: c.createdon, text }
}

module.exports = {
  currentRound, saveScore, saveRanks, markSubmitted, getComments, postComment,
  getFacts, saveFacts, getRationales, OPT, dv,
}
