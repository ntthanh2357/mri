import crypto from "crypto";

/**
 * Sinh khóa mã hóa 256-bit ngẫu nhiên chuẩn (64 ký tự hex)
 */
export const generateRandomKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Lấy khóa mã hóa 32-byte từ biến môi trường hoặc khóa ngẫu nhiên dự phòng
 */
export const getEncryptionKey = (customKey = null) => {
  const hexKey = customKey || process.env.FILE_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  if (!hexKey) {
    throw new Error("Chưa cấu hình FILE_ENCRYPTION_KEY trong .env");
  }
  const keyBuffer = Buffer.from(hexKey, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(`FILE_ENCRYPTION_KEY không hợp lệ: cần 32 bytes (64 ký tự hex), nhận được ${keyBuffer.length} bytes.`);
  }
  return keyBuffer;
};

/**
 * Mã hóa nhị phân bằng thuật toán chuẩn y tế AES-256-GCM
 * @param {Buffer} buffer - Dữ liệu tệp thô
 * @param {string} [customKeyHex] - Khóa hex tùy chọn (nếu có)
 * @returns {{ encryptedBuffer: Buffer, ivHex: string, authTagHex: string }}
 */
export const encryptBuffer = (buffer, customKeyHex = null) => {
  const key = getEncryptionKey(customKeyHex);
  const iv = crypto.randomBytes(12); // Chuẩn GCM dùng 12 bytes IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes thẻ xác thực toàn vẹn

  return {
    encryptedBuffer: encrypted,
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
  };
};

/**
 * Giải mã dữ liệu và đối soát tính toàn vẹn (Integrity Check)
 * @param {Buffer} encryptedBuffer - Dữ liệu mã hóa
 * @param {string} ivHex - Vector khởi tạo (Hex)
 * @param {string} authTagHex - Thẻ xác thực (Hex)
 * @param {string} [customKeyHex] - Khóa hex tùy chọn
 * @returns {Buffer} Dữ liệu giải mã nguyên bản
 */
export const decryptBuffer = (encryptedBuffer, ivHex, authTagHex, customKeyHex = null) => {
  const key = getEncryptionKey(customKeyHex);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted;
  } catch (err) {
    throw new Error("Lỗi giải mã hoặc tệp tin đã bị giả mạo/can thiệp trái phép (AuthTag Mismatch): " + err.message);
  }
};

/**
 * Tính mã băm SHA-256 của tệp để kiểm định tính toàn vẹn
 * @param {Buffer} buffer
 * @returns {string} SHA-256 hex string
 */
export const computeSha256 = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

/**
 * Chuẩn hóa tên chuỗi xung MRI thực tế (loại bỏ ký tự đặc biệt, lỗi font)
 * Ví dụ:
 * - "Ax_T2_FLAIR_FS_2" -> "T2_FLAIR_axial"
 * - "3D_Ax_T1_MPRAGE_C+_12" -> "T1_MPRAGE_C+_axial"
 * - "ADC_(10_6_mm┬▓s)_750" -> "ADC_map"
 * @param {string} rawSequence
 * @returns {string}
 */
export const cleanSequenceName = (rawSequence) => {
  if (!rawSequence) return "general_series";

  let clean = rawSequence.trim();

  // Bắt các chuỗi xung phổ biến
  if (/ADC/i.test(clean)) return "ADC_map";
  if (/DWI/i.test(clean)) return "DWI_b1000";
  if (/Localizer/i.test(clean)) return "Localizers";
  if (/Screen.*Save/i.test(clean)) return "Screen_Save";

  const isAxial = /Ax|AX/i.test(clean);
  const isCoronal = /Cor|COR/i.test(clean);
  const isSagittal = /Sag|SAG/i.test(clean);
  const orientation = isAxial ? "axial" : isCoronal ? "coronal" : isSagittal ? "sagittal" : "";

  let baseType = "";
  if (/FLAIR/i.test(clean)) {
    baseType = /T1/i.test(clean) ? "T1_FLAIR" : "T2_FLAIR";
  } else if (/MPRAGE/i.test(clean)) {
    baseType = "T1_MPRAGE";
  } else if (/TOF/i.test(clean)) {
    baseType = "TOF_MRA";
  } else if (/T1/i.test(clean)) {
    baseType = "T1_weighted";
  } else if (/T2/i.test(clean)) {
    baseType = "T2_weighted";
  } else {
    baseType = clean.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  const hasContrast = /C\+|Contrast/i.test(clean);
  const contrastSuffix = hasContrast ? "_C+" : "";

  return [baseType + contrastSuffix, orientation].filter(Boolean).join("_");
};
