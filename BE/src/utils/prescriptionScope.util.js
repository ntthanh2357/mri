/**
 * [P1-7] Dựng filter tìm đơn thuốc thuộc ĐÚNG một lượt khám.
 *
 * Trước đây nơi hoàn tất ca khám chỉ lọc `patient_id + createdAt >= visit.createdAt`,
 * nên đơn của lần khám trước (chưa thanh toán) bị hút vào ca mới và bị đánh
 * `isBilled = true`. Filter này scope theo `visitId`; chỉ fallback về đơn cũ
 * chưa gắn ca (`visitId == null`) tạo trong khoảng thời gian của ca.
 *
 * @param {{_id: any, patientId: any, createdAt?: Date}} visit
 * @returns {Object} filter Mongoose
 */
export const buildVisitPrescriptionFilter = (visit) => {
  const matches = [{ visitId: visit._id }];

  // Fallback cho đơn cũ chưa có visitId — chỉ khi biết chắc ca bắt đầu lúc nào.
  // Thiếu createdAt mà vẫn fallback sẽ hút đơn của mọi ca trước đó.
  if (visit.createdAt) {
    matches.push({ visitId: null, createdAt: { $gte: visit.createdAt } });
  }

  return {
    patient_id: visit.patientId,
    $or: matches,
    isBilled: { $ne: true },
  };
};

export default buildVisitPrescriptionFilter;
