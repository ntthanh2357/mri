/**
 * Đọc kích thước ảnh (rộng × cao, pixel) trực tiếp từ header tệp, không cần thư viện ảnh.
 * Hỗ trợ PNG, JPEG, BMP, WebP. Không nhận dạng được → null.
 * Dùng để đổi tọa độ khối u AI trả về (pixel trên ảnh gốc) sang tỉ lệ 0..1 cho trình xem.
 */
export const getImageDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;

  // PNG: chữ ký 8 byte, IHDR: rộng/cao (uint32 BE) tại byte 16/20
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // JPEG: duyệt các marker tới khung SOF (C0..CF trừ C4 DHT, C8 JPG, CC DAC)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break; // hết ảnh / bắt đầu dữ liệu nén mà chưa gặp SOF
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += 2 + length;
    }
    return null;
  }

  // BMP: "BM", rộng/cao int32 LE tại 18/22 (cao âm = ảnh lưu từ trên xuống)
  if (buffer[0] === 0x42 && buffer[1] === 0x4d && buffer.length >= 26) {
    const width = Math.abs(buffer.readInt32LE(18));
    const height = Math.abs(buffer.readInt32LE(22));
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" && buffer.length >= 30) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
  }
  return null;
};

export default getImageDimensions;
