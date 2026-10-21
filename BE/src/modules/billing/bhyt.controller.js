import { BhytInfo } from "./models/bhytInfo.model.js";
import { Invoice } from "./models/invoice.model.js";
import { User } from "../auth/models/user.model.js";
import { Visit } from "../../models/visit.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../../services/auditLog.service.js";
import { parseBhytCard, compareHolder, isCardExpired, fmtDateVN, isRealDate } from "./bhytCard.util.js";
import { applyBhytCore } from "./bhytApply.service.js";

// ─── R.1 — Lưu / Cập nhật thông tin thẻ BHYT cho bệnh nhân ─────────────────
// @route POST /api/v1/bhyt/:patientId
// @access Private (Receptionist, Nurse, Admin)
export const saveBhytInfo = async (req, res) => {
  try {
    // UC-REC-02: khai báo & xác minh thẻ BHYT là nghiệp vụ của lễ tân (quản trị được phép hỗ trợ)
    const allowedRoles = ["receptionist", "admin", "hospital_admin"];
    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, "Chỉ lễ tân / quầy tiếp đón được khai báo và xác minh thẻ BHYT.", 403);
    }

    const { patientId } = req.params;
    const {
      cardNumber,
      expiresAt,
      registrationPlace,
      visitId,
      annualCap = 72000000,
      usedThisYear = 0,
      isOutOfNetwork = false,
      treatmentType = "outpatient",
      hasTransferForm = false,
      priorAuthorizations = [],
      note,
      manuallyVerified = false,
      holderName,
      holderBirthDate,
      holderGender,
      mismatchNote = "",
    } = req.body;

    // UC-REC-02 — 1. Kiểm tra cấu trúc mã thẻ & tự xác định tỷ lệ chi trả theo mức hưởng (ký tự thứ 3)
    if (!cardNumber) return errorResponse(res, "Số thẻ BHYT là bắt buộc.", 400);
    const card = parseBhytCard(cardNumber);
    if (!card.ok) return errorResponse(res, card.error, 400);

    // 2. Hạn thẻ: bắt buộc và phải còn hiệu lực
    if (!expiresAt || !isRealDate(expiresAt)) {
      return errorResponse(res, "Hạn thẻ: ngày không hợp lệ.", 400);
    }
    if (isCardExpired(expiresAt)) {
      return errorResponse(res, `Thẻ BHYT đã hết hạn từ ngày ${fmtDateVN(expiresAt)}. Bệnh nhân cần gia hạn thẻ hoặc tự chi trả.`, 400);
    }

    if (holderBirthDate && (!isRealDate(holderBirthDate) || new Date(holderBirthDate) > new Date())) {
      return errorResponse(res, "Ngày sinh trên thẻ: ngày không hợp lệ.", 400);
    }

    const patient = await User.findById(patientId).lean();
    if (!patient || patient.role !== "patient") {
      return errorResponse(res, "Không tìm thấy bệnh nhân.", 404);
    }

    // 3. Đối soát thông tin in trên thẻ với hồ sơ — lệch thì phải ghi lý do mới được xác nhận
    const holder = { name: holderName || patient.profile?.name, birthDate: holderBirthDate, gender: holderGender };
    const mismatches = compareHolder(patient.profile, holder);
    if (mismatches.length && !String(mismatchNote).trim()) {
      return errorResponse(res, `Thông tin trên thẻ lệch với hồ sơ (${mismatches.join(", ")}). Vui lòng kiểm tra lại hoặc ghi lý do chênh lệch.`, 400);
    }
    if (manuallyVerified !== true) {
      return errorResponse(res, "Vui lòng đối chiếu thẻ BHYT gốc với giấy tờ tùy thân và tick xác nhận trước khi lưu.", 400);
    }

    // 4. Mỗi bệnh nhân chỉ 1 thẻ đang dùng: lưu thẻ (theo mã thẻ) rồi chuyển các thẻ khác thành lịch sử
    const bhyt = await BhytInfo.findOneAndUpdate(
      { hospitalId: req.user.hospitalId, patientId, cardNumber: card.cardNumber },
      {
        hospitalId: req.user.hospitalId,
        patientId,
        visitId: visitId || null,
        cardNumber: card.cardNumber, // R.1 — Trong thực tế cần mã hóa AES-256 trước khi lưu
        objectCode: card.objectCode,
        benefitLevel: card.benefitLevel,
        coverageRate: card.coverageRate,
        expiresAt: new Date(expiresAt),
        registrationPlace: registrationPlace || "",
        patientName: String(holder.name || "").trim(),
        holderBirthDate: String(holderBirthDate || "").trim(),
        holderGender: holderGender || "",
        mismatches,
        mismatchNote: mismatches.length ? String(mismatchNote).trim() : "",
        annualCap: Number(annualCap) || 72000000,
        usedThisYear: Number(usedThisYear) || 0,
        isOutOfNetwork: Boolean(isOutOfNetwork),
        treatmentType,
        hasTransferForm: Boolean(hasTransferForm),
        priorAuthorizations: Array.isArray(priorAuthorizations) ? priorAuthorizations : [],
        isValid: true,
        isActive: true,
        replacedAt: null,
        verifiedAt: new Date(),
        manuallyVerified: true,
        verifiedBy: req.user.id,
        note: note || "",
      },
      { upsert: true, new: true }
    );
    await BhytInfo.updateMany(
      { hospitalId: req.user.hospitalId, patientId, _id: { $ne: bhyt._id }, isActive: { $ne: false } },
      { $set: { isActive: false, replacedAt: new Date() } }
    );

    return successResponse(res, {
      bhytId: bhyt._id,
      patientId: bhyt.patientId,
      cardNumber: `****${bhyt.cardNumber.slice(-4)}`,
      objectCode: bhyt.objectCode,
      benefitLevel: bhyt.benefitLevel,
      coverageRate: bhyt.coverageRate,
      annualCap: bhyt.annualCap,
      usedThisYear: bhyt.usedThisYear,
      isOutOfNetwork: bhyt.isOutOfNetwork,
      isValid: bhyt.isValid,
      expiresAt: bhyt.expiresAt,
      mismatches: bhyt.mismatches,
    }, "Lưu thông tin BHYT thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── UC-REC-02 — Thẻ BHYT đang dùng của 1 bệnh nhân (null nếu chưa khai báo) ───
// @route GET /api/v1/bhyt/:patientId/active
export const getActiveBhyt = async (req, res) => {
  try {
    const filter = { patientId: req.params.patientId, isActive: { $ne: false } };
    if (req.user.hospitalId) filter.hospitalId = req.user.hospitalId;
    const b = await BhytInfo.findOne(filter).sort({ updatedAt: -1 }).populate("verifiedBy", "profile.name email").lean();
    if (!b) return successResponse(res, null, "Bệnh nhân chưa khai báo thẻ BHYT.");
    return successResponse(res, toCardSummary(b), "Lấy thẻ BHYT đang dùng thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── UC-REC-02 — Tóm tắt thẻ đang dùng của mọi bệnh nhân trong viện (gắn nhãn BHYT ở danh sách tiếp nhận) ───
// @route GET /api/v1/bhyt/active-cards
export const getActiveCards = async (req, res) => {
  try {
    const filter = { isActive: { $ne: false } };
    if (req.user.hospitalId) filter.hospitalId = req.user.hospitalId;
    const list = await BhytInfo.find(filter).sort({ updatedAt: -1 }).lean();
    const seen = new Set();
    const cards = list.filter((b) => !seen.has(String(b.patientId)) && seen.add(String(b.patientId))).map(toCardSummary);
    return successResponse(res, cards, "Lấy danh sách thẻ BHYT đang dùng thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// Thông tin thẻ an toàn để hiển thị (che số thẻ, tính trạng thái hết hạn theo thời điểm hiện tại)
const toCardSummary = (b) => ({
  bhytId: b._id,
  patientId: b.patientId,
  cardMasked: `${b.cardNumber.slice(0, 3)}••••••••${b.cardNumber.slice(-4)}`,
  objectCode: b.objectCode || b.cardNumber.slice(0, 2),
  benefitLevel: b.benefitLevel || Number(b.cardNumber[2]) || null,
  coverageRate: b.coverageRate,
  expiresAt: b.expiresAt,
  expired: isCardExpired(b.expiresAt),
  registrationPlace: b.registrationPlace,
  isOutOfNetwork: b.isOutOfNetwork,
  hasTransferForm: b.hasTransferForm,
  treatmentType: b.treatmentType,
  mismatches: b.mismatches || [],
  mismatchNote: b.mismatchNote || "",
  verifiedAt: b.verifiedAt,
  verifiedByName: b.verifiedBy?.profile?.name || b.verifiedBy?.email || null,
  manuallyVerified: b.manuallyVerified === true,
});

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
      isActive: { $ne: false },
      manuallyVerified: true,
      expiresAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
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

    const invoice = await Invoice.findOne({ _id: invoiceId, hospitalId: req.user.hospitalId });
    if (!invoice) return errorResponse(res, "Không tìm thấy hóa đơn.", 404);

    const bhyt = bhytId ? await BhytInfo.findById(bhytId) : null;
    if (bhytId && !bhyt) return errorResponse(res, "Không tìm thấy thẻ BHYT.", 404);

    const result = await applyBhytCore(invoice, { bhyt, treatmentType, isOutOfNetwork, hasTransferForm });
    if (!result.ok) {
      const status = { NO_CARD: 404, PAID_BEFORE_BHYT: 409, PAYOS_IN_FLIGHT: 409 }[result.code] || 400;
      return res.status(status).json({ success: false, code: result.code, message: result.message });
    }

    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.BHYT_CLAIM_APPROVED,
        entity: "Invoice",
        entityId: invoice._id,
        performedBy: req.user.id,
        hospitalId: req.user.hospitalId,
        details: `Áp dụng thành công BHYT vào hóa đơn ${invoice._id}: BHYT chi trả ${result.data.bhytAmount.toLocaleString("vi-VN")}đ, BN đồng chi trả ${result.data.patientCopayAmount.toLocaleString("vi-VN")}đ.`
      });
    } catch (auditErr) {
      console.warn("[BHYT Apply AuditLog Warn]", auditErr.message);
    }

    return successResponse(res, result.data, "Áp dụng BHYT vào hóa đơn thành công.");
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
