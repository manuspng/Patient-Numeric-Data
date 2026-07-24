import { initializeApp, deleteApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import firebaseConfigJson from "../firebase-applet-config.json";

// Handle bundler differences for JSON imports (some bundlers wrap in a default property, some don't)
const firebaseConfig = (firebaseConfigJson as any).default || firebaseConfigJson;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Safely initialize Firestore with database ID if present, else default
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.trim() !== ""
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

// Suppress benign connection timeout/cancellation logs from Firestore in the console
setLogLevel("error");

/**
 * Creates a user in Firebase Auth without signing out the currently logged-in user.
 * This is accomplished by spinning up a temporary secondary Firebase App instance.
 */
export async function createFirebaseUser(email: string, password?: string): Promise<boolean> {
  const finalPassword = password && password.trim().length >= 6 
    ? password 
    : "User@" + Math.random().toString(36).substring(2, 10) + "!";

  const appName = "TempAdminCreateApp_" + Math.random().toString(36).substring(2, 11);
  let tempApp;
  try {
    tempApp = initializeApp(firebaseConfig, appName);
    const tempAuth = getAuth(tempApp);
    await createUserWithEmailAndPassword(tempAuth, email, finalPassword);
    await signOut(tempAuth);
    await deleteApp(tempApp);
    return true;
  } catch (err: any) {
    console.error("Error creating Firebase user:", err);
    if (tempApp) {
      try {
        await deleteApp(tempApp);
      } catch (e) {}
    }
    // If user already exists, treat as success/already there
    if (err.code === "auth/email-already-in-use" || err.code === "auth/email-already-in-check") {
      return true;
    }
    throw err;
  }
}

export { 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
};


