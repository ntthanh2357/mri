/**
 * ============================================================================
 * SLA REPORT — Báo cáo Năng suất & Thời gian Chờ · NeuroScan AI
 * ============================================================================
 * Màn hình vận hành của Quản trị viên Bệnh viện (ROLE 8 — Minh):
 *  - UC-HADM-12: Thống kê thời gian chờ trung bình của bệnh nhân qua từng
 *    khâu (Tiếp đón → Khám & Chỉ định → Chụp MRI & AI → Đọc phim & Ký duyệt
 *    → Thanh toán) và tỷ lệ ca hoàn thành đúng hạn (SLA).
 *  - UC-HADM-11: Báo cáo đánh giá hiệu năng mô hình AI (số ca xử lý, tỷ lệ
 *    thành công, phân bố 4 nhóm bệnh lý) — consume endpoint có sẵn.
 *  - UC-HADM-03: Giám sát tải công việc bác sĩ (caseload realtime, cảnh báo
 *    vượt định mức maxCaseload) — consume endpoint có sẵn.
 *
 * Nguồn dữ liệu:
 *   GET /api/v1/reports/sla?days=30        (mới — W.5)
 *   GET /api/v1/reports/ai-performance     (W.2 — FE chưa từng consume)
 *   GET /api/v1/clinical-view/doctor-caseloads (đã có — FE chưa từng consume)
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
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { get } from '../services/api.service';
import {
  Gauge,
  BrainCircuit,
  Stethoscope,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';

// Khoảng thời gian báo cáo (UC-HADM-12 — mặc định 30 ngày)
const RANGE_TABS = [
  { key: '7', label: '7 ngày' },
  { key: '30', label: '30 ngày' },
  { key: '90', label: '90 ngày' },
];

const fmtMinutes = (m) => {
  if (m == null) return '—';
  if (m < 60) return `${Math.round(m)} phút`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return rest > 0 ? `${h} giờ ${rest} phút` : `${h} giờ`;
};

const fmtNumber = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN'));

const TUMOR_LABELS = {
  glioma: 'Glioma (u thần kinh đệm)',
  meningioma: 'U màng não',
  pituitary: 'U tuyến yên',
  no_tumor: 'Không phát hiện u',
};

export default function SlaReportScreen({ navigation }) {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sla, setSla] = useState(null);
  const [ai, setAi] = useState(null);
  const [caseloads, setCaseloads] = useState(null);
  const [error, setError] = useState('');

  // ── Tải đồng thời 3 nguồn báo cáo ─────────────────────────────────────────
  const fetchAll = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [slaRes, aiRes, caseloadRes] = await Promise.all([
        get(`/api/v1/reports/sla?days=${days}`),
        get('/api/v1/reports/ai-performance').catch(() => null),
        get('/api/v1/clinical-view/doctor-caseloads').catch(() => null),
      ]);
      if (slaRes && slaRes.success) setSla(slaRes.data || null);
      else setError((slaRes && slaRes.message) || 'Không tải được báo cáo SLA.');
      if (aiRes && aiRes.success) setAi(aiRes.data || null);
      if (caseloadRes && caseloadRes.success) setCaseloads(caseloadRes.data || null);
    } catch (err) {
      console.error('Lỗi tải báo cáo năng suất & SLA:', err);
      setError(err.message || 'Không thể tải báo cáo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const journeys = sla?.journeys;
  const stages = sla?.stages || [];
  const maxAvg = Math.max(1, ...stages.map((s) => s.avgWaitMinutes || 0));
  const caseloadList = caseloads?.caseloads || [];
  const tumorTotal = ai ? Object.values(ai.tumorDistribution || {}).reduce((s, v) => s + v, 0) : 0;

  // ── Thẻ số liệu tổng quan hành trình ──────────────────────────────────────
  const renderJourneyCards = () => {
    if (!journeys) return null;
    const slaPct = journeys.slaRatePercentage;
    const slaColor = slaPct == null ? Colors.slateMuted : slaPct >= 90 ? Colors.emerald : slaPct >= 70 ? '#B45309' : '#B91C1C';
    const cards = [
      {
        icon: <CheckCircle2 size={20} color={slaColor} />,
        label: 'Ca hoàn thành đúng hạn (SLA)',
        value: slaPct == null ? '—' : `${slaPct}%`,
        sub: slaPct == null ? 'Chưa có dữ liệu' : `${journeys.onTimeCompletedVisits}/${journeys.completedVisits} ca trọn vẹn hành trình`,
      },
      {
        icon: <Clock size={20} color={Colors.primary} />,
        label: 'Thời gian hành trình TB',
        value: fmtMinutes(journeys.avgEndToEndMinutes),
        sub: 'Từ tiếp đón đến thanh toán',
      },
      {
        icon: <TrendingUp size={20} color="#7E22CE" />,
        label: 'Khâu chậm nhất',
        value: journeys.slowestStage ? journeys.slowestStage.label : '—',
        sub: journeys.slowestStage ? `Trung bình ${fmtMinutes(journeys.slowestStage.avgWaitMinutes)}` : 'Chưa đo được',
        small: true,
      },
      {
        icon: <Gauge size={20} color={Colors.brandGreen} />,
        label: 'Lượt khám trong kỳ',
        value: fmtNumber(journeys.totalVisits),
        sub: `${journeys.completedVisits} hoàn tất · ${journeys.inProgressVisits} đang xử lý`,
      },
    ];
    return (
      <View style={styles.statGrid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.statCard}>
            <View style={styles.statIcon}>{c.icon}</View>
            <Text style={styles.statLabel}>{c.label}</Text>
            <Text style={[styles.statValue, c.small && styles.statValueSmall]} numberOfLines={2}>
              {c.value}
            </Text>
            <Text style={styles.statSub}>{c.sub}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Bar thời gian chờ 5 khâu + SLA từng khâu ─────────────────────────────
  const renderStageRows = () => (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Thời gian chờ trung bình qua từng khâu</Text>
      <Text style={styles.panelDesc}>
        Từ lúc khâu mở ra đến khi hoàn tất (gồm chờ và thực hiện). Thanh dài hơn = bệnh nhân chờ lâu hơn.
      </Text>
      {stages.map((s) => {
        const pct = s.avgWaitMinutes ? Math.max(4, Math.round((s.avgWaitMinutes / maxAvg) * 100)) : 0;
        const stageSla = s.slaRatePercentage;
        const stageSlaColor = stageSla == null ? Colors.slateMuted : stageSla >= 90 ? Colors.emerald : stageSla >= 70 ? '#B45309' : '#B91C1C';
        return (
          <View key={s.key} style={styles.stageRow}>
            <View style={styles.stageHead}>
              <Text style={styles.stageLabel}>{s.label}</Text>
              <Text style={styles.stageValue}>{fmtMinutes(s.avgWaitMinutes)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <View style={styles.stageMeta}>
              <Text style={styles.stageMetaText}>
                {fmtNumber(s.completedCount)} lượt hoàn tất
                {s.inProgressCount > 0 ? ` · ${s.inProgressCount} đang làm` : ''}
                {s.longestWaitMinutes != null ? ` · dài nhất ${fmtMinutes(s.longestWaitMinutes)}` : ''}
              </Text>
              <Text style={[styles.stageSla, { color: stageSlaColor }]}>
                {stageSla == null ? 'SLA: chưa có hạn chuẩn' : `SLA: ${stageSla}% (${s.slaMetCount}/${s.slaTotalWithDeadline} đúng hạn)`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  // ── Hiệu năng mô hình AI (UC-HADM-11) ─────────────────────────────────────
  const renderAiPanel = () => {
    if (!ai) return null;
    const total = ai.totalJobsProcessed || 0;
    return (
      <View style={styles.panel}>
        <View style={styles.panelHeadRow}>
          <BrainCircuit size={18} color={Colors.primary} />
          <Text style={styles.panelTitle}>Hiệu năng mô hình AI</Text>
        </View>
        <Text style={styles.panelDesc}>Tổng quan pipeline phân đoạn tổn thương não trên phim MRI (UC-HADM-11).</Text>
        <View style={styles.aiGrid}>
          <View style={styles.aiCell}>
            <Text style={styles.aiValue}>{fmtNumber(total)}</Text>
            <Text style={styles.aiLabel}>Ca AI đã xử lý</Text>
          </View>
          <View style={styles.aiCell}>
            <Text style={styles.aiValue}>{ai.successRatePercentage ?? '—'}%</Text>
            <Text style={styles.aiLabel}>Tỷ lệ thành công</Text>
          </View>
          <View style={styles.aiCell}>
            <Text style={styles.aiValue}>{fmtMinutes((ai.averageProcessingTimeSeconds || 0) / 60)}</Text>
            <Text style={styles.aiLabel}>Thời gian xử lý TB</Text>
          </View>
          <View style={styles.aiCell}>
            <Text style={[styles.aiValue, ai.failedJobs > 0 && { color: '#B91C1C' }]}>{fmtNumber(ai.failedJobs)}</Text>
            <Text style={styles.aiLabel}>Ca thất bại</Text>
          </View>
        </View>
        {tumorTotal > 0 ? (
          <View style={styles.tumorBox}>
            <Text style={styles.tumorTitle}>Phân bố kết quả chẩn đoán ({tumorTotal} ca có báo cáo AI)</Text>
            {Object.entries(ai.tumorDistribution || {}).map(([k, v]) => (
              <View key={k} style={styles.tumorRow}>
                <Text style={styles.tumorLabel}>{TUMOR_LABELS[k] || k}</Text>
                <Text style={styles.tumorValue}>
                  {v} ca · {Math.round((v / tumorTotal) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  // ── Caseload bác sĩ (UC-HADM-03) ─────────────────────────────────────────
  const renderCaseloadPanel = () => {
    if (!caseloads) return null;
    return (
      <View style={styles.panel}>
        <View style={styles.panelHeadRow}>
          <Stethoscope size={18} color={Colors.brandGreen} />
          <Text style={styles.panelTitle}>Tải công việc bác sĩ (thời gian thực)</Text>
        </View>
        <Text style={styles.panelDesc}>
          Số ca đang xử lý của từng bác sĩ so với định mức tối đa{caseloads.overloaded > 0 ? ` · ${fmtNumber(caseloads.overloaded)} bác sĩ đang vượt định mức` : ' · toàn bộ đang trong định mức'}.
        </Text>
        {caseloadList.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có bác sĩ nào trong bệnh viện.</Text>
        ) : (
          caseloadList.map((d) => {
            const util = d.utilizationPercent || 0;
            const utilColor = d.isOverloaded ? '#B91C1C' : util >= 70 ? '#B45309' : Colors.emerald;
            return (
              <View key={d.doctorId} style={styles.doctorRow}>
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.doctorMeta} numberOfLines={1}>
                    {d.isOnCall ? 'Đang trực On-Call' : 'Không trực'} · {d.currentCaseload}/{d.maxCaseload} ca
                  </Text>
                </View>
                {d.isOverloaded ? (
                  <View style={styles.overloadBadge}>
                    <AlertTriangle size={12} color="#FFFFFF" />
                    <Text style={styles.overloadText}>Vượt định mức</Text>
                  </View>
                ) : (
                  <Text style={[styles.utilText, { color: utilColor }]}>{util}%</Text>
                )}
              </View>
            );
          })
        )}
        {(caseloads.warnings || []).map((w) => (
          <View key={w} style={styles.warnBox}>
            <AlertTriangle size={14} color="#B45309" />
            <Text style={styles.warnText}>{w}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="SlaReport">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Năng suất & Thời gian Chờ"
          subtitle="Thời gian chờ trung bình qua từng khâu khám, tỷ lệ hoàn thành đúng hạn (SLA), hiệu năng AI và tải công việc bác sĩ (UC-HADM-12 · 11 · 03)."
          actions={!loading ? (
            <HeaderAction icon="refresh-cw" label="Làm mới" onPress={() => fetchAll()} />
          ) : null}
          below={<PageTabs tabs={RANGE_TABS} value={days} onChange={setDays} />}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll({ silent: true }); }}
              tintColor={Colors.brandGreen}
            />
          }
        >
          <PageContainer spaced>
            {loading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={Colors.brandGreen} />
                <Text style={styles.emptyText}>Đang tổng hợp số liệu vận hành…</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyBox}>
                <AlertTriangle size={26} color="#B91C1C" />
                <Text style={styles.emptyTitle}>Không tải được báo cáo</Text>
                <Text style={styles.emptyText}>{error}</Text>
              </View>
            ) : (
              <>
                {renderJourneyCards()}
                {renderStageRows()}
                {renderAiPanel()}
                {renderCaseloadPanel()}
              </>
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

  // ── Thẻ tổng quan hành trình ──
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flexBasis: '23%', minWidth: 220, flexGrow: 1,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: Colors.border || '#E2E8F0',
    padding: 16, gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', color: Colors.slateMuted || '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.slateDark || '#0F172A' },
  statValueSmall: { fontSize: 15, lineHeight: 20 },
  statSub: { fontSize: 12, color: Colors.slateMuted || '#64748B' },

  // ── Panel chung ──
  panel: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: Colors.border || '#E2E8F0',
    padding: 18, gap: 8,
  },
  panelHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontSize: 16, fontWeight: '700', color: Colors.slateDark || '#0F172A' },
  panelDesc: { fontSize: 13, color: Colors.slateMuted || '#64748B', marginBottom: 6 },

  // ── Bar 5 khâu ──
  stageRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 6 },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageLabel: { fontSize: 14, fontWeight: '600', color: Colors.slateDark || '#0F172A', flex: 1, flexWrap: 'wrap' },
  stageValue: { fontSize: 14, fontWeight: '800', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.brandGreen },
  stageMeta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  stageMetaText: { fontSize: 12, color: Colors.slateMuted || '#64748B', flex: 1 },
  stageSla: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ── Hiệu năng AI ──
  aiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aiCell: {
    flexBasis: '22%', minWidth: 150, flexGrow: 1, backgroundColor: Colors.primaryMuted || '#ECFEFF',
    borderRadius: 12, padding: 14, alignItems: 'center', gap: 4,
  },
  aiValue: { fontSize: 22, fontWeight: '800', color: '#0E7490', fontVariant: ['tabular-nums'] },
  aiLabel: { fontSize: 12, color: '#0E7490', textAlign: 'center' },
  tumorBox: { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 6 },
  tumorTitle: { fontSize: 13, fontWeight: '700', color: Colors.slateDark || '#0F172A' },
  tumorRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  tumorLabel: { fontSize: 13, color: Colors.slateMuted || '#64748B' },
  tumorValue: { fontSize: 13, fontWeight: '700', color: Colors.slateDark || '#0F172A', fontVariant: ['tabular-nums'] },

  // ── Caseload bác sĩ ──
  doctorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10,
  },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 14, fontWeight: '700', color: Colors.slateDark || '#0F172A' },
  doctorMeta: { fontSize: 12, color: Colors.slateMuted || '#64748B', marginTop: 2 },
  utilText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  overloadBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#B91C1C',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  overloadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB',
    borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A', padding: 10, marginTop: 6,
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600' },

  // ── Trạng thái rỗng / lỗi ──
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 48, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: Colors.border || '#E2E8F0' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark || '#0F172A' },
  emptyText: { fontSize: 13, color: Colors.slateMuted || '#64748B', textAlign: 'center', paddingHorizontal: 20 },
});
