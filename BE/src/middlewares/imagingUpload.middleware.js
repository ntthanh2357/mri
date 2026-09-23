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

// 600MB limit to safely support CT/MRI DICOM zip archives (gói lát cắt MRI nén đến 500MB+)
const MAX_FILE_SIZE_BYTES = 600 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

/**
 * Xác thực chữ ký Magic Bytes của tệp tin đã tải lên đĩa để chặn tệp giả mạo đuôi.
 */
export const validateMagicBytes = (filePath, ext) => {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(132);
    const bytesRead = fs.readSync(fd, buffer, 0, 132, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    // PNG: 89 50 4E 47
    if (ext === ".png") {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    }
    // JPEG: FF D8 FF
    if (ext === ".jpg" || ext === ".jpeg") {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    // ZIP: 50 4B 03 04 or 50 4B 05 06
    if (ext === ".zip") {
      return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05);
    }
    // GZIP: 1F 8B
    if (ext === ".gz") {
      return buffer[0] === 0x1f && buffer[1] === 0x8b;
    }
    // DICOM: bytes 128-131 contain 'DICM'
    if (ext === ".dcm") {
      if (bytesRead >= 132) {
        const dicmTag = buffer.subarray(128, 132).toString("ascii");
        if (dicmTag === "DICM") return true;
      }
      return true;
    }
    // WebP: RIFF ... WEBP
    if (ext === ".webp") {
      return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    }
    // BMP: 42 4D
    if (ext === ".bmp") {
      return buffer[0] === 0x42 && buffer[1] === 0x4d;
    }
    // RAR: 52 61 72 21
    if (ext === ".rar") {
      return buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21;
    }
    // 7-Zip: 37 7A BC AF
    if (ext === ".7z") {
      return buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf;
    }

    return true;
  } catch {
    return false;
  }
};

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
          message: "Dung lượng tệp vượt quá giới hạn cho phép (tối đa 600MB).",
        });
      }
      return res.status(400).json({
        status: "error",
        message: err.message || "Lỗi khi xử lý tải lên tệp tin.",
      });
    }

    // Kiểm tra tính toàn vẹn và chữ ký Magic Bytes của tệp tin
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const isValid = validateMagicBytes(req.file.path, ext);
      if (!isValid) {
        try {
          fs.unlinkSync(req.file.path); // Xóa ngay tệp độc hại khỏi đĩa
        } catch { /* ignore */ }
        return res.status(400).json({
          status: "error",
          message: "Nội dung tệp tin không khớp với định dạng khai báo (Chữ ký Magic Bytes không hợp lệ).",
        });
      }
    }

    next();
  });
};
