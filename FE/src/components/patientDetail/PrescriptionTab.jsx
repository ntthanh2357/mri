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
import { Pill, PenTool, Plus, ShieldAlert, ShieldCheck, AlertTriangle, Info, Save, Printer, Sparkles, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

const PrescriptionTab = ({
  isDesktop,
  currentUser,
  patient,
  prescriptions = [],
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
  clinicalWarnings = [],
  clinicalClassifications = [],
  clinicalSafetyScore = 100,
  clinicalSafetyStatus = 'SAFE',
  clinicalEvaluationCoverage = null,
  clinicalSources = null,
  aiConsultationData = null,
  isConsultingAi = false,
  onConsultAi,
  overrideReason = '',
  setOverrideReason,
  overrideCategory = 'BENEFIT_EXCEEDS_RISK',
  setOverrideCategory,
  prescriptionNote,
  setPrescriptionNote,
  handleSavePrescription,
  isSavingPrescription,
  calculateAge,
}) => {
  const [selectedPresId, setSelectedPresId] = React.useState(null);
  const activePres = (selectedPresId ? prescriptions.find(p => p._id === selectedPresId) : null) || (prescriptions.length > 0 ? prescriptions[0] : null);
  const hasSevereWarning = clinicalWarnings.some(w => w.severity === 'CRITICAL' || w.severity === 'HIGH');

  return (
    <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
      {/* Cột trái: Form kê đơn thuốc mới (Chỉ dành cho Bác sĩ) */}
      {currentUser?.role !== 'patient' && (
        <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <PenTool size={18} color="#1A5FD0" />
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
                                  <Pill size={14} color="#1A5FD0" />
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

            {/* KHỐI THẨM ĐỊNH AN TOÀN DƯỢC LÂM SÀNG & AI COPILOT */}
            {prescriptionDrugs.length > 0 && (
              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' }}>
                {/* Header thanh điểm & Tham vấn AI */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} color={clinicalSafetyScore >= 90 ? '#0F9D6B' : clinicalSafetyScore >= 70 ? '#B45309' : '#DC2626'} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>THẨM ĐỊNH DƯỢC LÂM SÀNG</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {/* Badge 1: Điểm an toàn */}
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: clinicalSafetyStatus === 'UNEVALUATED'
                        ? '#F1F5F9'
                        : (clinicalSafetyScore >= 90 ? '#D5F5E7' : clinicalSafetyScore >= 70 ? '#FEF3C7' : '#FEE2E2'),
                      borderWidth: 1,
                      borderColor: clinicalSafetyStatus === 'UNEVALUATED'
                        ? '#CBD5E1'
                        : (clinicalSafetyScore >= 90 ? '#6FDDB2' : clinicalSafetyScore >= 70 ? '#FCD34D' : '#FCA5A5')
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: clinicalSafetyStatus === 'UNEVALUATED'
                          ? '#64748B'
                          : (clinicalSafetyScore >= 90 ? '#0F9D6B' : clinicalSafetyScore >= 70 ? '#B45309' : '#B91C1C')
                      }}>
                        {clinicalSafetyStatus === 'UNEVALUATED'
                          ? 'Trạng thái: Chưa đánh giá'
                          : `Điểm an toàn: ${clinicalSafetyScore}/100 (${clinicalSafetyStatus})`}
                      </Text>
                    </View>

                    {/* Badge 2: Độ phủ đánh giá */}
                    {clinicalEvaluationCoverage && (
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                        backgroundColor: clinicalEvaluationCoverage.percentage === 100 ? '#EEFBF5' : '#FFFBEB',
                        borderWidth: 1,
                        borderColor: clinicalEvaluationCoverage.percentage === 100 ? '#A8EBCD' : '#FDE68A'
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: clinicalEvaluationCoverage.percentage === 100 ? '#0B7A53' : '#92400E'
                        }}>
                          Độ phủ: {clinicalEvaluationCoverage.percentage}% ({clinicalEvaluationCoverage.evaluated}/{clinicalEvaluationCoverage.total} thuốc)
                        </Text>
                      </View>
                    )}

                    {/* Nút gọi AI Dược sĩ */}
                    {onConsultAi && (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#7C3AED',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6
                        }}
                        onPress={onConsultAi}
                        disabled={isConsultingAi}
                      >
                        {isConsultingAi ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Sparkles size={12} color="#FFF" />
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>Tham vấn AI</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Thanh trạng thái nguồn đối soát (Fail-open transparency) */}
                {clinicalSources && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, padding: 6, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748B' }}>Nguồn dữ liệu:</Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#ECFDF5' }}>
                      <Text style={{ fontSize: 10, color: '#065F46', fontWeight: '500' }}>● Dược thư & KB: Đầy đủ</Text>
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: clinicalSources.fda === 'ok' ? '#ECFDF5' : clinicalSources.fda === 'timeout' ? '#FEF2F2' : '#F8FAFC'
                    }}>
                      <Text style={{
                        fontSize: 10,
                        color: clinicalSources.fda === 'ok' ? '#065F46' : clinicalSources.fda === 'timeout' ? '#991B1B' : '#64748B',
                        fontWeight: '500'
                      }}>
                        ● FDA Label: {clinicalSources.fda === 'ok' ? 'Đã kết nối' : clinicalSources.fda === 'timeout' ? 'Timeout (Mất mạng)' : clinicalSources.fda === 'skipped' ? 'Ngoại tuyến' : 'Không phản hồi'}
                      </Text>
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: clinicalSources.ai === 'ok' ? '#F5F3FF' : clinicalSources.ai === 'timeout' ? '#FEF2F2' : '#F8FAFC'
                    }}>
                      <Text style={{
                        fontSize: 10,
                        color: clinicalSources.ai === 'ok' ? '#5B21B6' : clinicalSources.ai === 'timeout' ? '#991B1B' : '#64748B',
                        fontWeight: '500'
                      }}>
                        ● AI Copilot: {clinicalSources.ai === 'ok' ? 'Đã phân tích' : clinicalSources.ai === 'timeout' ? 'Timeout (>8s)' : clinicalSources.ai === 'skipped' ? 'Chưa gọi' : 'Không khả dụng'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Kết quả nhận định từ Dược sĩ AI (Gemini) nếu có */}
                {aiConsultationData && (
                  <View style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#C4B5FD', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sparkles size={14} color="#6D28D9" />
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6D28D9' }}>NHẬN ĐỊNH DƯỢC SĨ AI (GEMINI 3.1 FLASH-LITE):</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#4C1D95', lineHeight: 16, marginBottom: 4 }}>
                      {aiConsultationData.summary || 'Đơn thuốc đã được AI đối soát với tiền sử bệnh án và phác đồ u não.'}
                    </Text>
                    {aiConsultationData.tumor_protocol_compatibility && (
                      <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 4, borderWidth: 1, borderColor: '#DDD6FE' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>
                          🧠 Tương thích Khối u AI ({aiConsultationData.tumor_protocol_compatibility.detected_tumor || 'U NÃO'} - {aiConsultationData.tumor_protocol_compatibility.compatibility_status}):
                        </Text>
                        <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>
                          {aiConsultationData.tumor_protocol_compatibility.clinical_rationale}
                        </Text>
                      </View>
                    )}
                    {aiConsultationData.pharmacist_recommendations ? (
                      <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>💡 Khuyến nghị bác sĩ:</Text>
                        <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>{aiConsultationData.pharmacist_recommendations}</Text>
                      </View>
                    ) : null}
                    {aiConsultationData.patient_instructions ? (
                      <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>🗣️ Lời dặn người bệnh:</Text>
                        <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>{aiConsultationData.patient_instructions}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Danh sách cảnh báo tương tác / chống chỉ định */}
                {clinicalWarnings.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    {clinicalWarnings.map((w, i) => {
                      const isCrit = w.severity === 'CRITICAL';
                      const isHigh = w.severity === 'HIGH';
                      const isInfo = w.severity === 'INFO';
                      const isAiTumorNote = w.type === 'AI_TUMOR_NOTE';

                      let bg = isCrit ? '#FEF2F2' : isHigh ? '#FFF7ED' : '#FFFBEB';
                      let borderCol = isCrit ? '#F87171' : isHigh ? '#FDBA74' : '#FCD34D';
                      let textCol = isCrit ? '#991B1B' : isHigh ? '#C2410C' : '#92400E';

                      if (isInfo) {
                        if (isAiTumorNote) {
                          bg = '#EEFBF5';
                          borderCol = '#6FDDB2';
                          textCol = '#0F9D6B';
                        } else {
                          bg = '#F8FAFC';
                          borderCol = '#CBD5E1';
                          textCol = '#475569';
                        }
                      }

                      return (
                        <View key={i} style={{ backgroundColor: bg, borderWidth: 1, borderColor: borderCol, borderRadius: 6, padding: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                            {isInfo ? (
                              <Info size={14} color={textCol} style={{ marginTop: 2, flexShrink: 0 }} />
                            ) : (
                              <AlertTriangle size={14} color={textCol} style={{ marginTop: 2, flexShrink: 0 }} />
                            )}
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: textCol }}>
                                  [{w.severity}] {w.type || 'LÂM SÀNG'}
                                </Text>
                                {w.source && (
                                  <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>{w.source}</Text>
                                )}
                              </View>
                              <Text style={{ fontSize: 11, color: '#1E293B', fontWeight: isCrit ? 'bold' : '500' }}>
                                {w.message}
                              </Text>
                              {w.recommendation && (
                                <Text style={{ fontSize: 10, color: textCol, marginTop: 3, fontStyle: 'italic' }}>
                                  👉 Xử trí: {w.recommendation}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                    <CheckCircle2 size={14} color="#16A34A" />
                    <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '500' }}>
                      Chưa phát hiện tương tác hoặc chống chỉ định bất lợi trong danh mục thuốc đã chọn.
                    </Text>
                  </View>
                )}

                {/* Phân loại đặc biệt */}
                {clinicalClassifications.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                    <Info size={13} color="#475569" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', flex: 1 }}>
                      {c.name}: {c.warning}
                    </Text>
                  </View>
                ))}

                {/* KHUNG BẮT BUỘC NHẬP LÝ DO GHI ĐÈ KHI CÓ CẢNH BÁO NẶNG */}
                {hasSevereWarning && (() => {
                  const cleanOver = (overrideReason || '').trim();
                  const isRep = /(.)\1{4,}/.test(cleanOver);
                  const words = cleanOver.split(/\s+/).filter(w => w.length > 1);
                  const isMeaningful = cleanOver.length >= 15 && !isRep && words.length >= 3;

                  return (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <AlertOctagon size={14} color="#DC2626" />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#DC2626' }}>
                          YÊU CẦU LÝ DO LÂM SÀNG CÓ CẤU TRÚC (STRUCTURED CLINICAL OVERRIDE):
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#7F1D1D', marginBottom: 6 }}>
                        Đơn thuốc có cảnh báo nguy cơ cao. Bác sĩ bắt buộc phải chọn nhóm lý do và giải trình chuyên môn rõ ràng (tối thiểu 15 ký tự, từ 3 từ có nghĩa trở lên, không lặp ký tự vô nghĩa) để lưu vết pháp lý:
                      </Text>

                      {/* Dropdown nhóm lý do */}
                      <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#334155', marginBottom: 3 }}>Nhóm lý do lâm sàng *</Text>
                        {Platform.OS === 'web' ? (
                          <select
                            value={overrideCategory}
                            onChange={(e) => setOverrideCategory && setOverrideCategory(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '11px',
                              backgroundColor: '#FFF',
                              color: '#1E293B',
                              outline: 'none'
                            }}
                          >
                            <option value="BENEFIT_EXCEEDS_RISK">Lợi ích điều trị vượt trội nguy cơ lâm sàng</option>
                            <option value="SPECIALIST_CONSULTED">Đã hội chẩn chuyên khoa Thần kinh / Dược lâm sàng</option>
                            <option value="CLOSE_MONITORING_PLANNED">Đã lập kế hoạch theo dõi sát (xét nghiệm lại sau 48h)</option>
                            <option value="PATIENT_INFORMED_CONSENT">Bệnh nhân và gia đình đã ký cam kết đồng ý</option>
                            <option value="OTHER">Lý do chuyên môn đặc biệt khác</option>
                          </select>
                        ) : (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                            {[
                              { id: 'BENEFIT_EXCEEDS_RISK', label: 'Lợi ích > Nguy cơ' },
                              { id: 'SPECIALIST_CONSULTED', label: 'Đã hội chẩn' },
                              { id: 'CLOSE_MONITORING_PLANNED', label: 'Theo dõi sát' }
                            ].map(cat => (
                              <TouchableOpacity
                                key={cat.id}
                                onPress={() => setOverrideCategory && setOverrideCategory(cat.id)}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 4,
                                  backgroundColor: overrideCategory === cat.id ? '#DC2626' : '#FFF',
                                  borderWidth: 1,
                                  borderColor: '#DC2626'
                                }}
                              >
                                <Text style={{ fontSize: 9, color: overrideCategory === cat.id ? '#FFF' : '#DC2626', fontWeight: 'bold' }}>
                                  {cat.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: '#FFF',
                            height: 38,
                            borderColor: isMeaningful ? '#22C55E' : '#F87171'
                          }
                        ]}
                        placeholder="VD: Đã hội chẩn Dược lâm sàng, bệnh nhân dung nạp tốt, theo dõi CTM mỗi 3 ngày..."
                        value={overrideReason}
                        onChangeText={setOverrideReason}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          color: isMeaningful ? '#0F9D6B' : '#B91C1C',
                          marginTop: 4,
                          fontWeight: '500'
                        }}
                      >
                        {isMeaningful
                          ? `✓ Đã đạt yêu cầu giải trình chuyên môn (${cleanOver.length} ký tự, ${words.length} từ).`
                          : isRep
                            ? `⚠️ Không được lặp ký tự vô nghĩa liên tiếp.`
                            : words.length < 3
                              ? `⚠️ Cần tối thiểu 3 từ ngữ có ý nghĩa y khoa (hiện có ${words.length}/3 từ).`
                              : `⚠️ Cần thêm ít nhất ${Math.max(0, 15 - cleanOver.length)} ký tự giải trình (${cleanOver.length}/15).`}
                      </Text>
                    </View>
                  );
                })()}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              {prescriptions.length > 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>Lịch sử đơn thuốc:</Text>
                  {prescriptions.map((p, idx) => {
                    const isSel = (p._id && activePres?._id === p._id) || (!p._id && activePres === p);
                    return (
                      <TouchableOpacity
                        key={p._id || idx}
                        onPress={() => setSelectedPresId(p._id || null)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: isSel ? '#0284C7' : '#F1F5F9',
                          borderWidth: 1,
                          borderColor: isSel ? '#0284C7' : '#CBD5E1'
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '500', color: isSel ? '#FFF' : '#334155' }}>
                          Đơn #{idx + 1} ({new Date(p.recorded_at || p.createdAt || Date.now()).toLocaleDateString('vi-VN')})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : <View />}

              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => window.print()}
                >
                  <Printer size={15} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>In đơn thuốc (PDF)</Text>
                </TouchableOpacity>
              )}
            </View>

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
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500', marginBottom: 8 }}>Cộng khoản: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{activePres.drugs.length} loại thuốc.</Text></Text>
                {activePres.note ? (
                  <View style={{ padding: 10, backgroundColor: '#FFFBEB', borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400E' }}>Lời dặn bác sĩ:</Text>
                    <Text style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>{activePres.note}</Text>
                  </View>
                ) : null}
              </View>

              {/* Hồ sơ Thẩm định An toàn Dược Lâm sàng & Dược sĩ AI nếu có */}
              {activePres.clinicalSafety && (
                <View style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: activePres.clinicalSafety.safetyScore >= 90 ? '#6FDDB2' : activePres.clinicalSafety.safetyScore >= 70 ? '#FCD34D' : '#FCA5A5',
                  padding: 12,
                  marginBottom: 16
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={16} color={activePres.clinicalSafety.safetyScore >= 90 ? '#16A34A' : activePres.clinicalSafety.safetyScore >= 70 ? '#D97706' : '#DC2626'} />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>
                        HỒ SƠ THẨM ĐỊNH DƯỢC LÂM SÀNG & DƯỢC SĨ AI COPILOT
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: activePres.clinicalSafety.safetyScore >= 90 ? '#D5F5E7' : activePres.clinicalSafety.safetyScore >= 70 ? '#FEF3C7' : '#FEE2E2',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: activePres.clinicalSafety.safetyScore >= 90 ? '#6FDDB2' : activePres.clinicalSafety.safetyScore >= 70 ? '#FCD34D' : '#FCA5A5'
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: activePres.clinicalSafety.safetyScore >= 90 ? '#0F9D6B' : activePres.clinicalSafety.safetyScore >= 70 ? '#B45309' : '#B91C1C'
                      }}>
                        Điểm an toàn: {activePres.clinicalSafety.safetyScore}/100 ({activePres.clinicalSafety.status || 'SAFE'})
                      </Text>
                    </View>
                  </View>

                  {/* AI Consultation nếu có */}
                  {activePres.clinicalSafety.aiConsultation && (
                    <View style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Sparkles size={14} color="#7C3AED" />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6D28D9' }}>
                          NHẬN ĐỊNH DƯỢC SĨ AI (GEMINI 3.1 FLASH-LITE):
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#4C1D95', lineHeight: 16 }}>
                        {activePres.clinicalSafety.aiConsultation.summary || 'Đơn thuốc đã được AI đối soát chuyên sâu với tiền sử bệnh án và phác đồ u não.'}
                      </Text>

                      {activePres.clinicalSafety.aiConsultation.tumor_protocol_compatibility && (
                        <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>
                            🧠 Tương thích Khối u AI ({activePres.clinicalSafety.aiConsultation.tumor_protocol_compatibility.detected_tumor || 'U NÃO'} - {activePres.clinicalSafety.aiConsultation.tumor_protocol_compatibility.compatibility_status}):
                          </Text>
                          <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>
                            {activePres.clinicalSafety.aiConsultation.tumor_protocol_compatibility.clinical_rationale}
                          </Text>
                        </View>
                      )}

                      {activePres.clinicalSafety.aiConsultation.pharmacist_recommendations ? (
                        <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>💡 Khuyến nghị bác sĩ:</Text>
                          <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>
                            {activePres.clinicalSafety.aiConsultation.pharmacist_recommendations}
                          </Text>
                        </View>
                      ) : null}

                      {activePres.clinicalSafety.aiConsultation.patient_instructions ? (
                        <View style={{ backgroundColor: '#EDE9FE', padding: 6, borderRadius: 6, marginTop: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#5B21B6' }}>🗣️ Lời dặn người bệnh:</Text>
                          <Text style={{ fontSize: 10, color: '#4C1D95', marginTop: 2 }}>
                            {activePres.clinicalSafety.aiConsultation.patient_instructions}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Lý do ghi đè lâm sàng nếu có */}
                  {activePres.clinicalSafety.overrideReason ? (
                    <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#991B1B' }}>
                        ⚠️ Giải trình ghi đè lâm sàng (Clinical Override):
                      </Text>
                      <Text style={{ fontSize: 10, color: '#7F1D1D', marginTop: 2 }}>
                        {activePres.clinicalSafety.overrideReason}
                      </Text>
                      <Text style={{ fontSize: 9, color: '#991B1B', fontStyle: 'italic', marginTop: 2 }}>
                        Người duyệt: {activePres.clinicalSafety.overriddenBy || activePres.doctor_name} • {activePres.clinicalSafety.overriddenAt ? new Date(activePres.clinicalSafety.overriddenAt).toLocaleString('vi-VN') : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

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
    backgroundColor: '#D5F5E7',
    borderRadius: 4,
  },
  badgeTextSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0B7A53',
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
