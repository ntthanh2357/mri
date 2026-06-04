import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAaKP0Q5HpkLlVGfMo9Bz2TmIU2wOVSyoM",
  authDomain: "neuroscanai-fabad.firebaseapp.com",
  projectId: "neuroscanai-fabad",
  storageBucket: "neuroscanai-fabad.firebasestorage.app",
  messagingSenderId: "11307729834",
  appId: "1:11307729834:web:854429d335a76f463061d3",
  measurementId: "G-C1QEEXTMY8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
