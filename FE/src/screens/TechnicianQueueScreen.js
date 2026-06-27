import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, Image, Platform,
} from 'react-native';
import { get, put, post } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Config from '../constants/config';

const STATUS_CONFIG = {
  'chờ chụp':       { color: '#FDE8FF', text: '#9333EA', label: '📷 Chờ chụp', step: 1 },
  'đang chụp':      { color: '#E0F2FE', text: '#0284C7', label: '🔬 Đang chụp', step: 2 },
  'chờ kết quả AI': { color: '#FEF9C3', text: '#CA8A04', label: '🤖 Đang phân tích AI', step: 3 },
  'chờ bác sĩ đọc': { color: '#DCFCE7', text: '#15803D', label: '✅ Chờ bác sĩ đọc', step: 4 },
  'hoàn tất':       { color: '#F0FDF4', text: '#166534', label: '✔️ Hoàn tất', step: 5 },
};

const TechnicianQueueScreen = ({ navigation, route }) => {
  const [user, setUser] = useState(route?.params?.user || null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [techNotes, setTechNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      if (Platform.OS === 'web') {
        alert('Lỗi: ' + e.message);
      } else {
        Alert.alert('Lỗi', e.message);
      }
    }
  };

  const openUploadModal = (visit) => {
    setActiveVisit(visit);
    setUploadedImages([]);
    setTechNotes('');
    setUploadModal(true);
  };

  // ── File picker & upload (web) ──
  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePickAndUpload = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Hỗ trợ', 'Tính năng chọn file ảnh hiện chỉ hỗ trợ trên trình duyệt Web.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      if (uploadedImages.length + files.length > 5) {
        alert('Tối đa 5 ảnh phim chụp mỗi lần nộp.');
        return;
      }

      setUploading(true);
      const results = [...uploadedImages];
      for (const file of files) {
        try {
          const fileData = await readFileAsBase64(file);
          const res = await post('/api/v1/imaging/upload', {
            fileData,
            fileName: file.name,
            imagingType: 'MRI',
          });
          if (res.success && res.data?.imageUrl) {
            results.push(res.data.imageUrl);
          } else {
            alert(`Tải ảnh "${file.name}" thất bại: ${res.message || 'Lỗi không xác định'}`);
          }
        } catch (err) {
          alert(`Lỗi khi upload "${file.name}": ${err.message}`);
        }
      }
      setUploadedImages(results);
      setUploading(false);
    };
    input.click();
  };

  const handleRemoveImage = (idx) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitResult = async () => {
    if (uploadedImages.length === 0) {
      if (Platform.OS === 'web') {
        alert('Vui lòng tải lên ít nhất 1 ảnh phim chụp trước khi nộp.');
      } else {
        Alert.alert('Yêu cầu', 'Vui lòng tải lên ít nhất 1 ảnh phim chụp trước khi nộp.');
      }
      return;
    }
    setSubmitting(true);
    try {
      await post('/api/v1/imaging-results', {
        visitId: activeVisit._id,
        patientId: activeVisit.patientId?._id,
        imageUrl: uploadedImages[0],          // primary image
        techNotes: techNotes.trim(),
        region: activeVisit.mriOrder?.region || '',
        requestAiAnalysis: activeVisit.mriOrder?.requestAiAnalysis || false,
      });

      if (Platform.OS === 'web') {
        alert('✅ Hoàn thành: Đã nộp ảnh phim chụp. Bác sĩ sẽ nhận thông báo đọc kết quả.');
        setUploadModal(false);
        fetchQueue();
      } else {
        Alert.alert(
          '✅ Hoàn thành',
          'Đã nộp ảnh phim chụp. Bác sĩ sẽ nhận thông báo đọc kết quả.',
          [{ text: 'Đóng', onPress: () => { setUploadModal(false); fetchQueue(); } }]
        );
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        alert('Lỗi: ' + (err.message || 'Không thể nộp kết quả. Vui lòng thử lại.'));
      } else {
        Alert.alert('Lỗi', err.message || 'Không thể nộp kết quả. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${Config.API_URL}${url}`;
  };

  const renderCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['chờ chụp'];
    const canStart  = v.status === 'chờ chụp';
    const canUpload = v.status === 'đang chụp';
    const hasResult = v.mriOrder?.imagingResultId;
    const canView   = (v.status === 'chờ kết quả AI' || v.status === 'chờ bác sĩ đọc' || v.status === 'hoàn tất') && hasResult;

    return (
      <View key={v._id} style={styles.card}>
        {/* ── Status bar ── */}
        <View style={[styles.statusBar, { backgroundColor: cfg.color }]}>
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          <Text style={[styles.statusTime, { color: cfg.text }]}>
            {new Date(v.updatedAt).toLocaleString('vi-VN')}
          </Text>
        </View>

        <View style={styles.cardBody}>
          {/* ── Patient info ── */}
          <View style={styles.row}>
            <Text style={styles.icon}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
              </Text>
              <Text style={styles.sub}>Lý do: {v.reason}</Text>
            </View>
          </View>

          {/* ── MRI Order ── */}
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
          </View>

          <Text style={styles.subInfo}>
            🩺 Bác sĩ chỉ định: {v.doctorId?.profile?.name || v.doctorId?.email || '—'}
          </Text>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            {canStart && (
              <TouchableOpacity style={styles.btnStart} onPress={() => handleStartScan(v)}>
                <Text style={styles.btnStartText}>🔬 Bắt Đầu Chụp</Text>
              </TouchableOpacity>
            )}
            {canUpload && (
              <TouchableOpacity style={styles.btnUpload} onPress={() => openUploadModal(v)}>
                <Text style={styles.btnUploadText}>📤 Nộp Ảnh Phim</Text>
              </TouchableOpacity>
            )}
            {canView && (
              <TouchableOpacity
                style={styles.btnRead}
                onPress={() => {
                  const rid = v.mriOrder.imagingResultId;
                  const ridStr = rid?._id ? rid._id.toString() : rid.toString();
                  navigation.navigate('ImagingResult', {
                    visitId: v._id,
                    resultId: ridStr,
                    imagingResultId: ridStr,
                    activeRoute: 'TechnicianQueue',
                    visitStatus: v.status,
                  });
                }}
              >
                <Text style={styles.btnReadText}>👁️ Xem Kết Quả</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} title="Hàng Đợi Chụp MRI" user={user} activeRoute="TechnicianQueue">
      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Chờ chụp',   color: '#9333EA', count: visits.filter(v => v.status === 'chờ chụp').length },
          { label: 'Đang chụp',  color: '#0284C7', count: visits.filter(v => v.status === 'đang chụp').length },
          { label: 'Hoàn thành', color: '#15803D', count: visits.filter(v => v.status === 'chờ bác sĩ đọc' || v.status === 'chờ kết quả AI').length },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
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

      {/* ═══════════════════════════════════════════════
          UPLOAD BOTTOM SHEET  — redesigned flow
          Step 1: thông tin ca → Step 2: upload ảnh → Step 3: nộp
      ═══════════════════════════════════════════════ */}
      <Modal visible={uploadModal} transparent animationType="slide" onRequestClose={() => setUploadModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>📤 Nộp Ảnh Phim Chụp</Text>
                <Text style={styles.sheetSub}>
                  {activeVisit?.patientId?.profile?.name || activeVisit?.patientId?.email}
                  {activeVisit?.mriOrder?.region ? ` · ${activeVisit.mriOrder.region}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setUploadModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* AI notice */}
              {activeVisit?.mriOrder?.requestAiAnalysis && (
                <View style={styles.aiNotice}>
                  <Text style={styles.aiNoticeText}>
                    🤖 Sau khi nộp, hệ thống AI sẽ tự động phân tích kết quả và thông báo cho bác sĩ.
                  </Text>
                </View>
              )}

              {/* ── Step 1: Upload images ── */}
              <Text style={styles.stepLabel}>① Ảnh phim chụp <Text style={{ color: '#EF4444' }}>*</Text></Text>

              {/* Preview grid */}
              {uploadedImages.length > 0 && (
                <View style={styles.previewGrid}>
                  {uploadedImages.map((url, idx) => (
                    <View key={idx} style={styles.previewItem}>
                      <Image
                        source={{ uri: getImageUrl(url) }}
                        style={styles.previewImg}
                        resizeMode="cover"
                      />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveImage(idx)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                      {idx === 0 && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Chính</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Drop zone / pick button */}
              <TouchableOpacity
                style={[styles.dropZone, uploading && { opacity: 0.6 }]}
                onPress={handlePickAndUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color="#7C3AED" />
                    <Text style={styles.dropZoneText}>Đang tải ảnh lên...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.dropZoneIcon}>🖼️</Text>
                    <Text style={styles.dropZoneText}>
                      {uploadedImages.length === 0
                        ? 'Nhấn để chọn ảnh MRI / CT-Scan'
                        : '+ Thêm ảnh khác (tối đa 5)'}
                    </Text>
                    <Text style={styles.dropZoneSub}>PNG, JPG, JPEG được hỗ trợ</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* ── Step 2: Tech notes ── */}
              <Text style={[styles.stepLabel, { marginTop: 16 }]}>② Ghi chú kỹ thuật <Text style={{ color: '#94A3B8', fontWeight: '400' }}>(tuỳ chọn)</Text></Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Chất lượng hình ảnh, nhiễu, tư thế bệnh nhân, ghi chú đặc biệt..."
                multiline
                numberOfLines={3}
                value={techNotes}
                onChangeText={setTechNotes}
                placeholderTextColor="#9CA3AF"
              />

              {/* Upload count info */}
              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  {uploadedImages.length > 0
                    ? `✅ ${uploadedImages.length} ảnh đã tải lên`
                    : '⚠️ Chưa có ảnh nào'}
                </Text>
                <Text style={styles.countHint}>Tối đa 5 ảnh</Text>
              </View>
            </ScrollView>

            {/* ── Action buttons ── */}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setUploadModal(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (uploadedImages.length === 0 || submitting) && styles.submitBtnDisabled
                ]}
                onPress={handleSubmitResult}
                disabled={uploadedImages.length === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    ✔️ Nộp Kết Quả Phim
                  </Text>
                )}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  statNum: { fontSize: 28, fontWeight: 'bold', color: '#9333EA' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  list: { padding: 16, gap: 14 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btnStart: { flex: 1, backgroundColor: '#0284C7', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnStartText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnUpload: { flex: 1, backgroundColor: '#7C3AED', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnUploadText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnRead: { flex: 1, backgroundColor: '#15803D', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnReadText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyText: { fontSize: 16, color: '#94A3B8', fontWeight: '500' },
  refreshBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#7C3AED', borderRadius: 20 },
  refreshText: { color: '#fff', fontWeight: 'bold' },

  // ── Upload Sheet ──
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  sheetSub: { fontSize: 13, color: '#7C3AED', fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 18, color: '#94A3B8', fontWeight: 'bold' },

  aiNotice: { backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiNoticeText: { fontSize: 12, color: '#92400E', lineHeight: 18, flex: 1 },

  stepLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },

  // Image preview grid
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  previewItem: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  previewImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  primaryBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(124,58,237,0.85)', paddingVertical: 3, alignItems: 'center',
  },
  primaryBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Drop zone
  dropZone: {
    borderWidth: 2, borderColor: '#C4B5FD', borderStyle: 'dashed',
    borderRadius: 14, padding: 20, alignItems: 'center',
    backgroundColor: '#FAFAFF', gap: 6, marginBottom: 4,
  },
  dropZoneIcon: { fontSize: 30, marginBottom: 4 },
  dropZoneText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  dropZoneSub: { fontSize: 11, color: '#94A3B8' },

  notesInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, fontSize: 13, color: '#0F172A',
    minHeight: 80, textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },

  countRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  countText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  countHint: { fontSize: 11, color: '#94A3B8' },

  // Sheet action buttons
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  submitBtn: {
    flex: 2, height: 50, borderRadius: 14,
    backgroundColor: '#7C3AED',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#C4B5FD', shadowOpacity: 0 },
  submitBtnText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default TechnicianQueueScreen;
