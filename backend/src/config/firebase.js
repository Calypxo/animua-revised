const admin = require("firebase-admin");
const {
  resolveFirebaseEnvironment,
} = require("./firebaseEnvironment");

const firebaseEnvironment = resolveFirebaseEnvironment(process.env);
const {
  projectId,
  storageBucket,
  useFirebaseEmulators,
  serviceAccount,
} = firebaseEnvironment;

if (!admin.apps.length) {
  if (useFirebaseEmulators) {
    admin.initializeApp({
      projectId,
      storageBucket,
    });
  } else {
    const credentialAccount = serviceAccount ||
      require("../../service-account-key.json");

    if (
      credentialAccount.projectId &&
      credentialAccount.projectId !== projectId
    ) {
      throw new Error(
        "The Firebase service account project does not match the active Firebase project."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(credentialAccount),
      projectId,
      storageBucket,
    });
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket, firebaseEnvironment };
