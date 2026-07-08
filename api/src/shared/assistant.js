// Copilot sidecar backend. Deterministic data-aware answers by default;
// when AZURE_OPENAI_ENDPOINT is configured the question goes to an LLM with
// the round's aggregates as context. (A Copilot Studio agent can be embedded
// client-side instead via COPILOT_EMBED_URL — see CopilotPanel.jsx.)

function answerFromData(question, d) {
  const q = (question || '').toLowerCase()
  const fmt = (rows) => rows.map((r) => `${r.rank}. ${r.title} (${r.businessLine}, ${r.tshirtSize}) — ${r.score.toFixed(2)}`).join('\n')

  if (/(disagree|diverg|consensus|conflict)/.test(q)) {
    const top = d.divergence.map((s) => `• ${s.title}: scores range ${s.min.toFixed(2)}–${s.max.toFixed(2)} (spread ${s.spread.toFixed(2)})`).join('\n')
    return `Leadership disagrees most on:\n${top}\n\nThese are good candidates for the discussion threads before the round closes.`
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
  return 'I can analyze this round\'s data — try asking about: top priorities, where leadership disagrees, movers since last round, carryover items, velocity, portfolio distribution by business line, or who still needs to submit.'
}

async function askLLM(question, d) {
  const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-06-01`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are the analysis copilot inside an executive portfolio-prioritization app. ' +
            'Answer concisely from the JSON context below. It contains the current round, the aggregate ' +
            'top-10 priorities, scoring divergence, movers vs the previous round, velocity, sprint plan, ' +
            'and submission participation.\n\n' + JSON.stringify(d),
        },
        { role: 'user', content: question },
      ],
      max_tokens: 500,
    }),
  })
  if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function ask(question, dashboardData) {
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
    return askLLM(question, dashboardData)
  }
  return answerFromData(question, dashboardData)
}

module.exports = { ask, answerFromData }
