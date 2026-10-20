/**
 * ============================================================================
 * MY ASSIGNMENTS — Phân công của tôi · NeuroScan AI
 * ============================================================================
 * Màn hình của Bác sĩ (ROLE 5 — Doctor) đóng gap tính năng đã ghi nhận ở audit
 * vòng 2 (patch 0012): endpoint PUT /assignments/:id/acknowledge đã có từ trước
 * nhưng KHÔNG có màn FE nào gọi — bác sĩ nhận ca điều chuyển/chỉ định không có
 * chỗ để "Xác nhận nhận ca" (chuyển trạng thái pending → acknowledged).
 *
 * Nghiệp vụ:
 *  - Xem toàn bộ ca đọc phim (read) và ca điều trị (treat) được giao cho mình,
 *    sắp xếp theo ưu tiên → hạn chót (BE sort sẵn).
 *  - Xác nhận nhận ca (ACK) — chỉ áp dụng cho ca đang "Chờ xác nhận".
 *  - Nhảy thẳng sang hàng đợi khám/đọc phim tương ứng để làm việc luôn.
 *  - Nhận biết ca được CHUYỂN GIAO từ bác sĩ khác (override) kèm lý do.
 *  - Theo dõi hạn chót (deadline) và cảnh báo quá hạn theo thời gian thực.
 *
 * Nguồn dữ liệu (BE có sẵn):
 *   GET /api/v1/assignments/my                          (D.2 — của tôi)
 *   PUT /api/v1/assignments/:id/acknowledge             (Bác sĩ xác nhận nhận task)
 * ============================================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { get, put } from '../services/api.service';
import {
  ClipboardCheck,
  Stethoscope,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Shuffle,
  Activity,
  ChevronRight,
  Timer,
  FileText,
  User,
} from 'lucide-react';

// Tab trạng thái (lọc client-side trên danh sách đã tải về)
const STATUS_TABS = [
  { key: 'pending', label: 'Chờ xác nhận', statuses: ['pending'] },
  { key: 'active', label: 'Đang thực hiện', statuses: ['acknowledged', 'in_progress'] },
  { key: 'done', label: 'Hoàn tất', statuses: ['completed'] },
  { key: 'all', label: 'Tất cả', statuses: null },
];

// Bộ lọc loại ca
const TYPE_FILTERS = [
  { key: 'all', label: 'Mọi loại ca' },
  { key: 'read', label: 'Đọc phim MRI' },
  { key: 'treat', label: 'Điều trị' },
];

const STATUS_META = {
  pending: { label: 'Chờ xác nhận', color: '#B45309', bg: '#FFFBEB' },
  acknowledged: { label: 'Đã xác nhận', color: '#0369A1', bg: '#F0F9FF' },
  in_progress: { label: 'Đang thực hiện', color: '#047857', bg: '#ECFDF5' },
  completed: { label: 'Hoàn tất', color: Colors.slateMuted, bg: '#EEF2F7' },
  overridden: { label: 'Đã chuyển ca', color: '#7C3AED', bg: '#F5F3FF' },
};

const TYPE_META = {
  read: { label: 'Đọc phim MRI', icon: Brain, hint: 'Đọc và kết luận phim chụp' },
  treat: { label: 'Điều trị', icon: Stethoscope, hint: 'Phác đồ điều trị / hóa xạ trị' },
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

const patientName = (visit) =>
  visit?.patientId?.profile?.name ||
  visit?.patientId?.profile?.fullName ||
  (visit?.patientId?._id ? `BN ${String(visit.patientId._id).slice(-6).toUpperCase()}` : 'Bệnh nhân');

const visitCode = (visit) =>
  visit?._id ? String(visit._id).slice(-6).toUpperCase() : '—';

const priorityLabel = (p) => {
  if (p === 1) return 'KHẨN CẤP';
  if (p <= 3) return 'Ưu tiên cao';
  return 'Thường';
};

const priorityColor = (p) => {
  if (p === 1) return Colors.errorText;
  if (p <= 3) return Colors.warningText;
  return Colors.slateMuted;
};

const deadlineInfo = (deadlineAt) => {
  if (!deadlineAt) return { text: 'Không hạn chót', overdue: false };
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) {
    const m = Math.round(-diff / 60000);
    return { text: `QUÁ HẠN ${m < 60 ? `${m} phút` : `${Math.round(m / 60)} giờ`}`, overdue: true };
  }
  const m = Math.round(diff / 60000);
  return { text: `Còn ${m < 60 ? `${m} phút` : `${Math.round(m / 60)} giờ`}`, overdue: false };
};

export default function MyAssignmentsScreen({ navigation, route }) {
  // Tab đầu vào từ nơi điều hướng (VD: trang chủ staff việc cần làm → tab 'pending')
  const initialTab = STATUS_TABS.some((t) => t.key === route?.params?.tab)
    ? route.params.tab
    : 'pending';
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusKey, setStatusKey] = useState(initialTab);
  const [typeKey, setTypeKey] = useState('all');
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  // Đồng hồ đếm ngược hạn chót: làm mới nhãn "Còn X phút" mỗi 60 giây
  const [clockTick, setClockTick] = useState(0);

  // ── Tải danh sách ca được phân công cho tôi ──────────────────────────────────
  const fetchAssignments = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await get('/api/v1/assignments/my');
      if (res && res.success) {
        setAssignments(res.data || []);
      } else {
        setError((res && res.message) || 'Không tải được danh sách ca phân công.');
      }
    } catch (err) {
      console.error('Lỗi tải phân công của tôi:', err);
      setError(err.message || 'Không thể tải danh sách ca phân công.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const refreshAll = () => {
    setRefreshing(true);
    fetchAssignments({ silent: true });
  };

  // ── Xác nhận nhận ca (ACK) ───────────────────────────────────────────────────
  const handleAcknowledge = (item) => {
    Alert.alert(
      'Xác nhận nhận ca',
      `Bạn xác nhận nhận ${item.type === 'read' ? 'ca đọc phim MRI' : 'ca điều trị'} của ${patientName(item.visitId)}?`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: 'default',
          onPress: async () => {
            setAcknowledgingId(item._id);
            try {
              const res = await put(`/api/v1/assignments/${item._id}/acknowledge`);
              if (res && res.success) {
                // Cập nhật tại chỗ (optimistic-style) — không tải lại cả danh sách
                setAssignments((prev) =>
                  prev.map((a) =>
                    a._id === item._id
                      ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
                      : a
                  )
                );
                Alert.alert('Đã xác nhận', 'Ca đã chuyển sang trạng thái "Đã xác nhận".', [
                  { text: 'Đã hiểu' },
                ]);
              } else {
                Alert.alert(
                  'Không xác nhận được',
                  (res && res.message) || 'Vui lòng thử lại.',
                  [{ text: 'Đã hiểu' }]
                );
              }
            } catch (err) {
              Alert.alert('Không xác nhận được', err.message || 'Vui lòng thử lại.', [
                { text: 'Đã hiểu' },
              ]);
            } finally {
              setAcknowledgingId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const openWorkQueue = (item) => {
    // Đọc phim → hàng đợi MRI; điều trị → hàng chờ khám
    navigation.navigate('DoctorWorkQueue', { tab: item.type === 'read' ? 'mriQueue' : 'examQueue' });
  };

  // ── Thống kê nhanh ───────────────────────────────────────────────────────────
  const pendingCount = assignments.filter((a) => a.status === 'pending').length;
  const activeCount = assignments.filter((a) => ['acknowledged', 'in_progress'].includes(a.status)).length;
  const overdueActive = assignments.filter((a) => {
    if (!['pending', 'acknowledged', 'in_progress'].includes(a.status)) return false;
    if (!a.deadlineAt) return false;
    void clockTick; // phụ thuộc tick để nhãn tính lại theo thời gian hiện tại
    return new Date(a.deadlineAt).getTime() < Date.now();
  });
  const overdueCount = overdueActive.length;

  // ── Danh sách hiển thị theo tab + lọc loại ───────────────────────────────────
  const tabConf = STATUS_TABS.find((t) => t.key === statusKey) || STATUS_TABS[3];
  const visible = assignments.filter((a) => {
    const okStatus = !tabConf.statuses || tabConf.statuses.includes(a.status);
    const okType = typeKey === 'all' || a.type === typeKey;
    return okStatus && okType;
  });

  // ── Thẻ ca phân công ─────────────────────────────────────────────────────────
  const renderCard = (item) => {
    const st = STATUS_META[item.status] || { label: item.status, color: Colors.slateMuted, bg: '#EEF2F7' };
    const tp = TYPE_META[item.type] || TYPE_META.read;
    const TypeIcon = tp.icon;
    const dl = deadlineInfo(item.deadlineAt);
    const isCritical = item.priority === 1;
    const isPending = item.status === 'pending';
    const isWorking = ['acknowledged', 'in_progress'].includes(item.status);
    const isDone = item.status === 'completed';
    const acking = acknowledgingId === item._id;
    const imaging = item.imagingResultId;

    return (
      <View
        key={item._id}
        style={[
          styles.card,
          (isPending || isWorking) && (isCritical || dl.overdue) ? styles.cardUrgent : null,
        ]}
      >
        <View style={styles.cardHead}>
          <View style={[styles.typeBadge, isCritical && styles.typeBadgeCritical]}>
            <TypeIcon size={16} color={isCritical ? Colors.errorText : Colors.brandGreen} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patientName(item.visitId)}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {tp.label} · Ca khám #{visitCode(item.visitId)} · Ưu tiên: {priorityLabel(item.priority)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Ngữ cảnh lâm sàng: lý do khám + trạng thái lượt khám */}
        {item.visitId?.reason ? (
          <View style={styles.contextBox}>
            <FileText size={13} color={Colors.slateMuted} />
            <Text style={styles.contextText} numberOfLines={2}>
              Lý do khám: {item.visitId.reason}
            </Text>
          </View>
        ) : null}
        {item.visitId?.status ? (
          <View style={[styles.contextBox, styles.contextBoxSlim]}>
            <Activity size={13} color={Colors.slateMuted} />
            <Text style={styles.contextText} numberOfLines={1}>
              Lượt khám đang ở trạng thái "{item.visitId.status}"
            </Text>
          </View>
        ) : null}

        {/* Thông tin phim chụp (ca đọc phim đã có kết quả chụp) */}
        {imaging && (imaging.procedure || imaging.diagnosis) ? (
          <View style={styles.filmBox}>
            <Brain size={13} color={Colors.infoText} />
            <Text style={styles.filmText} numberOfLines={2}>
              {imaging.procedure || 'Phim chụp'}
              {imaging.diagnosis ? ` — ${imaging.diagnosis}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={11} color={dl.overdue ? Colors.errorText : Colors.slateMuted} />
            <Text style={[styles.metaText, dl.overdue && { color: Colors.errorText, fontWeight: '800' }]}>
              {dl.text} (hạn {fmtTime(item.deadlineAt)})
            </Text>
          </View>
          <View style={styles.metaItem}>
            <History size={11} color={Colors.slateMuted} />
            <Text style={styles.metaText}>Phân công {fmtTime(item.createdAt)}</Text>
          </View>
          {item.acknowledgedAt ? (
            <View style={styles.metaItem}>
              <CheckCircle2 size={11} color={Colors.successText} />
              <Text style={styles.metaText}>Đã nhận ca {fmtTime(item.acknowledgedAt)}</Text>
            </View>
          ) : null}
        </View>

        {/* Ca được chuyển giao từ bác sĩ khác — hiển thị lý do để nhận bàn giao đủ thông tin */}
        {item.isOverridden ? (
          <View style={styles.overriddenBox}>
            <Shuffle size={12} color="#7C3AED" />
            <Text style={styles.overriddenText} numberOfLines={4}>
              Ca được chuyển giao lúc {fmtTime(item.overriddenAt)}
              {item.overrideReason ? ` — Lý do: ${item.overrideReason}` : ''}.
            </Text>
          </View>
        ) : null}

        {/* Hành động theo trạng thái */}
        {isPending ? (
          <TouchableOpacity
            style={[styles.ackBtn, acking && { opacity: 0.7 }]}
            onPress={() => handleAcknowledge(item)}
            disabled={acking}
            activeOpacity={0.85}
          >
            {acking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ClipboardCheck size={14} color="#FFFFFF" />
            )}
            <Text style={styles.ackBtnText}>Xác nhận đã nhận ca</Text>
          </TouchableOpacity>
        ) : isWorking ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={() => openWorkQueue(item)} activeOpacity={0.85}>
              <Text style={styles.btnSecondaryText}>{item.type === 'read' ? 'Đọc phim ngay' : 'Khám bệnh nhân'}</Text>
              <ChevronRight size={14} color={Colors.brandGreen} />
            </TouchableOpacity>
          </View>
        ) : isDone ? (
          <Text style={styles.doneText}>Ca đã hoàn tất {fmtTime(item.completedAt)} — cảm ơn bạn.</Text>
        ) : null}
      </View>
    );
  };

  const tabsWithCount = STATUS_TABS.map((t) => {
    const count = !t.statuses
      ? assignments.length
      : assignments.filter((a) => t.statuses.includes(a.status)).length;
    return { key: t.key, label: t.label, count };
  });

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MyAssignments">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Phân công của tôi"
          subtitle="Ca đọc phim và ca điều trị được giao cho bạn — xác nhận nhận ca ngay khi có thể để hệ thống theo dõi tiến độ đúng hạn chót."
          actions={!loading ? (
            <HeaderAction icon="refresh-cw" label="Làm mới" onPress={refreshAll} />
          ) : null}
          below={
            <PageTabs
              tabs={tabsWithCount}
              value={statusKey}
              onChange={setStatusKey}
            />
          }
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={Colors.brandGreen} />
          }
        >
          <PageContainer>
            {error ? (
              <View style={styles.errorBox}>
                <AlertTriangle size={18} color={Colors.errorText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Cảnh báo ca quá hạn đang nằm trên vai bác sĩ */}
            {overdueCount > 0 ? (
              <View style={styles.overdueBanner}>
                <Timer size={15} color={Colors.errorText} />
                <Text style={styles.overdueBannerText}>
                  Bạn có {overdueCount} ca đang giữ đã QUÁ HẠN — ưu tiên xử lý trước.
                </Text>
              </View>
            ) : null}

            {/* Bộ lọc loại ca */}
            <View style={styles.typeFilterRow}>
              {TYPE_FILTERS.map((f) => {
                const active = typeKey === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.typePill, active && styles.typePillActive]}
                    onPress={() => setTypeKey(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typePillText, active && styles.typePillTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={Colors.brandGreen} />
                <Text style={styles.emptyText}>Đang tải danh sách ca phân công…</Text>
              </View>
            ) : visible.length === 0 && !error ? (
              <View style={styles.emptyBox}>
                <ClipboardCheck size={26} color={Colors.brandGreen} />
                <Text style={styles.emptyTitle}>
                  {statusKey === 'pending' && typeKey === 'all'
                    ? 'Không có ca nào chờ xác nhận'
                    : 'Không có ca nào trong mục này'}
                </Text>
                <Text style={styles.emptyText}>
                  {statusKey === 'pending'
                    ? 'Bạn đã xác nhận hết các ca được giao. Ca mới xuất hiện khi tiếp đón tạo lượt khám và hệ thống phân công bác sĩ phụ trách.'
                    : 'Thử đổi bộ lọc trạng thái hoặc loại ca để xem các mục khác.'}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {visible.map(renderCard)}
              </View>
            )}
          </PageContainer>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40, paddingTop: 4 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, color: Colors.errorText, fontWeight: '600' },

  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12 },
  overdueBannerText: { flex: 1, fontSize: 13, color: Colors.errorText, fontWeight: '700' },

  typeFilterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2, marginBottom: 4 },
  typePill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.surface },
  typePillActive: { backgroundColor: Colors.brandGreenSoft, borderColor: Colors.brandGreen },
  typePillText: { fontSize: 12.5, fontWeight: '700', color: Colors.slateMuted },
  typePillTextActive: { color: Colors.brandGreen },

  list: { gap: 14, marginTop: 14 },

  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16 },
  cardUrgent: { borderColor: '#FECACA', borderWidth: 2, backgroundColor: '#FFFBFB' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  typeBadgeCritical: { backgroundColor: Colors.errorBg },
  patientName: { fontSize: 15.5, fontWeight: '800', color: Colors.brandNavy },
  cardSub: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: 11.5, fontWeight: '700' },

  contextBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10, backgroundColor: Colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  contextBoxSlim: { marginTop: 6, paddingVertical: 7 },
  contextText: { flex: 1, fontSize: 12.5, color: Colors.slateMuted, lineHeight: 17 },

  filmBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 6, backgroundColor: Colors.infoBg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  filmText: { flex: 1, fontSize: 12.5, color: Colors.infoText, fontWeight: '600', lineHeight: 17 },

  metaRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  // Pattern 0012: minWidth:0 + flexShrink:1 để chữ metadata co lại có "..." trên
  // màn hẹp thay vì tràn qua mép thẻ
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 1, maxWidth: '100%' },
  metaText: { fontSize: 11.5, color: Colors.slateMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

  overriddenBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10 },
  overriddenText: { flex: 1, fontSize: 12, color: '#6D28D9', lineHeight: 17 },

  ackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, height: 42, borderRadius: 10, backgroundColor: Colors.brandGreen },
  ackBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, height: 42, paddingHorizontal: 14 },
  btnSecondary: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnSecondaryText: { color: Colors.brandGreen, fontSize: 13.5, fontWeight: '700' },

  doneText: { marginTop: 12, fontSize: 12, color: Colors.slateMuted, fontStyle: 'italic' },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, marginTop: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  emptyText: { fontSize: 13, color: Colors.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },
});
