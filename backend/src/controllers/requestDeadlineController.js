const { admin, db } = require("../config/firebase");
const {
  WORKFLOWS,
  addDays,
  buildApprovalDeadlineFields,
  deadlineDate,
} = require("../services/requestDeadlineService");

function actor(req) {
  return req.user?.fullName || req.user?.email || "Management user";
}

function handler(type, action) {
  return async (req, res) => {
    try {
      const workflow = WORKFLOWS[type];
      const ref = db.collection(workflow.collection).doc(req.params.id);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        return res.status(404).json({ message: `${type === "adoption" ? "Adoption application" : "Surrender request"} not found.` });
      }

      const record = snapshot.data() || {};
      const now = new Date();
      let update = {};
      let message = "";

      if (action === "extend") {
        if (record.status !== "Approved") {
          return res.status(400).json({ message: "Only approved requests can have their attendance deadline extended." });
        }
        const extensionDays = Number(req.body?.extensionDays);
        const reason = String(req.body?.reason || "").trim();
        if (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 30) {
          return res.status(400).json({ message: "Extension must be between 1 and 30 days." });
        }
        if (!reason) return res.status(400).json({ message: "An extension reason is required." });
        const currentDeadline = deadlineDate(record);
        const base = currentDeadline > now ? currentDeadline : now;
        update = {
          attendanceDeadlineAt: addDays(base, extensionDays).toISOString(),
          deadlineStatus: record[workflow.scheduleField]?.date ? "Appointment Scheduled \u2014 Deadline Extended" : "Deadline Extended",
          deadlineReminderStage: "Extended",
          noShowRisk: false,
          deadlineExtensions: admin.firestore.FieldValue.arrayUnion({
            days: extensionDays,
            reason,
            previousDeadlineAt: currentDeadline.toISOString(),
            extendedAt: now.toISOString(),
            extendedBy: actor(req),
          }),
          updatedAt: now.toISOString(),
        };
        message = `Attendance deadline extended by ${extensionDays} day(s).`;
      }

      if (action === "arrival") {
        if (record.status !== "Approved") {
          return res.status(400).json({ message: "Only approved requests can confirm arrival." });
        }
        update = {
          arrivalConfirmedAt: now.toISOString(),
          arrivalConfirmedBy: actor(req),
          deadlineStatus: "Arrival Confirmed",
          deadlineReminderStage: "Completed",
          noShowRisk: false,
          updatedAt: now.toISOString(),
        };
        message = type === "adoption" ? "Adopter arrival confirmed." : "Surrender drop-off arrival confirmed.";
      }

      if (action === "no-show") {
        if (record.status !== "Approved") {
          return res.status(400).json({ message: "Only approved requests can be marked as a no-show." });
        }
        const reason = String(req.body?.reason || "Missed shelter appointment.").trim();
        update = {
          status: "Expired",
          deadlineStatus: "Expired \u2014 No Show",
          deadlineReminderStage: "Expired",
          noShowRisk: true,
          expiredAt: now.toISOString(),
          expirationReason: reason,
          expiredBy: actor(req),
          updatedAt: now.toISOString(),
        };
        message = "Request marked Expired \u2014 No Show.";
      }

      if (action === "restore") {
        if (record.status !== "Expired") {
          return res.status(400).json({ message: "Only expired requests can be restored." });
        }
        const reason = String(req.body?.reason || "").trim();
        if (!reason) return res.status(400).json({ message: "A restoration reason is required." });
        update = {
          status: "Approved",
          ...buildApprovalDeadlineFields(now),
          restoredAt: now.toISOString(),
          restoredBy: actor(req),
          restorationReason: reason,
          updatedAt: now.toISOString(),
        };
        message = "Request restored with a new 14-day attendance deadline.";
      }

      // Do not overwrite an application closed by a concurrent finalization.
      await ref.update(update, ...(snapshot.updateTime ? [{ lastUpdateTime: snapshot.updateTime }] : []));
      const updated = await ref.get();
      return res.json({ message, request: { id: updated.id, ...updated.data() } });
    } catch (error) {
      console.error(`[${type} deadline ${action}]`, error);
      return res.status(error.code === 9 ? 409 : 500).json({
        message: error.code === 9
          ? "This request changed. Refresh before updating its attendance workflow."
          : "Failed to update the attendance deadline workflow.",
      });
    }
  };
}

module.exports = {
  extendAdoptionDeadline: handler("adoption", "extend"),
  confirmAdoptionArrival: handler("adoption", "arrival"),
  markAdoptionNoShow: handler("adoption", "no-show"),
  restoreAdoptionDeadline: handler("adoption", "restore"),
  extendSurrenderDeadline: handler("surrender", "extend"),
  confirmSurrenderArrival: handler("surrender", "arrival"),
  markSurrenderNoShow: handler("surrender", "no-show"),
  restoreSurrenderDeadline: handler("surrender", "restore"),
};
