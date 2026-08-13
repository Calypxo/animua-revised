describe("FT-028 — View and Navigate Management Dashboard", () => {
  const TRACKED_FIELDS = [
    "status",
    "deadlineStatus",
    "deadlineReminderStage",
    "noShowRisk",
    "expiredAt",
    "expirationReason",
  ];

  function trackedState(items, ids) {
    return Object.fromEntries(
      items
        .filter((item) => ids.includes(item.id))
        .map((item) => [
          item.id,
          Object.fromEntries(TRACKED_FIELDS.map((field) => [field, item[field] ?? null])),
        ]),
    );
  }

  it("renders dashboard summaries, navigates, and preserves deadline state", () => {
    const adoptionIds = ["FT_ADOPTION_APPROVED", "FT_ADOPTION_EXPIRED"];
    const surrenderIds = ["FT_SURRENDER_APPROVED", "FT_SURRENDER_EXPIRED"];
    let beforeAdoptions;
    let beforeSurrenders;

    cy.intercept("GET", "**/api/dashboard/stats").as("dashboardStats");
    cy.loginAdmin();
    cy.wait("@dashboardStats", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("body").should("not.have.class", "loading");
    cy.get("#totalPetsCount").should("not.have.text", "");
    cy.get("#intakeCount").should("not.have.text", "");
    cy.get("#readyCount").should("not.have.text", "");
    cy.get("#sidebar").should("be.visible").and("contain.text", "Dashboard");
    cy.get("body").should("not.contain.text", "Dashboard unavailable");
    cy.get("body").should("not.contain.text", "Firebase error");

    cy.window().then((window) => {
      const token = window.localStorage.getItem("animua_token");
      const headers = { Authorization: `Bearer ${token}` };

      cy.request({ url: `${Cypress.env("apiBaseUrl")}/adoptions`, headers }).then(({ body }) => {
        beforeAdoptions = trackedState(body.adoptions || [], adoptionIds);
        expect(Object.keys(beforeAdoptions)).to.have.length(adoptionIds.length);
      });
      cy.request({ url: `${Cypress.env("apiBaseUrl")}/surrenders`, headers }).then(({ body }) => {
        beforeSurrenders = trackedState(body.requests || body.surrenders || [], surrenderIds);
        expect(Object.keys(beforeSurrenders)).to.have.length(surrenderIds.length);
      });
      cy.request({ url: `${Cypress.env("apiBaseUrl")}/dashboard/attention`, headers })
        .its("status")
        .should("eq", 200);
      cy.request({ url: `${Cypress.env("apiBaseUrl")}/adoptions`, headers }).then(({ body }) => {
        expect(trackedState(body.adoptions || [], adoptionIds)).to.deep.equal(beforeAdoptions);
      });
      cy.request({ url: `${Cypress.env("apiBaseUrl")}/surrenders`, headers }).then(({ body }) => {
        expect(trackedState(body.requests || body.surrenders || [], surrenderIds)).to.deep.equal(beforeSurrenders);
      });
    });

    cy.get('.system-header-action[href="/pages/intakeList.html"]')
      .should("be.visible")
      .click();
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/intakeList.html");
  });
});
