import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import {
  UserPlus, Wallet, ShieldCheck, Users, Clock3, ReceiptText, BadgeCheck, ArrowRight,
  CalendarClock, Inbox, RefreshCw, Stethoscope,
} from 'lucide-react';
import { get } from '../../services/api.service';
import ClinicalStatusBadge from '../ClinicalStatusBadge';
import { Reveal, CountUp } from '../ui/Motion';
import { ReceptionBanner, RECEPTION_IMAGES, Avatar, EmptyState, formatVnd, personName } from './ReceptionUI';

const isWeb = Platform.OS === 'web';
const SHIFT_LABELS = { 'sáng': 'Ca Sáng', 'chiều': 'Ca Chiều', 'tối': 'Ca Tối', 'cả ngày': 'Cả Ngày' };

const greetingOf = (d) => {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};
const isToday = (date) => date && new Date(date).toDateString() === new Date().toDateString();
const timeOf = (date) => new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// Đồng hồ chạy theo giây ở góc hero
const LiveClock = ({ shift }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={s.clock}>
      <View style={s.clockRow}>
        <View style={s.liveDot} dataSet={{ anim: 'ping' }} />
        <Text style={s.clockLabel}>Quầy đang mở</Text>
      </View>
      <Text style={s.clockTime}>{now.toLocaleTimeString('vi-VN', { hour12: false })}</Text>
      <Text style={s.clockDate}>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
      <View style={s.clockShift}>
        <CalendarClock size={14} color="#6FDDB2" />
        <Text style={s.clockShiftText}>
          {shift ? `${SHIFT_LABELS[shift.shift] || shift.shift}${shift.startTime ? ` · ${shift.startTime} - ${shift.endTime}` : ''}` : 'Hôm nay chưa có ca đăng ký'}
        </Text>
      </View>
    </View>
  );
};

