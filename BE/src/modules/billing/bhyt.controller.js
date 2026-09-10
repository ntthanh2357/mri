import { BhytInfo } from "./models/bhytInfo.model.js";
import { Invoice } from "./models/invoice.model.js";
import { User } from "../auth/models/user.model.js";
import { Visit } from "../../models/visit.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";

// ─── R.1 — Lưu / Cập nhật thông tin thẻ BHYT cho bệnh nhân ─────────────────
// @route POST /api/v1/bhyt/:patientId
// @access Private (Receptionist, Nurse, Admin)
export const saveBhytInfo = async (req, res) => {
  try {
    const allowedRoles = ["receptionist", "nurse", "admin", "hospital_admin", "doctor"];
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền nhập thông tin BHYT.", 403);
    }

    const { patientId } = req.params;
    const {
      cardNumber,
      coverageRate = 80,
      expiresAt,
      registrationPlace,
      patientName,
      visitId,
      note,
    } = req.body;

    if (!cardNumber) return errorResponse(res, "Số thẻ BHYT là bắt buộc.", 400);
    if (![80, 95, 100].includes(Number(coverageRate))) {
      return errorResponse(res, "Tỷ lệ BHYT chi trả phải là 80%, 95%, hoặc 100%.", 400);
    }

    const patient = await User.findById(patientId).lean();
    if (!patient || patient.role !== "patient") {
      return errorResponse(res, "Không tìm thấy bệnh nhân.", 404);
    }

    // Kiểm tra thẻ hết hạn
    const isValid = expiresAt ? new Date(expiresAt) > new Date() : true;

    // Upsert — nếu bệnh nhân đã có thẻ BHYT cho lần khám này thì cập nhật
    const bhyt = await BhytInfo.findOneAndUpdate(
      { hospitalId: req.user.hospitalId, patientId, visitId: visitId || null },
      {
        hospitalId: req.user.hospitalId,
        patientId,
        visitId: visitId || null,
        cardNumber, // R.1 — Trong thực tế cần mã hóa AES-256 trước khi lưu
        coverageRate: Number(coverageRate),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        registrationPlace: registrationPlace || "",
        patientName: patientName || patient.profile?.name || "",
        isValid,
        verifiedAt: new Date(),
        note: note || "",
      },
      { upsert: true, new: true }
    );

    return successResponse(res, {
      bhytId: bhyt._id,
      cardNumber: `****${cardNumber.slice(-4)}`, // Che số thẻ trong response
      coverageRate: bhyt.coverageRate,
      expiresAt: bhyt.expiresAt,
      isValid: bhyt.isValid,
      patientCopayRate: 100 - bhyt.coverageRate, // Tỷ lệ đồng chi trả
    }, "Lưu thông tin thẻ BHYT thành công.", 201);
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── R.1 — Xem thông tin BHYT của bệnh nhân ──────────────────────────────────
// @route GET /api/v1/bhyt/:patientId
// @access Private (Receptionist, Nurse, Doctor, Admin)
export const getBhytInfo = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { visitId } = req.query;

    const filter = { patientId };
    if (req.user.hospitalId) filter.hospitalId = req.user.hospitalId;
    if (visitId) filter.visitId = visitId;

    const bhytList = await BhytInfo.find(filter).sort({ createdAt: -1 }).lean();

    const safeList = bhytList.map((b) => ({
      ...b,
      cardNumber: `****${b.cardNumber?.slice(-4) || "xxxx"}`, // Che số thẻ
    }));

    return successResponse(res, safeList, "Lấy thông tin BHYT thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── R.2 — Tính mức hưởng & đồng chi trả khi lập hóa đơn ───────────────────
// @route POST /api/v1/bhyt/calculate-copay
// @access Private (Receptionist, Nurse, Admin)
export const calculateCopay = async (req, res) => {
  try {
    const { patientId, visitId, totalAmount } = req.body;

    if (!patientId || !totalAmount) {
      return errorResponse(res, "Thiếu patientId hoặc tổng tiền hóa đơn.", 400);
    }

    // Tìm thẻ BHYT hợp lệ gần nhất
    const bhyt = await BhytInfo.findOne({
      patientId,
      isValid: true,
      $or: [
        { visitId },
        { visitId: null },
      ],
    }).sort({ createdAt: -1 }).lean();

    if (!bhyt) {
      return successResponse(res, {
        hasBhyt: false,
        totalAmount,
        bhytAmount: 0,
        patientAmount: totalAmount,
        coverageRate: 0,
        message: "Bệnh nhân không có thẻ BHYT hợp lệ. Tự chi trả toàn bộ.",
      }, "Tính đồng chi trả thành công.");
    }

    // R.2 — Tính mức chi trả
    const coverageRate = bhyt.coverageRate / 100;
    const bhytAmount = Math.round(totalAmount * coverageRate);
    const patientAmount = totalAmount - bhytAmount;

    return successResponse(res, {
      hasBhyt: true,
      bhytId: bhyt._id,
      cardNumber: `****${bhyt.cardNumber?.slice(-4)}`,
      coverageRate: bhyt.coverageRate,
      totalAmount,
      bhytAmount,       // BHYT chi trả
      patientAmount,    // Bệnh nhân đồng chi trả
      breakdown: {
        bhytCoverage: `${bhyt.coverageRate}% = ${bhytAmount.toLocaleString("vi-VN")}đ`,
        patientCopay: `${100 - bhyt.coverageRate}% = ${patientAmount.toLocaleString("vi-VN")}đ`,
      },
    }, "Tính đồng chi trả BHYT thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── R.2 — Áp dụng BHYT vào hóa đơn ─────────────────────────────────────────
// @route PUT /api/v1/bhyt/apply-to-invoice/:invoiceId
// @access Private (Receptionist, Admin)
export const applyBhytToInvoice = async (req, res) => {
  try {
    const allowedRoles = ["receptionist", "admin", "hospital_admin"];
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền áp dụng BHYT vào hóa đơn.", 403);
    }

    const { invoiceId } = req.params;
    const { bhytId } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      hospitalId: req.user.hospitalId,
    });
    if (!invoice) return errorResponse(res, "Không tìm thấy hóa đơn.", 404);
    if (invoice.status === "đã thanh toán") {
      return errorResponse(res, "Không thể chỉnh sửa hóa đơn đã thanh toán.", 400);
    }

    const bhyt = await BhytInfo.findById(bhytId).lean();
    if (!bhyt || !bhyt.isValid) {
      return errorResponse(res, "Thẻ BHYT không hợp lệ hoặc đã hết hạn.", 400);
    }

    const totalAmount = invoice.totalAmount || 0;
    const coverageRate = bhyt.coverageRate / 100;
    const bhytAmount = Math.round(totalAmount * coverageRate);
    const patientAmount = totalAmount - bhytAmount;

    // Cập nhật Invoice với thông tin BHYT
    invoice.bhytInfo = {
      bhytId: bhyt._id,
      cardNumber: `****${bhyt.cardNumber?.slice(-4)}`,
      coverageRate: bhyt.coverageRate,
      bhytAmount,
      patientCopayAmount: patientAmount,
    };
    invoice.patientPayAmount = patientAmount; // Bệnh nhân chỉ trả phần đồng chi trả

    await invoice.save();

    // Cập nhật BhytInfo với invoiceId
    await BhytInfo.findByIdAndUpdate(bhytId, { invoiceId: invoice._id });

    return successResponse(res, {
      invoiceId: invoice._id,
      totalAmount,
      bhytAmount,
      patientCopayAmount: patientAmount,
      coverageRate: bhyt.coverageRate,
    }, "Áp dụng BHYT vào hóa đơn thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── R.3 — Xuất hồ sơ giám định điện tử (cuối tháng) ────────────────────────
// @route POST /api/v1/bhyt/export-claims
// @access Private (Admin, Hospital Admin)
export const exportBhytClaims = async (req, res) => {
  try {
    if (!["admin", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ admin mới được xuất hồ sơ giám định BHYT.", 403);
    }

    const { month, year } = req.body;
    if (!month || !year) return errorResponse(res, "Vui lòng nhập tháng và năm cần xuất.", 400);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Lấy danh sách BHYT đã áp dụng trong tháng
    const bhytRecords = await BhytInfo.find({
      hospitalId: req.user.hospitalId,
      invoiceId: { $ne: null },
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate("patientId", "profile.name profile.medicalId")
      .populate("visitId", "date status")
      .populate("invoiceId", "totalAmount status patientPayAmount")
      .lean();

    // R.3 — Tạo cấu trúc XML giám định (theo chuẩn 4210/QĐ-BHXH — đơn giản hóa)
    // Trong thực tế cần dùng thư viện XML builder và đúng chuẩn của BHXH
    const claimsData = bhytRecords.map((r, idx) => ({
      stt: idx + 1,
      soThe: `****${r.cardNumber?.slice(-4)}`,
      hoTen: r.patientId?.profile?.name || r.patientName,
      maYTe: r.patientId?.profile?.medicalId,
      ngayKham: r.visitId?.date,
      tyLeHuong: r.coverageRate,
      tongChiPhi: r.invoiceId?.totalAmount || 0,
      bhytChiTra: r.invoiceId?.totalAmount
        ? Math.round(r.invoiceId.totalAmount * (r.coverageRate / 100))
        : 0,
      benhNhanDongChiTra: r.invoiceId?.patientPayAmount || 0,
    }));

    const totalBhytAmount = claimsData.reduce((sum, c) => sum + c.bhytChiTra, 0);
    const totalPatientAmount = claimsData.reduce((sum, c) => sum + c.benhNhanDongChiTra, 0);

    return successResponse(res, {
      exportDate: new Date(),
      period: `${month}/${year}`,
      hospitalId: req.user.hospitalId,
      totalRecords: claimsData.length,
      totalBhytAmount,
      totalPatientAmount,
      totalGrandAmount: totalBhytAmount + totalPatientAmount,
      claims: claimsData,
      note: "Dữ liệu xuất cho hồ sơ giám định BHXH. Vui lòng kiểm tra và chuyển đổi sang XML chuẩn 4210/QĐ-BHXH trước khi nộp.",
    }, "Xuất hồ sơ giám định BHYT thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};
