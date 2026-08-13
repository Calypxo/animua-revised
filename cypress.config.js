const { defineConfig } = require("cypress");

function environmentUrl(name, fallback) {
  return (process.env[name] || fallback).replace(/\/+$/, "");
}

const publicBaseUrl = environmentUrl(
  "CYPRESS_PUBLIC_BASE_URL",
  "http://127.0.0.1:5173",
);
const managementBaseUrl = environmentUrl(
  "CYPRESS_MANAGEMENT_BASE_URL",
  "http://127.0.0.1:5174",
);
const apiBaseUrl = environmentUrl(
  "CYPRESS_API_BASE_URL",
  "http://127.0.0.1:5000/api",
);

function credentialEnvironmentValue(name) {
  return process.env[`CYPRESS_${name}`] || process.env[name] || "";
}

module.exports = defineConfig({
  e2e: {
    baseUrl: publicBaseUrl,
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",
    screenshotsFolder: "cypress/screenshots",
    videosFolder: "cypress/videos",
    downloadsFolder: "cypress/downloads",
    testIsolation: true,
    env: {
      publicBaseUrl,
      managementBaseUrl,
      apiBaseUrl,
      FT_CLIENT_ACTIVE_EMAIL: credentialEnvironmentValue("FT_CLIENT_ACTIVE_EMAIL"),
      FT_PUBLIC_PASSWORD: credentialEnvironmentValue("FT_PUBLIC_PASSWORD"),
      FT_ADMIN_ACTIVE_EMAIL: credentialEnvironmentValue("FT_ADMIN_ACTIVE_EMAIL"),
      FT_STAFF_ACTIVE_EMAIL: credentialEnvironmentValue("FT_STAFF_ACTIVE_EMAIL"),
      FT_VET_ACTIVE_EMAIL: credentialEnvironmentValue("FT_VET_ACTIVE_EMAIL"),
      FT_MANAGEMENT_PASSWORD: credentialEnvironmentValue("FT_MANAGEMENT_PASSWORD"),
    },
    setupNodeEvents(on, config) {
      // Register future report hooks or controlled test-data tasks here.
      // Keep production credentials and security controls outside this file.
      return config;
    },
  },
});
