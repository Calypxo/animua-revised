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
  cy.get("#authModal").should("not.have.class", "hidden");
  cy.fillSensitiveInput("#login-email", email);
  cy.fillSensitiveInput("#login-password", password);
  cy.get("#login-form .auth-submit-btn").click();
  cy.wait("@clientLoginRequest", { timeout: 30000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.window()
    .its("localStorage")
    .invoke("getItem", "animua_token")
    .should("be.a", "string")
    .and("not.be.empty");
  cy.get("#userLoggedInBox", { timeout: 30000 }).should("be.visible");
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
