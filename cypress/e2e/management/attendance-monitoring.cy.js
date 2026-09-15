// Real page renderers and styles with in-memory records. No shelter data writes.
const stripModule = source => source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/export /g, "").replace('window.addEventListener("DOMContentLoaded", init);', "");

function mountWorkflow(kind, status = "Approved") {
  const surrender = kind === "surrender";
  const page = surrender ? "surrenders" : "adoptionApplications";
  const script = surrender ? "surrenderRequests" : "adoptionApps";
  const sources = {};
  const files = {
    page: `admin-frontend/pages/${page}.html`,
    script: `admin-frontend/src/management/${script}.js`,
    monitor: "admin-frontend/src/management/surrenderAppointmentMonitor.js",
    pickup: "admin-frontend/src/management/adoptionPickupMonitor.js",
    disclosure: "admin-frontend/src/components/management/moreActions.js",
    refresh: "admin-frontend/src/components/management/refreshDrawer.js",
    modalStyles: "admin-frontend/src/css/managementModal.css",
    base: "admin-frontend/src/css/adminDashboard.css",
    style: `admin-frontend/src/css/${script}.css`,
    tables: "admin-frontend/src/css/managementTables.css",
    queue: "admin-frontend/src/css/reviewQueueRecords.css",
    reference: "admin-frontend/src/css/recordsPanelReference.css",
    responsive: "admin-frontend/src/css/managementResponsive.css",
  };
  Object.entries(files).forEach(([key, path]) => cy.readFile(path).then(source => { sources[key] = source; }));
  cy.then(() => {
    const record = {
      id: "TEST-APPOINTMENT", applicationId: "TEST-APPOINTMENT", status,
      submittedAt: "2026-09-14T00:00:00Z", approvedAt: "2026-09-14T00:00:00Z", reviewedAt: "2026-09-14T00:00:00Z",
      attendanceDeadlineAt: "2026-09-28T15:59:59Z", deadlineStatus: "Appointment Scheduled",
      surrenderAppointment: { date: "2026-09-15", time: "09:00" }, pickupSchedule: { date: "2026-09-15", time: "09:00" },
      owner: { name: "Test Owner", email: "owner@example.test", contact: "09000000000", barangay: "Test", identityDocuments: {} },
      applicant: { full_name: "Test Adopter", email: "adopter@example.test", contact_number: "09000000000" },
      pet: { name: "Test animal", species: "Dog", breed: "Aspin", sex: "Female", status: [] },
      animal: { id: "TEST-ANIMAL", name: "Test animal", species: "Dog", breed: "Aspin", status: "Ready" },
      nlp: { category: "Other", urgencyLabel: "Low", urgencyScore: 20, keywords: [] },
      surrenderReason: "Test surrender reason", agreement: {}, documents: [], source: "Public Form",
    };
    const code = `
      const PAGE_HEADER_CONFIGS = {}; const API_BASE_URL = '/api';
      const renderPageHeader = () => {}; const hasPermission = () => true;
      const installManagementImageFallbacks = () => {}; const optimizedManagementImageUrl = value => value;
      const compareSurrenderUrgency = () => 0;
      let serverRecord = ${JSON.stringify(record)};
      window.fetch = async () => ({ ok: true, json: async () => ({ requests: [serverRecord] }) });
      const getAllAdoptions = async () => ({ adoptions: [serverRecord] });
      ${stripModule(sources.monitor)}
      ${stripModule(sources.pickup)}
      ${stripModule(sources.disclosure)}
      ${stripModule(sources.refresh)}
      ${stripModule(sources.script)}
      currentRole = 'Admin';
      window.showRecord = async () => {
        ${surrender ? "allRequests = await getPublicSubmittedRequests(); applyFilters(); activeId = allRequests[0].id; renderDrawer(allRequests[0]); document.getElementById('srLayout').classList.add('drawer-open'); document.getElementById('srDrawer').setAttribute('aria-hidden', 'false');" : "adoptionApps = [mapAdoptionFromBackend(serverRecord)]; applyFilters(); openDrawer(adoptionApps[0].id);"}
        document.body.classList.add('management-drawer-open');
      };
      window.refreshRecord = async changes => { Object.assign(serverRecord, changes); await ${surrender ? "refreshAppointments" : "refreshPickups"}(); };
      window.showRecord();
    `;
    const markup = sources.page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<link\b[^>]*>/gi, "").replace('class="loading ', 'class="management-consistent-ui ');
    const css = ["base", "style", "tables", "queue", "reference", "modalStyles", "responsive"].map(key => sources[key]).join("\n");
    cy.intercept("GET", "**/__attendance-ui.html", { headers: { "content-type": "text/html" }, body: markup.replace("</head>", `<style>${css}</style></head>`).replace("</body>", `<script>${code}</script></body>`) });
    cy.visit("/__attendance-ui.html");
  });
}

