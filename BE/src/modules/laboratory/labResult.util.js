/** Tạo chuỗi hiển thị khoảng tham chiếu dạng "min - max" / "<= max" / ">= min". */
export const formatReferenceRange = (range) => {
  if (!range) return "";
  const { min, max } = range;
  const hasMin = min !== undefined && min !== null;
  const hasMax = max !== undefined && max !== null;

  if (hasMin && hasMax) return `${min} - ${max}`;
  if (hasMax && !hasMin) return `<= ${max}`;
  if (hasMin && !hasMax) return `>= ${min}`;
  return "";
};

/**
 * [P2-7] Đánh giá một trị số xét nghiệm:
 *  - bất thường so với khoảng tham chiếu theo giới tính
 *  - nguy kịch (critical) so với ngưỡng critical_low / critical_high của danh mục
 *
 * Hàm thuần, không truy vấn DB — controller chỉ việc nạp biomarker rồi gọi.
 */
export const evaluateLabValue = ({ value, gender, biomarker }) => {
  const num = Number(value);
  const result = {
    is_abnormal: false,
    abnormal_direction: "",
    reference_range_display: "",
    is_critical: false,
    critical_note: "",
  };

  if (!biomarker || Number.isNaN(num)) return result;

  const ref = biomarker.reference_range;
  const range = ref ? (gender === "Nam" ? ref.male : ref.female) : null;
  if (range) {
    if (range.min !== undefined && range.min !== null && num < range.min) {
      result.is_abnormal = true;
      result.abnormal_direction = "LOW";
    }
    if (range.max !== undefined && range.max !== null && num > range.max) {
      result.is_abnormal = true;
      result.abnormal_direction = "HIGH";
    }
    result.reference_range_display = formatReferenceRange(range);
  }

  const unit = biomarker.unit || "";
  if (
    biomarker.critical_low !== null &&
    biomarker.critical_low !== undefined &&
    num <= biomarker.critical_low
  ) {
    result.is_critical = true;
    result.critical_note = `≤ ngưỡng nguy kịch ${biomarker.critical_low} ${unit}`.trim();
  }
  if (
    biomarker.critical_high !== null &&
    biomarker.critical_high !== undefined &&
    num >= biomarker.critical_high
  ) {
    result.is_critical = true;
    result.critical_note = `≥ ngưỡng nguy kịch ${biomarker.critical_high} ${unit}`.trim();
  }
  if (result.is_critical) {
    result.is_abnormal = true;
    if (!result.abnormal_direction) {
      result.abnormal_direction = result.critical_note.startsWith("≤") ? "LOW" : "HIGH";
    }
  }

  return result;
};
