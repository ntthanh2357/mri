import { initializeApp, cert, getApps } from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "neuroscanai-fabad.firebasestorage.app";

// Resolve path relative to project root if it starts with ./
const resolvedPath = serviceAccountPath.startsWith("./") 
  ? path.resolve(__dirname, "../../", serviceAccountPath)
  : path.resolve(serviceAccountPath);

if (fs.existsSync(resolvedPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: storageBucket
    });
    
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
  }
} else {
  console.warn(`WARNING: Firebase service account key not found at ${resolvedPath}. Firebase features will be disabled.`);
}

export const bucket = getApps().length ? getStorage().bucket() : null;

const adminMock = {
  initializeApp,
  credential: { cert },
  get apps() { return getApps(); },
  storage: () => ({ bucket: () => getStorage().bucket() })
};
export default adminMock;
