const bcrypt = require("bcryptjs");

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "127.0.0.1:9199";
process.env.GCLOUD_PROJECT ||= "demo-animua";
process.env.FIREBASE_PROJECT_ID ||= "demo-animua";

const emulatorHosts = [
  process.env.FIRESTORE_EMULATOR_HOST,
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
  process.env.FIREBASE_STORAGE_EMULATOR_HOST,
];

if (emulatorHosts.some((host) => !/^(127\.0\.0\.1|localhost):\d+$/.test(host))) {
  throw new Error("Refusing to seed Firebase because an emulator host is not local.");
}

const { admin, db } = require("../src/config/firebase");

const email = String(
  process.env.ANIMUA_EMULATOR_ADMIN_EMAIL || "admin@animua.test"
).trim().toLowerCase();
const password = process.env.ANIMUA_EMULATOR_ADMIN_PASSWORD || "AnimuaDev123!";

async function seed() {
  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(email);
    authUser = await admin.auth().updateUser(authUser.uid, {
      password,
      displayName: "Local Admin",
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    authUser = await admin.auth().createUser({
      email,
      password,
      displayName: "Local Admin",
      emailVerified: true,
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.collection("users").doc(email).set({
    email,
    firebaseUid: authUser.uid,
    firstName: "Local",
    lastName: "Admin",
    fullName: "Local Admin",
    password: passwordHash,
    role: "Admin",
    status: "Active",
    permissions: [
      "dashboard",
      "users",
      "surrender",
      "intake",
      "animals",
      "quarantine",
      "inventory",
      "adoption",
      "reports",
      "archive",
      "audit",
    ],
    emailVerified: true,
    phoneVerified: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log("Local Firebase data is ready.");
  console.log(`Management login: ${email} / ${password}`);
}

seed()
  .then(() => admin.app().delete())
  .catch(async (error) => {
    console.error("Unable to seed the Firebase emulators:", error.message);
    await admin.app().delete().catch(() => {});
    process.exitCode = 1;
  });
