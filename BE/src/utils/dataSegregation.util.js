import { FEATURES } from "../config/features.config.js";

/**
 * Phân tách dữ liệu bệnh án theo nguyên tắc Thẩm quyền tối thiểu (HIPAA Minimum Necessary §164.502(b))
 * Căn cứ: Điều 66 Luật Khám bệnh, chữa bệnh số 15/2023/QH15.
 * 
 * TRIỂN KHAI TRUE WHITELIST MATRIX:
 * - Mọi vai trò phi lâm sàng được quản lý bởi danh mục trường cho phép rõ ràng (Explicit Whitelist).
 * - Bất kỳ trường dữ liệu mới nào phát sinh trong Schema (ví dụ: brafV600eStatus, h3k27mStatus, ...)
 *   mặc định BỊ LOẠI BỎ HOÀN TOÀN, không thể tự động rò rỉ.
 * - Áp dụng Non-Breaking API Masking cho các trường UI quy chuẩn để không làm vỡ giao diện.
 */

export const ROLE_WHITELIST_MAP = {
  // 1. Quản trị viên, Bác sĩ điều trị, Hội đồng u não (Tumor Board): Toàn quyền (null = full access)
  doctor: null,
  tumor_board_member: null,
  admin: null,
  system_admin: null,
  hospital_admin: null,

  // 2. Điều dưỡng (Nurse): Hành chính, sinh hiệu, y lệnh chăm sóc, dị ứng; cấm dữ liệu phân tử & tư vấn di truyền
  nurse: new Set([
    "_id", "patientId", "patientName", "gender", "age", "admissionType",
    "department", "wardId", "doctorInCharge", "status", "signStatus",
    "allergies", "createdAt", "updatedAt", "currentVersion",
    "retentionCategory", "retentionYears", "retentionExpiresAt",
    "diagnosis", "treatmentPlan", "vitals", "medications", "careNotes"
  ]),

  // 3. Kỹ thuật viên CĐHA / MRI (Technician): Chỉ định chụp, an toàn phòng chụp; cấm chẩn đoán sâu & gen
  technician: new Set([
    "_id", "patientId", "patientName", "gender", "age", "admissionType",
    "department", "doctorInCharge", "status", "dicomIntegrityHash",
    "orderDate", "procedure", "technique", "safetyFlags", "protocolNotes",
    "createdAt", "updatedAt"
  ]),

  // 4. Tiếp tân / Lễ tân (Receptionist): Tiếp đón, hành chính, khoa phòng, BHYT
  receptionist: new Set([
    "_id", "patientId", "patientName", "gender", "age", "admissionType",
    "department", "wardId", "doctorInCharge", "status", "paymentMethod",
    "phone", "address", "insuranceNumber", "appointmentDate",
    "createdAt", "updatedAt"
  ]),

  // 5. Thu ngân (Cashier): Viện phí, BHYT, thanh toán
  cashier: new Set([
    "_id", "patientId", "patientName", "gender", "age", "admissionType",
    "department", "paymentMethod", "status", "insuranceNumber",
    "billingItems", "totalAmount", "createdAt", "updatedAt"
  ]),

  // 6. Bệnh nhân (Patient): Bệnh án tóm tắt của chính mình
  patient: new Set([
    "_id", "patientId", "patientName", "gender", "age", "admissionType",
    "department", "wardId", "doctorInCharge", "status", "diagnosis",
    "treatmentPlan", "allergies", "appointmentDate", "createdAt", "updatedAt"
  ]),
};

export const segregateMedicalRecord = (record, userRole = "doctor") => {
  if (!record) return record;
  if (!FEATURES.ENABLE_DATA_SEGREGATION) return record;

  const raw = typeof record.toObject === "function" ? record.toObject() : { ...record };

  // Nhóm Bác sĩ & Tumor Board: Toàn quyền truy cập lâm sàng
  const whitelist = ROLE_WHITELIST_MAP[userRole];
  if (whitelist === null || (["admin", "system_admin", "doctor", "hospital_admin", "tumor_board_member"].includes(userRole))) {
    return raw;
  }

  // Khởi tạo đối tượng chỉ với các trường nằm trong Whitelist (Strict Whitelist Projection)
  const result = {};

  if (whitelist) {
    for (const key of Object.keys(raw)) {
      if (whitelist.has(key)) {
        result[key] = raw[key];
      }
    }
  }

  // HIPAA §164.514(b)(2)(i)(C) Safe Harbor Age Aggregation:
  // Mọi độ tuổi trên 89 phải được gộp thành danh mục duy nhất "90+" đối với các vai trò phi lâm sàng / phân tách
  if (result.age !== undefined && typeof result.age === "number" && result.age > 89) {
    result.age = "90+";
  }

  // Xử lý riêng cho bệnh nhân tự xem hồ sơ cá nhân
  if (userRole === "patient") {
    delete result.legalHold;
    delete result.internalNotes;
    delete result.geneticNotes;
    return result;
  }

  // Tuân thủ HIPAA §164.502(b) Minimum Necessary:
  // Tuyệt đối KHÔNG gán placeholder (ví dụ: "[BẢO MẬT]") vì làm rò rỉ metadata (tiết lộ sự tồn tại của dữ liệu).
  // Các trường không có trong whitelist (molecularMarkers, geneticNotes, psychiatricNotes, ...)
  // tự động vắng mặt (undefined), không bị tuần tự hóa ra JSON khi gửi qua API.
  return result;
};
