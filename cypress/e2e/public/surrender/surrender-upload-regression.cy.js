// Use the actual public page with synthetic photos and mocked API responses.
// No account login or production surrender write is performed.
describe("Public surrender submission with phone photos", () => {
  beforeEach(() => {
    cy.intercept("**/api/**", (request) => {
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path.endsWith("/auth/account")) {
        return request.reply({ account: { fullName: "Upload Test Owner", email: "upload-test@example.com", role: "Public" } });
      }
      if (request.method === "GET" && path.endsWith("/surrenders/availability")) {
        return request.reply({ availability: { acceptingRequests: true } });
      }
      return request.reply({ requests: [], notifications: [], unreadCount: 0 });
    });
    cy.visit("/pages/public/surrender.html");
    cy.get("#surrenderForm").should("have.attr", "aria-disabled", "false");
  });

  function makePhoto(width, height, detail, alias) {
    cy.document().then((doc) => {
      const canvas = doc.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (detail) {
        const pixels = context.createImageData(width, height);
        let seed = 12345;
        for (let i = 0; i < pixels.data.length; i += 4) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          pixels.data[i] = seed & 255;
          pixels.data[i + 1] = (seed >>> 8) & 255;
          pixels.data[i + 2] = (seed >>> 16) & 255;
          pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
      } else {
        context.fillStyle = "#aecdda";
        context.fillRect(0, 0, width, height);
      }
      const contents = Cypress.Buffer.from(canvas.toDataURL("image/jpeg", 0.9).split(",")[1], "base64");
      canvas.width = canvas.height = 1;
      expect(contents.length).to.be.lessThan(5 * 1024 * 1024);
      return { contents, fileName: `${alias}.jpg`, mimeType: "image/jpeg", lastModified: 0 };
    }).as(alias);
  }

  function fillForm({ largePhonePhoto = false } = {}) {
    makePhoto(largePhonePhoto ? 8000 : 800, largePhonePhoto ? 6000 : 600, false, "frontPhoto");
    makePhoto(1600, 1200, true, "detailedPhoto");
    cy.get("#contactNo").type("09171234567");
    cy.get("#ownerAddress").type("Test Street, Pampang, Angeles City");
    cy.get("#ownerBarangay").select("Pampang", { force: true });
    cy.get("@frontPhoto").then((file) => cy.get("#identityIdFront").selectFile(file, { force: true }));
    cy.get("@detailedPhoto").then((file) => cy.get("#identityIdBack").selectFile(file, { force: true }));
    cy.get("#identityIdFrontPreview img", { timeout: 15000 }).should("exist");
    cy.get("#identityIdBackPreview img", { timeout: 15000 }).should("exist");
    cy.get('[data-next-step="2"]').click();
    cy.get("#petName").type("Upload Test Animal");
    cy.get("#species").select("Dog", { force: true });
    cy.get("#breed").type("Mixed breed");
    cy.get("#petAge").type("2 years");
    cy.get("#petSex").select("Male", { force: true });
    cy.get("#colorMarkings").type("Brown and white");
    cy.get('input[name="status"][value="Unknown"]').check({ force: true });
    cy.get("#vaccinationHistory").type("Unknown");
    cy.get("@detailedPhoto").then((file) => cy.get("#animalPhoto").selectFile(file, { force: true }));
    cy.get("#animalPhotoPreview img", { timeout: 15000 }).should("exist");
    cy.get('[data-next-step="3"]').click();
    cy.get("#reasons").type("Lilipat po kami at hindi maisama ang aso sa bagong tirahan.");
    cy.get('[data-next-step="4"]').click();
    cy.get("#agreeAllTerms").check({ force: true });
  }

  function mockSuccessfulSubmission() {
    cy.intercept("POST", "**/api/surrenders", (request) => {
      const photos = [request.body.owner.identityDocuments.front.dataUrl, request.body.owner.identityDocuments.back.dataUrl, request.body.pet.photoDataUrl];
      photos.forEach((photo) => {
        expect(Cypress.Buffer.from(photo.split(",")[1], "base64").length).to.be.at.most(220 * 1024);
      });
      expect(Cypress.Buffer.byteLength(JSON.stringify(request.body))).to.be.lessThan(950000);
      request.reply({ statusCode: 201, body: { request: { id: request.body.id, status: "Pending" } } });
    }).as("submit");
  }

  it("submits all four steps with a 48 MP phone photo and two detailed images", () => {
    fillForm({ largePhonePhoto: true });
    mockSuccessfulSubmission();
    cy.get("#submitSurrenderBtn").click();
    cy.wait("@submit");
    cy.get("#surrenderSuccessPanel").should("be.visible").and("contain.text", "Pending review");
  });

  it("preserves the mobile form after a server failure and allows a successful retry", () => {
    cy.viewport(390, 844);
    fillForm();
    cy.intercept("POST", "**/api/surrenders", { statusCode: 500, body: { message: "The shelter service is temporarily unavailable." } }).as("failedSubmit");
    cy.get("#submitSurrenderBtn").click();
    cy.wait("@failedSubmit");
    cy.get("#submitSurrenderBtn").should("be.enabled");
    cy.get("#petName").should("have.value", "Upload Test Animal");
    cy.get("#surrenderSuccessPanel").should("not.be.visible");
    mockSuccessfulSubmission();
    cy.get("#submitSurrenderBtn").click();
    cy.wait("@submit");
    cy.get("#surrenderSuccessPanel").should("be.visible");
  });
});
