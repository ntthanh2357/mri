import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, Image, Platform,
} from 'react-native';
import { get, put, post } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Config from '../constants/config';

const STATUS_CONFIG = {
  'đang chờ':       { color: '#FEF3C7', text: '#D97706', label: '⏳ Đang chờ' },
  'chờ khám bệnh':  { color: '#E0F2FE', text: '#0284C7', label: '🩺 Chờ khám bệnh' },
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

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [techNotes, setTechNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      get('/auth/me').then(r => { setUser(r.user); }).catch(() => {});
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
    // If roles are merged, the doctor is the technician.
    const assignedTechnicianId = user?._id || technicianId;
    
    if (!assignedTechnicianId) {
      Alert.alert('Thông báo', 'Không thể xác định người thực hiện (Lỗi phiên đăng nhập).');
      return;
    }
    if (!region) {
      Alert.alert('Thông báo', 'Vui lòng nhập vùng cần chụp.');
      return;
    }
    setMriLoading(true);
    try {
      await put(`/api/v1/visits/${selectedVisit._id}/mri-order`, {
        technicianId: assignedTechnicianId,
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

  const handleStartScan = async (visit) => {
    try {
      await put(`/api/v1/visits/${visit._id}/status`, { status: 'đang chụp' });
      fetchData();
    } catch (e) {
      if (Platform.OS === 'web') alert('Lỗi: ' + e.message);
      else Alert.alert('Lỗi', e.message);
    }
  };

  const openUploadModal = (visit) => {
    setActiveVisit(visit);
    setUploadedImages([]);
    setTechNotes('');
    setUploadModal(true);
  };

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
      if (Platform.OS === 'web') alert('Vui lòng tải lên ít nhất 1 ảnh phim chụp trước khi nộp.');
      else Alert.alert('Yêu cầu', 'Vui lòng tải lên ít nhất 1 ảnh phim chụp trước khi nộp.');
      return;
    }
    setSubmitting(true);
    try {
      await post('/api/v1/imaging-results', {
        visitId: activeVisit._id,
        patientId: activeVisit.patientId?._id,
        imageUrl: uploadedImages[0],          
        techNotes: techNotes.trim(),
        region: activeVisit.mriOrder?.region || '',
        requestAiAnalysis: activeVisit.mriOrder?.requestAiAnalysis || false,
      });

      if (Platform.OS === 'web') {
        alert('✅ Hoàn thành: Đã nộp ảnh phim chụp. Bác sĩ sẽ nhận thông báo đọc kết quả.');
        setUploadModal(false);
        fetchData();
      } else {
        Alert.alert(
          '✅ Hoàn thành',
          'Đã nộp ảnh phim chụp.',
          [{ text: 'Đóng', onPress: () => { setUploadModal(false); fetchData(); } }]
        );
      }
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi: ' + (err.message || 'Không thể nộp kết quả.'));
      else Alert.alert('Lỗi', err.message || 'Không thể nộp kết quả.');
    } finally {
      setSubmitting(false);
    }
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${Config.API_URL}${url}`;
  };

  const activeVisits = visits.filter(v => !['hoàn tất', 'đã đóng'].includes(v.status));
  const doneVisits = visits.filter(v => ['hoàn tất', 'đã đóng'].includes(v.status));

  const isNurse = user?.role === 'nurse' || user?.role === 'receptionist';

  const renderVisitCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['đang chờ'];
    const canOrderMri = v.status === 'đang khám';
    const canStartMri = v.status === 'chờ chụp';
    const canUploadMri = v.status === 'đang chụp';
    const hasReadResult = v.status === 'chờ bác sĩ đọc' || v.status === 'chờ kết quả AI';

    return (
      <View key={v._id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>
              {v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
            </Text>
            <Text style={styles.reason} numberOfLines={1}>📋 {v.reason || 'Khám tổng quát'} ({v.visitType || 'Ngoại trú'})</Text>
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

        {/* Actions - differ by role */}
        <View style={styles.actions}>
          {!isNurse && canOrderMri && (
            <TouchableOpacity style={styles.btnMri} onPress={() => openMriModal(v)}>
              <Text style={styles.btnMriText}>📷 Ra Y Lệnh MRI</Text>
            </TouchableOpacity>
          )}
          {!isNurse && canStartMri && (
            <TouchableOpacity style={[styles.btnStart, { backgroundColor: '#9333EA' }]} onPress={() => handleStartScan(v)}>
              <Text style={styles.btnStartText}>🔬 Bắt Đầu Chụp</Text>
            </TouchableOpacity>
          )}
          {!isNurse && canUploadMri && (
            <TouchableOpacity style={[styles.btnStart, { backgroundColor: '#7C3AED' }]} onPress={() => openUploadModal(v)}>
              <Text style={styles.btnStartText}>📤 Nộp Ảnh Phim</Text>
            </TouchableOpacity>
          )}
          {!isNurse && hasReadResult && (
            <TouchableOpacity
              style={styles.btnRead}
              onPress={() => {
                const rid = v.mriOrder?.imagingResultId;
                const ridStr = rid?._id ? rid._id.toString() : (rid ? rid.toString() : null);
                if (!ridStr) {
                  Alert.alert('Chưa có kết quả', 'Kỹ thuật viên chưa upload kết quả phim chụp cho ca khám này.');
                  return;
                }
                navigation.navigate('ImagingResult', {
                  visitId: v._id,
                  resultId: ridStr,
                  imagingResultId: ridStr,
                  activeRoute: 'DoctorWorkQueue',
                  visitStatus: v.status,
                });
              }}
            >
              <Text style={styles.btnReadText}>🔬 Đọc Kết Quả Phim</Text>
            </TouchableOpacity>
          )}
          {!isNurse && (v.status === 'đang chờ' || v.status === 'chờ khám bệnh') && (
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
          {!isNurse && v.status === 'đang khám' && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#3B82F6' }]}
                onPress={() => navigation.navigate('PatientDetail', { patientId: v.patientId?._id || v.patientId, visitId: v._id })}
              >
                <Text style={styles.btnStartText}>💊 Khám & Kê đơn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  Alert.alert(
                    'Kết thúc khám',
                    'Vui lòng chọn hướng điều trị cho bệnh nhân này:',
                    [
                      { 
                        text: 'Ngoại trú (Cấp toa)', 
                        onPress: async () => {
                          try {
                            await put(`/api/v1/visits/${v._id}/status`, { status: 'hoàn tất', visitType: 'Ngoại trú' });
                            fetchData();
                            Alert.alert('Thành công', 'Đã hoàn tất ca khám (Ngoại trú).');
                          } catch (e) { Alert.alert('Lỗi', e.message); }
                        }
                      },
                      { 
                        text: 'Nội trú (Nhập viện)', 
                        onPress: async () => {
                          try {
                            await put(`/api/v1/visits/${v._id}/status`, { status: 'hoàn tất', visitType: 'Nội trú' });
                            fetchData();
                            Alert.alert('Thành công', 'Đã hoàn tất ca khám và chỉ định Nhập viện (Nội trú).');
                          } catch (e) { Alert.alert('Lỗi', e.message); }
                        }
                      },
                      { text: 'Hủy', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Text style={styles.btnStartText}>✅ Kết thúc khám</Text>
              </TouchableOpacity>
            </View>
          )}
          {isNurse && v.status === 'đang chờ' && (
            <TouchableOpacity
              style={styles.btnStart}
              onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id } })}
            >
              <Text style={styles.btnStartText}>🩺 Nhập sinh hiệu</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const screenTitle = isNurse ? 'Hàng đợi đo sinh hiệu' : 'Hàng Đợi Khám';

  return (
    <ResponsiveLayout navigation={navigation} title={screenTitle} user={user} activeRoute="DoctorWorkQueue">
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
              Bệnh nhân: {selectedVisit?.patientId?.profile?.name || selectedVisit?.patientId?.profile?.fullName || selectedVisit?.patientId?.email}
            </Text>

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

      {/* Upload Modal */}
      <Modal visible={uploadModal} transparent animationType="slide" onRequestClose={() => setUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FAFAFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>📤 Nộp Ảnh Phim Chụp</Text>
              <TouchableOpacity onPress={() => setUploadModal(false)}>
                <Text style={{ fontSize: 20, color: '#94A3B8' }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 20, maxHeight: 500 }}>
              <Text style={styles.fieldLabel}>① Ảnh phim chụp <Text style={{ color: '#EF4444' }}>*</Text></Text>
              
              {uploadedImages.length > 0 && (
                <View style={styles.chipRow}>
                  {uploadedImages.map((url, idx) => (
                    <View key={idx} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                      <Image source={{ uri: getImageUrl(url) }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }} onPress={() => handleRemoveImage(idx)}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.textArea, { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, borderStyle: 'dashed', borderColor: '#C4B5FD', borderWidth: 2, marginTop: 10 }]}
                onPress={handlePickAndUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color="#7C3AED" />
                    <Text style={{ color: '#7C3AED', marginTop: 10 }}>Đang tải ảnh lên...</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 30 }}>🖼️</Text>
                    <Text style={{ color: '#7C3AED', fontWeight: 'bold', marginTop: 10 }}>Nhấn để chọn ảnh phim</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>② Ghi chú kỹ thuật (tuỳ chọn)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Nhập ghi chú..."
                multiline
                numberOfLines={3}
                value={techNotes}
                onChangeText={setTechNotes}
              />
            </ScrollView>
            
            <View style={[styles.modalBtns, { padding: 20, marginTop: 0, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setUploadModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, (uploadedImages.length === 0 || submitting) && { opacity: 0.5 }]}
                onPress={handleSubmitResult}
                disabled={uploadedImages.length === 0 || submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnConfirmText}>Nộp Kết Quả</Text>}
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