for (const kind of ["surrender", "adoption"]) {
  describe(`${kind} attendance controls`, () => {
    beforeEach(() => { cy.viewport(1440, 1000); cy.clock(new Date("2026-09-15T10:00:00+08:00").getTime(), ["Date"]); });

    it("exposes no-show on desktop and through a disclosure on phones", () => {
      mountWorkflow(kind);
      cy.get("#drawerNoShowBtn").should("be.visible");
      cy.get("#drawerExtendDeadlineBtn").should("be.visible");
      cy.get(".management-more-actions").should("have.attr", "open");
      cy.get(kind === "surrender" ? "#srDrawer" : "#aaDrawer").screenshot(`${kind}-actions-desktop`);
      cy.viewport(390, 844);
      cy.get(".management-more-actions").should("not.have.attr", "open");
      cy.get(".management-more-actions > summary").should("be.visible").click();
      cy.get("#drawerNoShowBtn").should("be.visible");
      cy.get(kind === "surrender" ? "#srDrawer" : "#aaDrawer").screenshot(`${kind}-actions-mobile`);
      cy.viewport(1440, 1000);
      cy.get("#drawerNoShowBtn").should("be.visible");
    });

    it("keeps the queue note compact and full details inside the modal", () => {
      mountWorkflow(kind);
      const prefix = kind === "surrender" ? "appointment" : "pickup";
      cy.get(`.${prefix}-table-note`).should("contain.text", kind === "surrender" ? "Appointment passed" : "Pickup time passed");
      cy.get(`.${prefix}-table-note`).should("not.contain.text", "deadline:");
      cy.get(kind === "surrender" ? "#drawerAppointmentMonitor" : "#drawerPickupMonitor").should("contain.text", "Final attendance deadline:").and("contain.text", "confirm attendance");
    });

    it("updates an open modal after the client's schedule changes", () => {
      mountWorkflow(kind);
      const scheduleField = kind === "surrender" ? "surrenderAppointment" : "pickupSchedule";
      cy.window().invoke("refreshRecord", { [scheduleField]: { date: "2026-09-20", time: "13:00" } });
      cy.get(kind === "surrender" ? "#drawerAppointmentMonitor" : "#drawerPickupMonitor").should("contain.text", "Sep 20").and("contain.text", "Scheduled");
      cy.get(kind === "surrender" ? "#srDrawerInner" : "#aaDrawerInner").find(".drawer-info-val").filter(':contains("Sep 15")').should("not.exist");
    });

    it("removes no-show and unlocks the next step after confirmed arrival", () => {
      mountWorkflow(kind);
      cy.window().invoke("refreshRecord", { arrivalConfirmedAt: "2026-09-15T02:00:00Z" });
      cy.get("#drawerNoShowBtn").should("not.exist");
      cy.get(kind === "surrender" ? "#drawerConvertBtn" : "#drawerFinalizeBtn").should("be.visible");
    });
  });
}
