import { MriRoom } from "../modules/hospital/models/mriRoom.model.js";
import { MriSlot } from "../modules/hospital/models/mriSlot.model.js";

export const ROOM_STATUS_VI = {
  active: "Đang hoạt động",
  maintenance: "Bảo trì",
  inactive: "Ngừng hoạt động",
};

/**
 * Kiểm tra xem bệnh viện và phòng MRI gắn với ca chụp (nếu có) có đang hoạt động không.
 * Trả về thông báo chặn tiếng Việt nếu không khả dụng, hoặc null nếu hợp lệ.
 * (Bỏ qua nếu bệnh viện chưa cấu hình bản ghi MriRoom nào trong DB.)
 */
export const getMriRoomBlockMessage = async (visit) => {
  if (!visit?.hospitalId) return null;

  const slot = await MriSlot.findOne({
    hospitalId: visit.hospitalId,
    visitId: visit._id,
    status: { $in: ["booked", "in_progress"] },
  })
    .sort({ startTime: -1 })
    .populate("roomId", "name status")
    .lean();

  if (slot?.roomId && slot.roomId.status && slot.roomId.status !== "active") {
    const label = ROOM_STATUS_VI[slot.roomId.status] || slot.roomId.status;
    return `Phòng ${slot.roomId.name || "MRI"} đang ở trạng thái "${label}". Không thể đưa bệnh nhân vào buồng chụp.`;
  }

  const [totalRooms, activeRooms] = await Promise.all([
    MriRoom.countDocuments({ hospitalId: visit.hospitalId }),
    MriRoom.countDocuments({ hospitalId: visit.hospitalId, status: "active" }),
  ]);

  if (totalRooms > 0 && activeRooms === 0) {
    return "Tất cả phòng máy MRI của bệnh viện hiện đang bảo trì hoặc ngừng hoạt động. Không thể đưa bệnh nhân vào buồng chụp.";
  }

  return null;
};

