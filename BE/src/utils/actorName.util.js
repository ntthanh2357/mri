/**
 * Tên người thực hiện ghi lên giấy tờ lâm sàng (đơn thuốc, giấy ra viện, chuyển viện, ghi đè cảnh báo thuốc):
 * LẤY TỪ TÀI KHOẢN ĐÃ XÁC THỰC, không nhận tên do client gửi và không dùng tên chung "Bác sĩ điều trị".
 * Trước đây body.doctor_name được ghi thẳng: bác sĩ A kê đơn/ghi đè cảnh báo dưới tên bác sĩ B được.
 */
export const actorDisplayName = (user) => {
  const p = user?.profile || {};
  return String(p.fullName || p.name || user?.name || user?.email || user?.id || user?._id || "").trim();
};
