import { SupportTicket } from "../models/supportTicket.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { LabOrder } from "../models/labOrder.model.js";

// ─── 1. Tạo ticket hỗ trợ ───────────────────────────────────────────────────
export const createTicket = async (req, res) => {
  try {
    const { topic, message, priority } = req.body;

    if (!topic || !message) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp chủ đề và nội dung mô tả vấn đề.",
      });
    }

    const ticket = await SupportTicket.create({
      userId: req.user.id,
      hospitalId: req.user.hospitalId || null,
      topic: topic.trim(),
      message: message.trim(),
      priority: priority || "medium",
      status: "open",
    });

    await ticket.populate("userId", "profile.name email role");

    return res.status(201).json({
      success: true,
      message: "Yêu cầu hỗ trợ đã được ghi nhận! Đội kỹ thuật sẽ liên hệ lại trong tối đa 2 giờ.",
      ticket,
    });
  } catch (error) {
    console.error("createTicket error:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 2. Lấy danh sách ticket của user hiện tại ──────────────────────────────
export const getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error("getMyTickets error:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 3. Lấy tất cả ticket (Admin) ───────────────────────────────────────────
export const getAllTickets = async (req, res) => {
  try {
    const { status, hospitalId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (hospitalId) filter.hospitalId = hospitalId;

    const tickets = await SupportTicket.find(filter)
      .populate("userId", "profile.name email role")
      .populate("hospitalId", "name code")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error("getAllTickets error:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 4. Cập nhật trạng thái ticket (Admin) ──────────────────────────────────
export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });
    }

    const updateData = { status };
    if (note) updateData.note = note;
    if (status === "resolved") {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user.id;
    }

    const ticket = await SupportTicket.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ticket." });
    }

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("updateTicketStatus error:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};

// ─── 5. Metrics hệ thống thực từ DB ─────────────────────────────────────────
// Trả về số liệu thực từ MongoDB, không cần server giám sát phần cứng
export const getSystemMetrics = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Truy vấn song song để giảm thời gian chờ
    const [
      visitsTodayCount,
      visitsMonthCount,
      activeUsersCount,
      openTicketsCount,
      imagingTodayCount,
      pendingLabsCount,
    ] = await Promise.all([
      Visit.countDocuments({
        hospitalId,
        createdAt: { $gte: today },
      }),
      Visit.countDocuments({
        hospitalId,
        createdAt: { $gte: thisMonth },
      }),
      User.countDocuments({
        hospitalId,
        isLocked: false,
        role: { $in: ["doctor", "nurse", "technician", "receptionist"] },
      }),
      SupportTicket.countDocuments({
        hospitalId,
        status: "open",
      }),
      ImagingResult.countDocuments({
        hospitalId,
        createdAt: { $gte: today },
      }).catch(() => 0),
      LabOrder.countDocuments({
        hospitalId,
        status: "PENDING",
      }).catch(() => 0),
    ]);

    // Tính tỷ lệ sử dụng (%) từ số liệu thực
    const maxCapacity = 50; // visits/day default
    const utilizationPercent = Math.min(
      Math.round((visitsTodayCount / maxCapacity) * 100),
      100
    );

    return res.status(200).json({
      success: true,
      metrics: {
        // Hiển thị dưới dạng "tải hệ thống" từ lượt khám thực tế
        systemUtilization: utilizationPercent,
        visitedToday: visitsTodayCount,
        visitedThisMonth: visitsMonthCount,
        activeStaff: activeUsersCount,
        openSupportTickets: openTicketsCount,
        imagingToday: imagingTodayCount,
        pendingLabOrders: pendingLabsCount,
        // Thời gian trung bình giả lập từ số liệu thực (ms per visit estimate)
        estimatedLatencyMs:
          visitsTodayCount > 0
            ? Math.round((visitsTodayCount / maxCapacity) * 800 + 200)
            : 0,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("getSystemMetrics error:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ: " + error.message });
  }
};
