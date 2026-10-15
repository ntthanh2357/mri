/**
 * ============================================================================
 * ASSIGNMENT OVERRIDE — Điều chuyển Phân công Ca (Smart Override) · NeuroScan AI
 * ============================================================================
 * Màn hình của Quản trị viên Bệnh viện (ROLE 8 — UC-HADM-04):
 *  Can thiệp thủ công chuyển ca đọc phim MRI hoặc ca điều trị sang bác sĩ
 *  khác khi có sự cố phát sinh (bác sĩ nghỉ đột xuất, quá tải, sự cố y khoa).
 *  Lý do điều chuyển là BẮT BUỘC và được ghi vết vào:
 *   - Hồ sơ Assignment (overrideReason / overriddenBy / previousDoctorId)
 *   - Nhật ký kiểm toán lâm sàng hash-chain (ASSIGNMENT_OVERRIDDEN — UC-HADM-13)
 *
 * Nguồn dữ liệu (BE có sẵn, FE lần đầu consume):
 *   GET  /api/v1/assignments?status=&page=&limit=        (D.2)
 *   GET  /api/v1/assignments/caseload-dashboard          (D.4)
 *   PUT  /api/v1/assignments/:id/override { newDoctorId, reason }  (D.3)
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
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { get, put } from '../services/api.service';
import {
  Shuffle,
  Stethoscope,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  UserCheck,
  ChevronDown,
  History,
  Activity,
} from 'lucide-react';

const PAGE_SIZE = 20;

// Tab chính của màn hình
const MAIN_TABS = [
  { key: 'list', label: 'Phân công hiện tại' },
  { key: 'caseload', label: 'Tải bác sĩ (Caseload)' },
];

// Bộ lọc trạng thái phân công
const STATUS_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Đang hoạt động' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'overridden', label: 'Đã chuyển ca' },
];

const STATUS_QUERY = {
  all: '',
  active: '&status=pending,acknowledged,in_progress',
  completed: '&status=completed',
  // Override ghi in-place (isOverridden=true, status reset pending) — lọc theo cờ
  overridden: '&overridden=true',
};

const STATUS_META = {
  pending: { label: 'Chờ xác nhận', color: '#B45309', bg: '#FFFBEB' },
  acknowledged: { label: 'Đã xác nhận', color: '#0369A1', bg: '#F0F9FF' },
  in_progress: { label: 'Đang thực hiện', color: '#047857', bg: '#ECFDF5' },
  completed: { label: 'Hoàn tất', color: Colors.slateMuted, bg: '#EEF2F7' },
  overridden: { label: 'Đã chuyển ca', color: '#7C3AED', bg: '#F5F3FF' },
};

const TYPE_META = {
  read: { label: 'Đọc phim MRI', icon: Brain },
  treat: { label: 'Điều trị', icon: Stethoscope },
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

const doctorName = (doc) =>
  doc?.profile?.name || doc?.profile?.fullName || doc?.email || '—';

const priorityLabel = (p) => {
  // 0012: đồng bộ ngôn ngữ tiếng Việt — trước đây priority 1 hiển thị "CRITICAL"
  // lẫn tiếng Anh giữa "Ưu tiên cao" / "Thường"
  if (p === 1) return 'KHẨN CẤP';
  if (p <= 3) return 'Ưu tiên cao';
  return 'Thường';
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

export default function AssignmentOverrideScreen({ navigation }) {
  const [mainTab, setMainTab] = useState('list');
  const [statusKey, setStatusKey] = useState('all');
  const [assignments, setAssignments] = useState([]);
  const [caseloads, setCaseloads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Modal điều chuyển ca
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [pickedDoctorId, setPickedDoctorId] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Tải danh sách phân công ────────────────────────────────────────────────
  const fetchAssignments = useCallback(async ({ pageNum = 1, silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const statusQ = STATUS_QUERY[statusKey] || '';
      const res = await get(`/api/v1/assignments?limit=${PAGE_SIZE}&page=${pageNum}${statusQ}`);
      if (res && res.success) {
        setAssignments((prev) => (pageNum === 1 ? res.data?.assignments || [] : [...prev, ...(res.data?.assignments || [])]));
        setTotal(res.data?.total || 0);
        setPage(pageNum);
      } else {
        setError((res && res.message) || 'Không tải được danh sách phân công.');
      }
    } catch (err) {
      console.error('Lỗi tải danh sách phân công:', err);
      setError(err.message || 'Không thể tải danh sách phân công.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [statusKey]);

  // ── Tải dashboard caseload bác sĩ ─────────────────────────────────────────
  const fetchCaseloads = useCallback(async () => {
    try {
      const res = await get('/api/v1/assignments/caseload-dashboard');
      if (res && res.success) setCaseloads(res.data || []);
    } catch (err) {
      console.warn('Không tải được caseload dashboard:', err?.message);
    }
  }, []);

  useEffect(() => {
    fetchAssignments({ pageNum: 1 });
    fetchCaseloads();
  }, [fetchAssignments, fetchCaseloads]);

  const refreshAll = () => {
    setRefreshing(true);
    fetchAssignments({ pageNum: 1, silent: true });
    fetchCaseloads();
  };

  const loadMore = () => {
    if (loadingMore || assignments.length >= total) return;
    setLoadingMore(true);
    fetchAssignments({ pageNum: page + 1, silent: true });
  };

  // ── Luồng điều chuyển ca ───────────────────────────────────────────────────
  const openOverrideModal = (item) => {
    setOverrideTarget(item);
    setPickedDoctorId(null);
    setReason('');
    setFormError('');
  };

  const closeOverrideModal = () => {
    if (submitting) return;
    setOverrideTarget(null);
  };

  const handleSubmitOverride = async () => {
    if (!overrideTarget || !pickedDoctorId) {
      setFormError('Vui lòng chọn bác sĩ nhận ca.');
      return;
    }
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setFormError('Lý do điều chuyển là bắt buộc và cần cụ thể (tối thiểu 10 ký tự).');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await put(`/api/v1/assignments/${overrideTarget._id}/override`, {
        newDoctorId: pickedDoctorId,
        reason: trimmed,
      });
      if (res && res.success) {
        setOverrideTarget(null);
        Alert.alert(
          'Điều chuyển thành công',
          res.message || 'Ca đã được chuyển sang bác sĩ mới và ghi vào nhật ký kiểm toán.',
          [{ text: 'Đã hiểu' }]
        );
        fetchAssignments({ pageNum: 1, silent: true });
        fetchCaseloads();
      } else {
        setFormError((res && res.message) || 'Điều chuyển thất bại.');
      }
    } catch (err) {
      setFormError(err.message || 'Không thể điều chuyển ca.');
    } finally {
      setSubmitting(false);
    }
  };

  // Bác sĩ gợi ý = tải thấp nhất trong số bác sĩ nhận được ca
  const suggestDoctorId = overrideTarget
    ? caseloads
        .filter((d) => d.doctorId && overrideTarget.doctorId && String(d.doctorId) !== String(overrideTarget.doctorId._id))
        .sort((a, b) => (a.currentCaseload || 0) - (b.currentCaseload || 0))[0]?.doctorId
    : null;

  // ── Tab tải bác sĩ ─────────────────────────────────────────────────────────
  const renderCaseloadTab = () => {
    if (!caseloads.length) {
      return (
        <View style={styles.emptyBox}>
          <Activity size={26} color={Colors.brandGreen} />
          <Text style={styles.emptyTitle}>Chưa có dữ liệu tải công việc</Text>
          <Text style={styles.emptyText}>Dữ liệu xuất hiện khi bệnh viện có bác sĩ và phân công ca.</Text>
        </View>
      );
    }
    return (
      <View style={styles.doctorList}>
        {caseloads.map((d) => {
          // caseload-dashboard trả loadPercentage; clinical-view trả utilizationPercent —
          // nhận cả hai kèm fallback tự tính để giữ bar đúng nếu đổi endpoint
          const pct = Math.min(100, d.loadPercentage ?? d.utilizationPercent ?? Math.round(((d.currentCaseload || 0) / (d.maxCaseload || 10)) * 100));
          const overloaded = (d.currentCaseload || 0) > (d.maxCaseload || 10);
          const barColor = overloaded ? Colors.errorText : pct >= 80 ? '#B45309' : Colors.brandGreen;
          return (
            <View key={d.doctorId} style={[styles.doctorCard, overloaded && styles.doctorCardOverloaded]}>
              <View style={styles.doctorHead}>
                <View style={[styles.doctorAvatar, { backgroundColor: overloaded ? '#FEF2F2' : Colors.brandGreenSoft }]}>
                  <User size={18} color={overloaded ? Colors.errorText : Colors.brandGreen} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.doctorName} numberOfLines={1}>{d.name || d.email}</Text>
                    {d.isOnCall ? (
                      <View style={styles.onCallChip}>
                        <Text style={styles.onCallChipText}>Đang trực</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.doctorSub} numberOfLines={1}>
                    {d.specialty || 'Chuyên khoa chung'} · {d.email}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.loadText, { color: barColor }]}>{d.currentCaseload ?? 0}/{d.maxCaseload ?? 10}</Text>
                  <Text style={styles.loadSub}>ca đang giữ</Text>
                </View>
              </View>
              <View style={styles.loadBarBg}>
                <View style={[styles.loadBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {overloaded ? (
                  <View style={styles.overloadChip}>
                    <AlertTriangle size={11} color={Colors.errorText} />
                    <Text style={styles.overloadText}>Vượt định mức — nên điều chuyển bớt ca</Text>
                  </View>
                ) : null}
                {d.overdueCases > 0 ? (
                  <View style={[styles.overloadChip, { backgroundColor: '#FFFBEB' }]}>
                    <Clock size={11} color="#B45309" />
                    <Text style={[styles.overloadText, { color: '#B45309' }]}>{d.overdueCases} ca quá hạn</Text>
                  </View>
                ) : null}
                {!overloaded && d.overdueCases === 0 ? (
                  <View style={[styles.overloadChip, { backgroundColor: Colors.successBg }]}>
                    <CheckCircle2 size={11} color={Colors.successText} />
                    <Text style={[styles.overloadText, { color: Colors.successText }]}>Đang trong tầm kiểm soát</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Thẻ phân công ──────────────────────────────────────────────────────────
  const renderAssignmentCard = (item) => {
    const st = STATUS_META[item.status] || { label: item.status, color: Colors.slateMuted, bg: '#EEF2F7' };
    const tp = TYPE_META[item.type] || TYPE_META.read;
    const TypeIcon = tp.icon;
    const dl = deadlineInfo(item.deadlineAt);
    const canOverride = ['pending', 'acknowledged', 'in_progress'].includes(item.status);
    const patient = item.visitId?.patientId;
    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.typeBadge}>
            <TypeIcon size={16} color={Colors.brandGreen} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patient?.profile?.name || `BN ${String(patient?._id || '').slice(-6).toUpperCase()}`}
            </Text>
            <Text style={styles.cardSub}>
              {tp.label} · Ca khám {String(item.visitId?._id || '').slice(-6).toUpperCase()} · Ưu tiên: {priorityLabel(item.priority)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.doctorBox}>
          <UserCheck size={14} color={Colors.slateMuted} />
          <Text style={styles.doctorBoxText} numberOfLines={1}>
            Bác sĩ phụ trách: <Text style={styles.doctorBoxName}>{doctorName(item.doctorId)}</Text>
            {item.doctorId?.profile?.specialty ? ` · ${item.doctorId.profile.specialty}` : ''}
          </Text>
        </View>

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
        </View>

        {item.isOverridden ? (
          <View style={styles.overriddenBox}>
            <Shuffle size={12} color="#7C3AED" />
            <Text style={styles.overriddenText} numberOfLines={3}>
              Đã điều chuyển từ BS {doctorName(item.previousDoctorId)} bởi {doctorName(item.overriddenBy)} lúc {fmtTime(item.overriddenAt)}.
              Lý do: {item.overrideReason || '—'}
            </Text>
          </View>
        ) : null}

        {canOverride ? (
          <TouchableOpacity style={styles.overrideBtn} onPress={() => openOverrideModal(item)} activeOpacity={0.85}>
            <Shuffle size={14} color="#FFFFFF" />
            <Text style={styles.overrideBtnText}>Điều chuyển ca sang bác sĩ khác</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.cannotOverrideText}>
            {item.status === 'completed' ? 'Ca đã hoàn tất — không thể điều chuyển.' : 'Ca đã bị điều chuyển trước đó.'}
          </Text>
        )}
      </View>
    );
  };

  // ── Modal điều chuyển ca ───────────────────────────────────────────────────
  const renderOverrideModal = () => {
    if (!overrideTarget) return null;
    const tp = TYPE_META[overrideTarget.type] || TYPE_META.read;
    const patient = overrideTarget.visitId?.patientId;
    const availableDoctors = caseloads.filter(
      (d) => !overrideTarget.doctorId || String(d.doctorId) !== String(overrideTarget.doctorId._id)
    );
    return (
      <Modal visible transparent animationType="fade" onRequestClose={closeOverrideModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Shuffle size={18} color={Colors.brandGreen} />
                <Text style={styles.modalTitle}>Điều chuyển ca (Smart Override)</Text>
              </View>
              <Text style={styles.modalSub}>
                {tp.label} cho bệnh nhân {patient?.profile?.name || '—'} đang do BS {doctorName(overrideTarget.doctorId)} phụ trách.
                Lý do điều chuyển sẽ được ghi vĩnh viễn vào nhật ký kiểm toán lâm sàng (UC-HADM-13) — không thể sửa/xóa.
              </Text>

              <Text style={styles.label}>Chọn bác sĩ nhận ca</Text>
              {availableDoctors.length === 0 ? (
                <Text style={styles.formError}>Không có bác sĩ khác trong bệnh viện để nhận ca.</Text>
              ) : (
                <View style={styles.doctorPicker}>
                  {availableDoctors.map((d) => {
                    const picked = String(pickedDoctorId) === String(d.doctorId);
                    const suggested = String(suggestDoctorId) === String(d.doctorId);
                    const overloaded = (d.currentCaseload || 0) > (d.maxCaseload || 10);
                    return (
                      <TouchableOpacity
                        key={d.doctorId}
                        style={[styles.pickRow, picked && styles.pickRowActive]}
                        onPress={() => setPickedDoctorId(d.doctorId)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.radio, picked && styles.radioActive]}>
                          {picked ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.pickName} numberOfLines={1}>{d.name || d.email}</Text>
                            {suggested ? (
                              <View style={styles.suggestChip}>
                                <Text style={styles.suggestText}>Gợi ý: tải thấp nhất</Text>
                              </View>
                            ) : null}
                            {d.isOnCall ? (
                              <View style={styles.onCallChip}>
                                <Text style={styles.onCallChipText}>Đang trực</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.pickSub} numberOfLines={1}>
                            {d.specialty || 'Chuyên khoa chung'} · đang giữ {d.currentCaseload ?? 0}/{d.maxCaseload ?? 10} ca
                            {overloaded ? ' · VƯỢT ĐỊNH MỨC' : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>Lý do điều chuyển (bắt buộc, tối thiểu 10 ký tự) *</Text>
              <TextInput
                style={[styles.input, styles.reasonInput]}
                placeholder="Ví dụ: BS phụ trách đột xuất nghỉ phép vì sự việc gia đình, ca CRITICAL cần đọc trong hạn 4 giờ…"
                placeholderTextColor={Colors.secondary}
                multiline
                value={reason}
                onChangeText={(t) => { setReason(t); if (formError) setFormError(''); }}
              />
              <Text style={styles.counter}>{reason.trim().length}/500 ký tự</Text>

              {formError ? (
                <View style={styles.formErrorBox}>
                  <AlertTriangle size={14} color={Colors.errorText} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel, { flex: 1 }]} onPress={closeOverrideModal} disabled={submitting}>
                  <Text style={styles.btnCancelText}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { flex: 2 }, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmitOverride}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Shuffle size={14} color="#FFFFFF" />}
                  <Text style={styles.btnPrimaryText}>Xác nhận điều chuyển</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const statusTabs = STATUS_TABS.map((t) => ({ key: t.key, label: t.label }));

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="AssignmentOverride">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Điều chuyển Phân công Ca"
          subtitle="Can thiệp thủ công chuyển ca đọc phim / điều trị sang bác sĩ khác khi có sự cố phát sinh; lý do điều chuyển bắt buộc ghi vào nhật ký kiểm toán (UC-HADM-04)."
          actions={!loading ? (
            <HeaderAction icon="refresh-cw" label="Làm mới" onPress={refreshAll} />
          ) : null}
          below={
            <PageTabs
              tabs={MAIN_TABS.map((t) => ({ key: t.key, label: t.label }))}
              value={mainTab}
              onChange={setMainTab}
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

            {mainTab === 'list' ? (
              <>
                <PageTabs tabs={statusTabs} value={statusKey} onChange={setStatusKey} />
                {loading ? (
                  <View style={styles.emptyBox}>
                    <ActivityIndicator size="large" color={Colors.brandGreen} />
                    <Text style={styles.emptyText}>Đang tải danh sách phân công…</Text>
                  </View>
                ) : assignments.length === 0 && !error ? (
                  <View style={styles.emptyBox}>
                    <Shuffle size={26} color={Colors.brandGreen} />
                    <Text style={styles.emptyTitle}>Không có phân công nào trong mục này</Text>
                    <Text style={styles.emptyText}>
                      Phân công xuất hiện sau khi tiếp đón tạo ca khám và hệ thống gán bác sĩ phụ trách.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.assignmentList}>
                    {assignments.map(renderAssignmentCard)}
                  </View>
                )}
                {assignments.length > 0 && assignments.length < total ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={Colors.brandGreen} />
                    ) : (
                      <>
                        <ChevronDown size={14} color={Colors.brandGreen} />
                        <Text style={styles.loadMoreText}>Tải thêm ({assignments.length}/{total})</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              renderCaseloadTab()
            )}
          </PageContainer>
        </ScrollView>

        {renderOverrideModal()}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40, paddingTop: 4 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, color: Colors.errorText, fontWeight: '600' },

  assignmentList: { gap: 14, marginTop: 14 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  patientName: { fontSize: 15.5, fontWeight: '800', color: Colors.brandNavy },
  cardSub: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: 11.5, fontWeight: '700' },

  doctorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, backgroundColor: Colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  doctorBoxText: { flex: 1, fontSize: 12.5, color: Colors.slateMuted },
  doctorBoxName: { fontWeight: '800', color: Colors.slateDark },

  metaRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  // 0012: thêm minWidth:0 + flexShrink:1 + maxWidth:'100%' để chữ metadata
  // (tên BS phụ trách, mã thực thể) co lại có dấu "..." trên màn hẹp thay vì
  // bị cắt cụt xuyên qua mép thẻ
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 1, maxWidth: '100%' },
  metaText: { fontSize: 11.5, color: Colors.slateMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

  overriddenBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10 },
  overriddenText: { flex: 1, fontSize: 12, color: '#6D28D9', lineHeight: 17 },

  overrideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, height: 42, borderRadius: 10, backgroundColor: Colors.brandGreen },
  overrideBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  cannotOverrideText: { marginTop: 12, fontSize: 12, color: Colors.slateMuted, fontStyle: 'italic' },

  // ── Tab caseload ──
  doctorList: { gap: 14, marginTop: 14 },
  doctorCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16 },
  doctorCardOverloaded: { borderColor: '#FECACA', borderWidth: 2, backgroundColor: '#FFFBFB' },
  doctorHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doctorAvatar: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 14.5, fontWeight: '800', color: Colors.brandNavy, flexShrink: 1, minWidth: 0 },
  doctorSub: { fontSize: 11.5, color: Colors.slateMuted, marginTop: 2 },
  loadText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  loadSub: { fontSize: 10.5, color: Colors.slateMuted },
  loadBarBg: { height: 8, borderRadius: 4, backgroundColor: '#EEF2F7', marginTop: 10, overflow: 'hidden' },
  loadBarFill: { height: 8, borderRadius: 4 },
  onCallChip: { borderRadius: 999, backgroundColor: Colors.brandGreenSoft, paddingHorizontal: 8, paddingVertical: 3 },
  onCallChipText: { fontSize: 10.5, fontWeight: '700', color: Colors.brandGreen },
  overloadChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: Colors.errorBg, paddingHorizontal: 9, paddingVertical: 4 },
  overloadText: { fontSize: 11.5, fontWeight: '700', color: Colors.errorText },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalContainer: { width: 600, maxWidth: '100%', maxHeight: '90%', backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.brandNavy, flex: 1 },
  modalSub: { fontSize: 12.5, color: Colors.slateMuted, lineHeight: 18 },
  label: { fontSize: 12.5, fontWeight: '700', color: Colors.slateDark, marginTop: 14, marginBottom: 6 },
  doctorPicker: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  pickRowActive: { backgroundColor: Colors.brandGreenSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.brandGreen },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.brandGreen },
  pickName: { fontSize: 13.5, fontWeight: '700', color: Colors.slateDark, flexShrink: 1, minWidth: 0 },
  pickSub: { fontSize: 11.5, color: Colors.slateMuted, marginTop: 2 },
  suggestChip: { borderRadius: 999, backgroundColor: Colors.infoBg, paddingHorizontal: 8, paddingVertical: 3 },
  suggestText: { fontSize: 10.5, fontWeight: '700', color: Colors.infoText },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: Colors.slateDark, backgroundColor: Colors.background },
  reasonInput: { height: 110, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: Colors.slateMuted, marginTop: 4, textAlign: 'right' },
  formErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: Colors.errorBg, borderRadius: 8, padding: 10 },
  formErrorText: { flex: 1, fontSize: 12.5, color: Colors.errorText, fontWeight: '600' },
  formError: { fontSize: 12.5, color: Colors.errorText, fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, height: 42, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  btnCancel: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnCancelText: { color: Colors.slateMuted, fontSize: 13.5, fontWeight: '700' },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, marginTop: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  emptyText: { fontSize: 13, color: Colors.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, height: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  loadMoreText: { fontSize: 13.5, fontWeight: '700', color: Colors.brandGreen },
});
