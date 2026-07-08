#!/usr/bin/env node
// Seeds per-environment configuration rows into etc_config, and creates the
// first open etc_round if none exists. Config is data, not schema — managed
// solutions don't carry it, so run this once per environment (values below
// may legitimately differ between dev/test/prod).
//
// Usage:
//   TENANT_ID=... DV_CLIENT_ID=... DV_CLIENT_SECRET=... \
//   node setup/seed-config.mjs --env https://yourorg.crm.dynamics.com

const OPTION_BASE = 123450000

const CONFIG = {
  scoringWeights: { businessValue: 0.35, feasibility: 0.25, readiness: 0.2, strategicFit: 0.2 },
  adoFieldMap: {
    businessLine: 'Custom.BusinessLine',   // TODO: confirm real reference names
    tshirtSize: 'Custom.TShirtSize',
    inScopeStates: ['Open', 'Discovery', 'Ready for Development'],
  },
  evpMap: {
    // businessUnit → Entra object id of the EVP who can override its ranking
  },
  adminUsers: [
    // Entra object ids of users who can open/close rounds and unlock items
  ],
}

const envUrl = process.argv[process.argv.indexOf('--env') + 1]
if (!envUrl || !envUrl.startsWith('https://')) {
  console.error('Usage: node setup/seed-config.mjs --env https://yourorg.crm.dynamics.com')
  process.exit(1)
}

const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.DV_CLIENT_ID,
    client_secret: process.env.DV_CLIENT_SECRET,
    scope: `${envUrl}/.default`,
  }),
})
if (!tokenRes.ok) throw new Error(`Token request failed: ${await tokenRes.text()}`)
const bearer = (await tokenRes.json()).access_token

async function dv(method, path, body) {
  const res = await fetch(`${envUrl}/api/data/v9.2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
  return res.status === 204 ? {} : res.json()
}

for (const [key, value] of Object.entries(CONFIG)) {
  const existing = await dv('GET', `/etc_configs?$filter=etc_name eq '${key}'&$top=1`)
  const payload = { etc_name: key, etc_value: JSON.stringify(value, null, 2) }
  if (existing.value.length) {
    await dv('PATCH', `/etc_configs(${existing.value[0].etc_configid})`, payload)
    console.log(`= updated config ${key}`)
  } else {
    await dv('POST', '/etc_configs', payload)
    console.log(`+ created config ${key}`)
  }
}

const rounds = await dv('GET', `/etc_rounds?$filter=etc_status eq ${OPTION_BASE}&$top=1`)
if (rounds.value.length) {
  console.log(`= open round exists: ${rounds.value[0].etc_name}`)
} else {
  const now = new Date()
  const closes = new Date(now.getTime() + 14 * 86400000)
  await dv('POST', '/etc_rounds', {
    etc_name: `${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} Prioritization`,
    etc_openson: now.toISOString(),
    etc_closeson: closes.toISOString(),
    etc_status: OPTION_BASE, // Open
  })
  console.log('+ created initial open round')
}
console.log('Done.')
