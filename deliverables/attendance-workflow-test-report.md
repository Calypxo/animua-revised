# Surrender and adoption workflow checks

Date: September 15, 2026

## Result

79 scoped tests passed: 41 backend, 27 frontend, and 11 Cypress browser tests. Both frontend production builds passed. Changes remain local and uncommitted; no deployment was performed.

## Defects found and fixed

- Confirmed arrivals could still be marked no-show through the backend. Both workflows now reject this action after confirmed arrival; adoption also hides the action at that stage.
- An open modal could show a refreshed monitoring date alongside an old schedule field. Changed records now refresh the complete read-only details while retaining scroll position and action-menu state.
- Backend attendance deadlines depended on the server timezone. Approval dates, schedule windows, and expiration now use Philippine calendar days explicitly. Tests passed with the server timezone set to UTC.

The previously hidden desktop action group was verified in a real browser. Phone layouts retain the expandable action menu.

## Coverage

- Approval creates the 14-day window, including approval near UTC midnight.
- Schedule dates before today or after the final deadline are rejected.
- Surrender date changes require staff approval and preserve the final deadline; a second change is rejected.
- Adoption permits one directly saved pickup change; a second is rejected.
- Confirmed arrivals cannot be rescheduled or marked no-show.
- Missed appointments remain distinct from final deadline expiry.
- Pending reschedules do not suspend expiry; an explicit extension changes the deadline.
- Confirmed attendance stops automatic expiry.
- Surrender intake conversion and adoption finalization require confirmed arrival.
- Finalization handles competing applications, stale decisions, failed transactions, and notification failure.
- Table notes stay compact; dates and follow-up guidance appear in the modal.
- Both modals refresh after schedule changes and switch to the next action after arrival.
- No-show and extension controls are reachable on desktop and phones.
- Surrender attendance confirmation forms show the correct fields for each action.

## Test boundaries

Backend tests use database doubles. Browser tests execute the actual page renderers and styles against in-memory fixture responses on a local server. They do not sign in or mutate hosted shelter records. They verify interaction and visibility; fixture assets do not establish full production visual parity.

The separate animua-ft configuration passed its read-only safety check, but a signed-in hosted Firebase end-to-end run was not performed. Production email delivery, scheduled-job execution, Firebase permissions, and deployed behavior remain outside this run.

Existing behavior remains: staff may manually mark an approved, unconfirmed request no-show before the final deadline. Automatic deadline reconciliation also deactivates the public account after expiry without arrival; this existing behavior is covered by regression tests.

The backend fixes require deploying the backend as well as the frontend updates when deployment is authorized.

## Commands

Backend (run with `TZ=UTC`):

```text
node --test --test-isolation=none backend/test/requestDeadlineService.test.js backend/test/requestDeadlineAccountDeactivation.test.js backend/test/surrenderAppointmentScheduling.test.js backend/test/surrenderWorkflowService.test.js backend/test/adoptionWorkflowService.test.js backend/test/adoptionPickupRescheduleLimit.test.js backend/test/adoptionFinalizationClosure.test.js backend/test/adoptionRoutes.test.js backend/test/intakeWorkflowService.test.js backend/test/attendanceActions.test.js
```

Frontend:

```text
node --test --test-isolation=none admin-frontend/test/adoptionPickupMonitor.test.js admin-frontend/test/surrenderAppointmentMonitor.test.js admin-frontend/test/adoptionSubmittedDate.test.js admin-frontend/test/surrenderQueueResponsive.test.js frontend/test/mySubmissionsState.test.js frontend/test/mySubmissionsResponsive.test.js
```

Browser (local fixture server at port 5188; unset `ELECTRON_RUN_AS_NODE` for the test process):

```text
node node_modules/cypress/bin/cypress run --config baseUrl=http://127.0.0.1:5188,video=false --spec cypress/e2e/management/attendance-monitoring.cy.js,cypress/e2e/management/surrender/surrender-attendance-modal.cy.js --browser electron
```

Build and configuration:

```text
npm run build:firebase
npm run check:functionality:config
git diff --check
```
