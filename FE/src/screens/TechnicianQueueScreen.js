import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { get, put, post } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';

const STATUS_CONFIG = {
  'chờ chụp':       { color: '#FDE8FF', text: '#9333EA', label: '📷 Chờ chụp' },
  'đang chụp':      { color: '#E0F2FE', text: '#0284C7', label: '🔬 Đang chụp' },
  'chờ kết quả AI': { color: '#FEF9C3', text: '#CA8A04', label: '🤖 Đang phân tích AI' },
  'chờ bác sĩ đọc': { color: '#DCFCE7', text: '#15803D', label: '✅ Chờ bác sĩ đọc' },
};

const TechnicianQueueScreen = ({ navigation, route }) => {
  const [user, setUser] = useState(route?.params?.user || null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload modal
  const [uploadModal, setUploadModal] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) get('/auth/me').then(r => setUser(r.user)).catch(() => {});
  }, []);

  useEffect(() => { fetchQueue(); }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/visits/my-queue');
      setVisits(res.visits || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = async (visit) => {
    try {
      await put(`/api/v1/visits/${visit._id}/status`, { status: 'đang chụp' });
      fetchQueue();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
  };

  const openUploadModal = (visit) => {
    setActiveVisit(visit);
    setImageUrl('');
    setTechNotes('');
    setUploadModal(true);
  };

  const handleUploadResult = async () => {
    if (!imageUrl.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đường dẫn hoặc mã kết quả phim chụp.');
      return;
    }
    setUploading(true);
    try {
      // Create imaging result
      await post('/api/v1/imaging-results', {
        visitId: activeVisit._id,
        patientId: activeVisit.patientId?._id,
        imageUrl: imageUrl.trim(),
        techNotes: techNotes.trim(),
        region: activeVisit.mriOrder?.region || '',
        requestAiAnalysis: activeVisit.mriOrder?.requestAiAnalysis || false,
      });
      // Update visit status
      await put(`/api/v1/visits/${activeVisit._id}/status`, {
        status: activeVisit.mriOrder?.requestAiAnalysis ? 'chờ kết quả AI' : 'chờ bác sĩ đọc',
      });
      Alert.alert('✅ Thành công', 'Đã upload kết quả phim chụp. Bác sĩ sẽ xem xét kết quả.');
      setUploadModal(false);
      fetchQueue();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể upload kết quả');
    } finally {
      setUploading(false);
    }
  };

  const renderCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['chờ chụp'];
    const canStart = v.status === 'chờ chụp';
    const canUpload = v.status === 'đang chụp';

    return (
      <View key={v._id} style={styles.card}>
        {/* Status bar */}
        <View style={[styles.statusBar, { backgroundColor: cfg.color }]}>
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          <Text style={[styles.statusTime, { color: cfg.text }]}>
            {new Date(v.updatedAt).toLocaleString('vi-VN')}
          </Text>
        </View>

        <View style={styles.cardBody}>
          {/* Patient info */}
          <View style={styles.row}>
            <Text style={styles.icon}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
              </Text>
              <Text style={styles.sub}>Lý do: {v.reason}</Text>
            </View>
          </View>

          {/* MRI Order details */}
          <View style={styles.orderBox}>
            <Text style={styles.orderTitle}>📋 Chỉ Định Từ Bác Sĩ</Text>
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderLabel}>Vùng chụp:</Text>
              <Text style={styles.orderValue}>{v.mriOrder?.region || 'Não bộ'}</Text>
            </View>
            {v.mriOrder?.instructions ? (
              <View style={styles.orderDetailRow}>
                <Text style={styles.orderLabel}>Ghi chú:</Text>
                <Text style={styles.orderValue}>{v.mriOrder.instructions}</Text>
              </View>
            ) : null}
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderLabel}>AI phân tích:</Text>
              <Text style={[styles.orderValue, { color: v.mriOrder?.requestAiAnalysis ? '#15803D' : '#94A3B8' }]}>
                {v.mriOrder?.requestAiAnalysis ? '✅ Có yêu cầu AI' : '— Không yêu cầu'}
              </Text>
            </View>
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderLabel}>Ra lệnh lúc:</Text>
              <Text style={styles.orderValue}>
                {v.mriOrder?.orderedAt ? new Date(v.mriOrder.orderedAt).toLocaleString('vi-VN') : '—'}
              </Text>
            </View>
          </View>

          {/* Doctor */}
          <Text style={styles.subInfo}>
            🩺 Bác sĩ chỉ định: {v.doctorId?.profile?.name || v.doctorId?.email || '—'}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {canStart && (
              <TouchableOpacity style={styles.btnStart} onPress={() => handleStartScan(v)}>
                <Text style={styles.btnStartText}>🔬 Bắt Đầu Chụp</Text>
              </TouchableOpacity>
            )}
            {canUpload && (
              <TouchableOpacity style={styles.btnUpload} onPress={() => navigation.navigate('CreateImagingResult', { visit: v })}>
                <Text style={styles.btnUploadText}>📤 Upload Kết Quả</Text>
              </TouchableOpacity>
            )}
            {(v.status === 'chờ kết quả AI' || v.status === 'chờ bác sĩ đọc' || v.status === 'hoàn tất') && v.mriOrder?.imagingResultId && (
              <TouchableOpacity
                style={styles.btnRead}
                onPress={() => navigation.navigate('ImagingResult', {
                  visitId: v._id,
                  resultId: v.mriOrder.imagingResultId,
                  imagingResultId: v.mriOrder.imagingResultId,
                  activeRoute: 'TechnicianQueue'
                })}
              >
                <Text style={styles.btnReadText}>👁️ Xem kết quả phim</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} title="Hàng Đợi Chụp MRI" user={user} activeRoute="TechnicianQueue">
      {/* Header stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{visits.filter(v => v.status === 'chờ chụp').length}</Text>
          <Text style={styles.statLabel}>Chờ chụp</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#0284C7' }]}>{visits.filter(v => v.status === 'đang chụp').length}</Text>
          <Text style={styles.statLabel}>Đang chụp</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#15803D' }]}>{visits.filter(v => v.status === 'chờ bác sĩ đọc').length}</Text>
          <Text style={styles.statLabel}>Hoàn thành</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visits.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyText}>Không có ca chụp nào được phân công</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchQueue}>
                <Text style={styles.refreshText}>Làm mới</Text>
              </TouchableOpacity>
            </View>
          ) : (
            visits.map(renderCard)
          )}
        </ScrollView>
      )}

      {/* Upload Modal */}
      <Modal visible={uploadModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📤 Upload Kết Quả Phim Chụp</Text>
            <Text style={styles.modalSub}>
              {activeVisit?.patientId?.profile?.name || activeVisit?.patientId?.profile?.fullName || activeVisit?.patientId?.email}
              {' · '}{activeVisit?.mriOrder?.region}
            </Text>

            <Text style={styles.fieldLabel}>Đường dẫn / Mã phim chụp *</Text>
            <TextInput
              style={styles.input}
              placeholder="https://storage.example.com/mri/... hoặc mã PACS"
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Ghi chú kỹ thuật</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Chất lượng hình ảnh, nhiễu loạn, tư thế bệnh nhân..."
              multiline
              value={techNotes}
              onChangeText={setTechNotes}
            />

            {activeVisit?.mriOrder?.requestAiAnalysis && (
              <View style={styles.aiNotice}>
                <Text style={styles.aiNoticeText}>
                  🤖 Sau khi upload, hệ thống AI sẽ tự động phân tích kết quả và thông báo cho bác sĩ.
                </Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setUploadModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleUploadResult} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmText}>📤 Hoàn Thành Chụp</Text>
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
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  statNum: { fontSize: 28, fontWeight: 'bold', color: '#9333EA' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  list: { padding: 16, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  statusBar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 13, fontWeight: 'bold' },
  statusTime: { fontSize: 11 },
  cardBody: { padding: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  icon: { fontSize: 20, marginTop: 1 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 2 },
  sub: { fontSize: 12, color: '#64748B' },
  orderBox: { backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginBottom: 10 },
  orderTitle: { fontSize: 13, fontWeight: 'bold', color: '#7C3AED', marginBottom: 8 },
  orderDetailRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  orderLabel: { fontSize: 12, color: '#6B7280', width: 100 },
  orderValue: { fontSize: 12, color: '#111827', fontWeight: '500', flex: 1 },
  subInfo: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnStart: { flex: 1, backgroundColor: '#0284C7', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnStartText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnUpload: { flex: 1, backgroundColor: '#15803D', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnUploadText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnRead: { flex: 1, backgroundColor: '#8B5CF6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnReadText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyText: { fontSize: 16, color: '#94A3B8', fontWeight: '500' },
  refreshBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#7C3AED', borderRadius: 20 },
  refreshText: { color: '#fff', fontWeight: 'bold' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#7C3AED', fontWeight: '600', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC' },
  aiNotice: { backgroundColor: '#FEF9C3', padding: 10, borderRadius: 8, marginTop: 10 },
  aiNoticeText: { fontSize: 12, color: '#92400E' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, backgroundColor: '#15803D', justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
});

export default TechnicianQueueScreen;
