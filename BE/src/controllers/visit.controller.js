import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";


// @desc    Lấy danh sách nhân viên (Bác sĩ, Điều dưỡng) cho bệnh viện hiện tại
// @route   GET /api/v1/visits/staff
// @access  Private
export const getStaff = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Bạn chưa được gán vào bệnh viện nào." });
    }

    const [doctors, nurses, technicians] = await Promise.all([
      User.find({ hospitalId, role: "doctor" }).select("profile email role"),
      User.find({ hospitalId, role: "nurse" }).select("profile email role"),
      User.find({ hospitalId, role: "technician" }).select("profile email role"),
    ]);

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
    const { patientId, doctorId, nurseId, reason } = req.body;
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
      status: "đang chờ"
    });

    await visit.save();

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
    
    if (role === "doctor") {
      filter.doctorId = id;
      // Fetching all relevant statuses for the doctor to track patients
    } else if (role === "nurse") {
      filter.nurseId = id;
      filter.status = "đang chờ";
    } else if (role === "technician") {
      filter.technicianId = id;
      filter.status = { $in: ["chờ chụp", "đang chụp", "chờ kết quả AI", "chờ bác sĩ đọc", "hoàn tất"] };
    }

    // Lễ tân hoặc Admin lấy hết theo hospitalId

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
    visit.status = "đang khám";

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

    visit.technicianId = technicianId;
    visit.mriOrder = { region, instructions, requestAiAnalysis, orderedAt: new Date() };
    visit.status = "chờ chụp";

    await visit.save();
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
    const { status } = req.body;
    const visit = await Visit.findById(req.params.id);
    
    if (!visit) return res.status(404).json({ message: "Không tìm thấy lượt khám" });

    visit.status = status;

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
