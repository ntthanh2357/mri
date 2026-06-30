import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";
import { createNotificationInternal } from "./notification.controller.js";


// @desc    Lấy danh sách nhân viên (Bác sĩ, Điều dưỡng) cho bệnh viện hiện tại
// @route   GET /api/v1/visits/staff
// @access  Private
export const getStaff = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    const [doctors, nurses, dbTechnicians] = await Promise.all([
      User.find({ hospitalId, role: "doctor" }).select("profile email role"),
      User.find({ hospitalId, role: { $in: ["nurse", "receptionist"] } }).select("profile email role"),
      User.find({ hospitalId, role: "technician" }).select("profile email role"),
    ]);

    // Bác sĩ kiêm KTV nếu bệnh viện không có KTV chuyên biệt
    const technicians = dbTechnicians.length > 0 ? dbTechnicians : doctors;

    res.status(200).json({ doctors, nurses, technicians });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Lễ tân tạo lượt khám mới
// @route   POST /api/v1/visits
// @access  Private (Receptionist)
export const createVisit = async (req, res) => {
  try {
    const { patientId, doctorId, nurseId, reason, visitType } = req.body;
    const hospitalId = req.user.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    if (!patientId || !doctorId || !nurseId) {
      return res.status(400).json({ message: "Vui lòng cung cấp bệnh nhân, bác sĩ và điều dưỡng." });
    }

    // Check maximum patient limit for the day
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
      return res.status(400).json({ message: `Đã đạt số lượng bệnh nhân tối đa trong ngày (${maxPatients} bệnh nhân)!` });
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

    // ── Gửi thông báo tự động cho Bác sĩ và Điều dưỡng ────────────────────
    try {
      const patient = await User.findById(patientId).lean();
      const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

      // Thông báo bác sĩ
      await createNotificationInternal({
        hospitalId,
        recipientId: doctorId,
        senderId: req.user.id,
        type: "new_visit",
        title: "🩺 Lượt khám mới",
        message: `Bệnh nhân ${patientName} đang ở hàng đợi của bạn. Lý do khám: "${reason || 'Kiểm tra thần kinh'}".`,
        relatedId: visit._id,
      });

      // Thông báo điều dưỡng
      await createNotificationInternal({
        hospitalId,
        recipientId: nurseId,
        senderId: req.user.id,
        type: "new_visit",
        title: "🏥 Phân công hỗ trợ khám",
        message: `Hỗ trợ bác sĩ khám bệnh nhân ${patientName}. Chuẩn bị đo sinh hiệu khi bệnh nhân vào phòng.`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo khi tạo lượt khám:", notifErr.message);
    }
    // ───────────────────────────────────────────────────────────────────────

    res.status(201).json({ message: "Tạo lượt khám thành công", visit });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Lấy danh sách công việc của tôi
// @route   GET /api/v1/visits/my-queue
// @access  Private (Doctor, Nurse, Technician, Receptionist)
export const getMyQueue = async (req, res) => {
  try {
    const { role, id, hospitalId } = req.user;
    
    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    let filter = { hospitalId };
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    if (role === "doctor") {
      // Bác sĩ kiêm KTV: thấy lượt khám của mình HOẶC lượt khám MRI
      filter.$or = [
        { doctorId: id },
        { 
          status: { $in: ["chờ chụp", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] },
          "mriOrder.orderedAt": { $exists: true }
        }
      ];
    } else if (role === "nurse") {
      // Điều dưỡng kiêm Lễ tân: Thấy lượt khám đang chờ khám (vai trò ĐD) HOẶC tất cả trong ngày (vai trò Lễ tân)
      filter.$or = [
        { nurseId: id, status: "đang chờ" },
        { createdAt: { $gte: startOfDay } }
      ];
    } else if (role === "technician") {
      filter.$or = [
        { technicianId: id },
        { technicianId: null },
        { technicianId: { $exists: false } }
      ];
      filter.status = { $in: ["chờ chụp", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] };
    }

    // Lễ tân hoặc Admin lấy hết theo hospitalId nhưng giới hạn trong ngày hôm nay để tránh quá tải
    if (role === "receptionist" || role === "admin" || role === "hospital_admin" || req.query.today === "true") {
      filter.createdAt = { $gte: startOfDay };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const visits = await Visit.find(filter)
      .populate("patientId", "email profile")
      .populate("doctorId", "profile.name")
      .populate("nurseId", "profile.name")
      .populate("technicianId", "profile.name")
      .sort({ createdAt: -1 });

    res.status(200).json({ visits });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Điều dưỡng cập nhật sinh hiệu
// @route   PUT /api/v1/visits/:id/vitals
// @access  Private (Nurse)
export const updateVitals = async (req, res) => {
  try {
    const { vitals } = req.body;
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({ message: "Không tìm thấy lượt khám" });
    }
    
    if (visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác" });
    }

    visit.vitals = { ...vitals, measuredAt: new Date() };
    
    // Chỉ cập nhật trạng thái nếu bệnh nhân đang ở hàng chờ tiếp đón ban đầu
    if (visit.status === "đang chờ") {
      visit.status = "đang khám";
    }

    await visit.save();
    res.status(200).json({ message: "Cập nhật sinh hiệu thành công", visit });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Bác sĩ ra y lệnh MRI
// @route   PUT /api/v1/visits/:id/mri-order
// @access  Private (Doctor)
export const createMriOrder = async (req, res) => {
  try {
    const { technicianId, region, instructions, requestAiAnalysis } = req.body;
    const visit = await Visit.findById(req.params.id);

    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });

    // Tenancy Check
    if (visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác lượt khám này." });
    }

    if (technicianId) {
      const technician = await User.findOne({ _id: technicianId, hospitalId: req.user.hospitalId, role: { $in: ["technician", "doctor"] } });
      if (!technician) {
        return res.status(400).json({ message: "Kỹ thuật viên không hợp lệ hoặc không thuộc bệnh viện này." });
      }
    }

    visit.technicianId = technicianId;
    visit.mriOrder = { region, instructions, requestAiAnalysis, orderedAt: new Date() };
    visit.status = "chờ chụp";

    await visit.save();

    // ── Gửi thông báo tới Kỹ thuật viên chụp MRI ─────────────────────────────
    if (technicianId) {
      try {
        const patient = await User.findById(visit.patientId).lean();
        const patientName = patient?.profile?.name || patient?.profile?.fullName || "Bệnh nhân";

        await createNotificationInternal({
          hospitalId: visit.hospitalId,
          recipientId: technicianId,
          senderId: req.user.id,
          type: "mri_order",
          title: "🔬 Chỉ định chụp MRI mới",
          message: `Y lệnh chụp MRI vùng ${region || "Não bộ"} cho bệnh nhân ${patientName}. Hướng dẫn: "${instructions || 'Không có'}".`,
          relatedId: visit._id,
        });
      } catch (notifErr) {
        console.warn("⚠️ Không thể gửi thông báo cho KTV khi đặt lệnh MRI:", notifErr.message);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(200).json({ message: "Đã ra y lệnh chụp MRI", visit });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Cập nhật trạng thái
// @route   PUT /api/v1/visits/:id/status
// @access  Private
export const updateStatus = async (req, res) => {
  try {
    const { status, visitType } = req.body;
    const visit = await Visit.findById(req.params.id);
    
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });

    // Tenancy Check
    if (visit.hospitalId.toString() !== req.user.hospitalId) {
      return res.status(403).json({ message: "Không có quyền thao tác lượt khám này." });
    }

    visit.status = status;
    if (visitType) {
      visit.visitType = visitType;
    }

    if (status === "hoàn tất") {
      // Tự động tạo hóa đơn nếu chưa có
      const existingInvoice = await Invoice.findOne({ visitId: visit._id });
      if (!existingInvoice) {
        const hospital = await Hospital.findById(visit.hospitalId);
        if (hospital) {
          let items = [{ description: "Khám bệnh", amount: hospital.pricing.examFee, type: "exam" }];
          if (visit.mriOrder && visit.mriOrder.orderedAt) {
            items.push({ description: "Chụp MRI", amount: hospital.pricing.mriFee, type: "mri" });
            if (visit.mriOrder.requestAiAnalysis) {
              items.push({ description: "Phân tích AI chẩn đoán", amount: hospital.pricing.aiFee, type: "ai" });
            }
          }

          // ── Tự động thêm tiền thuốc vào hóa đơn ────────────────────────────
          try {
            const { Prescription } = await import("../models/prescription.model.js");
            const { Drug } = await import("../models/drug.model.js");
            
            const prescription = await Prescription.findOne({
              patient_id: visit.patientId,
              createdAt: { $gte: visit.createdAt },
              isBilled: { $ne: true }
            });

            if (prescription && prescription.drugs && prescription.drugs.length > 0) {
              for (const pDrug of prescription.drugs) {
                const dbDrug = await Drug.findOne({
                  hospitalId: visit.hospitalId,
                  name: { $regex: new RegExp(`^${pDrug.name.trim()}$`, "i") }
                });

                const unitPrice = dbDrug ? dbDrug.price : 0;
                const totalDrugPrice = unitPrice * pDrug.quantity;

                items.push({
                  description: `Thuốc: ${pDrug.name} (SL: ${pDrug.quantity} ${pDrug.unit || 'Viên'})`,
                  amount: totalDrugPrice,
                  type: "drug"
                });
              }
              // Lưu ý: Chưa trừ kho ở bước này, việc trừ kho sẽ thực hiện khi thanh toán (payInvoice)
            }
          } catch (err) {
            console.error("Lỗi thêm thuốc vào hóa đơn tự động:", err);
          }
          // ─────────────────────────────────────────────────────────────────────────

          const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

          const invoice = new Invoice({
            hospitalId: visit.hospitalId,
            patientId: visit.patientId,
            visitId: visit._id,
            items,
            totalAmount,
            status: "chờ thanh toán"
          });
          await invoice.save();
          visit.invoiceId = invoice._id;
        }
      }
    }

    await visit.save();
    
    res.status(200).json({ message: "Cập nhật trạng thái thành công", visit });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};
