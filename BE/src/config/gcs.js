import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

let storage = null;
let bucket = null;

const initGCS = () => {
  if (bucket) return bucket;

  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null;

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  storage = keyFile
    ? new Storage({ keyFilename: path.resolve(keyFile) })
    : new Storage();

  bucket = storage.bucket(bucketName);
  return bucket;
};

// ── Local file fallback ────────────────────────────────────────────────────────

const saveLocally = (fileBuffer, originalName, folder) => {
  const dir = path.join(LOCAL_UPLOADS_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${timestamp}_${safeName}`;
  fs.writeFileSync(path.join(dir, filename), fileBuffer);
  return `/uploads/${folder}/${filename}`;
};

const deleteLocally = (fileUrl) => {
  try {
    const rel = decodeURIComponent(fileUrl.replace(/^\/uploads\//, ""));
    const filePath = path.join(LOCAL_UPLOADS_DIR, rel);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Bỏ qua lỗi xóa file local
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const uploadToGCS = async (fileBuffer, originalName, mimeType, folder = "patient-records") => {
  const b = initGCS();

  if (!b) {
    // GCS chưa cấu hình → lưu local
    return saveLocally(fileBuffer, originalName, folder);
  }

  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destPath = `${folder}/${timestamp}_${safeName}`;

  const file = b.file(destPath);
  await file.save(fileBuffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destPath}`;
};

export const deleteFromGCS = async (fileUrl) => {
  if (!fileUrl) return;

  if (fileUrl.startsWith("/uploads/")) {
    deleteLocally(fileUrl);
    return;
  }

  const b = initGCS();
  if (!b) return;

  try {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const prefix = `https://storage.googleapis.com/${bucketName}/`;
    if (!fileUrl.startsWith(prefix)) return;

    const filePath = fileUrl.slice(prefix.length);
    await b.file(filePath).delete();
  } catch {
    // Không throw lỗi nếu xóa GCS thất bại
  }
};
