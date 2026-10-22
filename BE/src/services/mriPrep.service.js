import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { contrastConsentPending } from "./contrastConsent.service.js";

/**
 * Chuẩn bị chụp MRI cho bệnh nhân: hướng dẫn trước khi chụp + phiếu sàng lọc an toàn MRI bệnh nhân tự khai ở nhà.
 * Phần tự khai chỉ để kỹ thuật viên biết trước: KTV vẫn phải hỏi lại và xác nhận bảng kiểm an toàn tại buồng máy
 * (visit.mriSafetyChecklist, visit.service: submitMriSafetyCheckService). Không tự đánh dấu "đạt" thay KTV.
 */

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** `danger`: có thì có thể là chống chỉ định (từ trường mạnh hút kim loại, làm hỏng thiết bị) → KTV/bác sĩ phải kiểm tra trước. */
export const MRI_SCREENING_QUESTIONS = [
  { key: "pacemaker", danger: true, text: "Bạn có đặt máy tạo nhịp tim hoặc máy khử rung tim (ICD) không?" },
  { key: "aneurysmClip", danger: true, text: "Bạn có kẹp mạch máu não (kẹp túi phình) sau phẫu thuật không?" },
  { key: "cochlearImplant", danger: true, text: "Bạn có cấy ốc tai điện tử, máy kích thích thần kinh hoặc bơm thuốc cấy dưới da không?" },
  { key: "metalFragments", danger: true, text: "Trong người bạn có mảnh kim loại không (mảnh đạn, mảnh kim loại bắn vào mắt khi hàn, mài, cắt sắt)?" },
  { key: "implants", danger: false, text: "Bạn có van tim nhân tạo, stent, khớp nhân tạo, nẹp vít hoặc dụng cụ cấy ghép khác không?" },
  { key: "recentSurgery", danger: false, text: "Bạn có phẫu thuật trong vòng 6 tuần gần đây không?" },
  { key: "pregnant", danger: false, text: "Bạn đang mang thai hoặc có thể đang mang thai không?" },
  { key: "claustrophobia", danger: false, text: "Bạn có sợ không gian hẹp, kín (dễ hoảng khi nằm trong máy chụp) không?" },
  { key: "cannotLieStill", danger: false, text: "Bạn có khó nằm yên 30 đến 45 phút không (do đau, run, ho)?" },
  { key: "tattoo", danger: false, text: "Bạn có hình xăm lớn, phun xăm (môi, lông mày) hoặc miếng dán thuốc trên da không?" },
];
export const SCREENING_ANSWERS = ["yes", "no", "unsure"];
const KEYS = MRI_SCREENING_QUESTIONS.map((q) => q.key);
const MAX_DETAILS = 500;

/** Câu trả lời bệnh nhân gửi → bản sạch; thiếu câu, giá trị lạ hoặc sai kiểu → 400. */
export const normalizeScreening = (body) => {
  const answers = body?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw httpError(400, "Hãy trả lời đủ các câu hỏi.");
  if (Object.keys(answers).some((k) => !KEYS.includes(k))) throw httpError(400, "Câu trả lời không hợp lệ.");
  if (KEYS.some((k) => !SCREENING_ANSWERS.includes(answers[k]))) throw httpError(400, "Hãy trả lời đủ các câu hỏi (Có / Không / Không rõ).");
  const details = body.details ?? "";
  if (typeof details !== "string") throw httpError(400, "Ghi chú không hợp lệ.");
  return {
    answers: Object.fromEntries(KEYS.map((k) => [k, answers[k]])),
    details: details.slice(0, 2000).replace(/\s+/g, " ").trim().slice(0, MAX_DETAILS),
  };
};

/** "danger": câu nguy hiểm trả lời có / không rõ; "attention": câu khác trả lời có / không rõ; "clear": không có gì. */
export const screeningLevel = (answers) => {
  const flagged = MRI_SCREENING_QUESTIONS.filter((q) => answers?.[q.key] === "yes" || answers?.[q.key] === "unsure");
  if (flagged.some((q) => q.danger)) return "danger";
  return flagged.length ? "attention" : "clear";
};

const COMMON = [
  "Đến trước giờ chụp khoảng 30 phút để làm thủ tục và kiểm tra an toàn.",
  "Mang theo giấy tờ tùy thân, thẻ BHYT và phim, kết quả chụp cũ (nếu có) để bác sĩ so sánh.",
  "Tháo hết đồ kim loại trước khi vào phòng chụp: trang sức, kẹp tóc, đồng hồ, thắt lưng, răng giả tháo lắp, máy trợ thính. Không mang điện thoại, thẻ ngân hàng vào phòng chụp.",
  "Nên mặc quần áo thoải mái, không có khuy hay khóa kim loại; bạn có thể được thay áo của bệnh viện.",
  "Thời gian chụp khoảng 20 đến 45 phút. Máy kêu khá to, bạn sẽ được phát nút bịt tai; hãy nằm yên trong lúc chụp để hình ảnh rõ nét.",
  "Vẫn uống thuốc hằng ngày như bình thường, trừ khi bác sĩ dặn khác.",
];
const CONTRAST = [
  "Nhịn ăn khoảng 4 đến 6 giờ trước khi chụp vì có tiêm thuốc cản quang (vẫn uống nước lọc được), trừ khi bệnh viện dặn khác.",
  "Ký phiếu đồng thuận tiêm thuốc cản quang trên ứng dụng trước khi đến.",
  "Báo cho nhân viên nếu bạn bị bệnh thận, từng dị ứng với thuốc cản quang, hoặc đang cho con bú.",
  "Sau khi chụp, uống nhiều nước để thuốc được thải ra ngoài nhanh hơn.",
];

