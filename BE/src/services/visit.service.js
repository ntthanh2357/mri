import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";
import { createNotificationInternal } from "../controllers/notification.controller.js";

/**
 * Service: Lấy danh sách nhân sự (Bác sĩ, Điều dưỡng, KTV) kèm tải hàng đợi trong ngày
 */
export const getStaffService = async ({ hospitalId }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  const [doctorsList, nurses, dbTechnicians] = await Promise.all([
    User.find({ hospitalId, role: "doctor" }).select("profile email role").lean(),
    User.find({ hospitalId, role: { $in: ["nurse", "receptionist"] } }).select("profile email role"),
    User.find({ hospitalId, role: "technician" }).select("profile email role"),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const activeVisits = await Visit.find({
    hospitalId,
    status: { $in: ["đang chờ", "đang khám"] },
    createdAt: { $gte: startOfDay }
  }).select("doctorId").lean();

  const queueMap = {};
  activeVisits.forEach(v => {
    if (v.doctorId) {
      const docId = v.doctorId.toString();
      queueMap[docId] = (queueMap[docId] || 0) + 1;
    }
  });

  const doctors = doctorsList.map(doc => ({
    ...doc,
    queueSize: queueMap[doc._id.toString()] || 0
  }));

  const technicians = dbTechnicians.length > 0 ? dbTechnicians : doctors;
  return { doctors, nurses, technicians };
};

/**
 * Service: Lễ tân tạo lượt khám mới
 */
export const createVisitService = async ({ hospitalId, userId, patientId, doctorId, nurseId, reason, visitType }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  if (!patientId || !doctorId || !nurseId) {
    const err = new Error("Vui lòng cung cấp bệnh nhân, bác sĩ và điều dưỡng.");
    err.statusCode = 400;
    throw err;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [visitCountToday, hospital] = await Promise.all([
    Visit.countDocuments({
      hospitalId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }),
    Hospital.findById(hospitalId)
  ]);

  const maxPatients = hospital?.pricing?.maxPatients ?? 50;
  if (visitCountToday >= maxPatients) {
    const err = new Error(`Đã đạt số lượng bệnh nhân tối đa trong ngày (${maxPatients} bệnh nhân)!`);
    err.statusCode = 400;
    throw err;
  }

  const visit = new Visit({
    hospitalId,
    patientId,
    doctorId,
    nurseId,
    reason,
    visitType: visitType || "Ngoại trú",
    status: "đang chờ"
  });

  await visit.save();

  // Tự động tạo task quy trình nếu có
  try {
    const { createTasksForVisit } = await import("../controllers/task.controller.js");
    await createTasksForVisit(visit._id, hospitalId);
  } catch (taskErr) {
    console.warn("⚠️ Không thể tự động tạo task quy trình:", taskErr.message);
  }

  // Gửi thông báo cho bác sĩ và điều dưỡng
  try {
    const patient = await User.findById(patientId).lean();
    const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

    await createNotificationInternal({
      hospitalId,
      recipientId: doctorId,
      senderId: userId,
      type: "new_visit",
      title: "🩺 Lượt khám mới",
      message: `Bệnh nhân ${patientName} đang ở hàng đợi của bạn. Lý do khám: "${reason || 'Kiểm tra thần kinh'}".`,
      relatedId: visit._id,
    });

    await createNotificationInternal({
      hospitalId,
      recipientId: nurseId,
      senderId: userId,
      type: "new_visit",
      title: "🏥 Phân công hỗ trợ khám",
      message: `Hỗ trợ bác sĩ khám bệnh nhân ${patientName}. Chuẩn bị đo sinh hiệu khi bệnh nhân vào phòng.`,
      relatedId: visit._id,
    });
  } catch (notifErr) {
    console.warn("⚠️ Không thể gửi thông báo khi tạo lượt khám:", notifErr.message);
  }

  return visit;
};

/**
 * Service: Lấy danh sách hàng đợi theo vai trò người dùng (Bác sĩ, KTV, ĐD)
 */
export const getMyQueueService = async ({ role, id, hospitalId, query = {} }) => {
  if (!hospitalId) {
    const err = new Error("Bạn chưa được gán vào bệnh viện nào.");
    err.statusCode = 403;
    throw err;
  }

  let filter = { hospitalId };
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  if (role === "doctor") {
    filter.$or = [
      { doctorId: id },
      { 
        status: { $in: ["chờ chụp", "chờ chụp lại", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] },
        "mriOrder.orderedAt": { $exists: true }
      }
    ];
  } else if (role === "nurse") {
    filter.$or = [
      { nurseId: id, status: "đang chờ", hospitalId },
      { createdAt: { $gte: startOfDay }, hospitalId }
    ];
  } else if (role === "technician") {
    filter.$or = [
      { technicianId: id },
      { technicianId: null },
      { technicianId: { $exists: false } }
    ];
    filter.status = { $in: ["chờ chụp", "chờ chụp lại", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] };
  }

  if (role === "receptionist" || role === "admin" || role === "hospital_admin" || query.today === "true") {
    filter.createdAt = { $gte: startOfDay };
  }

  if (query.status) {
    filter.status = query.status;
  }

  const visits = await Visit.find(filter)
    .populate("patientId", "email profile")
    .populate("doctorId", "profile.name profile.fullName")
    .populate("nurseId", "profile.name profile.fullName")
    .populate("technicianId", "profile.name profile.fullName")
    .populate("invoiceId", "status totalAmount items paymentMethod paidAt")
    .sort({ createdAt: -1 });

  return visits;
};

/**
 * Service: Cập nhật sinh hiệu bệnh nhân
 */
export const updateVitalsService = async ({ visitId, hospitalId, vitals }) => {
  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám");
    err.statusCode = 404;
    throw err;
  }
  
  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác");
    err.statusCode = 403;
    throw err;
  }

  visit.vitals = { ...vitals, measuredAt: new Date() };
  if (visit.status === "đang chờ") {
    visit.status = "đang khám";
  }

  await visit.save();
  return visit;
};

/**
 * Service: Ra y lệnh chụp MRI và tạo hóa đơn tạm tính
 */
export const createMriOrderService = async ({ visitId, hospitalId, userId, technicianId, region, instructions, requestAiAnalysis }) => {
  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  if (technicianId) {
    const technician = await User.findOne({ _id: technicianId, hospitalId, role: { $in: ["technician", "doctor"] } });
    if (!technician) {
      const err = new Error("Kỹ thuật viên không hợp lệ hoặc không thuộc bệnh viện này.");
      err.statusCode = 400;
      throw err;
    }
  }

  visit.technicianId = technicianId;
  visit.mriOrder = { region, instructions, requestAiAnalysis, orderedAt: new Date() };
  visit.status = "chờ chụp";

  // Lập hóa đơn tạm tính
  try {
    if (!visit.invoiceId) {
      const hospital = await Hospital.findById(visit.hospitalId);
      const examFee = hospital?.pricing?.examFee ?? 50000;
      const mriFee = hospital?.pricing?.mriFee ?? 1500000;
      const aiFee = hospital?.pricing?.aiFee ?? 200000;

      const items = [
        { description: "Khám bệnh lâm sàng", amount: examFee, type: "exam" },
        { description: `Chụp MRI vùng ${region || "Não bộ"}`, amount: mriFee, type: "mri" },
      ];
      if (requestAiAnalysis) {
        items.push({ description: "Phân tích AI hỗ trợ chẩn đoán", amount: aiFee, type: "ai" });
      }
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      const draftInvoice = new Invoice({
        hospitalId: visit.hospitalId,
        patientId: visit.patientId,
        visitId: visit._id,
        items,
        totalAmount,
        status: "chờ thanh toán"
      });
      await draftInvoice.save();
      visit.invoiceId = draftInvoice._id;
    }
  } catch (invErr) {
    console.warn("⚠️ Không thể tạo hóa đơn tạm tính khi ra y lệnh MRI:", invErr.message);
  }

  await visit.save();
  return visit;
};

/**
 * Service: Thẩm định Bảng kiểm An toàn MRI (MRI Safety Screening)
 */
export const submitMriSafetyCheckService = async ({ visitId, hospitalId, user, checklistData }) => {
  const {
    hasPacemakerOrMetal,
    hasClaustrophobia,
    hasKidneyDisease,
    isPregnant,
    metalDetails,
    passed,
    notes
  } = checklistData;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám tương ứng.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  const isSafe = passed !== undefined ? Boolean(passed) : (!hasPacemakerOrMetal);
  const screenerName = user.profile?.fullName || user.profile?.name || user.email || "Kỹ thuật viên";

  visit.mriSafetyChecklist = {
    hasPacemakerOrMetal: Boolean(hasPacemakerOrMetal),
    hasClaustrophobia: Boolean(hasClaustrophobia),
    hasKidneyDisease: Boolean(hasKidneyDisease),
    isPregnant: Boolean(isPregnant),
    metalDetails: metalDetails || "",
    isScreened: true,
    screenedBy: screenerName,
    screenedAt: new Date(),
    passed: isSafe,
    notes: notes || ""
  };

  // Nếu phát hiện có máy tạo nhịp tim hoặc kim loại từ tính -> Chặn ngay và báo lỗi chống chỉ định
  if (hasPacemakerOrMetal && !isSafe) {
    await visit.save();
    const err = new Error("CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI: Bệnh nhân mang máy tạo nhịp tim hoặc mảnh kim loại từ tính! Không được phép đưa vào buồng chụp từ trường 1.5T/3T.");
    err.statusCode = 400;
    err.checklist = visit.mriSafetyChecklist;
    err.visit = visit;
    throw err;
  }

  // Nếu an toàn, tự động chuyển sang 'đang chụp'
  if (isSafe && ['chờ chụp', 'chờ chụp lại'].includes(visit.status)) {
    visit.status = 'đang chụp';
  }

  await visit.save();
  return {
    checklist: visit.mriSafetyChecklist,
    visit
  };
};

/**
 * Service: Yêu cầu chụp lại do ảnh bị nhiễu động (Motion Artifact)
 */
export const requestMriRescanService = async ({ visitId, hospitalId, user, reason }) => {
  if (!reason || !reason.trim()) {
    const err = new Error("Vui lòng cung cấp lý do chuyên môn cần chụp lại (ví dụ: Bệnh nhân cử động đầu gây nhòe ảnh).");
    err.statusCode = 400;
    throw err;
  }

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  visit.status = 'chờ chụp lại';
  visit.mriRescanReason = reason.trim();
  visit.mriRescanRequestedAt = new Date();
  visit.mriRescanRequestedBy = user.id;

  if (visit.mriSafetyChecklist) {
    visit.mriSafetyChecklist.isScreened = false;
    visit.mriSafetyChecklist.passed = false;
  }

  await visit.save();

  // Gửi thông báo đến Bác sĩ chỉ định
  if (visit.doctorId) {
    try {
      const patient = await User.findById(visit.patientId).lean();
      const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: user.id,
        type: "mri_order",
        title: "🔄 Yêu cầu chụp lại MRI",
        message: `Ca chụp MRI của bệnh nhân ${patientName} cần chụp lại. Lý do: "${reason.trim()}".`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo yêu cầu chụp lại:", notifErr.message);
    }
  }

  return visit;
};

/**
 * Service: Hủy ca chụp MRI
 */
export const cancelMriOrderService = async ({ visitId, hospitalId, user, reason }) => {
  if (!reason || !reason.trim()) {
    const err = new Error("Vui lòng cung cấp lý do hủy ca chụp MRI.");
    err.statusCode = 400;
    throw err;
  }

  const visit = await Visit.findById(visitId);
  if (!visit) {
    const err = new Error("Không tìm thấy lượt khám.");
    err.statusCode = 404;
    throw err;
  }

  if (visit.hospitalId.toString() !== hospitalId.toString()) {
    const err = new Error("Không có quyền thao tác lượt khám này.");
    err.statusCode = 403;
    throw err;
  }

  visit.status = 'đã hủy';
  visit.mriCancelReason = reason.trim();
  visit.mriCancelledAt = new Date();
  visit.mriCancelledBy = user.id;

  await visit.save();

  if (visit.doctorId) {
    try {
      const patient = await User.findById(visit.patientId).lean();
      const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: user.id,
        type: "mri_order",
        title: "✕ Ca chụp MRI đã bị hủy",
        message: `Ca chụp MRI của bệnh nhân ${patientName} đã bị hủy. Lý do: "${reason.trim()}". Đề nghị bác sĩ xem xét chỉ định khác.`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo hủy ca MRI:", notifErr.message);
    }
  }

  return visit;
};
