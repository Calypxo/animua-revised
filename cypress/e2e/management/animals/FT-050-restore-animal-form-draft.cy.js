const { loginAndOpenAnimal } = require("../../../support/animal-functionality");

describe("FT-050 - Restore Animal Form Draft", () => {
  it("restores a locally saved animal profile draft after reload and removes it afterward", () => {
    const key = "animua_animal_form_draft:FT_ANIMAL_PROFILE_EDIT:profile";
    loginAndOpenAnimal("FT_ANIMAL_PROFILE_EDIT");
    cy.get("#btnEditProfile").click();
    cy.get("#eName").clear().type("Batch 8 unsaved animal draft");
    cy.get("#eNotes").clear().type("Batch 8 draft must survive reload");
    cy.get("#editModalDraft").click();
    cy.get("#editDraftStatus").should("have.text", "Draft saved on this device");
    cy.window().then((window) => expect(window.localStorage.getItem(key)).to.be.a("string"));
    cy.reload();
    cy.get("body").should("not.have.class", "loading");
    cy.get("#btnEditProfile").click();
    cy.get("#editDraftStatus").should("have.text", "Local draft restored");
    cy.get("#eName").should("have.value", "Batch 8 unsaved animal draft");
    cy.get("#eNotes").should("have.value", "Batch 8 draft must survive reload");
    cy.window().then((window) => window.localStorage.removeItem(key));
    cy.get("#editModalCancel").click();
    cy.window().then((window) => expect(window.localStorage.getItem(key)).to.be.null);
  });
});
