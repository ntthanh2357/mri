import { Visit } from "../models/visit.model.js";
import { contrastConsentPending } from "./contrastConsent.service.js";

/**
 * UC-PAT-05 — Bệnh nhân theo dõi lượt khám của mình theo 6 bước dễ hiểu.
 * 16 trạng thái nội bộ của lượt khám (dành cho nhân viên) được quy về các bước này, kèm 1 câu nói rõ bạn đang ở đâu
 * và cần làm gì tiếp. Không trả tên trạng thái nội bộ (vd. "lỗi AI", "chờ kết quả AI") để bệnh nhân không lo lắng vô cớ.
 * Lượt khám chưa lưu lịch sử đổi trạng thái: giờ của từng bước suy từ dữ liệu sẵn có (giờ tạo, giờ đo sinh hiệu, giờ chỉ định chụp).
 */

export const PATIENT_STEPS = [
  { key: "checkin", label: "Tiếp đón" },
  { key: "waiting", label: "Chờ khám" },
  { key: "exam", label: "Khám bệnh" },
  { key: "imaging", label: "Chụp MRI" },
  { key: "result", label: "Chờ kết quả" },
  { key: "done", label: "Hoàn tất" },
];
const ORDER = PATIENT_STEPS.map((s) => s.key);

const STAGE_OF = {
  "đang chờ": "waiting",
  "đang khám": "exam",
  "chờ chụp": "imaging",
  "đang chụp": "imaging",
  "chờ chụp lại": "imaging",
  "chờ chụp sau phẫu thuật": "imaging",
  "chờ kết quả AI": "result",
  "lỗi AI": "result",
  "chờ bác sĩ đọc": "result",
  "chờ hội chẩn": "result",
  "chờ nhập viện": "done",
  "tái khám định kỳ": "done",
  "hoàn tất": "done",
  "đã đóng": "done",
};
const CANCELLED = ["đã hủy", "no_show"];

const dateOrNull = (d) => (d ? new Date(d) : null);

const messageOf = (visit, { doctorName, region }) => {
  const doctor = doctorName || "Bác sĩ"; // tên trong hồ sơ đã kèm học hàm (vd. TS.BS.CKII ...)
  const where = region ? ` ${region}` : "";
  switch (visit.status) {
    case "đang chờ":
      return visit.vitals?.measuredAt || visit.vitals?.bloodPressure
        ? "Đã đo sinh hiệu. Vui lòng ngồi chờ, bác sĩ sẽ gọi bạn vào khám."
        : "Điều dưỡng sẽ mời bạn đo sinh hiệu (huyết áp, mạch, nhiệt độ) rồi bác sĩ gọi vào khám.";
    // Đo sinh hiệu xong là hệ thống tự chuyển sang "đang khám" (visit.controller: updateVitals), dù bác sĩ có thể chưa gọi vào
    case "đang khám":
      return `${visit.vitals?.measuredAt ? "Đã đo sinh hiệu. " : ""}${doctor} sẽ khám cho bạn. Nếu chưa được gọi, vui lòng chờ ở khu khám bệnh.`;
    case "chờ chụp":
      return `Bác sĩ đã chỉ định chụp MRI${where}. Vui lòng tới khu chụp MRI và chờ kỹ thuật viên gọi.`;
    case "đang chụp":
      return "Bạn đang được chụp MRI. Hãy nằm yên theo hướng dẫn của kỹ thuật viên.";
    case "chờ chụp lại":
      return "Cần chụp bổ sung một số hình. Kỹ thuật viên sẽ gọi bạn, bạn không phải làm thêm thủ tục.";
    case "chờ chụp sau phẫu thuật":
      return `Bạn có lịch chụp MRI${where} kiểm tra sau phẫu thuật.`;
    case "chờ hội chẩn":
      return "Đã chụp xong. Các bác sĩ đang cùng xem phim để thống nhất kết quả và hướng điều trị.";
    case "chờ kết quả AI":
    case "lỗi AI":
    case "chờ bác sĩ đọc":
      return "Đã chụp xong. Bác sĩ đang xem phim của bạn; kết quả sẽ hiện ở mục Phim MRI & CT khi bác sĩ ký.";
    case "chờ nhập viện":
      return "Bác sĩ chỉ định nhập viện để điều trị. Nhân viên sẽ hướng dẫn bạn làm thủ tục nhập viện.";
    case "tái khám định kỳ":
      return "Lượt khám đã xong. Bác sĩ hẹn bạn tái khám định kỳ, hãy giữ đúng lịch hẹn.";
    case "hoàn tất":
    case "đã đóng":
      return "Lượt khám đã hoàn tất. Cảm ơn bạn.";
    case "no_show":
      return "Lượt khám đã huỷ vì bạn không có mặt khi được gọi. Hãy liên hệ quầy tiếp đón nếu bạn vẫn cần khám.";
    case "đã hủy":
      return "Lượt khám đã được huỷ. Hãy liên hệ quầy tiếp đón nếu bạn cần khám lại.";
    default:
      return "Vui lòng chờ, nhân viên sẽ hướng dẫn bạn bước tiếp theo.";
  }
};

