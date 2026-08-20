const PUBLIC_HOME_PATH = "/pages/public/home.html";
const MANAGEMENT_LOGIN_PATH = "/pages/admin-login.html";

const SESSION_KEYS = [
  "animua_token",
  "user_role",
  "user_name",
  "user_email",
  "user_profile_photo",
  "is_logged_in",
  "show_welcome_toast",
  "sidebar_collapsed",
  "animua_open_auth_modal",
  "pending_verify_email",
  "pending_verify_password",
];

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const suffix = `/${String(path || "").replace(/^\/+/, "")}`;
  return `${base}${suffix}`;
}

function requiredEnvironmentValue(name) {
  const value = Cypress.env(name);
  if (!value) {
    throw new Error(
      `Missing Cypress environment value ${name}. Copy cypress.env.example.json ` +
        "to cypress.env.json and provide a dedicated test account.",
    );
  }
  return value;
}

function roleCredentials(role, overrides = {}) {
  const emailVariables = {
    Client: "FT_CLIENT_ACTIVE_EMAIL",
    Admin: "FT_ADMIN_ACTIVE_EMAIL",
    Staff: "FT_STAFF_ACTIVE_EMAIL",
    Veterinarian: "FT_VET_ACTIVE_EMAIL",
  };
  const passwordVariable =
    role === "Client" ? "FT_PUBLIC_PASSWORD" : "FT_MANAGEMENT_PASSWORD";

  return {
    email: overrides.email || requiredEnvironmentValue(emailVariables[role]),
    password:
      overrides.password || requiredEnvironmentValue(passwordVariable),
  };
}

Cypress.Commands.add("fillSensitiveInput", (selector, value) => {
  Cypress.log({ name: "fill", message: selector });
  cy.get(selector, { log: false })
    .should("be.visible")
    .and("be.enabled")
    .then({ log: false }, ($input) => {
      const input = $input[0];
      const applicationWindow = input.ownerDocument.defaultView;
      const valueSetter = Object.getOwnPropertyDescriptor(
        applicationWindow.HTMLInputElement.prototype,
        "value",
      ).set;
      valueSetter.call(input, value);
      input.dispatchEvent(new applicationWindow.Event("input", { bubbles: true }));
      input.dispatchEvent(new applicationWindow.Event("change", { bubbles: true }));
    });
});

Cypress.Commands.add("visitPublicPage", (path = PUBLIC_HOME_PATH, options = {}) =>
  cy.visit(joinUrl(Cypress.env("publicBaseUrl"), path), options),
);

Cypress.Commands.add("visitManagementPage", (path, options = {}) =>
  cy.visit(joinUrl(Cypress.env("managementBaseUrl"), path), options),
);

Cypress.Commands.add("clearAnimuaSession", () => {
  cy.clearCookies();
  cy.window({ log: false }).then((window) => {
    SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.clear();
  });
});

Cypress.Commands.add("loginClient", (overrides = {}) => {
  const { email, password } = roleCredentials("Client", overrides);

  cy.intercept("POST", "**/api/auth/login").as("clientLoginRequest");
  cy.visitPublicPage(`${PUBLIC_HOME_PATH}#login`);
  cy.get("body").then(($body) => {
    if ($body.find("#authModal.hidden").length) {
      cy.get("#loginNavBtn").should("be.visible").click();
    }
  });
  cy.get("#authModal").should("not.have.class", "hidden");
  cy.fillSensitiveInput("#login-email", email);
  cy.fillSensitiveInput("#login-password", password);
  cy.get("#login-form .auth-submit-btn").click();
  cy.wait("@clientLoginRequest", { timeout: 30000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.get("#userLoggedInBox", { timeout: 30000 }).should("be.visible");
  cy.window()
    .its("localStorage")
    .invoke("getItem", "animua_token")
    .should("be.a", "string")
    .and("not.be.empty");
});

Cypress.Commands.add("loginManagement", (role, overrides = {}) => {
  const supportedRoles = ["Admin", "Staff", "Veterinarian"];
  if (!supportedRoles.includes(role)) {
    throw new Error(`Unsupported management role: ${role}`);
  }

  const { email, password } = roleCredentials(role, overrides);
  cy.intercept("POST", "**/api/auth/login").as("managementLoginRequest");
  cy.visitManagementPage(MANAGEMENT_LOGIN_PATH);
  cy.fillSensitiveInput("#login-email", email);
  cy.fillSensitiveInput("#login-password", password);
  cy.get("#login-form button[type='submit']").click();
  cy.wait("@managementLoginRequest", { timeout: 30000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.location("pathname", { timeout: 20000 }).should(
    "eq",
    "/pages/dashboard.html",
  );
  cy.window().then((window) => {
    expect(window.localStorage.getItem("user_role")).to.equal(role);
  });
});

Cypress.Commands.add("loginAdmin", (overrides = {}) =>
  cy.loginManagement("Admin", overrides),
);

Cypress.Commands.add("loginStaff", (overrides = {}) =>
  cy.loginManagement("Staff", overrides),
);

Cypress.Commands.add("loginVet", (overrides = {}) =>
  cy.loginManagement("Veterinarian", overrides),
);

Cypress.Commands.add("logoutClient", () => {
  cy.get("#userMenuBtn").click();
  cy.get("#logoutBtn").click();
  cy.get(".swal2-confirm").click();
  cy.location("pathname").should("eq", PUBLIC_HOME_PATH);
  cy.window().then((window) => {
    expect(window.localStorage.getItem("animua_token")).to.be.null;
  });
});

Cypress.Commands.add("logoutManagement", () => {
  cy.get(".user-chip").click();
  cy.get(".management-account-signout").click();
  cy.get(".swal2-confirm").click();
  cy.location("pathname").should("eq", MANAGEMENT_LOGIN_PATH);
  cy.window().then((window) => {
    expect(window.localStorage.getItem("animua_token")).to.be.null;
  });
});

Cypress.Commands.add("fillValidSurrenderForm", (options = {}) => {
  const png = Cypress.Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
    "base64",
  );
  const imageFile = (name) => ({
    contents: png,
    fileName: name,
    mimeType: "image/png",
    lastModified: 0,
  });

  cy.get(".surrender-workspace").scrollIntoView().should("have.class", "show");
  cy.get("#ownerName").should("have.attr", "readonly");
  cy.get("#ownerEmail").should("have.attr", "readonly");
  cy.get("#contactNo").type("09170000000");
  cy.get("#ownerAddress").type("FT Address, Pampang, Angeles City");
  cy.get("#ownerBarangay").select("Pampang", { force: true });
  cy.get("#identityIdFront").selectFile(imageFile("ft-id-front.png"), { force: true });
  cy.get("#identityIdBack").selectFile(imageFile("ft-id-back.png"), { force: true });
  cy.get('[data-next-step="2"]').click();

  cy.get("#petName").type(options.petName || "FT Surrender Animal");
  cy.get("#species").select("Dog", { force: true });
  cy.get("#breed").type("Mixed Breed");
  cy.get("#petAge").type("Adult");
  cy.get("#petSex").select("Male", { force: true });
  cy.get("#colorMarkings").type("Synthetic brown and white markings");
  cy.get('input[name="status"][value="Unknown"]').check({ force: true });
  cy.get("#vaccinationHistory").type("Unknown");
  cy.get('[data-next-step="3"]').click();

  cy.get("#reasons").type(
    options.reason || "FT deterministic surrender reason for formal functionality testing.",
  );
  cy.get('[data-next-step="4"]').click();

  if (options.agree !== false) {
    cy.get("#agreeAllTerms").check({ force: true });
  }
});
