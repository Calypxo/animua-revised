import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOOYL9AMozn4Hx2acLgBcCYttyDFm33cs",
  authDomain: "animua-angelescity.firebaseapp.com",
  projectId: "animua-angelescity",
  storageBucket: "animua-angelescity.firebasestorage.app",
  messagingSenderId: "268113735979",
  appId: "1:268113735979:web:8626ad22b37bf3f729d56e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;