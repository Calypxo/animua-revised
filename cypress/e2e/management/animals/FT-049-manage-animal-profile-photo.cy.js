const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

const PNG = Cypress.Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=", "base64");

describe("FT-049 - Manage Animal Profile Photo", () => {
  after(() => resetAndVerifyBaseline());
  it("uploads, changes, and removes the controlled animal photo", () => {
    let firstPath = "";
    loginAndOpenAnimal("FT_ANIMAL_PROFILE_EDIT");
    cy.intercept("PATCH", "**/api/animals/FT_ANIMAL_PROFILE_EDIT/photo").as("uploadPhoto");
    cy.intercept("DELETE", "**/api/animals/FT_ANIMAL_PROFILE_EDIT/photo").as("removePhoto");
    cy.get("#photoInput").selectFile({ contents: PNG, fileName: "ft-049-first.png", mimeType: "image/png" }, { force: true });
    cy.wait("@uploadPhoto", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalPhoto", primaryId: "FT_ANIMAL_PROFILE_EDIT" }).then((result) => {
      firstPath = result.storageObject.storagePath;
      expect(firstPath).to.match(/^animals\/FT_ANIMAL_PROFILE_EDIT\/profile-\d{13}\.png$/);
    });
    cy.get("#profilePhoto img").should("be.visible");
    cy.get("#photoInput").selectFile({ contents: PNG, fileName: "ft-049-replacement.png", mimeType: "image/png" }, { force: true });
    cy.wait("@uploadPhoto", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalPhoto", primaryId: "FT_ANIMAL_PROFILE_EDIT" }).then((result) => {
      expect(result.storageObject.storagePath).to.not.equal(firstPath);
      expect(result.registeredStoragePaths).to.deep.equal([result.storageObject.storagePath]);
    });
    cy.get("#btnRemovePhoto").should("be.visible").click();
    cy.wait("@removePhoto", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("#profilePhoto img").should("not.exist");
    cy.get("#btnRemovePhoto").should("not.be.visible");
    animalApi("FT_ANIMAL_PROFILE_EDIT").then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body?.animal?.photoURL || "").to.equal("");
    });
  });
});
