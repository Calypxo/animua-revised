// Exercise the real modal markup, action configuration, and shared styles
// without signing in or changing a shelter request.
describe("Surrender attendance modal fields", () => {
  beforeEach(() => {
    const sources = {};
    const files = {
      page: "admin-frontend/pages/surrenders.html",
      actions: "admin-frontend/src/management/surrenderRequests.js",
      modal: "admin-frontend/src/components/management/managementModal.js",
      pageStyles: "admin-frontend/src/css/surrenderRequests.css",
      modalStyles: "admin-frontend/src/css/managementModal.css",
    };
    Object.entries(files).forEach(([name, path]) => {
      cy.readFile(path).then((source) => { sources[name] = source; });
    });
    cy.then(() => {
      const markup = sources.page.split("<!-- ATTENDANCE WORKFLOW MODAL -->")[1].split("<!-- Toast -->")[0];
      const actions = sources.actions.slice(
        sources.actions.indexOf("const attendanceWorkflowConfig ="),
        sources.actions.indexOf("async function executeAttendanceWorkflow()"),
      );
      const modal = sources.modal.replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
      cy.intercept("GET", "**/__surrender-modal-test.html", {
        headers: { "content-type": "text/html" },
        body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${sources.pageStyles}</style><style>${sources.modalStyles}</style></head>
          <body class="surrender-requests-page management-consistent-ui">${markup}
          <script>
            const allRequests = [{ id: 'modal-test' }];
            let attendanceWorkflow;
            function openModal(id) { document.getElementById(id).classList.add('open'); }
            ${modal}
            ${actions}
            initializeManagementModals();
          </script></body></html>`,
      });
      cy.visit("/__surrender-modal-test.html");
    });
  });

  function openAction(action) {
    cy.window().invoke("openAttendanceWorkflow", "modal-test", action);
    cy.get("#workflowModalBackdrop").should("be.visible").and("have.class", "management-confirm-layer");
  }

  function expectFields(daysVisible, reasonVisible) {
    cy.get("#workflowDaysGroup").should(daysVisible ? "be.visible" : "not.be.visible");
    cy.get("#workflowReasonGroup").should(reasonVisible ? "be.visible" : "not.be.visible");
    cy.get("#workflowActionAlert").should("not.be.visible");
  }

  it("shows only confirmation content for arrival, including after extending a deadline", () => {
    openAction("arrival");
    expectFields(false, false);
    cy.get("#workflowConfirmBtn").should("be.visible").and("contain.text", "Confirm Arrival");

    openAction("deadline/extend");
    expectFields(true, true);
    cy.get("#workflowDays").should("have.value", "7");
    cy.get("#workflowReason").type("Client needs more time.");

    openAction("arrival");
    expectFields(false, false);
    cy.get("#workflowDaysGroup").should("have.css", "display", "none");
    cy.get("#workflowReasonGroup").should("have.css", "display", "none");
    cy.get("#workflowModalBackdrop").screenshot("surrender-arrival-desktop");
  });

  it("shows only the fields needed for no-show, restore, and reschedule decisions", () => {
    ["no-show", "deadline/restore", "reschedule/reject"].forEach((action) => {
      openAction(action);
      expectFields(false, true);
    });
    openAction("reschedule/approve");
    expectFields(false, false);
  });

  it("keeps arrival fields hidden and confirmation visible on mobile", () => {
    cy.viewport(390, 844);
    openAction("arrival");
    expectFields(false, false);
    cy.get("#workflowConfirmBtn").should("be.visible");
    cy.get("#workflowModalBackdrop").screenshot("surrender-arrival-mobile");
  });
});
