# Environment setup

One-time steps per environment. Everything an admin does by hand is here;
everything else is code in this repo.

## 1. Entra ID app registration (per tenant)

1. **Entra admin center → App registrations → New registration**
   - Name: `ExecPrioritization`
   - Redirect URI (Web): `https://<your-swa-hostname>/.auth/login/aad/callback`
2. Create a **client secret**; note tenant ID, client ID, secret.
3. This one registration serves three purposes:
   - **SWA login** (`AAD_CLIENT_ID` / `AAD_CLIENT_SECRET` app settings on the Static Web App; tenant ID goes into `staticwebapp.config.json`'s `openIdIssuer`).
   - **Dataverse S2S** (`DV_CLIENT_ID` / `DV_CLIENT_SECRET` Function settings).
   - **Setup scripts** (same values as env vars).
4. Create a security group **Prioritization Executives**; restrict app
   assignment to it (Enterprise application → Properties → Assignment required,
   then assign the group).

## 2. Dataverse environment

1. **Power Platform admin center → Environments → your dev environment →
   Settings → Users + permissions → Application users → New app user**:
   pick the app registration, assign a security role with create/read/write on
   the `etc_*` tables (System Customizer works for dev; create a scoped
   `Prioritization Service` role before prod).
2. Bootstrap the schema (dev only):

   ```bash
   TENANT_ID=... DV_CLIENT_ID=... DV_CLIENT_SECRET=... \
     node setup/dataverse-init.mjs --env https://<dev-org>.crm.dynamics.com
   ```

3. Seed config + first round (every environment):

   ```bash
   TENANT_ID=... DV_CLIENT_ID=... DV_CLIENT_SECRET=... \
     node setup/seed-config.mjs --env https://<org>.crm.dynamics.com
   ```

   Edit the `CONFIG` block first: real ADO field reference names, EVP→business
   unit map, admin user object IDs.
4. Test/prod get schema via the managed solution — see `solution/README.md`.

## 3. Azure DevOps access

- Create a PAT (or service principal) with **Work Items: Read** and
  **Analytics: Read** scopes; set `ADO_PAT`, `ADO_ORG_URL`, `ADO_PROJECT`.
- Confirm the custom field reference names (Organization settings → Process →
  your process → User Story → fields). Defaults assumed:
  `Custom.BusinessLine`, `Custom.TShirtSize`. Set `ADO_FIELD_BUSINESS_LINE` /
  `ADO_FIELD_TSHIRT_SIZE` if different.
- In-scope states default to `Open,Discovery,Ready for Development`
  (`ADO_IN_SCOPE_STATES`).

## 4. Azure Static Web App

1. Create a **Static Web Apps (Standard)** resource — Standard is required for
   custom Entra auth. Choose "Other" as deployment source (the ADO pipeline
   deploys).
2. Copy the **deployment token** into the pipeline variable
   `SWA_DEPLOYMENT_TOKEN` (secret).
3. Application settings on the SWA resource: `AAD_CLIENT_ID`,
   `AAD_CLIENT_SECRET`, plus the Function settings from
   `api/local.settings.sample.json` (`DATA_MODE`, `TENANT_ID`, `DV_*`,
   `ADO_*`, `ADMIN_USER_IDS`). Keep `DATA_MODE=mock` until Dataverse/ADO
   credentials are in place.

## 5. Business rules encoded in the app

- **Priority Score** = Business Value×35% + Feasibility×25% + Readiness×20% +
  Strategic Fit×20% (weights in `etc_config/scoringWeights`). Computed at read
  time so facilitator updates are never stale.
- **Split ownership of dimensions**: executives score only Business Value and
  Strategic Fit (their judgment calls). Feasibility and Readiness are analyzed
  facts set once per story by the facilitator in the Admin tab — following
  business analysis and consultative review — and are read-only for
  executives (`etc_storyfact`). T-shirt size suggests a feasibility default.
  A story has no priority score until both halves exist.
- **Score rationales**: every score (exec BV/SF and facilitator FE/RD) can
  carry a free-text rationale ("$2MM/yr", "50% of 4 headcount weekly").
  Entered in the story sidecar / Admin tab, shown as tooltips on the row, and
  visible to all executives alongside the discussion thread.
- **Sort order**: a user's manual drag-rank outranks score sort; score sort is
  the default.
- **Scoring model**: individual scoresheets per executive, aggregated (mean)
  on the dashboard; EVP override per business unit sits above the aggregate
  (Phase 3 UI).
- **Rounds plan future sprints only**: stories in the current sprint are
  locked for executives; admins can unlock individual items.
- **Round transition**: items unfinished in the outgoing sprint carry over at
  their existing priority, ahead of newly prioritized work; sprint planning
  consumes the executive priorities for future sprints.
- **Submissions**: editable and resubmittable until the round closes.

## Data-viz palette note

Chart series colors are the validated colorblind-safe palette in
`app/src/components/Dashboard.jsx` (worst adjacent CVD ΔE 24.2). Two slots sit
below 3:1 contrast on the light surface, so charts always carry direct value
labels. CAT yellow `#FFCD11` is reserved for UI accents and never used as a
data-series color.
