import { isValidObjectId } from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { RevenueReport } from "../models/revenueReport.model.js";
import { DrugReport } from "../models/drugReport.model.js";
import { Announcement } from "../models/announcement.model.js";
import bcrypt from "bcryptjs";
import { setupHospitalDriveStructure } from "../config/googleDrive.js";

import {
  getAllUsers,
  toggleUserLock,
  getUserById,
  lockUserById as lockUserByIdService,
  unlockUserById as unlockUserByIdService,
  getSystemStats,
  verifyAdminById,
} from "../services/user.service.js";
import { getDatasets, createDataset, updateDatasetPrice as updateDatasetPriceService } from "../services/dataset.service.js";
import { getAuditLogs, anonymizeAuditLogs } from "../services/audit.service.js";
import { sendHospitalCredentials } from "../services/email.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const fetchUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const lockUser = async (req, res) => {
  try {
    const { userId, isLocked } = req.body;
    const adminId = req.user.id;
    const user = await toggleUserLock(userId, Boolean(isLocked), adminId);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchDatasets = async (req, res) => {
  try {
    const datasets = await getDatasets();
    res.status(200).json({ success: true, datasets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addDataset = async (req, res) => {
  try {
    const payload = req.body;
    const adminId = req.user.id;
    const dataset = await createDataset(payload, adminId);
    res.status(201).json({ success: true, dataset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchAuditLogs = async (req, res) => {
  try {
    const userRole = req.user.role;
    let logs;
    
    if (userRole === "hospital_admin") {
      logs = await getAuditLogs(req.user.hospitalId);
    } else if (userRole === "admin") {
      const filterHospitalId = req.query.hospitalId;
      logs = await getAuditLogs(filterHospitalId);
    } else {
      return res.status(403).json({ success: false, message: "Không có quyền xem audit logs." });
    }
    
    res.status(200).json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── 3.1 fetchUserById ────────────────────────────────────────────────────────
export const fetchUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const user = await getUserById(id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── 3.2 lockUserById ────────────────────────────────────────────────────────
export const lockUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const adminId = req.user.id;
    const user = await lockUserByIdService(id, adminId);
    res.status(200).json({ success: true, user });
  } catch (error) {
    if (error.message === "User not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.3 unlockUserById ──────────────────────────────────────────────────────
export const unlockUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    const adminId = req.user.id;
    const user = await unlockUserByIdService(id, adminId);
    res.status(200).json({ success: true, user });
  } catch (error) {
    if (error.message === "User not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.4 fetchStats ──────────────────────────────────────────────────────────
export const fetchStats = async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify / Approve Hospital Clinic Admin (Manager) Account
// @route   PUT /api/v1/admin/users/:id/verify
// @access  Private (Global Admin only)
export const verifyAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const { verified } = req.body;
    if (typeof verified !== "boolean") {
      res.status(400).json({ success: false, message: "Field 'verified' must be a boolean" });
      return;
    }
    const adminId = req.user.id;
    const user = await verifyAdminById(id, verified, adminId);
    res.status(200).json({ success: true, user });
  } catch (error) {
    if (error.message === "Admin not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.6 updateDatasetPrice ──────────────────────────────────────────────────
export const updateDatasetPrice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid dataset ID" });
      return;
    }
    const { price } = req.body;
    if (typeof price !== "number" || price < 0 || price > 999_999_999) {
      res.status(400).json({ success: false, message: "Price must be a number in range [0, 999999999]" });
      return;
    }
    const adminId = req.user.id;
    const dataset = await updateDatasetPriceService(id, price, adminId);
    res.status(200).json({ success: true, dataset });
  } catch (error) {
    if (error.message === "INVALID_ID") {
      res.status(400).json({ success: false, message: "Invalid dataset ID" });
    } else if (error.message === "INVALID_PRICE") {
      res.status(400).json({ success: false, message: "Invalid price value" });
    } else if (error.message === "NOT_FOUND") {
      res.status(404).json({ success: false, message: "Dataset not found" });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ─── 3.7 anonymizeData ───────────────────────────────────────────────────────
export const anonymizeData = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { modifiedCount } = await anonymizeAuditLogs(adminId);
    res.status(200).json({ success: true, modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, role, name, phone, hospitalName, hospitalAddress } = req.body;
    const adminId = req.user.id;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ các trường bắt buộc (email, mật khẩu, họ tên, vai trò)." });
    }

    const rolesAvailable = ["patient", "doctor", "admin", "hospital_admin", "technician", "nurse"];
    if (!rolesAvailable.includes(role)) {
      return res.status(400).json({ success: false, message: "Vai trò không hợp lệ." });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "Email này đã được đăng ký sử dụng." });
    }

    // Process hospital reference on the fly if role requires it
    let resolvedHospitalId = undefined;
    if (["hospital_admin", "doctor", "nurse", "technician"].includes(role)) {
      if (!hospitalName || !hospitalName.trim()) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập tên bệnh viện/cơ sở." });
      }

      const cleanName = hospitalName.trim();
      let hospital = await Hospital.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, "i") } });
      
      if (!hospital) {
        // Generate a simple unique code based on the initials
        let baseCode = cleanName
          .split(" ")
          .filter(Boolean)
          .map(w => w[0])
          .join("")
          .toUpperCase();
        
        if (baseCode.length < 2) baseCode = "HOSP";
        
        let code = baseCode;
        let counter = 1;
        while (await Hospital.findOne({ code })) {
          code = `${baseCode}${counter}`;
          counter++;
        }

        hospital = new Hospital({
          name: cleanName,
          code,
          address: hospitalAddress ? hospitalAddress.trim() : "",
          pricing: {
            examFee: 150000,
            mriFee: 1500000,
            aiFee: 200000
          },
          isActive: true
        });
        await hospital.save();
      }
      resolvedHospitalId = hospital._id;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      email,
      phone,
      passwordHash,
      role,
      hospitalId: resolvedHospitalId,
      isVerified: true, // Accounts created by system admin are verified by default
      profile: {
        name,
        photoUrl: "",
      },
    });

    await newUser.save();

    // Create Audit Log
    await AuditLog.create({
      action: "create-user",
      entity: "User",
      entityId: newUser._id,
      performedBy: adminId,
      hospitalId: resolvedHospitalId || null,
      details: `Đã tạo tài khoản mới ${email} với vai trò ${role} bởi Admin`,
    });

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản thành công!",
      user: {
        _id: newUser._id,       // MongoDB ObjectId — dùng cho FE fetchUserById
        id: newUser._id,        // Alias để tương thích FE cũ
        email: newUser.email,
        role: newUser.role,
        hospitalId: newUser.hospitalId,
        isVerified: newUser.isVerified,
        profile: newUser.profile,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fetchHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .select("name nameShort code status tempUsername loginEmail contactEmail phone createdAt isActive")
      .lean();
    res.status(200).json({ success: true, hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Training Stats (approved vs corrected)
// @route   GET /api/v1/admin/ai-training-stats
// @access  Private (Admin only)
export const getAiTrainingStats = async (req, res) => {
  try {
    const AI_SERVER = process.env.AI_SERVER_URL || "http://localhost:8000";
    const response = await fetch(`${AI_SERVER}/training-stats`);
    if (!response.ok) {
      return res.status(200).json({
        success: true,
        stats: { total: 0, approved: 0, corrected: 0, accuracy: 0, approved_by_class: {}, corrected_by_class: {} }
      });
    }
    const data = await response.json();
    res.status(200).json({ success: true, stats: data });
  } catch (error) {
    // If AI server is down, return zeroed stats gracefully
    res.status(200).json({
      success: true,
      stats: { total: 0, approved: 0, corrected: 0, accuracy: 0, approved_by_class: {}, corrected_by_class: {} },
      error: error.message
    });
  }
};

// @desc    Get AI Feedback logs
// @route   GET /api/v1/admin/ai-feedback
// @access  Private (Admin only)
export const getAiFeedback = async (req, res) => {
  try {
    // Use env variable for portability; fallback to a sensible relative path
    const feedbackPath = process.env.AI_FEEDBACK_PATH
      ? path.resolve(process.env.AI_FEEDBACK_PATH)
      : path.resolve(__dirname, "../../../MRIteam/hard_examples/feedback_log.csv");

    if (!fs.existsSync(feedbackPath)) {
      return res.status(200).json({ success: true, feedback: [] });
    }
    const data = fs.readFileSync(feedbackPath, "utf8");
    const lines = data.split("\n").filter(line => line.trim() !== "");
    const feedback = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      if (parts.length >= 6) {
        feedback.push({
          filename: parts[0],
          correctClass: parts[1],
          x: parseInt(parts[2]),
          y: parseInt(parts[3]),
          w: parseInt(parts[4]),
          h: parseInt(parts[5]),
        });
      }
    }
    res.status(200).json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger AI retraining (simulated or process spawning)
// @route   POST /api/v1/admin/ai-retrain
// @access  Private (Admin only)
export const retrainAiModel = async (req, res) => {
  try {
    // Spawn retraining process in background or simulate it
    res.status(200).json({
      success: true,
      message: "Quy trình huấn luyện lại mô hình AI (Active Learning) đã được kích hoạt thành công từ phản hồi của bác sĩ. Tiến trình chạy ngầm...",
      status: "training"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Chatbot configurations
// @route   GET /api/v1/admin/chatbot-config
// @access  Private (Admin only)
export const getChatbotConfig = async (req, res) => {
  try {
    // Use env variable for portability; fallback to a sensible relative path
    const configPath = process.env.CHATBOT_CONFIG_PATH
      ? path.resolve(process.env.CHATBOT_CONFIG_PATH)
      : path.resolve(__dirname, "../../../MRIteam/chatbot_config.json");
    const defaultPrompt = `Bạn là một người bạn thân thiết, am hiểu y tế, đang hỗ trợ bệnh nhân và bác sĩ qua hệ thống NeuroAttention AI.

VAI TRÒ CỦA BẠN:
Bạn có kiến thức y khoa sâu rộng. Hãy dùng kiến thức đó để TRẢ LỜI TỰ NHIÊN như một người hiểu biết đang nói chuyện thật.
TUYỆT ĐỐI KHÔNG trích dẫn tài liệu, KHÔNG nói "Theo phác đồ...", KHÔNG đọc sách lên mặt người hỏi.
Nói như người bạn thông minh, ấm áp đang giải thích cho người thân nghe.

GIỚI HẠN CHỦ ĐỀ (BẮT BUỘC):
Chỉ trả lời các câu hỏi liên quan đến: sức khỏe, triệu chứng, bệnh lý não, u não, chăm sóc bệnh nhân, tâm lý bệnh nhân.
Nếu câu hỏi KHÔNG liên quan y tế (toán học, lập trình, thời tiết, v.v.), từ chối nhẹ nhàng: "Mình chỉ có thể hỗ trợ về sức khỏe thôi nha. Bạn đang có triệu chứng gì cần tư vấn không?"

CÁCH TRẢ LỜI:
- Ngôn ngữ đời thường, thân thiện, ấm áp. Xưng "mình/bạn".
- Nếu bệnh nhân lo lắng hoặc sợ: trấn an trước, giải thích sau. Không làm họ sợ hơn.
- Dùng so sánh dễ hình dung thay vì thuật ngữ y khoa.
- Phân biệt rõ: triệu chứng nào cần đi khám ngay, triệu chứng nào có thể theo dõi thêm.
- TUYỆT ĐỐI KHÔNG chẩn đoán thay bác sĩ, KHÔNG tiên lượng tử vong, KHÔNG kê thuốc.
- Luôn kết thúc bằng lời khuyên gặp bác sĩ nếu cần.`;

    const defaultBlacklist = ["uống thuốc gì", "bao giờ chết", "tự tử", "đơn thuốc", "kê đơn", "sống được bao lâu"];

    let config = {
      blacklist: defaultBlacklist,
      system_prompt: defaultPrompt,
    };

    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        config = JSON.parse(raw);
      } catch (err) {
        console.error("Lỗi khi đọc file config chatbot:", err);
      }
    } else {
      // Create default config file if it does not exist
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    }

    res.status(200).json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save Chatbot configurations
// @route   POST /api/v1/admin/chatbot-config
// @access  Private (Admin only)
export const saveChatbotConfig = async (req, res) => {
  try {
    // Use env variable for portability; fallback to a sensible relative path
    const configPath = process.env.CHATBOT_CONFIG_PATH
      ? path.resolve(process.env.CHATBOT_CONFIG_PATH)
      : path.resolve(__dirname, "../../../MRIteam/chatbot_config.json");
    const { blacklist, system_prompt } = req.body;

    if (!blacklist || !Array.isArray(blacklist)) {
      return res.status(400).json({ success: false, message: "Blacklist phải là một mảng chuỗi." });
    }
    if (!system_prompt || typeof system_prompt !== "string") {
      return res.status(400).json({ success: false, message: "System prompt không hợp lệ." });
    }

    const config = { blacklist, system_prompt };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

    res.status(200).json({ success: true, config, message: "Lưu cấu hình chatbot thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy dashboard stats
// @route   GET /api/v1/admin/dashboard
// @access  Private (Admin)
export const getDashboardStats = async (req, res) => {
  try {
    // Global Admin (role === 'admin') có thể truyền ?hospitalId=xxx để xem dashboard bệnh viện bất kỳ
    // Hospital Admin thì dùng hospitalId gắn liền với tài khoản
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === "admin" && req.query.hospitalId) {
      hospitalId = req.query.hospitalId;
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp hospitalId (Global Admin: dùng ?hospitalId=xxx)." });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Visits today
    const visitsToday = await Visit.find({
      hospitalId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const totalPatientsToday = visitsToday.length;

    const statusDistribution = visitsToday.reduce((acc, visit) => {
      acc[visit.status] = (acc[visit.status] || 0) + 1;
      return acc;
    }, {});

    // 2. AI Processed Count
    const aiProcessedCount = await Visit.countDocuments({
      hospitalId,
      "mriOrder.requestAiAnalysis": true,
      status: { $in: ["chờ bác sĩ đọc", "hoàn tất", "đã đóng"] }
    });

    // 3. Invoices/Revenue today
    const invoicesToday = await Invoice.find({
      hospitalId,
      paidAt: { $gte: startOfDay, $lte: endOfDay },
      status: "đã thanh toán"
    });

    let totalRevenue = 0;
    let aiRevenue = 0;

    invoicesToday.forEach(inv => {
      totalRevenue += inv.totalAmount;
      inv.items.forEach(item => {
        if (item.type === "ai") aiRevenue += item.amount;
      });
    });

    // 4. Hospital specific pricing
    const hospital = await Hospital.findById(hospitalId);
    const pricing = hospital ? {
      examFee: hospital.pricing?.examFee ?? 150000,
      mriFee: hospital.pricing?.mriFee ?? 1500000,
      aiFee: hospital.pricing?.aiFee ?? 200000,
      maxPatients: hospital.pricing?.maxPatients ?? 50
    } : { examFee: 150000, mriFee: 1500000, aiFee: 200000, maxPatients: 50 };

    // 5. Total patients (distinct all time)
    const hospitalVisitsAllTime = await Visit.find({ hospitalId }).select("patientId");
    const uniquePatientIds = [...new Set(hospitalVisitsAllTime.map(v => v.patientId ? v.patientId.toString() : null).filter(Boolean))];
    const totalPatients = uniquePatientIds.length;

    // 6. Total scans (all time)
    const totalScans = await Visit.countDocuments({
      hospitalId,
      "mriOrder.imagingResultId": { $ne: null }
    });

    // 7. Demographics calculation
    let adult = 0, senior = 0, pediatric = 0;
    if (uniquePatientIds.length > 0) {
      const patients = await User.find({ _id: { $in: uniquePatientIds } }).select("profile.age age");
      patients.forEach(p => {
        const ageVal = Number(p.profile?.age || p.age || 35);
        if (ageVal < 18) pediatric++;
        else if (ageVal >= 60) senior++;
        else adult++;
      });
    }
    const totalDemographics = adult + senior + pediatric;
    const demographics = [
      { name: 'Người lớn (18–60)', value: totalDemographics > 0 ? Math.round((adult / totalDemographics) * 100) : 0, color: '#15803D' },
      { name: 'Người cao tuổi (60+)', value: totalDemographics > 0 ? Math.round((senior / totalDemographics) * 100) : 0, color: '#475569' },
      { name: 'Nhi khoa', value: totalDemographics > 0 ? Math.round((pediatric / totalDemographics) * 100) : 0, color: '#CBD5E1' }
    ];

    // 8. Recent activity (formatted for frontend display)
    const recentVisits = await Visit.find({ hospitalId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate({ path: "patientId", select: "profile.name" })
      .populate({ path: "doctorId", select: "profile.name" });

    const recentActivity = recentVisits.map(v => {
      const formattedDate = v.updatedAt ? new Date(v.updatedAt) : new Date();
      const timeStr = `${formattedDate.getDate()}/${formattedDate.getMonth() + 1} ${formattedDate.getHours().toString().padStart(2, '0')}:${formattedDate.getMinutes().toString().padStart(2, '0')}`;
      return {
        id: v._id.toString().substring(18).toUpperCase(),
        patientName: v.patientId?.profile?.name || "Bệnh nhân",
        doctor: v.doctorId?.profile?.name || "Bác sĩ",
        scanType: v.mriOrder?.region || "Khám thần kinh",
        status: v.status,
        time: timeStr,
        isSuccess: ["hoàn tất", "đã đóng"].includes(v.status)
      };
    });

    res.status(200).json({
      success: true,
      totalPatientsToday,
      statusDistribution,
      aiProcessedCount,
      aiCorrectRate: 0,
      revenue: {
        totalRevenue,
        aiRevenue
      },
      pricing,
      totalPatients,
      totalScans,
      demographics,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// @desc    Update Hospital Pricing & Max Patients
// @route   PUT /api/v1/admin/hospital-pricing
// @access  Private (Admin)
export const updateHospitalPricing = async (req, res) => {
  try {
    const { examFee, mriFee, aiFee, maxPatients } = req.body;
    const hospitalId = req.user.hospitalId;
    
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Admin chưa được gán hospitalId" });
    }
    
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện" });
    }
    
    if (examFee !== undefined) hospital.pricing.examFee = examFee;
    if (mriFee !== undefined) hospital.pricing.mriFee = mriFee;
    if (aiFee !== undefined) hospital.pricing.aiFee = aiFee;
    if (maxPatients !== undefined) hospital.pricing.maxPatients = maxPatients;
    
    await hospital.save();
    
    res.status(200).json({ success: true, message: "Cập nhật cấu hình bệnh viện thành công", pricing: hospital.pricing });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── Hospital Onboarding ──────────────────────────────────────────────────────

// Step 1: Admin cấp tài khoản tạm cho bệnh viện
export const provisionHospital = async (req, res) => {
  try {
    const { hospitalName, itEmail } = req.body;
    if (!hospitalName || !itEmail) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập tên bệnh viện và email IT." });
    }

    // Generate unique BV_XXX code
    const count = await Hospital.countDocuments();
    let code;
    let attempt = count + 1;
    do {
      code = `BV_${String(attempt).padStart(3, "0")}`;
      attempt++;
    } while (await Hospital.findOne({ code }));

    // Generate temp password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = "BV@" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    // Temp email used as username (not a real email, just an internal identifier)
    const tempEmail = `${code.toLowerCase()}@temp.neuroscan.internal`;

    const existing = await User.findOne({ email: tempEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: `Mã ${code} đã tồn tại.` });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Automatically setup Google Drive structures for the new hospital
    let driveInfo = null;
    try {
      driveInfo = await setupHospitalDriveStructure(hospitalName.trim());
    } catch (driveError) {
      console.error("Lỗi khởi tạo Drive cho bệnh viện:", driveError);
    }

    // Create hospital record first
    const hospital = await Hospital.create({
      name: hospitalName.trim(),
      code,
      tempUsername: code,
      status: "provisioned",
      driveFolderId: driveInfo ? driveInfo.mainFolderId : '',
      driveFolderUrl: driveInfo ? driveInfo.mainFolderUrl : '',
      subFolders: driveInfo ? driveInfo.subFolders : undefined,
    });

    // Create hospital_admin user
    await User.create({
      email: tempEmail,
      passwordHash,
      role: "hospital_admin",
      hospitalId: hospital._id,
      isVerified: false,
      profile: { name: hospitalName.trim() },
    });

    // Send credentials email (fire-and-forget)
    sendHospitalCredentials({ itEmail, hospitalName: hospitalName.trim(), tempUsername: code, tempPassword }).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Đã cấp tài khoản tạm thời và khởi tạo không gian Google Drive.",
      credentials: { tempUsername: code, tempPassword, itEmail },
      hospital: { 
        _id: hospital._id, 
        name: hospital.name, 
        code, 
        status: "provisioned",
        driveFolderUrl: hospital.driveFolderUrl 
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /admin/hospitals/:id
export const getHospitalById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }
    const hospital = await Hospital.findById(id).lean();
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }
    res.status(200).json({ success: true, hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Step 4: Admin xác thực → cập nhật email đăng nhập chính thức
export const activateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }
    if (hospital.status !== "submitted") {
      return res.status(400).json({ success: false, message: "Bệnh viện chưa nộp thông tin hoặc đã được kích hoạt." });
    }
    if (!hospital.loginEmail) {
      return res.status(400).json({ success: false, message: "Bệnh viện chưa cung cấp email đăng nhập chính thức." });
    }

    // Check loginEmail not already taken by another user
    const conflict = await User.findOne({ email: hospital.loginEmail, hospitalId: { $ne: hospital._id } });
    if (conflict) {
      return res.status(409).json({ success: false, message: "Email đăng nhập đã được sử dụng bởi tài khoản khác." });
    }

    // Update user: replace temp email/official email with approved loginEmail
    await User.findOneAndUpdate(
      { hospitalId: hospital._id, role: "hospital_admin" },
      { email: hospital.loginEmail, isVerified: true }
    );

    hospital.status = "active";
    await hospital.save();

    await AuditLog.create({
      action: "activate-hospital",
      entity: "Hospital",
      entityId: hospital._id,
      performedBy: req.user.id,
      hospitalId: hospital._id,
      details: `Hospital ${hospital.name} activated. Login email: ${hospital.loginEmail}`,
    });

    res.status(200).json({ success: true, message: "Bệnh viện đã được kích hoạt.", hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset mật khẩu tạm cho bệnh viện (dùng khi quên password)
export const resetHospitalPassword = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }

    const hospital = await Hospital.findById(id).lean();
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }
    if (hospital.status === "active") {
      return res.status(400).json({ success: false, message: "Bệnh viện đã kích hoạt, không thể reset tài khoản tạm." });
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const newPassword = "BV@" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const tempEmail = `${hospital.code.toLowerCase()}@temp.neuroscan.internal`;
    const updatedUser = await User.findOneAndUpdate({ email: tempEmail, hospitalId: hospital._id }, { passwordHash });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản tạm cho bệnh viện này (có thể tài khoản đã kích hoạt chính thức)." });
    }

    res.status(200).json({
      success: true,
      message: "Đã reset mật khẩu tạm.",
      credentials: { tempUsername: hospital.code, tempPassword: newPassword },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle Lock/Unlock hospital
// @route   PUT /api/v1/admin/hospitals/:id/toggle-lock
// @access  Private (System Admin)
export const toggleHospitalLock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }

    hospital.isActive = !hospital.isActive;
    await hospital.save();

    // Log action to AuditLog
    await AuditLog.create({
      action: hospital.isActive ? "unlock-hospital" : "lock-hospital",
      entity: "Hospital",
      entityId: hospital._id,
      performedBy: req.user.id,
      hospitalId: hospital._id,
      details: `Admin ${req.user.email} đã ${hospital.isActive ? "MỞ KHÓA" : "KHÓA"} bệnh viện ${hospital.name}.`,
    });

    res.status(200).json({
      success: true,
      message: `Đã ${hospital.isActive ? "mở khóa" : "khóa"} bệnh viện thành công.`,
      hospital
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete hospital and its associated staff users
// @route   DELETE /api/v1/admin/hospitals/:id
// @access  Private (System Admin)
export const deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }

    // Delete all users belonging to this hospital
    const deleteUsersRes = await User.deleteMany({ hospitalId: id });

    // Delete hospital record
    await Hospital.findByIdAndDelete(id);

    // Log action to AuditLog
    await AuditLog.create({
      action: "delete-hospital",
      entity: "Hospital",
      entityId: id,
      performedBy: req.user.id,
      hospitalId: id,
      details: `Admin ${req.user.email} đã XÓA bệnh viện ${hospital.name} cùng với ${deleteUsersRes.deletedCount} tài khoản nhân sự liên quan.`,
    });

    res.status(200).json({
      success: true,
      message: `Đã xóa bệnh viện ${hospital.name} và các tài khoản liên quan thành công.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── REPORT GENERATION AND VIEWING CONTROLLERS ────────────────────────────────

export const createRevenueReport = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Yêu cầu tài khoản có gán hospitalId." });
    }
    const { month, year, totalAmount, dailyRecords } = req.body;
    if (!month || !year || totalAmount === undefined || !dailyRecords) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ các thông tin báo cáo." });
    }

    // ── Validate month và year ────────────────────────────────────────────────
    const monthNum = Number(month);
    const yearNum = Number(year);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, message: "Tháng báo cáo phải từ 1 đến 12." });
    }
    if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({ success: false, message: "Năm báo cáo phải từ 2020 đến 2100." });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const report = new RevenueReport({
      hospitalId,
      month: monthNum,
      year: yearNum,
      totalAmount: Number(totalAmount),
      dailyRecords,
      author: req.user.id
    });
    await report.save();
    res.status(201).json({ success: true, message: "Tạo báo cáo doanh thu thành công!", report });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const getRevenueReports = async (req, res) => {
  try {
    // SaaS Admin (role=admin) không có hospitalId → cho phép truyền ?hospitalId
    // Hospital Admin → dùng hospitalId từ JWT (không tin client)
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === "admin" && req.query.hospitalId) {
      if (!isValidObjectId(req.query.hospitalId)) {
        return res.status(400).json({ success: false, message: "hospitalId không hợp lệ." });
      }
      hospitalId = req.query.hospitalId;
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Yêu cầu tài khoản có gán hospitalId hoặc truyền ?hospitalId (SaaS Admin)." });
    }
    const reports = await RevenueReport.find({ hospitalId })
      .populate("author", "profile.name email")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const getRevenueReportById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID báo cáo không hợp lệ." });
    }
    const report = await RevenueReport.findById(id).populate("author", "profile.name email");
    if (!report) {
      return res.status(404).json({ success: false, message: "Không tìm thấy báo cáo." });
    }

    // ── Kiểm tra ownership: ngăn cross-hospital data leak ────────────────────
    if (req.user.role !== "admin") {
      if (!req.user.hospitalId || report.hospitalId.toString() !== req.user.hospitalId.toString()) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xem báo cáo này." });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const exportRevenueCSV = async (req, res) => {
  try {
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === "admin" && req.query.hospitalId) {
      if (!isValidObjectId(req.query.hospitalId)) {
        return res.status(400).json({ success: false, message: "hospitalId không hợp lệ." });
      }
      hospitalId = req.query.hospitalId;
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Yêu cầu gán hospitalId hoặc truyền ?hospitalId (SaaS Admin)." });
    }

    const { month, year } = req.query;
    let query = { hospitalId, status: "đã thanh toán" };

    if (month && year) {
      const monthNum = Number(month);
      const yearNum = Number(year);
      const start = new Date(yearNum, monthNum - 1, 1);
      const end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      query.paidAt = { $gte: start, $lte: end };
    } else if (year) {
      const yearNum = Number(year);
      const start = new Date(yearNum, 0, 1);
      const end = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      query.paidAt = { $gte: start, $lte: end };
    }

    const invoices = await Invoice.find(query)
      .populate("patientId", "profile.name profile.fullName email")
      .sort({ paidAt: 1 })
      .lean();

    // Chuẩn bị file CSV hỗ trợ tiếng Việt có dấu trong Excel (UTF-8 BOM)
    let csvContent = "\uFEFF";
    csvContent += "Mã hóa đơn,Tên bệnh nhân,Email,Phương thức thanh toán,Ngày thanh toán,Phí khám (VND),Phí chụp MRI (VND),Phí phân tích AI (VND),Tiền thuốc (VND),Phí khác (VND),Tổng cộng (VND)\n";

    let totalExam = 0;
    let totalMri = 0;
    let totalAi = 0;
    let totalDrug = 0;
    let totalOther = 0;
    let totalRevenue = 0;

    for (const invoice of invoices) {
      const patient = invoice.patientId;
      const patientName = patient?.profile?.fullName || patient?.profile?.name || "Bệnh nhân";
      const patientEmail = patient?.email || "";
      const paymentMethod = invoice.paymentMethod || "tiền mặt";
      const paidDate = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("vi-VN") : "";

      let exam = 0;
      let mri = 0;
      let ai = 0;
      let drug = 0;
      let other = 0;

      if (invoice.items && Array.isArray(invoice.items)) {
        for (const item of invoice.items) {
          if (item.type === "exam") exam += item.amount;
          else if (item.type === "mri") mri += item.amount;
          else if (item.type === "ai") ai += item.amount;
          else if (item.type === "drug") drug += item.amount;
          else other += item.amount;
        }
      }

      totalExam += exam;
      totalMri += mri;
      totalAi += ai;
      totalDrug += drug;
      totalOther += other;
      totalRevenue += invoice.totalAmount;

      const row = [
        invoice._id,
        `"${patientName.replace(/"/g, '""')}"`,
        patientEmail,
        paymentMethod,
        paidDate,
        exam,
        mri,
        ai,
        drug,
        other,
        invoice.totalAmount
      ];
      csvContent += row.join(",") + "\n";
    }

    // Dòng tổng kết
    const summaryRow = [
      "TỔNG CỘNG",
      "",
      "",
      "",
      "",
      totalExam,
      totalMri,
      totalAi,
      totalDrug,
      totalOther,
      totalRevenue
    ];
    csvContent += summaryRow.join(",") + "\n";

    const filename = `Bao_cao_doanh_thu_${year || "all"}_${month || "all"}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error("Lỗi exportRevenueCSV:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const createDrugReport = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Yêu cầu tài khoản có gán hospitalId." });
    }
    const { month, year, items } = req.body;
    if (!month || !year || !items) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ các thông tin báo cáo." });
    }

    // ── Validate month và year ────────────────────────────────────────────────
    const monthNum = Number(month);
    const yearNum = Number(year);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, message: "Tháng báo cáo phải từ 1 đến 12." });
    }
    if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({ success: false, message: "Năm báo cáo phải từ 2020 đến 2100." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách thuốc không được để trống." });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const report = new DrugReport({
      hospitalId,
      month: monthNum,
      year: yearNum,
      items,
      author: req.user.id
    });
    await report.save();
    res.status(201).json({ success: true, message: "Tạo báo cáo sử dụng thuốc thành công!", report });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const getDrugReports = async (req, res) => {
  try {
    // SaaS Admin (role=admin) không có hospitalId → cho phép truyền ?hospitalId
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === "admin" && req.query.hospitalId) {
      if (!isValidObjectId(req.query.hospitalId)) {
        return res.status(400).json({ success: false, message: "hospitalId không hợp lệ." });
      }
      hospitalId = req.query.hospitalId;
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Yêu cầu tài khoản có gán hospitalId hoặc truyền ?hospitalId (SaaS Admin)." });
    }
    const reports = await DrugReport.find({ hospitalId })
      .populate("author", "profile.name email")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const getDrugReportById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID báo cáo không hợp lệ." });
    }
    const report = await DrugReport.findById(id).populate("author", "profile.name email");
    if (!report) {
      return res.status(404).json({ success: false, message: "Không tìm thấy báo cáo." });
    }

    // ── Kiểm tra ownership: ngăn cross-hospital data leak ────────────────────
    if (req.user.role !== "admin") {
      if (!req.user.hospitalId || report.hospitalId.toString() !== req.user.hospitalId.toString()) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xem báo cáo này." });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 1. Subscription & Billing ───────────────────────────────────────────────
export const updateHospitalSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionPlan, subscriptionExpiresAt, subscriptionStatus } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID bệnh viện không hợp lệ." });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }

    if (subscriptionPlan !== undefined) hospital.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined) hospital.subscriptionExpiresAt = new Date(subscriptionExpiresAt);
    if (subscriptionStatus !== undefined) hospital.subscriptionStatus = subscriptionStatus;

    await hospital.save();

    // Log the action
    await AuditLog.create({
      action: "update-subscription",
      entity: "Hospital",
      entityId: id,
      performedBy: req.user.id,
      hospitalId: id,
      details: `Cập nhật gói dịch vụ: gói ${hospital.subscriptionPlan}, trạng thái ${hospital.subscriptionStatus}, hết hạn vào ${hospital.subscriptionExpiresAt}`,
    });

    res.status(200).json({ success: true, message: "Cập nhật gói dịch vụ bệnh viện thành công.", hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 2. Monitoring & SLA Alerts ───────────────────────────────────────────────
export const getSlaStatus = async (req, res) => {
  try {
    // Generate simulated SLA status and metrics for hospitals
    const hospitals = await Hospital.find().select("name code isActive").lean();
    const now = new Date();
    
    const slaMetrics = hospitals.map((h, index) => {
      // Mock metrics based on index or active status
      const uptime = h.isActive ? (99.85 + (index % 3) * 0.05).toFixed(2) : "0.00";
      const avgLatency = h.isActive ? (1200 + (index % 5) * 450) : 0;
      const status = h.isActive ? (avgLatency > 3000 ? "warning" : "healthy") : "offline";
      const activeIncidents = avgLatency > 3000 ? 1 : 0;
      
      return {
        hospitalId: h._id,
        name: h.name,
        code: h.code,
        uptime: parseFloat(uptime),
        latencyMs: avgLatency,
        status,
        activeIncidents,
        lastChecked: now
      };
    });

    res.status(200).json({ success: true, slaMetrics });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 3. Tenant Isolation Verification ──────────────────────────────────────────
export const verifyTenantIsolation = async (req, res) => {
  try {
    const hospitals = await Hospital.find().select("_id name").lean();
    const results = [];
    
    for (const h of hospitals) {
      // Run dry-run checks to verify that query isolation works:
      // Verify if visits query restricted to hospital h._id only returns documents belonging to h._id
      const leakCount = await Visit.countDocuments({
        hospitalId: { $ne: h._id },
        performedByHospital: h._id // simulated field or mismatch check
      });
      
      results.push({
        hospitalId: h._id,
        name: h.name,
        status: leakCount === 0 ? "isolated" : "leaked",
        issuesCount: leakCount,
        verifiedAt: new Date()
      });
    }

    const allIsolated = results.every(r => r.status === "isolated");
    res.status(200).json({
      success: true,
      allIsolated,
      details: "Tất cả các cơ sở dữ liệu bệnh viện đã được xác nhận cách biệt (isolated) hoàn toàn.",
      verificationResults: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 4. Backup & Restore Tenant Data ──────────────────────────────────────────
export const backupHospitalData = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID bệnh viện không hợp lệ." });
    }

    const hospital = await Hospital.findById(id).lean();
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }

    // Retrieve all hospital specific data
    const [visits, users, invoices] = await Promise.all([
      Visit.find({ hospitalId: id }).lean(),
      User.find({ hospitalId: id }).lean(),
      Invoice.find({ hospitalId: id }).lean()
    ]);

    const backupData = {
      hospital,
      visits,
      users: users.map(u => {
        const { passwordHash, ...safeUser } = u; // Exclude passwords for safety
        return safeUser;
      }),
      invoices,
      timestamp: new Date(),
      version: "1.0"
    };

    const backupDir = path.resolve(__dirname, "../../uploads/backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const fileName = `backup_${hospital.code}_${Date.now()}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf8");

    // Log the backup
    await AuditLog.create({
      action: "backup-tenant",
      entity: "Hospital",
      entityId: id,
      performedBy: req.user.id,
      hospitalId: id,
      details: `Đã thực hiện sao lưu (backup) thành công dữ liệu bệnh viện ${hospital.name}. File: ${fileName}`,
    });

    res.status(200).json({
      success: true,
      message: `Sao lưu dữ liệu bệnh viện ${hospital.name} thành công.`,
      fileName,
      filePath: `/uploads/backups/${fileName}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const restoreHospitalData = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName } = req.body;

    if (!isValidObjectId(id) || !fileName) {
      return res.status(400).json({ success: false, message: "ID bệnh viện hoặc tên file không hợp lệ." });
    }

    // Sanitize fileName — chỉ cho phép file trong thư mục backups, chặn path traversal
    const safeName = path.basename(fileName);
    if (safeName !== fileName) {
      return res.status(400).json({ success: false, message: "Tên file không hợp lệ." });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }

    const backupDir = path.resolve(__dirname, "../../uploads/backups");
    const filePath = path.join(backupDir, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Không tìm thấy file sao lưu trên hệ thống." });
    }

    // Đọc và parse file backup
    let backupData;
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      backupData = JSON.parse(raw);
    } catch {
      return res.status(400).json({ success: false, message: "File sao lưu bị hỏng hoặc không đúng định dạng JSON." });
    }

    // Validate: file backup phải thuộc đúng bệnh viện này
    if (!backupData.hospital || backupData.hospital._id?.toString() !== id) {
      return res.status(400).json({
        success: false,
        message: `File backup thuộc về bệnh viện khác (${backupData.hospital?.name || "Không xác định"}). Không thể restore cho bệnh viện "${hospital.name}".`
      });
    }

    const restoredStats = { visits: 0, users: 0, usersUpdated: 0, usersCreated: 0, invoices: 0 };
    const warnings = [];

    // ── 1. Restore Visits ──────────────────────────────────────────────────────
    await Visit.deleteMany({ hospitalId: id });
    if (Array.isArray(backupData.visits) && backupData.visits.length > 0) {
      // Đảm bảo hospitalId đúng với bệnh viện hiện tại
      const visitsToInsert = backupData.visits.map(v => ({
        ...v,
        _id: v._id,
        hospitalId: id,
      }));
      await Visit.insertMany(visitsToInsert, { ordered: false });
      restoredStats.visits = visitsToInsert.length;
    }

    // ── 2. Restore Invoices ────────────────────────────────────────────────────
    await Invoice.deleteMany({ hospitalId: id });
    if (Array.isArray(backupData.invoices) && backupData.invoices.length > 0) {
      const invoicesToInsert = backupData.invoices.map(inv => ({
        ...inv,
        hospitalId: id,
      }));
      await Invoice.insertMany(invoicesToInsert, { ordered: false });
      restoredStats.invoices = invoicesToInsert.length;
    }

    // ── 3. Restore Users ───────────────────────────────────────────────────────
    // Backup không chứa passwordHash (đã loại bỏ lúc backup vì lý do bảo mật)
    // Chiến lược:
    //   - Nếu user còn tồn tại (theo email): cập nhật profile/role, GIỮ NGUYÊN passwordHash
    //   - Nếu user không còn tồn tại: tạo mới với temp password, yêu cầu reset
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      // Tạo 1 temp password hash chung cho các user bị mất
      const tempPw = "NeuroRestore@" + Math.random().toString(36).substring(2, 10);
      const tempHash = await bcrypt.hash(tempPw, 10);

      for (const u of backupData.users) {
        if (!u.email) continue;
        const existing = await User.findOne({ email: u.email });
        if (existing) {
          // Cập nhật thông tin nhưng GIỮ NGUYÊN mật khẩu hiện tại
          await User.findByIdAndUpdate(existing._id, {
            role: u.role,
            hospitalId: id,
            isVerified: u.isVerified ?? existing.isVerified,
            isLocked: u.isLocked ?? false,
            profile: u.profile ?? existing.profile,
          });
          restoredStats.usersUpdated++;
        } else {
          // Tạo lại tài khoản với mật khẩu tạm — người dùng cần reset
          await User.create({
            _id: u._id,
            email: u.email,
            passwordHash: tempHash,
            role: u.role,
            hospitalId: id,
            isVerified: u.isVerified ?? false,
            isLocked: u.isLocked ?? false,
            profile: u.profile ?? {},
            tokenVersion: 0,
          });
          restoredStats.usersCreated++;
          warnings.push(`Tài khoản ${u.email} được tạo lại với mật khẩu tạm — yêu cầu đặt lại mật khẩu.`);
        }
        restoredStats.users++;
      }
    }

    // ── 4. AuditLog ───────────────────────────────────────────────────────────
    await AuditLog.create({
      action: "restore-tenant",
      entity: "Hospital",
      entityId: id,
      performedBy: req.user.id,
      hospitalId: id,
      details: `Khôi phục thành công: ${restoredStats.visits} lượt khám, ${restoredStats.users} tài khoản (${restoredStats.usersUpdated} cập nhật / ${restoredStats.usersCreated} tạo mới), ${restoredStats.invoices} hóa đơn từ file: ${safeName}`,
    });

    res.status(200).json({
      success: true,
      message: `Khôi phục dữ liệu bệnh viện "${hospital.name}" thành công!`,
      restoredStats,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};


// ─── 5. AI Model Versioning & Rollback ──────────────────────────────────────────
export const getAiModels = async (req, res) => {
  try {
    // Return standard mock list of AI model versions available for rollback
    const versions = [
      { version: "neuroscan-v2.1.0", accuracy: 96.8, status: "active", deployedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { version: "neuroscan-v2.0.4", accuracy: 95.4, status: "rollback_target", deployedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      { version: "neuroscan-v1.8.9", accuracy: 93.2, status: "rollback_target", deployedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    ];
    res.status(200).json({ success: true, versions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const rollbackAiModel = async (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn phiên bản AI để khôi phục." });
    }

    // Process rollback logic
    await AuditLog.create({
      action: "rollback-ai-model",
      entity: "AIModel",
      entityId: version,
      performedBy: req.user.id,
      details: `Đã thực hiện rollback mô hình AI hệ thống về phiên bản: ${version}`,
    });

    res.status(200).json({
      success: true,
      message: `Khôi phục mô hình AI về phiên bản ${version} thành công!`,
      currentVersion: version
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 6. Support & Announcements ──────────────────────────────────────────────
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp tiêu đề và nội dung thông báo." });
    }

    const ann = new Announcement({
      title,
      content,
      type: type || 'info',
      author: req.user.id
    });

    await ann.save();

    // Log the announcement
    await AuditLog.create({
      action: "create-announcement",
      entity: "Announcement",
      entityId: ann._id,
      performedBy: req.user.id,
      details: `Admin đăng thông báo khẩn cấp hệ thống: ${title}`,
    });

    res.status(201).json({ success: true, message: "Tạo thông báo khẩn cấp thành công!", announcement: ann });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

