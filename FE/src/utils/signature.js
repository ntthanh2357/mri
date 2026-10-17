// Chữ ký tay & trạng thái phiếu đồng thuận tiêm cản quang (UC-PAT-06).

/** Khung toạ độ chuẩn để lưu chữ ký: hiển thị lại ở mọi kích thước bằng viewBox. */
export const SIGNATURE_VIEWBOX = { width: 300, height: 120 };

const round = (n) => Math.round(n * 10) / 10;

/**
 * Nét ký (toạ độ theo khung ký thực tế) → đường SVG "M x y L x y …" trong viewBox 300x120.
 * Chạm 1 điểm vẫn ra 1 chấm (thêm đoạn rất ngắn) để BE nhận là có nét.
 */
export const strokesToPath = (strokes, { width, height }) => {
  if (!width || !height) return '';
  const sx = SIGNATURE_VIEWBOX.width / width;
  const sy = SIGNATURE_VIEWBOX.height / height;
  const parts = [];
  for (const stroke of strokes || []) {
    if (!stroke?.length) continue;
    const pts = stroke.map((p) => [round(p.x * sx), round(p.y * sy)]);
    if (pts.length === 1) pts.push([pts[0][0] + 0.5, pts[0][1] + 0.5]);
    parts.push(`M${pts[0][0]} ${pts[0][1]} ` + pts.slice(1).map(([x, y]) => `L${x} ${y}`).join(' '));
  }
  return parts.join(' ');
};

/** Bước hiện tại của phiếu: trả lời sàng lọc → (bác sĩ xem xét nếu nguy cơ cao) → ký → đã ký. */
export const consentStatus = (c) => {
  if (!c) return null;
  if (c.patientSigned) return { key: 'signed', label: 'Đã ký', tone: 'ok', icon: 'check-circle' };
  if (!c.patientChecklistAt) return { key: 'checklist', label: 'Chờ trả lời câu hỏi sàng lọc', tone: 'info', icon: 'clipboard' };
  if (c.isBlockedByChecklist && !c.isDoctorOverridden) return { key: 'blocked', label: 'Chờ bác sĩ xem xét nguy cơ', tone: 'warn', icon: 'alert-triangle' };
  return { key: 'ready', label: 'Chờ ký', tone: 'info', icon: 'edit-3' };
};
