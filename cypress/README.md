# ANIMUA Functionality Testing

This directory is the Cypress home for the approved FT-001 through FT-083
Functionality Testing scope. It contains environment scaffolding only; the formal
test specifications have not yet been implemented.

## Local applications

- Public frontend: `http://127.0.0.1:5173`
- Management frontend: `http://127.0.0.1:5174`
- Backend API: `http://127.0.0.1:5000/api`

Override these defaults with `CYPRESS_PUBLIC_BASE_URL`,
`CYPRESS_MANAGEMENT_BASE_URL`, and `CYPRESS_API_BASE_URL`.

## Commands

- `npm run test:functionality:verify` verifies the Cypress binary only.
- `npm run test:functionality:open` opens Cypress interactively.
- `npm run test:functionality` runs the future functionality specifications.

Start the applications separately before opening or running Cypress. The setup
does not automatically seed data or start production services.

## Credentials and reusable commands

Copy `cypress.env.example.json` to the ignored `cypress.env.json` file and add
dedicated non-production Client, Admin, Staff, and Veterinarian test accounts.
Never commit real credentials.

The support layer provides `visitPublicPage`, `visitManagementPage`,
`loginClient`, `loginAdmin`, `loginStaff`, `loginVet`, `logoutClient`,
`logoutManagement`, and `clearAnimuaSession`. Login commands use the existing
user interface and validate the resulting application session. They do not
inject an authentication token or bypass role checks.

## Specification naming and module layout

Use one formal file per approved document:
`FT-001-short-function-name.cy.js` through
`FT-083-short-function-name.cy.js`. Place each file in its matching module
folder under `e2e/public` or `e2e/management`. Keep the approved five runs for a
formal document inside that document's single specification file.

## Controlled test data

- Keep reusable, non-secret static inputs in `fixtures`. Do not store account
  passwords, live personal data, OTPs, or CAPTCHA tokens in fixtures.
- Give created records a unique FT identifier. Create them through the approved
  user interface or an existing authorized test-environment API, and remove only
  the records created by that test during cleanup.
- Use dedicated test accounts and a disposable test dataset. Restore mutable
  inventory, animal, application, announcement, and user records after each
  specification that changes them.
- For email or OTP behavior, use a sanctioned test inbox or local emulator when
  available. If neither is available, make the received value a controlled
  manual precondition for that run; do not intercept or forge production OTPs.
- For CAPTCHA behavior, use the provider's documented test keys in a controlled
  environment or complete the challenge manually. Do not disable, stub out, or
  bypass production CAPTCHA validation.
- Do not point destructive setup or cleanup at production. External integrations
  must use approved sandbox/test credentials and must be cleaned up through the
  integration's supported test workflow.