const ReceptionistHome = ({ user, navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width > 1100;
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [shift, setShift] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, invRes, schRes] = await Promise.all([
        get('/api/v1/visits/my-queue').catch(() => null),
        get('/api/v1/invoices').catch(() => null),
        get('/api/v1/schedules/my-schedule').catch(() => null),
      ]);
      setVisits(qRes?.visits || []);
      setInvoices(invRes?.invoices || []);
      const list = schRes?.data?.schedules;
      setShift(Array.isArray(list) ? list.find((x) => isToday(x.date)) || null : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const pending = invoices.filter((i) => i.status === 'chờ thanh toán');
    const paidToday = invoices.filter((i) => i.status === 'đã thanh toán' && isToday(i.paidAt || i.updatedAt));
    const owed = (i) => i.patientPayAmount ?? ((i.totalAmount || 0) - (i.bhytInfo?.bhytAmount || 0));
    return {
      visitsToday: visits.length,
      pendingCount: pending.length,
      pendingTotal: pending.reduce((sum, i) => sum + owed(i), 0),
      collectedToday: paidToday.reduce((sum, i) => sum + owed(i), 0),
      bhytCount: invoices.filter((i) => (i.bhytInfo?.bhytAmount || 0) > 0).length,
      pending,
    };
  }, [visits, invoices]);

  const go = (tab) => navigation.navigate('NurseReception', { tab });
  const name = (user?.profile?.name || user?.profile?.fullName || 'Lễ tân').replace(/\s*\(.*\)\s*$/, '');

  // Ẩn thanh tiêu đề mặc định của navigator (đã có sidebar)
  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const kpis = [
    { icon: Users, label: 'Lượt tiếp đón hôm nay', value: stats.visitsToday, color: '#1A5FD0', bg: '#E7F0FE' },
    { icon: ReceiptText, label: 'Hóa đơn chờ thu', value: stats.pendingCount, color: '#D97706', bg: '#FEF3C7', hint: formatVnd(stats.pendingTotal) },
    { icon: Wallet, label: 'Đã thu hôm nay', value: stats.collectedToday, money: true, color: '#0F9D6B', bg: '#E3F7EF' },
    { icon: ShieldCheck, label: 'Hóa đơn có BHYT', value: stats.bhytCount, color: '#7C3AED', bg: '#F3EEFF' },
  ];

  const actions = [
    { icon: UserPlus, title: 'Tiếp nhận bệnh nhân', desc: 'Chọn bệnh nhân, phân công bác sĩ & điều dưỡng', tab: 'createVisit', bg: '#1A5FD0', shade: '#144BA8' },
    { icon: Wallet, title: 'Thu ngân', desc: stats.pendingCount ? `${stats.pendingCount} hóa đơn đang chờ thu` : 'Không có hóa đơn chờ', tab: 'billing', bg: '#0F9D6B', shade: '#0B7A53' },
    { icon: Clock3, title: 'Lượt khám hôm nay', desc: 'Theo dõi trạng thái từng bệnh nhân', tab: 'myQueue', bg: '#4F46E5', shade: '#3730A3' },
  ];

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      <ReceptionBanner
        image={RECEPTION_IMAGES.lobby}
        tone="navy"
        eyebrow={`${greetingOf(new Date())},`}
        title={name}
        subtitle="Bàn làm việc Tiếp đón & Thu ngân — mọi việc trong ngày ở một nơi."
        right={<LiveClock shift={shift} />}
      >
        <TouchableOpacity style={s.bannerBtn} onPress={() => go('createVisit')} dataSet={{ hover: 'glow' }}>
          <UserPlus size={16} color="#0B2A5B" />
          <Text style={s.bannerBtnText}>Tiếp nhận bệnh nhân mới</Text>
        </TouchableOpacity>
      </ReceptionBanner>

      {/* Số liệu trong ngày */}
      <View style={s.kpiRow}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Reveal key={k.label} delay={i * 90} style={[s.kpi, { width: isWide ? '23.6%' : '48.5%' }]} dataSet={{ hover: 'lift' }}>
              <View style={[s.kpiIcon, { backgroundColor: k.bg }]}><Icon size={20} color={k.color} /></View>
              {k.money
                ? <CountUp value={k.value} suffix="đ" style={[s.kpiValue, { color: k.color }]} />
                : <CountUp value={k.value} style={[s.kpiValue, { color: k.color }]} />}
              <Text style={s.kpiLabel}>{k.label}</Text>
              {k.hint ? <Text style={s.kpiHint}>Tổng {k.hint}</Text> : null}
              <View style={[s.kpiAccent, { backgroundColor: k.color }]} />
            </Reveal>
          );
        })}
      </View>

      {/* Thao tác nhanh */}
      <Text style={s.sectionTitle}>Bắt đầu nhanh</Text>
      <View style={s.actionRow}>
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <Reveal key={a.title} delay={i * 110} style={{ width: isWide ? '32.2%' : '100%' }}>
              <TouchableOpacity style={[s.action, { backgroundColor: a.bg }]} onPress={() => go(a.tab)} dataSet={{ hover: 'lift' }}>
                <View style={[s.actionBlob, { backgroundColor: a.shade }]} />
                <View style={s.actionIcon}><Icon size={24} color="#FFFFFF" /></View>
                <Text style={s.actionTitle}>{a.title}</Text>
                <Text style={s.actionDesc}>{a.desc}</Text>
                <View style={s.actionGo}>
                  <Text style={s.actionGoText}>Mở</Text>
                  <ArrowRight size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </Reveal>
          );
        })}
      </View>

      <View style={[s.twoCol, isWide && { flexDirection: 'row' }]}>
        {/* Dòng tiếp đón */}
        <Reveal style={[s.panel, isWide && { flex: 1.45 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>Dòng tiếp đón hôm nay</Text>
              <Text style={s.panelSub}>{stats.visitsToday} lượt · mới nhất ở trên cùng</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={load} dataSet={{ hover: 'tint' }}>
              <RefreshCw size={15} color="#1A5FD0" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#1A5FD0" style={{ marginVertical: 32 }} />
          ) : visits.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Chưa có bệnh nhân nào được tiếp nhận hôm nay"
              text="Lượt khám mới sẽ hiện ở đây theo thời gian thực sau khi bạn tạo."
              actionLabel="Tiếp nhận bệnh nhân đầu tiên"
              onAction={() => go('createVisit')}
            />
          ) : (
            visits.slice(0, 8).map((v, i) => (
              <TouchableOpacity
                key={v._id}
                style={s.tlRow}
                dataSet={{ hover: 'tint' }}
                onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } })}
              >
                <View style={s.tlTimeCol}>
                  <Text style={s.tlTime}>{timeOf(v.createdAt)}</Text>
                  {i < Math.min(visits.length, 8) - 1 && <View style={s.tlLine} />}
                </View>
                <Avatar name={personName(v.patientId)} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.tlName} numberOfLines={1}>{personName(v.patientId)}</Text>
                  <View style={s.tlMeta}>
                    <Stethoscope size={12} color="#64748B" />
                    <Text style={s.tlMetaText} numberOfLines={1}>{personName(v.doctorId)} · {v.reason || 'Khám tổng quát'}</Text>
                  </View>
                </View>
                {v.priority === 'khẩn cấp' && <View style={s.urgent}><Text style={s.urgentText}>CẤP CỨU</Text></View>}
                <ClinicalStatusBadge status={v.status} size="sm" />
              </TouchableOpacity>
            ))
          )}
        </Reveal>

        {/* Hàng chờ thu ngân */}
        <Reveal delay={120} style={[s.panel, s.cashPanel, isWide && { flex: 1 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>Hàng chờ thu ngân</Text>
              <Text style={s.panelSub}>Tổng cần thu {formatVnd(stats.pendingTotal)}</Text>
            </View>
            <View style={s.countBubble}><Text style={s.countBubbleText}>{stats.pendingCount}</Text></View>
          </View>
          {stats.pending.length === 0 ? (
            <EmptyState icon={BadgeCheck} tint="#0F9D6B" title="Đã thu hết" text="Không còn hóa đơn nào chờ thanh toán." />
          ) : (
            stats.pending.slice(0, 5).map((inv) => (
              <View key={inv._id} style={s.receipt}>
                <View style={s.receiptNotchL} />
                <View style={s.receiptNotchR} />
                <View style={{ flex: 1 }}>
                  <Text style={s.receiptName} numberOfLines={1}>{personName(inv.patientId)}</Text>
                  <Text style={s.receiptMeta} numberOfLines={1}>
                    {(inv.items || []).map((it) => it.description).join(' · ') || 'Viện phí'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.receiptAmount}>{formatVnd(inv.patientPayAmount ?? ((inv.totalAmount || 0) - (inv.bhytInfo?.bhytAmount || 0)))}</Text>
                  <TouchableOpacity onPress={() => go('billing')}><Text style={s.receiptGo}>Thu ngay →</Text></TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Reveal>
      </View>
    </ScrollView>
  );
};

const shadow = isWeb ? { boxShadow: '0 10px 30px -18px rgba(11,42,91,0.35)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F8FC' },
  pageContent: { padding: 28, paddingBottom: 48, maxWidth: 1320, width: '100%', alignSelf: 'center', gap: 22 },

  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999, marginTop: 20 },
  bannerBtnText: { color: '#0B2A5B', fontWeight: '800', fontSize: 13 },

  clock: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: 18, minWidth: 240, ...(isWeb ? { backdropFilter: 'blur(8px)' } : {}) },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  clockLabel: { color: '#A7F3D0', fontSize: 12, fontWeight: '700' },
  clockTime: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', letterSpacing: 1, marginTop: 6, fontVariant: ['tabular-nums'] },
  clockDate: { color: '#DBEAFE', fontSize: 13, textTransform: 'capitalize' },
  clockShift: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  clockShiftText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  kpi: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', ...shadow },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiValue: { fontSize: 28, fontWeight: '800' },
  kpiLabel: { fontSize: 13, color: '#475569', marginTop: 2, fontWeight: '600' },
  kpiHint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  kpiAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0B2A5B', marginBottom: -8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  action: { borderRadius: 20, padding: 22, minHeight: 168, overflow: 'hidden', position: 'relative' },
  actionBlob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, top: -60, opacity: 0.7 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  actionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  actionDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, lineHeight: 19 },
  actionGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  actionGoText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  twoCol: { gap: 18, alignItems: 'flex-start' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...shadow },
  cashPanel: { backgroundColor: '#FFFBF3', borderColor: '#FDE7C2' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  panelSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E7F0FE', alignItems: 'center', justifyContent: 'center' },
  countBubble: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countBubbleText: { color: '#FFFFFF', fontWeight: '800' },

  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  tlTimeCol: { width: 48, alignItems: 'center', alignSelf: 'stretch' },
  tlTime: { fontSize: 12, fontWeight: '700', color: '#1A5FD0', marginTop: 10 },
  tlLine: { flex: 1, width: 2, backgroundColor: '#DBEAFE', marginTop: 6, marginBottom: -16 },
  tlName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  tlMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tlMetaText: { fontSize: 12, color: '#64748B', flexShrink: 1 },
  urgent: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentText: { color: '#DC2626', fontSize: 10, fontWeight: '800' },

  receipt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 10, borderWidth: 1, borderColor: '#F3E3C3', borderStyle: 'dashed', position: 'relative', overflow: 'hidden' },
  receiptNotchL: { position: 'absolute', left: -8, top: '50%', marginTop: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFBF3' },
  receiptNotchR: { position: 'absolute', right: -8, top: '50%', marginTop: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFBF3' },
  receiptName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  receiptMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  receiptAmount: { fontSize: 16, fontWeight: '800', color: '#B45309' },
  receiptGo: { fontSize: 12, fontWeight: '700', color: '#0F9D6B', marginTop: 2 },
});

export default ReceptionistHome;
