import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet
} from 'react-native';
import { RotateCcw } from 'lucide-react';

const RESCAN_REASONS = [
  'Nhiễu ảnh chuyển động (Motion Artifact)',
  'Bệnh nhân cử động đầu nhiều',
  'Chưa bao phủ hết vùng tổn thương',
  'Độ tương phản lát cắt không đạt',
];

/**
 * Component: Modal Yêu cầu Chụp lại MRI do nhiễu ảnh
 */
const MriRescanModal = ({
  visible,
  onClose,
  patientName,
  rescanReason,
  setRescanReason,
  onConfirm,
  submitting
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <RotateCcw size={20} color="#C2410C" style={{ marginRight: 8 }} />
            <Text style={[styles.modalTitle, { color: '#C2410C', marginBottom: 0 }]}>Yêu Cầu Chụp Lại Phim MRI</Text>
          </View>
          <Text style={styles.modalSub}>
            Bệnh nhân: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{patientName || 'Bệnh nhân'}</Text>
          </Text>

          <Text style={styles.fieldLabel}>Chọn lý do chuyên môn cần chụp lại:</Text>
          <View style={styles.chipRow}>
            {RESCAN_REASONS.map((reasonText) => (
              <TouchableOpacity
                key={reasonText}
                style={[
                  styles.chip,
                  rescanReason === reasonText && { backgroundColor: '#EA580C', borderColor: '#EA580C' }
                ]}
                onPress={() => setRescanReason(reasonText)}
              >
                <Text style={[styles.chipText, rescanReason === reasonText && { color: '#fff' }]}>
                  {reasonText}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Chi tiết lý do kỹ thuật:</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Nhập chi tiết lỗi kỹ thuật hoặc lý do chuyên môn..."
            multiline
            numberOfLines={3}
            value={rescanReason}
            onChangeText={setRescanReason}
          />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: '#EA580C' }]}
              onPress={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={16} color="#fff" />
                  <Text style={styles.btnConfirmText}>Xác Nhận Chụp Lại</Text>
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
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default MriRescanModal;
