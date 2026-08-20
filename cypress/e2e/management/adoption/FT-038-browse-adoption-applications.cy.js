describe("FT-038 - Browse Adoption Applications", () => {
  it("shows seeded adoption states and opens application details", () => {
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/adoptions", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("adoptions");

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_PENDING",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const applications = response?.body?.adoptions || [];
      [
        ["FT_ADOPTION_PENDING", "Pending"],
        ["FT_ADOPTION_APPROVE_CANDIDATE", "Pending"],
        ["FT_ADOPTION_REJECT_CANDIDATE", "Pending"],
        ["FT_ADOPTION_APPROVED", "Approved"],
        ["FT_ADOPTION_SCHEDULED", "Approved"],
        ["FT_ADOPTION_RESCHEDULE_PENDING", "Approved"],
        ["FT_ADOPTION_REJECTED", "Rejected"],
        ["FT_ADOPTION_EXPIRED", "Expired"],
        ["FT_ADOPTION_FINALIZE_BLOCKED", "Approved"],
        ["FT_ADOPTION_FINALIZE_ELIGIBLE", "Approved"],
      ].forEach(([id, status]) => {
        expect(applications.find((application) => application.id === id)).to.include({
          id,
          status,
        });
      });
    });

    cy.get("#aaDrawer").should("have.attr", "aria-hidden", "false");
    cy.get("#aaDrawerInner")
      .should("contain.text", "FT-APP-001")
      .and("contain.text", "Adoption Application Details")
      .and("contain.text", "FT Client Active")
      .and("contain.text", "Pending");
  });
});
