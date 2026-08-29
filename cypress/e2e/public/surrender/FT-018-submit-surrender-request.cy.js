describe("FT-018 — Submit Surrender Request", () => {
  it("submits one valid surrender request and shows its real initial status in My Submissions", () => {
    const clientEmail = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");
    let requestId;
    cy.loginClient();
    cy.intercept("POST", "**/api/surrenders").as("submitSurrender");
    cy.visitPublicPage("/pages/public/surrender.html");

    cy.fillValidSurrenderForm({
      petName: "FT-018 Surrender Animal",
      reason: "FT-018 deterministic surrender reason for formal functionality testing.",
    });
    cy.get("#agreeAllTerms").should("be.checked");
    cy.get("#submitSurrenderBtn").click();

    cy.wait("@submitSurrender", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.headers).not.to.have.property("authorization");
      expect(request.headers.origin).to.equal(Cypress.env("publicBaseUrl"));
      expect(request.body.owner).to.include({
        barangay: "Pampang",
        city: "Angeles City",
        isAngelesResident: true,
      });
      expect(request.body.owner.identityDocuments.front.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(request.body.owner.identityDocuments.back.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(request.body.pet.photoDataUrl).to.equal("");
      expect(request.body.agreement.agreedToTerms).to.equal(true);
      expect(response?.statusCode).to.equal(201);
      expect(response?.body?.message).to.equal("Surrender request submitted successfully.");
      expect(response?.body?.request?.status).to.equal("Pending");
      requestId = response?.body?.request?.id;
      expect(requestId).to.match(/^SR-2026-\d+$/);

      cy.task("registerFtGeneratedRecords", {
        kind: "surrenderRequest",
        primaryId: requestId,
      }).then(({ registeredPaths }) => {
        expect(registeredPaths).to.include(`surrenderRequests/${requestId}`);
      });
    });

    cy.get("#surrenderSuccessPanel").should("be.visible");
    cy.get("#submittedRequestId").should("not.exist");

    cy.intercept("GET", "**/api/adoptions/my-applications").as("myAdoptions");
    cy.intercept("GET", "**/api/surrenders/my-requests").as("mySurrenders");
    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.wait("@myAdoptions", { timeout: 30000 });
    cy.wait("@mySurrenders", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.be.oneOf([200, 304]);
      if (response?.statusCode === 200) {
        const created = (response?.body?.requests || []).find((item) => item.id === requestId);
        expect(created, "new surrender request").to.exist;
        expect(created.status).to.equal("Pending");
        expect(created.account?.email || created.owner?.email).to.equal(clientEmail);
      }
    });
    cy.then(() => {
      cy.get(`.submission-details-btn[data-submission-id="${requestId}"]`)
        .should("be.visible")
        .parents(".submission-card")
        .should("contain.text", "FT-018 Surrender Animal")
        .and("contain.text", "Received");
    });
  });
});
