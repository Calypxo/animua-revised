import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  inMemoryPersistence,
  initializeAuth,
} from "firebase/auth";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyCOOYL9AMozn4Hx2acLgBcCYttyDFm33cs",
  authDomain: "animua-angelescity.firebaseapp.com",
  projectId: "animua-angelescity",
  storageBucket: "animua-angelescity.firebasestorage.app",
  messagingSenderId: "268113735979",
  appId: "1:268113735979:web:8626ad22b37bf3f729d56e"
};

const hostedFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

const hostedConfigValues = Object.values(hostedFirebaseConfig);
const hostedConfigValueCount = hostedConfigValues.filter(Boolean).length;
const hostedConfigComplete = hostedConfigValueCount === hostedConfigValues.length;
const firebaseEnvironment = String(
  import.meta.env.VITE_APP_ENVIRONMENT || "normal-development"
).trim().toLowerCase();
const functionalityTestProjectId = String(
  import.meta.env.VITE_FUNCTIONALITY_TEST_PROJECT_ID || ""
).trim();
const functionalityTesting = firebaseEnvironment === "functionality-testing";
const emulatorRequested = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const useFirebaseEmulators = import.meta.env.DEV && emulatorRequested;
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";

if (hostedConfigValueCount > 0 && !hostedConfigComplete) {
  throw new Error(
    "Hosted Firebase configuration is incomplete. Provide all VITE_FIREBASE_* values."
  );
}

if (emulatorRequested && (hostedConfigValueCount > 0 || functionalityTestProjectId)) {
  throw new Error(
    "Firebase Emulator mode cannot be combined with hosted Firebase project configuration."
  );
}

if (functionalityTesting) {
  if (emulatorRequested) {
    throw new Error(
      "Functionality Testing must use the hosted Firebase project, not the Firebase Emulator."
    );
  }
  if (!hostedConfigComplete || !functionalityTestProjectId) {
    throw new Error(
      "Functionality Testing requires a complete hosted Firebase configuration and VITE_FUNCTIONALITY_TEST_PROJECT_ID."
    );
  }
  if (hostedFirebaseConfig.projectId !== functionalityTestProjectId) {
    throw new Error(
      "The active Firebase project does not match VITE_FUNCTIONALITY_TEST_PROJECT_ID."
    );
  }
} else if (
  functionalityTestProjectId &&
  hostedFirebaseConfig.projectId === functionalityTestProjectId
) {
  throw new Error(
    "A Functionality Testing Firebase project requires VITE_APP_ENVIRONMENT=functionality-testing."
  );
}

const firebaseConfig = useFirebaseEmulators
  ? {
      apiKey: "demo-key",
      authDomain: "demo-animua.firebaseapp.com",
      projectId: "demo-animua",
      storageBucket: "demo-animua.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:demo",
    }
  : hostedConfigComplete
    ? hostedFirebaseConfig
    : defaultFirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
});

if (useFirebaseEmulators && !globalThis.__ANIMUA_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
    disableWarnings: true,
  });
  globalThis.__ANIMUA_FIREBASE_EMULATORS_CONNECTED__ = true;
}

export default app;
