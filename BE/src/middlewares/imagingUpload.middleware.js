import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Disk storage for imaging files and DICOM archives
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const isArchive = [".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext);
    const prefix = isArchive ? "dicom_archive" : "uploaded";
    cb(null, `${prefix}_${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = [
  // Key Slice Images
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  // Mini-PACS DICOM Archives
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
];

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/octet-stream", // Frequently sent by browsers for .zip / .rar
];

const FORBIDDEN_EXTENSIONS = [
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phps",
  ".exe", ".bat", ".cmd", ".sh", ".bash",
  ".html", ".htm", ".xhtml", ".shtml",
  ".js", ".jsx", ".ts", ".tsx",
  ".jsp", ".asp", ".aspx", ".py", ".rb", ".pl",
  ".svg", ".jar", ".vbs", ".dll", ".so",
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // 1. Chặn ngay lập tức nếu tệp có đuôi nguy hiểm (Webshell, Executable, Script)
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    console.warn(`[SECURITY ALERT] Blocked dangerous file upload attempt: "${file.originalname}"`);
    return cb(
      new Error(`Tệp tin "${file.originalname}" bị từ chối vì chứa định dạng có nguy cơ mất an toàn hệ thống.`),
      false
    );
  }

  const mimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extAllowed = ALLOWED_EXTENSIONS.includes(ext);

  // 2. Bắt buộc: Đuôi tệp PHẢI nằm trong danh sách cho phép VÀ (mime type hợp lệ hoặc octet-stream)
  if (extAllowed && (mimeAllowed || file.mimetype === "application/octet-stream")) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Định dạng tệp "${file.originalname}" không được hỗ trợ. Chỉ chấp nhận ảnh cắt lớp (.jpg, .png) hoặc tệp nén DICOM (.zip, .rar).`
      ),
      false
    );
  }
};

// 200MB limit to safely support CT/MRI DICOM zip archives without memory issues
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

/**
 * Middleware wrapper handling single multipart file upload under "file" field.
 * Safely passes through requests without multipart files (e.g. legacy Base64 JSON)
 * and formats friendly error messages if size limit or mime restrictions are violated.
 */
export const uploadImagingFile = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  const uploadSingle = upload.single("file");
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: "error",
          message: "Dung lượng tệp vượt quá giới hạn cho phép (tối đa 200MB).",
        });
      }
      return res.status(400).json({
        status: "error",
        message: err.message || "Lỗi khi xử lý tải lên tệp tin.",
      });
    }
    next();
  });
};
