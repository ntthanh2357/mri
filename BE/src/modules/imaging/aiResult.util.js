import { ImagingResult } from "./models/imagingResult.model.js";

/**
 * Chuẩn hóa và ghi kết quả AI vào hồ sơ CĐHA — dùng chung cho mọi đường AI (KTV tự động, bác sĩ bấm phân tích,
 * ai-pipeline) để hồ sơ luôn cùng một dạng và cùng các chốt an toàn:
 *  - Không bao giờ sửa báo cáo ĐÃ KÝ (trước đây AI chạy ngầm trả kết quả sau khi ký đã ghi đè kết luận của bác sĩ).
 *  - Chỉ điền nháp mô tả/kết luận khi chúng còn đúng chữ giữ chỗ (bác sĩ chưa sửa).
 *  - Khung khối u chỉ lấy từ tọa độ AI trả về, đổi sang tỉ lệ 0..1 theo kích thước thật của ảnh — không có thì null.
 */

export const AI_CLASS_NAMES = Object.freeze(["glioma", "meningioma", "pituitary", "notumor"]);
export const KTV_FINDINGS_PLACEHOLDER = "Chờ bác sĩ đọc mô tả hình ảnh.";
export const KTV_CONCLUSION_PLACEHOLDER = "Chờ kết quả chẩn đoán từ bác sĩ.";

const round4 = (v) => Math.round(v * 10000) / 10000;

/** tumor_location (pixel trên ảnh gốc) + kích thước ảnh → { x, y, width, height } tỉ lệ 0..1, hoặc null. */
export const normalizeBoundingBox = (location, dims) => {
  if (!location || !dims?.width || !dims?.height) return null;
  const x = Number(location.x);
  const y = Number(location.y);
  const w = Number(location.width ?? location.w);
  const h = Number(location.height ?? location.h);
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0) return null;
  if (x >= dims.width || y >= dims.height) return null;
  const width = Math.min(w, dims.width - x) / dims.width;
  const height = Math.min(h, dims.height - y) / dims.height;
  if (width <= 0 || height <= 0) return null;
  return {
    x: round4(x / dims.width),
    y: round4(y / dims.height),
    width: round4(width),
    height: round4(height),
    source: location.source || null,
    imageWidth: dims.width,
    imageHeight: dims.height,
  };
};

/** Hợp lệ để vẽ: 4 số trong [0,1], rộng/cao > 0. Dùng ở chỗ đọc dữ liệu cũ. */
export const isValidBoundingBox = (box) =>
  Boolean(box) &&
  ["x", "y", "width", "height"].every((k) => Number.isFinite(Number(box[k])) && Number(box[k]) >= 0 && Number(box[k]) <= 1) &&
  Number(box.width) > 0 && Number(box.height) > 0;

/** Kết quả AI service → bản ghi aiReport gọn, không chứa ảnh base64. null nếu kết quả không hợp lệ. */
export const buildAiReport = (aiData, { dims = null, source = "manual", analyzedBy = null } = {}) => {
  if (!aiData || !AI_CLASS_NAMES.includes(aiData.class_name)) return null;
  const tumorLocation = aiData.class_name !== "notumor" ? aiData.tumor_location || null : null;
  const boundingBox = isValidBoundingBox(aiData.bounding_box)
    ? aiData.bounding_box
    : tumorLocation
      ? normalizeBoundingBox(tumorLocation, dims)
      : null;
  const annotated = typeof aiData.annotated_image === "string" && !aiData.annotated_image.startsWith("data:") ? aiData.annotated_image : null;
  const confidence = Number(aiData.confidence);
  return {
    class_name: aiData.class_name,
    confidence: Number.isFinite(confidence) ? confidence : null,
    all_probabilities: aiData.all_probabilities || null,
    is_conflict: Boolean(aiData.is_conflict),
    consensus_message: aiData.consensus_message || "",
    clinical_report: aiData.clinical_report || "",
    tumor_location: tumorLocation,
    bounding_box: boundingBox,
    annotated_image: annotated,
    storageHeatmapFileId: aiData.storageHeatmapFileId || null,
    heatmapStreamUrl: aiData.heatmapStreamUrl || null,
    source,
    analyzedBy: analyzedBy ? String(analyzedBy) : null,
    analyzedAt: new Date(),
  };
};

