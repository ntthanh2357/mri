import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Colors from '../../constants/colors';
import { FileText, Save, Printer, Send, Zap } from 'lucide-react';

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
}) => {
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
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
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
                  <Text style={{ fontSize: 13, color: '#334155' }}>Họ tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>Ngày sinh: <Text style={{ fontWeight: '500' }}>{patient?.profile?.dob ? new Date(patient.profile.dob).toLocaleDateString('vi-VN') : patient?.profile?.birthYear || 'N/A'}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Tuổi: <Text style={{ fontWeight: '500' }}>{calculateAge ? calculateAge(patient?.profile?.dob, patient?.profile?.birthYear) : '30'}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Giới tính: <Text style={{ fontWeight: '500' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Dân tộc: <Text style={{ fontWeight: '500' }}>Kinh</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Nghề nghiệp: <Text style={{ fontWeight: '500' }}>Kỹ sư</Text></Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#334155' }}>Mã số BHXH / Thẻ BHYT số: <Text style={{ fontWeight: '500' }}>GD4797921800244</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                  
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 8 }}>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Vào viện lúc: <Text style={{ fontWeight: '600' }}>08:30 ngày {new Date(activeDisc.dateIn || Date.now()).toLocaleDateString('vi-VN')}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Ra viện lúc: <Text style={{ fontWeight: '600' }}>16:00 ngày {new Date(activeDisc.dateOut || Date.now()).toLocaleDateString('vi-VN')}</Text></Text>
                    
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
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Ngày {new Date(activeDisc.recorded_at || Date.now()).getDate()} tháng {new Date(activeDisc.recorded_at || Date.now()).getMonth() + 1} năm {new Date(activeDisc.recorded_at || Date.now()).getFullYear()}</Text>
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

  // Otherwise: activeTab === 'transfer'
  const activeTrans = transferForms && transferForms.length > 0 ? transferForms[0] : null;

  const handleAutofillLabResults = () => {
    const completedOrder = labOrders ? labOrders.find(o => o.status === 'COMPLETED') : null;
    if (!completedOrder || !completedOrder.results) {
      Alert.alert('Thông báo', 'Không tìm thấy kết quả xét nghiệm đã hoàn thành để trích xuất.');
      return;
    }
    
    const summaryText = completedOrder.results.map(r => {
      return `${r.biomarker_name} (${r.biomarker_code}): ${r.value_result} ${r.unit}${r.is_abnormal ? ' (Lệch chuẩn)' : ''}`;
    }).join('\n');
    
    setTransferLabSummary(summaryText);
    Alert.alert('Thành công', 'Đã trích xuất thành công kết quả xét nghiệm LIS gần nhất vào phiếu chuyển tuyến!');
  };

  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* Cột trái: Lập Phiếu chuyển tuyến mới (Bác sĩ) */}
      {currentUser?.role !== 'patient' && (
        <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Send size={18} color="#0891B2" />
              <Text style={styles.cardTitleText}>Lập Phiếu chuyển tuyến BHYT</Text>
            </View>
            <Text style={styles.cardSubtitleText}>Chuyển bệnh nhân lên tuyến trên hoặc bệnh viện khác</Text>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Số phiếu chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Tự động sinh..."
                  value={transferNo}
                  onChangeText={setTransferNo}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Số hồ sơ chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Tự động sinh..."
                  value={transferHospitalNo}
                  onChangeText={setTransferHospitalNo}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Kính gửi (Nơi chuyển đến) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Bệnh viện Trung ương Huế..."
                value={transferTo}
                onChangeText={setTransferTo}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Tóm tắt dấu hiệu lâm sàng</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Nhức đầu nhiều, nôn mửa, yếu liệt nửa người nhẹ..."
                value={transferClinicalSummary}
                onChangeText={setTransferClinicalSummary}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.inputLabel}>Tóm tắt cận lâm sàng chính</Text>
                <TouchableOpacity onPress={handleAutofillLabResults} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Zap size={11} color={Colors.primary} />
                  <Text style={{ fontSize: 10, color: Colors.primary, fontWeight: 'bold' }}>Trích LIS Lab gần nhất</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                multiline
                placeholder="VD: MRI cho thấy khối u não thái dương kích thước lớn..."
                value={transferLabSummary}
                onChangeText={setTransferLabSummary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Chẩn đoán chính khi chuyển tuyến *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: U não thái dương..."
                value={transferDiagnosis}
                onChangeText={setTransferDiagnosis}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Phương pháp, thủ thuật đã thực hiện</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Điều trị nâng đỡ, giảm phù não..."
                value={transferTreatment}
                onChangeText={setTransferTreatment}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Kỹ thuật, thuốc điều trị chính đã sử dụng</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Keppra 500mg, Dexamethasone kháng viêm..."
                value={transferDrugsUsed}
                onChangeText={setTransferDrugsUsed}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Tình trạng người bệnh lúc chuyển</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Tỉnh táo, sinh hiệu tạm ổn, đau đầu nhẹ..."
                value={transferPatientStatus}
                onChangeText={setTransferPatientStatus}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Lý do chuyển tuyến</Text>
              {Platform.OS === 'web' ? (
                <select
                  value={transferReason}
                  onChange={(e) => {
                    setTransferReason(e.target.value);
                    if (e.target.value === '1') setTransferReasonDetail('Phù hợp với quy định chuyển cấp chuyên môn kỹ thuật (**)');
                    else setTransferReasonDetail('Theo yêu cầu của người bệnh hoặc đại diện hợp pháp');
                  }}
                  style={{
                    height: 38,
                    borderRadius: 8,
                    borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'solid',
                    paddingLeft: 10,
                    fontSize: 13,
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    width: '100%'
                  }}
                >
                  <option value="1">1. Đủ điều kiện chuyển tuyến chuyên môn</option>
                  <option value="2">2. Theo yêu cầu của người bệnh / người nhà</option>
                </select>
              ) : (
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: 1 hoặc 2"
                  value={transferReason}
                  onChangeText={setTransferReason}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Chi tiết lý do chuyển</Text>
              <TextInput
                style={styles.textInput}
                value={transferReasonDetail}
                onChangeText={setTransferReasonDetail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Hướng điều trị tiếp theo</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Phẫu thuật chuyên sâu, xạ trị..."
                value={transferDirection}
                onChangeText={setTransferDirection}
              />
            </View>

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
                <Text style={styles.inputLabel}>Hộ tống (nếu có)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Điều dưỡng A"
                  value={transferEscort}
                  onChangeText={setTransferEscort}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Có giá trị trong 01 năm?</Text>
              {Platform.OS === 'web' ? (
                <select
                  value={transferOneYearValid}
                  onChange={(e) => setTransferOneYearValid(e.target.value)}
                  style={{
                    height: 38,
                    borderRadius: 8,
                    borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'solid',
                    paddingLeft: 10,
                    fontSize: 13,
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    width: '100%'
                  }}
                >
                  <option value="Không">Không</option>
                  <option value="Có">Có</option>
                </select>
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={transferOneYearValid}
                  onChangeText={setTransferOneYearValid}
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#16A34A' }]}
              onPress={handleSaveTransferForm}
              disabled={isSavingTransfer}
            >
              {isSavingTransfer ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Save size={16} color="#FFF" />
                  <Text style={styles.submitButtonText}>Lập phiếu chuyển & Ký duyệt</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cột phải: Bản xem Phiếu chuyển tuyến chính thức */}
      <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
        {activeTrans ? (
          <View style={{ gap: 16 }}>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => window.print()}
              >
                <Printer size={15} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>In phiếu chuyển tuyến (PDF)</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: '#F59E0B' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 12, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>Số: {activeTrans.transferNo}/GCT</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Độc lập - Tự do - Hạnh phúc</Text>
                  <Text style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>--------------------</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 9, color: '#475569' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>{activeTrans.hospitalNo}</Text></Text>
                  <Text style={{ fontSize: 9, color: '#475569' }}>Vào sổ chuyển số: <Text style={{ fontWeight: 'bold' }}>{activeTrans.transferNo}</Text></Text>
                </View>
              </View>

              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 6 }}>PHIẾU CHUYỂN CƠ SỞ KHÁM BỆNH, CHỮA BỆNH BẢO HIỂM Y TẾ</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E3A8A', textAlign: 'center', marginBottom: 20 }}>Kính gửi: {activeTrans.transferTo}</Text>

              <View style={{ gap: 10, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: '#334155' }}>Cơ sở khám bệnh, chữa bệnh: <Text style={{ fontWeight: 'bold' }}>Bệnh viện Đa khoa Tâm Trí Đà Nẵng</Text> trân trọng giới thiệu:</Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>- Họ và tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>- Giới tính: <Text style={{ fontWeight: '500' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Năm sinh: <Text style={{ fontWeight: '500' }}>{patient?.profile?.dob ? new Date(patient.profile.dob).getFullYear() : patient?.profile?.birthYear || 'N/A'}</Text></Text>
                </View>

                <Text style={{ fontSize: 13, color: '#334155' }}>- Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1.2 }}>- Dân tộc: <Text style={{ fontWeight: '500' }}>Kinh</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Quốc tịch: <Text style={{ fontWeight: '500' }}>Việt Nam</Text></Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1.2 }}>- Nghề nghiệp: <Text style={{ fontWeight: '500' }}>Kỹ sư</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Nơi làm việc: <Text style={{ fontWeight: '500' }}>N/A</Text></Text>
                </View>

                <Text style={{ fontSize: 13, color: '#334155' }}>- Số thẻ Bảo hiểm y tế: <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>GD4797921800244</Text></Text>
                
                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 }}>TÓM TẮT BỆNH ÁN:</Text>
                  
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>1. Tóm tắt dấu hiệu lâm sàng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.clinicalSummary || 'N/A'}</Text></Text>
                  
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>2. Tóm tắt kết quả xét nghiệm, cận lâm sàng chính: </Text>
                  <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginLeft: 12, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', lineHeight: 16 }}>{activeTrans.labSummary || 'N/A'}</Text>
                  </View>

                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>3. Chẩn đoán bệnh chính: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activeTrans.diagnosis}</Text></Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>4. Phương pháp, thủ thuật đã thực hiện: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.treatment || 'Chưa thực hiện thủ thuật'}</Text></Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>5. Thuốc điều trị chính đã sử dụng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.drugsUsed || 'N/A'}</Text></Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>6. Tình trạng bệnh nhân khi chuyển tuyến: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.patientStatus || 'Ổn định'}</Text></Text>
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>- Lý do chuyển tuyến: <Text style={{ fontWeight: 'bold', color: '#D97706' }}>Mục [{activeTrans.reason}] — {activeTrans.reasonDetail}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>- Hướng điều trị tiếp theo: <Text style={{ fontWeight: '500', color: '#1E3A8A' }}>{activeTrans.treatmentDirection || 'Theo chỉ định của tuyến trên'}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>- Thời gian chuyển tuyến: <Text style={{ fontWeight: '500' }}>{new Date(activeTrans.transferTime).toLocaleTimeString('vi-VN')} ngày {new Date(activeTrans.transferTime).toLocaleDateString('vi-VN')}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>- Trường hợp chuyển tuyến có giá trị trong 01 năm: <Text style={{ fontWeight: 'bold' }}>{activeTrans.isOneYearValid}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>- Phương tiện vận chuyển: <Text style={{ fontWeight: '500' }}>{activeTrans.transportation}</Text></Text>
                    {activeTrans.escort ? (
                      <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Người hộ tống: <Text style={{ fontWeight: '500' }}>{activeTrans.escort}</Text></Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>Y BÁC SĨ ĐIỀU TRỊ</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
                  <Text style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 'bold', marginTop: 25 }}>{activeTrans.doctor_name}</Text>
                </View>
                
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Ngày {new Date(activeTrans.recorded_at).getDate()} tháng {new Date(activeTrans.recorded_at).getMonth() + 1} năm {new Date(activeTrans.recorded_at).getFullYear()}</Text>
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
            <Text style={styles.noOrderSelectedText}>Bệnh nhân chưa được cấp phiếu chuyển tuyến.</Text>
          </View>
        )}
      </View>
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
    flex: 1,
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
    fontWeight: '500',
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
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noOrderSelectedText: {
    fontSize: 13,
    color: '#64748B',
  },
});

export default DischargeTransferTab;
