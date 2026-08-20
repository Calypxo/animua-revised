# Hosted Firebase environment for Functionality Testing

ANIMUA Functionality Testing uses a separate hosted Firebase project. It does
not use `animua-angelescity`, and it does not use the Firebase Emulator Suite.

## Create the ignored local environment files

From the repository root in PowerShell:

```powershell
Copy-Item frontend/.env.test.example frontend/.env.test
Copy-Item admin-frontend/.env.test.example admin-frontend/.env.test
Copy-Item backend/.env.test.example backend/.env.test
```

Replace every placeholder in those three local files. The files are ignored by
Git. Do not place credentials in the tracked example files.

The active Firebase project ID and the corresponding functionality-test safety
ID must be identical in all three files. Emulator variables must remain off or
unset.

## Verify configuration without accessing Firebase data

```powershell
npm run check:functionality:config
```

The checker reads configuration only. It does not initialize Firebase or make
network requests, and it never prints credential values.

## Start ANIMUA in hosted Functionality Testing mode

Run these in separate terminals:

```powershell
npm --prefix backend run start:test
npm --prefix frontend run dev:test
npm --prefix admin-frontend run dev:test
```

The URLs remain:

- Public frontend: `http://127.0.0.1:5173`
- Management frontend: `http://127.0.0.1:5174`
- Backend API: `http://127.0.0.1:5000/api`

Do not seed data until the configuration checker passes and the Firebase
project has been independently confirmed as the approved FT project.

## Functionality Testing baseline

The baseline tool is restricted to `animua-ft`, its exact service-account
project, and `animua-ft.firebasestorage.app`. It aborts if any Firebase
Emulator variable is set. Configure the `FT_...` account values shown in
`backend/.env.test.example`, then review the mandatory zero-write plan:

```powershell
npm --prefix backend run ft:baseline:dry-run
```

Only after independently reviewing that output should an authorized operator
run one of the hosted mutation commands:

```powershell
npm --prefix backend run ft:baseline:seed
npm --prefix backend run ft:baseline:reset
```

The read-only verifier checks only the exact records in `FT_BASELINE_V1`:

```powershell
npm --prefix backend run ft:baseline:verify
```

The seed/reset tools never enumerate or clear collections. Reset cleanup is
limited to manifest documents, the exact FT registration email, and exact
targets recorded in the owned `FT_BASELINE_V1` run ledger.

The repository's `.firebaserc` still points its default alias at the normal
ANIMUA project. Until an explicit FT alias is approved, any future Firebase CLI
command for FT must include `--project <approved-ft-project-id>`. Never run a
rules, indexes, Hosting, or Storage deployment against the implicit default
while preparing Functionality Testing.