export const aiSuggestionText = (aiReport) => {
  const label = aiReport.class_name === "notumor" ? "Không phát hiện khối u" : `Nghi ngờ ${aiReport.class_name.toUpperCase()}`;
  return {
    label,
    findingsLine: `[AI Tự Động Phân Tích]: ${label} (Độ tin cậy: ${aiReport.confidence ?? "—"}%).`,
    conclusion: `AI gợi ý: ${label}. Chờ bác sĩ xác nhận.`,
  };
};

/**
 * Ghi kết quả AI vào hồ sơ CĐHA của đúng viện, chỉ khi hồ sơ CHƯA KÝ.
 * fillDraft: { findings, expectedFindings, conclusion } — chỉ ghi khi giá trị hiện tại còn đúng như lúc tạo.
 * Trả về { applied, reason }.
 */
export const applyAiResultToImaging = async ({ imagingResultId, hospitalId, aiReport, fillDraft = null, representativeSliceUrl = null }) => {
  if (!imagingResultId || !hospitalId || !aiReport) return { applied: false, reason: "missing" };
  const base = { _id: imagingResultId, hospitalId, isSigned: { $ne: true } };
  const opts = { bypassTenancy: true };
  const res = await ImagingResult.updateOne(base, { $set: { aiReport, aiStatus: "completed", aiError: "" } }).setOptions(opts);
  if (!res.matchedCount) {
    const exists = await ImagingResult.exists({ _id: imagingResultId, hospitalId }).setOptions(opts);
    return { applied: false, reason: exists ? "signed" : "not_found" };
  }
  if (representativeSliceUrl) {
    await ImagingResult.updateOne(
      { ...base, $or: [{ representativeSliceUrl: null }, { representativeSliceUrl: { $exists: false } }, { representativeSliceUrl: "" }] },
      { $set: { representativeSliceUrl } }
    ).setOptions(opts);
  }
  if (fillDraft?.findings && fillDraft.expectedFindings !== undefined) {
    await ImagingResult.updateOne({ ...base, findings: fillDraft.expectedFindings }, { $set: { findings: fillDraft.findings } }).setOptions(opts);
  }
  if (fillDraft?.conclusion) {
    await ImagingResult.updateOne({ ...base, conclusion: KTV_CONCLUSION_PLACEHOLDER }, { $set: { conclusion: fillDraft.conclusion } }).setOptions(opts);
  }
  return { applied: true, reason: null };
};

// Trạng thái lượt khám đang chờ AI: AI lỗi thì chuyển sang "lỗi AI" (hiện trong hàng đợi bác sĩ để đọc trực tiếp/chạy lại)
export const AI_PENDING_VISIT_STATUSES = ["chờ kết quả AI", "đang chụp", "chờ chụp sau phẫu thuật"];

/**
 * Ghi nhận phân tích AI thất bại một cách trung thực: hồ sơ (chưa ký) ghi aiStatus=failed + lý do, lượt khám đang
 * chờ AI chuyển "lỗi AI", báo bác sĩ chỉ định. Không bao giờ thay bằng kết quả mặc định (vd. "notumor").
 */
export const markAiAnalysisFailed = async ({ imagingResultId = null, hospitalId, visitId = null, doctorId = null, senderId = null, reason = "" }) => {
  const opts = { bypassTenancy: true };
  const why = String(reason || "Không rõ nguyên nhân").slice(0, 300);
  if (imagingResultId && hospitalId) {
    await ImagingResult.updateOne({ _id: imagingResultId, hospitalId, isSigned: { $ne: true } }, { $set: { aiStatus: "failed", aiError: why } }).setOptions(opts);
  }
  let visitMoved = false;
  if (visitId && hospitalId) {
    const { Visit } = await import("../../models/visit.model.js");
    const r = await Visit.updateOne({ _id: visitId, hospitalId, status: { $in: AI_PENDING_VISIT_STATUSES } }, { $set: { status: "lỗi AI" } }).setOptions(opts);
    visitMoved = r.modifiedCount > 0;
  }
  if (doctorId && hospitalId) {
    try {
      const { createNotificationInternal } = await import("../../controllers/notification.controller.js");
      await createNotificationInternal({
        hospitalId,
        recipientId: doctorId,
        senderId: senderId || null,
        type: "ai_failed",
        title: "⚠️ Phân tích AI không thành công",
        message: `Không chạy được phân tích AI cho phim chụp (${why}). Bác sĩ đọc phim trực tiếp hoặc chạy lại phân tích AI.`,
        relatedId: visitId || imagingResultId,
      });
    } catch (err) {
      console.warn("⚠️ Không gửi được thông báo AI lỗi:", err.message);
    }
  }
  return { visitMoved };
};
