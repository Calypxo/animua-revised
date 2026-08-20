const {
  apiRequest,
  firebasePasswordSignIn,
  getAuditLogs,
  registerMutation,
  requiredEnvironmentValue,
  useIntegrationBaseline,
} = require("../../../support/integration");

const TEMPORARY_PASSWORD = "IT004-Temporary#2026!";

describe("IT-004 — Password Identity Synchronization", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "PublicMutable"],
    verifyRestored() {
      const email = requiredEnvironmentValue("FT_CLIENT_PROFILE_MUTABLE_EMAIL");
      const originalPassword = requiredEnvironmentValue("FT_PUBLIC_PASSWORD");
      const changedPassword = TEMPORARY_PASSWORD;
      let restoredToken;

      return apiRequest({
        method: "POST",
        path: "auth/login",
        body: { email, password: originalPassword },
        log: false,
      })
        .then((response) => {
          expect(response.status, "original application password restored").to.equal(200);
          restoredToken = response.body?.token;
          return firebasePasswordSignIn(email, originalPassword);
        })
        .then((response) => {
          expect(response.status, "original Firebase password restored").to.equal(200);
          return apiRequest({
            method: "POST",
            path: "auth/login",
            body: { email, password: changedPassword },
            log: false,
          });
        })
        .then((response) => {
          expect(response.status, "changed application password removed").to.equal(401);
          return firebasePasswordSignIn(email, changedPassword);
        })
        .then((response) => {
          expect(response.status, "changed Firebase password removed").to.equal(400);
          return apiRequest({ path: "auth/account", token: restoredToken });
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body?.account).to.include({ email, role: "Public", status: "Active" });
        });
    },
  });

  it("updates Firebase and application credentials while preserving the account profile", () => {
    const email = requiredEnvironmentValue("FT_CLIENT_PROFILE_MUTABLE_EMAIL");
    const originalPassword = requiredEnvironmentValue("FT_PUBLIC_PASSWORD");
    const changedPassword = TEMPORARY_PASSWORD;
    let beforeAccount;
    let afterAccount;
    let newApplicationLogin;
    let newFirebaseLogin;
    let oldApplicationLogin;
    let oldFirebaseLogin;
    let ledgerResult;
    let passwordAuditIdsBefore;
    let passwordAudits;

    getAuditLogs(context.tokens.Admin).then((logs) => {
      passwordAuditIdsBefore = new Set(logs
        .filter((log) => log.rawAction === "account.password_changed" && log.record === email)
        .map((log) => log.id));
      expect(passwordAuditIdsBefore.size, "password-change audits before mutation").to.equal(0);
    });

    apiRequest({ path: "auth/account", token: context.tokens.PublicMutable })
      .then((response) => {
        expect(response.status).to.equal(200);
        beforeAccount = response.body?.account;
        return firebasePasswordSignIn(email, originalPassword);
      })
      .then((response) => {
        expect(response.status, "original Firebase credential before change").to.equal(200);
        return apiRequest({
          method: "PATCH",
          path: "auth/account/password",
          token: context.tokens.PublicMutable,
          body: { oldPassword: originalPassword, newPassword: changedPassword },
        });
      })
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ message: "Password changed successfully." });
        return registerMutation({ kind: "passwordChange", primaryId: email });
      })
      .then((result) => {
        ledgerResult = result;
      });

    apiRequest({
      method: "POST",
      path: "auth/login",
      body: { email, password: changedPassword },
      log: false,
    }).then((response) => {
      newApplicationLogin = response;
      return apiRequest({ path: "auth/account", token: response.body?.token });
    }).then((response) => {
      expect(response.status).to.equal(200);
      afterAccount = response.body?.account;
    });
    firebasePasswordSignIn(email, changedPassword).then((response) => {
      newFirebaseLogin = response;
    });
    apiRequest({
      method: "POST",
      path: "auth/login",
      body: { email, password: originalPassword },
      log: false,
    }).then((response) => {
      oldApplicationLogin = response;
    });
    firebasePasswordSignIn(email, originalPassword).then((response) => {
      oldFirebaseLogin = response;
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      passwordAudits = logs.filter(
        (log) => log.rawAction === "account.password_changed" &&
          log.record === email &&
          !passwordAuditIdsBefore.has(log.id),
      );
    });

    cy.then(() => {
      expect(newApplicationLogin.status).to.equal(200);
      expect(newApplicationLogin.body?.token).to.be.a("string").and.not.be.empty;
      expect(newFirebaseLogin.status).to.equal(200);
      expect(newFirebaseLogin.body?.idToken).to.be.a("string").and.not.be.empty;
      expect(oldApplicationLogin.status).to.equal(401);
      expect(oldApplicationLogin.body).to.deep.equal({ message: "Invalid email or password." });
      expect(oldFirebaseLogin.status).to.equal(400);
      expect(oldFirebaseLogin.body).not.to.have.property("idToken");
      expect(afterAccount).to.deep.include({
        email: beforeAccount.email,
        fullName: beforeAccount.fullName,
        role: beforeAccount.role,
        status: beforeAccount.status,
      });
      expect(afterAccount.notificationSettings).to.deep.equal(beforeAccount.notificationSettings);
      expect(passwordAudits).to.have.length(1);
      expect(passwordAudits[0]).to.include({ module: "Account Settings", record: email });
      expect(passwordAudits[0].after, "password audit fields are redacted by the audit API")
        .to.deep.equal({});
      expect(ledgerResult.registeredPaths.filter((path) => path.startsWith("auditLogs/")))
        .to.deep.equal([`auditLogs/${passwordAudits[0].id}`]);
    });
  });
});
