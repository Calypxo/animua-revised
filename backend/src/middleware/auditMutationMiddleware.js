const { writeAuditEvent } = require("../services/auditLogService");

const MODULES = {
  adoptions: "Adoption Management",
  announcements: "Announcements",
  surrenders: "Surrender Management",
  notifications: "Notifications",
  auth: "Authentication",
};

function pathSegments(req) {
  return String(req.originalUrl || req.url || "").split("?")[0].split("/").filter(Boolean);
}

function actionFor(resource, segments, method) {
  const path = segments.join("/");
  const actionMatchers = [
    [/reschedule\/approve$/, "reschedule_approved"],
    [/reschedule\/reject$/, "reschedule_rejected"],
    [/deadline\/extend$/, "deadline_extended"],
    [/deadline\/restore$/, "deadline_restored"],
    [/pickup-schedule$|appointment$/, "scheduled"],
    [/availability$/, "availability_updated"],
    [/arrival$/, "arrival_confirmed"],
    [/no-show$/, "no_show_recorded"],
    [/finalize$/, "finalized"],
    [/approve$/, "approved"],
    [/reject$/, "rejected"],
    [/follow-up$/, "follow_up_added"],
    [/reply$/, "replied"],
    [/\/image$/, method === "DELETE" ? "image_removed" : "image_updated"],
    [/\/read$/, "marked_read"],
    [/profile$|update-username$/, "profile_updated"],
  ];
  const match = actionMatchers.find(([pattern]) => pattern.test(path));
  if (match) return `${resource}.${match[1]}`;
  const verb = method === "POST" ? "created" : method === "DELETE" ? "deleted" : "updated";
  return `${resource}.${verb}`;
}

function describeMutation(req) {
  const segments = pathSegments(req);
  const apiIndex = segments.indexOf("api");
  const resource = segments[apiIndex + 1] || "system";
  if (resource === "public" && segments[apiIndex + 2] === "contact") {
    const targetId = segments[apiIndex + 3] || req.body?.id || "contact-message";
    return {
      module: "Contact Messages",
      action: actionFor("contact", segments, req.method),
      targetId,
    };
  }
  if (resource === "surrenders" && segments.at(-1) === "status" && req.body?.status) {
    const statusAction = String(req.body.status).trim().toLowerCase().replace(/\s+/g, "_");
    return {
      module: MODULES[resource],
      action: `surrender.${statusAction}`,
      targetId: segments[apiIndex + 2] || req.body?.id || "surrender-request",
    };
  }
  const targetCandidate = segments[apiIndex + 2];
  const targetId = targetCandidate && !["my-applications", "my-requests", "availability", "account", "read"].includes(targetCandidate)
    ? targetCandidate
    : req.body?.id || req.body?.applicationId || req.user?.email || resource;
  return {
    module: MODULES[resource] || "System",
    action: actionFor(resource.replace(/s$/, ""), segments, req.method),
    targetId,
  };
}

function shouldSkip(req) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;
  const path = String(req.originalUrl || "").split("?")[0];
  if (/^\/api\/(audit|auth|intake|animals|users)(\/|$)/.test(path)) return true;
  if (/^\/api\/match\/admin(\/|$)/.test(path)) return true;
  return false;
}

function auditMutationMiddleware(req, res, next) {
  if (shouldSkip(req)) return next();

  res.once("finish", () => {
    if (!req.user) return;
    const event = describeMutation(req);
    if (event.module === "System") return;
    const targetName = req.body?.title || req.body?.name || req.body?.fullName || event.targetId;
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    writeAuditEvent({
      ...event,
      targetName,
      user: req.user,
      after: req.body || {},
      status: res.statusCode < 400 ? "Success" : "Failed",
      details: `${req.method} ${String(req.originalUrl || req.url).split("?")[0]} completed with status ${res.statusCode}.`,
      ipAddress: forwarded || req.ip || req.socket?.remoteAddress || "Not recorded",
    }).catch((error) => console.warn("[auditMutation]", error.message));
  });

  return next();
}

module.exports = auditMutationMiddleware;
