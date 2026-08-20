const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const APPROVAL_ID = "FT_ADOPTION_APPROVE_CANDIDATE";
const REJECTION_ID = "FT_ADOPTION_REJECT_CANDIDATE";
const UNRELATED_ID = "FT_ADOPTION_PENDING";
const REJECTION_REASON = "IT-014 controlled rejection after adoption review.";

describe("IT-014 — Adoption Decision Propagation", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "Public"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: `adoptions/${APPROVAL_ID}`, token: tokens.Admin })
        .then((response) => {
          expect(response.body?.adoption).to.include({ status: "Pending" });
          return apiRequest({ path: `adoptions/${REJECTION_ID}`, token: tokens.Admin });
        })
        .then((response) => {
          expect(response.body?.adoption).to.include({ status: "Pending", rejectedReason: "" });
          return apiRequest({ path: `adoptions/${UNRELATED_ID}`, token: tokens.Admin });
        })
        .then((response) => {
          expect(response.body?.adoption).to.include({ status: "Pending" });
        });
    },
  });

  it("propagates controlled approval and rejection to records, client notifications, and audits", () => {
    let unrelatedBefore;
    let unrelatedAfter;
    let approved;
    let rejected;
    let approvalNotification;
    let rejectionNotification;
    let approvalAudits;
    let rejectionAudits;

    apiRequest({ path: `adoptions/${UNRELATED_ID}`, token: context.tokens.Admin })
      .then((response) => { unrelatedBefore = response.body?.adoption; });

    apiRequest({
      method: "PATCH",
      path: `adoptions/${APPROVAL_ID}/approve`,
      token: context.tokens.Admin,
    }).then((response) => {
      expect(response.status).to.equal(200);
      return registerMutation({ kind: "adoptionDecision", primaryId: APPROVAL_ID });
    });
    apiRequest({
      method: "PATCH",
      path: `adoptions/${REJECTION_ID}/reject`,
      token: context.tokens.Admin,
      body: { reason: REJECTION_REASON },
    }).then((response) => {
      expect(response.status).to.equal(200);
      return registerMutation({ kind: "adoptionDecision", primaryId: REJECTION_ID });
    });

    apiRequest({ path: `adoptions/${APPROVAL_ID}`, token: context.tokens.Admin })
      .then((response) => { approved = response.body?.adoption; });
    apiRequest({ path: `adoptions/${REJECTION_ID}`, token: context.tokens.Admin })
      .then((response) => { rejected = response.body?.adoption; });
    apiRequest({ path: `adoptions/${UNRELATED_ID}`, token: context.tokens.Admin })
      .then((response) => { unrelatedAfter = response.body?.adoption; });
    apiRequest({ path: "notifications", token: context.tokens.Public }).then((response) => {
      const notifications = response.body?.notifications || [];
      approvalNotification = notifications.find(
        ({ referenceId, type }) => referenceId === APPROVAL_ID && type === "adoption_approved",
      );
      rejectionNotification = notifications.find(
        ({ referenceId, type }) => referenceId === REJECTION_ID && type === "adoption_rejected",
      );
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      approvalAudits = logs.filter(
        (log) => log.rawAction === "adoption.approved" && log.record === APPROVAL_ID,
      );
      rejectionAudits = logs.filter(
        (log) => log.rawAction === "adoption.rejected" && log.record === REJECTION_ID,
      );
    });

    cy.then(() => {
      expect(approved).to.include({
        id: APPROVAL_ID,
        status: "Approved",
        deadlineStatus: "Awaiting Appointment",
        deadlineReminderStage: "Approved",
        noShowRisk: false,
      });
      expect(approved.approvedAt).to.be.a("string").and.not.be.empty;
      expect(approved.attendanceDeadlineAt).to.be.a("string").and.not.be.empty;
      const approvedAt = new Date(approved.approvedAt);
      const deadlineAt = new Date(approved.attendanceDeadlineAt);
      const deadlineOffset = deadlineAt.getTime() - approvedAt.getTime();
      expect(deadlineOffset).to.be.at.least(14 * 24 * 60 * 60 * 1000);
      expect(deadlineOffset).to.be.below(15 * 24 * 60 * 60 * 1000);
      expect(deadlineAt.getHours()).to.equal(23);
      expect(deadlineAt.getMinutes()).to.equal(59);
      expect(deadlineAt.getSeconds()).to.equal(59);
      expect(approvalNotification).to.deep.include({
        category: "application",
        referenceId: APPROVAL_ID,
      });
      expect(approvalAudits).to.have.length(1);

      expect(rejected).to.include({
        id: REJECTION_ID,
        status: "Rejected",
        rejectedReason: REJECTION_REASON,
      });
      expect(rejectionNotification).to.deep.include({
        category: "application",
        referenceId: REJECTION_ID,
      });
      expect(rejectionAudits).to.have.length(1);
      expect(rejectionAudits[0].after).to.deep.include({ reason: REJECTION_REASON });
      expect(unrelatedAfter).to.deep.equal(unrelatedBefore);
    });
  });
});
