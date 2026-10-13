/**
 * Gọi AI service (FastAPI, endpoint /ocr_document) để đọc chữ trong ảnh giấy tờ.
 * AI service cũng trả về bản ảnh đã chuẩn hoá (JPEG, xoay đúng chiều, thu nhỏ, không còn EXIF/GPS) để lưu thay file gốc.
 * Ranh giới mạng ra ngoài: luôn có timeout, không retry (mỗi lần gọi tốn lượt Gemini).
 */
const aiBaseUrl = () =>
  (process.env.AI_SERVER_URL || "http://localhost:8000").replace(/\/predict\/?$/, "").replace(/\/+$/, "");

/**
 * `autocrop`: để AI service tự dò mép giấy, cắt nền và nắn thẳng (OpenCV).
 * @returns {Promise<{ title: string, text: string, fields: object, image: Buffer, failed: boolean, cropped: boolean }>} `failed` = ảnh hợp lệ nhưng chưa đọc được chữ.
 * Ném lỗi có `status: 400` khi AI service báo ảnh không hợp lệ; lỗi khác = AI service không dùng được.
 */
export const ocrDocumentImage = async (buffer, mimeType, { timeoutMs = 45000, autocrop = true } = {}) => {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `document.${mimeType.split("/")[1]}`);

  const res = await fetch(`${aiBaseUrl()}/ocr_document?autocrop=${autocrop ? "true" : "false"}`, { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`AI server trả về ${res.status}`);
  const data = await res.json();
  if (data?.code === "invalid_image") throw Object.assign(new Error("Ảnh không hợp lệ hoặc có kích thước quá lớn."), { status: 400 });
  if (!data?.image_jpeg_base64) throw new Error("AI server không trả về ảnh đã chuẩn hoá");
  return {
    title: String(data.title || ""),
    text: String(data.text || ""),
    fields: data.fields,
    image: Buffer.from(String(data.image_jpeg_base64), "base64"),
    failed: Boolean(data.ocr_failed),
    cropped: Boolean(data.cropped),
  };
};
