import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { get, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';

const STATUS_CONFIG = {
  'đang chờ':       { color: '#FEF3C7', text: '#D97706', label: '⏳ Đang chờ' },
  'đang khám':      { color: '#DBEAFE', text: '#2563EB', label: '🩺 Đang khám' },
  'chờ chụp':       { color: '#FDE8FF', text: '#9333EA', label: '📷 Chờ chụp MRI' },
  'đang chụp':      { color: '#E0F2FE', text: '#0284C7', label: '🔬 Đang chụp' },
  'chờ kết quả AI': { color: '#FEF9C3', text: '#CA8A04', label: '🤖 Chờ AI' },
  'chờ bác sĩ đọc': { color: '#DCFCE7', text: '#15803D', label: '📋 Chờ đọc phim' },
  'hoàn tất':       { color: '#F0FDF4', text: '#166534', label: '✅ Hoàn tất' },
  'đã đóng':        { color: '#F1F5F9', text: '#64748B', label: '🔒 Đã đóng' },
};

const DoctorWorkQueueScreen = ({ navigation, route }) => {
  const [user, setUser] = useState(route?.params?.user || null);
  const [visits, setVisits] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'done'

  // MRI Order modal
  const [mriModal, setMriModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [technicianId, setTechnicianId] = useState('');
  const [region, setRegion] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requestAi, setRequestAi] = useState(true);
  const [mriLoading, setMriLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      get('/auth/me').then(r => setUser(r.user)).catch(() => {});
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [visitRes, staffRes] = await Promise.all([
        get('/api/v1/visits/my-queue'),
        get('/api/v1/visits/staff'),
      ]);
      setVisits(visitRes.visits || []);
      setTechnicians(staffRes.technicians || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openMriModal = (visit) => {
    setSelectedVisit(visit);
    setTechnicianId('');
    setRegion('');
    setInstructions('');
    setRequestAi(true);
    setMriModal(true);
  };

  const handleIssueMriOrder = async () => {
    if (!technicianId) {
      Alert.alert('Thông báo', 'Vui lòng chọn Kỹ thuật viên chụp MRI.');
      return;
    }
    if (!region) {
      Alert.alert('Thông báo', 'Vui lòng nhập vùng cần chụp.');
      return;
    }
    setMriLoading(true);
    try {
      await put(`/api/v1/visits/${selectedVisit._id}/mri-order`, {
        technicianId,
        region,
        instructions,
        requestAiAnalysis: requestAi,
      });
      Alert.alert('✅ Thành công', `Đã ra y lệnh chụp MRI và phân công KTV thực hiện.`);
      setMriModal(false);
      fetchData();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể ra y lệnh MRI');
    } finally {
      setMriLoading(false);
    }
  };

  const activeVisits = visits.filter(v => !['hoàn tất', 'đã đóng'].includes(v.status));
  const doneVisits = visits.filter(v => ['hoàn tất', 'đã đóng'].includes(v.status));

  const renderVisitCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['đang chờ'];
    const canOrderMri = v.status === 'đang khám';
    const hasReadResult = v.status === 'chờ bác sĩ đọc';

    return (
      <View key={v._id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>
              {v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
            </Text>
            <Text style={styles.reason} numberOfLines={1}>📋 {v.reason || 'Không có lý do'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.color }]}>
            <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Vitals */}
        {v.vitals?.bloodPressure && (
          <View style={styles.vitalsRow}>
            <Text style={styles.vitalsLabel}>🩺 Sinh hiệu:</Text>
            <Text style={styles.vitalsValue}>
              HA {v.vitals.bloodPressure} | Mạch {v.vitals.pulse} | SpO₂ {v.vitals.spo2}%
            </Text>
          </View>
        )}

        {/* MRI Order info */}
        {v.mriOrder?.region && (
          <View style={styles.mriInfo}>
            <Text style={styles.mriInfoText}>
              📷 Y lệnh MRI: <Text style={{ fontWeight: 'bold' }}>{v.mriOrder.region}</Text>
              {v.mriOrder.requestAiAnalysis ? ' · Yêu cầu AI phân tích' : ''}
            </Text>
          </View>
        )}

        {/* Nurse info */}
        <Text style={styles.subInfo}>
          👩‍⚕️ Điều dưỡng: {v.nurseId?.profile?.name || v.nurseId?.email || 'Đã phân công'}
        </Text>
        <Text style={styles.subInfo}>
          🕐 {new Date(v.createdAt).toLocaleString('vi-VN')}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          {canOrderMri && (
            <TouchableOpacity style={styles.btnMri} onPress={() => openMriModal(v)}>
              <Text style={styles.btnMriText}>📷 Ra Y Lệnh MRI</Text>
            </TouchableOpacity>
          )}
          {hasReadResult && (
            <TouchableOpacity
              style={styles.btnRead}
              onPress={() => navigation.navigate('ImagingResult', { visitId: v._id, resultId: v.mriOrder?.imagingResultId, imagingResultId: v.mriOrder?.imagingResultId })}
            >
              <Text style={styles.btnReadText}>🔬 Đọc Kết Quả Phim</Text>
            </TouchableOpacity>
          )}
          {v.status === 'đang chờ' && (
            <TouchableOpacity
              style={styles.btnStart}
              onPress={async () => {
                try {
                  await put(`/api/v1/visits/${v._id}/status`, { status: 'đang khám' });
                  fetchData();
                } catch (e) { Alert.alert('Lỗi', e.message); }
              }}
            >
              <Text style={styles.btnStartText}>🩺 Bắt đầu khám</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} title="Hàng Đợi Khám" user={user}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: 'queue', label: `Đang Xử Lý (${activeVisits.length})` },
          { key: 'done',  label: `Đã Hoàn Tất (${doneVisits.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#15803D" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {(activeTab === 'queue' ? activeVisits : doneVisits).map(renderVisitCard)}
          {(activeTab === 'queue' ? activeVisits : doneVisits).length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{activeTab === 'queue' ? '🎉' : '📂'}</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'queue' ? 'Không có ca khám đang chờ' : 'Chưa có ca hoàn tất'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* MRI Order Modal */}
      <Modal visible={mriModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📷 Ra Y Lệnh Chụp MRI</Text>
            <Text style={styles.modalSub}>
              Bệnh nhân: {selectedVisit?.patientId?.profile?.fullName || selectedVisit?.patientId?.email}
            </Text>

            {/* Chọn KTV */}
            <Text style={styles.fieldLabel}>Chọn Kỹ Thuật Viên *</Text>
            <View style={styles.chipRow}>
              {technicians.length === 0 && (
                <Text style={styles.noTechText}>⚠️ Không có KTV nào trong bệnh viện này</Text>
              )}
              {technicians.map(t => (
                <TouchableOpacity
                  key={t._id}
                  style={[styles.chip, technicianId === t._id && styles.chipActive]}
                  onPress={() => setTechnicianId(t._id)}
                >
                  <Text style={[styles.chipText, technicianId === t._id && styles.chipTextActive]}>
                    {t.profile?.name || t.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vùng chụp */}
            <Text style={styles.fieldLabel}>Vùng Chụp *</Text>
            <View style={styles.chipRow}>
              {['Não bộ', 'Tủy sống cổ', 'Tủy sống thắt lưng', 'Toàn thân'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, region === r && styles.chipActive]}
                  onPress={() => setRegion(r)}
                >
                  <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ghi chú */}
            <Text style={styles.fieldLabel}>Ghi chú cho KTV</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Lưu ý đặc biệt khi chụp, tư thế, độ tương phản..."
              multiline
              numberOfLines={3}
              value={instructions}
              onChangeText={setInstructions}
            />

            {/* Yêu cầu AI */}
            <TouchableOpacity style={styles.aiToggleRow} onPress={() => setRequestAi(v => !v)}>
              <View style={[styles.checkbox, requestAi && styles.checkboxChecked]}>
                {requestAi && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.aiToggleText}>🤖 Yêu cầu AI phân tích kết quả sau khi chụp</Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setMriModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleIssueMriOrder} disabled={mriLoading}>
                {mriLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmText}>Xác Nhận Ra Y Lệnh</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, margin: 16, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#15803D' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 2 },
  reason: { fontSize: 12, color: '#64748B' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  vitalsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  vitalsLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  vitalsValue: { fontSize: 12, color: '#0F172A' },
  mriInfo: { backgroundColor: '#F5F3FF', padding: 8, borderRadius: 8, marginBottom: 6 },
  mriInfoText: { fontSize: 12, color: '#7C3AED' },
  subInfo: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btnMri: { backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnMriText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnRead: { backgroundColor: '#0284C7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnReadText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnStart: { backgroundColor: '#15803D', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnStartText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  noTechText: { fontSize: 12, color: '#EF4444', fontStyle: 'italic' },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  aiToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#15803D', borderColor: '#15803D' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  aiToggleText: { fontSize: 13, color: '#334155', flex: 1 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default DoctorWorkQueueScreen;
