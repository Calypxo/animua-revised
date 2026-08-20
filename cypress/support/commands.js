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

const INTENTIONAL_LOCAL_STORAGE_KEYS = new Set([
  "animua_contact_message_count",
  "animua_quiz_language",
]);

let managementLoginAttempt = 0;

function assertSafeLocalStorage(window) {
  SESSION_KEYS.forEach((key) => expect(window.localStorage.getItem(key), key).to.be.null);
  Object.keys(window.localStorage).forEach((key) => {
    expect(
      INTENTIONAL_LOCAL_STORAGE_KEYS.has(key),
      `intentional long-lived localStorage key: ${key}`,
    ).to.equal(true);
  });
}

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

Cypress.Commands.add("findSubmissionDetailsButton", (submissionId, type) => {
  const selector =
    `.submission-details-btn[data-submission-id="${submissionId}"]`;

  cy.get(`.submission-tab[data-filter="${type}"]`).click();

  function findOnCurrentPage() {
    return cy.get("#submissionsList").then(($list) => {
      const $button = $list.find(selector);
      if ($button.length) return cy.wrap($button.first());

      const $next = $list.find(
        '.submission-pagination button[aria-label="Next page"]:not([disabled])',
      );
      expect(
        $next.length,
        `${submissionId} available in the paginated ${type} submissions`,
      ).to.equal(1);
      cy.wrap($next).click();
      return findOnCurrentPage();
    });
  }

  return findOnCurrentPage();
});

Cypress.Commands.add("clearAnimuaSession", () => {
  cy.clearCookies();
  cy.window({ log: false }).then((window) => {
    SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.clear();
  });
});

Cypress.Commands.add("assertHardenedBrowserStorage", () => {
  cy.getCookie("animua_session").should((cookie) => {
    expect(cookie, "HttpOnly application session cookie").not.to.be.null;
    expect(cookie.httpOnly).to.equal(true);
    expect(cookie.path).to.equal("/");
    expect(cookie.sameSite).to.equal("lax");
    expect(cookie.secure).to.equal(false);
  });
  cy.window().then((window) => {
    expect(window.document.cookie).not.to.contain("animua_session=");
    assertSafeLocalStorage(window);
  });
});

Cypress.Commands.add("assertManagementSession", (role) =>
  cy.request({
    method: "GET",
    url: joinUrl(Cypress.env("apiBaseUrl"), "/protected"),
    headers: {
      Origin: Cypress.env("managementBaseUrl"),
      Referer: joinUrl(Cypress.env("managementBaseUrl"), "/pages/dashboard.html"),
    },
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status, "backend-verified management session").to.equal(200);
    expect(response.body?.user?.role).to.equal(role);
  }),
);

Cypress.Commands.add("sessionApiRequest", ({ method = "GET", path, headers = {}, ...options }) =>
  cy.window({ log: false }).then(async (window) => {
    const response = await window.fetch(
      joinUrl(Cypress.env("apiBaseUrl"), path),
      {
        method,
        credentials: "include",
        headers,
        ...options,
      },
    );
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  }),
);

Cypress.Commands.add("loginClient", (overrides = {}) => {
  const { email, password } = roleCredentials("Client", overrides);

  cy.intercept("POST", "**/api/auth/login").as("clientLoginRequest");
  cy.visitPublicPage(`${PUBLIC_HOME_PATH}#login`);
  cy.get("#authModal", { timeout: 10000 }).should("not.have.class", "hidden");
  cy.fillSensitiveInput("#login-email", email);
  cy.fillSensitiveInput("#login-password", password);
  cy.get("#login-form .auth-submit-btn").click();
  cy.wait("@clientLoginRequest", { timeout: 30000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.get("#userLoggedInBox", { timeout: 30000 }).should("be.visible");
  cy.assertHardenedBrowserStorage();
});

Cypress.Commands.add("loginManagement", (role, overrides = {}) => {
  const supportedRoles = ["Admin", "Staff", "Veterinarian"];
  if (!supportedRoles.includes(role)) {
    throw new Error(`Unsupported management role: ${role}`);
  }

  const { email, password } = roleCredentials(role, overrides);
  managementLoginAttempt += 1;
  const loginRequestAlias = `managementLoginRequest${managementLoginAttempt}`;
  const loginPreflightAlias = `managementLoginPreflight${managementLoginAttempt}`;
  cy.request({
    method: "POST",
    url: joinUrl(Cypress.env("apiBaseUrl"), "/auth/logout"),
    headers: {
      Origin: Cypress.env("managementBaseUrl"),
      Referer: joinUrl(
        Cypress.env("managementBaseUrl"),
        MANAGEMENT_LOGIN_PATH,
      ),
    },
    failOnStatusCode: false,
  })
    .its("status")
    .should("eq", 200);
  cy.clearAllCookies({ log: false });
  cy.request({
    method: "GET",
    url: joinUrl(Cypress.env("apiBaseUrl"), "/protected"),
    failOnStatusCode: false,
  })
    .its("status")
    .should("be.oneOf", [401, 403]);
  cy.intercept("GET", "**/api/protected").as(loginPreflightAlias);
  cy.intercept("POST", "**/api/auth/login").as(loginRequestAlias);
  cy.visitManagementPage(MANAGEMENT_LOGIN_PATH, {
    onBeforeLoad(window) {
      SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.sessionStorage.clear();
    },
  });
  cy.wait(`@${loginPreflightAlias}`, { timeout: 30000 })
    .its("response.statusCode")
    .should("be.oneOf", [401, 403]);
  cy.fillSensitiveInput("#login-email", email);
  cy.fillSensitiveInput("#login-password", password);
  cy.get("#login-form button[type='submit']").click();
  cy.wait(`@${loginRequestAlias}`, { timeout: 30000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.location("pathname", { timeout: 20000 }).should(
    "eq",
    "/pages/dashboard.html",
  );
  cy.assertManagementSession(role);
  cy.assertHardenedBrowserStorage();
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
