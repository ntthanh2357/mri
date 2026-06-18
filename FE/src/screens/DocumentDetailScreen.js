import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Config from '../constants/config';

// ── Schemas ───────────────────────────────────────────────────────────────────
// field types:
//   (none)          → TextInput
//   multiline:true  → TextInput multiline
//   type:'radio'    → single-select (value = string)
//   type:'checkbox' → multi-select  (value = comma-separated string)

const DOC_SCHEMAS = {
  mau_kham_benh: {
    title: 'Phiếu thông tin khám bệnh',
    fields: [
      { key: 'ngayTiepNhan', label: 'Ngày tiếp nhận' },
      { key: 'maSo', label: 'Mã bệnh nhân / ID' },
      { key: 'doiTuong', label: 'Đối tượng', type: 'radio', options: ['Thu phí', 'BHYT', 'Miễn phí', 'Khác'] },
      { key: 'lyDoKham', label: 'Yêu cầu / Lý do khám', multiline: true },
      { key: 'mach', label: 'Mạch (lần/phút)' },
      { key: 'huyetAp', label: 'Huyết áp (mmHg)' },
      { key: 'chieuCao', label: 'Chiều cao (cm)' },
      { key: 'canNang', label: 'Cân nặng (kg)' },
      { key: 'nhietDo', label: 'Nhiệt độ (°C)' },
      { key: 'nhipTho', label: 'Nhịp thở (lần/phút)' },
      { key: 'spo2', label: 'SpO₂ (%)' },
    ],
  },

  phieu_thu_vien_phi: {
    title: 'Phiếu thu viện phí',
    fields: [
      { key: 'soPhieu', label: 'Số phiếu thu' },
      { key: 'ngayThu', label: 'Ngày thu' },
      { key: 'doiTuong', label: 'Đối tượng', type: 'radio', options: ['BHYT', 'Thu phí', 'Miễn phí'] },
      { key: 'danhSachDichVu', label: 'Danh sách dịch vụ (tên · đơn giá · SL)', multiline: true },
      { key: 'tongChiPhi', label: 'Tổng chi phí (VNĐ)', keyboardType: 'numeric' },
      { key: 'bhytChiTra', label: 'BHYT chi trả (VNĐ)', keyboardType: 'numeric' },
      { key: 'bnThanhToan', label: 'Bệnh nhân thanh toán (VNĐ)', keyboardType: 'numeric' },
      { key: 'soTienBangChu', label: 'Số tiền bằng chữ' },
    ],
  },

  tom_tat_hsba: {
    title: 'Tóm tắt hồ sơ bệnh án',
    fields: [
      { key: 'soHoSo', label: 'Số hồ sơ bệnh án / Mã số người bệnh' },
      { key: 'ngayNhapVien', label: 'Ngày nhập viện' },
      { key: 'ngayRaVien', label: 'Ngày ra viện' },
      {
        key: 'noiDungDeNghi', label: 'Nội dung đề nghị', type: 'checkbox',
        options: ['Bản tóm tắt bệnh án', 'Bản sao hồ sơ bệnh án', 'Phiếu xét nghiệm', 'Phim X-quang/CT/MRI', 'Khác'],
      },
      { key: 'mucDich', label: 'Mục đích sử dụng', multiline: true },
    ],
  },

  phieu_chi_dinh: {
    title: 'Phiếu chỉ định dịch vụ',
    fields: [
      { key: 'sba', label: 'Số bệnh án (SBA)' },
      { key: 'khoa', label: 'Khoa / Phòng khám' },
      { key: 'chanDoan', label: 'Chẩn đoán', multiline: true },
      { key: 'danhSachChiDinh', label: 'Danh sách yêu cầu (tên dịch vụ · SL · đơn giá)', multiline: true },
      { key: 'bacSiDieuTri', label: 'Bác sĩ điều trị' },
      { key: 'ngayGio', label: 'Ngày giờ chỉ định' },
    ],
  },

  toa_thuoc: {
    title: 'Toa thuốc',
    fields: [
      { key: 'maYTe', label: 'Mã y tế / Số hồ sơ' },
      { key: 'doiTuong', label: 'Đối tượng', type: 'radio', options: ['BHYT', 'Thu phí', 'Miễn phí'] },
      { key: 'chanDoan', label: 'Chẩn đoán' },
      { key: 'benhKemTheo', label: 'Bệnh kèm theo' },
      { key: 'danhSachThuoc', label: 'Danh sách thuốc (tên · liều lượng · cách dùng · SL)', multiline: true },
      { key: 'loiDan', label: 'Lời dặn của bác sĩ', multiline: true },
      { key: 'bacSiDieuTri', label: 'Bác sĩ điều trị / kê toa' },
    ],
  },

  giay_ra_vien: {
    title: 'Giấy ra viện',
    fields: [
      { key: 'soHoSo', label: 'Số hồ sơ / Số bệnh án' },
      { key: 'ngaySinh', label: 'Ngày/tháng/năm sinh' },
      { key: 'gioiTinh', label: 'Giới tính', type: 'radio', options: ['Nam', 'Nữ'] },
      { key: 'soBHYT', label: 'Mã số BHXH / Thẻ BHYT' },
      { key: 'vaoVienLuc', label: 'Vào viện lúc (giờ phút ngày tháng năm)' },
      { key: 'raVienLuc', label: 'Ra viện lúc (giờ phút ngày tháng năm)' },
      { key: 'chanDoan', label: 'Chẩn đoán', multiline: true },
      { key: 'phuongPhapDieuTri', label: 'Phương pháp điều trị', multiline: true },
      { key: 'ghiChu', label: 'Ghi chú', multiline: true },
    ],
  },

  chuyen_tuyen: {
    title: 'Phiếu chuyển tuyến TT01',
    fields: [
      { key: 'noiChuyenDen', label: 'Kính gửi / Nơi chuyển đến' },
      { key: 'namSinh', label: 'Năm sinh' },
      { key: 'gioiTinh', label: 'Giới tính', type: 'radio', options: ['Nam', 'Nữ'] },
      { key: 'soBHYT', label: 'Số thẻ BHYT (thời hạn)' },
      { key: 'daKhamTai', label: 'Đã điều trị tại (cơ sở · cấp · từ ngày đến ngày)', multiline: true },
      { key: 'dauHieuLamSang', label: 'Tóm tắt dấu hiệu lâm sàng', multiline: true },
      { key: 'ketQuaCLS', label: 'Kết quả xét nghiệm / cận lâm sàng chính', multiline: true },
      { key: 'chanDoan', label: 'Chẩn đoán (bệnh chính)', multiline: true },
      { key: 'phuongPhapDaThucHien', label: 'Phương pháp / thủ thuật đã thực hiện', multiline: true },
      { key: 'thuocDieuTriChinh', label: 'Kỹ thuật, thuốc điều trị chính đã sử dụng', multiline: true },
    ],
  },

  xet_nghiem_mau: {
    title: 'Phiếu kết quả xét nghiệm huyết học',
    fields: [
      { key: 'ngayXetNghiem', label: 'Ngày xét nghiệm' },
      { key: 'bsChiDinh', label: 'BS chỉ định XN' },
      { key: 'doiTuong', label: 'Đối tượng', type: 'radio', options: ['Thu phí', 'BHYT', 'Miễn phí'] },
      { key: 'wbc', label: 'WBC — Bạch cầu (10⁹/L)' },
      { key: 'neu', label: 'NEU% / NEU# (Bạch cầu đa nhân)' },
      { key: 'lym', label: 'LYM% / LYM# (Lymphocyte)' },
      { key: 'rbc', label: 'RBC — Hồng cầu (10¹²/L)' },
      { key: 'hgb', label: 'HGB — Hemoglobin (g/L)' },
      { key: 'hct', label: 'HCT — Hematocrit (%)' },
      { key: 'plt', label: 'PLT — Tiểu cầu (10⁹/L)' },
      { key: 'chiSoKhac', label: 'Chỉ số khác (MCV, MCH, MCHC, RDW...)', multiline: true },
    ],
  },

  hoa_sinh: {
    title: 'Phiếu xét nghiệm hóa sinh máu',
    fields: [
      { key: 'ngayXetNghiem', label: 'Ngày xét nghiệm' },
      { key: 'doiTuong', label: 'Đối tượng', type: 'radio', options: ['Thu phí', 'BHYT', 'Miễn phí'] },
      { key: 'ure', label: 'Ure (mmol/L) — CSBt: 2,5–7,5' },
      { key: 'glucose', label: 'Glucose (mmol/L) — CSBt: 3,9–6,4' },
      { key: 'creatinine', label: 'Creatinine (μmol/L) — Nam: 62–120 / Nữ: 53–100' },
      { key: 'ast', label: 'AST/GOT (U/L) — CSBt: ≤37' },
      { key: 'alt', label: 'ALT/GPT (U/L) — CSBt: ≤40' },
      { key: 'bilirubinTP', label: 'Bilirubin TP (μmol/L) — CSBt: ≤17' },
      { key: 'proteinTP', label: 'Protein TP (g/L) — CSBt: 65–82' },
      { key: 'albumin', label: 'Albumin (g/L) — CSBt: 35–50' },
      { key: 'cholesterol', label: 'Cholesterol (mmol/L) — CSBt: 3,9–5,2' },
      { key: 'triglycerid', label: 'Triglycerid (mmol/L) — CSBt: 0,46–1,88' },
      { key: 'hdl', label: 'HDL-cho (mmol/L)' },
      { key: 'ldl', label: 'LDL-cho (mmol/L) — CSBt: ≤3,4' },
      { key: 'na', label: 'Na⁺ (mmol/L) — CSBt: 135–145' },
      { key: 'k', label: 'K⁺ (mmol/L) — CSBt: 3,5–5' },
      { key: 'chiSoKhac', label: 'Chỉ số khác (Cl⁻, Ca, Magie, Acid Uric...)', multiline: true },
    ],
  },

  ct_scan: {
    title: 'Kết quả CT-Scan',
    fields: [
      { key: 'maYTe', label: 'Mã y tế' },
      { key: 'soBA', label: 'Số bệnh án' },
      { key: 'ngayChiDinh', label: 'Ngày chỉ định' },
      { key: 'bacSiChiDinh', label: 'Bác sĩ chỉ định' },
      { key: 'chanDoan', label: 'Chẩn đoán' },
      { key: 'chiDinh', label: 'Chỉ định CT (vùng chụp, kỹ thuật)' },
      { key: 'moTaHinhAnh', label: 'Mô tả hình ảnh', multiline: true },
      { key: 'ketLuan', label: 'Kết luận', multiline: true },
      { key: 'bacSiChuyenKhoa', label: 'Bác sĩ chuyên khoa đọc phim' },
    ],
  },

  mri: {
    title: 'Kết quả MRI',
    fields: [
      { key: 'maYTe', label: 'Mã y tế' },
      { key: 'soBA', label: 'Số bệnh án' },
      { key: 'ngayChiDinh', label: 'Ngày chỉ định' },
      { key: 'bacSiChiDinh', label: 'Bác sĩ chỉ định' },
      { key: 'chanDoan', label: 'Chẩn đoán' },
      { key: 'chiDinh', label: 'Chỉ định MRI (loại chụp, vùng chụp)' },
      { key: 'kyThuat', label: 'Kỹ thuật thực hiện' },
      { key: 'moTaHinhAnh', label: 'Mô tả hình ảnh', multiline: true },
      { key: 'ketLuan', label: 'Kết luận chẩn đoán', multiline: true },
      { key: 'bacSiChuyenKhoa', label: 'Bác sĩ chuyên khoa đọc phim' },
    ],
  },

  // MS: 01/BV2
  cam_ket_phau_thuat: {
    title: 'Giấy cam kết chấp thuận phẫu thuật, thủ thuật và gây mê hồi sức',
    fields: [
      // Loại — ô vuông tích như trên form mẫu
      {
        key: 'loaiPhauThuat', label: 'Loại phẫu thuật/thủ thuật',
        type: 'radio', options: ['Cấp cứu', 'Bán cấp', 'Chương trình/Phiên'],
      },
      // I. Bác sỹ phẫu thuật
      { key: 'bacSiPT_ten', label: 'I. Bác sĩ phẫu thuật — Họ và tên' },
      { key: 'bacSiPT_chucDanh', label: 'Bác sĩ phẫu thuật — Chức danh' },
      { key: 'bacSiPT_khoa', label: 'Bác sĩ phẫu thuật — Khoa' },
      { key: 'bacSiGayMe_ten', label: 'Bác sĩ gây mê hồi sức — Họ và tên' },
      { key: 'bacSiGayMe_chucDanh', label: 'Bác sĩ gây mê — Chức danh (Khoa Phẫu thuật Gây mê hồi sức)' },
      { key: 'nguoiBenh_pt', label: 'Tên người bệnh được phân công thực hiện' },
      { key: 'chanDoan_pt', label: 'Chẩn đoán' },
      // Nội dung tư vấn — checkboxes nhiều ô
      {
        key: 'tuVanVe', label: 'Đã tư vấn, giải thích về', type: 'checkbox',
        options: [
          'Chẩn đoán',
          'Lý do phẫu thuật/thủ thuật',
          'Rủi ro, nguy cơ nếu không thực hiện phẫu thuật/thủ thuật',
          'Kết quả sau phẫu thuật/thủ thuật (Dự kiến)',
          'Phương pháp phẫu thuật/thủ thuật/gây mê',
          'Tai biến, biến chứng có thể xảy ra',
        ],
      },
      // Ký tên
      { key: 'ngayKy', label: 'Ngày ... tháng ... năm 20...' },
      { key: 'phautthuatVien_ky', label: 'Phẫu thuật viên / Bác sĩ thực hiện thủ thuật (họ tên)' },
      { key: 'bacSiGayMe_ky', label: 'Bác sĩ gây mê (họ tên)' },
      { key: 'nguoiBenh_ky', label: 'Người bệnh / Thân nhân người bệnh (họ tên)' },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildFileUrl = (fileUrl) => {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${Config.API_URL}${fileUrl}`;
};

const getFileIcon = (fileName, fileType) => {
  const name = (fileName || '').toLowerCase();
  const type = (fileType || '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return '📄';
  if (type.includes('image') || name.match(/\.(jpg|jpeg|png|webp|heic)$/)) return '🖼️';
  return '📎';
};

// ── SavedDocRow ───────────────────────────────────────────────────────────────

const SavedDocRow = ({ savedDoc, visitId, onDelete, onEdit, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isUpload = savedDoc.storageType === 'upload';

  const hoverProps = Platform.OS === 'web'
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : {};
  const showActions = Platform.OS !== 'web' || hovered || confirming;

  const handleConfirmDelete = async () => {
    setDeleting(true);
    await onDelete(visitId, savedDoc._id);
    setDeleting(false);
    setConfirming(false);
  };

  const manualSummary = () => {
    if (!savedDoc.manualData) return '';
    return Object.values(savedDoc.manualData).filter(Boolean).slice(0, 3).join(' · ');
  };

  return (
    <View
      style={[styles.savedRow, hovered && !confirming && styles.savedRowHovered, confirming && styles.savedRowConfirming]}
      {...hoverProps}
    >
      <Text style={styles.savedRowIcon}>
        {isUpload ? getFileIcon(savedDoc.fileName, savedDoc.fileType) : '📋'}
      </Text>
      <View style={styles.savedRowInfo}>
        {isUpload ? (
          <>
            <Text style={styles.savedRowTitle} numberOfLines={1}>{savedDoc.fileName || 'Tài liệu đã tải lên'}</Text>
            <Text style={styles.savedRowMeta}>File PDF / Hình ảnh</Text>
          </>
        ) : (
          <>
            <Text style={styles.savedRowTitle}>Form điền tay</Text>
            {manualSummary() ? <Text style={styles.savedRowMeta} numberOfLines={1}>{manualSummary()}</Text> : null}
          </>
        )}
      </View>

      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Xóa?</Text>
          <TouchableOpacity style={styles.confirmYesBtn} onPress={handleConfirmDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator size="small" color="#DC2626" /> : <Text style={styles.confirmYesBtnText}>Có</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmNoBtn} onPress={() => setConfirming(false)}>
            <Text style={styles.confirmNoBtnText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.savedRowActions, !showActions && styles.savedRowActionsHidden]}>
          {isUpload
            ? <TouchableOpacity style={styles.textBtnBlue} onPress={onOpen}><Text style={styles.textBtnBlueLabel}>Mở</Text></TouchableOpacity>
            : <TouchableOpacity style={styles.textBtnBlue} onPress={onEdit}><Text style={styles.textBtnBlueLabel}>Sửa</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.textBtnRed} onPress={() => setConfirming(true)}>
            <Text style={styles.textBtnRedLabel}>Xóa</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── SuccessBanner ─────────────────────────────────────────────────────────────

const SuccessBanner = ({ message }) => (
  <View style={styles.successBanner}>
    <Text style={styles.successBannerIcon}>✓</Text>
    <Text style={styles.successBannerText}>{message}</Text>
  </View>
);

// ── Screen ────────────────────────────────────────────────────────────────────

const DocumentDetailScreen = ({ route, navigation }) => {
  const { visitId, doc, savedDocs = [], onSaveManual, onUpload, onDelete } = route.params;

  const schema = DOC_SCHEMAS[doc?.docKey] || null;
  const fields = schema?.fields || [];

  const [localDocs, setLocalDocs] = useState(savedDocs);
  const manualDoc = localDocs.find((d) => d.storageType === 'manual');

  const [mode, setMode] = useState(savedDocs.length > 0 ? 'view' : 'choose');
  const [editingManualDoc, setEditingManualDoc] = useState(null);
  const [formData, setFormData] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = manualDoc?.manualData?.[f.key] || ''; });
    return init;
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => navigation.goBack(), 1800);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteDoc = async (vId, docId) => {
    const ok = await onDelete(vId, docId);
    if (!ok) return;
    const updated = localDocs.filter((d) => d._id !== docId);
    setLocalDocs(updated);
    if (updated.length === 0) navigation.goBack();
  };

  // ── Edit manual ────────────────────────────────────────────────────────────
  const handleEditManual = (savedDoc) => {
    setEditingManualDoc(savedDoc);
    const init = {};
    fields.forEach((f) => { init[f.key] = savedDoc.manualData?.[f.key] || ''; });
    setFormData(init);
    setMode('manual');
  };

  // ── Open file ──────────────────────────────────────────────────────────────
  const handleOpenFile = (savedDoc) => {
    const fullUrl = buildFileUrl(savedDoc.fileUrl);
    if (!fullUrl) return;
    if (Platform.OS === 'web') window.open(fullUrl, '_blank');
    else Linking.openURL(fullUrl).catch(() => {});
  };

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setField = (key, val) => { setFormData((p) => ({ ...p, [key]: val })); setErrorMsg(''); };

  const renderField = (field) => {
    // Radio — single select, rendered as pill buttons with circle indicator
    if (field.type === 'radio') {
      const selected = formData[field.key] || '';
      return (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={styles.radioGroup}>
            {field.options.map((opt) => {
              const active = selected === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.radioOption, active && styles.radioOptionActive]}
                  onPress={() => setField(field.key, active ? '' : opt)}
                >
                  <View style={[styles.radioBox, active && styles.radioBoxActive]}>
                    {active && <View style={styles.radioBoxDot} />}
                  </View>
                  <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    // Checkbox — multi select, rendered as square tick boxes
    if (field.type === 'checkbox') {
      const selected = (formData[field.key] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const toggle = (opt) => {
        const next = selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt];
        setField(field.key, next.join(','));
      };
      return (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          {field.options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <TouchableOpacity key={opt} style={styles.checkRow} onPress={() => toggle(opt)}>
                <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
                  {checked && <Text style={styles.checkBoxTick}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, checked && styles.checkLabelChecked]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Default — text input
    return (
      <View key={field.key} style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <TextInput
          style={[styles.fieldInput, field.multiline && styles.fieldInputMulti]}
          value={formData[field.key]}
          onChangeText={(v) => setField(field.key, v)}
          placeholder={`Nhập ${field.label.split('—')[0].split('(')[0].trim().toLowerCase()}...`}
          placeholderTextColor="#94A3B8"
          multiline={!!field.multiline}
          numberOfLines={field.multiline ? 3 : 1}
          keyboardType={field.keyboardType || 'default'}
        />
      </View>
    );
  };

  // ── View mode ──────────────────────────────────────────────────────────────
  const renderView = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{localDocs.length} tài liệu đã lưu</Text>
        <TouchableOpacity style={styles.addMoreBtn} onPress={() => setMode('choose')}>
          <Text style={styles.addMoreBtnText}>+ Thêm</Text>
        </TouchableOpacity>
      </View>
      {localDocs.map((sd) => (
        <SavedDocRow
          key={sd._id}
          savedDoc={sd}
          visitId={visitId}
          onDelete={handleDeleteDoc}
          onEdit={() => handleEditManual(sd)}
          onOpen={() => handleOpenFile(sd)}
        />
      ))}
    </View>
  );

  // ── Choose mode ────────────────────────────────────────────────────────────
  const renderChoose = () => (
    <View style={styles.chooseContainer}>
      <Text style={styles.chooseTitle}>Thêm tài liệu</Text>
      <Text style={styles.chooseSubtitle}>Tải lên ảnh/PDF hoặc nhập thủ công thông tin từng trường.</Text>
      <TouchableOpacity style={styles.chooseBtn} onPress={() => setMode('upload')}>
        <Text style={styles.chooseBtnIcon}>📷</Text>
        <View style={styles.chooseBtnInfo}>
          <Text style={styles.chooseBtnTitle}>Tải lên ảnh / PDF</Text>
          <Text style={styles.chooseBtnDesc}>Chụp ảnh tài liệu hoặc chọn file từ thiết bị</Text>
        </View>
        <Text style={styles.chooseBtnArrow}>›</Text>
      </TouchableOpacity>
      {schema && (
        <TouchableOpacity
          style={styles.chooseBtn}
          onPress={() => {
            setEditingManualDoc(null);
            const init = {};
            fields.forEach((f) => { init[f.key] = ''; });
            setFormData(init);
            setMode('manual');
          }}
        >
          <Text style={styles.chooseBtnIcon}>✏️</Text>
          <View style={styles.chooseBtnInfo}>
            <Text style={styles.chooseBtnTitle}>Điền thủ công</Text>
            <Text style={styles.chooseBtnDesc}>{fields.length} trường theo mẫu biểu chính thức</Text>
          </View>
          <Text style={styles.chooseBtnArrow}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Upload mode ────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedFiles((p) => [...p, ...result.assets]);
        setErrorMsg('');
      }
    } catch { setErrorMsg('Không thể chọn file.'); }
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) { setErrorMsg('Vui lòng chọn ít nhất 1 file.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      let count = 0;
      for (const asset of selectedFiles) {
        let fileObj;
        if (Platform.OS === 'web') {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          fileObj = new File([blob], asset.name, { type: asset.mimeType || blob.type });
        } else {
          fileObj = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' };
        }
        const ok = await onUpload(visitId, { docKey: doc.docKey, groupKey: doc.groupKey, label: doc.label, file: fileObj });
        if (ok) count++;
      }
      if (count > 0) setSuccessMsg(`Đã tải lên ${count} file thành công!`);
      else setErrorMsg('Tải lên thất bại, vui lòng thử lại.');
    } catch (err) {
      setErrorMsg(err.message || 'Tải lên thất bại.');
    } finally { setSaving(false); }
  };

  const renderUpload = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tải lên ảnh hoặc PDF</Text>
      {!selectedFiles.length ? (
        <TouchableOpacity style={styles.dropzone} onPress={handlePickFile}>
          <Text style={styles.dropzoneIcon}>📁</Text>
          <Text style={styles.dropzoneText}>Nhấn để chọn file</Text>
          <Text style={styles.dropzoneHint}>JPEG, PNG, PDF — tối đa 10 MB/file</Text>
          <Text style={styles.dropzoneHint}>Có thể chọn nhiều file cùng lúc</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.selectedList}>
          {selectedFiles.map((f, i) => (
            <View key={i} style={styles.fileSelected}>
              <Text style={styles.fileSelectedIcon}>{f.mimeType?.includes('pdf') ? '📄' : '🖼️'}</Text>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.fileSize}>{f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedFiles((p) => p.filter((_, j) => j !== i))}>
                <Text style={styles.fileRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addMoreFileBtn} onPress={handlePickFile}>
            <Text style={styles.addMoreFileBtnText}>+ Thêm file khác</Text>
          </TouchableOpacity>
        </View>
      )}
      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      <TouchableOpacity
        style={[styles.saveBtn, (!selectedFiles.length || saving) && styles.saveBtnDisabled]}
        onPress={handleUpload}
        disabled={!selectedFiles.length || saving}
      >
        {saving
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={styles.saveBtnText}>Tải lên {selectedFiles.length > 1 ? `${selectedFiles.length} file` : 'tài liệu'}</Text>}
      </TouchableOpacity>
    </View>
  );

  // ── Manual form mode ───────────────────────────────────────────────────────
  const handleSaveManual = async () => {
    const hasData = Object.values(formData).some((v) => String(v).trim() !== '');
    if (!hasData) { setErrorMsg('Vui lòng điền ít nhất một trường.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      const ok = await onSaveManual(visitId, { docKey: doc.docKey, groupKey: doc.groupKey, label: doc.label, manualData: formData });
      if (ok) setSuccessMsg('Đã lưu thông tin thành công!');
      else setErrorMsg('Lưu thất bại, vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  const renderManual = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {editingManualDoc ? 'Chỉnh sửa form điền tay' : (schema?.title || doc?.label)}
      </Text>
      {fields.map(renderField)}
      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSaveManual}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Lưu thông tin</Text>}
      </TouchableOpacity>
    </View>
  );

  // ── Header ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (mode !== 'view' && mode !== 'choose') setMode(localDocs.length > 0 ? 'view' : 'choose');
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {successMsg ? <SuccessBanner message={successMsg} /> : null}

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc?.label}</Text>
        {mode === 'view' && localDocs.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{localDocs.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {mode === 'view' && renderView()}
        {mode === 'choose' && renderChoose()}
        {mode === 'upload' && renderUpload()}
        {mode === 'manual' && renderManual()}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#15803D', paddingVertical: 14, paddingHorizontal: 20,
  },
  successBannerIcon: { fontSize: 18, color: '#FFF', marginRight: 8 },
  successBannerText: { fontSize: 15, color: '#FFF', fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { fontSize: 14, color: '#64748B' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  headerBadge: {
    minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#15803D',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  headerBadgeText: { fontSize: 12, color: '#FFF', fontWeight: 'bold' },
  body: { padding: 16, paddingBottom: 40 },

  // ── Saved docs ─────────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  addMoreBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#15803D', borderRadius: 8 },
  addMoreBtnText: { fontSize: 12, color: '#FFF', fontWeight: '600' },

  savedRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  savedRowHovered: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  savedRowConfirming: { backgroundColor: '#FFF5F5', borderColor: '#FECACA' },
  savedRowIcon: { fontSize: 26, marginRight: 12 },
  savedRowInfo: { flex: 1 },
  savedRowTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  savedRowMeta: { fontSize: 11, color: '#94A3B8' },
  savedRowActions: { flexDirection: 'row', gap: 6 },
  savedRowActionsHidden: { opacity: 0 },

  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmText: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginRight: 2 },
  confirmYesBtn: {
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FEE2E2',
    borderRadius: 6, borderWidth: 1, borderColor: '#FECACA', minWidth: 36, alignItems: 'center',
  },
  confirmYesBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '700' },
  confirmNoBtn: {
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F1F5F9',
    borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0',
  },
  confirmNoBtnText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  textBtnBlue: {
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF',
    borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  textBtnBlueLabel: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  textBtnRed: {
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FEF2F2',
    borderRadius: 6, borderWidth: 1, borderColor: '#FECACA',
  },
  textBtnRedLabel: { fontSize: 12, color: '#DC2626', fontWeight: '600' },

  // ── Choose ─────────────────────────────────────────────────────────────────
  chooseContainer: { marginTop: 8 },
  chooseTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  chooseSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 19 },
  chooseBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  chooseBtnIcon: { fontSize: 28, marginRight: 14 },
  chooseBtnInfo: { flex: 1 },
  chooseBtnTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 3 },
  chooseBtnDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  chooseBtnArrow: { fontSize: 22, color: '#CBD5E1', marginLeft: 8 },

  // ── Upload ─────────────────────────────────────────────────────────────────
  section: {},
  dropzone: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 14,
    paddingVertical: 36, alignItems: 'center', marginBottom: 16, backgroundColor: '#FFFFFF',
  },
  dropzoneIcon: { fontSize: 36, marginBottom: 10 },
  dropzoneText: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 4 },
  dropzoneHint: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  selectedList: { marginBottom: 16 },
  fileSelected: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4',
    borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 12, marginBottom: 8,
  },
  fileSelectedIcon: { fontSize: 22, marginRight: 10 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '600', color: '#166534' },
  fileSize: { fontSize: 11, color: '#4ADE80', marginTop: 2 },
  fileRemove: { fontSize: 16, color: '#94A3B8', paddingLeft: 8 },
  addMoreFileBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#15803D', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  addMoreFileBtnText: { fontSize: 13, color: '#15803D', fontWeight: '600' },

  // ── Form fields ────────────────────────────────────────────────────────────
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 8 },

  fieldInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  // Radio (single-select pills)
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radioOption: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  radioOptionActive: { borderColor: '#15803D', backgroundColor: '#F0FDF4' },
  radioBox: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  radioBoxActive: { borderColor: '#15803D' },
  radioBoxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#15803D' },
  radioLabel: { fontSize: 13, color: '#64748B' },
  radioLabelActive: { color: '#15803D', fontWeight: '600' },

  // Checkbox (multi-select square ticks)
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  checkBox: {
    width: 18, height: 18, borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 3,
    alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1,
    backgroundColor: '#FFFFFF',
  },
  checkBoxChecked: { borderColor: '#15803D', backgroundColor: '#15803D' },
  checkBoxTick: { fontSize: 11, color: '#FFFFFF', fontWeight: 'bold', lineHeight: 14 },
  checkLabel: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 20 },
  checkLabelChecked: { color: '#166534', fontWeight: '500' },

  // ── Shared ─────────────────────────────────────────────────────────────────
  errorText: { fontSize: 13, color: '#DC2626', marginBottom: 10, textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#15803D', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: '#94A3B8' },
  saveBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: 'bold' },
});

export default DocumentDetailScreen;
