describe("FT-030 — Create and Edit User Accounts", () => {
  it("creates and edits the exact controlled management account through the real UI", () => {
    const email = Cypress.env("FT_REGISTRATION_ACCOUNT_EMAIL");
    const password = Cypress.env("FT_MANAGEMENT_PASSWORD");
    expect(email, "controlled generated account email").to.be.a("string").and.not.be.empty;
    expect(password, "management account password").to.be.a("string").and.not.be.empty;

    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/users", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("users");
    cy.intercept("POST", "**/api/users").as("createUser");
    cy.intercept("PUT", `**/api/users/${encodeURIComponent(email)}`).as("updateUser");
    cy.visitManagementPage("/pages/userManagement.html");
    cy.wait("@users", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("body").should("not.have.class", "loading");
    cy.get("#btnAddUser").should("be.visible").and("not.be.disabled").click();
    cy.get("#userModalBackdrop").should("have.class", "open");
    cy.get("#fFirstName").type("FT");
    cy.get("#fLastName").type("Batch Six User");
    cy.fillSensitiveInput("#fEmail", email);
    cy.get("#fRole").select("Staff");
    cy.get("#fStatus").select("Active");
    cy.fillSensitiveInput("#fPassword", password);
    cy.fillSensitiveInput("#fConfirmPassword", password);
    cy.get("#modalSaveBtn").click();

    cy.wait("@createUser", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.include({ email, role: "Staff", status: "Active" });
      expect(response?.statusCode).to.equal(201);
      expect(response?.body?.id).to.equal(email);
    });
    cy.wait("@users", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.task("registerFtGeneratedRecords", { kind: "userAccount" });

    cy.get("#searchUsers").clear().type(email);
    cy.get(`.user-record-card[data-id="${email}"]`)
      .should("contain.text", "FT Batch Six User")
      .and("contain.text", "Staff")
      .within(() => {
        cy.get(".user-menu-trigger").click();
        cy.get('[data-action="edit"]').click();
      });
    cy.get("#modalTitle").should("have.text", "Edit User");
    cy.get("#fLastName").clear().type("Batch Six User Edited");
    cy.get("#fRole").select("Veterinarian");
    cy.get("#modalSaveBtn").click();

    cy.wait("@updateUser", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.include({
        firstName: "FT",
        lastName: "Batch Six User Edited",
        role: "Veterinarian",
        status: "Active",
      });
      expect(response?.statusCode).to.equal(200);
    });
    cy.wait("@users", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.task("registerFtGeneratedRecords", { kind: "userAccount" }).then((result) => {
      expect(result.authPresent, "matching Firebase Auth identity created by User Management").to.equal(true);
    });

    cy.get("#searchUsers").clear().type(email);
    cy.get(`.user-record-card[data-id="${email}"]`)
      .should("contain.text", "FT Batch Six User Edited")
      .and("contain.text", "Veterinarian")
      .and("contain.text", "Active");
  });
});
