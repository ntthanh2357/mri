import React, { useState, useEffect, useRef } from 'react';
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
  Image,
  useWindowDimensions,
} from 'react-native';
import Config from '../constants/config';
import Colors from '../constants/colors';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PressableScale from '../components/PressableScale';
import FadeIn from '../components/FadeIn';
import { apiRequest } from '../utils/apiClient';
import { FileText, Image as ImageIcon, Paperclip, AlertTriangle } from 'lucide-react';
import DocTypeIcon from '../components/DocTypeIcon';
import { extractMedications, extractOrders } from '../utils/clinicalText';

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

// Nhãn ngắn cho dòng tóm tắt: bỏ phần giải thích sau "—", "(" hoặc "/".
const shortLabel = (label) => label.split(/\s[—(/]/)[0].trim();

const RenderFileIcon = ({ fileName, fileType, docType, isUpload }) => {
  if (isUpload) {
    const name = (fileName || '').toLowerCase();
    const type = (fileType || '').toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) return <FileText size={20} color={Colors.brandGreen} />;
    if (type.includes('image') || name.match(/\.(jpg|jpeg|png|webp|heic)$/)) return <ImageIcon size={20} color={Colors.brandGreen} />;
    return <Paperclip size={20} color={Colors.slateMuted} />;
  }
  return <DocTypeIcon docType={docType} size={20} color={Colors.brandGreen} />;
};

// ── SavedDocRow ───────────────────────────────────────────────────────────────

