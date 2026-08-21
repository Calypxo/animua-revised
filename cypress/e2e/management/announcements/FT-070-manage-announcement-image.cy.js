const {
  inspectFtAnnouncementImage,
  loginAndOpenAnnouncements,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

const FIRST_IMAGE = "admin-frontend/public/images/announcements.jpg";
const REPLACEMENT_IMAGE = "admin-frontend/public/images/contact-messages.jpg";

describe("FT-070 - Manage Announcement Image", () => {
  after(() => resetAndVerifyBaseline());

  it("uploads and replaces the controlled announcement image through the UI", () => {
    let firstPath = "";
    let firstUrl = "";
    let firstFile;
    let replacementFile;
    cy.readFile(FIRST_IMAGE, null).then((buffer) => {
      firstFile = buffer;
      expect([...buffer.subarray(0, 3)]).to.deep.equal([0xff, 0xd8, 0xff]);
    });
    cy.readFile(REPLACEMENT_IMAGE, null).then((buffer) => {
      replacementFile = buffer;
      expect([...buffer.subarray(0, 3)]).to.deep.equal([0xff, 0xd8, 0xff]);
    });
    loginAndOpenAnnouncements();
    cy.intercept("PUT", "**/api/announcements/FT_ANNOUNCEMENT_DRAFT").as("saveDraftImageDetails");
    cy.intercept("PATCH", "**/api/announcements/FT_ANNOUNCEMENT_DRAFT/image").as("uploadDraftImage");
    cy.get("#searchAnnouncement").type("FT Draft Announcement");
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_DRAFT"] [data-edit-id]').click();
    cy.get("#fImageFile").selectFile(FIRST_IMAGE, { force: true });
    cy.get("#mediaPreviewStatus").should("contain.text", "ready to upload");
    cy.get('button[form="announcementForm"]').click();
    cy.wait(["@saveDraftImageDetails", "@uploadDraftImage"], { timeout: 30000 })
      .each(({ response }) => expect(response?.statusCode).to.equal(200));
    cy.then(() => registerMutation({
      kind: "announcementImage",
      primaryId: "FT_ANNOUNCEMENT_DRAFT",
      minimum: 2,
      expectedContentType: "image/jpeg",
    }))
      .then(({ storageObject, registeredStoragePaths, registeredPaths }) => {
        firstPath = storageObject.storagePath;
        expect(firstPath).to.match(/^announcements\/FT_ANNOUNCEMENT_DRAFT\/cover-\d{13}\.jpg$/);
        expect(registeredStoragePaths).to.deep.equal([firstPath]);
        expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(2);
        expect(storageObject.metadata).to.deep.include({
          name: firstPath,
          contentType: "image/jpeg",
          cacheControl: "private, max-age=1800",
        });
        expect(storageObject.metadata.size).to.equal(firstFile.length);
      });
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_DRAFT"] img.post-image')
      .should("be.visible")
      .and(($image) => {
        firstUrl = $image.attr("src");
        expect(firstUrl).to.match(/^https:\/\//);
        expect($image[0].naturalWidth).to.be.greaterThan(0);
      });
    cy.then(() => cy.request({ url: firstUrl, encoding: "binary", failOnStatusCode: false }))
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.headers["content-type"]).to.include("image/jpeg");
        expect(Cypress.Buffer.from(response.body, "binary").equals(firstFile)).to.equal(true);
      });

    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_DRAFT"] [data-edit-id]').click();
    cy.get("#fImageFile").selectFile(REPLACEMENT_IMAGE, { force: true });
    cy.get('button[form="announcementForm"]').click();
    cy.wait(["@saveDraftImageDetails", "@uploadDraftImage"], { timeout: 30000 })
      .each(({ response }) => expect(response?.statusCode).to.equal(200));
    cy.then(() => registerMutation({
      kind: "announcementImage",
      primaryId: "FT_ANNOUNCEMENT_DRAFT",
      minimum: 4,
      expectedContentType: "image/jpeg",
    }))
      .then(({ storageObject, registeredPaths }) => {
        expect(storageObject.storagePath).to.match(/^announcements\/FT_ANNOUNCEMENT_DRAFT\/cover-\d{13}\.jpg$/);
        expect(storageObject.storagePath).not.to.equal(firstPath);
        expect(storageObject.metadata.contentType).to.equal("image/jpeg");
        expect(storageObject.metadata.size).to.equal(replacementFile.length);
        expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(4);
        return inspectFtAnnouncementImage(firstPath);
      }).then((oldObject) => {
        expect(oldObject.exists, "replaced Storage object").to.equal(false);
      });
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_DRAFT"] img.post-image')
      .should("be.visible")
      .and(($image) => {
        expect($image.attr("src")).to.match(/^https:\/\//).and.not.equal(firstUrl);
        expect($image[0].naturalWidth).to.be.greaterThan(0);
      }).invoke("attr", "src").then((replacementUrl) => cy.request({
        url: replacementUrl,
        encoding: "binary",
        failOnStatusCode: false,
      })).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.headers["content-type"]).to.include("image/jpeg");
        expect(Cypress.Buffer.from(response.body, "binary").equals(replacementFile)).to.equal(true);
      });
  });
});
