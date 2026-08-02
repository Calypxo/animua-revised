const admin = require("firebase-admin");

const useFirebaseEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
);

const projectId = useFirebaseEmulators
  ? process.env.GCLOUD_PROJECT || "demo-animua"
  : process.env.FIREBASE_PROJECT_ID || "animua-angelescity";

if (!admin.apps.length) {
  if (useFirebaseEmulators) {
    admin.initializeApp({
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    });
  } else {
    const serviceAccount = process.env.FIREBASE_PROJECT_ID
      ? {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }
      : require("../../service-account-key.json");

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "animua-angelescity.firebasestorage.app",
    });
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };
