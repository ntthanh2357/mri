import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Colors from '../../constants/colors';
import { Pill, PenTool, Plus, ShieldAlert, AlertTriangle, Info, Save, Printer } from 'lucide-react';

const PrescriptionTab = ({
  isDesktop,
  currentUser,
  patient,
  prescriptions,
  prescriptionDiagnosis,
  setPrescriptionDiagnosis,
  selectedPredefinedDrug,
  setSelectedPredefinedDrug,
  availableDrugs,
  drugQuantity,
  setDrugQuantity,
  drugUnit,
  setDrugUnit,
  drugUsage,
  setDrugUsage,
  drugTimesPerDay,
  setDrugTimesPerDay,
  drugDurationDays,
  setDrugDurationDays,
  handleAddDrugToPrescription,
  prescriptionDrugs,
  handleRemoveDrugFromPrescription,
  clinicalWarnings,
  clinicalClassifications,
  prescriptionNote,
  setPrescriptionNote,
  handleSavePrescription,
  isSavingPrescription,
  calculateAge,
}) => {
  const activePres = prescriptions.length > 0 ? prescriptions[0] : null;

  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* Cột trái: Form kê đơn thuốc mới (Chỉ dành cho Bác sĩ) */}
      {currentUser?.role !== 'patient' && (
        <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <PenTool size={18} color="#0891B2" />
              <Text style={styles.cardTitleText}>Kê đơn thuốc mới</Text>
            </View>
            <Text style={styles.cardSubtitleText}>Thiết lập danh mục và kiểm tra tương tác chéo</Text>

            <View style={[styles.formGroup, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Chẩn đoán bệnh *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: U não thái dương..."
                value={prescriptionDiagnosis}
                onChangeText={setPrescriptionDiagnosis}
              />
            </View>

            {/* Form thêm từng loại thuốc */}
            <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>Thêm thuốc vào đơn</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Tên thuốc điều trị *</Text>
                {Platform.OS === 'web' ? (
                  <>
                    <input
                      type="text"
                      list="drugs-datalist"
                      value={selectedPredefinedDrug}
                      onChange={(e) => {
                        setSelectedPredefinedDrug(e.target.value);
                        const drug = availableDrugs.find(d => d.name === e.target.value);
                        if (drug) setDrugUnit(drug.stock?.unit || 'viên');
                      }}
                      placeholder="Nhập hoặc chọn tên thuốc (VD: Keppra...)"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        outline: 'none',
                        fontSize: '14px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        fontFamily: 'inherit'
                      }}
                    />
                    <datalist id="drugs-datalist">
                      {availableDrugs.map(d => (
                        <option key={d._id} value={d.name}>{`Tồn: ${d.stock?.quantity || 0} ${d.stock?.unit || 'viên'}`}</option>
                      ))}
                    </datalist>
                  </>
                ) : (
                  <View style={{ position: 'relative', zIndex: 1000 }}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nhập tên thuốc (VD: Keppra, Depakine...)"
                      value={selectedPredefinedDrug}
                      onChangeText={setSelectedPredefinedDrug}
                    />
                    {(() => {
                      const showSuggestions = selectedPredefinedDrug.trim().length > 0 && 
                        !availableDrugs.find(d => d.name === selectedPredefinedDrug);
                      
                      const filtered = availableDrugs.filter(d => 
                        d.name.toLowerCase().includes(selectedPredefinedDrug.toLowerCase())
                      );
                      
                      if (showSuggestions && filtered.length > 0) {
                        return (
                          <View style={styles.suggestionsContainer}>
                            {filtered.map((drug) => (
                              <TouchableOpacity
                                key={drug._id}
                                style={styles.suggestionItem}
                                onPress={() => {
                                  setSelectedPredefinedDrug(drug.name);
                                  setDrugUnit(drug.stock?.unit || 'viên');
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Pill size={14} color="#0891B2" />
                                  <Text style={styles.suggestionText}>
                                    {drug.name} (Tồn: {drug.stock?.quantity || 0} {drug.stock?.unit || 'viên'})
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                )}
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.inputLabel}>Số lượng *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 10"
                    value={drugQuantity}
                    onChangeText={setDrugQuantity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Đơn vị</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: viên"
                    value={drugUnit}
                    onChangeText={setDrugUnit}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Cách dùng / Liều lượng</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Ngày uống 2 lần, mỗi lần 1 viên sau ăn..."
                  value={drugUsage}
                  onChangeText={setDrugUsage}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số lần uống/ngày</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 2"
                    value={drugTimesPerDay}
                    onChangeText={setDrugTimesPerDay}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số ngày uống</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 7"
                    value={drugDurationDays}
                    onChangeText={setDrugDurationDays}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: Colors.primary, height: 36, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                onPress={handleAddDrugToPrescription}
              >
                <Plus size={15} color="#FFF" />
                <Text style={styles.submitButtonText}>Thêm vào đơn</Text>
              </TouchableOpacity>
            </View>

            {/* Danh sách thuốc đang kê nháp */}
            {prescriptionDrugs.length > 0 && (
              <View style={{ marginVertical: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 6 }}>Danh sách thuốc đã chọn:</Text>
                {prescriptionDrugs.map((d, index) => (
                  <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 8, borderRadius: 6, marginBottom: 6 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E3A8A' }}>{index + 1}. {d.name} ({d.quantity} {d.unit})</Text>
                      <Text style={{ fontSize: 11, color: '#1E40AF' }}>HD: {d.usage}</Text>
                      <Text style={{ fontSize: 11, color: '#1E40AF' }}>Nhắc uống: {d.timesPerDay} lần/ngày × {d.durationDays} ngày</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveDrugFromPrescription(index)} style={{ padding: 4, backgroundColor: '#FECACA', borderRadius: 4 }}>
                      <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: 'bold' }}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Cảnh báo tương tác lâm sàng real-time */}
            {(clinicalWarnings.length > 0 || clinicalClassifications.length > 0) && (
              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <ShieldAlert size={16} color="#B45309" />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#B45309' }}>CẢNH BÁO DƯỢC LÂM SÀNG (REAL-TIME DSS):</Text>
                </View>
                
                {clinicalWarnings.map((w, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                    <AlertTriangle size={14} color={w.severity === 'CRITICAL' ? '#DC2626' : '#D97706'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text style={{ fontSize: 11, color: w.severity === 'CRITICAL' ? '#DC2626' : '#D97706', fontWeight: w.severity === 'CRITICAL' ? 'bold' : 'normal', flex: 1 }}>
                      [{w.severity}] {w.message}
                    </Text>
                  </View>
                ))}

                {clinicalClassifications.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                    <Info size={14} color="#4B5563" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text style={{ fontSize: 11, color: '#4B5563', fontStyle: 'italic', flex: 1 }}>
                      {c.name}: {c.warning}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Lời dặn / Ghi chú đơn thuốc</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Tái khám sau 1 tháng mang theo đơn này..."
                value={prescriptionNote}
                onChangeText={setPrescriptionNote}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              onPress={handleSavePrescription}
              disabled={isSavingPrescription}
            >
              {isSavingPrescription ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Save size={16} color="#FFF" />
                  <Text style={styles.submitButtonText}>Lưu đơn thuốc & Ký số</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cột phải: Bản xem đơn thuốc chính thức (Print view) */}
      <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
        {activePres ? (
          <View style={{ gap: 16 }}>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => window.print()}
              >
                <Printer size={15} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>In đơn thuốc (PDF)</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: Colors.primary }]}>
              {/* Header bệnh viện */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN CHUYÊN KHOA UNG THƯ NÃO NEUROSCAN</Text>
                  <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>Hotline: 1900 571 563 - ĐT Cấp cứu: 0236 3615 115</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '500' }}>Mã y tế: <Text style={{ fontWeight: 'bold' }}>PT-003</Text></Text>
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '500' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>NS-{patient?._id?.substring(18).toUpperCase()}</Text></Text>
                </View>
              </View>

              {/* Tiêu đề */}
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 16 }}>ĐƠN THUỐC (TOA THUỐC)</Text>

              {/* Thông tin bệnh nhân */}
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#3B82F6' }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>Họ tên người bệnh: <Text style={{ fontWeight: 'bold' }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 0.8 }}>Tuổi: <Text style={{ fontWeight: 'bold' }}>{calculateAge ? calculateAge(patient?.profile?.dob, patient?.profile?.birthYear) : '30'}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155', flex: 0.8 }}>Giới tính: <Text style={{ fontWeight: 'bold' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                </View>
                <Text style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>Chẩn đoán lâm sàng: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activePres.diagnosis}</Text></Text>
              </View>

              {/* Bảng danh sách thuốc */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 }}>CHỈ ĐỊNH THUỐC ĐIỀU TRỊ:</Text>
              <View style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#CBD5E1' }}>
                  <Text style={{ flex: 0.4, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>STT</Text>
                  <Text style={{ flex: 2.2, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Tên thuốc / Hàm lượng</Text>
                  <Text style={{ flex: 0.8, fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>S.Lượng</Text>
                  <Text style={{ flex: 0.8, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Đơn vị</Text>
                </View>
                
                {activePres.drugs.map((drug, idx) => (
                  <View key={idx} style={{ borderBottomWidth: idx === activePres.drugs.length - 1 ? 0 : 1, borderBottomColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={{ flex: 0.4, fontSize: 12, color: '#334155', fontWeight: '500' }}>{idx + 1}</Text>
                      <Text style={{ flex: 2.2, fontSize: 12, color: '#1E3A8A', fontWeight: 'bold' }}>{drug.name}</Text>
                      <Text style={{ flex: 0.8, fontSize: 12, color: '#334155', fontWeight: 'bold', textAlign: 'center' }}>{drug.quantity}</Text>
                      <Text style={{ flex: 0.8, fontSize: 12, color: '#475569' }}>{drug.unit}</Text>
                    </View>
                    {drug.usage ? (
                      <Text style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 4, marginLeft: 20 }}>Cách dùng: {drug.usage}</Text>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Cộng khoản và lời dặn */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500', marginBottom: 8 }}>Cộng khoản: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{activePres.drugs.length} loại thuốc.</Text></Text>
                {activePres.note ? (
                  <View style={{ padding: 10, backgroundColor: '#FFFBEB', borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400E' }}>Lời dặn bác sĩ:</Text>
                    <Text style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>{activePres.note}</Text>
                  </View>
                ) : null}
              </View>

              {/* Phần ký tên */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                <View>
                  <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Khám ngày: {new Date(activePres.recorded_at).toLocaleDateString('vi-VN')}</Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Đã ghi nhận trên hệ thống</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>BÁC SĨ KHÁM BỆNH</Text>
                  <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 25 }}>{activePres.doctor_name}</Text>
                  <View style={styles.signatureSigned}>
                    <Text style={styles.badgeTextSmall}>Đã ký số điện tử</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noOrderSelectedCard}>
            <Text style={styles.noOrderSelectedText}>Bệnh án này chưa được kê đơn thuốc lâm sàng.</Text>
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
  suggestionsContainer: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxHeight: 180,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: 12,
    color: '#1E293B',
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

export default PrescriptionTab;
