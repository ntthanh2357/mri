/**
 * ============================================================================
 * CLINICAL AUDIT TRAIL — Nhật ký Kiểm toán Lâm sàng · NeuroScan AI
 * ============================================================================
 * Màn hình của Quản trị viên Bệnh viện (ROLE 8 — UC-HADM-13):
 *  Truy vết các thao tác nhạy cảm theo yêu cầu Google Doc:
 *   - Truy cập bệnh án khẩn cấp Break-Glass (HIPAA §164.312(a)(2)(ii))
 *   - Xóa mềm ca khám (SOFT_DELETE_VISIT — TT 46/2018/TT-BYT)
 *   - Sửa kết luận chẩn đoán / bệnh án điện tử (UPDATE_EMR_RECORD)
 *   - Hoàn tiền hóa đơn viện phí (REFUND_REQUESTED / REFUND_APPROVED)
 *   - Điều chuyển phân công ca (ASSIGNMENT_OVERRIDDEN — UC-HADM-04)
 *
 * Nguồn dữ liệu:
 *   GET /admin/audit-logs?category=&from=&limit=&page=
 *   (hospital_admin bị BE khóa scope vào bệnh viện của chính mình)
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
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { get } from '../services/api.service';
import {
  FileSearch,
  ShieldAlert,
  Trash2,
  FilePenLine,
  Receipt,
  ArrowRightLeft,
  CheckCircle2,
  Hash,
  Clock,
  User,
  History,
  ChevronDown,
  ChevronRight,
  Lock,
} from 'lucide-react';

// Khoảng thời gian tra cứu
const RANGE_TABS = [
  { key: '7', label: '7 ngày' },
  { key: '30', label: '30 ngày' },
  { key: '90', label: '90 ngày' },
  { key: 'all', label: 'Toàn bộ' },
];

// Nhóm thao tác nhạy cảm lâm sàng (khớp CLINICAL_AUDIT_CATEGORIES phía BE)
const CATEGORIES = [
  { key: 'all', label: 'Tất cả', icon: History, color: Colors.slateMuted, bg: '#EEF2F7' },
  { key: 'break_glass', label: 'Break-Glass', icon: ShieldAlert, color: '#B91C1C', bg: '#FEF2F2', actions: ['BREAK_GLASS_EMERGENCY_ACCESSED'] },
  { key: 'soft_delete', label: 'Hủy ca khám', icon: Trash2, color: '#B45309', bg: '#FFFBEB', actions: ['SOFT_DELETE_VISIT'] },
  { key: 'emr_edit', label: 'Sửa bệnh án', icon: FilePenLine, color: '#0369A1', bg: '#F0F9FF', actions: ['UPDATE_EMR_RECORD', 'ADDENDUM_CREATED', 'SIGN_EMR_RECORD', 'RECORD_LOCKED'] },
  { key: 'refund', label: 'Hoàn tiền', icon: Receipt, color: '#7C3AED', bg: '#F5F3FF', actions: ['REFUND_REQUESTED', 'REFUND_APPROVED'] },
  { key: 'assignment', label: 'Điều chuyển ca', icon: ArrowRightLeft, color: '#047857', bg: '#ECFDF5', actions: ['ASSIGNMENT_OVERRIDDEN'] },
];

const ACTION_LABELS = {
  BREAK_GLASS_EMERGENCY_ACCESSED: 'Truy cập khẩn cấp Break-Glass',
  SOFT_DELETE_VISIT: 'Hủy lượt khám (xóa mềm)',
  UPDATE_EMR_RECORD: 'Sửa bệnh án / kết luận chẩn đoán',
  ADDENDUM_CREATED: 'Bổ sung bệnh án (Addendum)',
  SIGN_EMR_RECORD: 'Ký duyệt bệnh án',
  RECORD_LOCKED: 'Khóa bệnh án',
  REFUND_REQUESTED: 'Yêu cầu hoàn tiền viện phí',
  REFUND_APPROVED: 'Duyệt hoàn tiền viện phí',
  ASSIGNMENT_OVERRIDDEN: 'Điều chuyển phân công ca',
  LOGIN: 'Đăng nhập hệ thống',
  RECORD_VIEWED: 'Xem hồ sơ bệnh án',
  STOCK_DEDUCTED: 'Xuất kho thuốc',
  STOCK_RESTOCKED: 'Hoàn vị kho thuốc',
  PAYMENT_COMPLETED: 'Thanh toán viện phí',
  PAYMENT_INITIATED: 'Khởi tạo thanh toán',
  BED_OCCUPIED: 'Tiếp nhận giường bệnh',
  VISIT_STATUS_CHANGED: 'Đổi trạng thái ca khám',
  FSM_TRANSITION: 'Chuyển bước quy trình ca khám',
};

const PAGE_SIZE = 50;

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const relTime = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
};

const shortId = (id) => (id ? String(id).slice(-8).toUpperCase() : '—');
const shortHash = (h) => (h ? `${String(h).slice(0, 10)}…` : '—');

const categoryOf = (action) =>
  CATEGORIES.find((c) => c.actions && c.actions.includes(action)) || null;

export default function ClinicalAuditScreen({ navigation }) {
  const [days, setDays] = useState('30');
  const [category, setCategory] = useState('all');
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const rangeQuery = useCallback(() => {
    if (days === 'all') return '';
    const from = new Date(Date.now() - parseInt(days, 10) * 86400000).toISOString();
    return `&from=${encodeURIComponent(from)}`;
  }, [days]);

  // Đếm số bản ghi từng nhóm thao tác (6 truy vấn nhẹ chạy song song)
  const fetchCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        CATEGORIES.map((c) => {
          const q = c.key === 'all' ? '' : `&category=${c.key}`;
          return get(`/admin/audit-logs?limit=1&page=1${rangeQuery()}${q}`).catch(() => null);
        })
      );
      const next = {};
      results.forEach((r, i) => {
        next[CATEGORIES[i].key] = r && r.success ? r.total || 0 : 0;
      });
      setCounts(next);
    } catch (err) {
      console.warn('Không tải được thống kê nhóm kiểm toán:', err?.message);
    }
  }, [rangeQuery]);

  const fetchLogs = useCallback(async ({ pageNum = 1, silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const catQ = category === 'all' ? '' : `&category=${category}`;
      const res = await get(`/admin/audit-logs?limit=${PAGE_SIZE}&page=${pageNum}${rangeQuery()}${catQ}`);
      if (res && res.success) {
        setLogs((prev) => (pageNum === 1 ? res.logs || [] : [...prev, ...(res.logs || [])]));
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(pageNum);
      } else {
        setError((res && res.message) || 'Không tải được nhật ký kiểm toán.');
      }
    } catch (err) {
      console.error('Lỗi tải nhật ký kiểm toán lâm sàng:', err);
      setError(err.message || 'Không thể tải nhật ký kiểm toán.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [category, rangeQuery]);

  useEffect(() => {
    fetchLogs({ pageNum: 1 });
    fetchCounts();
  }, [fetchLogs, fetchCounts]);

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    fetchLogs({ pageNum: page + 1, silent: true });
  };

  const refreshAll = () => {
    setRefreshing(true);
    fetchLogs({ pageNum: 1, silent: true });
    fetchCounts();
  };

  const changeRange = (key) => {
    setDays(key);
  };

  const changeCategory = (key) => {
    setCategory(key);
  };

  const sensitiveTotal = CATEGORIES.filter((c) => c.key !== 'all').reduce((s, c) => s + (counts[c.key] || 0), 0);
  const chainIntact = logs.every((l) => l.tamperVerified !== false);
  const catTabs = CATEGORIES.map((c) => ({ key: c.key, label: c.label, count: counts[c.key] }));

  // ── Thẻ tổng quan ──────────────────────────────────────────────────────────
  const renderStatCards = () => {
    const cards = [
      {
        icon: <History size={18} color={Colors.brandGreen} />,
        label: 'Bản ghi phù hợp bộ lọc',
        value: total.toLocaleString('vi-VN'),
        sub: `Đang xem trang ${page}/${totalPages}`,
      },
      {
        icon: <ShieldAlert size={18} color="#B91C1C" />,
        label: 'Thao tác nhạy cảm',
        value: sensitiveTotal.toLocaleString('vi-VN'),
        sub: 'Break-Glass · hủy ca · sửa bệnh án · hoàn tiền · chuyển ca',
      },
      {
        icon: chainIntact ? <CheckCircle2 size={18} color={Colors.successText} /> : <ShieldAlert size={18} color={Colors.errorText} />,
        label: 'Chuỗi băm kiểm toán',
        value: chainIntact ? 'Nguyên vẹn' : 'Phát hiện bất thường',
        sub: 'SHA-256 liên kết từng bản ghi (HIPAA §164.312(b))',
      },
    ];
    return (
      <View style={styles.statRow}>
        {cards.map((c, i) => (
          <View key={i} style={styles.statCard}>
            {c.icon}
            <Text style={styles.statValue}>{c.value}</Text>
            <Text style={styles.statLabel}>{c.label}</Text>
            <Text style={styles.statSub}>{c.sub}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Thẻ nhật ký ────────────────────────────────────────────────────────────
  const renderLogCard = (log) => {
    const cat = categoryOf(log.action);
    const color = cat ? cat.color : Colors.slateMuted;
    const bg = cat ? cat.bg : '#EEF2F7';
    const CatIcon = cat ? cat.icon : History;
    const expanded = expandedId === log._id;
    const label = ACTION_LABELS[log.action] || log.action;
    return (
      <View key={log._id} style={styles.card}>
        <TouchableOpacity style={styles.cardHead} onPress={() => setExpandedId(expanded ? null : log._id)} activeOpacity={0.9}>
          <View style={[styles.actionBadge, { backgroundColor: bg }]}>
            <CatIcon size={16} color={color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.actionText, { color }]} numberOfLines={1}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Clock size={11} color={Colors.slateMuted} />
              <Text style={styles.timeText}>{fmtTime(log.createdAt)} · {relTime(log.createdAt)}</Text>
            </View>
          </View>
          {expanded ? (
            <ChevronDown size={16} color={Colors.slateMuted} />
          ) : (
            <ChevronRight size={16} color={Colors.slateMuted} />
          )}
        </TouchableOpacity>

        <Text style={styles.details}>{log.details || '—'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <User size={11} color={Colors.slateMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {log.performedByName || 'Hệ thống'}
              {log.performedByEmail ? ` · ${log.performedByEmail}` : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Hash size={11} color={Colors.slateMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {log.entity} · {shortId(log.entityId)} · {log.hospitalName || 'Hệ thống'}
            </Text>
          </View>
        </View>

        {expanded ? (
          <View style={styles.hashBox}>
            <View style={styles.hashRow}>
              <Lock size={11} color={Colors.successText} />
              <Text style={styles.hashLabel}>Chuỗi băm SHA-256 (tang chứng chống giả mạo)</Text>
            </View>
            <Text style={styles.hashMono}>#{log.sequenceNumber ?? '—'} · prev {shortHash(log.previousHash)}</Text>
            <Text style={styles.hashMono}>curr {shortHash(log.currentHash)}</Text>
            {log.payloadHash ? <Text style={styles.hashMono}>payload {shortHash(log.payloadHash)}</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="ClinicalAudit">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Nhật ký Kiểm toán Lâm sàng"
          subtitle="Truy vết thao tác nhạy cảm: truy cập bệnh án Break-Glass, hủy ca khám, sửa kết luận chẩn đoán, hoàn tiền viện phí và điều chuyển ca (UC-HADM-13)."
          actions={!loading ? (
            <HeaderAction icon="refresh-cw" label="Làm mới" onPress={refreshAll} />
          ) : null}
          below={
            <PageTabs
              tabs={RANGE_TABS}
              value={days}
              onChange={changeRange}
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
                <ShieldAlert size={18} color={Colors.errorText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {renderStatCards()}

            <View style={{ marginTop: 14 }}>
              <PageTabs tabs={catTabs} value={category} onChange={changeCategory} />
            </View>

            {loading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={Colors.brandGreen} />
                <Text style={styles.emptyText}>Đang tải nhật ký kiểm toán…</Text>
              </View>
            ) : logs.length === 0 && !error ? (
              <View style={styles.emptyBox}>
                <FileSearch size={26} color={Colors.brandGreen} />
                <Text style={styles.emptyTitle}>Không có bản ghi nào trong mục này</Text>
                <Text style={styles.emptyText}>
                  Thử mở rộng khoảng thời gian tra cứu hoặc chuyển sang nhóm thao tác khác.
                </Text>
              </View>
            ) : (
              <View style={styles.logList}>
                {logs.map(renderLogCard)}
              </View>
            )}

            {logs.length > 0 && page < totalPages ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={Colors.brandGreen} />
                ) : (
                  <>
                    <ChevronDown size={14} color={Colors.brandGreen} />
                    <Text style={styles.loadMoreText}>Tải thêm ({logs.length}/{total.toLocaleString('vi-VN')})</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
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

  statRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 200, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.brandNavy, fontVariant: ['tabular-nums'], marginTop: 4 },
  statLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.slateDark },
  statSub: { fontSize: 11.5, color: Colors.slateMuted, lineHeight: 16 },

  logList: { gap: 12, marginTop: 14 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14.5, fontWeight: '800' },
  timeText: { fontSize: 11.5, color: Colors.slateMuted },

  details: { fontSize: 13, color: Colors.slateDark, lineHeight: 19, marginTop: 10 },

  metaRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  // 0012: thêm minWidth:0 + flexShrink:1 + maxWidth:'100%' để dòng người thực
  // hiện / thực thể co lại có dấu "..." trên màn hẹp thay vì bị cắt cụt không
  // ellipsis xuyên qua mép thẻ (báo lỗi trên mobile 390px)
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 1, maxWidth: '100%' },
  metaText: { fontSize: 11.5, color: Colors.slateMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

  hashBox: { marginTop: 10, backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, gap: 3 },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  hashLabel: { fontSize: 11, fontWeight: '800', color: Colors.successText },
  hashMono: { fontSize: 11, color: Colors.slateMuted, fontFamily: 'monospace' },

  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  emptyText: { fontSize: 13, color: Colors.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, height: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  loadMoreText: { fontSize: 13.5, fontWeight: '700', color: Colors.brandGreen },
});
