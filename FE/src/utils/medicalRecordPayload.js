// Dựng dữ liệu gửi lên /emr/records từ form "Bệnh án Ung thư Não" (MedicalRecordFormScreen).
// Chỉ gửi trường người dùng đã nhập. Không gửi hình thức vào viện, khoa, đối tượng thanh toán, trạng thái:
// form không có các ô này. Giá trị cứng cũ ('Tự đến', 'Thần kinh', 'BHYT') sai danh mục làm lưu lên server
// luôn hỏng, và khi sửa sẽ ghi đè dữ liệu thật của bệnh án.
const GENDERS = ['Nam', 'Nữ', 'Khác'];
const text = (v) => (typeof v === 'string' ? v.trim() : '');

export const buildMedicalRecordPayload = (formData = {}, patientId) => {
  const h = formData.hanhChinh || {};
  const payload = { patientId };
  if (text(h.hoTen)) payload.patientName = text(h.hoTen);
  if (GENDERS.includes(text(h.gioiTinh))) payload.gender = text(h.gioiTinh);
  const age = String(h.tuoi ?? '').trim();
  if (age !== '' && Number.isFinite(Number(age))) payload.age = Number(age);
  if (text(formData.chanDoan?.xacDinh)) payload.diagnosis = text(formData.chanDoan.xacDinh);
  if (text(formData.huongDieuTri?.chuyenKhoa)) payload.treatmentPlan = text(formData.huongDieuTri.chuyenKhoa);
  return payload;
};
