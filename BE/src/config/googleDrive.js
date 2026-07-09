import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_FILE_PATH = path.resolve(__dirname, "../../credentials.json");
const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

let driveClient = null;

const getDriveClient = () => {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
};

// Helper to convert buffer to a readable stream
const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

/**
 * Create a folder inside a parent folder on Google Drive
 */
export const createFolder = async (folderName, parentId = PARENT_FOLDER_ID) => {
  const drive = getDriveClient();
  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentId ? [parentId] : [],
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink",
    });
    return {
      id: response.data.id,
      url: response.data.webViewLink,
    };
  } catch (error) {
    console.error("Error creating folder on Google Drive:", error);
    throw error;
  }
};

/**
 * Automatically create the hospital root folder and its y tế subfolders
 */
export const setupHospitalDriveStructure = async (hospitalName) => {
  try {
    // 1. Create main hospital folder
    const mainFolder = await createFolder(`Bệnh viện - ${hospitalName}`);

    // 2. Create standard medical subfolders
    const originalFolder = await createFolder("01_Original_Scans", mainFolder.id);
    const aiFolder = await createFolder("02_AI_Predictions", mainFolder.id);
    const doctorFolder = await createFolder("03_Doctor_Revisions", mainFolder.id);
    const reportFolder = await createFolder("04_Patient_Reports", mainFolder.id);
    const backupFolder = await createFolder("05_Metadata_Backups", mainFolder.id);

    return {
      mainFolderId: mainFolder.id,
      mainFolderUrl: mainFolder.url,
      subFolders: {
        originalScansId: originalFolder.id,
        aiPredictionsId: aiFolder.id,
        doctorRevisionsId: doctorFolder.id,
        patientReportsId: reportFolder.id,
        metadataBackupsId: backupFolder.id,
      },
    };
  } catch (error) {
    console.error("Error setting up hospital drive structure:", error);
    throw error;
  }
};

/**
 * Get or create the main patients uploads parent folder
 */
let patientsParentFolderId = null;

const getOrCreatePatientsParentFolder = async () => {
  if (patientsParentFolderId) return patientsParentFolderId;

  const drive = getDriveClient();
  try {
    const response = await drive.files.list({
      q: `name = 'Bệnh nhân tự tải lên' and mimeType = 'application/vnd.google-apps.folder' and '${PARENT_FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id)",
    });

    if (response.data.files && response.data.files.length > 0) {
      patientsParentFolderId = response.data.files[0].id;
      return patientsParentFolderId;
    }

    const newFolder = await createFolder("Bệnh nhân tự tải lên", PARENT_FOLDER_ID);
    patientsParentFolderId = newFolder.id;
    return patientsParentFolderId;
  } catch (error) {
    console.error("Error finding/creating patients root folder:", error);
    throw error;
  }
};

/**
 * Get or create a specific patient's folder on Google Drive
 */
export const getOrCreatePatientFolder = async (userId, patientName = "Bệnh nhân") => {
  try {
    const PatientProfile = (await import("../models/patientProfile.model.js")).default;
    let profile = await PatientProfile.findOne({ userId });

    if (profile && profile.driveFolderId) {
      return {
        id: profile.driveFolderId,
        url: profile.driveFolderUrl,
      };
    }

    const patientsParentId = await getOrCreatePatientsParentFolder();
    const patientFolder = await createFolder(`BN - ${patientName} (ID: ${userId.toString().substring(18)})`, patientsParentId);

    if (profile) {
      profile.driveFolderId = patientFolder.id;
      profile.driveFolderUrl = patientFolder.url;
      await profile.save();
    } else {
      await PatientProfile.create({
        userId,
        driveFolderId: patientFolder.id,
        driveFolderUrl: patientFolder.url,
      });
    }

    return patientFolder;
  } catch (error) {
    console.error(`Error getting/creating folder for patient ${userId}:`, error);
    throw error;
  }
};

/**
 * Upload a file from Express buffer to a specific Drive folder and make it public (view only)
 */
export const uploadToDrive = async (fileBuffer, originalName, mimeType, targetFolderId) => {
  const drive = getDriveClient();
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;

  const fileMetadata = {
    name: fileName,
    parents: [targetFolderId],
  };

  const media = {
    mimeType: mimeType,
    body: bufferToStream(fileBuffer),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink",
    });

    const fileId = response.data.id;

    // Grant public read permission so it can be retrieved by clients/frontend
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      fileId: fileId,
      // WebViewLink is for viewing on Google Drive web interface
      webViewLink: response.data.webViewLink,
      // Direct link suitable for <img src="..."> tags
      downloadUrl: `https://lh3.googleusercontent.com/u/0/d/${fileId}`,
    };
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    throw error;
  }
};

/**
 * Delete a file/folder from Google Drive by ID
 */
export const deleteFromDrive = async (fileId) => {
  if (!fileId) return;
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    console.error(`Error deleting file ${fileId} from Google Drive:`, error);
  }
};

/**
 * Upload JSON metadata backup directly to hospital's 05_Metadata_Backups folder
 */
export const uploadMetadataBackup = async (metadata, hospitalId, fileNamePrefix = "annotations") => {
  try {
    if (!hospitalId) {
      console.warn("Không có hospitalId để tải lên metadata.");
      return null;
    }

    const Hospital = (await import("../models/hospital.model.js")).default;
    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital || !hospital.subFolders || !hospital.subFolders.metadataBackupsId) {
      console.warn("Bệnh viện không cấu hình thư mục backup hoặc không tìm thấy.");
      return null;
    }

    const folderId = hospital.subFolders.metadataBackupsId;
    const jsonString = JSON.stringify(metadata, null, 2);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");
    const fileName = `${fileNamePrefix}_${Date.now()}.json`;

    const uploadResult = await uploadToDrive(
      jsonBuffer,
      fileName,
      "application/json",
      folderId
    );

    return uploadResult;
  } catch (error) {
    console.error("Lỗi khi tải lên tệp JSON Metadata lên Google Drive:", error);
    return null;
  }
};
