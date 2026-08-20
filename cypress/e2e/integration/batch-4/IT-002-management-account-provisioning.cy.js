const {
  apiRequest,
  firebasePasswordSignIn,
  getAuditLogs,
  registerMutation,
  requiredEnvironmentValue,
  useIntegrationBaseline,
} = require("../../../support/integration");

const GENERATED_FIRST_NAME = "FT";
const GENERATED_LAST_NAME = "Batch Six User";
const GENERATED_ROLE = "Staff";
const GENERATED_STATUS = "Active";

describe("IT-002 — Management Account Provisioning", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin"],
    verifyRestored({ tokens }) {
      const email = requiredEnvironmentValue("FT_REGISTRATION_ACCOUNT_EMAIL");
      const password = requiredEnvironmentValue("FT_MANAGEMENT_PASSWORD");
      return apiRequest({ path: `users/${encodeURIComponent(email)}`, token: tokens.Admin })
        .then((response) => {
          expect(response.status, "generated Firestore user removed").to.equal(404);
          return firebasePasswordSignIn(email, password);
        })
        .then((response) => {
          expect(response.status, "generated Firebase Auth identity removed").to.equal(400);
          expect(response.body).not.to.have.property("idToken");
        });
    },
  });

  it("creates one synchronized management identity and rejects duplicate provisioning", () => {
    const email = requiredEnvironmentValue("FT_REGISTRATION_ACCOUNT_EMAIL");
    const password = requiredEnvironmentValue("FT_MANAGEMENT_PASSWORD");
    const payload = {
      firstName: GENERATED_FIRST_NAME,
      lastName: GENERATED_LAST_NAME,
      email,
      password,
      role: GENERATED_ROLE,
      status: GENERATED_STATUS,
    };
    let createdUser;
    let listedUsers;
    let firebaseIdentity;
    let ledgerResult;
    let creationAudits;

    apiRequest({ path: `users/${encodeURIComponent(email)}`, token: context.tokens.Admin })
      .then((response) => {
        expect(response.status, "controlled identity starts unused").to.equal(404);
        return apiRequest({
          method: "POST",
          path: "users",
          token: context.tokens.Admin,
          body: payload,
        });
      })
      .then((response) => {
        expect(response.status).to.equal(201);
        expect(response.body).to.deep.equal({
          message: "User created successfully.",
          id: email,
        });
        return registerMutation({ kind: "userAccount" });
      })
      .then((result) => {
        ledgerResult = result;
        return apiRequest({
          method: "POST",
          path: "users",
          token: context.tokens.Admin,
          body: payload,
        });
      })
      .then((response) => {
        expect(response.status, "duplicate provisioning response").to.equal(409);
        expect(response.body).to.deep.equal({ message: "Email is already in use." });
      });

    apiRequest({ path: `users/${encodeURIComponent(email)}`, token: context.tokens.Admin })
      .then((response) => {
        expect(response.status).to.equal(200);
        createdUser = response.body?.user;
      });
    apiRequest({ path: "users", token: context.tokens.Admin }).then((response) => {
      expect(response.status).to.equal(200);
      listedUsers = (response.body?.users || []).filter((user) => user.email === email);
    });
    firebasePasswordSignIn(email, password).then((response) => {
      expect(response.status, "Firebase Authentication password sign-in").to.equal(200);
      expect(response.body?.idToken).to.be.a("string").and.not.be.empty;
      firebaseIdentity = response.body;
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      creationAudits = logs.filter(
        (log) => log.rawAction === "user.created" && log.record === email,
      );
    });

    cy.then(() => {
      expect(createdUser).to.include({
        id: email,
        email,
        firstName: GENERATED_FIRST_NAME,
        lastName: GENERATED_LAST_NAME,
        fullName: `${GENERATED_FIRST_NAME} ${GENERATED_LAST_NAME}`,
        role: GENERATED_ROLE,
        status: GENERATED_STATUS,
        emailVerified: true,
        phoneVerified: false,
        createdBy: context.emails.Admin,
      });
      expect(createdUser.permissions).to.include.members([
        "dashboard",
        "animals",
        "intake",
        "surrender",
        "announcements",
      ]);
      expect(createdUser).not.to.have.property("password");
      expect(listedUsers).to.have.length(1);
      expect(ledgerResult.authPresent).to.equal(true);
      expect(ledgerResult.authUid).to.equal(createdUser.firebaseUid);
      expect(firebaseIdentity.localId).to.equal(createdUser.firebaseUid);
      expect(firebaseIdentity.email).to.equal(email);
      expect(ledgerResult.registeredAuthEmails).to.deep.equal([email]);
      expect(
        ledgerResult.registeredPaths.filter((path) => path === `users/${email}`),
      ).to.have.length(1);
      expect(creationAudits).to.have.length(1);
      expect(creationAudits[0]).to.include({
        module: "User Management",
        record: email,
      });
      expect(creationAudits[0].after).to.deep.include({
        email,
        role: GENERATED_ROLE,
        status: GENERATED_STATUS,
      });
    });
  });
});
