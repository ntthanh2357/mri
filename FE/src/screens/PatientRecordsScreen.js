import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { usePatientRecords } from '../controllers/usePatientRecords';
import styles from './PatientRecordsScreen.styles';

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

const DocCard = ({ slot, savedDocs = [], onPress }) => {
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

const VisitCard = ({ visit, expanded, onToggle, onDocPress }) => {
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
  return (
    <View style={styles.visitCard}>
      <TouchableOpacity style={styles.visitHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.visitHeaderLeft}>
          <View style={[styles.visitTypeBadge, (visit.visitType === 'noi_tru' || visit.visitType === 'Nội trú') ? styles.badgeInpatient : styles.badgeOutpatient]}>
            <Text style={[styles.visitTypeText, (visit.visitType === 'noi_tru' || visit.visitType === 'Nội trú') ? styles.badgeInpatientText : styles.badgeOutpatientText]}>
              {(visit.visitType === 'noi_tru' || visit.visitType === 'Nội trú') ? 'Nội trú' : 'Ngoại trú'}
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
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

const PatientRecordsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [search, setSearch] = useState('');
  const [expandedVisit, setExpandedVisit] = useState(null);

  const { visits, identity, loading, error, reload } = usePatientRecords();

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
      patientId: identity?.userId || identity?._id || '',
      doc: { ...slot },
      savedDocs: savedDocs || [],
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
                  ? 'Chưa có lượt khám nào được bệnh viện cập nhật.'
                  : 'Không tìm thấy lượt khám phù hợp.'}
              </Text>
            </View>
          )}

          <View style={styles.timelineContainer}>
            {filtered.map((visit, index) => (
              <View key={visit._id} style={styles.timelineItem}>
                <View style={styles.timelineBar}>
                  <View style={[styles.timelineDot, (visit.visitType === 'noi_tru' || visit.visitType === 'Nội trú') ? styles.dotInpatient : styles.dotOutpatient]} />
                  {index < filtered.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <VisitCard
                    visit={visit}
                    expanded={expandedVisit === visit._id}
                    onToggle={() => setExpandedVisit(expandedVisit === visit._id ? null : visit._id)}
                    onDocPress={handleDocPress}
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.infoNote}>
            <Text style={styles.infoNoteIcon}>ℹ️</Text>
            <Text style={styles.infoNoteText}>
              Kho hồ sơ lưu bản sao tài liệu nhận từ bệnh viện. Chỉ xem — không thay thế EMR và không dùng để kê toa hay chẩn đoán.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default PatientRecordsScreen;
