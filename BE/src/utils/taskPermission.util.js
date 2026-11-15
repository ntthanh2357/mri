/**
 * [P2-6] Quyền đổi trạng thái một bước công việc (task) của lượt khám — hàm thuần, không truy vấn DB.
 * Chỉ người đúng vai trò của bước, hoặc người được giao trực tiếp, mới được đổi trạng thái.
 * FE dùng bản sao ở FE/src/utils/taskPermission.js để chỉ hiện nút cho người được phép;
 * test FE/src/tests/fe_task_permission.test.mjs đối chiếu hai bản trên toàn bộ tổ hợp.
 */
export const TASK_ADMIN_ROLES = Object.freeze(["admin", "system_admin", "hospital_admin", "department_head"]);

const ROLE_LABELS = {
  doctor: "bác sĩ",
  radiologist: "bác sĩ CĐHA",
  technician: "kỹ thuật viên",
  lab_technician: "kỹ thuật viên xét nghiệm",
  nurse: "điều dưỡng",
  receptionist: "lễ tân",
  pharmacist: "dược sĩ",
};

// assignedToUserId có thể là ObjectId, chuỗi, hoặc object đã populate ({ _id, profile })
const idOf = (v) => (v && typeof v === "object" && v._id ? v._id : v);

/** null nếu được phép; ngược lại mã lý do: "missing" | "assigned_other" | "auto" | "role" */
export const taskUpdateDenial = (task, user) => {
  if (!task || !user) return "missing";
  if (TASK_ADMIN_ROLES.includes(user.role)) return null;
  const assigned = idOf(task.assignedToUserId);
  if (assigned && String(assigned) !== String(user.id || user._id)) return "assigned_other";
  // Bước "auto" là của hệ thống/AI, không cho nhân viên tự tick
  if (task.roleRequired === "auto") return "auto";
  if (task.roleRequired === "doctor" && ["doctor", "radiologist", "department_head"].includes(user.role)) return null;
  if (task.roleRequired === "technician" && ["technician", "lab_technician"].includes(user.role)) return null;
  return task.roleRequired === user.role ? null : "role";
};

export const canUpdateTask = (task, user) => taskUpdateDenial(task, user) === null;

/** Thông báo dễ hiểu cho người dùng khi bị từ chối */
export const taskDenialMessage = (task, reason) => {
  const title = task?.title || "";
  if (reason === "assigned_other") return `Bước "${title}" đã được giao cho người khác phụ trách.`;
  if (reason === "auto") return `Bước "${title}" do hệ thống tự cập nhật.`;
  const label = ROLE_LABELS[task?.roleRequired] || task?.roleRequired || "";
  return `Bạn không có quyền cập nhật bước "${title}" (bước này dành cho ${label}).`;
};
