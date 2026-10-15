/**
 * ============================================================================
 * PHARMACY QUEUE — Hàng đợi Khoa Dược · NeuroScan AI
 * ============================================================================
 * Màn hình vận hành chính của Dược sĩ Bệnh viện (UC-PHA-01 → UC-PHA-04):
 *  - UC-PHA-01: Tiếp nhận đơn thuốc điện tử mới được bác sĩ hoàn tất kê toa.
 *  - UC-PHA-02: Thẩm định tính hợp lệ — duyệt xác nhận kép (Dual-Sign) cho đơn
 *    có cảnh báo lâm sàng CRITICAL, hoặc từ chối kèm lý do chuyên môn.
 *  - UC-PHA-03: Kiểm tra trạng thái thanh toán tiền thuốc trên từng đơn.
 *  - UC-PHA-04: Xuất kho & cấp phát — BE tự trừ tồn kho, chốt chặn Dual-Sign,
 *    chống phát thuốc hết hạn và kích hoạt lịch nhắc uống thuốc (UC-PHA-05).
 *
 * Nguồn dữ liệu: GET /api/drugs/queue (module pharmacy Phase 3A)
 * Hành động:     POST /api/drugs/prescriptions/:id/{verify|reject|dispense}
 * ============================================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { get, post } from '../services/api.service';
import {
  Pill,
  ShieldCheck,
  ShieldAlert,
  PackageCheck,
  XCircle,
  Eye,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Ban,
  Clock,
} from 'lucide-react';

// ── Hằng số nghiệp vụ ────────────────────────────────────────────────────────
const STATUS_META = {
  AWAITING_PHARMACY_VERIFICATION: { label: 'Chờ thẩm định kép', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  READY: { label: 'Sẵn sàng xuất phát', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  PENDING_DISPENSE: { label: 'Chờ phát thuốc', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  PARTIALLY_DISPENSED: { label: 'Phát từng phần', color: '#7E22CE', bg: '#FAF5FF', border: '#E9D5FF' },
  DISPENSED: { label: 'Đã phát hoàn tất', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  REJECTED_BY_PHARMACY: { label: 'Khoa Dược từ chối', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  CANCELLED: { label: 'Đã hủy', color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
};

const SAFETY_META = {
  SAFE: { label: 'An toàn', color: '#047857', bg: '#ECFDF5' },
  CAUTION: { label: 'Cần theo dõi', color: '#B45309', bg: '#FFFBEB' },
  HIGH_RISK: { label: 'Nguy cơ cao', color: '#B91C1C', bg: '#FEF2F2' },
  CRITICAL: { label: 'NGUY HIỂM — phải Dual-Sign', color: '#FFFFFF', bg: '#B91C1C' },
  PARTIALLY_EVALUATED: { label: 'Đánh giá một phần', color: '#B45309', bg: '#FFFBEB' },
  UNEVALUATED: { label: 'Chưa đánh giá', color: '#64748B', bg: '#F1F5F9' },
};

// Tab → tham số status gửi lên BE (tab mặc định không gửi status → BE trả
// AWAITING + READY + PENDING — đúng nhóm "đang xử lý" của quầy Dược)
const TAB_FILTERS = {
  active: null,
  awaiting: 'AWAITING_PHARMACY_VERIFICATION',
  ready: 'READY',
  pending: 'PENDING_DISPENSE',
  dispensed: 'DISPENSED',
  rejected: 'REJECTED_BY_PHARMACY',
};

const fmtDateTime = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return t.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const money = (v) => (v == null ? '' : `${Number(v).toLocaleString('vi-VN')} đ`);

export default function PharmacyQueueScreen({ navigation, route }) {
  // Tab đầu từ tham số điều hướng (vd. StaffHome "Việc cần làm" nhảy thẳng tab chờ thẩm định)
  const initialTab = route?.params?.tab && route.params.tab in TAB_FILTERS ? route.params.tab : 'active';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentUser, setCurrentUser] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [allQueue, setAllQueue] = useState([]); // toàn bộ queue đang xử lý — dùng cho badge số tab
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal từ chối đơn (lý do bắt buộc ≥ 10 ký tự theo BE)
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Modal xem chi tiết đơn + dòng thời gian phát thuốc
  const [detailItem, setDetailItem] = useState(null);

  // ── Tải dữ liệu ───────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const statusParam = TAB_FILTERS[activeTab];
      const [tabRes, allRes] = await Promise.all([
        get(statusParam ? `/api/drugs/queue?status=${statusParam}` : '/api/drugs/queue'),
        get('/api/drugs/queue').catch(() => null),
      ]);
      if (tabRes && tabRes.success) setPrescriptions(tabRes.data?.prescriptions || []);
      if (allRes && allRes.success) setAllQueue(allRes.data?.prescriptions || []);
    } catch (err) {
      console.error('Lỗi tải hàng đợi Khoa Dược:', err);
      Alert.alert('Thất bại', err.message || 'Không thể tải hàng đợi Khoa Dược.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/auth/me');
        if (res && res.user) setCurrentUser(res.user);
      } catch (e) { /* đã xử lý ở tầng api client */ }
    })();
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const countByStatus = (statuses) =>
    allQueue.filter(p => statuses.includes(p.dispenseStatus)).length;

  const tabs = [
    { key: 'active', label: 'Đang xử lý', count: allQueue.length || null },
    { key: 'awaiting', label: 'Chờ thẩm định', count: countByStatus(['AWAITING_PHARMACY_VERIFICATION']) || null },
    { key: 'ready', label: 'Sẵn sàng phát', count: countByStatus(['READY']) || null },
    { key: 'pending', label: 'Chờ phát', count: countByStatus(['PENDING_DISPENSE']) || null },
    { key: 'dispensed', label: 'Đã phát', count: countByStatus(['DISPENSED', 'PARTIALLY_DISPENSED']) || null },
    { key: 'rejected', label: 'Từ chối / Hủy', count: countByStatus(['REJECTED_BY_PHARMACY', 'CANCELLED']) || null },
  ];

  // ── Hành động: Thẩm định & Ký duyệt (Dual-Sign) ────────────────────────────
  const handleVerify = (item) => {
    Alert.alert(
      'Thẩm định & Ký duyệt đơn thuốc',
      `Xác nhận đã rà soát liều lượng, đường dùng, tương tác thuốc và dị ứng của đơn thuốc cho bệnh nhân ${item.patient_id?.profile?.name || item.patient_id?.email || ''}? Đơn sẽ chuyển sang "Sẵn sàng xuất phát".`,
      [
        { text: 'Để xem lại', style: 'cancel' },
        {
          text: 'Ký duyệt',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await post(`/api/drugs/prescriptions/${item._id}/verify`, {});
              if (res && res.success) {
                Alert.alert('Đã ký duyệt', res.message || 'Dược sĩ lâm sàng đã thẩm định đơn thuốc thành công.');
                fetchQueue({ silent: true });
              }
            } catch (err) {
              Alert.alert('Thất bại', err.message || 'Không thể thẩm định đơn thuốc.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Hành động: Từ chối (cần lý do chuyên môn ≥ 10 ký tự) ───────────────────
  const openRejectModal = (item) => {
    setRejectTarget(item);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      Alert.alert('Thiếu lý do chuyên môn', 'Bắt buộc nhập lý do từ chối chi tiết (tối thiểu 10 ký tự) để gửi về Bác sĩ điều trị.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await post(`/api/drugs/prescriptions/${rejectTarget._id}/reject`, { reason: rejectReason.trim() });
      if (res && res.success) {
        Alert.alert('Đã từ chối đơn', res.message || 'Đã gửi phản hồi về Bác sĩ điều trị.');
        setRejectTarget(null);
        setRejectReason('');
        fetchQueue({ silent: true });
      }
    } catch (err) {
      Alert.alert('Thất bại', err.message || 'Không thể từ chối đơn thuốc.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Hành động: Phát thuốc (Xuất kho & Cấp phát — UC-PHA-04) ────────────────
  const handleDispense = (item) => {
    Alert.alert(
      'Xác nhận phát thuốc',
      `Xuất kho và giao thuốc cho bệnh nhân ${item.patient_id?.profile?.name || item.patient_id?.email || ''}?\nHệ thống sẽ tự trừ tồn kho, kiểm tra hạn dùng, chốt Dual-Sign và kích hoạt lịch nhắc uống thuốc cho bệnh nhân.`,
      [
        { text: 'Để xem lại', style: 'cancel' },
        {
          text: 'Phát thuốc',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await post(`/api/drugs/prescriptions/${item._id}/dispense`, {});
              if (res && res.success) {
                Alert.alert('Đã phát thuốc', res.message || 'Hoàn tất xuất phát thuốc cho người bệnh.');
                fetchQueue({ silent: true });
              }
            } catch (err) {
              // BE chặn chủ động: chưa thanh toán / Dual-Sign / thuốc hết hạn — hiển thị nguyên văn
              Alert.alert('Không thể phát thuốc', err.message || 'Không thể xuất phát thuốc.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Trợ giúp hiển thị ──────────────────────────────────────────────────────
  const patientName = (p) => p?.patient_id?.profile?.name || p?.patient_id?.email || 'Bệnh nhân';
  const doctorName = (p) => p?.doctorId?.profile?.name || p?.doctor_name || 'Bác sĩ điều trị';
  const isCritical = (p) =>
    p?.clinicalSafety?.status === 'CRITICAL' || p?.clinicalSafety?.overrideCategory === 'ACUTE_EMERGENCY';
  const invoiceOf = (p) => p?.invoiceId || null;

  const renderSafetyChips = (p) => {
    const safety = p.clinicalSafety || {};
    const meta = SAFETY_META[safety.status] || SAFETY_META.UNEVALUATED;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <View style={[styles.chip, { backgroundColor: meta.bg }]}>
          <Text style={[styles.chipText, { color: safety.status === 'CRITICAL' ? '#FFFFFF' : meta.color }]}>
            ● An toàn lâm sàng: {meta.label}
          </Text>
        </View>
        {safety.requiresDualSign ? (
          <View style={[styles.chip, { backgroundColor: safety.dualSignStatus === 'VERIFIED' ? '#ECFDF5' : '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            {safety.dualSignStatus === 'VERIFIED'
              ? <CheckCircle2 size={11} color="#047857" />
              : safety.dualSignStatus === 'REJECTED'
                ? <XCircle size={11} color="#B91C1C" />
                : <AlertTriangle size={11} color="#B45309" />}
            <Text style={[styles.chipText, { color: safety.dualSignStatus === 'VERIFIED' ? '#047857' : safety.dualSignStatus === 'REJECTED' ? '#B91C1C' : '#B45309' }]}>
              {safety.dualSignStatus === 'VERIFIED' ? 'Đã ký kép' : safety.dualSignStatus === 'REJECTED' ? 'Đã từ chối' : 'Chờ Dual-Sign'}
            </Text>
          </View>
        ) : null}
        {isCritical(p) ? (
          <View style={[styles.chip, { backgroundColor: '#B91C1C', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <AlertTriangle size={11} color="#FFFFFF" />
            <Text style={[styles.chipText, { color: '#FFFFFF' }]}>ƯU TIÊN TUYỆT ĐỐI</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderInvoiceChip = (p) => {
    const inv = invoiceOf(p);
    let label, bg, color;
    if (!inv) {
      label = 'Chưa có hóa đơn tiền thuốc';
      bg = '#F1F5F9'; color = '#64748B';
    } else if (inv.status === 'đã thanh toán') {
      label = `Đã thanh toán ${money(inv.totalAmount)}`;
      bg = '#ECFDF5'; color = '#047857';
    } else if (inv.billingType === 'emergency_debt' || inv.paymentMethod === 'ghi nợ cấp cứu') {
      label = 'Ghi nợ cấp cứu — phát trước';
      bg = '#FFFBEB'; color = '#B45309';
    } else {
      label = `Chưa thanh toán ${money(inv.totalAmount)}`;
      bg = '#FFFBEB'; color = '#B45309';
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <View style={[styles.chip, { backgroundColor: bg }]}>
          <Text style={[styles.chipText, { color }]}>{label}</Text>
        </View>
      </View>
    );
  };

  const renderActions = (p) => {
    if (submitting) return null;
    switch (p.dispenseStatus) {
      case 'AWAITING_PHARMACY_VERIFICATION':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => handleVerify(p)}>
              <ShieldCheck size={14} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Thẩm định & Ký duyệt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => openRejectModal(p)}>
              <Ban size={14} color="#FFFFFF" />
              <Text style={styles.btnDangerText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        );
      case 'READY':
      case 'PENDING_DISPENSE':
      case 'PARTIALLY_DISPENSED':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => handleDispense(p)}>
              <PackageCheck size={14} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Phát thuốc & Xuất kho</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  const renderCard = (p) => {
    const st = STATUS_META[p.dispenseStatus] || STATUS_META.PENDING_DISPENSE;
    return (
      <View key={p._id} style={[styles.card, isCritical(p) && styles.cardCritical]}>
        {/* Dòng đầu: bệnh nhân + trạng thái phát */}
        <View style={styles.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.patientName} numberOfLines={1}>{patientName(p)}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              BS kê đơn: {doctorName(p)} · {fmtDateTime(p.createdAt)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Chẩn đoán */}
        <View style={styles.diagnosisBox}>
          <Text style={styles.diagnosisLabel}>CHẨN ĐOÁN</Text>
          <Text style={styles.diagnosisText}>{p.diagnosis || '—'}</Text>
          {p.note ? <Text style={styles.noteText}>Ghi chú của BS: {p.note}</Text> : null}
        </View>

        {/* Danh sách thuốc */}
        <View style={styles.drugList}>
          <Text style={styles.drugListTitle}>Thuốc cần cấp phát ({(p.drugs || []).length} loại)</Text>
          {(p.drugs || []).map((d, i) => (
            <View key={i} style={styles.drugRow}>
              <Pill size={13} color={Colors.brandGreen} />
              <Text style={styles.drugName} numberOfLines={1}>{d.name}</Text>
              <Text style={styles.drugQty}>×{d.quantity} {d.unit || 'viên'}</Text>
            </View>
          ))}
          {(p.drugs || []).some(d => d.usage) ? (
            <Text style={styles.drugUsage} numberOfLines={3}>
              Liều dùng: {(p.drugs || []).filter(d => d.usage).map(d => `${d.name}: ${d.usage}`).join(' · ')}
            </Text>
          ) : null}
        </View>

        {renderSafetyChips(p)}
        {renderInvoiceChip(p)}

        {p.rejectionReason ? (
          <View style={styles.rejectReasonBox}>
            <XCircle size={13} color={Colors.errorText} />
            <Text style={styles.rejectReasonText}>Lý do từ chối: {p.rejectionReason}</Text>
          </View>
        ) : null}

        {p.dispensedAt ? (
          <View style={styles.dispensedBox}>
            <CheckCircle2 size={13} color={Colors.successText} />
            <Text style={styles.dispensedText}>Đã phát lúc {fmtDateTime(p.dispensedAt)}</Text>
          </View>
        ) : null}

        {renderActions(p)}

        <TouchableOpacity style={styles.detailLink} onPress={() => setDetailItem(p)}>
          <Eye size={13} color={Colors.brandGreen} />
          <Text style={styles.detailLinkText}>Xem chi tiết & lịch sử xử lý</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Modal chi tiết ─────────────────────────────────────────────────────────
  const renderDetailModal = () => {
    if (!detailItem) return null;
    const p = detailItem;
    const history = p.dispenseHistory || [];
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pill size={18} color={Colors.brandGreen} />
                <Text style={styles.modalTitle}>Đơn thuốc — {patientName(p)}</Text>
              </View>
              <Text style={styles.modalSub}>
                BS kê đơn: {doctorName(p)} · Kê ngày {fmtDateTime(p.createdAt)}
              </Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Chẩn đoán</Text>
                <Text style={styles.modalSectionBody}>{p.diagnosis || '—'}</Text>
                {p.note ? <Text style={styles.modalSectionBodySmall}>Ghi chú: {p.note}</Text> : null}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Thuốc</Text>
                {(p.drugs || []).map((d, i) => (
                  <View key={i} style={styles.modalDrugRow}>
                    <Text style={styles.drugName}>{d.name}</Text>
                    <Text style={styles.drugQty}>×{d.quantity} {d.unit || 'viên'}</Text>
                    {d.usage ? <Text style={styles.drugUsageSingle}>Liều: {d.usage}</Text> : null}
                  </View>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Thẩm định lâm sàng (UC-PHA-02)</Text>
                <Text style={styles.modalSectionBodySmall}>
                  Trạng thái an toàn: <Text style={{ fontWeight: '700' }}>{(SAFETY_META[p.clinicalSafety?.status] || {}).label || p.clinicalSafety?.status || '—'}</Text>
                  {' '}· Điểm an toàn: {p.clinicalSafety?.safetyScore ?? '—'}
                </Text>
                {(p.clinicalSafety?.warnings || []).length > 0 ? (
                  <View style={{ marginTop: 6, gap: 4 }}>
                    {(p.clinicalSafety.warnings || []).map((w, i) => (
                      <View key={i} style={styles.warningRow}>
                        <AlertTriangle size={12} color={w.severity === 'CRITICAL' ? Colors.errorText : Colors.warningText} />
                        <Text style={[styles.warningText, w.severity === 'CRITICAL' && { color: Colors.errorText, fontWeight: '700' }]}>
                          [{w.severity || '?'}] {w.message || w.description || JSON.stringify(w)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.modalSectionBodySmall}>Không có cảnh báo tương tác thuốc.</Text>
                )}
                {p.verifiedAt ? (
                  <Text style={styles.modalSectionBodySmall}>Dược sĩ ký duyệt: {fmtDateTime(p.verifiedAt)}</Text>
                ) : null}
                {p.verificationNote ? (
                  <Text style={styles.modalSectionBodySmall}>Ghi chú thẩm định: {p.verificationNote}</Text>
                ) : null}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Thanh toán (UC-PHA-03)</Text>
                {(() => {
                  const inv = invoiceOf(p);
                  if (!inv) return <Text style={styles.modalSectionBodySmall}>Chưa liên kết hóa đơn tiền thuốc.</Text>;
                  return (
                    <Text style={styles.modalSectionBodySmall}>
                      Hóa đơn {money(inv.totalAmount)} — trạng thái{' '}
                      <Text style={{ fontWeight: '700' }}>{inv.status}</Text>
                      {inv.paymentMethod ? ` · ${inv.paymentMethod}` : ''}
                    </Text>
                  );
                })()}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Lịch sử xử lý ({history.length})</Text>
                {history.length === 0 ? (
                  <Text style={styles.modalSectionBodySmall}>Chưa có bước xử lý nào được ghi nhận.</Text>
                ) : (
                  history.slice().reverse().map((h, i) => (
                    <View key={i} style={styles.historyRow}>
                      <Clock size={12} color={Colors.secondary} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.historyText}>
                          {STATUS_META[h.fromStatus]?.label || h.fromStatus || '—'} → {STATUS_META[h.toStatus]?.label || h.toStatus || '—'}
                        </Text>
                        <Text style={styles.historySub}>
                          {h.performerName || 'Nhân viên Dược'} · {fmtDateTime(h.timestamp)}
                        </Text>
                        {h.reason ? <Text style={styles.historySub} numberOfLines={3}>{h.reason}</Text> : null}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]} onPress={() => setDetailItem(null)}>
              <Text style={styles.btnPrimaryText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Modal từ chối ──────────────────────────────────────────────────────────
  const renderRejectModal = () => {
    if (!rejectTarget) return null;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ShieldAlert size={18} color={Colors.errorText} />
              <Text style={styles.modalTitle}>Từ chối đơn thuốc</Text>
            </View>
            <Text style={styles.modalSub}>
              Đơn của {patientName(rejectTarget)} — chẩn đoán "{rejectTarget.diagnosis || '—'}".
              Lý do sẽ được gửi trực tiếp về Bác sĩ điều trị để điều chỉnh phác đồ.
            </Text>
            <Text style={styles.label}>Lý do từ chối chuyên môn (tối thiểu 10 ký tự) *</Text>
            <TextInput
              style={[styles.input, styles.rejectInput]}
              placeholder="Ví dụ: Liều Dexamethasone vượt ngưỡng chống chỉ định suy thận nặng (eGFR < 30)..."
              placeholderTextColor={Colors.secondary}
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel, { flex: 1 }]} onPress={() => setRejectTarget(null)} disabled={submitting}>
                <Text style={styles.btnCancelText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnDanger, { flex: 2 }]} onPress={handleReject} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <XCircle size={14} color="#FFFFFF" />}
                <Text style={styles.btnDangerText}>Gửi từ chối</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PharmacyQueue">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Hàng đợi Khoa Dược"
          subtitle="Tiếp nhận đơn thuốc điện tử, thẩm định Dual-Sign, kiểm tra thanh toán và xuất kho cấp phát (UC-PHA-01 → 04)."
          actions={!loading ? (
            <HeaderAction icon="refresh-cw" label="Làm mới" onPress={() => fetchQueue()} />
          ) : null}
          below={<PageTabs tabs={tabs} value={activeTab} onChange={setActiveTab} />}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchQueue({ silent: true }); }}
              tintColor={Colors.brandGreen}
            />
          }
        >
          <PageContainer>
            {loading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={Colors.brandGreen} />
                <Text style={styles.emptyText}>Đang tải hàng đợi Khoa Dược…</Text>
              </View>
            ) : prescriptions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Pill size={26} color={Colors.brandGreen} />
                <Text style={styles.emptyTitle}>Không có đơn thuốc nào trong mục này</Text>
                <Text style={styles.emptyText}>
                  Đơn thuốc mới xuất hiện ở đây ngay sau khi Bác sĩ khám lâm sàng hoàn tất kê toa.
                </Text>
              </View>
            ) : (
              <View style={styles.queueList}>
                {prescriptions.map(renderCard)}
              </View>
            )}
          </PageContainer>
        </ScrollView>

        {renderDetailModal()}
        {renderRejectModal()}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40, paddingTop: 4 },

  queueList: { gap: 14 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardCritical: { borderColor: '#FECACA', borderWidth: 2, backgroundColor: '#FFFBFB' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  patientName: { fontSize: 16, fontWeight: '800', color: Colors.brandNavy },
  cardSub: { fontSize: 12.5, color: Colors.secondary, marginTop: 2 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11.5, fontWeight: '700' },

  diagnosisBox: { marginTop: 10, backgroundColor: Colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  diagnosisLabel: { fontSize: 10, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.6 },
  diagnosisText: { fontSize: 14, fontWeight: '700', color: Colors.slateDark, marginTop: 2 },
  noteText: { fontSize: 12, color: Colors.slateMuted, marginTop: 4 },

  drugList: { marginTop: 10 },
  drugListTitle: { fontSize: 12, fontWeight: '700', color: Colors.slateMuted, marginBottom: 6 },
  drugRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  drugName: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: '600', color: Colors.slateDark },
  drugQty: { fontSize: 12.5, fontWeight: '700', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  drugUsage: { fontSize: 12, color: Colors.slateMuted, marginTop: 6, lineHeight: 17 },
  drugUsageSingle: { fontSize: 12, color: Colors.slateMuted, marginTop: 2 },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  chipText: { fontSize: 11.5, fontWeight: '700' },

  rejectReasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: Colors.errorBg, borderRadius: 8, padding: 10 },
  rejectReasonText: { flex: 1, fontSize: 12.5, color: Colors.errorText, fontWeight: '600' },
  dispensedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dispensedText: { fontSize: 12.5, color: Colors.successText, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, height: 42, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: Colors.brandGreen, flexGrow: 1 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  btnDanger: { backgroundColor: Colors.errorText },
  btnDangerText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  btnCancel: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnCancelText: { color: Colors.slateMuted, fontSize: 13.5, fontWeight: '700' },

  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingVertical: 4 },
  detailLinkText: { fontSize: 12.5, fontWeight: '700', color: Colors.brandGreen },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  emptyText: { fontSize: 13, color: Colors.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalContainer: { width: 560, maxWidth: '100%', maxHeight: '88%', backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.brandNavy, flex: 1 },
  modalSub: { fontSize: 12.5, color: Colors.slateMuted, lineHeight: 18 },
  label: { fontSize: 12.5, fontWeight: '700', color: Colors.slateDark, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: Colors.slateDark, backgroundColor: Colors.background },
  rejectInput: { height: 110, textAlignVertical: 'top' },
  modalSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  modalSectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.secondary, letterSpacing: 0.6, marginBottom: 5 },
  modalSectionBody: { fontSize: 13.5, color: Colors.slateDark },
  modalSectionBodySmall: { fontSize: 12.5, color: Colors.slateMuted, lineHeight: 18 },
  modalDrugRow: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warningText: { flex: 1, fontSize: 12, color: Colors.warningText, lineHeight: 17 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  historyText: { fontSize: 12.5, fontWeight: '700', color: Colors.slateDark },
  historySub: { fontSize: 11.5, color: Colors.secondary, marginTop: 1, lineHeight: 16 },
});