/** Hướng dẫn trước khi chụp: mẫu chung + phần riêng khi có tiêm thuốc cản quang + ghi chú bác sĩ nhập khi chỉ định. */
export const mriPreparation = (visit) => ({
  items: [...(visit?.mriOrder?.withContrast ? CONTRAST : []), ...COMMON],
  doctorNote: String(visit?.mriOrder?.instructions || "").replace(/\s+/g, " ").trim().slice(0, 1000),
});

const PREP_STATUSES = ["chờ chụp", "chờ chụp lại", "chờ chụp sau phẫu thuật"]; // còn khai / sửa phiếu được
const SHOW_STATUSES = [...PREP_STATUSES, "đang chụp"]; // KTV xác nhận an toàn là tự sang "đang chụp": vẫn hiện, ở dạng khoá
const PREP_DAYS = 14;

/** Lượt khám đang chờ chụp gần nhất của bệnh nhân → dữ liệu cho màn "Chuẩn bị chụp MRI", hoặc null. */
export const getMriPrep = async (patientId, now = new Date()) => {
  const visit = await Visit.findOne({
    patientId,
    isDeleted: { $ne: true },
    status: { $in: SHOW_STATUSES },
    "mriOrder.orderedAt": { $ne: null },
    createdAt: { $gte: new Date(now.getTime() - PREP_DAYS * 24 * 3600 * 1000) },
  })
    .sort({ createdAt: -1 })
    .select("status mriOrder patientMriScreening mriSafetyChecklist.isScreened hospitalId")
    .setOptions({ bypassTenancy: true }) // lọc tường minh theo đúng bệnh nhân
    .lean();
  if (!visit) return null;
  const s = visit.patientMriScreening;
  return {
    visitId: String(visit._id),
    region: visit.mriOrder?.region || "",
    withContrast: !!visit.mriOrder?.withContrast,
    orderedAt: visit.mriOrder?.orderedAt || null,
    preparation: mriPreparation(visit),
    questions: MRI_SCREENING_QUESTIONS,
    screening: s?.declaredAt ? { answers: s.answers, details: s.details || "", declaredAt: s.declaredAt, level: s.level } : null,
    locked: !!visit.mriSafetyChecklist?.isScreened || !PREP_STATUSES.includes(visit.status), // KTV đã kiểm tra / đang chụp
    consentPending: await contrastConsentPending(visit),
  };
};

/** Bệnh nhân khai / sửa phiếu sàng lọc của lượt khám `visitId` (của chính mình, đang chờ chụp, KTV chưa kiểm tra). */
export const saveMriScreening = async (patientId, visitId, body, now = new Date()) => {
  if (typeof visitId !== "string" || !mongoose.isValidObjectId(visitId)) throw httpError(404, "Không tìm thấy lượt khám.");
  const clean = normalizeScreening(body);
  const visit = await Visit.findOne({ _id: visitId, patientId, isDeleted: { $ne: true } })
    .select("status mriOrder.orderedAt mriSafetyChecklist.isScreened")
    .setOptions({ bypassTenancy: true })
    .lean();
  if (!visit) throw httpError(404, "Không tìm thấy lượt khám.");
  if (!visit.mriOrder?.orderedAt || !PREP_STATUSES.includes(visit.status)) throw httpError(409, "Lượt khám này hiện không chờ chụp MRI.");
  if (visit.mriSafetyChecklist?.isScreened) throw httpError(409, "Kỹ thuật viên đã kiểm tra an toàn cho bạn. Nếu cần thay đổi, hãy báo trực tiếp với kỹ thuật viên.");
  const level = screeningLevel(clean.answers);
  // điều kiện lặp lại trong lệnh ghi: không ghi đè nếu KTV vừa kiểm tra / vừa bắt đầu chụp trong lúc này
  const res = await Visit.updateOne(
    { _id: visitId, patientId, status: { $in: PREP_STATUSES }, "mriSafetyChecklist.isScreened": { $ne: true } },
    { $set: { patientMriScreening: { ...clean, level, declaredAt: now } } }
  ).setOptions({ bypassTenancy: true });
  if (!res.matchedCount) throw httpError(409, "Lượt khám vừa thay đổi trạng thái. Hãy tải lại trang.");
  return { level, declaredAt: now };
};
