import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { usePatientRecords } from '../controllers/usePatientRecords';

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_META = {
  nhom1: { label: 'Nhóm 1 — Hành chính & Tài chính', icon: '🗂️', color: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  nhom2: { label: 'Nhóm 2 — Lâm sàng', icon: '🩺', color: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  nhom3: { label: 'Nhóm 3 — Cận lâm sàng', icon: '🔬', color: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  nhom5: { label: 'Nhóm 5 — Pháp lý / Có chữ ký', icon: '📝', color: '#FDF4FF', border: '#E9D5FF', text: '#7C3AED' },
};


const ALL_DOCS = {
  nhom1: [
    { docKey: 'mau_kham_benh', label: 'Phiếu thông tin khám bệnh' },
    { docKey: 'phieu_thu_vien_phi', label: 'Phiếu thu viện phí' },
    { docKey: 'tom_tat_hsba', label: 'Tóm tắt hồ sơ bệnh án' },
  ],
  nhom2: [
    { docKey: 'phieu_chi_dinh', label: 'Phiếu chỉ định dịch vụ' },
    { docKey: 'toa_thuoc', label: 'Toa thuốc' },
    { docKey: 'giay_ra_vien', label: 'Giấy ra viện' },
    { docKey: 'chuyen_tuyen', label: 'Phiếu chuyển tuyến TT01' },
  ],
  nhom3: [
    { docKey: 'xet_nghiem_mau', label: 'Kết quả XN huyết học' },
    { docKey: 'hoa_sinh', label: 'Kết quả hóa sinh máu' },
    { docKey: 'ct_scan', label: 'Kết quả CT-Scan' },
    { docKey: 'mri', label: 'Kết quả MRI' },
  ],
  nhom5: [
    { docKey: 'cam_ket_phau_thuat', label: 'Cam kết chấp thuận phẫu thuật' },
  ],
};

// ── Components ────────────────────────────────────────────────────────────────

const DocCard = ({ slot, savedDocs = [], onPress, onDelete }) => {
  const hasSaved = savedDocs.length > 0;
  const firstDoc = savedDocs[0];
  const uploadCount = savedDocs.filter((d) => d.storageType === 'upload').length;
  const hasManual = savedDocs.some((d) => d.storageType === 'manual');

  const statusText = () => {
    if (!hasSaved) return 'Chưa có — nhấn để thêm';
    const parts = [];
    if (uploadCount > 0) parts.push(`${uploadCount} file`);
    if (hasManual) parts.push('Đã điền tay');
    return parts.join(' · ');
  };

  return (
    <TouchableOpacity
      style={[styles.docCard, hasSaved ? styles.docCardHas : styles.docCardMissing]}
      onPress={() => onPress(slot, savedDocs)}
    >
      <View style={styles.docCardLeft}>
        <Text style={styles.docIcon}>
          {!hasSaved ? '📤' : uploadCount > 0 ? '📎' : '📋'}
        </Text>
        <View style={styles.docInfo}>
          <Text style={[styles.docLabel, !hasSaved && styles.docLabelMissing]} numberOfLines={2}>
            {slot.label}
          </Text>
          <Text style={hasSaved ? styles.docStatusHas : styles.docStatusMissing}>
            {statusText()}
          </Text>
        </View>
      </View>
      {hasSaved && savedDocs.length > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{savedDocs.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const VisitCard = ({ visit, expanded, onToggle, onDocPress, onDeleteDoc, onDelete }) => {
  const [expandedGroups, setExpandedGroups] = useState({ nhom1: true, nhom2: false, nhom3: false, nhom5: false });

  // savedMap: docKey → array of docs (multiple files per slot)
  const savedMap = {};
  (visit.documents || []).forEach((d) => {
    if (!savedMap[d.docKey]) savedMap[d.docKey] = [];
    savedMap[d.docKey].push(d);
  });

  const totalSlots = Object.values(ALL_DOCS).flat().length;
  const savedCount = Object.keys(savedMap).length;
  const visitDate = visit.date ? new Date(visit.date).toLocaleDateString('vi-VN') : '';

  // Fetch records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await get(`/emr/records?search=${encodeURIComponent(search)}`);
      if (res.status === 'success') {
        setRecords(res.data);
      }
    } catch (error) {
      console.error('Fetch records error:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hồ sơ bệnh án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [search]);

  // Fetch sub-documents when record or tab changes
  useEffect(() => {
    if (!selectedRecord) return;
    
    const fetchSubData = async () => {
      setSubLoading(true);
      try {
        if (activeTab === 'care') {
          const res = await get(`/emr/records/${selectedRecord._id}/care-sheets`);
          if (res.status === 'success') setCareSheets(res.data);
        } else if (activeTab === 'consult') {
          const res = await get(`/emr/records/${selectedRecord._id}/consultations`);
          if (res.status === 'success') setConsultations(res.data);
        } else if (activeTab === 'consent') {
          const res = await get(`/emr/records/${selectedRecord._id}/consents`);
          if (res.status === 'success') setConsents(res.data);
        }
      } catch (error) {
        console.error('Fetch sub-data error:', error);
      } finally {
        setSubLoading(false);
      }
    };

    fetchSubData();
  }, [selectedRecord, activeTab]);

  // Handle Create Medical Record
  const handleCreateRecord = async () => {
    if (!newRecord.patientId || !newRecord.patientName || !newRecord.age || !newRecord.diagnosis) {
      Alert.alert('Thông báo', 'Vui lòng điền các thông tin bắt buộc.');
      return;
    }

    try {
      const res = await post('/emr/records', {
        ...newRecord,
        age: parseInt(newRecord.age),
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã tạo hồ sơ bệnh án mới.');
        setShowAddRecordModal(false);
        setNewRecord({
          patientId: '',
          patientName: '',
          gender: 'Nam',
          age: '',
          bhytNumber: '',
          admissionType: 'Ngoại trú',
          department: 'Khoa Nội Thần Kinh',
          paymentMethod: 'Viện phí',
          diagnosis: '',
          treatmentPlan: '',
          doctorInCharge: 'Bs. Gia Huy',
        });
        fetchRecords();
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo bệnh án mới.');
    }
  };

  // Handle Create Care Sheet
  const handleCreateCare = async () => {
    if (!newCare.pulse || !newCare.bloodPressure || !newCare.temperature || !newCare.respiratoryRate || !newCare.spo2 || !newCare.progressNotes) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ các chỉ số sinh hiệu.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/care-sheets`, {
        careLevel: parseInt(newCare.careLevel),
        pulse: parseInt(newCare.pulse),
        bloodPressure: newCare.bloodPressure,
        temperature: parseFloat(newCare.temperature),
        respiratoryRate: parseInt(newCare.respiratoryRate),
        spo2: parseInt(newCare.spo2),
        progressNotes: newCare.progressNotes,
        careActions: newCare.careActions,
        nurse: newCare.nurse,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã lưu phiếu chăm sóc.');
        setShowAddCareModal(false);
        setNewCare({
          careLevel: 3,
          pulse: '',
          bloodPressure: '',
          temperature: '',
          respiratoryRate: '',
          spo2: '',
          progressNotes: '',
          careActions: '',
          nurse: 'Đd. Minh Anh',
        });
        // Reload care sheets list
        const resList = await get(`/emr/records/${selectedRecord._id}/care-sheets`);
        if (resList.status === 'success') setCareSheets(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo phiếu chăm sóc.');
    }
  };

  // Handle Create Consultation
  const handleCreateConsult = async () => {
    if (!newConsult.participants || !newConsult.clinicalSummary || !newConsult.diagnosis || !newConsult.treatmentConclusion) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin hội chẩn.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/consultations`, {
        participants: newConsult.participants.split(',').map(p => p.trim()),
        clinicalSummary: newConsult.clinicalSummary,
        diagnosis: newConsult.diagnosis,
        treatmentConclusion: newConsult.treatmentConclusion,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã lưu biên bản hội chẩn.');
        setShowAddConsultModal(false);
        setNewConsult({
          participants: '',
          clinicalSummary: '',
          diagnosis: '',
          treatmentConclusion: '',
        });
        // Reload list
        const resList = await get(`/emr/records/${selectedRecord._id}/consultations`);
        if (resList.status === 'success') setConsultations(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo biên bản hội chẩn.');
    }
  };

  // Handle Create Consent
  const handleCreateConsent = async () => {
    if (!newConsent.procedureName) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên phẫu thuật/thủ thuật.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/consents`, newConsent);

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã tạo giấy cam đoan phẫu thuật/thủ thuật.');
        setShowAddConsentModal(false);
        setNewConsent({
          procedureName: '',
          risks: 'Chảy máu, nhiễm trùng vết mổ, tai biến do gây mê/gây tê, tử vong tỷ lệ thấp.',
          doctorExplanation: 'Phẫu thuật/thủ thuật được chỉ định nhằm điều trị hoặc hỗ trợ chẩn đoán chính xác tình trạng bệnh lý hiện tại.',
        });
        // Reload list
        const resList = await get(`/emr/records/${selectedRecord._id}/consents`);
        if (resList.status === 'success') setConsents(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo giấy cam đoan.');
    }
  };

  // Handle Sign Consent
  const handleSignConsent = async (consentId, role, signatureName) => {
    try {
      const res = await put(`/emr/consents/${consentId}/sign`, {
        role,
        signature: signatureName,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã thực hiện ký số xác nhận.');
        // Reload consents
        const resList = await get(`/emr/records/${selectedRecord._id}/consents`);
        if (resList.status === 'success') setConsents(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể thực hiện ký duyệt.');
    }
  };

  // Handle Update Record SignStatus / Status
  const handleUpdateRecordStatus = async (updates) => {
    try {
      const res = await put(`/emr/records/${selectedRecord._id}`, updates);
      if (res.status === 'success') {
        setSelectedRecord(res.data);
        Alert.alert('Thành công', 'Đã cập nhật trạng thái hồ sơ bệnh án.');
        fetchRecords();
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ.');
    }
  };

  const getCareBadgeColor = (level) => {
    if (level === 1) return { bg: '#FEE2E2', text: '#EF4444' };
    if (level === 2) return { bg: '#FEF3C7', text: '#D97706' };
    return { bg: '#EFF6FF', text: '#2563EB' };
  };

  const getSignBadgeColor = (status) => {
    if (status === 'Đã ký số') return { bg: '#DCFCE7', text: '#166534' };
    if (status === 'Đã duyệt') return { bg: '#E0F2FE', text: '#0369A1' };
    return { bg: '#F1F5F9', text: '#475569' };
  };

  return (
    <View style={styles.visitCard}>
      <TouchableOpacity style={styles.visitHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.visitHeaderLeft}>
          <View style={[styles.visitTypeBadge, visit.visitType === 'noi_tru' ? styles.badgeInpatient : styles.badgeOutpatient]}>
            <Text style={[styles.visitTypeText, visit.visitType === 'noi_tru' ? styles.badgeInpatientText : styles.badgeOutpatientText]}>
              {visit.visitType === 'noi_tru' ? 'Nội trú' : 'Ngoại trú'}
            </Text>
          </View>
          <View style={styles.visitMeta}>
            <Text style={styles.visitDate}>{visitDate}</Text>
            <Text style={styles.visitFacility}>{visit.facility}</Text>
            {visit.diagnosis ? <Text style={styles.visitDiagnosis} numberOfLines={1}>{visit.diagnosis}</Text> : null}
          </View>
        </View>
        <View style={styles.visitHeaderRight}>
          <Text style={styles.visitDocCount}>{savedCount}/{totalSlots}</Text>
          <Text style={styles.visitDocCountLabel}>tài liệu</Text>
          <Text style={styles.visitToggle}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.visitBody}>
          {(visit.medicalId || visit.doctor) && (
            <View style={styles.visitInfoRow}>
              {visit.medicalId ? (
                <View style={styles.visitInfoItem}>
                  <Text style={styles.visitInfoLabel}>Mã y tế</Text>
                  <Text style={styles.visitInfoValue}>{visit.medicalId}</Text>
                </View>
              ) : null}
              {visit.doctor ? (
                <View style={styles.visitInfoItem}>
                  <Text style={styles.visitInfoLabel}>Bác sĩ phụ trách</Text>
                  <Text style={styles.visitInfoValue}>{visit.doctor}</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(savedCount / totalSlots) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round((savedCount / totalSlots) * 100)}% đã lưu</Text>
          </View>

          {Object.entries(ALL_DOCS).map(([groupKey, slots]) => {
            const meta = GROUP_META[groupKey];
            const groupSaved = slots.filter((s) => savedMap[s.docKey]).length;
            return (
              <View key={groupKey} style={[styles.groupCard, { borderColor: meta.border, backgroundColor: meta.color }]}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupIcon}>{meta.icon}</Text>
                  <Text style={[styles.groupLabel, { color: meta.text }]}>{meta.label}</Text>
                  <Text style={[styles.groupCount, { color: meta.text }]}>{groupSaved}/{slots.length}</Text>
                  <Text style={[styles.groupToggle, { color: meta.text }]}>{expandedGroups[groupKey] ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedGroups[groupKey] && (
                  <View style={styles.docList}>
                    {slots.map((slot) => (
                      <DocCard
                        key={slot.docKey}
                        slot={slot}
                        savedDocs={savedMap[slot.docKey] || []}
                        onPress={(s, docs) => onDocPress(visit._id, { ...s, groupKey }, docs)}
                        onDelete={(docId) => onDeleteDoc(visit._id, docId)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.deleteVisitBtn}
            onPress={() =>
              Alert.alert('Xóa lượt khám', `Xóa lượt khám ngày ${visitDate}?\nTất cả tài liệu đi kèm cũng bị xóa.`, [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa', style: 'destructive', onPress: onDelete },
              ])
            }
          >
            <Text style={styles.deleteVisitBtnText}>🗑 Xóa lượt khám này</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── Add Visit Modal ────────────────────────────────────────────────────────────

const AddVisitModal = ({ visible, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    facility: '',
    visitType: 'ngoai_tru',
    diagnosis: '',
    medicalId: '',
    doctor: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.facility.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên cơ sở y tế.');
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
    setForm({ date: new Date().toISOString().split('T')[0], facility: '', visitType: 'ngoai_tru', diagnosis: '', medicalId: '', doctor: '' });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Hủy</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Thêm lượt khám</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#15803D" size="small" /> : <Text style={styles.modalSave}>Thêm</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalFieldLabel}>Ngày khám *</Text>
          <TextInput style={styles.modalInput} value={form.date} onChangeText={(v) => set('date', v)} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
          <Text style={styles.modalFieldLabel}>Cơ sở y tế *</Text>
          <TextInput style={styles.modalInput} value={form.facility} onChangeText={(v) => set('facility', v)} placeholder="VD: Bệnh viện Chợ Rẫy" placeholderTextColor="#94A3B8" />
          <Text style={styles.modalFieldLabel}>Loại khám *</Text>
          <View style={styles.toggleRow}>
            {[['ngoai_tru', 'Ngoại trú'], ['noi_tru', 'Nội trú']].map(([val, lbl]) => (
              <TouchableOpacity key={val} style={[styles.toggleBtn, form.visitType === val && styles.toggleBtnActive]} onPress={() => set('visitType', val)}>
                <Text style={[styles.toggleBtnText, form.visitType === val && styles.toggleBtnTextActive]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modalFieldLabel}>Chẩn đoán (nếu biết)</Text>
          <TextInput style={styles.modalInput} value={form.diagnosis} onChangeText={(v) => set('diagnosis', v)} placeholder="VD: Tăng huyết áp giai đoạn II" placeholderTextColor="#94A3B8" />
          <Text style={styles.modalFieldLabel}>Mã y tế</Text>
          <TextInput style={styles.modalInput} value={form.medicalId} onChangeText={(v) => set('medicalId', v)} placeholder="VD: CR-2026-04821" placeholderTextColor="#94A3B8" />
          <Text style={styles.modalFieldLabel}>Bác sĩ phụ trách</Text>
          <TextInput style={styles.modalInput} value={form.doctor} onChangeText={(v) => set('doctor', v)} placeholder="VD: BS. Nguyễn Văn A" placeholderTextColor="#94A3B8" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

const PatientRecordsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [search, setSearch] = useState('');
  const [expandedVisit, setExpandedVisit] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { visits, identity, loading, error, reload, addVisit, removeVisit, uploadDoc, saveManualDoc, removeDoc } =
    usePatientRecords();

  const filtered = visits.filter(
    (v) =>
      (v.facility || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.diagnosis || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.date ? new Date(v.date).toLocaleDateString('vi-VN').includes(search) : false)
  );

  const totalSlots = visits.length * Object.values(ALL_DOCS).flat().length;
  const savedCount = visits.reduce((sum, v) => sum + (v.documents?.length || 0), 0);

  const handleDocPress = (visitId, slot, savedDocs) => {
    navigation.navigate('DocumentDetail', {
      visitId,
      patientId: identity?.userId || identity?._id || 'PT-001',
      doc: { ...slot },
      savedDocs: savedDocs || [],
      onUpload: uploadDoc,
      onSaveManual: saveManualDoc,
      onDelete: removeDoc,
    });
  };

  if (loading) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.centerText}>Đang tải hồ sơ...</Text>
        </View>
      </ResponsiveLayout>
    );
  }

  if (error) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Kho hồ sơ sức khỏe</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.pageTitleBlock}>
            <Text style={styles.pageTitle}>Kho Hồ Sơ Sức Khỏe Cá Nhân</Text>
            <Text style={styles.pageSubtitle}>
              Lưu trữ tài liệu nhận từ bệnh viện — tra cứu khi tái khám, chuyển viện hoặc làm thủ tục BHYT.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{visits.length}</Text>
              <Text style={styles.statLabel}>Lượt khám</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#15803D' }]}>{savedCount}</Text>
              <Text style={styles.statLabel}>Tài liệu đã lưu</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#D97706' }]}>{Math.max(0, totalSlots - savedCount)}</Text>
              <Text style={styles.statLabel}>Còn thiếu</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#2563EB' }]}>
                {totalSlots > 0 ? Math.round((savedCount / totalSlots) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Hoàn thiện</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.identityCard} onPress={() => navigation.navigate('PatientIdentity')} activeOpacity={0.85}>
            <View style={styles.identityRow}>
              <View style={styles.identityField}>
                <Text style={styles.identityLabel}>Họ và tên</Text>
                <Text style={styles.identityValue}>{identity?.name || '—'}</Text>
              </View>
              <View style={styles.identityField}>
                <Text style={styles.identityLabel}>Ngày sinh</Text>
                <Text style={styles.identityValue}>
                  {identity?.dateOfBirth ? new Date(identity.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
                </Text>
              </View>
            </View>
            <Text style={styles.identityEditHint}>Nhấn để chỉnh sửa thông tin →</Text>
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo cơ sở y tế, chẩn đoán, ngày..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <Text style={styles.sectionTitle}>Lịch sử khám & Tài liệu ({filtered.length} lượt)</Text>

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗂️</Text>
              <Text style={styles.emptyText}>
                {visits.length === 0
                  ? 'Chưa có lượt khám nào.\nNhấn "+ Thêm lượt khám" để bắt đầu.'
                  : 'Không tìm thấy lượt khám phù hợp.'}
              </Text>
            </View>
          )}

          <View style={styles.timelineContainer}>
            {filtered.map((visit, index) => (
              <View key={visit._id} style={styles.timelineItem}>
                <View style={styles.timelineBar}>
                  <View style={[styles.timelineDot, visit.visitType === 'noi_tru' ? styles.dotInpatient : styles.dotOutpatient]} />
                  {index < filtered.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <VisitCard
                    visit={visit}
                    expanded={expandedVisit === visit._id}
                    onToggle={() => setExpandedVisit(expandedVisit === visit._id ? null : visit._id)}
                    onDocPress={handleDocPress}
                    onDeleteDoc={removeDoc}
                    onDelete={() => removeVisit(visit._id)}
                  />
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addVisitBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addVisitBtnText}>+ Thêm lượt khám mới</Text>
          </TouchableOpacity>

          <View style={styles.infoNote}>
            <Text style={styles.infoNoteIcon}>ℹ️</Text>
            <Text style={styles.infoNoteText}>
              Kho hồ sơ lưu bản sao tài liệu nhận từ bệnh viện. Không thay thế EMR và không dùng để kê toa hay chẩn đoán.
            </Text>
          </View>
        </ScrollView>

        <AddVisitModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={addVisit} />
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  centerText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  errorIcon: { fontSize: 36 },
  retryBtn: { backgroundColor: '#15803D', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: '#FFF', fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backButton: { paddingVertical: 4, marginRight: 16 },
  backButtonText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  scrollContainer: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },
  pageTitleBlock: { marginBottom: 16 },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },
  identityCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  identityRow: { flexDirection: 'row', gap: 12 },
  identityField: { flex: 1 },
  identityLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 2, fontWeight: '600' },
  identityValue: { fontSize: 13, color: '#FFFFFF', fontWeight: 'bold' },
  identityEditHint: { fontSize: 10, color: '#4ADE80', marginTop: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 12, height: 46, marginBottom: 20,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  timelineContainer: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineBar: { width: 20, alignItems: 'center', paddingTop: 20 },
  timelineDot: { width: 14, height: 14, borderRadius: 7 },
  dotInpatient: { backgroundColor: '#EF4444' },
  dotOutpatient: { backgroundColor: '#2563EB' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },
  timelineCard: { flex: 1, paddingBottom: 16 },
  visitCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, overflow: 'hidden' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  visitHeaderLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  visitTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeInpatient: { backgroundColor: '#FEE2E2' },
  badgeOutpatient: { backgroundColor: '#EFF6FF' },
  visitTypeText: { fontSize: 10, fontWeight: 'bold' },
  badgeInpatientText: { color: '#EF4444' },
  badgeOutpatientText: { color: '#2563EB' },
  visitMeta: { flex: 1 },
  visitDate: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  visitFacility: { fontSize: 12, color: '#64748B', marginTop: 1 },
  visitDiagnosis: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  visitHeaderRight: { alignItems: 'center', minWidth: 50 },
  visitDocCount: { fontSize: 16, fontWeight: 'bold', color: '#15803D' },
  visitDocCountLabel: { fontSize: 9, color: '#64748B' },
  visitToggle: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  visitBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 14, gap: 12 },
  visitInfoRow: { flexDirection: 'row', gap: 12 },
  visitInfoItem: { flex: 1 },
  visitInfoLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  visitInfoValue: { fontSize: 12, color: '#334155', fontWeight: '600' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#15803D', borderRadius: 3 },
  progressText: { fontSize: 11, color: '#15803D', fontWeight: '600', minWidth: 60 },
  groupCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  groupIcon: { fontSize: 16 },
  groupLabel: { flex: 1, fontSize: 12, fontWeight: 'bold' },
  groupCount: { fontSize: 11, fontWeight: '600' },
  groupToggle: { fontSize: 10, marginLeft: 4 },
  docList: { padding: 10, paddingTop: 0, gap: 8 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  docCardHas: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  docCardMissing: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderStyle: 'dashed' },
  docCardLeft: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' },
  docIcon: { fontSize: 16 },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 12, color: '#334155', fontWeight: '500' },
  docLabelMissing: { color: '#94A3B8' },
  docStatusHas: { fontSize: 10, color: '#15803D', marginTop: 2 },
  docStatusMissing: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  deleteDocBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  deleteDocBtnText: { fontSize: 14 },
  countBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#15803D',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginRight: 6,
  },
  countBadgeText: { fontSize: 11, color: '#FFF', fontWeight: 'bold' },
  deleteVisitBtn: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  deleteVisitBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  addVisitBtn: { backgroundColor: '#15803D', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  addVisitBtnText: { fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' },
  infoNote: { flexDirection: 'row', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12 },
  infoNoteIcon: { fontSize: 14 },
  infoNoteText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 17 },
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  modalCancel: { fontSize: 15, color: '#64748B' },
  modalSave: { fontSize: 15, color: '#15803D', fontWeight: 'bold' },
  modalBody: { padding: 16, paddingBottom: 40 },
  modalFieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 14 },
  modalInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
  toggleBtnActive: { backgroundColor: '#DCFCE7', borderColor: '#15803D' },
  toggleBtnText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  toggleBtnTextActive: { color: '#15803D', fontWeight: 'bold' },
});

export default PatientRecordsScreen;
