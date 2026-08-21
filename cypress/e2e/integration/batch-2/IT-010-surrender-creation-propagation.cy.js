const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const REASON = "I am relocating and cannot bring my dog to our new home.";

describe("IT-010 — Surrender Creation Propagation", () => {
  let generatedId = "";
  const context = useIntegrationBaseline({
    roles: ["Public", "Admin", "Staff"],
    verifyRestored({ tokens }) {
      if (!generatedId) return undefined;
      return apiRequest({ path: "surrenders", token: tokens.Admin }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body?.requests || []).not.to.deep.include.members([{ id: generatedId }]);
        expect((response.body?.requests || []).some(({ id }) => id === generatedId)).to.equal(false);
      });
    },
  });

  it("propagates one client submission through sentiment, persistence, notifications, and audit", () => {
    generatedId = `SR-${new Date().getUTCFullYear()}-${Date.now()}`;
    const payload = {
      id: generatedId,
      owner: {
        contact: "09170000000",
        address: "IT-010 Test Address",
        barangay: "Pampang",
        city: "Angeles City",
        identityDocuments: {
          front: { name: "it-010-front.png", type: "image/png", size: 68, dataUrl: IMAGE_DATA_URL },
          back: { name: "it-010-back.png", type: "image/png", size: 68, dataUrl: IMAGE_DATA_URL },
        },
      },
      pet: {
        name: "IT-010 Surrender Animal",
        species: "Dog",
        breed: "Mixed Breed",
        age: "Adult",
        sex: "Male",
        colorMarkings: "Black and white",
        status: [],
        vaccinationHistory: "Unknown",
      },
      surrenderReason: REASON,
      agreement: { agreedToTerms: true, agreementText: "IT-010 agreement" },
    };
    let created;
    let ledgerResult;
    let clientRequests;
    let adminNotification;
    let staffNotification;
    let audits;

    apiRequest({
      method: "POST",
      path: "surrenders",
      token: context.tokens.Public,
      body: payload,
    }).then((response) => {
      expect(response.status).to.equal(201);
      created = response.body?.request;
      return registerMutation({
        kind: "integrationSurrenderRequest",
        primaryId: generatedId,
      }).then((result) => { ledgerResult = result; });
    });

    apiRequest({ path: "surrenders/my-requests", token: context.tokens.Public }).then(
      (response) => { clientRequests = response.body?.requests || []; },
    );
    apiRequest({ path: "notifications", token: context.tokens.Admin }).then((response) => {
      adminNotification = (response.body?.notifications || []).find(
        ({ referenceId }) => referenceId === generatedId,
      );
    });
    apiRequest({ path: "notifications", token: context.tokens.Staff }).then((response) => {
      staffNotification = (response.body?.notifications || []).find(
        ({ referenceId }) => referenceId === generatedId,
      );
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      audits = logs.filter(
        (log) => log.rawAction === "surrender.created" && log.record === generatedId,
      );
    });

    cy.then(() => {
      expect(created).to.deep.include({
        id: generatedId,
        status: "Pending",
        source: "Public Form",
        surrenderReason: REASON,
      });
      expect(created.account?.email).to.equal(context.emails.Public);
      expect(created.owner).to.include({
        email: context.emails.Public,
        contact: payload.owner.contact,
        address: payload.owner.address,
        barangay: payload.owner.barangay,
        city: payload.owner.city,
      });
      expect(created.pet).to.include({
        name: payload.pet.name,
        species: payload.pet.species,
        breed: payload.pet.breed,
        sex: payload.pet.sex,
      });
      expect(created.nlp).to.include.all.keys(
        "sentiment", "category", "urgencyLabel", "urgencyScore", "source",
      );
      expect(created.nlp.source).not.to.contain("Node fallback");
      expect(clientRequests.filter(({ id }) => id === generatedId)).to.have.length(1);

      expect(adminNotification).to.deep.include({
        type: "surrender_request_created",
        referenceId: generatedId,
        category: "management",
      });
      expect(staffNotification).to.deep.include({
        type: "surrender_request_created",
        referenceId: generatedId,
        category: "management",
      });
      expect(
        ledgerResult.registeredPaths.filter((path) => path.startsWith("notifications/")),
      ).to.have.length(3);

      expect(audits).to.have.length(1);
      expect(audits[0]).to.include({
        module: "Surrender Management",
        status: "Success",
        record: generatedId,
      });
      expect(audits[0].after).to.deep.include({ id: generatedId, surrenderReason: REASON });
    });
  });
});
