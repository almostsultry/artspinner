import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ScatterChart, Scatter, ReferenceLine, ReferenceArea,
} from 'recharts'
import { api } from '../api.js'

// Validated categorical palette (slots 1–2 used here). Aqua sits below 3:1 on
// this surface, so both series carry direct value labels (the relief rule).
const S1 = '#2a78d6'
const S2 = '#1baf7a'
const INK = { muted: '#898781', axis: '#c3c2b7', grid: '#e1e0d9' }
const DELTA = { up: '#006300', down: '#d03b3b' }

const axisX = { tick: { fill: INK.muted, fontSize: 11.5 }, axisLine: { stroke: INK.axis }, tickLine: false }
const axisY = { tick: { fill: INK.muted, fontSize: 11 }, axisLine: false, tickLine: false, width: 32 }
const tooltipStyle = {
  contentStyle: {
    background: '#fcfcfb', border: '1px solid #e1e0d9', borderRadius: 8,
    fontSize: 12.5, boxShadow: '0 4px 16px rgba(11,11,11,0.08)',
  },
  cursor: { fill: 'rgba(11,11,11,0.04)' },
}

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(([label, color]) => (
        <span className="legend-item" key={label}>
          <span className="legend-swatch" style={{ background: color }} />{label}
        </span>
      ))}
    </div>
  )
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SprintCard({ sprint }) {
  const isCurrent = sprint.label === 'Current'
  const pct = sprint.plannedPoints ? Math.round((sprint.completedPoints / sprint.plannedPoints) * 100) : 0
  return (
    <div className={`sprint-card ${isCurrent ? 'current' : ''}`}>
      <span className="sprint-label">{sprint.label}</span>
      <div className="sprint-name">{sprint.name}</div>
      <div className="sprint-dates">{fmtDate(sprint.start)} – {fmtDate(sprint.end)}</div>
      <div className="sprint-stats">
        <span className="stat"><div className="v">{sprint.plannedPoints}</div><div className="k">planned pts</div></span>
        <span className="stat"><div className="v">{sprint.stories}</div><div className="k">stories</div></span>
        <span className="stat"><div className="v">{sprint.capacityDays}</div><div className="k">capacity days</div></span>
      </div>
      {isCurrent && (
        <>
          <div className="mini-track"><div className="mini-fill" style={{ width: `${pct}%` }} /></div>
          <div className="sprint-focus">{sprint.completedPoints} of {sprint.plannedPoints} pts complete ({pct}%)</div>
        </>
      )}
      <div className="sprint-focus">Focus: {sprint.focus}</div>
    </div>
  )
}

function QuadrantTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={tooltipStyle.contentStyle}>
      <div style={{ fontWeight: 650, padding: '6px 10px 0' }}>{p.title}</div>
      <div style={{ color: INK.muted, padding: '0 10px 6px' }}>
        Value {p.bv.toFixed(1)} · Feasibility {p.fe.toFixed(1)} · Size {p.tshirtSize}
      </div>
    </div>
  )
}

const scorePct = (v) => ((v - 1) / 4) * 100

