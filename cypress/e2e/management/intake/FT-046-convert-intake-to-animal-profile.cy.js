const {
  apiRequest,
  resetAndVerifyBaseline,
} = require("../../../support/integration");

describe("FT-046 - Convert Intake to Animal Profile", () => {
  after(() => resetAndVerifyBaseline());

  it("converts the controlled approved intake through the explicit UI action", () => {
    let animalProfileId = "";
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/intake", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("intake");
    cy.intercept(
      "POST",
      "**/api/intake/FT_INTAKE_CONVERT_CANDIDATE/convert",
    ).as("convertIntake");

    cy.visitManagementPage("/pages/intakeList.html");
    cy.wait("@intake", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.records?.find(
        ({ id }) => id === "FT_INTAKE_CONVERT_CANDIDATE",
      );
      expect(candidate).to.include({ status: "Approved", animalProfileId: null });
    });
    cy.get("#searchIntake").type("FT_INTAKE_CONVERT_CANDIDATE");
    cy.get('tr[data-id="FT_INTAKE_CONVERT_CANDIDATE"]').click();
    cy.get("#vBtnConvert").should("be.visible").and("be.enabled").click();
    cy.get("#confirmTitle").should("have.text", "Start Profiling");
    cy.get("#confirmAction").click();
    cy.wait("@convertIntake", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(response?.body?.intakeId).to.equal("FT_INTAKE_CONVERT_CANDIDATE");
      animalProfileId = response?.body?.animalProfileId || "";
      expect(animalProfileId).to.match(/^ANIM-\d{4}-\d{3,}$/);
      cy.task("registerFtGeneratedRecords", {
        kind: "intakeConversion",
        primaryId: "FT_INTAKE_CONVERT_CANDIDATE",
      }).then((result) => {
        expect(result.animalProfileId).to.equal(animalProfileId);
        expect(result.registeredPaths).to.include(`animals/${animalProfileId}`);
        expect(result.registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(1);
        expect(result.registeredPaths.some((path) => path.startsWith("notifications/"))).to.equal(false);
      });
    });
    cy.location("pathname", { timeout: 30000 }).should(
      "eq",
      "/pages/animalProfile.html",
    );
    cy.getCookie("animua_session").then((cookie) => {
      const token = cookie?.value;
      return apiRequest({
        path: "intake/FT_INTAKE_CONVERT_CANDIDATE",
        token,
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body?.record).to.include({
          status: "Converted",
          animalProfileId,
        });
        return apiRequest({ path: `animals/${animalProfileId}`, token });
      });
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body?.animal).to.include({
        id: animalProfileId,
        intakeId: "FT_INTAKE_CONVERT_CANDIDATE",
        status: "Profiling",
        currentStage: "profiling",
      });
    });
  });
});
