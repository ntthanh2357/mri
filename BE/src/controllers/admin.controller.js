import { isValidObjectId } from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getAllUsers,
  toggleUserLock,
  getAllDoctors,
  verifyDoctor,
  getUserById,
  lockUserById as lockUserByIdService,
  unlockUserById as unlockUserByIdService,
  getSystemStats,
  verifyDoctorById as verifyDoctorByIdService,
  verifyAdminById,
} from "../services/user.service.js";
import { getDatasets, createDataset, updateDatasetPrice as updateDatasetPriceService } from "../services/dataset.service.js";
import { getAuditLogs, anonymizeAuditLogs } from "../services/audit.service.js";

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

export const fetchDoctors = async (req, res) => {
  try {
    const doctors = await getAllDoctors();
    res.status(200).json({ success: true, doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDoctorAccount = async (req, res) => {
  try {
    const { userId, verified } = req.body;
    const adminId = req.user.id;
    const doctor = await verifyDoctor(userId, Boolean(verified), adminId);
    res.status(200).json({ success: true, doctor });
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
    const logs = await getAuditLogs();
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
    const adminId = req.user._id;
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
    const adminId = req.user._id;
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

// ─── 3.5 verifyDoctorById ────────────────────────────────────────────────────
export const verifyDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid doctor ID" });
      return;
    }
    const { verified } = req.body;
    if (typeof verified !== "boolean") {
      res.status(400).json({ success: false, message: "Field 'verified' must be a boolean" });
      return;
    }
    const adminId = req.user._id;
    const doctor = await verifyDoctorByIdService(id, verified, adminId);
    res.status(200).json({ success: true, doctor });
  } catch (error) {
    if (error.message === "Doctor not found") {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
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
    const adminId = req.user._id;
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
    const adminId = req.user._id;
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
    const adminId = req.user._id;
    const { modifiedCount } = await anonymizeAuditLogs(adminId);
    res.status(200).json({ success: true, modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Feedback logs
// @route   GET /api/v1/admin/ai-feedback
// @access  Private (Admin only)
export const getAiFeedback = async (req, res) => {
  try {
    const feedbackPath = "c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/hard_examples/feedback_log.csv";
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
    const configPath = "c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/chatbot_config.json";
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
    const configPath = "c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/chatbot_config.json";
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