const SavedDocRow = ({ savedDoc, fields, index, onView, onOpen }) => {
  const isUpload = savedDoc.storageType === 'upload';

  // 2 trường đầu có dữ liệu, dạng "Nhãn: giá trị" để bệnh nhân nhận ra giấy tờ nào.
  const summary = isUpload
    ? 'Tệp PDF hoặc hình ảnh'
    : fields
        .filter((f) => savedDoc.manualData?.[f.key])
        .slice(0, 2)
        .map((f) => `${shortLabel(f.label)}: ${savedDoc.manualData[f.key]}`)
        .join('   ·   ');

  return (
    <FadeIn delay={index * 70}>
      <PressableScale
        style={styles.savedRow}
        hoverStyle={styles.savedRowHover}
        onPress={isUpload ? onOpen : onView}
        accessibilityRole="button"
        accessibilityLabel={isUpload ? `Mở tệp ${savedDoc.fileName || ''}` : 'Xem nội dung giấy tờ'}
      >
        <View style={styles.savedIcon}>
          <RenderFileIcon fileName={savedDoc.fileName} fileType={savedDoc.fileType} docType={savedDoc.docType} isUpload={isUpload} />
        </View>
        <View style={styles.savedRowInfo}>
          <Text style={styles.savedRowTitle} numberOfLines={1}>
            {isUpload ? savedDoc.fileName || 'Tài liệu đã tải lên' : 'Bản điền tay'}
          </Text>
          {summary ? <Text style={styles.savedRowMeta} numberOfLines={2}>{summary}</Text> : null}
        </View>
        <View style={styles.savedRowAction}>
          <Text style={styles.savedRowActionText}>{isUpload ? 'Mở tệp' : 'Xem'}</Text>
          <Feather name={isUpload ? 'external-link' : 'chevron-right'} size={16} color={Colors.brandGreen} />
        </View>
      </PressableScale>
    </FadeIn>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

const DocumentDetailScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width > 768;
  const params = route.params || {};
  // Tải lại trang (F5) trên web: params object bị chuyển thành chuỗi "[object Object]" → không còn dữ liệu.
  const doc = params.doc && typeof params.doc === 'object' ? params.doc : null;
  const savedDocs = Array.isArray(params.savedDocs) ? params.savedDocs : [];

  const schema = DOC_SCHEMAS[doc?.docKey] || null;
  const fields = schema?.fields || [];

  const [localDocs] = useState(savedDocs);

  // Chỉ xem: formData chỉ dùng để hiển thị dữ liệu đã lưu, không có input nào ghi vào đây nữa
  const [mode, setMode] = useState('view');
  const [formData, setFormData] = useState({});
  // Mục chỉ có đúng 1 bản điền tay → mở thẳng nội dung, không bắt chọn từ danh sách 1 dòng.
  const openedDirectly = useRef(false);

  const [warnings, setWarnings] = useState([]);
  const [checking, setChecking] = useState(false);

  const patientId = params.patientId || '';

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

  useEffect(() => {
    if (localDocs.length === 1 && localDocs[0].storageType !== 'upload' && schema) {
      openedDirectly.current = true;
      handleViewManual(localDocs[0]);
    }
  }, []);

  // ── Open file ──────────────────────────────────────────────────────────────
  const handleOpenFile = (savedDoc) => {
    const fullUrl = buildFileUrl(savedDoc.fileUrl);
    if (!fullUrl) return;
    if (Platform.OS === 'web') window.open(fullUrl, '_blank');
    else Linking.openURL(fullUrl).catch(() => {});
  };

  const handleBack = () => {
    if (mode === 'viewManual' && !openedDirectly.current) setMode('view');
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('PatientRecords');
  };

  // ── View mode ──────────────────────────────────────────────────────────────
  const renderView = () => (
    <View>
      <Text style={styles.sectionTitle}>{localDocs.length} bản đã lưu</Text>
      {localDocs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Image source={require('../../assets/images/illus-records.png')} style={styles.emptyIllus} resizeMode="contain" accessible={false} />
          <Text style={styles.emptyTitle}>Chưa có giấy tờ nào cho mục này</Text>
          <Text style={styles.emptyText}>Giấy tờ sẽ hiện ở đây khi bệnh viện cập nhật vào hồ sơ của bạn.</Text>
        </View>
      ) : (
        localDocs.map((sd, i) => (
          <SavedDocRow
            key={sd._id || i}
            index={i}
            savedDoc={sd}
            fields={fields}
            onView={() => handleViewManual(sd)}
            onOpen={() => handleOpenFile(sd)}
          />
        ))
      )}
    </View>
  );

  // ── View manual mode (trình bày như 1 tờ phiếu, ẩn trường trống) ──────────
  const renderViewManual = () => {
    const filled = fields.filter((f) => formData[f.key]);
    const emptyCount = fields.length - filled.length;
    return (
      <FadeIn style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetIcon}>
            <DocTypeIcon docType={doc?.docKey} size={22} color={Colors.brandGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>{schema?.title || doc?.label}</Text>
            <Text style={styles.sheetSub}>Bản sao thông tin bệnh viện đã cung cấp. Chỉ xem.</Text>
          </View>
        </View>

        {filled.map((field, i) => (
          <View key={field.key} style={[styles.fieldRow, isWide && styles.fieldRowWide, i === filled.length - 1 && styles.fieldRowLast]}>
            <Text style={[styles.fieldLabel, isWide && styles.fieldLabelWide]}>{field.label}</Text>
            <Text style={[styles.fieldValue, isWide && styles.fieldValueWide]} selectable>{formData[field.key]}</Text>
          </View>
        ))}
        {filled.length === 0 && <Text style={styles.emptyText}>Giấy tờ này chưa có thông tin nào được điền.</Text>}
        {emptyCount > 0 && filled.length > 0 && (
          <Text style={styles.emptyNote}>{emptyCount} mục chưa có thông tin nên không hiển thị.</Text>
        )}

        {checking && (
          <View style={styles.checkingRow}>
            <ActivityIndicator size="small" color={Colors.brandGreen} />
            <Text style={styles.checkingText}>Đang kiểm tra an toàn kê đơn…</Text>
          </View>
        )}

        {warnings.length > 0 && (
          <View style={styles.warningBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertTriangle size={15} color="#B91C1C" />
              <Text style={styles.warningBannerTitle}>Cảnh báo an toàn lâm sàng (ADR Alert)</Text>
            </View>
            {warnings.map((w, idx) => (
              <Text key={idx} style={styles.warningItem}>
                • {w.message} ({w.severity === 'CRITICAL' ? 'Nguy kịch' : w.severity === 'HIGH' ? 'Cao' : 'Trung bình'})
              </Text>
            ))}
          </View>
        )}
      </FadeIn>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.body, isWide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <PressableScale style={styles.backBtn} hoverStyle={styles.backBtnHover} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Quay lại">
              <Feather name="arrow-left" size={16} color={Colors.slateMuted} />
              <Text style={styles.backBtnText}>Quay lại</Text>
            </PressableScale>
          </View>

          {!doc ? (
            <View style={styles.emptyBox}>
              <Image source={require('../../assets/images/illus-records.png')} style={styles.emptyIllus} resizeMode="contain" accessible={false} />
              <Text style={styles.emptyTitle}>Không mở lại được giấy tờ này</Text>
              <Text style={styles.emptyText}>Trang vừa được tải lại nên mất thông tin. Hãy mở lại từ Lịch sử khám.</Text>
              <PressableScale style={styles.primaryBtn} hoverStyle={styles.primaryBtnHover} onPress={() => navigation.navigate('PatientRecords')}>
                <Text style={styles.primaryBtnText}>Về Lịch sử khám</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              {/* Ở chế độ xem phiếu, tiêu đề đã nằm trong tờ phiếu — không lặp lại */}
              {mode === 'view' && <Text style={styles.pageTitle} accessibilityRole="header">{doc.label || schema?.title}</Text>}
              {mode === 'view' && renderView()}
              {mode === 'viewManual' && renderViewManual()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  body: { padding: 16, paddingBottom: 40 },
  bodyWide: { padding: 28, maxWidth: 880, width: '100%', alignSelf: 'center' },

  topRow: { flexDirection: 'row', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  backBtnHover: { borderColor: Colors.brandGreen },
  backBtnText: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.brandNavy, letterSpacing: -0.3, marginBottom: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateMuted, marginBottom: 12 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  savedRowHover: { borderColor: Colors.brandGreen, boxShadow: '0 10px 24px -14px rgba(11, 42, 85, 0.3)' },
  savedIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  savedRowInfo: { flex: 1, minWidth: 0 },
  savedRowTitle: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },
  savedRowMeta: { fontSize: 13, color: Colors.slateMuted, marginTop: 2, lineHeight: 18 },
  savedRowAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  savedRowActionText: { fontSize: 14, fontWeight: '700', color: Colors.brandGreen },

  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    boxShadow: '0 1px 2px rgba(11, 42, 85, 0.05)',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  sheetSub: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  fieldRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 4 },
  fieldRowWide: { flexDirection: 'row', gap: 16 },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.slateMuted },
  fieldLabelWide: { width: '34%' },
  fieldValue: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  fieldValueWide: { flex: 1 },
  emptyNote: { fontSize: 13, color: Colors.secondary, marginTop: 8 },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkingText: { fontSize: 13, color: Colors.brandGreen },

  emptyBox: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  emptyIllus: { width: 140, height: 140 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.secondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  primaryBtn: { marginTop: 16, height: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen, justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ── Cảnh báo an toàn kê đơn ────────────────────────────────────────────────
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  warningBannerTitle: { color: '#991B1B', fontSize: 14, fontWeight: '700' },
  warningItem: { color: '#7F1D1D', fontSize: 13, lineHeight: 19, marginTop: 4 },
});

export default DocumentDetailScreen;
