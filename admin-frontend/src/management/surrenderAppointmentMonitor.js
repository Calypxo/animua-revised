const DAY = 86400000;
const zone = "Asia/Manila";
const dateKey = value => new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(value);

function appointmentDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? date : null;
}

export function getAppointmentMonitor(record, now = new Date()) {
  const appointment = record.surrenderAppointment || {};
  const date = appointmentDate(appointment.date || record.dropoffDate);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(appointment.time || "") ? appointment.time : "";
  const scheduled = date ? `${date.toLocaleDateString("en-PH", { timeZone: zone, month: "short", day: "numeric", year: "numeric" })}${time ? `, ${time} PHT` : " (time not set)"}` : "Not scheduled";
  const deadline = record.attendanceDeadlineAt ? new Date(record.attendanceDeadlineAt) : null;
  const deadlineValid = deadline && Number.isFinite(deadline.getTime());
  const deadlineLabel = deadlineValid ? deadline.toLocaleString("en-PH", { timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " PHT" : "Not set";
  const result = { scheduled, deadlineLabel, state: "inactive", label: "Awaiting approval", tone: "neutral", detail: "", reschedulePending: false };
  if (record.arrivalConfirmedAt || record.status === "Converted") return { ...result, label: "Arrival confirmed" };
  if (record.status !== "Approved") return { ...result, label: record.status === "Expired" ? "Request expired" : record.status === "Rejected" ? "Request rejected" : result.label };
  result.reschedulePending = String(record.surrenderRescheduleRequest?.status || "").toLowerCase() === "pending";
  if (deadlineValid && now >= deadline) return { ...result, state: "overdue", tone: "danger", label: "Final deadline passed", detail: "The attendance window has ended without confirmed arrival. Review the request status before taking action." };
  if (!date) {
    const approved = record.reviewedAt ? new Date(record.reviewedAt) : null;
    const days = approved && Number.isFinite(approved.getTime()) ? Math.max(0, Math.floor((now - approved) / DAY)) : null;
    return { ...result, state: "unscheduled", tone: "warning", label: "Awaiting schedule", detail: days === null ? "Follow up with the owner." : `${days} day${days === 1 ? "" : "s"} since approval. Follow up with the owner.` };
  }
  const days = Math.round((appointmentDate(dateKey(now)) - date) / DAY);
  const appointmentAt = time ? new Date(`${appointment.date || record.dropoffDate}T${time}:00+08:00`) : null;
  if (days > 0 || (appointmentAt && now > appointmentAt)) return { ...result, state: "overdue", tone: "danger", label: "Appointment passed — confirm attendance", detail: `${days > 0 ? `${days} day${days === 1 ? "" : "s"} ago. ` : ""}Arrival is not confirmed. The final deadline is separate; contact the owner and review any reschedule request.` };
  if (days === 0) return { ...result, state: "today", tone: "warning", label: "Due today", detail: "Confirm arrival when the owner reaches the shelter." };
  return { ...result, state: "upcoming", tone: "neutral", label: "Scheduled", detail: `In ${-days} day${days === -1 ? "" : "s"}.` };
}
