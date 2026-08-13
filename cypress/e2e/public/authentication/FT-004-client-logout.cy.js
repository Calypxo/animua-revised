describe("FT-004 — Client Logout and Session Removal", () => {
  it("logs out through the public UI and does not restore the old session", () => {
    cy.loginClient();

    cy.window().its("localStorage").invoke("getItem", "animua_token").should("not.be.null");
    cy.logoutClient();

    cy.get("#loginNavBtn").should("be.visible");
    cy.get("#userLoggedInBox").should("not.be.visible");
    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.get("#loginNavBtn").should("be.visible");
    cy.get("#userLoggedInBox").should("not.be.visible");
    cy.get("#submissionsList").should("contain.text", "No all submissions yet");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("animua_token")).to.be.null;
      expect(window.localStorage.getItem("is_logged_in")).to.be.null;
    });
  });
});
