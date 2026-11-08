import React from 'react';
import Colors from '../constants/colors';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet
} from 'react-native';
import { ClipboardCheck, AlertTriangle, XOctagon, Check } from 'lucide-react';
import { flaggedAnswers, ANSWER_LABEL } from '../utils/mriScreening';

// Mỗi câu phải chọn rõ Có hoặc Không. Giá trị null là chưa trả lời.
const YesNo = ({ value, onChange }) => (
  <View style={styles.yesNoRow}>
    {[{ v: true, label: 'Có' }, { v: false, label: 'Không' }].map((o) => (
      <TouchableOpacity
        key={o.label}
        style={[styles.yesNoBtn, value === o.v && (o.v ? styles.yesNoBtnYes : styles.yesNoBtnNo)]}
        onPress={() => onChange(o.v)}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === o.v }}
      >
        <Text style={[styles.yesNoText, value === o.v && styles.yesNoTextActive]}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

/**
 * Component: Modal Bảng kiểm An toàn MRI trước buồng máy
 * 4 câu hỏi sinh mạng: Pacemaker/Kim loại, Claustrophobia, Thận eGFR, Thai kỳ
 */
const MriSafetyCheckModal = ({
  visible,
  onClose,
  patientName,
  hasPacemakerOrMetal,
  setHasPacemakerOrMetal,
  hasClaustrophobia,
  setHasClaustrophobia,
  hasKidneyDisease,
  setHasKidneyDisease,
  isPregnant,
  setIsPregnant,
  safetyNotes,
  setSafetyNotes,
  patientScreening,
  onSubmit,
  submitting,
  confirmMode = null, // null: KTV làm bảng kiểm; 'review' | 'override': bác sĩ xác nhận an toàn
  confirmReason = '',
  setConfirmReason = () => {},
  mrDocName = '',
  onPickDoc = () => {},
  uploadingDoc = false
}) => {
  const allAnswered = [hasPacemakerOrMetal, hasClaustrophobia, hasKidneyDisease, isPregnant].every((v) => v === true || v === false);
  const confirmReady = !confirmMode || (confirmReason.trim().length >= 10 && (confirmMode !== 'override' || Boolean(mrDocName)));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxHeight: '92%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <ClipboardCheck size={22} color={Colors.brandGreen} style={{ marginRight: 8 }} />
            <Text style={[styles.modalTitle, { color: Colors.brandNavy, marginBottom: 0 }]}>{confirmMode ? 'Xác nhận an toàn MRI' : 'Bảng kiểm an toàn MRI trước buồng máy'}</Text>
          </View>
          <Text style={styles.modalSub}>
            Bệnh nhân: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{patientName || 'Bệnh nhân'}</Text> · Từ trường 1.5T/3.0T
          </Text>

          <View style={styles.warningBox}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#92400E" style={{ marginRight: 6, marginTop: 2, flexShrink: 0 }} />
              <Text style={[styles.warningText, { flex: 1 }]}>
                CẢNH BÁO AN TOÀN TỪ TRƯỜNG: Bắt buộc KTV rà soát kỹ lưỡng các yếu tố kim loại sinh mạng trước khi kích hoạt buồng máy MRI.
              </Text>
            </View>
          </View>

          {/* Lời khai của bệnh nhân trên app: chỉ để tham khảo, KTV vẫn hỏi lại từng câu */}
          <View style={[styles.declared, patientScreening?.level === 'danger' && styles.declaredDanger]}>
            {patientScreening?.declaredAt ? (
              <>
                <Text style={styles.declaredTitle}>
                  Bệnh nhân tự khai trên ứng dụng lúc {new Date(patientScreening.declaredAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </Text>
                {flaggedAnswers(patientScreening).length ? flaggedAnswers(patientScreening).map((f) => (
                  <Text key={f.key} style={[styles.declaredLine, f.danger && styles.declaredLineDanger]}>• {f.label}: {ANSWER_LABEL[f.answer]}</Text>
                )) : <Text style={styles.declaredLine}>Không khai yếu tố nguy cơ nào.</Text>}
                {patientScreening.details ? <Text style={styles.declaredLine}>Ghi chú: {patientScreening.details}</Text> : null}
                <Text style={styles.declaredHint}>Đã điền sẵn theo lời khai. Hãy hỏi lại bệnh nhân từng câu trước khi xác nhận.</Text>
              </>
            ) : (
              <Text style={styles.declaredHint}>Bệnh nhân chưa tự khai trên ứng dụng. Hãy hỏi đủ các câu dưới đây.</Text>
            )}
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            {/* Câu 1: Máy tạo nhịp & Kim loại */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                hasPacemakerOrMetal ? styles.itemCardDanger : styles.itemCardDefault
              ]}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.checkbox, hasPacemakerOrMetal && styles.checkboxDanger]}>
                  {hasPacemakerOrMetal && <Check size={14} color="#fff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, hasPacemakerOrMetal ? { color: '#991B1B' } : { color: '#1E293B' }]}>
                    1. Cấy ghép máy tạo nhịp tim (Pacemaker) hoặc Dị vật kim loại từ tính?
                  </Text>
                  <Text style={styles.itemDesc}>
                    Van tim nhân tạo cũ, clip kẹp phình mạch não, mảnh đạn hốc mắt... (Chống chỉ định tuyệt đối)
                  </Text>
                </View>
              </View>
              <YesNo value={hasPacemakerOrMetal} onChange={setHasPacemakerOrMetal} />

              {hasPacemakerOrMetal && (
                <View style={styles.dangerAlertBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <XOctagon size={16} color="#B91C1C" style={{ marginRight: 6 }} />
                    <Text style={[styles.dangerAlertText, { flex: 1 }]}>
                      CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI! Nguy cơ tử vong do lực hút từ trường cực đại. Không được đưa vào buồng chụp!
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Câu 2: Hội chứng sợ buồng kín */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                hasClaustrophobia ? styles.itemCardWarning : styles.itemCardDefault
              ]}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.checkbox, hasClaustrophobia && styles.checkboxWarning]}>
                  {hasClaustrophobia && <Check size={14} color="#fff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, hasClaustrophobia ? { color: '#92400E' } : { color: '#1E293B' }]}>
                    2. Hội chứng sợ không gian kín (Claustrophobia) hoặc hoảng loạn?
                  </Text>
                  <Text style={styles.itemDesc}>
                    Bệnh nhân có cảm giác ngột ngạt, lo âu cấp khi nằm trong ống máy hẹp (Cần chuẩn bị tâm lý/người nhà)
                  </Text>
                </View>
              </View>
              <YesNo value={hasClaustrophobia} onChange={setHasClaustrophobia} />
            </TouchableOpacity>

            {/* Câu 3: Bệnh thận eGFR */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                hasKidneyDisease ? styles.itemCardWarning : styles.itemCardDefault
              ]}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.checkbox, hasKidneyDisease && styles.checkboxWarning]}>
                  {hasKidneyDisease && <Check size={14} color="#fff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, hasKidneyDisease ? { color: '#92400E' } : { color: '#1E293B' }]}>
                    3. Tiền sử suy thận nặng / eGFR &lt; 30 ml/phút?
                  </Text>
                  <Text style={styles.itemDesc}>
                    Thận trọng nguy cơ xơ hóa hệ thống (NSF) nếu có chỉ định tiêm thuốc đối quang từ Gadolinium
                  </Text>
                </View>
              </View>
              <YesNo value={hasKidneyDisease} onChange={setHasKidneyDisease} />
            </TouchableOpacity>

            {/* Câu 4: Đang mang thai */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                isPregnant ? styles.itemCardPink : styles.itemCardDefault
              ]}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.checkbox, isPregnant && styles.checkboxPink]}>
                  {isPregnant && <Check size={14} color="#fff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, isPregnant ? { color: '#9D174D' } : { color: '#1E293B' }]}>
                    4. Bệnh nhân nữ đang mang thai (đặc biệt 3 tháng đầu)?
                  </Text>
                  <Text style={styles.itemDesc}>
                    Khuyến cáo hạn chế chụp trừ trường hợp cấp cứu đe dọa tính mạng
                  </Text>
                </View>
              </View>
              <YesNo value={isPregnant} onChange={setIsPregnant} />
            </TouchableOpacity>

            {/* Ghi chú thêm */}
            <Text style={styles.fieldLabel}>Ghi chú rà soát an toàn của KTV:</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Ghi chú thêm về dụng cụ tháo rời (răng giả, trang sức kim loại đã tháo)..."
              value={safetyNotes}
              onChangeText={setSafetyNotes}
            />

            {confirmMode ? (
              <View style={styles.confirmBox}>
                <Text style={styles.fieldLabel}>
                  {confirmMode === 'override' ? 'Lý do cho phép chụp với thiết bị MR-conditional (tối thiểu 10 ký tự):' : 'Lý do bác sĩ xác nhận an toàn (tối thiểu 10 ký tự):'}
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder={confirmMode === 'override' ? 'Ví dụ: Nẹp vít titan, nhà sản xuất xác nhận an toàn 1.5T' : 'Ví dụ: Đã cân nhắc lợi ích chẩn đoán và nguy cơ'}
                  value={confirmReason}
                  onChangeText={setConfirmReason}
                  multiline
                />
                <Text style={styles.confirmHint}>{confirmReason.trim().length}/10 ký tự tối thiểu</Text>
                {confirmMode === 'override' ? (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    <TouchableOpacity style={styles.docBtn} onPress={onPickDoc} disabled={uploadingDoc}>
                      {uploadingDoc ? <ActivityIndicator color={Colors.brandNavy} /> : <Text style={styles.docBtnText}>{mrDocName ? 'Chọn lại giấy xác nhận' : 'Tải giấy xác nhận MR-conditional (PDF hoặc ảnh)'}</Text>}
                    </TouchableOpacity>
                    <Text style={styles.confirmHint}>{mrDocName ? `Đã tải: ${mrDocName}` : 'Bắt buộc. Trưởng khoa sẽ nhận thông báo khi bạn xác nhận.'}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnConfirm,
                { backgroundColor: hasPacemakerOrMetal ? '#B91C1C' : Colors.brandGreen }
              ]}
              onPress={onSubmit}
              disabled={submitting || !allAnswered || !confirmReady}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {hasPacemakerOrMetal ? (
                    <AlertTriangle size={16} color="#fff" />
                  ) : (
                    <Check size={16} color="#fff" strokeWidth={2.5} />
                  )}
                  <Text style={styles.btnConfirmText}>
                    {!allAnswered ? 'Trả lời đủ 4 câu để xác nhận' : confirmMode ? (confirmReady ? 'Xác nhận an toàn MRI' : 'Nhập lý do để xác nhận') : hasPacemakerOrMetal ? 'Ghi nhận chống chỉ định' : 'Đạt an toàn, vào buồng chụp'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  declared: { padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg, marginBottom: 12, gap: 4 },
  declaredDanger: { backgroundColor: Colors.errorBg },
  declaredTitle: { fontSize: 14, fontWeight: '700', color: Colors.slateDark },
  declaredLine: { fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  declaredLineDanger: { color: Colors.errorText, fontWeight: '700' },
  declaredHint: { fontSize: 13, lineHeight: 18, color: Colors.slateMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.brandNavy, marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  warningBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 },
  warningText: { color: '#92400E', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  itemCard: { padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  itemCardDefault: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  itemCardDanger: { backgroundColor: '#FEE2E2', borderColor: '#B91C1C' },
  itemCardWarning: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  itemCardPink: { backgroundColor: '#FDF2F8', borderColor: '#DB2777' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxDanger: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  checkboxWarning: { backgroundColor: '#D97706', borderColor: '#D97706' },
  checkboxPink: { backgroundColor: '#DB2777', borderColor: '#DB2777' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  itemTitle: { fontSize: 13, fontWeight: 'bold' },
  itemDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  dangerAlertBox: { marginTop: 8, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6 },
  dangerAlertText: { color: '#B91C1C', fontSize: 12, fontWeight: 'bold' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: Colors.brandNavy, minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
  yesNoRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  yesNoBtn: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  yesNoBtnYes: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  yesNoBtnNo: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  yesNoText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  yesNoTextActive: { color: '#fff' },
  confirmBox: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  confirmHint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  docBtn: { height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.brandNavy, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  docBtnText: { fontSize: 13, fontWeight: '600', color: Colors.brandNavy },
});

export default MriSafetyCheckModal;
