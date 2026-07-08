#!/usr/bin/env node
// Creates the Dataverse schema for the prioritization app in a DEV environment.
// Idempotent: existing tables/columns are skipped, so re-run freely as the
// schema evolves. Downstream environments receive schema via managed-solution
// ALM (see docs/SETUP.md), never via this script.
//
// Usage:
//   TENANT_ID=... DV_CLIENT_ID=... DV_CLIENT_SECRET=... \
//   node setup/dataverse-init.mjs --env https://yourorg.crm.dynamics.com
//
// Publisher: prefix "etc", option value prefix 12345.

const PREFIX = 'etc'
const OPTION_BASE = 123450000 // option value prefix 12345
const LANG = 1033

const envUrl = process.argv[process.argv.indexOf('--env') + 1]
if (!envUrl || !envUrl.startsWith('https://')) {
  console.error('Usage: node setup/dataverse-init.mjs --env https://yourorg.crm.dynamics.com')
  process.exit(1)
}
for (const v of ['TENANT_ID', 'DV_CLIENT_ID', 'DV_CLIENT_SECRET']) {
  if (!process.env[v]) { console.error(`Missing env var ${v}`); process.exit(1) }
}

const label = (text) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.Label', LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: LANG }] })

const string = (name, display, len = 200) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display), MaxLength: len,
  RequiredLevel: { Value: 'None' },
})
const integer = (name, display) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display),
  MinValue: -2147483648, MaxValue: 2147483647, RequiredLevel: { Value: 'None' },
})
const decimal = (name, display) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display),
  MinValue: 0, MaxValue: 100, Precision: 2, RequiredLevel: { Value: 'None' },
})
const memo = (name, display) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display), MaxLength: 100000,
  RequiredLevel: { Value: 'None' },
})
const datetime = (name, display) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display), Format: 'DateAndTime',
  RequiredLevel: { Value: 'None' },
})
const picklist = (name, display, options) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
  SchemaName: `${PREFIX}_${name}`, DisplayName: label(display), RequiredLevel: { Value: 'None' },
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
    IsGlobal: false, OptionSetType: 'Picklist',
    Options: options.map((o, i) => ({ Value: OPTION_BASE + i, Label: label(o) })),
  },
})

// Table definitions. Primary name column is created with the table.
const TABLES = [
  {
    name: 'round', display: 'Prioritization Round', collection: 'Prioritization Rounds',
    description: 'A prioritization window aligned to sprint planning. Closing a round snapshots results.',
    attributes: [
      string('targetsprint', 'Target Sprint', 100),
      string('currentsprint', 'Current Sprint (locked)', 100),
      datetime('openson', 'Opens On'),
      datetime('closeson', 'Closes On'),
      picklist('status', 'Status', ['Open', 'Closed']),
    ],
  },
  {
    name: 'score', display: 'Priority Score', collection: 'Priority Scores',
    description: 'One executive\'s judgment scores (Business Value, Strategic Fit) for one work item in one round, with rationale notes.',
    attributes: [
      integer('workitemid', 'ADO Work Item ID'),
      string('workitemtitle', 'Work Item Title', 400),
      string('userid', 'User Object ID', 100),
      string('username', 'User Name', 200),
      integer('businessvalue', 'Business Value (1-5)'),
      integer('strategicfit', 'Strategic Fit (1-5)'),
      memo('businessvaluenote', 'Business Value Rationale'),
      memo('strategicfitnote', 'Strategic Fit Rationale'),
      // Legacy per-exec columns kept for schema stability; no longer written —
      // Feasibility/Readiness live on etc_storyfact as facilitator-set facts.
      integer('feasibility', 'Feasibility (1-5, unused)'),
      integer('readiness', 'Readiness (1-5, unused)'),
      decimal('priorityscore', 'Priority Score (computed at read time)'),
      picklist('status', 'Status', ['Draft', 'Submitted']),
      datetime('submittedon', 'Submitted On'),
    ],
    lookupTo: 'round',
  },
  {
    name: 'storyfact', display: 'Story Facts', collection: 'Story Facts',
    description: 'Facilitator-analyzed shared values per work item per round: Feasibility and Readiness with rationale. Admin-editable only.',
    attributes: [
      integer('workitemid', 'ADO Work Item ID'),
      integer('feasibility', 'Feasibility (1-5)'),
      integer('readiness', 'Readiness (1-5)'),
      memo('feasibilitynote', 'Feasibility Rationale'),
      memo('readinessnote', 'Readiness Rationale'),
      string('userid', 'Set By (Object ID)', 100),
      string('username', 'Set By (Name)', 200),
    ],
    lookupTo: 'round',
  },
  {
    name: 'manualrank', display: 'Manual Rank', collection: 'Manual Ranks',
    description: 'One executive\'s manual priority position for one work item in one round. Overrides score sort.',
    attributes: [
      integer('workitemid', 'ADO Work Item ID'),
      integer('rank', 'Rank Position'),
      string('userid', 'User Object ID', 100),
      string('username', 'User Name', 200),
    ],
    lookupTo: 'round',
  },
  {
    name: 'evpoverride', display: 'EVP Override', collection: 'EVP Overrides',
    description: 'EVP override of the aggregate ranking for their business unit, with rationale.',
    attributes: [
      integer('workitemid', 'ADO Work Item ID'),
      integer('overriderank', 'Override Rank'),
      string('businessunit', 'Business Unit', 200),
      string('userid', 'User Object ID', 100),
      string('username', 'User Name', 200),
      memo('rationale', 'Rationale'),
    ],
    lookupTo: 'round',
  },
  {
    name: 'comment', display: 'Discussion Comment', collection: 'Discussion Comments',
    description: 'Discussion thread entries per work item (sidecar).',
    attributes: [
      integer('workitemid', 'ADO Work Item ID'),
      string('userid', 'User Object ID', 100),
      string('username', 'User Name', 200),
      memo('text', 'Comment Text'),
    ],
  },
  {
    name: 'sortpreference', display: 'Sort Preference', collection: 'Sort Preferences',
    description: 'Per-user saved grouping/sort configuration for the prioritization list.',
    attributes: [
      string('userid', 'User Object ID', 100),
      memo('configjson', 'Configuration (JSON)'),
    ],
  },
  {
    name: 'config', display: 'App Config', collection: 'App Config',
    description: 'Key/value app configuration: scoring weights, ADO field map, EVP map, admins.',
    attributes: [memo('value', 'Value (JSON)')],
  },
]

