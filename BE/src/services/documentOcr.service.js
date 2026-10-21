/**
 * Gọi AI service (FastAPI, endpoint /ocr_document) để đọc chữ trong ảnh giấy tờ.
 * AI service cũng trả về bản ảnh đã chuẩn hoá (JPEG, xoay đúng chiều, thu nhỏ, không còn EXIF/GPS) để lưu thay file gốc.
 * Ranh giới mạng ra ngoài: luôn có timeout, không retry (mỗi lần gọi tốn lượt Gemini).
 */
export const aiBaseUrl = () =>
  (process.env.AI_SERVER_URL || "http://localhost:8000").replace(/\/predict\/?$/, "").replace(/\/+$/, "");

/**
 * `autocrop`: để AI service tự dò mép giấy, cắt nền và nắn thẳng (OpenCV).
 * `force`: bệnh nhân chọn "vẫn dùng ảnh này" dù ảnh kém; không có thì ảnh kém bị từ chối với lỗi 422 / POOR_QUALITY.
 * @returns {Promise<{ title: string, text: string, fields: object, image: Buffer, failed: boolean, cropped: boolean, textOnly: boolean }>} `failed` = ảnh hợp lệ nhưng chưa đọc được chữ.
 * Ném lỗi có `status: 400` khi AI service báo ảnh không hợp lệ; lỗi khác = AI service không dùng được.
 */
export const ocrDocumentImage = async (buffer, mimeType, { timeoutMs = 45000, autocrop = true, force = false } = {}) => {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `document.${mimeType.split("/")[1]}`);

  const res = await fetch(`${aiBaseUrl()}/ocr_document?autocrop=${autocrop ? "true" : "false"}&force=${force ? "true" : "false"}`, { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`AI server trả về ${res.status}`);
  const data = await res.json();
  // Ảnh quá mờ / nhỏ / tối: AI service không đọc (model sẽ bịa nội dung) trừ khi gọi với force
  if (data?.code === "poor_quality") {
    throw Object.assign(new Error("Ảnh không đủ rõ để đọc chính xác."), { status: 422, code: "POOR_QUALITY", reasons: data?.quality?.reasons });
  }
  if (data?.code === "invalid_image") throw Object.assign(new Error("Ảnh không hợp lệ hoặc có kích thước quá lớn."), { status: 400 });
  if (!data?.image_jpeg_base64) throw new Error("AI server không trả về ảnh đã chuẩn hoá");
  return {
    title: String(data.title || ""),
    text: String(data.text || ""),
    fields: data.fields,
    image: Buffer.from(String(data.image_jpeg_base64), "base64"),
    failed: Boolean(data.ocr_failed),
    cropped: Boolean(data.cropped),
    textOnly: Boolean(data.text_only), // chỉ chép được chữ, không tách được thông tin có cấu trúc
    review: data.review, // kết quả so 2 lần đọc độc lập: { verified, too_many, checks }
    truncated: Boolean(data.truncated), // giấy tờ dài hơn giới hạn của AI
    quality: data.quality, // { level: "good" | "fair" | "poor", reasons }
  };
};
