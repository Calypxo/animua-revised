const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const APPROVAL_ID = "FT_SURRENDER_APPROVE_CANDIDATE";
const REJECTION_ID = "FT_SURRENDER_REJECT_CANDIDATE";
const UNRELATED_ID = "FT_SURRENDER_PENDING";
const REJECTION_REASON = "IT-011 controlled rejection after management review.";

function findRequest(response, id) {
  return (response.body?.requests || []).find((request) => request.id === id);
}

describe("IT-011 — Surrender Decision Propagation", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "Public"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: "surrenders", token: tokens.Admin }).then((response) => {
        expect(findRequest(response, APPROVAL_ID)).to.include({ status: "Pending" });
        expect(findRequest(response, REJECTION_ID)).to.include({
          status: "Pending",
          rejectedReason: null,
        });
        expect(findRequest(response, UNRELATED_ID)).to.include({ status: "Pending" });
      });
    },
  });

  it("propagates approval and rejection into their records, client notifications, and audits", () => {
    let unrelatedBefore;
    let approval;
    let rejection;
    let unrelatedAfter;
    let approvalNotification;
    let rejectionNotification;
    let approvalAudits;
    let rejectionAudits;

    apiRequest({ path: "surrenders", token: context.tokens.Admin }).then((response) => {
      unrelatedBefore = findRequest(response, UNRELATED_ID);
      expect(findRequest(response, APPROVAL_ID)).to.include({ status: "Pending" });
      expect(findRequest(response, REJECTION_ID)).to.include({ status: "Pending" });
    });

    apiRequest({
      method: "PATCH",
      path: `surrenders/${APPROVAL_ID}/status`,
      token: context.tokens.Admin,
      body: { status: "Approved", reviewNotes: "IT-011 controlled approval." },
    }).then((response) => {
      expect(response.status).to.equal(200);
      approval = response.body?.request;
      return registerMutation({ kind: "surrenderDecision", primaryId: APPROVAL_ID });
    });

    apiRequest({
      method: "PATCH",
      path: `surrenders/${REJECTION_ID}/status`,
      token: context.tokens.Admin,
      body: { status: "Rejected", rejectedReason: REJECTION_REASON },
    }).then((response) => {
      expect(response.status).to.equal(200);
      rejection = response.body?.request;
      return registerMutation({ kind: "surrenderDecision", primaryId: REJECTION_ID });
    });

    apiRequest({ path: "surrenders", token: context.tokens.Admin }).then((response) => {
      unrelatedAfter = findRequest(response, UNRELATED_ID);
    });
    apiRequest({ path: "notifications", token: context.tokens.Public }).then((response) => {
      const notifications = response.body?.notifications || [];
      approvalNotification = notifications.find(({ referenceId }) => referenceId === APPROVAL_ID);
      rejectionNotification = notifications.find(({ referenceId }) => referenceId === REJECTION_ID);
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      approvalAudits = logs.filter(
        (log) => log.rawAction === "surrender.approved" && log.record === APPROVAL_ID,
      );
      rejectionAudits = logs.filter(
        (log) => log.rawAction === "surrender.rejected" && log.record === REJECTION_ID,
      );
    });

    cy.then(() => {
      expect(approval).to.include({
        id: APPROVAL_ID,
        status: "Approved",
        reviewNotes: "IT-011 controlled approval.",
        deadlineStatus: "Awaiting Appointment",
        deadlineReminderStage: "Approved",
        noShowRisk: false,
      });
      expect(approval.reviewedAt).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(approval.approvedAt).to.be.a("string").and.not.be.empty;
      expect(approval.attendanceDeadlineAt).to.be.a("string").and.not.be.empty;
      expect(approvalNotification).to.deep.include({
        type: "surrender_approved",
        category: "surrender",
        referenceId: APPROVAL_ID,
      });
      expect(approvalAudits).to.have.length(1);
      expect(approvalAudits[0].after).to.deep.include({ status: "Approved" });

      expect(rejection).to.include({
        id: REJECTION_ID,
        status: "Rejected",
        rejectedReason: REJECTION_REASON,
      });
      expect(rejectionNotification).to.deep.include({
        type: "surrender_rejected",
        category: "surrender",
        referenceId: REJECTION_ID,
      });
      expect(rejectionAudits).to.have.length(1);
      expect(rejectionAudits[0].after).to.deep.include({
        status: "Rejected",
        rejectedReason: REJECTION_REASON,
      });

      expect(unrelatedAfter).to.deep.equal(unrelatedBefore);
    });
  });
});
