describe("FT-014 — Submit Adoption Application", () => {
  it("submits a complete application for a seeded Ready animal and shows it under My Submissions", () => {
    const clientEmail = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");
    let createdAdoptionId;

    cy.loginClient();

    cy.intercept("GET", "**/api/public/pets").as("publicPets");
    cy.intercept("POST", "**/api/adoptions").as("submitAdoption");

    cy.visitPublicPage("/pages/public/find-furbabies.html");

    cy.wait("@publicPets", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);

    // Open adoption form for the controlled Ready animal.
    cy.get('.adopt-btn[data-id="FT_ANIMAL_READY_DOG"]', {
      timeout: 30000,
    })
      .should("be.visible")
      .click();

    cy.get("#adoptModal")
      .should("have.class", "show")
      .and("be.visible");

    cy.get("#selectedPetId")
      .should("contain.text", "FT_ANIMAL_READY_DOG");

    cy.get("#fullName")
      .should("have.value", "Client Active")
      .and("have.attr", "readonly");

    // Step 1 — Applicant information.
    cy.get("#birthdatePickerBtn").click();
    cy.get("[data-calendar-year]").select("1996", { force: true });
    cy.get("[data-calendar-month]").select("0", { force: true });

    cy.get('.calendar-day[data-date="1996-01-01"]').click();

    cy.get("#birthdate")
      .should("have.value", "1996-01-01");

    cy.get(".birthdate-calendar")
      .should("not.be.visible");

    cy.get("#address")
      .type("FT Address, Angeles City");

    cy.get("#civilStatus")
      .select("Single", { force: true });

    cy.get("#gender")
      .select("Prefer not to say", { force: true });

    cy.get("#citizenship")
      .select("Filipino", { force: true });

    cy.get("#contactNumber")
      .type("09170000000");

    cy.get("#occupation")
      .type("Functionality Tester");

    cy.get("#adoptionNextBtn").click();

    // Step 2 — Housing and pet-care information.
    cy.get("#hasCurrentPets")
      .select("No", { force: true });

    cy.get("#visitVeterinarian")
      .select("Yes", { force: true });

    cy.get("#housingType")
      .select("Owned house", { force: true });

    cy.get("#residenceAllowsPets")
      .select("Yes", { force: true });

    cy.get("#adoptionNextBtn").click();

    // Step 3 — Adoption responsibility information.
    cy.get("#whyAdopt")
      .type("I can provide a safe and permanent home.");

    cy.get("#primaryCaregiver")
      .type("Applicant");

    cy.get("#petStayLocation")
      .type("Inside the family home");

    cy.get("#hoursAlone")
      .type("4");

    cy.get("#provideVetCare")
      .select("Yes", { force: true });

    cy.get("#provideDailyCare")
      .select("Yes", { force: true });

    cy.get("#cannotCarePlan")
      .type("Contact the shelter for responsible assistance.");

    cy.get("#adoptionNextBtn").click();

    // Step 4 — Review and declarations.
    cy.get("#adoptionReviewSummary")
      .should("contain.text", "FT_ANIMAL_READY_DOG")
      .and("contain.text", "Functionality Tester")
      .and("contain.text", "safe and permanent home");

    cy.contains(
      ".adoption-checkboxes label",
      "I confirm that the information I provided is complete and truthful.",
    ).click();

    cy.contains(
      ".adoption-checkboxes label",
      "I agree to the adoption declaration above.",
    ).click();

    cy.contains(
      ".adoption-checkboxes label",
      "I understand that submitting this application does not guarantee approval.",
    ).click();

    cy.get("#confirmTruthful")
      .should("be.checked");

    cy.get("#agreeDeclaration")
      .should("be.checked");

    cy.get("#understandNoGuarantee")
      .should("be.checked");

    cy.get("#adoptionSubmitBtn")
      .should("be.enabled")
      .click();

    // Verify the real backend submission.
    cy.wait("@submitAdoption", { timeout: 30000 }).then(
      ({ request, response }) => {
        expect(request.headers).not.to.have.property("authorization");
        expect(request.headers.origin).to.equal(Cypress.env("publicBaseUrl"));

        expect(request.body).to.include({
          pet_id: "FT_ANIMAL_READY_DOG",
          confirm_truthful: true,
          agree_declaration: true,
          understand_no_guarantee: true,
        });

        expect(response?.statusCode)
          .to.equal(201);

        expect(response?.body?.message)
          .to.equal("Adoption request submitted successfully.");

        createdAdoptionId = response?.body?.adoptionId;

        expect(createdAdoptionId)
          .to.be.a("string")
          .and.not.be.empty;

        // Register generated data for exact FT cleanup.
        cy.task("registerFtGeneratedRecords", {
          kind: "adoptionApplication",
          primaryId: createdAdoptionId,
        }).then(({ registeredPaths }) => {
          expect(registeredPaths)
            .to.include(`adoptions/${createdAdoptionId}`);
        });
      },
    );

    // Successful submission closes the adoption modal.
    // Do not require #formMessage to remain visible because it belongs
    // to the modal and becomes hidden when the modal closes.
    cy.get("#adoptModal")
      .should("not.have.class", "show")
      .and("not.be.visible");

    // Verify the newly created adoption through My Submissions.
    cy.intercept(
      "GET",
      "**/api/adoptions/my-applications",
    ).as("myAdoptions");

    cy.intercept(
      "GET",
      "**/api/surrenders/my-requests",
    ).as("mySurrenders");

    cy.visitPublicPage("/pages/public/my-submissions.html");

    cy.wait("@myAdoptions", { timeout: 30000 }).then(
      ({ response }) => {
        expect(response?.statusCode)
          .to.equal(200);

        const created = (response?.body?.adoptions || []).find(
          (adoption) => adoption.id === createdAdoptionId,
        );

        expect(created, "newly submitted adoption")
          .to.exist;

        expect(created.status)
          .to.equal("Pending");

        expect(created.pet_id)
          .to.equal("FT_ANIMAL_READY_DOG");

        expect(
          created.account?.email || created.applicant?.email,
        ).to.equal(clientEmail);
      },
    );

    cy.wait("@mySurrenders", { timeout: 30000 });

    cy.then(() => {
      cy.get(
        `.submission-details-btn[data-submission-id="${createdAdoptionId}"]`,
      )
        .should("be.visible")
        .parents(".submission-card")
        .should("contain.text", "FT_ANIMAL_READY_DOG")
        .and("contain.text", "Under Review");
    });
  });
});
