// Azure DevOps read layer (DATA_MODE=live). Reads epics, user stories, and
// delivery metrics. Requires ADO_ORG_URL, ADO_PROJECT, and ADO_PAT (or swap
// authHeader() for a service-principal token) in app settings.
const ORG = () => process.env.ADO_ORG_URL
const PROJECT = () => process.env.ADO_PROJECT
const F_LINE = () => process.env.ADO_FIELD_BUSINESS_LINE || 'Custom.BusinessLine'
const F_SIZE = () => process.env.ADO_FIELD_TSHIRT_SIZE || 'Custom.TShirtSize'
const STATES = () => (process.env.ADO_IN_SCOPE_STATES || 'Open,Discovery,Ready for Development')
  .split(',').map((s) => s.trim())

function authHeader() {
  return 'Basic ' + Buffer.from(':' + process.env.ADO_PAT).toString('base64')
}

async function adoFetch(url, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`ADO ${res.status}: ${await res.text()}`)
  return res.json()
}

// Epics + user stories (in scope states) with their epic parentage resolved
// through the Feature level where present.
async function getWorkItems() {
  const states = STATES().map((s) => `'${s}'`).join(',')
  const wiql = {
    query: `
      SELECT [System.Id] FROM WorkItemLinks
      WHERE (Source.[System.TeamProject] = '${PROJECT()}' AND Source.[System.WorkItemType] = 'Epic')
        AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward')
        AND (Target.[System.WorkItemType] IN ('Feature', 'User Story'))
      MODE (Recursive)`,
  }
  const tree = await adoFetch(`${ORG()}/${PROJECT()}/_apis/wit/wiql?api-version=7.1`, wiql)

  const ids = [...new Set(tree.workItemRelations.flatMap((r) => [r.source?.id, r.target?.id]).filter(Boolean))]
  const fields = [
    'System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.Description',
    'System.IterationPath', 'System.Parent', F_LINE(), F_SIZE(),
  ]
  const items = []
  for (let i = 0; i < ids.length; i += 200) {
    const batch = await adoFetch(`${ORG()}/_apis/wit/workitemsbatch?api-version=7.1`, {
      ids: ids.slice(i, i + 200), fields,
    })
    items.push(...batch.value)
  }

  const byId = new Map(items.map((w) => [w.id, w]))
  const epics = items.filter((w) => w.fields['System.WorkItemType'] === 'Epic')
  const stateSet = new Set(STATES())

  function epicOf(item) {
    let cur = item
    while (cur && cur.fields['System.WorkItemType'] !== 'Epic') {
      cur = byId.get(cur.fields['System.Parent'])
    }
    return cur
  }

  const stories = items
    .filter((w) => w.fields['System.WorkItemType'] === 'User Story' && stateSet.has(w.fields['System.State']))
    .map((w) => {
      const epic = epicOf(w)
      const iteration = w.fields['System.IterationPath'] || ''
      return {
        id: w.id,
        epicId: epic?.id ?? null,
        title: w.fields['System.Title'],
        summary: (w.fields['System.Description'] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
        businessLine: w.fields[F_LINE()] || epic?.fields[F_LINE()] || 'Unassigned',
        tshirtSize: w.fields[F_SIZE()] || '—',
        state: w.fields['System.State'],
        sprint: iteration.split('\\').pop() || null,
      }
    })

  return {
    epics: epics.map((e) => ({
      id: e.id, title: e.fields['System.Title'],
      businessLine: e.fields[F_LINE()] || 'Unassigned',
    })),
    stories,
  }
}

// Velocity from the Analytics OData feed: completed vs committed points per iteration.
async function getVelocity(count = 6) {
  const url = `${ORG()}/${PROJECT()}/_odata/v4.0-preview/WorkItemSnapshot?` +
    '$apply=filter(WorkItemType eq \'User Story\' and Iteration/StartDate ne null)' +
    '/groupby((Iteration/IterationName, Iteration/StartDate),' +
    ' aggregate(StoryPoints with sum as Points))&$orderby=Iteration/StartDate desc'
  const data = await adoFetch(url)
  return (data.value || []).slice(0, count).reverse()
}

// Current + next two iterations for the team's default settings.
async function getIterations() {
  const data = await adoFetch(`${ORG()}/${PROJECT()}/_apis/work/teamsettings/iterations?api-version=7.1`)
  const now = new Date()
  const upcoming = data.value.filter((it) => it.attributes?.finishDate && new Date(it.attributes.finishDate) >= now)
  return upcoming.slice(0, 3)
}

module.exports = { getWorkItems, getVelocity, getIterations }
