import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lấy thư mục gốc lưu trữ Local (Ưu tiên cấu hình trong .env, fallback an toàn)
 */
export const getLocalRoot = () => {
  if (process.env.STORAGE_LOCAL_DIR) {
    return path.resolve(process.env.STORAGE_LOCAL_DIR);
  }
  // Fallback an toàn nếu chưa cấu hình: tạo folder ngoài workspace hoặc trong thư mục cha
  return path.resolve(__dirname, "../../../../neuroscan_storage");
};

/**
 * Đảm bảo thư mục tồn tại trên đĩa cứng
 */
export const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Chuyển đổi tên bệnh nhân tiếng Việt có dấu thành dạng slug an toàn cho hệ thống tệp
 * Ví dụ: "Nguyễn Thị Đậu" -> "Nguyen_Thi_Dau", "Lê Thị Diện" -> "Le_Thi_Dien"
 */
export const cleanPatientSlug = (name) => {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "Đ" ? "D" : "d"))
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

/**
 * Xây dựng đường dẫn logic chuẩn hóa (De-identified & Traceable Logical Path)
 * Ví dụ:
 * - pacs/2026/10/study_TAMTRI_997_Nguyen_Thi_Dau/key_slice_tumor.jpg
 * - pacs/2026/10/study_TAMTRI_997_Nguyen_Thi_Dau/sequences/T2_FLAIR_axial/IM-0001.jpg
 * - reports/2026/10/report_000997.pdf
 * - patient-uploads/quarantine/up_123.pdf
 * - ai-temp/job_abc123/slice.png
 */
export const buildLogicalPath = ({ category, studyId = null, sequenceName = null, fileName, patientName = null }) => {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Xây dựng tên thư mục ca bệnh: study_{studyId}_{PatientName}
  let studyFolderName = "study_general";
  if (studyId) {
    const baseStudy = studyId.replace(/^study_/, "");
    const patSlug = patientName ? cleanPatientSlug(patientName) : "";
    if (patSlug && !baseStudy.toLowerCase().includes(patSlug.toLowerCase())) {
      studyFolderName = `study_${baseStudy}_${patSlug}`;
    } else {
      studyFolderName = `study_${baseStudy}`;
    }
  }

  switch (category) {
    case "pacs": {
      if (sequenceName) {
        return path.posix.join("pacs", yyyy, mm, studyFolderName, "sequences", sequenceName, safeFileName);
      }
      return path.posix.join("pacs", yyyy, mm, studyFolderName, safeFileName);
    }
    case "sequence_slice": {
      const seq = sequenceName || "general_sequence";
      return path.posix.join("pacs", yyyy, mm, studyFolderName, "sequences", seq, safeFileName);
    }
    case "report": {
      return path.posix.join("reports", yyyy, mm, safeFileName);
    }
    case "patient_upload": {
      return path.posix.join("patient-uploads", "quarantine", safeFileName);
    }
    case "ai_temp": {
      const token = studyId || `job_${Date.now()}`;
      return path.posix.join("ai-temp", token, safeFileName);
    }
    case "backup": {
      return path.posix.join("backups", yyyy, mm, safeFileName);
    }
    default:
      return path.posix.join("general", yyyy, mm, safeFileName);
  }
};

/**
 * Ghi tệp vào Local Storage (Bản chính)
 * @param {string} logicalSubPath - Đường dẫn tương đối chuẩn hóa
 * @param {Buffer} buffer - Dữ liệu nhị phân
 * @returns {Promise<{ localPath: string, sizeBytes: number }>}
 */
export const writeLocalFile = async (logicalSubPath, buffer) => {
  const root = getLocalRoot();
  const fullPath = path.join(root, logicalSubPath);
  const dirName = path.dirname(fullPath);

  ensureDirectory(dirName);
  await fs.promises.writeFile(fullPath, buffer);

  return {
    localPath: fullPath,
    sizeBytes: buffer.length,
  };
};

/**
 * Đọc stream tệp tin từ Local Storage
 * @param {string} localPath
 * @param {object} [options]
 * @returns {fs.ReadStream}
 */
export const createLocalReadStream = (localPath, options = {}) => {
  if (!fs.existsSync(localPath)) {
    throw new Error(`Tệp tin không tồn tại trên ổ cứng: ${localPath}`);
  }
  return fs.createReadStream(localPath, options);
};

/**
 * Đọc nhị phân buffer từ Local Storage
 * @param {string} localPath
 * @returns {Promise<Buffer>}
 */
export const readLocalBuffer = async (localPath) => {
  if (!fs.existsSync(localPath)) {
    throw new Error(`Tệp tin không tồn tại trên ổ cứng: ${localPath}`);
  }
  return fs.promises.readFile(localPath);
};

/**
 * Kiểm tra file có tồn tại trên Local Storage không
 * @param {string} localPath
 * @returns {boolean}
 */
export const existsOnLocal = (localPath) => {
  return fs.existsSync(localPath);
};

/**
 * Xóa file trên Local Storage
 * @param {string} localPath
 */
export const deleteLocalFile = async (localPath) => {
  if (fs.existsSync(localPath)) {
    await fs.promises.unlink(localPath);
  }
};
