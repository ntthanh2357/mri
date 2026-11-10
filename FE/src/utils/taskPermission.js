/**
 * Bản sao quy tắc BE/src/utils/taskPermission.util.js — chỉ hiện nút đổi trạng thái bước công việc
 * cho người BE cho phép (bước đã giao cho người khác, hoặc bước "auto" của hệ thống, thì không hiện nút).
 * Test src/tests/fe_task_permission.test.mjs đối chiếu với bản BE trên toàn bộ tổ hợp.
 */
export const TASK_ADMIN_ROLES = Object.freeze(['admin', 'system_admin', 'hospital_admin', 'department_head']);

const idOf = (v) => (v && typeof v === 'object' && v._id ? v._id : v);

export const canUpdateTask = (task, user) => {
  if (!task || !user) return false;
  if (TASK_ADMIN_ROLES.includes(user.role)) return true;
  const assigned = idOf(task.assignedToUserId);
  if (assigned && String(assigned) !== String(user.id || user._id)) return false;
  if (task.roleRequired === 'auto') return false;
  if (task.roleRequired === 'doctor' && ['doctor', 'radiologist', 'department_head'].includes(user.role)) return true;
  if (task.roleRequired === 'technician' && ['technician', 'lab_technician'].includes(user.role)) return true;
  return task.roleRequired === user.role;
};
