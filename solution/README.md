# Dataverse solution source

This folder holds the **unpacked** Power Platform solution source
(`solution/src`) once the schema has been created in the dev environment.

## Workflow (managed-solution ALM)

1. Bootstrap dev: `node setup/dataverse-init.mjs --env https://<dev-org>.crm.dynamics.com`
2. In the dev environment, add the `etc_*` tables to a solution named
   `ExecPrioritization` (publisher prefix `etc`, option value prefix `12345`).
3. Export + unpack into this folder:

   ```bash
   pac auth create --environment https://<dev-org>.crm.dynamics.com
   pac solution export --name ExecPrioritization --path /tmp/ExecPrioritization.zip --managed false
   pac solution unpack --zipfile /tmp/ExecPrioritization.zip --folder solution/src --packagetype Unmanaged
   ```

4. Commit `solution/src` — individual XML files diff cleanly in PRs.
5. The `DataverseSolution` pipeline stage packs it **managed** and imports it
   into test/prod via the Power Platform service connection
   (set pipeline variable `DEPLOY_SOLUTION=true`).

Per-environment config data (weights, ADO field map, EVP map, admins) is NOT
in the solution — run `setup/seed-config.mjs` once per environment.
