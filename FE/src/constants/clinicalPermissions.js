/**
 * Vai trò được phép theo từng thao tác lâm sàng trên giao diện — khớp phân quyền route BE:
 * emr.routes.js, transfer.routes.js, patient.routes.js, imaging.routes.js, sharedRecord.routes.js, invoice.routes.js, mriRoom.routes.js.
 * Tài khoản nền tảng (admin, system_admin) không truy cập dữ liệu lâm sàng (RELEASE_v3.4).
 * Test src/tests/fe_clinical_permissions.test.mjs đối chiếu tự động danh sách này với route BE.
 */
export const PERMS = Object.freeze({
  emrRead: ['doctor', 'radiologist', 'department_head', 'nurse', 'technician', 'lab_technician', 'pharmacist', 'receptionist', 'hospital_admin'],
  emrCreate: ['doctor', 'department_head', 'nurse', 'receptionist', 'hospital_admin'],
  emrSign: ['doctor', 'department_head', 'hospital_admin'],
  emrAddendum: ['doctor', 'department_head', 'hospital_admin'],
  careRead: ['doctor', 'radiologist', 'department_head', 'nurse', 'receptionist', 'hospital_admin'],
  careCreate: ['doctor', 'department_head', 'nurse', 'hospital_admin'],
  consultRead: ['doctor', 'radiologist', 'department_head', 'hospital_admin'],
  consentRead: ['doctor', 'department_head', 'patient', 'hospital_admin'],
  versionsRead: ['doctor', 'radiologist', 'department_head', 'hospital_admin'],
  transfersRead: ['doctor', 'department_head', 'radiologist', 'nurse', 'hospital_admin', 'receptionist'],
  transferCancel: ['doctor', 'department_head', 'hospital_admin', 'receptionist'],
  transferSendEmail: ['receptionist', 'doctor', 'department_head', 'hospital_admin'],
  prescriptionCreate: ['doctor', 'department_head', 'hospital_admin'],
  imagingStaffRead: ['doctor', 'radiologist', 'department_head', 'technician', 'nurse', 'receptionist', 'hospital_admin'],
  imagingCreate: ['doctor', 'radiologist', 'department_head', 'technician'],
  mriEmergencySchedule: ['technician', 'radiologist', 'doctor', 'department_head', 'hospital_admin', 'receptionist'],
  preScreeningRead: ['nurse', 'doctor', 'radiologist', 'department_head', 'technician', 'lab_technician', 'pharmacist', 'hospital_admin'],
  // giấy ra viện / phiếu chuyển tuyến của bệnh nhân (bệnh nhân tự xem của mình qua checkSelfOrRoles)
  dischargeRead: ['doctor', 'department_head', 'radiologist', 'nurse', 'receptionist', 'pharmacist', 'hospital_admin'],
  transferFormRead: ['doctor', 'department_head', 'radiologist', 'nurse', 'pharmacist', 'hospital_admin', 'receptionist'],
  shareRedeemStaff: ['doctor', 'department_head', 'nurse', 'receptionist', 'technician'],
  invoicePay: ['receptionist', 'hospital_admin'],
});

export const PLATFORM_ADMIN_ROLES = Object.freeze(['admin', 'system_admin']);
export const isPlatformAdminRole = (role) => PLATFORM_ADMIN_ROLES.includes(role);
export const PLATFORM_ADMIN_NOTICE = 'Tài khoản quản trị nền tảng không truy cập dữ liệu lâm sàng của bệnh nhân (bệnh án, chuyển viện, phim, xét nghiệm).';

/** role có quyền perm không (role rỗng → false) */
export const can = (role, perm) => Boolean(role) && (PERMS[perm] || []).includes(role);
