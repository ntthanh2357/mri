import React from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet
} from 'react-native';
import { ClipboardCheck, AlertTriangle, XOctagon, Check } from 'lucide-react';

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
  onSubmit,
  submitting
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxHeight: '92%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <ClipboardCheck size={22} color="#0891B2" style={{ marginRight: 8 }} />
            <Text style={[styles.modalTitle, { color: '#0F172A', marginBottom: 0 }]}>Bảng Kiểm An Toàn MRI Trước Buồng Máy</Text>
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

          <ScrollView style={{ maxHeight: 400 }}>
            {/* Câu 1: Máy tạo nhịp & Kim loại */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                hasPacemakerOrMetal ? styles.itemCardDanger : styles.itemCardDefault
              ]}
              onPress={() => setHasPacemakerOrMetal(!hasPacemakerOrMetal)}
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

              {hasPacemakerOrMetal && (
                <View style={styles.dangerAlertBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <XOctagon size={16} color="#DC2626" style={{ marginRight: 6 }} />
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
              onPress={() => setHasClaustrophobia(!hasClaustrophobia)}
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
            </TouchableOpacity>

            {/* Câu 3: Bệnh thận eGFR */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                hasKidneyDisease ? styles.itemCardWarning : styles.itemCardDefault
              ]}
              onPress={() => setHasKidneyDisease(!hasKidneyDisease)}
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
            </TouchableOpacity>

            {/* Câu 4: Đang mang thai */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                isPregnant ? styles.itemCardPink : styles.itemCardDefault
              ]}
              onPress={() => setIsPregnant(!isPregnant)}
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
            </TouchableOpacity>

            {/* Ghi chú thêm */}
            <Text style={styles.fieldLabel}>Ghi chú rà soát an toàn của KTV:</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Ghi chú thêm về dụng cụ tháo rời (răng giả, trang sức kim loại đã tháo)..."
              value={safetyNotes}
              onChangeText={setSafetyNotes}
            />
          </ScrollView>

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnConfirm,
                { backgroundColor: hasPacemakerOrMetal ? '#DC2626' : '#15803D' }
              ]}
              onPress={onSubmit}
              disabled={submitting}
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
                    {hasPacemakerOrMetal ? 'Không Thể Cho Chụp' : 'Đạt An Toàn — Vào Buồng Chụp'}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  warningBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 },
  warningText: { color: '#92400E', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  itemCard: { padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  itemCardDefault: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  itemCardDanger: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  itemCardWarning: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  itemCardPink: { backgroundColor: '#FDF2F8', borderColor: '#DB2777' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxDanger: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  checkboxWarning: { backgroundColor: '#D97706', borderColor: '#D97706' },
  checkboxPink: { backgroundColor: '#DB2777', borderColor: '#DB2777' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  itemTitle: { fontSize: 13, fontWeight: 'bold' },
  itemDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  dangerAlertBox: { marginTop: 8, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6 },
  dangerAlertText: { color: '#DC2626', fontSize: 11, fontWeight: 'bold' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default MriSafetyCheckModal;
