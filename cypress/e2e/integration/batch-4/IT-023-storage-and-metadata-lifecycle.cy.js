const {
  apiRequest,
  inspectFtAnnouncementImage,
  registerMutation,
  uploadFtAnnouncementImage,
  useIntegrationBaseline,
} = require("../../../support/integration");

const ANNOUNCEMENT_ID = "FT_ANNOUNCEMENT_DRAFT";

function getControlledAnnouncement(token) {
  return apiRequest({ path: "announcements", token }).then((response) => {
    expect(response.status).to.equal(200);
    const announcement = (response.body?.announcements || [])
      .find(({ id }) => id === ANNOUNCEMENT_ID);
    expect(announcement, "controlled draft announcement").to.exist;
    return announcement;
  });
}

describe("IT-023 — Storage and Metadata Lifecycle", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin"],
    verifyRestored({ tokens }) {
      return inspectFtAnnouncementImage()
        .then((inspection) => {
          expect(inspection).to.deep.include({
            exists: false,
            storagePath: "",
            firestoreImagePath: "",
            firestoreImageUrl: "",
          });
          return getControlledAnnouncement(tokens.Admin);
        })
        .then((announcement) => {
          expect(announcement).to.include({
            id: ANNOUNCEMENT_ID,
            status: "Draft",
            visibleToPublic: false,
            imageUrl: "",
          });
        });
    },
  });

  it("keeps the owned Storage object and Firestore image metadata synchronized through replacement and deletion", () => {
    let firstPath;
    let replacementPath;
    let firstSignedUrl;
    let replacementSignedUrl;

    inspectFtAnnouncementImage().then((inspection) => {
      expect(inspection).to.deep.include({
        exists: false,
        firestoreImagePath: "",
        firestoreImageUrl: "",
      });
      return uploadFtAnnouncementImage(context.tokens.Admin, "first");
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body?.message).to.equal("Announcement image uploaded successfully.");
      expect(response.body?.imageUrl).to.be.a("string").and.match(/^https:\/\//);
      return registerMutation({ kind: "announcementImage", primaryId: ANNOUNCEMENT_ID });
    }).then((result) => {
      const inspection = result.storageObject;
      firstPath = inspection.storagePath;
      expect(result.registeredStoragePaths).to.deep.equal([firstPath]);
      expect(inspection).to.deep.include({
        exists: true,
        firestoreImagePath: firstPath,
        firestoreImageUrl: "",
      });
      expect(inspection.metadata).to.deep.include({
        name: firstPath,
        contentType: "image/png",
        cacheControl: "private, max-age=1800",
      });
      expect(inspection.metadata.size).to.be.greaterThan(0);
      return getControlledAnnouncement(context.tokens.Admin);
    }).then((announcement) => {
      firstSignedUrl = announcement.imageUrl;
      expect(firstSignedUrl).to.be.a("string").and.match(/^https:\/\//);
      return cy.request({ url: firstSignedUrl, encoding: "binary", failOnStatusCode: false });
    }).then((response) => {
      expect(response.status, "authorized signed read of first image").to.equal(200);
      expect(response.headers["content-type"]).to.include("image/png");
      expect(response.body).to.be.a("string").and.not.be.empty;
      return uploadFtAnnouncementImage(context.tokens.Admin, "replacement");
    }).then((response) => {
      expect(response.status).to.equal(200);
      return registerMutation({ kind: "announcementImage", primaryId: ANNOUNCEMENT_ID });
    }).then((result) => {
      replacementPath = result.storageObject.storagePath;
      expect(replacementPath).not.to.equal(firstPath);
      expect(result.storageObject.metadata).to.deep.include({
        name: replacementPath,
        contentType: "image/png",
        cacheControl: "private, max-age=1800",
      });
      return inspectFtAnnouncementImage(firstPath);
    }).then((oldObject) => {
      expect(oldObject.exists, "old object removed after replacement").to.equal(false);
      expect(oldObject.firestoreImagePath).to.equal(replacementPath);
      return getControlledAnnouncement(context.tokens.Admin);
    }).then((announcement) => {
      replacementSignedUrl = announcement.imageUrl;
      expect(replacementSignedUrl).to.be.a("string").and.match(/^https:\/\//);
      expect(replacementSignedUrl).not.to.equal(firstSignedUrl);
      return cy.request({ url: replacementSignedUrl, encoding: "binary", failOnStatusCode: false });
    }).then((response) => {
      expect(response.status, "authorized signed read of replacement image").to.equal(200);
      // This is a server-to-server API integration assertion. apiRequest uses
      // the Bearer token only and clears the login cookie, so CSRF protection is
      // neither bypassed nor accidentally invoked by mixed authentication.
      return apiRequest({
        method: "DELETE",
        path: `announcements/${ANNOUNCEMENT_ID}/image`,
        token: context.tokens.Admin,
      });
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal({ message: "Announcement image removed successfully." });
      return inspectFtAnnouncementImage(replacementPath);
    }).then((deletedObject) => {
      expect(deletedObject.exists, "current object removed after deletion").to.equal(false);
      expect(deletedObject.firestoreImagePath).to.equal("");
      expect(deletedObject.firestoreImageUrl).to.equal("");
      return getControlledAnnouncement(context.tokens.Admin);
    }).then((announcement) => {
      expect(announcement.imageUrl, "stale signed image metadata removed").to.equal("");
    });
  });
});
