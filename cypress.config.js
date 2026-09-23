const { defineConfig } = require("cypress");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function inspectFtReportDownload({ fileName } = {}) {
  const safeName = String(fileName || "");
  if (!/^ANIMUA_(?:Animal_Intake|Barangay_Stray_Intake|Animal_Status|Adoption|Medical_&_Quarantine|Inventory_Usage|Surrender_Requests)_Report_(?:(?:from_|through_)?\d{4}-\d{2}-\d{2})(?:_to_\d{4}-\d{2}-\d{2})?\.xlsx$/.test(safeName)) {
    throw new Error("Batch 10 report inspection requires an exact ANIMUA report filename.");
  }
  const downloadRoot = path.resolve(__dirname, "cypress", "downloads");
  const filePath = path.resolve(downloadRoot, safeName);
  if (path.dirname(filePath) !== downloadRoot || !fs.existsSync(filePath)) {
    throw new Error("The controlled Batch 10 report download was not found.");
  }
  const buffer = fs.readFileSync(filePath);
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("The report download is not a readable XLSX archive.");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  const content = [];
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid XLSX central directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push(name);
    if (/^(?:xl\/workbook\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml|\[Content_Types\]\.xml)$/.test(name)) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Invalid XLSX local header.");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      const value = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : null;
      if (value) content.push(value.toString("utf8"));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return {
    fileName: safeName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    entries,
    content: content.join("\n"),
  };
}

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
      FT_CLIENT_UNVERIFIED_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_UNVERIFIED_EMAIL",
      ),
      FT_CLIENT_PROFILE_MUTABLE_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_PROFILE_MUTABLE_EMAIL",
      ),
      FT_CLIENT_NOTIFICATIONS_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_NOTIFICATIONS_EMAIL",
      ),
      FT_CLIENT_QUIZ_NEW_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_QUIZ_NEW_EMAIL",
      ),
      FT_CLIENT_QUIZ_COOLDOWN_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_QUIZ_COOLDOWN_EMAIL",
      ),
      FT_CLIENT_QUIZ_ELIGIBLE_EMAIL: credentialEnvironmentValue(
        "FT_CLIENT_QUIZ_ELIGIBLE_EMAIL",
      ),
      FT_REGISTRATION_ACCOUNT_EMAIL: credentialEnvironmentValue(
        "FT_REGISTRATION_ACCOUNT_EMAIL",
      ),
      FT_PUBLIC_PASSWORD: credentialEnvironmentValue("FT_PUBLIC_PASSWORD"),
      FT_CLIENT_PROFILE_MUTABLE_NEW_PASSWORD: credentialEnvironmentValue(
        "FT_CLIENT_PROFILE_MUTABLE_NEW_PASSWORD",
      ),
      FT_ADMIN_ACTIVE_EMAIL: credentialEnvironmentValue("FT_ADMIN_ACTIVE_EMAIL"),
      FT_STAFF_ACTIVE_EMAIL: credentialEnvironmentValue("FT_STAFF_ACTIVE_EMAIL"),
      FT_VET_ACTIVE_EMAIL: credentialEnvironmentValue("FT_VET_ACTIVE_EMAIL"),
      FT_MANAGEMENT_INACTIVE_EMAIL: credentialEnvironmentValue(
        "FT_MANAGEMENT_INACTIVE_EMAIL",
      ),
      FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL: credentialEnvironmentValue(
        "FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL",
      ),
      FT_MANAGEMENT_PASSWORD: credentialEnvironmentValue("FT_MANAGEMENT_PASSWORD"),
      FT_MANAGEMENT_PROFILE_MUTABLE_NEW_PASSWORD: credentialEnvironmentValue(
        "FT_MANAGEMENT_PROFILE_MUTABLE_NEW_PASSWORD",
      ),
      VITE_FIREBASE_API_KEY: credentialEnvironmentValue("VITE_FIREBASE_API_KEY"),
    },
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.family !== "chromium") return launchOptions;

        const featureArgumentIndex = launchOptions.args.findIndex((argument) =>
          argument.startsWith("--disable-features="),
        );
        if (featureArgumentIndex >= 0) {
          const disabledFeatures = new Set(
            launchOptions.args[featureArgumentIndex]
              .slice("--disable-features=".length)
              .split(",")
              .filter(Boolean),
          );
          disabledFeatures.add("ServiceWorker");
          launchOptions.args[featureArgumentIndex] =
            `--disable-features=${[...disabledFeatures].join(",")}`;
        } else {
          launchOptions.args.push("--disable-features=ServiceWorker");
        }

        return launchOptions;
      });
      on("task", {
        inspectFtReportDownload,
        createFtManagementNotificationFixture() {
          const {
            createFtManagementNotificationFixture,
          } = require("./backend/scripts/ft-baseline/ledger");
          return createFtManagementNotificationFixture();
        },
        registerFtGeneratedRecords(input) {
          const {
            registerCypressMutation,
          } = require("./backend/scripts/ft-baseline/ledger");
          return registerCypressMutation(input);
        },
        inspectFtAnnouncementImage(input) {
          const {
            inspectFtAnnouncementImage,
          } = require("./backend/scripts/ft-baseline/ledger");
          return inspectFtAnnouncementImage(input);
        },
        async uploadFtAnnouncementImage(input = {}) {
          const primaryId = String(input.primaryId || "").trim();
          const variant = String(input.variant || "").trim();
          const token = String(input.token || "").trim();
          if (primaryId !== "FT_ANNOUNCEMENT_DRAFT") {
            throw new Error("IT-023 upload is restricted to FT_ANNOUNCEMENT_DRAFT.");
          }
          if (!["first", "replacement"].includes(variant) || !token) {
            throw new Error("IT-023 upload requires a controlled image variant and legitimate JWT.");
          }

          const pngBase64 = variant === "first"
            ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII="
            : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNk+M/wHwAF/gL+Xw9WAAAAAElFTkSuQmCC";
          const form = new FormData();
          form.append(
            "photo",
            new Blob([Buffer.from(pngBase64, "base64")], { type: "image/png" }),
            `it-023-${variant}.png`,
          );
          const response = await fetch(
            `${String(config.env.apiBaseUrl).replace(/\/+$/, "")}/announcements/${primaryId}/image`,
            {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            },
          );
          const body = await response.json().catch(() => ({}));
          return { status: response.status, body };
        },
      });
      return config;
    },
  },
});
