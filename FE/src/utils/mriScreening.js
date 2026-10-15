// Phiếu sàng lọc an toàn MRI bệnh nhân tự khai (BE: services/mriPrep.service.js). Hàm thuần để test bằng node.

/** Nhãn ngắn cho phía kỹ thuật viên — khoá khớp MRI_SCREENING_QUESTIONS ở BE. `danger`: có thể là chống chỉ định. */
export const SCREENING_LABELS = {
  pacemaker: { label: 'Máy tạo nhịp / máy khử rung tim', danger: true },
  aneurysmClip: { label: 'Kẹp mạch máu não', danger: true },
  cochlearImplant: { label: 'Ốc tai điện tử / máy kích thích thần kinh / bơm thuốc cấy', danger: true },
  metalFragments: { label: 'Mảnh kim loại trong người', danger: true },
  implants: { label: 'Van tim, stent, khớp nhân tạo, nẹp vít', danger: false },
  recentSurgery: { label: 'Phẫu thuật trong 6 tuần', danger: false },
  pregnant: { label: 'Có thai / có thể có thai', danger: false },
  claustrophobia: { label: 'Sợ không gian kín', danger: false },
  cannotLieStill: { label: 'Khó nằm yên 30–45 phút', danger: false },
  tattoo: { label: 'Hình xăm lớn / phun xăm / miếng dán thuốc', danger: false },
};
export const ANSWER_LABEL = { yes: 'Có', no: 'Không', unsure: 'Không rõ' };

const declared = (s) => !!(s && s.declaredAt && s.answers);

/** Các câu bệnh nhân trả lời "Có" / "Không rõ", câu nguy hiểm lên đầu. */
export const flaggedAnswers = (screening) => {
  if (!declared(screening)) return [];
  return Object.entries(screening.answers)
    .filter(([, a]) => a === 'yes' || a === 'unsure')
    .map(([key, answer]) => ({ key, answer, label: SCREENING_LABELS[key]?.label || key, danger: !!SCREENING_LABELS[key]?.danger }))
    .sort((a, b) => Number(b.danger) - Number(a.danger));
};

/**
 * Điền sẵn bảng kiểm của KTV theo lời khai. Câu nguy hiểm trả lời "Có" hoặc "Không rõ" → bật ô kim loại / thiết bị:
 * KTV phải tự kiểm tra rồi mới bỏ tick được (thà chặn nhầm còn hơn bỏ sót).
 */
export const prefillFromScreening = (screening) => {
  const flags = flaggedAnswers(screening);
  const has = (key) => flags.some((f) => f.key === key);
  return {
    hasPacemakerOrMetal: flags.some((f) => f.danger),
    hasClaustrophobia: has('claustrophobia'),
    isPregnant: has('pregnant'),
    // chỉ tóm tắt câu trả lời có cấu trúc; KHÔNG chép chữ tự do của bệnh nhân vào ghi chú mang tên KTV
    // (chữ đó vẫn hiện riêng trong bảng kiểm, lưu ở patientMriScreening.details)
    safetyNotes: declared(screening)
      ? (flags.length ? `BN tự khai: ${flags.map((f) => `${f.label} (${ANSWER_LABEL[f.answer]})`).join('; ')}` : 'BN tự khai: không có yếu tố nào')
      : '',
  };
};

/** Nhãn trên hàng đợi chụp khi KTV chưa kiểm tra: lời khai của bệnh nhân (null nếu chưa khai). */
export const screeningBadge = (screening) => {
  if (!declared(screening)) return null;
  if (screening.level === 'danger') return { tone: 'danger', label: 'BN khai: có kim loại' };
  if (screening.level === 'attention') return { tone: 'warning', label: 'BN khai: cần lưu ý' };
  return { tone: 'info', label: 'BN khai: không nguy cơ' }; // chỉ là lời khai, KTV chưa kiểm tra
};
