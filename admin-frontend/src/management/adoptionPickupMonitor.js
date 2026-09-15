import { getAppointmentMonitor } from "./surrenderAppointmentMonitor.js";

// Share the shelter-time deadline calculations while keeping each workflow's
// schedule fields and completion states separate.
export function getPickupMonitor(application, now = new Date()) {
  const monitor = getAppointmentMonitor({
    status: application.status === "Finalized" ? "Converted" : application.status,
    reviewedAt: application.approvedAt,
    surrenderAppointment: application.pickupSchedule,
    surrenderRescheduleRequest: application.pickupRescheduleRequest,
    attendanceDeadlineAt: application.attendanceDeadlineAt,
    arrivalConfirmedAt: application.arrivalConfirmedAt,
  }, now);
  return {
    ...monitor,
    label: application.status === "Closed" ? "Application closed" : monitor.label.replace("Request expired", "Application expired").replace("Appointment passed", "Pickup time passed"),
    detail: monitor.detail.replaceAll("owner", "adopter").replace("review any reschedule request", "check whether the adopter has used their one reschedule"),
  };
}
