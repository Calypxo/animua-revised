import test from "node:test";
import assert from "node:assert/strict";
import {
  MANAGEMENT_NOTIFICATION_ROUTES,
  getManagementNotificationDestination,
} from "../src/components/management/notificationNavigation.js";

test("supported management notification resources route to an exact record", () => {
  for (const [resourceType, route] of Object.entries(MANAGEMENT_NOTIFICATION_ROUTES)) {
    const destination = getManagementNotificationDestination({
      metadata: { resourceType, relatedResourceId: "record 123" },
    });
    assert.equal(destination, `${route.page}?${route.idParam}=record+123`);
  }
});

test("legacy referenceId is used and unknown resources safely fall back", () => {
  assert.equal(
    getManagementNotificationDestination({ resourceType: "surrender_request", referenceId: "SR-10" }),
    "/pages/surrenders.html?id=SR-10"
  );
  assert.equal(getManagementNotificationDestination({ type: "unknown" }), "/pages/dashboard.html");
});
