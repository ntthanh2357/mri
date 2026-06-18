import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { useMedicalRecordForm } from '../controllers/useMedicalRecordForm';

const FormField = ({ label, value, onChangeText, placeholder, multiline, keyboardType, half }) => (
  <View style={[styles.fieldContainer, half && styles.fieldHalf]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

const Section = ({ title, sectionKey, expanded, onToggle, children }) => (
  <View style={styles.sectionCard}>
    <TouchableOpacity style={styles.sectionHeader} onPress={() => onToggle(sectionKey)} activeOpacity={0.7}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <Text style={styles.sectionToggleIcon}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
    {expanded && <View style={styles.sectionBody}>{children}</View>}
  </View>
);

const MedicalRecordFormScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { formData, loading, saving, updateField, saveForm, resetForm } = useMedicalRecordForm();

  const [expanded, setExpanded] = useState({
    hanhChinh: true,
    lyDoVaoVien: true,
    benhSu: false,
    tienSu: false,
    khamBenh: false,
    khamChuyenKhoa: false,
    canLamSang: false,
    chanDoan: false,
    huongDieuTri: false,
    tienLuong: false,
  });

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803D" />
        <Text style={styles.loadingText}>Đang tải biểu mẫu bệnh án...</Text>
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MedicalRecordForm">
      <SafeAreaView style={styles.container}>
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bệnh án</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>BỆNH ÁN UNG THƯ NÃO</Text>
            <Text style={styles.pageSubtitle}>
              Vui lòng điền đầy đủ thông tin bên dưới. Dữ liệu sẽ được lưu lại trên thiết bị của bạn để
              bác sĩ tham khảo trong lần khám tiếp theo.
            </Text>
            {formData.updatedAt && (
              <Text style={styles.lastSaved}>
                Lần lưu gần nhất: {new Date(formData.updatedAt).toLocaleString('vi-VN')}
              </Text>
            )}
          </View>

          {/* I. HÀNH CHÍNH */}
          <Section title="I. HÀNH CHÍNH" sectionKey="hanhChinh" expanded={expanded.hanhChinh} onToggle={toggleSection}>
            <FormField
              label="Họ và tên bệnh nhân"
              value={formData.hanhChinh.hoTen}
              onChangeText={(t) => updateField('hanhChinh', 'hoTen', t)}
              placeholder="Nguyễn Văn A"
            />
            <View style={styles.row}>
              <FormField
                label="Tuổi"
                value={formData.hanhChinh.tuoi}
                onChangeText={(t) => updateField('hanhChinh', 'tuoi', t)}
                placeholder="VD: 45"
                keyboardType="number-pad"
                half
              />
              <FormField
                label="Giới tính"
                value={formData.hanhChinh.gioiTinh}
                onChangeText={(t) => updateField('hanhChinh', 'gioiTinh', t)}
                placeholder="Nam / Nữ"
                half
              />
            </View>
            <FormField
              label="Nghề nghiệp"
              value={formData.hanhChinh.ngheNghiep}
              onChangeText={(t) => updateField('hanhChinh', 'ngheNghiep', t)}
              placeholder="VD: Công nhân"
            />
            <FormField
              label="Địa chỉ"
              value={formData.hanhChinh.diaChi}
              onChangeText={(t) => updateField('hanhChinh', 'diaChi', t)}
              placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
            />
            <FormField
              label="Ngày giờ vào viện"
              value={formData.hanhChinh.ngayGioVaoVien}
              onChangeText={(t) => updateField('hanhChinh', 'ngayGioVaoVien', t)}
              placeholder="VD: 8 giờ 30, ngày 11 tháng 06 năm 2026"
            />
            <FormField
              label="Ngày làm bệnh án"
              value={formData.hanhChinh.ngayLamBenhAn}
              onChangeText={(t) => updateField('hanhChinh', 'ngayLamBenhAn', t)}
              placeholder="VD: 9 giờ 00, ngày 11 tháng 06 năm 2026"
            />
          </Section>

          {/* II. LÝ DO VÀO VIỆN */}
          <Section title="II. LÝ DO VÀO VIỆN" sectionKey="lyDoVaoVien" expanded={expanded.lyDoVaoVien} onToggle={toggleSection}>
            <FormField
              label="Lý do vào viện"
              value={formData.lyDoVaoVien}
              onChangeText={(t) => updateField('lyDoVaoVien', null, t)}
              placeholder="Ví dụ: Đau đầu dữ dội tăng dần, co giật, yếu nửa người, nhìn mờ..."
              multiline
            />
          </Section>

          {/* III. BỆNH SỬ */}
          <Section title="III. BỆNH SỬ" sectionKey="benhSu" expanded={expanded.benhSu} onToggle={toggleSection}>
            <Text style={styles.subSectionTitle}>1. Quá trình khởi phát và diễn tiến</Text>
            <FormField
              label="Thời gian khởi phát triệu chứng đầu tiên"
              value={formData.benhSu.thoiGianKhoiPhat}
              onChangeText={(t) => updateField('benhSu', 'thoiGianKhoiPhat', t)}
              placeholder="VD: Khoảng 2 tháng trước"
            />
            <FormField
              label="Tính chất đau đầu (nếu có)"
              value={formData.benhSu.tinhChatDauDau}
              onChangeText={(t) => updateField('benhSu', 'tinhChatDauDau', t)}
              placeholder="Vị trí, thời gian đau (thường đau nhiều về sáng), mức độ, có đáp ứng với thuốc giảm đau thông thường không?"
              multiline
            />
            <FormField
              label="Các dấu hiệu thần kinh khu trú xuất hiện theo thời gian"
              value={formData.benhSu.dauHieuThanKinhKhuTru}
              onChangeText={(t) => updateField('benhSu', 'dauHieuThanKinhKhuTru', t)}
              placeholder="Yếu liệt chi, rối loạn ngôn ngữ, giảm thị lực/thính lực, mất thăng bằng..."
              multiline
            />
            <FormField
              label="Dấu hiệu tâm thần / thay đổi tính cách"
              value={formData.benhSu.dauHieuTamThan}
              onChangeText={(t) => updateField('benhSu', 'dauHieuTamThan', t)}
              placeholder="Trì trệ, thờ ơ, mất trí nhớ ngắn hạn..."
              multiline
            />
            <FormField
              label="Cơn co giật"
              value={formData.benhSu.conCoGiat}
              onChangeText={(t) => updateField('benhSu', 'conCoGiat', t)}
              placeholder="Kiểu co giật cục bộ hay toàn thể, tần suất, thời gian mỗi cơn..."
              multiline
            />

            <Text style={styles.subSectionTitle}>2. Các triệu chứng kèm theo</Text>
            <FormField
              label="Hội chứng tăng áp lực nội sọ"
              value={formData.benhSu.hoiChungTangApLuc}
              onChangeText={(t) => updateField('benhSu', 'hoiChungTangApLuc', t)}
              placeholder="Nôn/buồn nôn (đặc biệt là nôn vọt vào buổi sáng), nhìn mờ, phù gai thị..."
              multiline
            />

            <Text style={styles.subSectionTitle}>3. Quá trình điều trị đã qua</Text>
            <FormField
              label="Đã khám ở đâu, chẩn đoán gì, dùng thuốc gì"
              value={formData.benhSu.quaTrinhDieuTri}
              onChangeText={(t) => updateField('benhSu', 'quaTrinhDieuTri', t)}
              placeholder="Đặc biệt là các thuốc Corticoid chống phù não như Dexamethasone, đáp ứng lâm sàng ra sao?"
              multiline
            />
          </Section>

          {/* IV. TIỀN SỬ */}
          <Section title="IV. TIỀN SỬ" sectionKey="tienSu" expanded={expanded.tienSu} onToggle={toggleSection}>
            <Text style={styles.subSectionTitle}>1. Bản thân</Text>
            <FormField
              label="Tiền sử bệnh lý thần kinh, chấn thương sọ não trước đây"
              value={formData.tienSu.benhLyThanKinh}
              onChangeText={(t) => updateField('tienSu', 'benhLyThanKinh', t)}
              placeholder="Mô tả nếu có..."
              multiline
            />
            <FormField
              label="Tiền sử ung thư cơ quan khác"
              value={formData.tienSu.ungThuCoQuanKhac}
              onChangeText={(t) => updateField('tienSu', 'ungThuCoQuanKhac', t)}
              placeholder="Phổi, vú, đại trực tràng..."
              multiline
            />
            <FormField
              label="Tiền sử tiếp xúc tia xạ, hóa chất độc hại"
              value={formData.tienSu.tiepXucTiaXa}
              onChangeText={(t) => updateField('tienSu', 'tiepXucTiaXa', t)}
              placeholder="Mô tả nếu có..."
              multiline
            />
            <FormField
              label="Thói quen"
              value={formData.tienSu.thoiQuen}
              onChangeText={(t) => updateField('tienSu', 'thoiQuen', t)}
              placeholder="Hút thuốc lá, uống rượu bia..."
            />
            <FormField
              label="Dị ứng"
              value={formData.tienSu.diUng}
              onChangeText={(t) => updateField('tienSu', 'diUng', t)}
              placeholder="Thuốc, hóa chất, thức ăn..."
            />

            <Text style={styles.subSectionTitle}>2. Gia đình</Text>
            <FormField
              label="Có ai mắc hội chứng di truyền liên quan đến u não"
              value={formData.tienSu.hoiChungDiTruyen}
              onChangeText={(t) => updateField('tienSu', 'hoiChungDiTruyen', t)}
              placeholder="Neurofibromatosis, Li-Fraumeni, Von Hippel-Lindau..."
              multiline
            />
            <FormField
              label="Có ai mắc các bệnh lý ung thư khác không"
              value={formData.tienSu.benhLyUngThuKhacGiaDinh}
              onChangeText={(t) => updateField('tienSu', 'benhLyUngThuKhacGiaDinh', t)}
              placeholder="Mô tả nếu có..."
              multiline
            />
          </Section>

          {/* V. KHÁM BỆNH */}
          <Section title="V. KHÁM BỆNH" sectionKey="khamBenh" expanded={expanded.khamBenh} onToggle={toggleSection}>
            <FormField
              label="Thời điểm khám"
              value={formData.khamBenh.thoiDiemKham}
              onChangeText={(t) => updateField('khamBenh', 'thoiDiemKham', t)}
              placeholder="VD: 9 giờ ngày 11/06/2026"
            />
            <Text style={styles.subSectionTitle}>1. Khám toàn thân</Text>
            <View style={styles.row}>
              <FormField
                label="Tri giác"
                value={formData.khamBenh.triGiac}
                onChangeText={(t) => updateField('khamBenh', 'triGiac', t)}
                placeholder="Tỉnh táo / Ngủ gà / Mơ màng / Hôn mê"
                half
              />
              <FormField
                label="Thang điểm Glasgow"
                value={formData.khamBenh.glasgow}
                onChangeText={(t) => updateField('khamBenh', 'glasgow', t)}
                placeholder="VD: 15 điểm"
                keyboardType="number-pad"
                half
              />
            </View>
            <Text style={styles.subSectionTitle}>Dấu hiệu sinh tồn</Text>
            <View style={styles.row}>
              <FormField
                label="Mạch (lần/phút)"
                value={formData.khamBenh.mach}
                onChangeText={(t) => updateField('khamBenh', 'mach', t)}
                placeholder="VD: 80"
                keyboardType="number-pad"
                half
              />
              <FormField
                label="Nhiệt độ (°C)"
                value={formData.khamBenh.nhietDo}
                onChangeText={(t) => updateField('khamBenh', 'nhietDo', t)}
                placeholder="VD: 37"
                keyboardType="decimal-pad"
                half
              />
            </View>
            <View style={styles.row}>
              <FormField
                label="Huyết áp (mmHg)"
                value={formData.khamBenh.huyetAp}
                onChangeText={(t) => updateField('khamBenh', 'huyetAp', t)}
                placeholder="VD: 120/80"
                half
              />
              <FormField
                label="Nhịp thở (lần/phút)"
                value={formData.khamBenh.nhipTho}
                onChangeText={(t) => updateField('khamBenh', 'nhipTho', t)}
                placeholder="VD: 18"
                keyboardType="number-pad"
                half
              />
            </View>
            <View style={styles.row}>
              <FormField
                label="Thể trạng"
                value={formData.khamBenh.theTrang}
                onChangeText={(t) => updateField('khamBenh', 'theTrang', t)}
                placeholder="Mập / Trung bình / Gầy"
                half
              />
              <FormField
                label="BMI"
                value={formData.khamBenh.bmi}
                onChangeText={(t) => updateField('khamBenh', 'bmi', t)}
                placeholder="VD: 21.5"
                keyboardType="decimal-pad"
                half
              />
            </View>
            <FormField
              label="Da, niêm mạc"
              value={formData.khamBenh.daNiemMac}
              onChangeText={(t) => updateField('khamBenh', 'daNiemMac', t)}
              placeholder="Hồng hào hay nhợt nhạt? Có xuất huyết dưới da không?"
              multiline
            />
          </Section>

          {/* VI. KHÁM CHUYÊN KHOA */}
          <Section title="VI. KHÁM CHUYÊN KHOA THẦN KINH" sectionKey="khamChuyenKhoa" expanded={expanded.khamChuyenKhoa} onToggle={toggleSection}>
            <FormField
              label="Ghi chú khám chuyên khoa thần kinh"
              value={formData.khamChuyenKhoa}
              onChangeText={(t) => updateField('khamChuyenKhoa', null, t)}
              placeholder="Vận động, cảm giác, phản xạ, dây thần kinh sọ, thất điều... (bác sĩ sẽ bổ sung khi thăm khám)"
              multiline
            />
          </Section>

          {/* VII. CẬN LÂM SÀNG */}
          <Section title="VII. CẬN LÂM SÀNG" sectionKey="canLamSang" expanded={expanded.canLamSang} onToggle={toggleSection}>
            <FormField
              label="Kết quả cận lâm sàng"
              value={formData.canLamSang}
              onChangeText={(t) => updateField('canLamSang', null, t)}
              placeholder="Kết quả MRI/CT, xét nghiệm máu, giải phẫu bệnh (nếu có)..."
              multiline
            />
          </Section>

          {/* VIII. CHẨN ĐOÁN */}
          <Section title="VIII. CHẨN ĐOÁN" sectionKey="chanDoan" expanded={expanded.chanDoan} onToggle={toggleSection}>
            <FormField
              label="Chẩn đoán xác định"
              value={formData.chanDoan.xacDinh}
              onChangeText={(t) => updateField('chanDoan', 'xacDinh', t)}
              placeholder="Ung thư não (U não ác tính) vùng ... / Giai đoạn (Độ ác tính - WHO Grade I-IV nếu đã có GPB)"
              multiline
            />
            <FormField
              label="Chẩn đoán phân biệt"
              value={formData.chanDoan.phanBiet}
              onChangeText={(t) => updateField('chanDoan', 'phanBiet', t)}
              placeholder="Áp xe não / Tai biến mạch máu não (Đột quỵ) / Phình mạch não"
              multiline
            />
            <FormField
              label="Chẩn đoán nguyên nhân"
              value={formData.chanDoan.nguyenNhan}
              onChangeText={(t) => updateField('chanDoan', 'nguyenNhan', t)}
              placeholder="Nguyên phát tại não hay Thứ phát (Di căn từ ung thư...)"
              multiline
            />
          </Section>

          {/* IX. HƯỚNG ĐIỀU TRỊ THIẾT YẾU */}
          <Section title="IX. HƯỚNG ĐIỀU TRỊ THIẾT YẾU" sectionKey="huongDieuTri" expanded={expanded.huongDieuTri} onToggle={toggleSection}>
            <FormField
              label="1. Điều trị nội khoa cấp cứu"
              value={formData.huongDieuTri.noiKhoaCapCuu}
              onChangeText={(t) => updateField('huongDieuTri', 'noiKhoaCapCuu', t)}
              placeholder="Chống phù não, giảm áp lực nội sọ: Corticoid (Dexamethasone) + thuốc chống co giật (nếu có tiền sử) + giảm đau"
              multiline
            />
            <FormField
              label="2. Điều trị chuyên khoa (phối hợp đa mô thức)"
              value={formData.huongDieuTri.chuyenKhoa}
              onChangeText={(t) => updateField('huongDieuTri', 'chuyenKhoa', t)}
              placeholder="Phẫu thuật / Xạ trị / Hóa trị (VD: Temozolomide)..."
              multiline
            />
            <FormField
              label="3. Chăm sóc giảm nhẹ & dinh dưỡng"
              value={formData.huongDieuTri.chamSocGiamNhe}
              onChangeText={(t) => updateField('huongDieuTri', 'chamSocGiamNhe', t)}
              placeholder="Nâng cao thể trạng, giảm đau, hỗ trợ tâm lý..."
              multiline
            />
          </Section>

          {/* X. TIÊN LƯỢNG & DỰ KIẾN KẾ HOẠCH TIẾP THEO */}
          <Section title="X. TIÊN LƯỢNG & KẾ HOẠCH TIẾP THEO" sectionKey="tienLuong" expanded={expanded.tienLuong} onToggle={toggleSection}>
            <FormField
              label="Tiên lượng"
              value={formData.tienLuong.mucDo}
              onChangeText={(t) => updateField('tienLuong', 'mucDo', t)}
              placeholder="Gần / Xa (dựa vào thể giải phẫu bệnh, kích thước và vị trí khối u)"
            />
            <FormField
              label="Kế hoạch tiếp theo"
              value={formData.tienLuong.keHoachTiepTheo}
              onChangeText={(t) => updateField('tienLuong', 'keHoachTiepTheo', t)}
              placeholder="VD: Hội chẩn tiểu ban u não, chuẩn bị bệnh nhân phẫu thuật, chuyển tuyến chuyên khoa Ung bướu/Ngoại thần kinh..."
              multiline
            />
          </Section>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.resetButton} onPress={resetForm} disabled={saving}>
              <Text style={styles.resetButtonText}>Xóa hết</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveForm} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>💾 Lưu bệnh án</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  titleBlock: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  lastSaved: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 8,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F0FDF4',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#15803D',
    flex: 1,
  },
  sectionToggleIcon: {
    fontSize: 12,
    color: '#15803D',
    marginLeft: 8,
  },
  sectionBody: {
    padding: 16,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 4,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldContainer: {
    marginBottom: 14,
    flex: 1,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default MedicalRecordFormScreen;
