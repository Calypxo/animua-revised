describe("FT-007 — Expired or Invalid Client Session Handling", () => {
  it("rejects an invalidated issued session and returns the client to login", () => {
    cy.intercept("GET", "**/api/notifications").as("initialNotifications");
    cy.loginClient();
    cy.wait("@initialNotifications", { timeout: 30000 })
      .its("response.statusCode")
      .should("be.oneOf", [200, 304]);
    cy.intercept("GET", "**/api/notifications").as("rejectedSessionRequest");

    cy.window().then((window) => {
      const issuedToken = window.localStorage.getItem("animua_token");
      expect(issuedToken, "session issued by the real login flow")
        .to.be.a("string")
        .and.not.be.empty;

      const segments = issuedToken.split(".");
      expect(segments, "issued JWT structure").to.have.length(3);

      // Corrupt the issued signature instead of constructing an identity or token.
      // The real backend must reject this client session through its JWT verifier.
      const firstSignatureCharacter = segments[2].charAt(0);
      segments[2] = `${firstSignatureCharacter === "A" ? "B" : "A"}${segments[2].slice(1)}`;
      window.localStorage.setItem("animua_token", segments.join("."));
    });

    cy.get("#notificationBtn").click();
    cy.wait("@rejectedSessionRequest", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(401);
      expect(response?.body?.message).to.equal(
        "Invalid or tampered token. Access denied.",
      );
    });

    cy.get(".swal2-title", { timeout: 10000 }).should(
      "have.text",
      "Please Log In Again",
    );
    cy.window().then((window) => {
      expect(window.localStorage.getItem("animua_token")).to.be.null;
      expect(window.localStorage.getItem("is_logged_in")).to.be.null;
    });
    cy.get("#loginNavBtn").should("be.visible");
    cy.get("#userLoggedInBox").should("not.be.visible");
    cy.get(".swal2-confirm").click();
    cy.get("#authModal").should("not.have.class", "hidden");
  });
});
