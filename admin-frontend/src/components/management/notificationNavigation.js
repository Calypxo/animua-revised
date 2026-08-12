export const MANAGEMENT_NOTIFICATION_ROUTES = Object.freeze({
  surrender_request: { page: "/pages/surrenders.html", idParam: "id" },
  adoption_application: { page: "/pages/adoptionApplications.html", idParam: "id" },
  intake_record: { page: "/pages/intakeList.html", idParam: "id" },
  contact_message: { page: "/pages/contactMessages.html", idParam: "id" },
  compatibility_result: { page: "/pages/compatibilityQuiz.html", idParam: "id" },
  inventory_item: { page: "/pages/inventory.html", idParam: "id" },
  animal_record: { page: "/pages/animalProfile.html", idParam: "id" },
});

export function getManagementNotificationDestination(notification = {}) {
  const resourceType = String(
    notification.metadata?.resourceType || notification.resourceType || ""
  ).trim();
  const relatedId = String(
    notification.metadata?.relatedResourceId ||
    notification.relatedResourceId ||
    notification.referenceId ||
    ""
  ).trim();
  const route = MANAGEMENT_NOTIFICATION_ROUTES[resourceType];
  if (!route) return "/pages/dashboard.html";
  const params = new URLSearchParams();
  if (relatedId) params.set(route.idParam, relatedId);
  const query = params.toString();
  return `${route.page}${query ? `?${query}` : ""}`;
}
