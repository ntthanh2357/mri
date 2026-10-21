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
  Image,
} from 'react-native';
import {
  FolderArchive,
  Stethoscope,
  Microscope,
  ShieldCheck,
  UploadCloud,
  Paperclip,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { PatientPage, PatientHero, SideCard, PATIENT_ILLUS, P } from '../components/patient/PatientUI';
import FadeIn from '../components/FadeIn';
import { usePatientRecords } from '../controllers/usePatientRecords';
import styles from './PatientRecordsScreen.styles';
import Colors from '../constants/colors';

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_META = {
  nhom1: { label: 'Hành chính & Tài chính', Icon: FolderArchive, accent: '#1D4ED8' },
  nhom2: { label: 'Lâm sàng', Icon: Stethoscope, accent: '#059669' },
  nhom3: { label: 'Cận lâm sàng', Icon: Microscope, accent: '#D97706' },
  nhom5: { label: 'Pháp lý / Có chữ ký', Icon: ShieldCheck, accent: '#7C3AED' },
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

  const DocIcon = !hasSaved ? UploadCloud : uploadCount > 0 ? Paperclip : ClipboardList;
  const docIconColor = !hasSaved ? Colors.secondary : Colors.brandGreen;

  return (
    <TouchableOpacity
      style={[styles.docCard, hasSaved ? styles.docCardHas : styles.docCardMissing]}
      onPress={() => onPress(slot, savedDocs)}
    >
      <View style={styles.docCardLeft}>
        <DocIcon size={18} color={docIconColor} />
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
          <View style={{ marginTop: 4 }}>
            {expanded ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
          </View>
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
            const GroupIcon = meta.Icon;
            const groupSaved = slots.filter((s) => savedMap[s.docKey]).length;
            const isGroupExpanded = expandedGroups[groupKey];
            return (
              <View key={groupKey} style={[styles.groupCard, { borderLeftColor: meta.accent }]}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                  activeOpacity={0.7}
                >
                  <GroupIcon size={15} color={meta.accent} />
                  <Text style={styles.groupLabel}>{meta.label}</Text>
                  <Text style={styles.groupCount}>{groupSaved}/{slots.length}</Text>
                  {isGroupExpanded ? (
                    <ChevronUp size={16} color={Colors.secondary} />
                  ) : (
                    <ChevronDown size={16} color={Colors.secondary} />
                  )}
                </TouchableOpacity>
                {isGroupExpanded && (
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
  const isWide = width > 1100;
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
          <ActivityIndicator size="large" color={Colors.brandGreen} />
          <Text style={styles.centerText}>Đang tải hồ sơ...</Text>
        </View>
      </ResponsiveLayout>
    );
  }

  if (error) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
        <View style={styles.centerState}>
          <AlertTriangle size={36} color="#EF4444" />
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveLayout>
    );
  }

  const completeness = totalSlots > 0 ? Math.round((savedCount / totalSlots) * 100) : 0;
  // Độ đầy đủ theo từng nhóm giấy tờ (trên tất cả lượt khám)
  const groupStats = Object.entries(ALL_DOCS).map(([key, slots]) => {
    const keys = new Set(slots.map((sl) => sl.docKey));
    const saved = visits.reduce((sum, v) => sum + new Set((v.documents || []).filter((d) => keys.has(d.docKey)).map((d) => d.docKey)).size, 0);
    const total = visits.length * slots.length;
    return { key, ...GROUP_META[key], saved, total, pct: total ? Math.round((saved / total) * 100) : 0 };
  });

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <PatientPage>
        <PatientHero
          illustration={PATIENT_ILLUS.passport}
          eyebrow="Sổ sức khỏe cá nhân"
          title={identity?.name || 'Chưa cập nhật họ tên'}
          subtitle={`Sinh ngày ${identity?.dateOfBirth ? new Date(identity.dateOfBirth).toLocaleDateString('vi-VN') : '—'} · Giấy tờ bệnh viện gửi sau mỗi lượt khám, dùng khi tái khám, chuyển viện hoặc làm thủ tục BHYT.`}
          stats={[
            { value: visits.length, label: 'lượt khám' },
            { value: savedCount, label: 'tài liệu đã lưu' },
            { value: `${completeness}%`, label: 'đầy đủ' },
          ]}
        />

        <View style={[recStyles.columns, isWide && recStyles.columnsWide]}>
          <View style={[recStyles.mainCol, isWide && { flex: 1.6 }]}>
            <View style={styles.searchContainer}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo cơ sở y tế, chẩn đoán, ngày..."
                placeholderTextColor={Colors.secondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Lịch sử khám</Text>
              <Text style={styles.sectionSub}>{filtered.length} lượt khám, theo thứ tự gần nhất trước</Text>
            </View>

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Image source={PATIENT_ILLUS.records} style={styles.emptyIllus} resizeMode="contain" accessible={false} />
                <Text style={styles.emptyText}>
                  {visits.length === 0
                    ? 'Chưa có lượt khám nào được bệnh viện cập nhật.'
                    : 'Không tìm thấy lượt khám phù hợp.'}
                </Text>
              </View>
            )}

            <View style={styles.timelineContainer}>
              {filtered.map((visit, index) => (
                <FadeIn key={visit._id} delay={120 + index * 90} style={styles.timelineItem}>
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
                </FadeIn>
              ))}
            </View>
          </View>

          <View style={[recStyles.sideCol, isWide && { flex: 1 }]}>
            <SideCard icon={FolderArchive} title="Độ đầy đủ hồ sơ" subtitle={`${savedCount}/${totalSlots} giấy tờ trên ${visits.length} lượt khám`}>
              {groupStats.map((g) => (
                <View key={g.key} style={recStyles.group}>
                  <View style={recStyles.groupHead}>
                    <View style={[recStyles.groupIcon, { backgroundColor: `${g.accent}14` }]}>
                      <g.Icon size={15} color={g.accent} />
                    </View>
                    <Text style={recStyles.groupLabel}>{g.label}</Text>
                    <Text style={[recStyles.groupPct, { color: g.accent }]}>{g.saved}/{g.total}</Text>
                  </View>
                  <View style={recStyles.bar}><View style={[recStyles.barFill, { width: `${g.pct}%`, backgroundColor: g.accent }]} /></View>
                </View>
              ))}
            </SideCard>

            <SideCard icon={Info} title="Kho hồ sơ dùng để làm gì?" tone="navy">
              <Text style={recStyles.navyText}>
                Kho hồ sơ lưu bản sao tài liệu nhận từ bệnh viện để bạn mang theo khi tái khám, chuyển viện hoặc làm thủ tục BHYT.
              </Text>
              <Text style={recStyles.navyText}>
                Chỉ để xem — không thay thế bệnh án điện tử và không dùng để kê toa hay chẩn đoán.
              </Text>
            </SideCard>
          </View>
        </View>
      </PatientPage>
    </ResponsiveLayout>
  );
};

const recStyles = {
  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { gap: 16 },
  sideCol: { gap: 16 },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: P.ink },
  groupPct: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  navyText: { fontSize: 13, lineHeight: 20, color: '#C9D6EA' },
};

export default PatientRecordsScreen;
