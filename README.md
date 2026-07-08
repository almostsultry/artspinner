# Executive Prioritization App

A CAT-branded web app for executives to score, rank, and discuss Azure DevOps
user stories, with results persisted to Dataverse and a delivery dashboard.

**Stack**: React (Vite) SPA · Azure Functions API · Azure Static Web Apps ·
Entra ID auth · Dataverse persistence · Azure DevOps as the work-item source.

## What it does

- **Prioritize** — one screen, two sections. Top: the user's **sprint
  prioritization**, a flat numbered list with drag-grip reordering (epic shown
  as a tag on each row). Below: the **unprioritized backlog**, grouped by
  Epic. Executives score only their judgment calls — Business Value and
  Strategic Fit, 1–5 — while Feasibility and Readiness appear as read-only
  facilitator-set facts; the weighted Priority Score (35/25/20/20) computes
  live once both halves exist. Fully-scored stories move up via "Prioritize".
  Drafts autosave; Submit records the scoresheet for the open round (editable
  until the round closes). Current-sprint items are locked — rounds plan
  future sprints — with a per-item admin unlock.
- **Admin tab** — the facilitator's analysis surface: set shared Feasibility
  and Readiness (with rationale) per story after consultative review; t-shirt
  size suggests a feasibility starting point. Also: round open/close and
  current-sprint unlock controls.
- **Score rationales** — every score can carry a quantified "why" ("$2MM/yr
  margin", "50% of 4 headcount weekly"), entered in the story sidecar, shown
  as tooltips, and shared with the group next to the discussion thread.
- **Discussion sidecar** — per-story threaded comments in a slide-out panel.
- **Copilot sidecar** — a data-aware assistant that answers questions about
  the round (top priorities, divergence, movers, carryover, velocity,
  participation). Deterministic aggregate answers in mock mode; plugs into
  Azure OpenAI (or an embedded Copilot Studio agent) in live mode.
- **Dashboard** — top 10 aggregate priorities (with business line, t-shirt
  size, carryover and EVP-override badges), portfolio distribution by business
  line, velocity (committed vs completed), current + next two sprint cards,
  scoring-divergence ranges, a value-vs-feasibility quadrant, movers since the
  previous round, and a submission tracker.

## Run it locally (no backend needed)

```bash
cd app && npm install && npm run dev
```

The client automatically falls back to an in-browser mock (localStorage-
backed) when the API isn't reachable, so the full UX is reviewable
immediately. To run the real API locally: `cd api && npm install && func start`
(requires Azure Functions Core Tools), keeping `DATA_MODE=mock` until
Dataverse/ADO credentials exist.

## Repository layout

| Path | Purpose |
|---|---|
| `app/` | React SPA (Vite) |
| `api/` | Azure Functions API — `DATA_MODE=mock` or `live` |
| `mock-data/` | Seed data shared by the client mock and the API mock |
| `setup/` | Dataverse dev-environment bootstrap + per-env config seeding |
| `solution/` | Unpacked Dataverse solution source (managed-solution ALM) |
| `docs/SETUP.md` | Per-environment setup: Entra, Dataverse, ADO, SWA |
| `azure-pipelines.yml` | Build → deploy SWA → (optional) pack/import solution |
| `staticwebapp.config.json` | Auth (Entra), routing, API runtime |

## Status

Phase 1–2 scaffold: full UX against mock data; Dataverse write path and ADO
read path implemented in `api/src/shared/` behind `DATA_MODE=live` (pending
credentials and field-name confirmation — see `docs/SETUP.md`). Phase 3:
EVP override UI, live dashboard aggregation, notifications, ADO write-back.
