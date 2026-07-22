import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import Config from '../constants/config';
import { apiRequest } from '../utils/apiClient';

const extractMedications = (text) => {
  if (!text) return [];
  const words = text.toLowerCase().split(/[\s,;\n\-\+•·]+/);
  const found = [];
  const candidates = ['keppra', 'depakine', 'dexamethasone', 'donepezil', 'diazepam', 'phenobarbital', 'tegretol'];
  candidates.forEach(cand => {
    if (words.includes(cand) || text.toLowerCase().includes(cand)) {
      found.push(cand);
    }
  });
  return found;
};

const extractOrders = (formData) => {
  const text = Object.values(formData).join(' ').toLowerCase();
  const found = [];
  if (text.includes('mri') || text.includes('cản từ') || text.includes('gadolinium') || text.includes('tương phản')) {
    found.push('MRI sọ não có cản quang');
  }
  return found;
};

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

const SavedDocRow = ({ savedDoc, onView, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const isUpload = savedDoc.storageType === 'upload';

  const hoverProps = Platform.OS === 'web'
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : {};
  const showActions = Platform.OS !== 'web' || hovered;

  const manualSummary = () => {
    if (!savedDoc.manualData) return '';
    return Object.values(savedDoc.manualData).filter(Boolean).slice(0, 3).join(' · ');
  };

  return (
    <View style={[styles.savedRow, hovered && styles.savedRowHovered]} {...hoverProps}>
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

      <View style={[styles.savedRowActions, !showActions && styles.savedRowActionsHidden]}>
        {isUpload
          ? <TouchableOpacity style={styles.textBtnBlue} onPress={onOpen}><Text style={styles.textBtnBlueLabel}>Mở</Text></TouchableOpacity>
          : <TouchableOpacity style={styles.textBtnBlue} onPress={onView}><Text style={styles.textBtnBlueLabel}>Xem</Text></TouchableOpacity>}
      </View>
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

const DocumentDetailScreen = ({ route, navigation }) => {
  const { doc, savedDocs = [] } = route.params;

  const schema = DOC_SCHEMAS[doc?.docKey] || null;
  const fields = schema?.fields || [];

  const [localDocs] = useState(savedDocs);

  // Chỉ xem: formData chỉ dùng để hiển thị dữ liệu đã lưu, không có input nào ghi vào đây nữa
  const [mode, setMode] = useState('view');
  const [formData, setFormData] = useState({});

  const [warnings, setWarnings] = useState([]);
  const [checking, setChecking] = useState(false);

  const patientId = route.params.patientId || '';

  useEffect(() => {
    if (doc?.docKey !== 'toa_thuoc' && doc?.docKey !== 'mri' && doc?.docKey !== 'ct_scan' && doc?.docKey !== 'phieu_chi_dinh') {
      return;
    }

    const meds = extractMedications(formData.danhSachThuoc || '');
    const orders = extractOrders(formData);

    if (meds.length === 0 && orders.length === 0) {
      setWarnings([]);
      return;
    }

    const delayDebounceId = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await apiRequest('/api/drugs/check-prescription', {
          method: 'POST',
          body: JSON.stringify({
            patientId,
            medications: meds,
            orders,
          }),
        });
        if (res && res.data) {
          setWarnings(res.data.warnings || []);
        }
      } catch (err) {
        console.log('Error checking clinical safety:', err);
      } finally {
        setChecking(false);
      }
    }, 800);

    return () => clearTimeout(delayDebounceId);
  }, [formData, doc?.docKey, patientId]);

  // ── View manual data ───────────────────────────────────────────────────────
  const handleViewManual = (savedDoc) => {
    const init = {};
    fields.forEach((f) => { init[f.key] = savedDoc.manualData?.[f.key] || ''; });
    setFormData(init);
    setMode('viewManual');
  };

  // ── Open file ──────────────────────────────────────────────────────────────
  const handleOpenFile = (savedDoc) => {
    const fullUrl = buildFileUrl(savedDoc.fileUrl);
    if (!fullUrl) return;
    if (Platform.OS === 'web') window.open(fullUrl, '_blank');
    else Linking.openURL(fullUrl).catch(() => {});
  };

  // ── Read-only field renderer ──────────────────────────────────────────────
  const renderReadOnlyField = (field) => (
    <View key={field.key} style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.readOnlyValue}>{formData[field.key] || '—'}</Text>
    </View>
  );

  // ── View mode ──────────────────────────────────────────────────────────────
  const renderView = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{localDocs.length} tài liệu đã lưu</Text>
      </View>
      {localDocs.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có tài liệu nào cho mục này.</Text>
      ) : (
        localDocs.map((sd) => (
          <SavedDocRow
            key={sd._id}
            savedDoc={sd}
            onView={() => handleViewManual(sd)}
            onOpen={() => handleOpenFile(sd)}
          />
        ))
      )}
    </View>
  );

  // ── View manual mode ───────────────────────────────────────────────────────
  const renderViewManual = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{schema?.title || doc?.label}</Text>
      {fields.map(renderReadOnlyField)}

      {checking && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
          <ActivityIndicator size="small" color="#0D9488" />
          <Text style={{ fontSize: 12, color: '#0D9488', marginLeft: 8 }}>Đang kiểm tra an toàn kê đơn...</Text>
        </View>
      )}

      {warnings.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerTitle}>⚠️ Cảnh báo an toàn lâm sàng (ADR Alert)</Text>
          {warnings.map((w, idx) => (
            <Text key={idx} style={styles.warningItem}>
              • {w.message} ({w.severity === 'CRITICAL' ? 'Nguy kịch' : w.severity === 'HIGH' ? 'Cao' : 'Trung bình'})
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  // ── Header ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (mode === 'viewManual') setMode('view');
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
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
        {mode === 'viewManual' && renderViewManual()}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

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

  savedRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  savedRowHovered: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  savedRowIcon: { fontSize: 26, marginRight: 12 },
  savedRowInfo: { flex: 1 },
  savedRowTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  savedRowMeta: { fontSize: 11, color: '#94A3B8' },
  savedRowActions: { flexDirection: 'row', gap: 6 },
  savedRowActionsHidden: { opacity: 0 },

  textBtnBlue: {
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF',
    borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  textBtnBlueLabel: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },

  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 24 },

  section: {},

  // ── Form fields (read-only) ────────────────────────────────────────────────
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 8 },
  readOnlyValue: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },

  // ── Shared ─────────────────────────────────────────────────────────────────
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  warningBannerTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  warningItem: {
    color: '#7F1D1D',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
});

export default DocumentDetailScreen;
