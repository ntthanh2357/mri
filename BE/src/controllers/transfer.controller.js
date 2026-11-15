import mongoose from "mongoose";
import crypto from "crypto";
import { TransferForm } from "../models/transferForm.model.js";
import { Hospital } from "../models/hospital.model.js";
import { HospitalBed } from "../models/hospitalBed.model.js";
import { User } from "../models/user.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { createNotificationInternal } from "./notification.controller.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../services/auditLog.service.js";
import { sendReferralPackageEmail } from "../services/email.service.js";
import { actorDisplayName } from "../utils/actorName.util.js";
import { checkPatientTenancy } from "../utils/tenancy.util.js";

// Helper: Tự động gom dữ liệu chẩn đoán hình ảnh thành package snapshot
const buildImagingPackageSnapshot = (imagingResult) => {
  if (!imagingResult) return null;
  return {
    imagingResultId: imagingResult._id,
    medicalId: imagingResult.medicalId || "",
    procedure: imagingResult.procedure || "Chụp MRI sọ não",
    technique: imagingResult.technique || "",
    findings: imagingResult.findings || "",
    conclusion: imagingResult.conclusion || "",
    radiologist: imagingResult.radiologist || "",
    orderDate: imagingResult.orderDate || null,
    reportDate: imagingResult.reportDate || null,
    isSigned: Boolean(imagingResult.isSigned),
    signedAt: imagingResult.signedAt || null,
    // DICOM archive (.zip)
    dicom: {
      zipUrl: imagingResult.dicomZipUrl || null,
      sizeBytes: imagingResult.dicomZipSize || null,
      filename: imagingResult.dicomZipFilename || null,
      studyInstanceUID: imagingResult.dicomMetadata?.studyInstanceUID || "",
    },
    // Báo cáo AI chuyên biệt u não
    aiReport: imagingResult.aiReport || null,
    // 3D Model GLTF
    model3dUrl: imagingResult.model3dUrl || null,
    // Mặt cắt & phân đoạn
    segmentationUrl: imagingResult.segmentationUrl || null,
    top5SlicesUrls: Array.isArray(imagingResult.top5SlicesUrls) ? imagingResult.top5SlicesUrls : [],
    representativeSliceUrl: imagingResult.representativeSliceUrl || null,
  };
};

