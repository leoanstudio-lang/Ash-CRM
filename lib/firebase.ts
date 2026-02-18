import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBvg1b2iowObmpiIr4-SFvoXlHw2H08ET0",
    authDomain: "aerp-46a6c.firebaseapp.com",
    projectId: "aerp-46a6c",
    storageBucket: "aerp-46a6c.firebasestorage.app",
    messagingSenderId: "920667040582",
    appId: "1:920667040582:web:c31e2b3f84de3206e29347",
    measurementId: "G-1FNTR6WRV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);

export { app, analytics, db };
