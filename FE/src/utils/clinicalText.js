// Trích thuốc / chỉ định từ nội dung form để gọi kiểm tra an toàn kê đơn (/api/drugs/check-prescription).
// Dùng chung cho DocumentDetailScreen (form phẳng) và MedicalRecordFormScreen (form lồng nhiều cấp).

const KNOWN_MEDICATIONS = ['keppra', 'depakine', 'dexamethasone', 'donepezil', 'diazepam', 'phenobarbital', 'tegretol'];

export const extractMedications = (text) => {
  if (!text) return [];
  const lower = text.toLowerCase();
  return KNOWN_MEDICATIONS.filter((name) => lower.includes(name));
};

// Gom mọi giá trị chuỗi trong form, kể cả object lồng nhau.
const collectText = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return Object.values(value).map(collectText).join(' ');
  return String(value);
};

export const extractOrders = (formData) => {
  const text = collectText(formData).toLowerCase();
  const found = [];
  if (text.includes('mri') || text.includes('cản từ') || text.includes('gadolinium') || text.includes('tương phản')) {
    found.push('MRI sọ não có cản quang');
  }
  return found;
};
