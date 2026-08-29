import test from "node:test";
import assert from "node:assert/strict";

import {
  applicationCompatibilityPresentation,
  mergeSubmissionResults,
  publicRejectionReason,
  submissionDisplayStatus,
  submissionLoadErrorMessage,
} from "../src/public/js/mySubmissionsState.js";

test("a real empty submissions response remains empty", () => {
  assert.deepEqual(mergeSubmissionResults([], []), []);
});

test("real adoption and surrender results are combined without fallback records", () => {
  const adoption = { id: "APP-2026-001" };
  const surrender = { id: "SR-2026-001" };
  assert.deepEqual(
    mergeSubmissionResults([adoption], [surrender]),
    [adoption, surrender]
  );
});

test("API failures produce a visible load error message", () => {
  assert.match(
    submissionLoadErrorMessage(new Error("Request failed: 503")),
    /unable to load.*503/i
  );
});

test("saved rejection reasons are returned for public submission details", () => {
  assert.equal(
    publicRejectionReason({ rejectedReason: "  The current home setup is not suitable.  " }, "adoption"),
    "The current home setup is not suitable."
  );
});

test("legacy surrender review notes remain available as a rejection reason", () => {
  assert.equal(
    publicRejectionReason({ reviewNotes: "Shelter capacity is currently full." }, "surrender"),
    "Shelter capacity is currently full."
  );
  assert.equal(
    publicRejectionReason({ reviewNotes: "Internal note" }, "adoption"),
    ""
  );
});

test("an application without quiz data is not presented as a good match", () => {
  assert.deepEqual(applicationCompatibilityPresentation({ compatibility: null }), {
    label: "Not assessed",
    accessibleLabel: "Not assessed because the compatibility quiz was not taken",
    iconClass: "fa-solid fa-minus",
    stateClass: "is-unassessed",
  });
});

test("an application with a compatibility score presents the saved match", () => {
  assert.deepEqual(
    applicationCompatibilityPresentation({ compatibility: { matchPercent: 84 } }),
    {
      label: "84% Match",
      iconClass: "fa-solid fa-check",
      stateClass: "is-assessed",
    },
  );
});

test("confirmed attendance replaces approved display labels for both workflows", () => {
  assert.equal(
    submissionDisplayStatus({
      type: "adoption",
      details: { arrivalConfirmedAt: "2026-08-29T01:00:00.000Z" },
    }, "Approved"),
    "Pickup Confirmed",
  );
  assert.equal(
    submissionDisplayStatus({
      type: "surrender",
      details: { arrivalConfirmedAt: "2026-08-29T01:00:00.000Z" },
    }, "Accepted"),
    "Drop-off Confirmed",
  );
});

test("terminal workflow statuses remain more important than attendance confirmation", () => {
  assert.equal(
    submissionDisplayStatus({
      type: "adoption",
      details: { arrivalConfirmedAt: "2026-08-29T01:00:00.000Z" },
    }, "Finalized"),
    "Finalized",
  );
  assert.equal(
    submissionDisplayStatus({
      type: "surrender",
      details: { arrivalConfirmedAt: "2026-08-29T01:00:00.000Z" },
    }, "Converted"),
    "Converted",
  );
});