export default function Dashboard() {
  const [data, setData] = useState(null)
  useEffect(() => { api.dashboard().then(setData) }, [])
  if (!data) return <div className="loading">Loading dashboard…</div>

  const {
    top10, epicsByBusinessLine, velocity, sprints, participation, round,
    divergence = [], quadrant = [], movers = [],
  } = data
  const label = { position: 'top', fill: INK.muted, fontSize: 11 }
  const quadLabel = (text) => ({ value: text, fill: INK.muted, fontSize: 11 })

  return (
    <div className="dash-grid">
      <div className="sprint-cards">
        {sprints.map((s) => <SprintCard key={s.name} sprint={s} />)}
      </div>

      <div className="card wide">
        <h3 className="card-title">Top 10 priorities — {round.name}</h3>
        <p className="card-sub">
          Aggregate of submitted scoresheets. Carryover items from the previous sprint hold
          their position ahead of newly prioritized work.
        </p>
        <table className="top10">
          <thead>
            <tr><th>#</th><th>User story</th><th>Business line</th><th>Size</th><th>Score</th></tr>
          </thead>
          <tbody>
            {top10.map((row) => (
              <tr key={row.id}>
                <td className="num">{row.rank}</td>
                <td>
                  {row.title} <span style={{ color: 'var(--muted)' }}>#{row.id}</span>
                  {row.carryoverFrom && <span className="chip" style={{ marginLeft: 6 }}>Carryover · {row.carryoverFrom}</span>}
                  {row.overridden && <span className="chip" style={{ marginLeft: 6 }}>EVP override</span>}
                </td>
                <td><span className="chip">{row.businessLine}</span></td>
                <td>{row.tshirtSize}</td>
                <td className="num" style={{ fontWeight: 700 }}>{row.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="card-title">Portfolio distribution by business line</h3>
        <p className="card-sub">Epics and user stories currently in scope for prioritization</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={epicsByBusinessLine} barCategoryGap="24%" barGap={2} margin={{ top: 18, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="businessLine" {...axisX} interval={0} />
            <YAxis {...axisY} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="epics" name="Epics" fill={S1} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="epics" {...label} />
            </Bar>
            <Bar dataKey="stories" name="Stories" fill={S2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="stories" {...label} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[['Epics', S1], ['Stories', S2]]} />
      </div>

      <div className="card">
        <h3 className="card-title">Development cadence &amp; velocity</h3>
        <p className="card-sub">Committed vs completed story points, last six sprints</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={velocity} barCategoryGap="24%" barGap={2} margin={{ top: 18, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="sprint" {...axisX} interval={0} />
            <YAxis {...axisY} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="committed" name="Committed" fill={S1} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="committed" {...label} />
            </Bar>
            <Bar dataKey="completed" name="Completed" fill={S2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="completed" {...label} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[['Committed', S1], ['Completed', S2]]} />
      </div>

      <div className="card">
        <h3 className="card-title">Value vs feasibility</h3>
        <p className="card-sub">Mean executive Business Value vs facilitator-set Feasibility — top right is the quick-win quadrant</p>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={INK.grid} />
            <XAxis type="number" dataKey="fe" name="Feasibility" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisX}
              label={{ value: 'Feasibility →', position: 'insideBottomRight', fill: INK.muted, fontSize: 11, dy: -4 }} />
            <YAxis type="number" dataKey="bv" name="Business value" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisY}
              label={{ value: 'Value →', angle: -90, position: 'insideLeft', fill: INK.muted, fontSize: 11 }} />
            <ReferenceArea x1={3} x2={5} y1={3} y2={5} fill="transparent" label={quadLabel('Quick wins')} />
            <ReferenceArea x1={1} x2={3} y1={3} y2={5} fill="transparent" label={quadLabel('Big bets')} />
            <ReferenceArea x1={3} x2={5} y1={1} y2={3} fill="transparent" label={quadLabel('Fill-ins')} />
            <ReferenceArea x1={1} x2={3} y1={1} y2={3} fill="transparent" label={quadLabel('Deprioritize')} />
            <ReferenceLine x={3} stroke={INK.axis} />
            <ReferenceLine y={3} stroke={INK.axis} />
            <Tooltip content={<QuadrantTooltip />} />
            <Scatter data={quadrant} fill={S1} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="card-title">Where leadership disagrees</h3>
        <p className="card-sub">Largest spread in priority scores across scoresheets — worth a discussion thread</p>
        {divergence.map((d) => (
          <div className="div-row" key={d.id}>
            <div className="div-title">{d.title}</div>
            <div className="div-track">
              <div
                className="div-range"
                style={{ left: `${scorePct(d.min)}%`, width: `${Math.max(scorePct(d.max) - scorePct(d.min), 2)}%` }}
              />
            </div>
            <span className="div-spread num">Δ {d.spread.toFixed(2)}</span>
          </div>
        ))}
        <p className="card-sub" style={{ marginTop: 8 }}>Bar shows the min–max range of each story's priority score (1–5 scale).</p>
      </div>

      <div className="card">
        <h3 className="card-title">Movers since last round</h3>
        <p className="card-sub">Biggest changes in aggregate rank vs the previous prioritization</p>
        {movers.length === 0 && <p className="card-sub">No previous round to compare yet.</p>}
        {movers.map((m) => (
          <div className="mover-row" key={m.id}>
            <span className="mover-delta" style={{ color: m.delta > 0 ? DELTA.up : DELTA.down }}>
              {m.delta > 0 ? '▲' : '▼'} {Math.abs(m.delta)}
            </span>
            <span className="div-title">{m.title}</span>
            <span className="num" style={{ color: 'var(--muted)' }}>{m.from} → {m.to}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title">Submissions</h3>
        <p className="card-sub">{participation.submitted} of {participation.total} scoresheets submitted this round</p>
        {participation.submittedNames?.map((n) => (
          <div className="who-row" key={n}><span style={{ color: DELTA.up }}>✓</span> {n}</div>
        ))}
        {participation.waitingOn.map((n) => (
          <div className="who-row" key={n}><span style={{ color: 'var(--muted)' }}>○</span> {n} <span className="chip">waiting</span></div>
        ))}
      </div>
    </div>
  )
}
