import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const productionFirebaseConfig = {
  apiKey: "PASTE_YOUR_REAL_API_KEY_HERE",
  authDomain: "animua-angelescity.firebaseapp.com",
  projectId: "animua-angelescity",
  storageBucket: "animua-angelescity.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_REAL_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_YOUR_REAL_APP_ID_HERE",
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
      appId: "1:000000000000:web:demo-admin",
    }
  : productionFirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

if (useFirebaseEmulators && !globalThis.__ANIMUA_ADMIN_FIRESTORE_EMULATOR_CONNECTED__) {
  connectFirestoreEmulator(db, emulatorHost, 8080);
  globalThis.__ANIMUA_ADMIN_FIRESTORE_EMULATOR_CONNECTED__ = true;
}
