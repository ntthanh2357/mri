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
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
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

const CheckboxItem = ({ label, checked, onToggle, indent }) => (
  <TouchableOpacity
    style={[styles.checkboxRow, indent && styles.checkboxIndent]}
    onPress={onToggle}
    activeOpacity={0.7}
  >
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxTick}>✓</Text>}
    </View>
    <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelChecked]}>{label}</Text>
  </TouchableOpacity>
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

  const toggleSection = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const togglePhanBiet = (field) => {
    const current = formData.chanDoan?.phanBiet || {};
    updateField('chanDoan', 'phanBiet', { ...current, [field]: !current[field] });
  };

  const toggleChuyenKhoa = (field) => {
    const current = formData.huongDieuTri?.chuyenKhoa || {};
    updateField('huongDieuTri', 'chuyenKhoa', { ...current, [field]: !current[field] });
  };

  const phanBiet = formData.chanDoan?.phanBiet || {};
  const chuyenKhoa = formData.huongDieuTri?.chuyenKhoa || {};

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
              placeholder="........ giờ ....... ngày ....... tháng ....... năm 2026"
            />
            <FormField
              label="Ngày làm bệnh án"
              value={formData.hanhChinh.ngayLamBenhAn}
              onChangeText={(t) => updateField('hanhChinh', 'ngayLamBenhAn', t)}
              placeholder="........ giờ ....... ngày ....... tháng ....... năm 2026"
            />
          </Section>

          {/* II. LÝ DO VÀO VIỆN */}
          <Section title="II. LÝ DO VÀO VIỆN" sectionKey="lyDoVaoVien" expanded={expanded.lyDoVaoVien} onToggle={toggleSection}>
            <Text style={styles.hintText}>(Ví dụ: Đau đầu dữ dội tăng dần, co giật, yếu nửa người, nhìn mờ...)</Text>
            <FormField
              value={formData.lyDoVaoVien}
              onChangeText={(t) => updateField('lyDoVaoVien', null, t)}
              placeholder="Mô tả lý do vào viện..."
              multiline
            />
          </Section>

          {/* III. BỆNH SỬ */}
          <Section title="III. BỆNH SỬ" sectionKey="benhSu" expanded={expanded.benhSu} onToggle={toggleSection}>
            <Text style={styles.subSectionTitle}>1. Quá trình khởi phát và diễn tiến:</Text>
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

            <Text style={styles.subSectionTitle}>2. Các triệu chứng kèm theo:</Text>
            <FormField
              label="Hội chứng tăng áp lực nội sọ"
              value={formData.benhSu.hoiChungTangApLuc}
              onChangeText={(t) => updateField('benhSu', 'hoiChungTangApLuc', t)}
              placeholder="Nôn/buồn nôn (đặc biệt là nôn vọt vào buổi sáng), nhìn mờ, phù gai thị..."
              multiline
            />

            <Text style={styles.subSectionTitle}>3. Quá trình điều trị đã qua:</Text>
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
            <Text style={styles.subSectionTitle}>1. Bản thân:</Text>
            <FormField
              label="Tiền sử mắc các bệnh lý thần kinh, chấn thương sọ não trước đây"
              value={formData.tienSu.benhLyThanKinh}
              onChangeText={(t) => updateField('tienSu', 'benhLyThanKinh', t)}
              placeholder="Mô tả nếu có..."
              multiline
            />
            <FormField
              label="Tiền sử ung thư cơ quan khác"
              value={formData.tienSu.ungThuCoQuanKhac}
              onChangeText={(t) => updateField('tienSu', 'ungThuCoQuanKhac', t)}
              placeholder="Loại trừ hoặc hướng tới ung thư não thứ phát do di căn từ phổi, vú, đại trực tràng..."
              multiline
            />
            <FormField
              label="Tiền sử tiếp xúc với tia xạ, hóa chất độc hại"
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

            <Text style={styles.subSectionTitle}>2. Gia đình:</Text>
            <FormField
              label="Có ai mắc hội chứng di truyền liên quan đến u não"
              value={formData.tienSu.hoiChungDiTruyen}
              onChangeText={(t) => updateField('tienSu', 'hoiChungDiTruyen', t)}
              placeholder="Neurofibromatosis, hội chứng Li-Fraumeni, Von Hippel-Lindau...?"
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
              placeholder="...... giờ ngày ..../......./2026"
            />
            <Text style={styles.subSectionTitle}>1. Khám Toàn Thân</Text>
            <FormField
              label="Tri giác (Đánh giá qua thang điểm Glasgow)"
              value={formData.khamBenh.triGiac}
              onChangeText={(t) => updateField('khamBenh', 'triGiac', t)}
              placeholder="Tỉnh táo / Ngủ gà / Mơ màng / Hôn mê"
            />
            <FormField
              label="Thang điểm Glasgow"
              value={formData.khamBenh.glasgow}
              onChangeText={(t) => updateField('khamBenh', 'glasgow', t)}
              placeholder="...... điểm"
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLabel}>Dấu hiệu sinh tồn:</Text>
            <View style={styles.row}>
              <FormField
                label="Mạch (lần/phút)"
                value={formData.khamBenh.mach}
                onChangeText={(t) => updateField('khamBenh', 'mach', t)}
                placeholder="..........."
                keyboardType="number-pad"
                half
              />
              <FormField
                label="Nhiệt độ (°C)"
                value={formData.khamBenh.nhietDo}
                onChangeText={(t) => updateField('khamBenh', 'nhietDo', t)}
                placeholder="..........."
                keyboardType="decimal-pad"
                half
              />
            </View>
            <View style={styles.row}>
              <FormField
                label="Huyết áp (mmHg)"
                value={formData.khamBenh.huyetAp}
                onChangeText={(t) => updateField('khamBenh', 'huyetAp', t)}
                placeholder="..........."
                half
              />
              <FormField
                label="Nhịp thở (lần/phút)"
                value={formData.khamBenh.nhipTho}
                onChangeText={(t) => updateField('khamBenh', 'nhipTho', t)}
                placeholder="..........."
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
                placeholder="..........."
                keyboardType="decimal-pad"
                half
              />
            </View>
            <FormField
              label="Da, niêm mạc hồng hào hay nhợt nhạt? Có xuất huyết dưới da không?"
              value={formData.khamBenh.daNiemMac}
              onChangeText={(t) => updateField('khamBenh', 'daNiemMac', t)}
              placeholder="Mô tả..."
              multiline
            />
          </Section>

          {/* VI. KHÁM CHUYÊN KHOA THẦN KINH */}
          <Section title="VI. KHÁM CHUYÊN KHOA THẦN KINH" sectionKey="khamChuyenKhoa" expanded={expanded.khamChuyenKhoa} onToggle={toggleSection}>
            <FormField
              value={formData.khamChuyenKhoa}
              onChangeText={(t) => updateField('khamChuyenKhoa', null, t)}
              placeholder="Vận động, cảm giác, phản xạ, dây thần kinh sọ, thất điều..."
              multiline
            />
          </Section>

          {/* VII. CẬN LÂM SÀNG */}
          <Section title="VII. CẬN LÂM SÀNG" sectionKey="canLamSang" expanded={expanded.canLamSang} onToggle={toggleSection}>
            <FormField
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
              placeholder="Ung thư não (U não ác tính) vùng ........................... / Giai đoạn (hoặc Độ ác tính - WHO Grade I-IV nếu đã có GPB)."
              multiline
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelBold]}>Chẩn đoán phân biệt:</Text>
            <CheckboxItem
              label="Áp xe não."
              checked={!!phanBiet.apXeNao}
              onToggle={() => togglePhanBiet('apXeNao')}
            />
            <CheckboxItem
              label="Tai biến mạch máu não (Đột quỵ)."
              checked={!!phanBiet.taiNao}
              onToggle={() => togglePhanBiet('taiNao')}
            />
            <CheckboxItem
              label="Phình mạch não."
              checked={!!phanBiet.phinhMach}
              onToggle={() => togglePhanBiet('phinhMach')}
            />

            <View style={styles.fieldSpacingTop}>
              <FormField
                label="Chẩn đoán nguyên nhân"
                value={formData.chanDoan.nguyenNhan}
                onChangeText={(t) => updateField('chanDoan', 'nguyenNhan', t)}
                placeholder="Nguyên phát tại não hay Thứ phát (Di căn từ ung thư .....................)."
                multiline
              />
            </View>
          </Section>

          {/* IX. HƯỚNG ĐIỀU TRỊ THIẾT YẾU */}
          <Section title="IX. HƯỚNG ĐIỀU TRỊ THIẾT YẾU" sectionKey="huongDieuTri" expanded={expanded.huongDieuTri} onToggle={toggleSection}>
            <View style={styles.treatmentItem}>
              <Text style={styles.treatmentNumber}>1</Text>
              <View style={styles.treatmentContent}>
                <Text style={styles.treatmentText}>
                  <Text style={styles.treatmentBold}>Điều trị nội khoa cấp cứu (Chống phù não, giảm áp lực nội sọ): </Text>
                  Sử dụng Corticoid (Dexamethasone) + Thuốc chống co giật (nếu có tiền sử co giật) + Giảm đau.
                </Text>
                <TextInput
                  style={[styles.input, styles.treatmentNote]}
                  value={formData.huongDieuTri.noiKhoaCapCuu}
                  onChangeText={(t) => updateField('huongDieuTri', 'noiKhoaCapCuu', t)}
                  placeholder="Ghi chú thêm..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.treatmentItem}>
              <Text style={styles.treatmentNumber}>2</Text>
              <View style={styles.treatmentContent}>
                <Text style={styles.treatmentText}>
                  <Text style={styles.treatmentBold}>Điều trị chuyên khoa (Phối hợp đa mô thức):</Text>
                </Text>
                <CheckboxItem
                  label="Phẫu thuật: Cắt bỏ tối đa khối u an toàn / Sinh thiết làm giải phẫu bệnh."
                  checked={!!chuyenKhoa.phauThuat}
                  onToggle={() => toggleChuyenKhoa('phauThuat')}
                  indent
                />
                <CheckboxItem
                  label="Xạ trị: Xạ trị toàn não hoặc xạ trị định vị (nếu có chỉ định)."
                  checked={!!chuyenKhoa.xaTri}
                  onToggle={() => toggleChuyenKhoa('xaTri')}
                  indent
                />
                <CheckboxItem
                  label="Hóa trị: Sử dụng hóa chất (ví dụ: Temozolomide đối với U tế bào thần kinh đệm ác tính)."
                  checked={!!chuyenKhoa.hoaTri}
                  onToggle={() => toggleChuyenKhoa('hoaTri')}
                  indent
                />
              </View>
            </View>

            <View style={styles.treatmentItem}>
              <Text style={styles.treatmentNumber}>3</Text>
              <View style={styles.treatmentContent}>
                <Text style={styles.treatmentText}>
                  <Text style={styles.treatmentBold}>Chăm sóc giảm nhẹ &amp; Dinh dưỡng: </Text>
                  Nâng cao thể trạng, giảm đau, hỗ trợ tâm lý.
                </Text>
                <TextInput
                  style={[styles.input, styles.treatmentNote]}
                  value={formData.huongDieuTri.chamSocGiamNhe}
                  onChangeText={(t) => updateField('huongDieuTri', 'chamSocGiamNhe', t)}
                  placeholder="Ghi chú thêm..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Section>

          {/* X. TIÊN LƯỢNG & DỰ KIẾN KẾ HOẠCH TIẾP THEO */}
          <Section title="X. TIÊN LƯỢNG & DỰ KIẾN KẾ HOẠCH TIẾP THEO" sectionKey="tienLuong" expanded={expanded.tienLuong} onToggle={toggleSection}>
            <FormField
              label="Tiên lượng"
              value={formData.tienLuong.mucDo}
              onChangeText={(t) => updateField('tienLuong', 'mucDo', t)}
              placeholder="Gần / Xa (Dựa vào thể giải phẫu bệnh, kích thước và vị trí khối u)."
            />
            <FormField
              label="Kế hoạch tiếp theo"
              value={formData.tienLuong.keHoachTiepTheo}
              onChangeText={(t) => updateField('tienLuong', 'keHoachTiepTheo', t)}
              placeholder="VD: Hội chẩn tiểu ban u não, chuẩn bị bệnh nhân phẫu thuật, chuyển tuyến chuyên khoa Ung bướu/Ngoại thần kinh..."
              multiline
            />
          </Section>

          {/* BÁC SĨ LÀM BỆNH ÁN */}
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>BÁC SĨ LÀM BỆNH ÁN</Text>
            <Text style={styles.signatureHint}>(Ký và ghi rõ họ tên)</Text>
            <TextInput
              style={[styles.input, styles.signatureInput]}
              value={formData.bacSiLamBenhAn}
              onChangeText={(t) => updateField('bacSiLamBenhAn', null, t)}
              placeholder="Họ và tên bác sĩ..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.resetButton} onPress={resetForm} disabled={saving}>
              <Text style={styles.resetButtonText}>Xóa hết</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveForm} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Lưu bệnh án</Text>
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  lastSaved: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 4,
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
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 8,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 18,
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
  fieldLabelBold: {
    fontSize: 13,
    color: '#334155',
    marginTop: 4,
    marginBottom: 8,
  },
  fieldSpacingTop: {
    marginTop: 8,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingVertical: 2,
  },
  checkboxIndent: {
    marginLeft: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
    lineHeight: 20,
  },
  checkboxLabelChecked: {
    color: '#0F172A',
    fontWeight: '500',
  },
  treatmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  treatmentNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    width: 20,
    marginTop: 2,
    flexShrink: 0,
  },
  treatmentContent: {
    flex: 1,
  },
  treatmentText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  treatmentBold: {
    fontWeight: 'bold',
    color: '#334155',
  },
  treatmentNote: {
    minHeight: 56,
    paddingTop: 8,
    marginTop: 4,
  },
  signatureBlock: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  signatureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  signatureHint: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  signatureInput: {
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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
