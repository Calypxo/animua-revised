const surrender = require("../src/services/surrenderWorkflowService");
const deadlines = require("../src/services/requestDeadlineService");
const intake = require("../src/services/intakeWorkflowService");

describe("UT-015 — Surrender Workflow Transitions", () => {
  it.each([[1,"Pending",true],[2,"Approved",true],[3,"Converted",false]])("Scenario %i — direct status rule for %s", (_n, status, expected) => expect(surrender.isDirectSurrenderStatusAllowed(status)).toBe(expected));
  it("Scenario 4 — requires confirmed arrival", () => expect(surrender.getSurrenderConversionError({ status: "Approved" })).toMatch(/confirm.*arrived/i));
  it("Scenario 5 — permits an approved request after confirmed arrival", () => expect(surrender.getSurrenderConversionError({ status: "Approved", arrivalConfirmedAt: "2026-08-10T02:00:00Z" })).toBe(""));
});

describe("UT-016 — Attendance Deadline Lifecycle", () => {
  it("Scenario 1 — creates the Manila close-of-day deadline", () => {
    expect(process.env.TZ).toBe("Asia/Manila");
    expect(deadlines.buildApprovalDeadlineFields(new Date("2026-08-01T08:30:00Z")).attendanceDeadlineAt).toBe("2026-08-15T15:59:59.999Z");
  });
  it("Scenario 2 — accepts today/deadline and rejects past/deadline-plus-one", () => {
    const record = deadlines.buildApprovalDeadlineFields(new Date("2026-08-01T08:30:00Z")); const now = new Date("2026-08-03T01:00:00Z");
    expect(deadlines.validateScheduleDate(record,"2026-08-03",now)).toBe(true); expect(deadlines.validateScheduleDate(record,"2026-08-15",now)).toBe(true); expect(deadlines.validateScheduleDate(record,"2026-08-02",now)).toBe(false); expect(deadlines.validateScheduleDate(record,"2026-08-16",now)).toBe(false);
  });
  it("Scenario 3 — creates the day-seven appointment warning", () => {
    const r=deadlines.buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00Z")); expect(deadlines.lifecycleUpdate(r,deadlines.WORKFLOWS.adoption,new Date("2026-08-08T00:05:00Z"))).toMatchObject({deadlineStatus:"Appointment Required",deadlineReminderStage:"Day 7",noShowRisk:true});
  });
  it("Scenario 4 — marks a past appointment as no-show risk", () => {
    const r={...deadlines.buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00Z")),pickupSchedule:{date:"2026-08-05"}}; expect(deadlines.lifecycleUpdate(r,deadlines.WORKFLOWS.adoption,new Date("2026-08-06T01:00:00Z"))).toMatchObject({deadlineStatus:"Missed Appointment — No Show Risk",noShowRisk:true});
  });
  it("Scenario 5 — expires an unconfirmed request but ignores a confirmed arrival", () => {
    const r=deadlines.buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00Z")); expect(deadlines.lifecycleUpdate(r,deadlines.WORKFLOWS.surrender,new Date("2026-08-16T00:00:00Z"))).toMatchObject({status:"Expired",deadlineStatus:"Expired — No Show"}); expect(deadlines.lifecycleUpdate({...r,arrivalConfirmedAt:"2026-08-05T02:00:00Z"},deadlines.WORKFLOWS.surrender,new Date("2026-08-20T00:00:00Z"))).toEqual({});
  });
});

describe("UT-019 — Intake Workflow State Rules", () => {
  it.each([[1,"Pending",true],[2,"Approved",true],[3,"Converted",false]])("Scenario %i — advancement rule for %s", (_n,status,expected)=>expect(intake.canAdvanceIntakeToProfiling(status)).toBe(expected));
  it("Scenario 4 — auto-advances a Pending Approved Surrender",()=>expect(intake.shouldAutoAdvanceIntake({source:"Approved Surrender",status:"Pending"})).toBe(true));
  it("Scenario 5 — does not auto-advance a Pending Rescue",()=>expect(intake.shouldAutoAdvanceIntake({source:"Rescue",status:"Pending"})).toBe(false));
});
