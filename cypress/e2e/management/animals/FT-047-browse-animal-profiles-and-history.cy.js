const { disableCaching } = require("../../../support/animal-functionality");

describe("FT-047 - Browse Animal Profiles and History", () => {
  it("browses seeded lifecycle statuses and opens an animal history", () => {
    cy.intercept("GET", "**/api/protected").as("managementSession");
    cy.loginAdmin();
    cy.wait("@managementSession", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.intercept({ method: "GET", url: "**/api/animals", middleware: true }, disableCaching).as("animals");
    cy.visitManagementPage("/pages/animalProfiling.html");
    cy.wait("@animals", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const byId = new Map((response?.body?.animals || []).map((animal) => [animal.id, animal.status]));
      expect(byId.get("FT_ANIMAL_PROFILING")).to.equal("Profiling");
      expect(byId.get("FT_ANIMAL_QUARANTINE_EMPTY")).to.equal("Quarantine");
      expect(byId.get("FT_ANIMAL_READY_FINALIZE")).to.equal("Ready");
      expect(byId.get("FT_ANIMAL_ADOPTED")).to.equal("Adopted");
      expect(byId.get("FT_ANIMAL_ARCHIVED")).to.equal("Archived");
    });
    cy.get("body").should("not.have.class", "loading");
    cy.intercept(
      { method: "GET", url: "**/api/animals/FT_ANIMAL_HISTORY", middleware: true },
      disableCaching,
    ).as("animalHistory");
    cy.get("#searchAnimals").type("FT_ANIMAL_HISTORY");
    cy.get('.animal-record-card[data-id="FT_ANIMAL_HISTORY"]').should("be.visible").click();
    cy.wait("@animalHistory", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.location("search").should("contain", "FT_ANIMAL_HISTORY");
    cy.reload();
    cy.wait("@animalHistory", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("body", { timeout: 30000 }).should("not.have.class", "loading");
    cy.get('[data-tab="history"]', { timeout: 30000 }).click();
    cy.get("#historyTimeline").should("contain.text", "Intake recorded").and("contain.text", "Profile updated");
  });
});