// --- Web API plumbing -------------------------------------------------------
const api = `${envUrl}/api/data/v9.2`
let bearer

async function auth() {
  const res = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.DV_CLIENT_ID,
      client_secret: process.env.DV_CLIENT_SECRET,
      scope: `${envUrl}/.default`,
    }),
  })
  if (!res.ok) throw new Error(`Token request failed ${res.status}: ${await res.text()}`)
  bearer = (await res.json()).access_token
}

async function dv(method, path, body, ok404 = false) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 404 && ok404) return null
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
  return res.status === 204 ? {} : res.json()
}

async function ensureTable(t) {
  const logical = `${PREFIX}_${t.name}`
  const existing = await dv('GET', `/EntityDefinitions(LogicalName='${logical}')?$select=LogicalName`, null, true)
  if (existing) {
    console.log(`  = table ${logical} exists`)
  } else {
    console.log(`  + creating table ${logical}`)
    await dv('POST', '/EntityDefinitions', {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: logical,
      DisplayName: label(t.display),
      DisplayCollectionName: label(t.collection),
      Description: label(t.description),
      OwnershipType: 'UserOwned',
      HasNotes: false, HasActivities: false,
      Attributes: [{
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        SchemaName: `${PREFIX}_name`, IsPrimaryName: true, MaxLength: 400,
        DisplayName: label('Name'), RequiredLevel: { Value: 'None' },
      }],
    })
  }
  for (const attr of t.attributes) {
    const attrLogical = attr.SchemaName.toLowerCase()
    const found = await dv('GET',
      `/EntityDefinitions(LogicalName='${logical}')/Attributes(LogicalName='${attrLogical}')?$select=LogicalName`, null, true)
    if (found) { console.log(`    = column ${attrLogical}`); continue }
    console.log(`    + column ${attrLogical}`)
    await dv('POST', `/EntityDefinitions(LogicalName='${logical}')/Attributes`, attr)
  }
  if (t.lookupTo) {
    const relName = `${PREFIX}_${t.lookupTo}_${t.name}`
    const found = await dv('GET', `/RelationshipDefinitions(SchemaName='${relName}')?$select=SchemaName`, null, true)
    if (found) { console.log(`    = lookup ${relName}`) } else {
      console.log(`    + lookup ${logical}.${PREFIX}_roundid → ${PREFIX}_${t.lookupTo}`)
      await dv('POST', '/RelationshipDefinitions', {
        '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName: relName,
        ReferencedEntity: `${PREFIX}_${t.lookupTo}`,
        ReferencingEntity: logical,
        Lookup: {
          SchemaName: `${PREFIX}_RoundId`,
          DisplayName: label('Round'),
          RequiredLevel: { Value: 'None' },
        },
        AssociatedMenuConfiguration: { Behavior: 'UseCollectionName' },
        CascadeConfiguration: { Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade', Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade' },
      })
    }
  }
}

console.log(`Dataverse init → ${envUrl} (publisher prefix ${PREFIX}_, option base ${OPTION_BASE})`)
await auth()
for (const t of TABLES) await ensureTable(t)
console.log('Done. Next: node setup/seed-config.mjs --env ' + envUrl)
