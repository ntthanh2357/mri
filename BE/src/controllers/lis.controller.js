import { LabOrder } from "../models/labOrder.model.js";
import { Biomarker } from "../models/biomarker.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

/**
 * Tạo chuỗi hiển thị khoảng tham chiếu dạng "min - max" hoặc "<= max" hoặc ">= min"
 */
const formatReferenceRange = (range) => {
  if (!range) return '';
  const { min, max } = range;
  const hasMin = min !== undefined && min !== null;
  const hasMax = max !== undefined && max !== null;

  if (hasMin && hasMax) return `${min} - ${max}`;
  if (hasMax && !hasMin) return `<= ${max}`;
  if (hasMin && !hasMax) return `>= ${min}`;
  return '';
};

export const receiveLisResults = async (req, res) => {
  try {
    const { barcode, results: rawResults } = req.body;

    if (!barcode || !Array.isArray(rawResults)) {
      return errorResponse(res, "Thiếu thông tin barcode hoặc danh sách kết quả xét nghiệm.", 400);
    }

    // Tìm phiếu xét nghiệm theo barcode và hospitalId
    const order = await LabOrder.findOne({ barcode, hospitalId: req.user.hospitalId });
    if (!order) {
      return errorResponse(res, `Không tìm thấy phiếu xét nghiệm thuộc bệnh viện của bạn với barcode: ${barcode}`, 404);
    }

    const gender = order.patient_gender; // 'Nam' hoặc 'Nữ'
    const processedResults = [];

    // Duyệt mảng kết quả thô, truy vấn khoảng tham chiếu tương ứng
    for (const item of rawResults) {
      const { code, value } = item;
      if (!code || value === undefined || value === null) continue;

      // Tìm thông tin chỉ số trong danh mục biomarkers
      const biomarker = await Biomarker.findOne({ code: code.toUpperCase() });

      let biomarkerName = code;
      let unit = "";
      let isAbnormal = false;
      let abnormalDirection = '';
      let referenceRangeDisplay = '';

      if (biomarker) {
        biomarkerName = biomarker.name;
        unit = biomarker.unit;

        const ref = biomarker.reference_range;
        if (ref) {
          // Lấy khoảng tham chiếu theo giới tính
          const range = gender === "Nam" ? ref.male : ref.female;
          if (range) {
            const valNum = Number(value);
            // Kiểm tra xem trị số có nằm ngoài khoảng chuẩn không
            if (range.min !== undefined && range.min !== null && valNum < range.min) {
              isAbnormal = true;
              abnormalDirection = 'LOW';
            }
            if (range.max !== undefined && range.max !== null && valNum > range.max) {
              isAbnormal = true;
              abnormalDirection = 'HIGH';
            }
            // Format chuỗi khoảng tham chiếu để hiển thị trực tiếp trên FE
            referenceRangeDisplay = formatReferenceRange(range);
          }
        }
      }

      processedResults.push({
        biomarker_code: code.toUpperCase(),
        biomarker_name: biomarkerName,
        value_result: Number(value),
        unit,
        is_abnormal: isAbnormal,
        abnormal_direction: abnormalDirection,
        reference_range_display: referenceRangeDisplay
      });
    }

    // Cập nhật kết quả vào phiếu xét nghiệm
    order.results = processedResults;
    order.status = "COMPLETED";
    order.resulted_at = new Date();

    await order.save();

    return successResponse(res, order, "Cập nhật kết quả xét nghiệm từ LIS thành công!");
  } catch (error) {
    console.error("Lỗi tiếp nhận kết quả LIS:", error);
    return errorResponse(res, "Đã xảy ra lỗi hệ thống khi tiếp nhận kết quả xét nghiệm.", 500);
  }
};
