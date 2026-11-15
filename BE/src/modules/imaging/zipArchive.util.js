import zlib from "zlib";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp"]);

const IGNORE_SEQUENCE_TOKENS = [
  "localizer",
  "localiser",
  "scout",
  "screen_save",
  "screensave",
  "scrsave",
  "calib",
  "calibration",
  "survey",
  "__macosx",
];

// Precompute IEEE 802.3 CRC-32 lookup table so Stored ZIP generation works on every Node runtime.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/**
 * Sanitize archive/folder relative path: normalize separators, drop drive letters, `.` and `..`.
 */
export const sanitizeStudyRelativePath = (rawPath = "") => {
  const withoutDrive = String(rawPath || "").replace(/^[a-zA-Z]:/, "").replace(/\\/g, "/");
  const cleanParts = [];
  for (const seg of withoutDrive.split("/")) {
    const trimmed = seg.replace(/[\x00-\x1f]/g, "").trim();
    if (!trimmed || trimmed === "." || trimmed === "..") continue;
    cleanParts.push(trimmed);
  }
  return cleanParts.join("/");
};

export const isIgnoredStudyPath = (relPath = "") => {
  const lower = String(relPath || "").toLowerCase();
  const lastSlash = lower.lastIndexOf("/");
  const folder = lastSlash >= 0 ? lower.slice(0, lastSlash) : lower;
  return IGNORE_SEQUENCE_TOKENS.some((tok) => folder.includes(tok));
};

export const isSupportedStudyImageExt = (filePath = "") => {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
};

/**
 * Validate image magic bytes (JPEG, PNG, BMP, WEBP).
 */
export const hasValidImageMagicBytes = (buf, filename = "") => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === ".png") {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (ext === ".bmp") {
    return buf[0] === 0x42 && buf[1] === 0x4d;
  }
  if (ext === ".webp") {
    return buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return false;
};

/**
 * Safely extract image files from a standard ZIP buffer (Store=0 or Deflate=8).
 * Skips non-image files, symlinks, ignored sequences (localizer/scout), and prevents zip-slip/zip-bombs.
 */
export const extractImagesFromZipBuffer = (
  zipBuffer,
  {
    maxEntries = 4000,
    maxUncompressedBytes = 1500 * 1024 * 1024,
    maxSingleFileBytes = 50 * 1024 * 1024,
    skipIgnoredFolders = true,
  } = {}
) => {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) {
    throw new Error("Tệp ZIP không hợp lệ hoặc bị rỗng.");
  }

  // Locate End of Central Directory (PK\x05\x06)
  const minOffset = Math.max(0, zipBuffer.length - 65557);
  let eocdOffset = -1;
  for (let pos = zipBuffer.length - 22; pos >= minOffset; pos -= 1) {
    if (
      zipBuffer[pos] === 0x50 &&
      zipBuffer[pos + 1] === 0x4b &&
      zipBuffer[pos + 2] === 0x05 &&
      zipBuffer[pos + 3] === 0x06
    ) {
      eocdOffset = pos;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Không tìm thấy cấu trúc mục lục ZIP (EOCD).");
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error("Không hỗ trợ ZIP64 vượt ngưỡng 4GB; vui lòng tách ca chụp hoặc chọn thư mục ảnh trực tiếp.");
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new Error("Tệp ZIP bị hỏng cấu trúc Central Directory.");
  }
  if (totalEntries > maxEntries) {
    throw new Error(`Tệp ZIP chứa quá nhiều mục (${totalEntries} > ${maxEntries}).`);
  }

  const images = [];
  let ignoredCount = 0;
  let nonImageCount = 0;
  let totalInflatedBytes = 0;
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (cursor + 46 > cdOffset + cdSize) {
      throw new Error("Cấu trúc mục lục ZIP bị cắt ngang.");
    }
    const sig = zipBuffer.readUInt32LE(cursor);
    if (sig !== 0x02014b50) {
      throw new Error("Header mục lục ZIP không hợp lệ.");
    }

    const flags = zipBuffer.readUInt16LE(cursor + 8);
    const method = zipBuffer.readUInt16LE(cursor + 10);
    const compSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompSize = zipBuffer.readUInt32LE(cursor + 24);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const externalAttr = zipBuffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);

    const nameStart = cursor + 46;
    const rawName = zipBuffer
      .subarray(nameStart, nameStart + nameLen)
      .toString(flags & 0x0800 ? "utf8" : "latin1");
    cursor = nameStart + nameLen + extraLen + commentLen;

    // Skip directories and POSIX symlinks
    const isDir = rawName.endsWith("/") || rawName.endsWith("\\");
    const isSymlink = ((externalAttr >>> 16) & 0o170000) === 0o120000;
    if (isDir || isSymlink) continue;

    const relativePath = sanitizeStudyRelativePath(rawName);
    if (!relativePath) continue;

    if (!isSupportedStudyImageExt(relativePath)) {
      nonImageCount += 1;
      continue;
    }

    if (skipIgnoredFolders && isIgnoredStudyPath(relativePath)) {
      ignoredCount += 1;
      continue;
    }

    if (uncompSize > maxSingleFileBytes) {
      throw new Error(`Ảnh "${relativePath}" vượt giới hạn kích thước cho phép.`);
    }
    totalInflatedBytes += uncompSize;
    if (totalInflatedBytes > maxUncompressedBytes) {
      throw new Error("Tổng dung lượng giải nén ZIP vượt quá ngưỡng an toàn.");
    }

    if (localHeaderOffset + 30 > zipBuffer.length || zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Header dữ liệu của "${relativePath}" không hợp lệ.`);
    }
    const lfhNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const lfhExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
    if (dataStart + compSize > zipBuffer.length) {
      throw new Error(`Dữ liệu nén của "${relativePath}" bị thiếu.`);
    }

    const compSlice = zipBuffer.subarray(dataStart, dataStart + compSize);
    let fileBuf;
    if (method === 0) {
      fileBuf = Buffer.from(compSlice);
    } else if (method === 8) {
      fileBuf = zlib.inflateRawSync(compSlice, {
        maxOutputLength: Math.max(uncompSize, 1) + 4096,
      });
    } else {
      throw new Error(`Phương thức nén ZIP (${method}) chưa được hỗ trợ cho "${relativePath}".`);
    }

    if (!hasValidImageMagicBytes(fileBuf, relativePath)) {
      nonImageCount += 1;
      continue;
    }

    images.push({
      relativePath,
      filename: path.posix.basename(relativePath),
      buffer: fileBuf,
    });
  }

  return {
    images,
    stats: {
      totalEntries,
      extractedCount: images.length,
      ignoredCount,
      nonImageCount,
    },
  };
};

/**
 * Pack `{ relativePath, buffer }` entries into an uncompressed (Store, method=0) ZIP Buffer
 * so thousands of MRI slices can be shipped to AI service in one multipart upload field.
 */
export const buildStoredZipBuffer = (entries = []) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanName = sanitizeStudyRelativePath(entry.relativePath || "slice.jpg") || "slice.jpg";
    const nameBuf = Buffer.from(cleanName, "utf8");
    const dataBuf = Buffer.isBuffer(entry.buffer) ? entry.buffer : Buffer.from(entry.buffer || "");
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    lfh.writeUInt16LE(0, 8); // compression method: Store
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    localParts.push(lfh, nameBuf, dataBuf);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);

    centralParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
};