// ─── UC-DOC-10: Bác sĩ tạo gói chuyển viện thông minh ─────────────────────────
// @route POST /api/v1/transfers
// @access Private (Doctor, Admin, Hospital Admin)
export const createTransferRequest = async (req, res) => {
  try {
    if (!["doctor", "department_head", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Chỉ bác sĩ mới có quyền khởi tạo gói chuyển viện.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const rawPatientId = req.body.patient_id || req.body.patientId;
    const {
      visitId,
      imagingResultId,
      targetHospitalId,
      transferTo,
      transferNo,
      hospitalNo,
      dateIn,
      dateOut,
      clinicalSummary,
      labSummary,
      diagnosis,
      treatment,
      drugsUsed,
      patientStatus,
      reason = "1",
      reasonDetail,
      treatmentDirection,
      transportation = "Xe cấp cứu chuyên dụng",
      escort,
      isOneYearValid = "Không",
      recipientEmail
    } = req.body;

    let patient_id = rawPatientId;

    if (!patient_id || !diagnosis) {
      return errorResponse(res, "Vui lòng cung cấp đầy đủ ID bệnh nhân và chẩn đoán bệnh chính.", 400);
    }

    // 1. Bệnh nhân phải thuộc phạm vi viện gửi (User không có tenancy plugin: trước đây tìm được bệnh nhân viện bất kỳ)
    const patientDoc = await checkPatientTenancy(patient_id, req.user);
    if (!patientDoc) {
      return errorResponse(res, "Không tìm thấy hồ sơ bệnh nhân thuộc bệnh viện của bạn.", 404);
    }
    const patient = typeof patientDoc.toObject === "function" ? patientDoc.toObject() : patientDoc;
    patient_id = String(patient._id); // nhận cả mã y tế (BN...), lưu bằng _id thật
    // Viện nhận (nếu chọn) phải tồn tại và khác viện gửi
    if (targetHospitalId) {
      if (!mongoose.Types.ObjectId.isValid(String(targetHospitalId))) return errorResponse(res, "Bệnh viện nhận không hợp lệ.", 400);
      if (String(targetHospitalId) === String(hospitalId)) return errorResponse(res, "Bệnh viện nhận phải khác bệnh viện gửi.", 400);
      if (!(await Hospital.exists({ _id: targetHospitalId }))) return errorResponse(res, "Không tìm thấy bệnh viện nhận.", 400);
    }
    const finalRecipientEmail = (recipientEmail || patient.email || patient.profile?.email || "").trim();

    // 2. Tìm hoặc tự động phát hiện ca chụp MRI / CT mới nhất của bệnh nhân
    // Chỉ nhận phim CỦA ĐÚNG bệnh nhân này (theo mã bệnh nhân / mã y tế). Trước đây: phim theo id do client gửi
    // không kiểm tra chủ, và nếu chưa có phim thì lấy phim mới nhất của NGƯỜI TRÙNG TÊN trong viện để gửi kèm email.
    const ownsImaging = [{ patientId: patient_id }, ...(patient.profile?.medicalId ? [{ medicalId: patient.profile.medicalId }] : [])];
    let imagingDoc = null;
    if (imagingResultId) {
      if (!mongoose.Types.ObjectId.isValid(String(imagingResultId))) return errorResponse(res, "Mã ca chụp không hợp lệ.", 400);
      imagingDoc = await ImagingResult.findOne({ _id: imagingResultId, $or: ownsImaging }).lean();
      if (!imagingDoc) return errorResponse(res, "Ca chụp không thuộc bệnh nhân này.", 400);
    }
    if (!imagingDoc) {
      imagingDoc = await ImagingResult.findOne({ $or: ownsImaging })
        .sort({ createdAt: -1 })
        .lean();
    }

    // 3. Đóng gói snapshot đầy đủ: DICOM, AI Report, 3D model, slices
    const packageSnapshot = buildImagingPackageSnapshot(imagingDoc);

    // Tên nơi tiếp nhận
    let destinationName = transferTo || "";
    if (!destinationName && targetHospitalId) {
      const targetHosp = await Hospital.findById(targetHospitalId).lean();
      if (targetHosp) destinationName = targetHosp.name;
    }
    // Nơi chuyển đến ghi trên giấy chuyển tuyến: bác sĩ phải chọn, không điền sẵn "Bệnh viện tuyến trên"
    if (!String(destinationName).trim()) {
      return errorResponse(res, "Vui lòng chọn hoặc nhập nơi chuyển đến.", 400);
    }

    // 4. Tạo bản ghi TransferForm ở trạng thái 'draft' (chờ Lễ tân kiểm tra & gửi email)
    const transferForm = new TransferForm({
      hospitalId,
      targetHospitalId: targetHospitalId || null,
      patient_id,
      visitId: visitId || null,
      imagingResultId: imagingDoc ? imagingDoc._id : null,
      doctor_name: actorDisplayName(req.user),
      transferNo: transferNo || `CV-${Date.now().toString().slice(-6)}`,
      hospitalNo: hospitalNo || "", // số bệnh án do phòng KHTH cấp: chưa có thì để trống, không sinh số
      transferTo: destinationName,
      dateIn: dateIn || new Date(),
      dateOut: dateOut || new Date(),
      clinicalSummary: clinicalSummary || "",
      labSummary: labSummary || "",
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      drugsUsed: drugsUsed || "",
      patientStatus: patientStatus || "Sinh hiệu ổn định lúc chuyển",
      reason,
      reasonDetail: reasonDetail || "Vượt quá khả năng phẫu thuật thần kinh chuyên sâu tại cơ sở",
      treatmentDirection: treatmentDirection || "Phẫu thuật bóc tách u não chuyên sâu / Hội chẩn can thiệp",
      transportation,
      escort: escort || "",
      isOneYearValid,
      packageSnapshot,
      status: "draft", // Đẩy qua role Lễ tân gửi
      recipientEmail: finalRecipientEmail,
      sendAttempts: 0,
    });

    await transferForm.save();

    // 5. Ghi Audit Log hành động tạo gói chuyển viện
    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.REFERRAL_PACKAGE_CREATED,
        entity: "TransferForm",
        entityId: transferForm._id,
        performedBy: req.user.id,
        hospitalId,
        details: `Bác sĩ ${transferForm.doctor_name} đã tạo gói chuyển viện ${transferForm.transferNo} cho bệnh nhân ${patient.profile?.fullName || patient.profile?.name || patient.email}`,
        payload: {
          transferId: transferForm._id,
          patientId: patient._id,
          hasDicom: Boolean(packageSnapshot?.dicom?.zipUrl),
          hasAiReport: Boolean(packageSnapshot?.aiReport),
          has3DModel: Boolean(packageSnapshot?.model3dUrl),
        }
      });
    } catch (auditErr) {
      console.warn("⚠️ Ghi audit log tạo gói chuyển viện thất bại:", auditErr.message);
    }

    // 6. Gửi thông báo nội bộ tới các nhân viên Lễ tân (Receptionist) cùng viện
    try {
      const receptionists = await User.find({
        hospitalId,
        role: "receptionist",
        isLocked: false
      }).select("_id").lean();

      for (const rec of receptionists) {
        await createNotificationInternal({
          hospitalId,
          recipientId: rec._id,
          senderId: req.user.id,
          type: "transfer_draft",
          title: "📋 Hồ sơ chuyển viện mới cần gửi",
          message: `Bác sĩ ${transferForm.doctor_name} vừa tạo gói chuyển viện (Mã: ${transferForm.transferNo}) cho BN ${patient.profile?.fullName || patient.profile?.name || "Bệnh nhân"}. Vui lòng xác thực email và bấm gửi cho bệnh nhân.`,
          relatedId: transferForm._id,
        });
      }
    } catch (notifErr) {
      console.warn("⚠️ Gửi thông báo tới lễ tân thất bại:", notifErr.message);
    }

    return successResponse(res, {
      transferForm,
      message: "Đã tạo gói chuyển viện thông minh thành công và chuyển sang bộ phận Lễ tân để gửi email cho bệnh nhân."
    }, "Tạo gói chuyển viện thành công.", 201);
  } catch (err) {
    console.error("Lỗi tạo gói chuyển viện:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── UC-DOC-10: Lễ tân gửi email hồ sơ chuyển viện cho bệnh nhân ──────────────
// @route POST /api/v1/transfers/:id/send-email
// @access Private (Receptionist, Doctor, Admin, Hospital Admin)
export const sendTransferEmail = async (req, res) => {
  try {
    if (!["receptionist", "doctor", "department_head", "hospital_admin"].includes(req.user.role)) {
      return errorResponse(res, "Bạn không có quyền thực hiện gửi hồ sơ chuyển viện.", 403);
    }

    const { id } = req.params;
    const { overrideEmail } = req.body;

    const transfer = await TransferForm.findById(id).populate("patient_id").populate("hospitalId");
    if (!transfer) {
      return errorResponse(res, "Không tìm thấy hồ sơ chuyển viện.", 404);
    }

    // Kiểm tra quyền sở hữu viện
    if (!req.user.hospitalId || transfer.hospitalId?._id?.toString() !== req.user.hospitalId?.toString()) {
      return errorResponse(res, "Không có quyền gửi hồ sơ của cơ sở y tế khác.", 403);
    }

    const patient = transfer.patient_id;
    const patientName = patient?.profile?.fullName || patient?.profile?.name || patient?.email || "Quý bệnh nhân";
    const hospitalName = transfer.hospitalId?.name || "Bệnh viện Chuyên Khoa Ung Thư Não NeuroScan";

    const targetEmail = (overrideEmail || transfer.recipientEmail || patient?.email || patient?.profile?.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      return errorResponse(res, "Chưa có địa chỉ email hợp lệ của bệnh nhân. Vui lòng nhập email người nhận.", 400);
    }

    transfer.recipientEmail = targetEmail;
    transfer.sendAttempts = (transfer.sendAttempts || 0) + 1;

    // Gửi email đính kèm package (báo cáo AI, ảnh, 3D, DICOM)
    const sendResult = await sendReferralPackageEmail({
      to: targetEmail,
      patientName,
      hospitalName,
      transfer,
      snapshot: transfer.packageSnapshot || {}
    });

    if (sendResult.ok) {
      transfer.status = "sent";
      transfer.sentAt = new Date();
      transfer.sentBy = req.user.id;
      transfer.sendError = "";
      await transfer.save();

      // Ghi audit log
      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.REFERRAL_PACKAGE_EMAILED,
          entity: "TransferForm",
          entityId: transfer._id,
          performedBy: req.user.id,
          hospitalId: transfer.hospitalId?._id || req.user.hospitalId,
          details: `${req.user.role === "receptionist" ? "Lễ tân" : "Nhân viên y tế"} đã gửi email gói chuyển viện ${transfer.transferNo} tới ${targetEmail}`,
          payload: {
            transferId: transfer._id,
            recipientEmail: targetEmail,
            attached: sendResult.attached,
            linked: sendResult.linked,
            skipped: sendResult.skipped
          }
        });
      } catch (auditErr) {
        console.warn("⚠️ Lỗi ghi audit log gửi email chuyển viện:", auditErr.message);
      }

      // Thông báo cho bác sĩ điều trị
      try {
        const doctorUser = await User.findOne({
          hospitalId: transfer.hospitalId?._id || req.user.hospitalId,
          $or: [
            { "profile.name": transfer.doctor_name },
            { name: transfer.doctor_name },
            { role: "doctor" }
          ]
        }).select("_id").lean();

        if (doctorUser) {
          await createNotificationInternal({
            hospitalId: transfer.hospitalId?._id || req.user.hospitalId,
            recipientId: doctorUser._id,
            senderId: req.user.id,
            type: "transfer_sent",
            title: "✅ Hồ sơ chuyển viện đã gửi thành công",
            message: `Bộ phận Lễ tân đã gửi email hồ sơ chuyển viện (Mã: ${transfer.transferNo}) tới bệnh nhân ${patientName} (${targetEmail}).`,
            relatedId: transfer._id,
          });
        }
      } catch (_) {}

      return successResponse(res, {
        transfer,
        delivery: {
          attached: sendResult.attached,
          linked: sendResult.linked,
          skipped: sendResult.skipped,
        },
        message: `Đã gửi thành công gói chuyển viện tới email ${targetEmail}`
      }, "Gửi hồ sơ chuyển viện thành công.");
    } else {
      transfer.status = "failed";
      transfer.sendError = sendResult.reason || "Lỗi máy chủ SMTP";
      await transfer.save();

      try {
        await recordAuditLog({
          action: AUDIT_ACTIONS.REFERRAL_PACKAGE_EMAIL_FAILED,
          entity: "TransferForm",
          entityId: transfer._id,
          performedBy: req.user.id,
          hospitalId: transfer.hospitalId?._id || req.user.hospitalId,
          details: `Gửi email hồ sơ chuyển viện ${transfer.transferNo} thất bại: ${sendResult.reason}`,
          payload: { transferId: transfer._id, targetEmail, reason: sendResult.reason }
        });
      } catch (_) {}

      return errorResponse(res, `Không thể gửi email hồ sơ chuyển viện: ${sendResult.reason || "Lỗi SMTP"}. Bạn có thể kiểm tra lại cấu hình hoặc thử lại.`, sendResult.code === "EMAIL_NOT_CONFIGURED" ? 503 : 502);
    }
  } catch (err) {
    console.error("Lỗi gửi email hồ sơ chuyển viện:", err);
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Lấy danh sách gói chuyển viện ───────────────────────────────────────────
// @route GET /api/v1/transfers
// @access Private (Doctor, Nurse, Receptionist, Admin, Hospital Admin)
export const getTransfers = async (req, res) => {
  try {
    // khớp route: bác sĩ, trưởng khoa, CĐHA, điều dưỡng, BGĐ, lễ tân (trước đây chặn nhầm trưởng khoa, CĐHA)
    if (!["doctor", "department_head", "radiologist", "nurse", "hospital_admin", "receptionist"].includes(req.user?.role)) {
      return errorResponse(res, "Không có quyền xem danh sách chuyển viện của cơ sở y tế.", 403);
    }

    const hospitalId = req.user.hospitalId;
    const { status, search, type } = req.query;

    const filter = {};
    if (!hospitalId) {
      return errorResponse(res, "Tài khoản chưa được gán vào bệnh viện nào.", 403);
    }
    // incoming: phiếu viện khác gửi TỚI viện mình. Phiếu lưu hospitalId = viện gửi, nên bộ lọc tenancy (ép hospitalId = viện
    // mình) làm danh sách này luôn rỗng; bỏ qua tenancy có chủ đích và lọc tường minh theo viện nhận.
    const incoming = type === "incoming";
    if (incoming) {
      filter.targetHospitalId = hospitalId;
      filter.hospitalId = { $ne: hospitalId };
    } else {
      filter.hospitalId = hospitalId;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    let query = TransferForm.find(filter)
      .populate("patient_id", "profile.name profile.fullName profile.phone profile.gender profile.dob email")
      .populate("hospitalId", "name code")
      .populate("targetHospitalId", "name code")
      .populate({ path: "imagingResultId", options: incoming ? { bypassTenancy: true } : {} })
      .populate("sentBy", "profile.name email")
      .sort({ createdAt: -1 });
    if (incoming) query = query.setOptions({ bypassTenancy: true });

    const transfers = await query.lean();

    // Lọc theo từ khóa tìm kiếm nếu có
    const filtered = search
      ? transfers.filter((t) => {
          const s = search.toLowerCase();
          const pt = t.patient_id?.profile?.fullName || t.patient_id?.profile?.name || t.patient_id?.email || "";
          return (
            (t.transferNo && t.transferNo.toLowerCase().includes(s)) ||
            (t.transferTo && t.transferTo.toLowerCase().includes(s)) ||
            (t.diagnosis && t.diagnosis.toLowerCase().includes(s)) ||
            pt.toLowerCase().includes(s)
          );
        })
      : transfers;

    return successResponse(res, filtered, "Lấy danh sách chuyển viện thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Chi tiết một gói chuyển viện ─────────────────────────────────────────────
// @route GET /api/v1/transfers/:id
// @access Private (Doctor, Nurse, Receptionist, Admin, Hospital Admin)
export const getTransferById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return errorResponse(res, "Không tìm thấy hồ sơ chuyển viện.", 404);
    }
    // Bỏ qua tenancy có chủ đích để viện NHẬN cũng đọc được phiếu; quyền xem kiểm tra tường minh ngay bên dưới
    // (chỉ viện gửi hoặc viện nhận). Trước đây tenancy ép hospitalId = viện mình nên viện nhận luôn nhận 404.
    const transfer = await TransferForm.findById(id)
      .setOptions({ bypassTenancy: true })
      .populate("patient_id", "profile.name profile.fullName profile.phone profile.gender profile.dob email")
      .populate("hospitalId", "name code address phone")
      .populate("targetHospitalId", "name code address")
      .populate({ path: "imagingResultId", options: { bypassTenancy: true } })
      .populate("sentBy", "profile.name email")
      .lean();

    if (!transfer) {
      return errorResponse(res, "Không tìm thấy hồ sơ chuyển viện.", 404);
    }
    // Chỉ viện gửi hoặc viện nhận được xem; tài khoản chưa gán viện bị chặn
    const mine = String(req.user.hospitalId || "");
    const owners = [transfer.hospitalId?._id || transfer.hospitalId, transfer.targetHospitalId?._id || transfer.targetHospitalId].map((x) => String(x || ""));
    if (!mine || !owners.includes(mine)) {
      return errorResponse(res, "Không tìm thấy hồ sơ chuyển viện.", 404);
    }

    return successResponse(res, transfer, "Lấy chi tiết hồ sơ chuyển viện thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─── Hủy / Xóa gói chuyển viện ở trạng thái draft ───────────────────────────
// @route DELETE /api/v1/transfers/:id
// @access Private (Doctor, Admin, Receptionist)
export const deleteTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await TransferForm.findById(id);
    if (!transfer) return errorResponse(res, "Không tìm thấy hồ sơ chuyển viện.", 404);

    if (transfer.status === "sent") {
      return errorResponse(res, "Hồ sơ đã được gửi email cho bệnh nhân, không thể hủy bỏ trực tiếp.", 400);
    }

    transfer.status = "cancelled";
    await transfer.save();

    try {
      await recordAuditLog({
        action: AUDIT_ACTIONS.REFERRAL_PACKAGE_CANCELLED,
        entity: "TransferForm",
        entityId: transfer._id,
        performedBy: req.user.id,
        hospitalId: transfer.hospitalId,
        details: `Đã hủy gói chuyển viện ${transfer.transferNo}`,
      });
    } catch (_) {}

    return successResponse(res, { id: transfer._id }, "Đã hủy gói chuyển viện thành công.");
  } catch (err) {
    return errorResponse(res, "Lỗi máy chủ: " + err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility Stubs (Giữ lại để các module / test cũ không bị crash)
// ─────────────────────────────────────────────────────────────────────────────

export const checkSurgeryCapacity = async (req, res) => {
  try {
    const { targetHospitalId, departmentId = "KUTN-SURG" } = req.body;
    if (!targetHospitalId) return errorResponse(res, "Thiếu ID bệnh viện đích.", 400);

    const targetHospital = await Hospital.findById(targetHospitalId).lean();
    if (!targetHospital || !targetHospital.isActive) {
      return errorResponse(res, "Bệnh viện đích không tồn tại hoặc ngừng hoạt động.", 404);
    }

    const bedQuery = { hospitalId: targetHospitalId, status: "available" };
    if (departmentId && departmentId !== "all") {
      bedQuery.departmentId = { $in: ["KUTN-SURG", "KNT", "ICU", "KUTN-ICU"] };
    }
    const availableBeds = await HospitalBed.countDocuments(bedQuery);
    return successResponse(res, {
      targetHospitalId,
      targetHospitalName: targetHospital.name,
      availableBeds,
      canAccept: availableBeds > 0,
      message: availableBeds > 0
        ? `Bệnh viện ${targetHospital.name} có ${availableBeds} giường trống.`
        : `Bệnh viện ${targetHospital.name} hiện hết giường trống.`
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// Chỉ viện NHẬN (targetHospitalId) được chấp nhận/từ chối, và viện nhận phải khác viện gửi.
// Trước đây viện gửi tự chấp nhận phiếu của mình (tenancy plugin chỉ cho viện gửi thấy phiếu), mà phiếu "accepted"
// lại là căn cứ checkPatientTenancy cấp quyền xem hồ sơ xuyên viện.
const findTransferForReceiver = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return { status: 404 };
  const transfer = await TransferForm.findById(req.params.id).setOptions({ bypassTenancy: true });
  const mine = String(req.user?.hospitalId || "");
  if (!transfer || !mine) return { status: 404 };
  const isReceiver = transfer.targetHospitalId && String(transfer.targetHospitalId) === mine && String(transfer.hospitalId) !== mine;
  if (!isReceiver) return { status: String(transfer.hospitalId) === mine ? 403 : 404 };
  if (["accepted", "rejected", "completed", "cancelled"].includes(transfer.status)) return { status: 409, transfer };
  return { transfer };
};
// Cập nhật nguyên tử, chỉ khi phiếu chưa được xử lý (2 người bấm cùng lúc thì một người nhận 409); không đổi viện gửi
const decideTransfer = (transfer, set) => TransferForm.findOneAndUpdate(
  { _id: transfer._id, targetHospitalId: transfer.targetHospitalId, status: { $nin: ["accepted", "rejected", "completed", "cancelled"] } },
  { $set: set },
  { new: true }
).setOptions({ bypassTenancy: true });
const RECEIVER_ERRORS = {
  403: "Chỉ bệnh viện nhận mới được chấp nhận hoặc từ chối hồ sơ chuyển viện.",
  404: "Không tìm thấy yêu cầu chuyển viện.",
  409: "Hồ sơ chuyển viện đã được xử lý.",
};

export const acceptTransferRequest = async (req, res) => {
  try {
    const { transfer, status } = await findTransferForReceiver(req);
    if (status) return errorResponse(res, RECEIVER_ERRORS[status], status);
    const updated = await decideTransfer(transfer, { status: "accepted", acceptedAt: new Date(), acceptedByUserId: req.user.id });
    if (!updated) return errorResponse(res, RECEIVER_ERRORS[409], 409);
    return successResponse(res, { transfer: updated }, "Đã cập nhật trạng thái chấp nhận.");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const rejectTransferRequest = async (req, res) => {
  try {
    const { transfer, status } = await findTransferForReceiver(req);
    if (status) return errorResponse(res, RECEIVER_ERRORS[status], status);
    const updated = await decideTransfer(transfer, { status: "rejected" });
    if (!updated) return errorResponse(res, RECEIVER_ERRORS[409], 409);
    return successResponse(res, { transfer: updated }, "Đã từ chối yêu cầu.");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// Xem chéo liên viện đã thay bằng gửi gói chuyển viện qua email: hai route cũ báo đã ngừng, không báo thành công giả
export const grantCrossHospitalView = async (req, res) => {
  return errorResponse(res, "Chức năng xem chéo liên viện đã ngừng; hồ sơ chuyển viện được gửi qua email.", 410);
};

export const revokeCrossHospitalView = async (req, res) => {
  return errorResponse(res, "Chức năng xem chéo liên viện đã ngừng; hồ sơ chuyển viện được gửi qua email.", 410);
};

export const accessCrossHospitalView = async (req, res) => {
  return errorResponse(res, "Liên kết đã chuyển sang hệ thống gửi hồ sơ điện tử qua email.", 410);
};
