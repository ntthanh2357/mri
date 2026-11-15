import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_FILE_PATH = path.resolve(__dirname, "../../../credentials.json");

let driveClient = null;
const folderCache = new Map(); // Cache đường dẫn -> driveFolderId để tránh spam Google API
const inFlightFolderPromises = new Map(); // In-Flight Mutex Lock chống tạo trùng thư mục khi nhiều ảnh lên cùng lúc
let customFolderCreatorForTest = null; // Hook kiểm thử đơn vị (Unit Test Hook)

export const setCustomFolderCreatorForTest = (fn) => {
  customFolderCreatorForTest = fn;
};

export const clearDriveFolderCache = () => {
  folderCache.clear();
  inFlightFolderPromises.clear();
};

export const getDriveFolderLockStats = () => ({
  cachedFoldersCount: folderCache.size,
  inFlightLocksCount: inFlightFolderPromises.size,
});

/**
 * Khởi tạo Google Drive Client
 */
export const getDriveClient = () => {
  if (driveClient) return driveClient;

  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || "https://developers.google.com/oauthplayground"
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });
    driveClient = google.drive({ version: "v3", auth: oauth2Client });
  } else {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    driveClient = google.drive({ version: "v3", auth });
  }
  return driveClient;
};

/**
 * Lấy ID thư mục gốc của Drive
 */
export const getRootFolderId = () => {
  return process.env.DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
};

/**
 * Tìm hoặc tạo 1 thư mục con bên dưới parentFolderId
 * Có khóa đồng bộ In-Flight Mutex Lock chống tạo trùng thư mục khi 20 lát cắt MRI đẩy lên cùng lúc
 */
export const getOrCreateFolder = async (folderName, parentFolderId) => {
  const cacheKey = `${parentFolderId}_${folderName}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  // Nếu đang có 1 luồng khác tìm/tạo đúng thư mục này -> chờ cùng Promise đó (Mutex Lock)
  if (inFlightFolderPromises.has(cacheKey)) {
    return inFlightFolderPromises.get(cacheKey);
  }

  const folderPromise = (async () => {
    try {
      if (customFolderCreatorForTest) {
        const testId = await customFolderCreatorForTest(folderName, parentFolderId);
        folderCache.set(cacheKey, testId);
        return testId;
      }

      const drive = getDriveClient();

      // 1. Kiểm tra xem thư mục đã tồn tại chưa (escape ký tự nháy đơn nếu có)
      const escapedName = String(folderName).replace(/'/g, "\\'");
      try {
        const query = `'${parentFolderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const res = await drive.files.list({
          q: query,
          fields: "files(id, name)",
          spaces: "drive",
        });

        if (res.data.files && res.data.files.length > 0) {
          const existingId = res.data.files[0].id;
          folderCache.set(cacheKey, existingId);
          return existingId;
        }
      } catch (searchErr) {
        console.warn(`[Drive Mirror] Lỗi tìm thư mục ${folderName}:`, searchErr.message);
      }

      // 2. Nếu chưa có, tạo mới
      try {
        const folderMetadata = {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        };
        const createRes = await drive.files.create({
          requestBody: folderMetadata,
          fields: "id",
        });

        const newId = createRes.data.id;
        folderCache.set(cacheKey, newId);
        return newId;
      } catch (createErr) {
        console.error(`[Drive Mirror] Không thể tạo thư mục ${folderName}:`, createErr.message);
        throw createErr;
      }
    } finally {
      inFlightFolderPromises.delete(cacheKey);
    }
  })();

  inFlightFolderPromises.set(cacheKey, folderPromise);
  return folderPromise;
};

/**
 * Duyệt đệ quy và giải quyết cấu trúc thư mục từ chuỗi đường dẫn tương đối (có Cache + In-Flight Lock)
 * Ví dụ: "pacs/2026/10/study_000997" -> trả về folderId cuối cùng
 */
export const resolveDriveFolderPath = async (relativeDirPath) => {
  const rootFolderId = getRootFolderId();
  if (!rootFolderId) {
    throw new Error("Chưa cấu hình DRIVE_ROOT_FOLDER_ID trong .env");
  }

  const normalized = relativeDirPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return rootFolderId;

  if (folderCache.has(normalized)) {
    return folderCache.get(normalized);
  }

  const pathLockKey = `PATH_${normalized}`;
  if (inFlightFolderPromises.has(pathLockKey)) {
    return inFlightFolderPromises.get(pathLockKey);
  }

  const resolvePromise = (async () => {
    try {
      const segments = normalized.split("/").filter(Boolean);
      let currentParentId = rootFolderId;

      for (const seg of segments) {
        currentParentId = await getOrCreateFolder(seg, currentParentId);
      }

      folderCache.set(normalized, currentParentId);
      return currentParentId;
    } finally {
      inFlightFolderPromises.delete(pathLockKey);
    }
  })();

  inFlightFolderPromises.set(pathLockKey, resolvePromise);
  return resolvePromise;
};

/**
 * Tải tệp đã mã hóa lên Google Drive ở chế độ RIÊNG TƯ (Strictly Private)
 * @param {Buffer|Readable} encryptedBufferOrStream - Dữ liệu đã mã hóa AES-256
 * @param {string} relativeDirPath - Đường dẫn thư mục cha (ví dụ: "pacs/2026/10/study_000997")
 * @param {string} fileName - Tên tệp
 * @param {string} [mimeType] - MimeType
 * @returns {Promise<{ driveFileId: string, driveFolderId: string, md5Checksum: string }>}
 */
export const uploadEncryptedFile = async (encryptedBufferOrStream, relativeDirPath, fileName, mimeType = "application/octet-stream") => {
  const drive = getDriveClient();
  const targetFolderId = await resolveDriveFolderPath(relativeDirPath);

  const fileMetadata = {
    name: fileName,
    parents: [targetFolderId],
  };

  const bodyStream =
    encryptedBufferOrStream instanceof Readable || typeof encryptedBufferOrStream?.pipe === "function"
      ? encryptedBufferOrStream
      : Readable.from(encryptedBufferOrStream);

  const media = {
    mimeType: mimeType,
    body: bodyStream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id, md5Checksum, size",
  });

  return {
    driveFileId: response.data.id,
    driveFolderId: targetFolderId,
    md5Checksum: response.data.md5Checksum,
    size: response.data.size,
  };
};

/**
 * Tải tệp mã hóa từ Google Drive về máy (Dùng cho Disaster Recovery / Phục hồi bản chính)
 * @param {string} driveFileId
 * @returns {Promise<Buffer>}
 */
export const downloadEncryptedFile = async (driveFileId) => {
  if (!driveFileId) {
    throw new Error("Thiếu driveFileId để tải về.");
  }
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data);
};

/**
 * Xóa tệp trên Google Drive
 * @param {string} driveFileId
 */
export const deleteDriveFile = async (driveFileId) => {
  if (!driveFileId) return;
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId: driveFileId });
  } catch (err) {
    console.warn(`[Drive Mirror] Lỗi xóa file ${driveFileId}:`, err.message);
  }
};