/** Lượt khám (đã populate doctorId) → bản cho bệnh nhân: 6 bước, câu giải thích, thông tin chụp MRI. */
export const toVisitProgress = (visit) => {
  const cancelled = CANCELLED.includes(visit.status);
  const stage = STAGE_OF[visit.status] || "waiting";
  const mriOrdered = !!visit.mriOrder?.orderedAt || ["imaging", "result"].includes(stage);
  const current = cancelled ? -1 : ORDER.indexOf(stage);
  const doctorName = visit.doctorId?.profile?.name || "";
  const region = visit.mriOrder?.region || "";

  const steps = PATIENT_STEPS.map((step, i) => {
    let state;
    if (step.key === "checkin") state = "done";
    else if (cancelled) state = "todo";
    else if (i < current) state = "done";
    else if (i === current) state = "current";
    else state = "todo";
    // lượt khám xong mà không chỉ định chụp: 2 bước chụp không áp dụng
    if (!mriOrdered && stage === "done" && (step.key === "imaging" || step.key === "result")) state = "skipped";
    const at = step.key === "checkin" ? dateOrNull(visit.createdAt)
      : step.key === "waiting" ? dateOrNull(visit.vitals?.measuredAt) // giờ đo sinh hiệu
        : step.key === "imaging" ? dateOrNull(visit.mriOrder?.orderedAt)
          : null;
    return { ...step, state, at };
  });

  return {
    visitId: visit._id ? String(visit._id) : null,
    date: dateOrNull(visit.date || visit.createdAt),
    steps,
    current: cancelled ? null : stage,
    finished: !cancelled && stage === "done",
    cancelled,
    message: messageOf(visit, { doctorName, region }),
    doctorName,
    mri: {
      ordered: mriOrdered,
      region,
      withContrast: !!visit.mriOrder?.withContrast,
      screening: visit.patientMriScreening?.declaredAt ? visit.patientMriScreening.level || null : null, // bệnh nhân đã tự khai phiếu sàng lọc
      screened: !!visit.mriSafetyChecklist?.isScreened, // KTV đã kiểm tra tại buồng máy
    },
  };
};

const ACTIVE_DAYS = 3; // lượt chưa xong cũ hơn thế coi như dữ liệu treo, không hiện
const RESULT_DAYS = 14; // chờ kết quả / hội chẩn có thể mất vài ngày
const vnDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
const DAY_MS = 24 * 3600 * 1000;

/** Lượt khám nên hiện cho bệnh nhân (mới nhất trước), hoặc null. */
export const findCurrentVisit = async (patientId, now = new Date()) => {
  const visits = await Visit.find({ patientId, isDeleted: { $ne: true }, createdAt: { $gte: new Date(now.getTime() - RESULT_DAYS * DAY_MS) } })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("doctorId", "profile.name")
    .select("status createdAt updatedAt date vitals.measuredAt vitals.bloodPressure mriOrder doctorId hospitalId patientId patientMriScreening.level patientMriScreening.declaredAt mriSafetyChecklist.isScreened")
    .setOptions({ bypassTenancy: true }) // lọc tường minh theo đúng bệnh nhân
    .lean();
  const today = vnDay(now);
  return visits.find((v) => {
    const stage = STAGE_OF[v.status] || "waiting";
    if (CANCELLED.includes(v.status) || stage === "done") return vnDay(new Date(v.updatedAt || v.createdAt)) === today;
    if (stage === "result") return true; // trong 14 ngày (đã lọc ở truy vấn)
    return now.getTime() - new Date(v.createdAt).getTime() <= ACTIVE_DAYS * DAY_MS;
  }) || null;
};

/** Dữ liệu cho màn bệnh nhân: tiến trình lượt khám hiện tại, kèm còn phiếu cản quang chưa ký hay không. */
export const getVisitProgress = async (patientId, now = new Date()) => {
  const visit = await findCurrentVisit(patientId, now);
  if (!visit) return null;
  const progress = toVisitProgress(visit);
  progress.mri.consentPending = progress.current === "imaging" ? await contrastConsentPending(visit) : false;
  return progress;
};
