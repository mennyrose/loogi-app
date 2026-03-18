import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
// המשתמש צריך להזין כאן את הנתונים מה-Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBHtVmTr3hll3PRy8ykmABuEiQk_Vvonqk",
  authDomain: "loogiz.firebaseapp.com",
  projectId: "loogiz",
  storageBucket: "loogiz.firebasestorage.app",
  messagingSenderId: "385710361243",
  appId: "1:385710361243:web:0b0012306ab15d8bbe943e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
