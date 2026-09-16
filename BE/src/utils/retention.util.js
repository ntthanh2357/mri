/**
 * NeuroScan AI - Retention Policy Engine
 * Căn cứ: Điều 15 Thông tư 46/2018/TT-BYT và Luật Khám bệnh, chữa bệnh số 15/2023/QH15
 * 
 * - Hồ sơ ngoại trú, nội trú: Lưu trữ tối thiểu 10 năm.
 * - Hồ sơ tai nạn lao động, bệnh nghề nghiệp: Lưu trữ tối thiểu 15 năm.
 * - Hồ sơ người bệnh tâm thần, tử vong: Lưu trữ tối thiểu 20 năm.
 * 
 * Chuẩn hóa theo múi giờ Việt Nam (GMT+7) và bảo đảm tính toán chính xác năm nhuận (29/02).
 */

export const RETENTION_RULES = {
  // Quy chuẩn bệnh án tổng quát (Thông tư 46/2018/TT-BYT)
  ngoai_tru: { years: 10, label: "Bệnh án ngoại trú (10 năm)" },
  noi_tru: { years: 10, label: "Bệnh án nội trú (10 năm)" },
  tai_nan_lao_dong: { years: 15, label: "Tai nạn lao động / Bệnh nghề nghiệp (15 năm)" },
  tam_than: { years: 20, label: "Bệnh án tâm thần (20 năm)" },
  tu_vong: { years: 20, label: "Người bệnh tử vong thông thường (20 năm)" },

  // Quy chuẩn chuyên biệt Ung Thư Não (Neuro-Oncology)
  neuro_oncology_malignant: { years: 30, label: "Ung thư não ác tính - Glioma/GBM (30 năm)" },
  neuro_oncology_benign: { years: 20, label: "U não lành tính - Meningioma/Pituitary (20 năm)" },
  neuro_oncology_metastatic: { years: 20, label: "Di căn não - Brain Metastases (20 năm)" },
  clinical_trial_participant: { years: 25, label: "Thử nghiệm lâm sàng u não (25 năm theo ICH-GCP E6(R2))" },
  deceased_neuro_oncology: { years: 30, label: "Người bệnh u não tử vong (30 năm theo quy chế ung bướu)" },
};

const isLeapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Tính toán ngày hết hạn lưu trữ (retentionExpiresAt)
 * @param {string} category - 'ngoai_tru' | 'noi_tru' | 'tai_nan_lao_dong' | 'tam_than' | 'tu_vong'
 * @param {Date|string} startDate - Ngày xuất viện hoặc ngày tạo hồ sơ
 * @returns {{ retentionYears: number, retentionExpiresAt: Date }}
 */
export const calculateRetentionExpiry = (category = "ngoai_tru", startDate = new Date()) => {
  const rule = RETENTION_RULES[category] || RETENTION_RULES.ngoai_tru;
  const yearsToAdd = rule.years;

  const date = new Date(startDate);
  // Chuyển sang mốc giờ VN GMT+7 để lấy ngày/tháng/năm chính xác
  const vnOffset = 7 * 60; // phút
  const localTime = new Date(date.getTime() + (vnOffset + date.getTimezoneOffset()) * 60000);

  const startYear = localTime.getFullYear();
  const startMonth = localTime.getMonth(); // 0-11
  const startDay = localTime.getDate(); // 1-31

  const targetYear = startYear + yearsToAdd;
  let targetDay = startDay;

  // Xử lý năm nhuận: Nếu ngày bắt đầu là 29/02 mà năm đích không nhuận -> ngày hết hạn là 28/02
  if (startMonth === 1 && startDay === 29 && !isLeapYear(targetYear)) {
    targetDay = 28;
  }

  // Mốc kết thúc ngày 23:59:59.999 theo giờ VN
  // Tạo đối tượng Date tương ứng trong UTC
  const expiryDate = new Date(Date.UTC(targetYear, startMonth, targetDay, 16, 59, 59, 999)); // 16:59:59.999 UTC = 23:59:59.999 VN (GMT+7)

  return {
    retentionCategory: category,
    retentionYears: yearsToAdd,
    retentionExpiresAt: expiryDate,
  };
};

/**
 * Kiểm tra xem hồ sơ bệnh án có đủ điều kiện tiêu hủy/chuyển lưu trữ lạnh không
 * Bảo đảm tuân thủ Lệnh giữ pháp lý (Legal Hold)
 */
export const canDisposeRecord = (record) => {
  if (!record) return { canDispose: false, reason: "Hồ sơ không tồn tại." };

  // 1. Kiểm tra Lệnh giữ pháp lý (Legal Hold)
  if (record.legalHold && record.legalHold.isHeld) {
    return {
      canDispose: false,
      reason: `Hồ sơ đang chịu Lệnh giữ pháp lý (Legal Hold): "${record.legalHold.reason || 'Yêu cầu từ cơ quan có thẩm quyền'}" bởi ${record.legalHold.heldBy || 'Tòa án/Thanh tra'}. Tuyệt đối không được tiêu hủy.`,
      legalHold: record.legalHold,
    };
  }

  // 2. Kiểm tra thời hạn lưu trữ bắt buộc
  const now = new Date();
  if (!record.retentionExpiresAt) {
    return {
      canDispose: false,
      reason: "Hồ sơ chưa được ấn định ngày hết hạn lưu trữ theo Thông tư 46/2018/TT-BYT.",
    };
  }

  if (now < new Date(record.retentionExpiresAt)) {
    return {
      canDispose: false,
      reason: `Hồ sơ vẫn đang trong thời hạn lưu trữ bắt buộc (đến ngày ${new Date(record.retentionExpiresAt).toLocaleDateString('vi-VN')}).`,
      expiresAt: record.retentionExpiresAt,
    };
  }

  return { canDispose: true, reason: "Đã qua thời hạn lưu trữ tối thiểu và không có lệnh giữ pháp lý." };
};
