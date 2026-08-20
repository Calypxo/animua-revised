describe("FT-010 — Browse and View Adoptable Animals", () => {
  it("shows only public adoption-ready animals and opens their public profile", () => {
    let firestoreRequestCount = 0;
    let publicPetsResponse;
    cy.intercept({ url: /firestore\.googleapis\.com/i }, () => {
      firestoreRequestCount += 1;
    });
    cy.intercept("GET", "**/api/public/pets", (request) => {
      request.continue((response) => {
        publicPetsResponse = response;
      });
    }).as("publicPets");

    cy.visitPublicPage("/pages/public/find-furbabies.html");
    cy.wait("@publicPets", { timeout: 30000 }).then((interception) => {
      expect(interception.request.method).to.equal("GET");
      expect(interception.request.url).to.match(/\/api\/public\/pets(?:\?|$)/);
    });
    cy.wrap(null, { log: false }).should(() => {
      expect(publicPetsResponse, "completed public pets API response").to.exist;
      expect(publicPetsResponse.statusCode).to.equal(200);
    });
    cy.then(() => {
      const pets = Array.isArray(publicPetsResponse.body)
        ? publicPetsResponse.body
        : publicPetsResponse.body?.pets;
      const ids = (pets || []).map((pet) => pet.id || pet.animalId);
      expect(ids).to.include("FT_ANIMAL_READY_DOG");
      expect(ids).to.include("FT_ANIMAL_READY_CAT");
      expect(ids).not.to.include("FT_ANIMAL_ARCHIVED");
      expect(ids).not.to.include("FT_ANIMAL_PROFILING");
    });

    cy.get('.view-profile-btn[data-id="FT_ANIMAL_READY_DOG"]', { timeout: 30000 })
      .should("be.visible")
      .click();
    cy.get("#petProfileModal").should("have.class", "show");
    cy.get("#profileName").should("contain.text", "FT_ANIMAL_READY_DOG");
    cy.get("#profileType").should("have.text", "Dog");
    cy.get("#profileStatus").should("have.text", "Ready");
    cy.get("#petsGrid").should("not.contain.text", "FT_ANIMAL_ARCHIVED");
    cy.get("#petsGrid").should("not.contain.text", "FT_ANIMAL_PROFILING");
    cy.then(() => expect(firestoreRequestCount, "direct Firestore requests").to.equal(0));
  });
});
