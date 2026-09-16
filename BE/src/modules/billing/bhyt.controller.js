import { BhytInfo } from "./models/bhytInfo.model.js";
import { Invoice } from "./models/invoice.model.js";
import { User } from "../auth/models/user.model.js";
import { Visit } from "../../models/visit.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";

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
      annualCap = 72000000,
      usedThisYear = 0,
      isOutOfNetwork = false,
      treatmentType = "outpatient",
      hasTransferForm = false,
      priorAuthorizations = [],
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
        annualCap: Number(annualCap) || 72000000,
        usedThisYear: Number(usedThisYear) || 0,
        isOutOfNetwork: Boolean(isOutOfNetwork),
        treatmentType,
        hasTransferForm: Boolean(hasTransferForm),
        priorAuthorizations: Array.isArray(priorAuthorizations) ? priorAuthorizations : [],
        isValid,
        verifiedAt: new Date(),
        note: note || "",
      },
      { upsert: true, new: true }
    );

    return successResponse(res, {
      bhytId: bhyt._id,
      patientId: bhyt.patientId,
      cardNumber: `****${bhyt.cardNumber.slice(-4)}`,
      coverageRate: bhyt.coverageRate,
      annualCap: bhyt.annualCap,
      usedThisYear: bhyt.usedThisYear,
      isOutOfNetwork: bhyt.isOutOfNetwork,
      isValid: bhyt.isValid,
      expiresAt: bhyt.expiresAt,
    }, "Lưu thông tin BHYT thành công.");
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
    const {
      patientId,
      visitId,
      totalAmount,
      items = [],
      treatmentType = "outpatient",
      isOutOfNetwork = false,
      hasTransferForm = false
    } = req.body;

    if (!patientId || totalAmount === undefined || totalAmount === null) {
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

    // 1. Kiểm tra chính sách KCB Trái tuyến (Out-of-network)
    const effectiveOutOfNetwork = isOutOfNetwork || bhyt.isOutOfNetwork;
    const effectiveTransferForm = hasTransferForm || bhyt.hasTransferForm;
    let effectiveRate = bhyt.coverageRate;
    let outOfNetworkWarning = null;

    if (effectiveOutOfNetwork && !effectiveTransferForm) {
      if (treatmentType === "outpatient") {
        // Ngoại trú trái tuyến không có giấy chuyển tuyến: BHYT chi trả 0%
        effectiveRate = 0;
        outOfNetworkWarning = "KCB ngoại trú trái tuyến không có giấy chuyển viện: BHYT chi trả 0% theo Luật BHYT.";
      } else if (treatmentType === "inpatient") {
        // Nội trú trái tuyến tuyến tỉnh: Thông tuyến tỉnh 100% mức hưởng quy định
        effectiveRate = bhyt.coverageRate;
      }
    }

    // 2. Kiểm duyệt thuốc chuyên khoa đặc trị yêu cầu Prior Authorization (Thông tư 30/2018/TT-BYT)
    // Ví dụ: Bevacizumab (Avastin) điều trị u nguyên bào đệm GBM tái phát
    let eligibleAmount = totalAmount;
    let priorAuthWarning = null;
    let rejectedItems = [];

    if (Array.isArray(items) && items.length > 0) {
      let nonCoveredItemAmount = 0;
      items.forEach((item) => {
        const desc = (item.description || item.name || "").toLowerCase();
        const isSpecialDrug = desc.includes("bevacizumab") || desc.includes("avastin") || desc.includes("bev");
        
        if (isSpecialDrug) {
          const hasPriorAuth = (bhyt.priorAuthorizations || []).some((pa) => {
            const codeMatch = pa.drugCode && (pa.drugCode.toLowerCase().includes("bev") || pa.drugCode.toLowerCase().includes("bevacizumab"));
            const notExpired = !pa.expiresAt || new Date(pa.expiresAt) >= new Date();
            return codeMatch && notExpired;
          });

          if (!hasPriorAuth) {
            nonCoveredItemAmount += Number(item.amount || 0);
            rejectedItems.push({
              description: item.description || item.name,
              amount: item.amount,
              reason: "Thiếu giấy phê duyệt điều trị đặc biệt/hội chẩn chuyên khoa theo Thông tư 30/2018/TT-BYT"
            });
          }
        }
      });

      if (nonCoveredItemAmount > 0) {
        eligibleAmount = Math.max(0, totalAmount - nonCoveredItemAmount);
        priorAuthWarning = `Đã loại trừ ${nonCoveredItemAmount.toLocaleString("vi-VN")}đ thuốc đặc trị (Bevacizumab) do chưa có phê duyệt Prior Authorization.`;
      }
    }

    // 3. Tính toán BHYT cơ sở
    const tentativeBhytAmount = Math.round(eligibleAmount * (effectiveRate / 100));

    // 4. Kiểm soát trần thanh toán BHYT (40 tháng lương cơ sở ~ 72.000.000 VNĐ / năm tài chính)
    const annualCap = bhyt.annualCap || 72000000;
    const usedThisYear = bhyt.usedThisYear || 0;
    const remainingCap = Math.max(0, annualCap - usedThisYear);
    let capWarning = null;
    let bhytAmount = tentativeBhytAmount;

    if (tentativeBhytAmount > remainingCap) {
      bhytAmount = remainingCap;
      capWarning = `Đã chạm trần BHYT năm tài chính (Hạn mức còn lại: ${remainingCap.toLocaleString("vi-VN")}đ / Trần: ${annualCap.toLocaleString("vi-VN")}đ). Phần vượt trần do người bệnh tự chi trả.`;
    }

    const patientAmount = totalAmount - bhytAmount;

    // Ghi nhận Audit Log (TT46/2018/TT-BYT)
    try {
      if (bhytAmount > 0) {
        await recordAuditLog({
          action: AUDIT_ACTIONS.BHYT_CLAIM_SUBMITTED,
          entity: "Invoice",
          performedBy: req.user?.id || "system",
          hospitalId: req.user?.hospitalId || bhyt.hospitalId,
          details: `Tính toán đồng chi trả BHYT: Tổng ${totalAmount.toLocaleString("vi-VN")}đ, BHYT trả ${bhytAmount.toLocaleString("vi-VN")}đ, BN trả ${patientAmount.toLocaleString("vi-VN")}đ.`
        });
      }
      if (rejectedItems.length > 0 || effectiveRate === 0) {
        await recordAuditLog({
          action: AUDIT_ACTIONS.BHYT_CLAIM_REJECTED,
          entity: "Invoice",
          performedBy: req.user?.id || "system",
          hospitalId: req.user?.hospitalId || bhyt.hospitalId,
          details: `Từ chối thanh toán một phần hoặc toàn bộ BHYT: ${outOfNetworkWarning || priorAuthWarning || "Lý do thẩm định"}`
        });
      }
    } catch (auditErr) {
      console.warn("[BHYT AuditLog Warn]", auditErr.message);
    }

    return successResponse(res, {
      hasBhyt: true,
      bhytId: bhyt._id,
      cardNumber: `****${bhyt.cardNumber?.slice(-4)}`,
      coverageRate: effectiveRate,
      baseCoverageRate: bhyt.coverageRate,
      isOutOfNetwork: effectiveOutOfNetwork,
      hasTransferForm: effectiveTransferForm,
      treatmentType,
      totalAmount,
      eligibleAmount,
      bhytAmount,       // BHYT chi trả
      patientAmount,    // Bệnh nhân đồng chi trả
      annualCap,
      usedThisYear,
      remainingCap,
      breakdown: {
        bhytCoverage: `${effectiveRate}% = ${bhytAmount.toLocaleString("vi-VN")}đ`,
        patientCopay: `${totalAmount > 0 ? Math.round((patientAmount / totalAmount) * 100) : 0}% = ${patientAmount.toLocaleString("vi-VN")}đ`,
        warnings: [outOfNetworkWarning, priorAuthWarning, capWarning].filter(Boolean),
        rejectedItems
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
    const { bhytId, treatmentType = "outpatient", isOutOfNetwork = false, hasTransferForm = false } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      hospitalId: req.user.hospitalId,
    });
    if (!invoice) return errorResponse(res, "Không tìm thấy hóa đơn.", 404);
    if (invoice.status === "đã thanh toán") {
      return errorResponse(res, "Không thể chỉnh sửa hóa đơn đã thanh toán.", 400);
    }

    const bhyt = await BhytInfo.findById(bhytId);
    if (!bhyt || !bhyt.isValid) {
      return errorResponse(res, "Thẻ BHYT không hợp lệ hoặc đã hết hạn.", 400);
    }

    const totalAmount = invoice.totalAmount || 0;
    const effectiveOutOfNetwork = isOutOfNetwork || bhyt.isOutOfNetwork;
    const effectiveTransferForm = hasTransferForm || bhyt.hasTransferForm;
    let effectiveRate = bhyt.coverageRate;

    if (effectiveOutOfNetwork && !effectiveTransferForm) {
      if (treatmentType === "outpatient") {
        effectiveRate = 0;
      }
    }

    // Kiểm tra trần thanh toán BHYT
    const annualCap = bhyt.annualCap || 72000000;
    const usedThisYear = bhyt.usedThisYear || 0;
    const remainingCap = Math.max(0, annualCap - usedThisYear);
    const tentativeBhytAmount = Math.round(totalAmount * (effectiveRate / 100));
    const bhytAmount = Math.min(tentativeBhytAmount, remainingCap);
    const patientAmount = totalAmount - bhytAmount;

    // Cập nhật Invoice với thông tin BHYT hoàn chỉnh
    invoice.bhytInfo = {
      bhytId: bhyt._id,
      cardNumber: `****${bhyt.cardNumber?.slice(-4)}`,
      coverageRate: effectiveRate,
      bhytAmount,
      patientCopayAmount: patientAmount,
      annualCap,
      usedThisYear: usedThisYear + bhytAmount,
      isOutOfNetwork: effectiveOutOfNetwork,
      priorAuthorization: bhyt.priorAuthorizations?.[0]?.approvalNumber || null,
    };
    invoice.patientPayAmount = patientAmount; // Bệnh nhân chỉ trả phần đồng chi trả

    await invoice.save();

    // Cập nhật BhytInfo với invoiceId và lũy kế đã dùng
    bhyt.invoiceId = invoice._id;
    bhyt.usedThisYear = usedThisYear + bhytAmount;
    await bhyt.save();

    // Ghi nhận Audit Log
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.BHYT_CLAIM_APPROVED,
        entity: "Invoice",
        entityId: invoice._id,
        performedBy: req.user.id,
        hospitalId: req.user.hospitalId,
        details: `Áp dụng thành công BHYT vào hóa đơn ${invoice._id}: BHYT chi trả ${bhytAmount.toLocaleString("vi-VN")}đ, BN đồng chi trả ${patientAmount.toLocaleString("vi-VN")}đ.`
      });
    } catch (auditErr) {
      console.warn("[BHYT Apply AuditLog Warn]", auditErr.message);
    }

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
