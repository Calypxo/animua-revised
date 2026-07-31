import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const productionFirebaseConfig = {
  apiKey: "AIzaSyCOOYL9AMozn4Hx2acLgBcCYttyDFm33cs",
  authDomain: "animua-angelescity.firebaseapp.com",
  projectId: "animua-angelescity",
  storageBucket: "animua-angelescity.firebasestorage.app",
  messagingSenderId: "268113735979",
  appId: "1:268113735979:web:8626ad22b37bf3f729d56e"
};

const useFirebaseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "false";
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";

const firebaseConfig = useFirebaseEmulators
  ? {
      apiKey: "demo-key",
      authDomain: "demo-animua.firebaseapp.com",
      projectId: "demo-animua",
      storageBucket: "demo-animua.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:demo",
    }
  : productionFirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useFirebaseEmulators && !globalThis.__ANIMUA_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  globalThis.__ANIMUA_FIREBASE_EMULATORS_CONNECTED__ = true;
}

export default app;
