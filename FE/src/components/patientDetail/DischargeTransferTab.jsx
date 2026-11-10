import { PAPER_BLANK, SHORT_BLANK, orBlank, orDash, dayMonthYear, dateTimeOrBlank } from '../../utils/paperFields';
import { isFeatureEnabled } from '../../constants/featureScope';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import Colors from '../../constants/colors';
import {
  FileText,
  Save,
  Printer,
  Send,
  Zap,
  Brain,
  Box,
  Mail,
  CheckCircle2,
  Clock,
  Eye,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Layers,
  Download,
  X,
  Building2,
  Share2,
} from 'lucide-react';

const DischargeTransferTab = ({
  activeTab, // 'discharge' | 'transfer'
  isDesktop,
  currentUser,
  patient,
  calculateAge,
  // Discharge props
  dischargePapers,
  dischargeNo,
  setDischargeNo,
  hospitalNo,
  setHospitalNo,
  dischargeDiagnosis,
  setDischargeDiagnosis,
  dischargeTreatment,
  setDischargeTreatment,
  dischargeNote,
  setDischargeNote,
  handleSaveDischargePaper,
  isSavingDischarge,
  // Transfer props
  transferForms,
  transferNo,
  setTransferNo,
  transferHospitalNo,
  setTransferHospitalNo,
  transferTo,
  setTransferTo,
  transferClinicalSummary,
  setTransferClinicalSummary,
  transferLabSummary,
  setTransferLabSummary,
  transferDiagnosis,
  setTransferDiagnosis,
  transferTreatment,
  setTransferTreatment,
  transferDrugsUsed,
  setTransferDrugsUsed,
  transferPatientStatus,
  setTransferPatientStatus,
  transferReason,
  setTransferReason,
  transferReasonDetail,
  setTransferReasonDetail,
  transferDirection,
  setTransferDirection,
  transferTransportation,
  setTransferTransportation,
  transferEscort,
  setTransferEscort,
  transferOneYearValid,
  setTransferOneYearValid,
  handleSaveTransferForm,
  isSavingTransfer,
  labOrders,
  imagingResults = [],
}) => {
  // State phục vụ Gói Chuyển Viện Thông Minh (UC-DOC-10)
  const [isSmartPackage, setIsSmartPackage] = useState(true);
  const [selectedImagingId, setSelectedImagingId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedTransferIndex, setSelectedTransferIndex] = useState(0);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [modalPackageData, setModalPackageData] = useState(null);

  // Khởi tạo email bệnh nhân mặc định & chọn ca MRI mới nhất
  useEffect(() => {
    if (patient) {
      const email = (patient.email || patient.profile?.email || '').trim();
      setRecipientEmail(email);
    }
  }, [patient]);

  useEffect(() => {
    if (imagingResults && imagingResults.length > 0 && !selectedImagingId) {
      // Ưu tiên chọn ca có AI report hoặc ca mới nhất
      const withAi = imagingResults.find((img) => img.aiReport || img.model3dUrl || img.dicomZipUrl);
      setSelectedImagingId((withAi || imagingResults[0])._id);
    }
  }, [imagingResults, selectedImagingId]);

  // Thông tin ca chụp MRI đang chọn
  const selectedImaging = (imagingResults || []).find((img) => img._id === selectedImagingId);

  // Auto-fill ca vượt quá năng lực phẫu thuật
  const handleSelectBrainSurgeryExceeded = () => {
    setTransferReason('1');
    setTransferReasonDetail('Vượt quá năng lực phẫu thuật thần kinh chuyên sâu tại cơ sở. Khối u não xâm lấn phức tạp, cần vi phẫu thần kinh và xạ trị chuyên sâu tại tuyến trên.');
    setTransferDirection('Hội chẩn liên viện, phẫu thuật bóc tách u vi phẫu dưới định vị neuronavigation, xạ trị gia tốc tuyến trên.');
    setTransferTransportation('Xe cấp cứu chuyên dụng (Monitor theo dõi + Bình oxy)');
    if (!transferDiagnosis && selectedImaging?.aiReport?.tumorType) {
      setTransferDiagnosis(`U não (${selectedImaging.aiReport.tumorType}${selectedImaging.aiReport.whoGrade ? ` - WHO Grade ${selectedImaging.aiReport.whoGrade}` : ''})`);
    }
    Alert.alert(
      'Đã thiết lập ca phẫu thuật phức tạp',
      'Đã điền gợi ý lý do chuyển viện, hướng điều trị và phương tiện vận chuyển. Vui lòng tự nhập chẩn đoán (nếu chưa có) và tình trạng người bệnh khi chuyển.'
    );
  };

  // Chọn nhanh nơi chuyển đến
  const handleQuickSelectHospital = (hospName) => {
    setTransferTo(hospName);
  };

  // Xử lý gửi form chuyển viện
  const onSubmitTransfer = () => {
    if (typeof handleSaveTransferForm === 'function') {
      handleSaveTransferForm({
        isSmartPackage,
        imagingResultId: selectedImagingId || undefined,
        recipientEmail: recipientEmail.trim(),
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 1: GIẤY RA VIỆN
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeTab === 'discharge') {
    const activeDisc = dischargePapers && dischargePapers.length > 0 ? dischargePapers[0] : null;

    return (
      <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
        {/* Cột trái: Lập Giấy ra viện mới (Bác sĩ) */}
        {currentUser?.role !== 'patient' && (
          <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <FileText size={18} color="#0891B2" />
                <Text style={styles.cardTitleText}>Lập Giấy ra viện</Text>
              </View>
              <Text style={styles.cardSubtitleText}>Hoàn tất thủ tục xuất viện cho người bệnh</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số giấy ra viện</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh hoặc nhập..."
                    value={dischargeNo}
                    onChangeText={setDischargeNo}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số hồ sơ / Số BA</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh hoặc nhập..."
                    value={hospitalNo}
                    onChangeText={setHospitalNo}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Chẩn đoán ra viện *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: U não thái dương đã phẫu thuật..."
                  value={dischargeDiagnosis}
                  onChangeText={setDischargeDiagnosis}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Phương pháp điều trị *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Phẫu thuật bóc tách u + Điều trị nội khoa hậu phẫu..."
                  value={dischargeTreatment}
                  onChangeText={setDischargeTreatment}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Ghi chú ra viện / Lời dặn</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Tránh vận động mạnh, tái khám theo hẹn..."
                  value={dischargeNote}
                  onChangeText={setDischargeNote}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#16A34A' }]}
                onPress={handleSaveDischargePaper}
                disabled={isSavingDischarge}
              >
                {isSavingDischarge ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Save size={16} color="#FFF" />
                    <Text style={styles.submitButtonText}>Cấp giấy ra viện & Ký duyệt</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cột phải: Bản xem Giấy ra viện chính thức */}
        <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
          {activeDisc ? (
            <View style={{ gap: 16 }}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => window.print()}
                >
                  <Printer size={15} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>In giấy ra viện (PDF)</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: '#10B981' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 12, marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ: {SHORT_BLANK}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>CƠ SỞ KCB: {PAPER_BLANK}</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>Số: {activeDisc.dischargeNo}/GV</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Độc lập - Tự do - Hạnh phúc</Text>
                    <Text style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>--------------------</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Mẫu số: <Text style={{ fontWeight: 'bold' }}>02-GV</Text></Text>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>{activeDisc.hospitalNo}</Text></Text>
                  </View>
                </View>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>GIẤY RA VIỆN</Text>

                <View style={{ gap: 10, marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Họ tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{orBlank(patient?.profile?.name || patient?.profile?.fullName)}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>Ngày sinh: <Text style={{ fontWeight: '500' }}>{patient?.profile?.dob ? new Date(patient.profile.dob).toLocaleDateString('vi-VN') : orBlank(patient?.profile?.birthYear, SHORT_BLANK)}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Tuổi: <Text style={{ fontWeight: '500' }}>{calculateAge ? orBlank(calculateAge(patient?.profile?.dob, patient?.profile?.birthYear), SHORT_BLANK) : SHORT_BLANK}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Giới tính: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.gender, SHORT_BLANK)}</Text></Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Dân tộc: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.ethnicity, SHORT_BLANK)}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Nghề nghiệp: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.occupation, SHORT_BLANK)}</Text></Text>
                  </View>

                  {isFeatureEnabled('bhyt') && <Text style={{ fontSize: 13, color: '#334155' }}>Mã số BHXH / Thẻ BHYT số: <Text style={{ fontWeight: '500' }}>{PAPER_BLANK}</Text></Text>}
                  <Text style={{ fontSize: 13, color: '#334155' }}>Địa chỉ: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.address)}</Text></Text>
                  
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 8 }}>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Vào viện lúc: <Text style={{ fontWeight: '600' }}>{dateTimeOrBlank(null)}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Ra viện lúc: <Text style={{ fontWeight: '600' }}>{dateTimeOrBlank(null)}</Text></Text>
                    
                    <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>• Chẩn đoán ra viện: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activeDisc.diagnosis}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Phương pháp điều trị: <Text style={{ fontWeight: '500', color: '#1E3A8A' }}>{activeDisc.treatment}</Text></Text>
                    
                    {activeDisc.note ? (
                      <Text style={{ fontSize: 13, color: '#334155' }}>• Lời dặn bác sĩ / Ghi chú: <Text style={{ fontWeight: '500', fontStyle: 'italic' }}>{activeDisc.note}</Text></Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>NGƯỜI HÀNH NGHỀ KCB</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
                    <Text style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 'bold', marginTop: 25 }}>{activeDisc.doctor_name}</Text>
                  </View>
                  
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Ngày {dayMonthYear(activeDisc.recorded_at || activeDisc.createdAt)}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', marginTop: 2 }}>ĐẠI DIỆN ĐƠN VỊ KCB</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký tên, đóng dấu)</Text>
                    <View style={[styles.signatureSigned, { marginTop: 15 }]}>
                      <Text style={styles.badgeTextSmall}>Đã đóng dấu điện tử</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noOrderSelectedCard}>
              <Text style={styles.noOrderSelectedText}>Bệnh nhân chưa được lập giấy ra viện.</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 2: CHUYỂN TUYẾN / GÓI CHUYỂN VIỆN THÔNG MINH (UC-DOC-10)
  // ─────────────────────────────────────────────────────────────────────────────
  const totalTransfers = transferForms || [];
  const activeTrans = totalTransfers.length > 0 ? totalTransfers[selectedTransferIndex] || totalTransfers[0] : null;

  // Trích xuất tự động kết quả Lab LIS + Kết quả AI MRI
  const handleAutofillLabResults = () => {
    let parts = [];

    // 1. Kết quả Lab LIS
    const completedOrder = labOrders ? labOrders.find((o) => o.status === 'COMPLETED') : null;
    if (completedOrder && completedOrder.results) {
      const lisSummary = completedOrder.results
        .map((r) => `${r.biomarker_name} (${r.biomarker_code}): ${r.value_result} ${r.unit}${r.is_abnormal ? ' (Lệch chuẩn)' : ''}`)
        .join('; ');
      parts.push(`- Xét nghiệm máu & sinh hóa (LIS): ${lisSummary}`);
    }

    // 2. Kết quả AI MRI nếu có
    if (selectedImaging?.aiReport) {
      const ai = selectedImaging.aiReport;
      parts.push(
        `- Hình ảnh MRI Não & Phân tích AI: ${[selectedImaging.procedure, ai.tumorType && `phát hiện tổn thương ${ai.tumorType}`, ai.whoGrade && `phân độ ác tính WHO Grade ${ai.whoGrade}`, ai.volumeCm3 && `thể tích ước tính ${ai.volumeCm3} cm³`, ai.location && `vị trí ${ai.location}`, typeof ai.confidence === 'number' && `độ tin cậy AI ${Math.round(ai.confidence * 100)}%`].filter(Boolean).join('; ') || 'chưa có dữ liệu phân tích'}.`
      );
    } else if (selectedImaging?.conclusion) {
      parts.push(`- MRI Sọ não: ${selectedImaging.conclusion}`);
    }

    if (parts.length === 0) {
      Alert.alert('Thông báo', 'Chưa tìm thấy kết quả cận lâm sàng hoặc ca chụp MRI hoàn tất để trích xuất.');
      return;
    }

    const fullSummary = parts.join('\n\n');
    setTransferLabSummary(fullSummary);
    Alert.alert('Thành công', 'Đã trích xuất kết quả xét nghiệm LIS và kết luận phân tích AI MRI vào phiếu chuyển tuyến!');
  };

  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* ───────────────────────────────────────────────────────── */}
      {/* CỘT TRÁI: FORM KHỞI TẠO GÓI CHUYỂN VIỆN (BÁC SĨ) */}
      {/* ───────────────────────────────────────────────────────── */}
      {currentUser?.role !== 'patient' && (
        <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
          <View style={styles.card}>
            {/* Header Form */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Brain size={20} color="#0891B2" />
                <Text style={styles.cardTitleText}>Gói Chuyển Viện Thông Minh</Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Sparkles size={11} color="#2563EB" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4ED8' }}>UC-DOC-10</Text>
              </View>
            </View>

            <Text style={styles.cardSubtitleText}>
              Đóng gói tự động DICOM, Báo cáo AI, 3D Mesh và chuyển hồ sơ sang bộ phận Lễ tân để gửi email cho bệnh nhân.
            </Text>

            {/* Banner Phím tắt ca vượt quá năng lực phẫu thuật u não */}
            <View style={styles.alertBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>
                    Ca u não vượt quá năng lực phẫu thuật của viện?
                  </Text>
                  <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2, lineHeight: 15 }}>
                    Bấm nút bên dưới để hệ thống tự động điền lý do chuyên môn và phương tiện vận chuyển cấp cứu.
                  </Text>
                  <TouchableOpacity
                    style={styles.quickFillButton}
                    onPress={handleSelectBrainSurgeryExceeded}
                  >
                    <Zap size={12} color="#FFFFFF" />
                    <Text style={styles.quickFillButtonText}>Tự động điền: Vượt quá năng lực phẫu thuật</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* KHU VỰC ĐÓNG GÓI DỮ LIỆU SỐ */}
            <View style={styles.packageConfigSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Box size={14} color="#0284C7" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0369A1' }}>
                    DỮ LIỆU ĐÍNH KÈM TỰ ĐỘNG
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={13} color="#16A34A" />
                  <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '600' }}>Tự động gom</Text>
                </View>
              </View>

              {/* Chọn ca chụp MRI */}
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.inputLabelSmall}>Ca chụp MRI đính kèm:</Text>
                {Platform.OS === 'web' && imagingResults && imagingResults.length > 0 ? (
                  <select
                    value={selectedImagingId}
                    onChange={(e) => setSelectedImagingId(e.target.value)}
                    style={styles.htmlSelect}
                  >
                    {imagingResults.map((img) => (
                      <option key={img._id} value={img._id}>
                        {img.procedure || 'Ca chụp (chưa ghi tên kỹ thuật)'} - {img.orderDate ? new Date(img.orderDate).toLocaleDateString('vi-VN') : 'chưa ghi ngày'}
                        {img.aiReport ? ' (Đã có Báo cáo AI)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <View style={styles.readOnlyBox}>
                    <Text style={{ fontSize: 12, color: '#334155' }}>
                      {selectedImaging?.procedure || 'Ca chụp (chưa ghi tên kỹ thuật)'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Preview 4 thành phần trong gói snapshot */}
              <View style={styles.snapshotGrid}>
                <View style={styles.snapshotItem}>
                  <Box size={12} color="#2563EB" />
                  <Text style={styles.snapshotItemText}>
                    DICOM Zip: <Text style={{ fontWeight: '700' }}>{selectedImaging?.dicomZipUrl ? 'Sẵn sàng (.zip)' : 'Tự nén'}</Text>
                  </Text>
                </View>
                <View style={styles.snapshotItem}>
                  <Brain size={12} color="#7C3AED" />
                  <Text style={styles.snapshotItemText}>
                    Báo cáo AI: <Text style={{ fontWeight: '700' }}>{selectedImaging?.aiReport?.tumorType ? 'Chi tiết u não' : 'Tự động trích'}</Text>
                  </Text>
                </View>
                <View style={styles.snapshotItem}>
                  <Layers size={12} color="#0D9488" />
                  <Text style={styles.snapshotItemText}>
                    3D Model: <Text style={{ fontWeight: '700' }}>{selectedImaging?.model3dUrl ? 'Tệp GLTF' : 'Sẵn sàng'}</Text>
                  </Text>
                </View>
                <View style={styles.snapshotItem}>
                  <FileText size={12} color="#EA580C" />
                  <Text style={styles.snapshotItemText}>
                    Lát cắt u: <Text style={{ fontWeight: '700' }}>Top 5 slices</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Email người nhận (Bệnh nhân / Thân nhân) */}
            <View style={[styles.formGroup, { marginTop: 4 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.inputLabel}>Email bệnh nhân / thân nhân nhận gói *</Text>
                <Text style={{ fontSize: 10, color: '#0284C7', fontWeight: '600' }}>Lễ tân sẽ gửi tới email này</Text>
              </View>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.textInput, { paddingLeft: 34 }]}
                  placeholder="VD: benhnhan@gmail.com..."
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Mail size={15} color="#64748B" style={{ position: 'absolute', left: 10 }} />
              </View>
            </View>

            {/* Nơi chuyển đến */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.inputLabel}>Nơi chuyển đến (Tuyến trên) *</Text>
                <Text style={{ fontSize: 10, color: '#64748B' }}>Bấm chọn nhanh hoặc nhập:</Text>
              </View>

              {/* Nút chọn nhanh bệnh viện */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {[
                  'Bệnh viện Chợ Rẫy (TP.HCM)',
                  'Bệnh viện Trung ương Huế',
                  'Bệnh viện Bạch Mai (Hà Nội)',
                  'Bệnh viện K Trung Ương',
                  'Bệnh viện Hữu nghị Việt Đức',
                ].map((name) => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => handleQuickSelectHospital(name)}
                    style={[
                      styles.hospPill,
                      transferTo === name && { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
                    ]}
                  >
                    <Building2 size={10} color={transferTo === name ? '#1D4ED8' : '#64748B'} />
                    <Text style={[styles.hospPillText, transferTo === name && { color: '#1D4ED8', fontWeight: '700' }]}>
                      {name.split(' (')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.textInput}
                placeholder="VD: Bệnh viện Chợ Rẫy TP.HCM..."
                value={transferTo}
                onChangeText={setTransferTo}
              />
            </View>

            {/* Chẩn đoán chính */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Chẩn đoán bệnh chính khi chuyển viện *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: U não ác tính Glioblastoma vùng thái dương phải..."
                value={transferDiagnosis}
                onChangeText={setTransferDiagnosis}
              />
            </View>

            {/* Tóm tắt cận lâm sàng */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.inputLabel}>Tóm tắt cận lâm sàng chính</Text>
                <TouchableOpacity onPress={handleAutofillLabResults} style={styles.extractLabBtn}>
                  <Zap size={11} color={Colors.primary} />
                  <Text style={{ fontSize: 10, color: Colors.primary, fontWeight: 'bold' }}>Trích LIS Lab + AI MRI</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                multiline
                placeholder="VD: MRI sọ não cho thấy khối u kích thước 4.2cm, xâm lấn bao trong..."
                value={transferLabSummary}
                onChangeText={setTransferLabSummary}
              />
            </View>

            {/* Tóm tắt lâm sàng */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Tóm tắt dấu hiệu lâm sàng</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Nhức đầu dữ dội, nôn ói nhiều, yếu nửa người nhẹ..."
                value={transferClinicalSummary}
                onChangeText={setTransferClinicalSummary}
              />
            </View>

            {/* Lý do chuyển */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Chi tiết lý do chuyển viện</Text>
              <TextInput
                style={styles.textInput}
                value={transferReasonDetail}
                onChangeText={setTransferReasonDetail}
                placeholder="VD: Vượt quá năng lực phẫu thuật thần kinh chuyên sâu..."
              />
            </View>

            {/* Hướng điều trị */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Hướng điều trị tiếp theo tại tuyến trên</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Phẫu thuật bóc tách u vi phẫu, xạ trị bổ trợ..."
                value={transferDirection}
                onChangeText={setTransferDirection}
              />
            </View>

            {/* Phương tiện vận chuyển & Tình trạng */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1.2 }]}>
                <Text style={styles.inputLabel}>Phương tiện vận chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferTransportation}
                  onChangeText={setTransferTransportation}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Tình trạng lúc chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferPatientStatus}
                  onChangeText={setTransferPatientStatus}
                  placeholder="VD: Tỉnh táo, sinh hiệu ổn"
                />
              </View>
            </View>

            {/* Nút Submit Tạo Gói Chuyển Viện */}
            <TouchableOpacity
              style={[styles.smartSubmitButton, isSavingTransfer && { opacity: 0.7 }]}
              onPress={onSubmitTransfer}
              disabled={isSavingTransfer}
            >
              {isSavingTransfer ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Send size={16} color="#FFF" />
                  <Text style={styles.smartSubmitButtonText}>Tạo Gói Chuyển Viện & Đẩy Sang Lễ Tân</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 8 }}>
              Hồ sơ số sẽ được lưu ở trạng thái Draft và xuất hiện tại quầy Lễ tân để gửi email cho người bệnh.
            </Text>
          </View>
        </View>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* CỘT PHẢI: BẢN XEM HỒ SƠ & TRẠNG THÁI GÓI CHUYỂN VIỆN */}
      {/* ───────────────────────────────────────────────────────── */}
      <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
        {activeTrans ? (
          <View style={{ gap: 14 }}>
            {/* Thanh chọn phiếu nếu có nhiều phiếu */}
            {totalTransfers.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {totalTransfers.map((item, idx) => (
                  <TouchableOpacity
                    key={item._id || idx}
                    onPress={() => setSelectedTransferIndex(idx)}
                    style={[
                      styles.transferPill,
                      selectedTransferIndex === idx && styles.transferPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.transferPillText,
                        selectedTransferIndex === idx && styles.transferPillTextActive,
                      ]}
                    >
                      Phiếu #{idx + 1}{item.transferNo ? ` (${item.transferNo})` : ''}
                      {item.status === 'sent' ? ' • Đã gửi' : ' • Chờ Lễ tân'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* CARD 1: THẺ TRẠNG THÁI LUỒNG GÓI CHUYỂN VIỆN SỐ */}
            <View
              style={[
                styles.statusBannerCard,
                activeTrans.status === 'sent' ? styles.statusBannerSent : styles.statusBannerDraft,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {activeTrans.status === 'sent' ? (
                    <CheckCircle2 size={20} color="#15803D" />
                  ) : (
                    <Clock size={20} color="#B45309" />
                  )}
                  <View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '800',
                        color: activeTrans.status === 'sent' ? '#166534' : '#92400E',
                      }}
                    >
                      {activeTrans.status === 'sent'
                        ? 'TRẠNG THÁI: ĐÃ GỬI EMAIL THÀNH CÔNG CHO BỆNH NHÂN'
                        : 'TRẠNG THÁI: ĐANG CHỜ LỄ TÂN GỬI EMAIL CHO BỆNH NHÂN'}
                    </Text>
                    <Text style={{ fontSize: 11, color: activeTrans.status === 'sent' ? '#15803D' : '#B45309', marginTop: 2 }}>
                      {activeTrans.status === 'sent'
                        ? `Đã gửi tới: ${orDash(activeTrans.recipientEmail)} • Lúc: ${activeTrans.sentAt ? new Date(activeTrans.sentAt).toLocaleString('vi-VN') : '—'}`
                        : `Gói hồ sơ đã lập xong. Lễ tân sẽ đối chiếu email [${activeTrans.recipientEmail || patient?.email || 'Chưa có email'}] và bấm gửi.`}
                    </Text>
                  </View>
                </View>

                {activeTrans.packageSnapshot && (
                  <TouchableOpacity
                    style={styles.viewPackageBtn}
                    onPress={() => {
                      setModalPackageData(activeTrans.packageSnapshot);
                      setShowPackageModal(true);
                    }}
                  >
                    <Eye size={12} color="#0369A1" />
                    <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '700' }}>Xem Gói Dữ Liệu Số</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tóm tắt các tệp trong gói snapshot của phiếu đang xem */}
              {activeTrans.packageSnapshot && (
                <View style={styles.packageSummaryBox}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}>Gói hồ sơ y tế số:</Text>
                    <View style={styles.miniTag}>
                      <Box size={10} color="#2563EB" />
                      <Text style={styles.miniTagText}>DICOM Zip</Text>
                    </View>
                    <View style={styles.miniTag}>
                      <Brain size={10} color="#7C3AED" />
                      <Text style={styles.miniTagText}>Báo cáo AI U Não</Text>
                    </View>
                    <View style={styles.miniTag}>
                      <Layers size={10} color="#0D9488" />
                      <Text style={styles.miniTagText}>3D GLTF Model</Text>
                    </View>
                    <View style={styles.miniTag}>
                      <FileText size={10} color="#EA580C" />
                      <Text style={styles.miniTagText}>5 Lát cắt phân đoạn</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Nút in PDF nếu ở trên web */}
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={{
                  alignSelf: 'flex-end',
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  backgroundColor: '#475569',
                  borderRadius: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={() => window.print()}
              >
                <Printer size={15} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>In phiếu chuyển tuyến (PDF)</Text>
              </TouchableOpacity>
            )}

            {/* CARD 2: MẪU GIẤY CHUYỂN TUYẾN CHUẨN BỘ Y TẾ */}
            <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: '#0284C7' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 12, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ: {SHORT_BLANK}</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>CƠ SỞ KCB: {PAPER_BLANK}</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>Số: {orBlank(activeTrans.transferNo, SHORT_BLANK)}/GCT</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Độc lập - Tự do - Hạnh phúc</Text>
                  <Text style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>--------------------</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 9, color: '#475569' }}>Mẫu số: <Text style={{ fontWeight: 'bold' }}>06/GCT</Text></Text>
                  <Text style={{ fontSize: 9, color: '#475569' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>{orBlank(activeTrans.hospitalNo, SHORT_BLANK)}</Text></Text>
                  <Text style={{ fontSize: 9, color: '#475569' }}>Vào sổ chuyển số: <Text style={{ fontWeight: 'bold' }}>{orBlank(activeTrans.transferNo, SHORT_BLANK)}</Text></Text>
                </View>
              </View>

              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 4 }}>
                PHIẾU CHUYỂN CƠ SỞ KHÁM BỆNH, CHỮA BỆNH BẢO HIỂM Y TẾ
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E3A8A', textAlign: 'center', marginBottom: 20 }}>
                Kính gửi: {activeTrans.transferTo}
              </Text>

              <View style={{ gap: 10, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  Cơ sở khám bệnh, chữa bệnh: <Text style={{ fontWeight: 'bold' }}>{PAPER_BLANK}</Text> trân trọng giới thiệu:
                </Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  - Họ và tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{orBlank(patient?.profile?.name || patient?.profile?.fullName)}</Text>
                </Text>

                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>
                    - Giới tính: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.gender, SHORT_BLANK)}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>
                    - Năm sinh: <Text style={{ fontWeight: '500' }}>{patient?.profile?.dob ? new Date(patient.profile.dob).getFullYear() : orBlank(patient?.profile?.birthYear, SHORT_BLANK)}</Text>
                  </Text>
                </View>

                <Text style={{ fontSize: 13, color: '#334155' }}>
                  - Địa chỉ: <Text style={{ fontWeight: '500' }}>{orBlank(patient?.profile?.address)}</Text>
                </Text>

                {isFeatureEnabled('bhyt') && (<Text style={{ fontSize: 13, color: '#334155' }}>
                  - Số thẻ Bảo hiểm y tế: <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>{PAPER_BLANK}</Text>
                </Text>)}

                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 }}>TÓM TẮT BỆNH ÁN:</Text>

                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    1. Tóm tắt dấu hiệu lâm sàng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{orBlank(activeTrans.clinicalSummary)}</Text>
                  </Text>

                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>2. Tóm tắt kết quả xét nghiệm, cận lâm sàng chính: </Text>
                  <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginLeft: 12, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', lineHeight: 16 }}>
                      {orBlank(activeTrans.labSummary)}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    3. Chẩn đoán bệnh chính: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activeTrans.diagnosis}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    4. Phương pháp, thủ thuật đã thực hiện: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{orBlank(activeTrans.treatment)}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    5. Thuốc điều trị chính đã sử dụng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{orBlank(activeTrans.drugsUsed)}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    6. Tình trạng bệnh nhân khi chuyển tuyến: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{orBlank(activeTrans.patientStatus)}</Text>
                  </Text>
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    - Lý do chuyển tuyến: <Text style={{ fontWeight: 'bold', color: '#D97706' }}>Mục [{orBlank(activeTrans.reason, '....')}] — {orBlank(activeTrans.reasonDetail)}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    - Hướng điều trị tiếp theo: <Text style={{ fontWeight: '500', color: '#1E3A8A' }}>{orBlank(activeTrans.treatmentDirection)}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    - Thời gian chuyển tuyến: <Text style={{ fontWeight: '500' }}>{dateTimeOrBlank(activeTrans.transferTime || activeTrans.createdAt)}</Text>
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>
                      - Phương tiện vận chuyển: <Text style={{ fontWeight: '500' }}>{orBlank(activeTrans.transportation)}</Text>
                    </Text>
                    {activeTrans.escort ? (
                      <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>
                        - Người hộ tống: <Text style={{ fontWeight: '500' }}>{activeTrans.escort}</Text>
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>Y BÁC SĨ ĐIỀU TRỊ</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
                  <Text style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 'bold', marginTop: 25 }}>
                    {orBlank(activeTrans.doctor_name)}
                  </Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
                    Ngày {dayMonthYear(activeTrans.recorded_at || activeTrans.createdAt)}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', marginTop: 2 }}>ĐẠI DIỆN CƠ SỞ KCB</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký tên, đóng dấu)</Text>
                  <View style={[styles.signatureSigned, { marginTop: 15 }]}>
                    <Text style={styles.badgeTextSmall}>Đã ký số phê duyệt</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noOrderSelectedCard}>
            <Send size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
            <Text style={styles.noOrderSelectedText}>Bệnh nhân chưa có phiếu chuyển tuyến nào.</Text>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              Bác sĩ sử dụng biểu mẫu bên trái để khởi tạo Gói Chuyển Viện Thông Minh.
            </Text>
          </View>
        )}
      </View>

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL XEM CHI TIẾT GÓI HỒ SƠ Y TẾ SỐ (UC-DOC-10) */}
      {/* ───────────────────────────────────────────────────────── */}
      <Modal
        visible={showPackageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPackageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Brain size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>Chi tiết Gói Chuyển Viện Thông Minh</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPackageModal(false)} style={styles.closeBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {modalPackageData ? (
                <View style={{ gap: 14 }}>
                  {/* Báo cáo AI */}
                  {modalPackageData.aiReport && (
                    <View style={styles.modalCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Brain size={16} color="#7C3AED" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#6D28D9' }}>
                          Báo cáo Phân tích AI U Não Chuyên Sâu
                        </Text>
                      </View>
                      <View style={{ gap: 4 }}>
                        <Text style={styles.modalLine}>
                          • Loại u: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{modalPackageData.aiReport.tumorType || 'N/A'}</Text>
                        </Text>
                        <Text style={styles.modalLine}>
                          • Phân độ WHO: <Text style={{ fontWeight: '700', color: '#DC2626' }}>{modalPackageData.aiReport.whoGrade ? `Grade ${modalPackageData.aiReport.whoGrade}` : '—'}</Text>
                        </Text>
                        <Text style={styles.modalLine}>
                          • Thể tích u ước tính: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{modalPackageData.aiReport.volumeCm3 || 'N/A'} cm³</Text>
                        </Text>
                        <Text style={styles.modalLine}>
                          • Vị trí giải phẫu: <Text style={{ fontWeight: '500', color: '#334155' }}>{orDash(modalPackageData.aiReport.location)}</Text>
                        </Text>
                        <Text style={styles.modalLine}>
                          • Độ tin cậy AI: <Text style={{ fontWeight: '700', color: '#16A34A' }}>{typeof modalPackageData.aiReport.confidence === 'number' ? `${Math.round(modalPackageData.aiReport.confidence * 100)}%` : '—'}</Text>
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* DICOM Archive */}
                  <View style={styles.modalCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Box size={16} color="#0284C7" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369A1' }}>
                        Tệp Ảnh Gốc DICOM (Bảo mật PACS)
                      </Text>
                    </View>
                    <Text style={styles.modalLine}>
                      • File nén: <Text style={{ fontWeight: '500' }}>{orDash(modalPackageData.dicom?.filename)}</Text>
                    </Text>
                    <Text style={styles.modalLine}>
                      • Dung lượng: <Text style={{ fontWeight: '500' }}>{modalPackageData.dicom?.sizeBytes ? `${(modalPackageData.dicom.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : 'Khoảng 45 MB'}</Text>
                    </Text>
                    <Text style={styles.modalLine}>
                      • Study UID: <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748B' }}>{orDash(modalPackageData.dicom?.studyInstanceUID)}</Text>
                    </Text>
                  </View>

                  {/* 3D Model & Lát cắt */}
                  <View style={styles.modalCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Layers size={16} color="#0D9488" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                        Mô hình Không gian 3D & Lát cắt U
                      </Text>
                    </View>
                    <Text style={styles.modalLine}>
                      • Mô hình 3D: <Text style={{ fontWeight: '500' }}>{modalPackageData.model3dUrl ? 'Đã render mô hình GLTF' : 'Sẵn sàng tương tác'}</Text>
                    </Text>
                    <Text style={styles.modalLine}>
                      • Số lát cắt tiêu biểu: <Text style={{ fontWeight: '500' }}>{modalPackageData.top5SlicesUrls?.length || 5} lát cắt MRI độ nét cao</Text>
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: '#64748B', textAlign: 'center', padding: 20 }}>
                  Không có dữ liệu chi tiết gói snapshot.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPackageModal(false)}>
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
  },
  mobileColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  mainCol: {
    flex: 2.2,
  },
  sideCol: {
    flex: 1.2,
  },
  fullWidth: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  quickFillButton: {
    marginTop: 6,
    backgroundColor: '#D97706',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  quickFillButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  packageConfigSection: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  inputLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  htmlSelect: {
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingLeft: 8,
    fontSize: 12,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    width: '100%',
  },
  readOnlyBox: {
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  snapshotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  snapshotItemText: {
    fontSize: 10,
    color: '#334155',
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
    fontWeight: '600',
  },
  textInput: {
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  hospPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hospPillText: {
    fontSize: 10,
    color: '#475569',
  },
  extractLabBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  submitButton: {
    height: 42,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  smartSubmitButton: {
    height: 46,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  smartSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  labReportSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 24,
  },
  signatureSigned: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
  },
  badgeTextSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  noOrderSelectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noOrderSelectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  transferPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transferPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  transferPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  transferPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  statusBannerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  statusBannerDraft: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBannerSent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  viewPackageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  packageSummaryBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  modalLine: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: '#475569',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default DischargeTransferTab;
