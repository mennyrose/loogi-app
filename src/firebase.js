import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
// המשתמש צריך להזין כאן את הנתונים מה-Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB1f4DNbQ9Zjty9QhZLc4asi20e18nLSOA",
  authDomain: "loogi-6609.firebaseapp.com",
  projectId: "loogi-6609",
  storageBucket: "loogi-6609.firebasestorage.app",
  messagingSenderId: "55066407521",
  appId: "1:55066407521:web:d5126fba11cc45e5a17020",
  measurementId: "G-ML6K340KEQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
