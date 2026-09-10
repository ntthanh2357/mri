import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet
} from 'react-native';
import { XCircle, X } from 'lucide-react';

const CANCEL_REASONS = [
  'Phát hiện máy tạo nhịp tim / Kim loại từ tính',
  'Hội chứng sợ buồng kín, bệnh nhân hoảng loạn',
  'Bệnh nhân từ chối thực hiện / Bỏ về',
  'Dị ứng thuốc đối quang từ / Sốc phản vệ',
];

/**
 * Component: Modal Hủy ca chụp MRI
 */
const MriCancelModal = ({
  visible,
  onClose,
  patientName,
  cancelReason,
  setCancelReason,
  onConfirm,
  submitting
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <XCircle size={22} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={[styles.modalTitle, { color: '#B91C1C', marginBottom: 0 }]}>Hủy Ca Chụp MRI</Text>
          </View>
          <Text style={styles.modalSub}>
            Bệnh nhân: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{patientName || 'Bệnh nhân'}</Text>
          </Text>

          <Text style={styles.fieldLabel}>Chọn lý do hủy ca chụp:</Text>
          <View style={styles.chipRow}>
            {CANCEL_REASONS.map((reasonText) => (
              <TouchableOpacity
                key={reasonText}
                style={[
                  styles.chip,
                  cancelReason === reasonText && { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                ]}
                onPress={() => setCancelReason(reasonText)}
              >
                <Text style={[styles.chipText, cancelReason === reasonText && { color: '#fff' }]}>
                  {reasonText}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Ghi chú chi tiết nguyên nhân hủy:</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: '#FFFFFF' }]}
            placeholder="Nhập lý do hủy cụ thể để lưu hồ sơ bệnh án..."
            multiline
            numberOfLines={3}
            value={cancelReason}
            onChangeText={setCancelReason}
          />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: '#DC2626' }]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <X size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.btnConfirmText}>Xác Nhận Hủy Ca</Text>
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
  modalBox: { backgroundColor: '#FFF5F5', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%', borderColor: '#FECACA', borderWidth: 1.5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#B91C1C', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#FFFFFF' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default MriCancelModal;
