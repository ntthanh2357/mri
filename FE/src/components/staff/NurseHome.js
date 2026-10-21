import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import {
  HeartPulse, Megaphone, UserRound, ClipboardList, BedDouble, NotebookPen, ArrowRight, RefreshCw, Activity,
  BadgeCheck, Stethoscope, Siren, Users,
} from 'lucide-react';
import { get } from '../../services/api.service';
import { Reveal, CountUp } from '../ui/Motion';
import { StaffBanner, RECEPTION_IMAGES, LiveClock, Avatar, EmptyState, personName } from '../reception/ReceptionUI';

const isWeb = Platform.OS === 'web';

const greetingOf = (d) => {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};
const isToday = (date) => date && new Date(date).toDateString() === new Date().toDateString();
const hasVitals = (v) => v?.vitals?.pulse != null && !!v?.vitals?.bloodPressure;
const DONE = ['hoàn tất', 'đã đóng', 'đã hủy', 'no_show'];

/** Bàn làm việc Điều dưỡng — cùng phong cách trang chủ Lễ tân. */
const NurseHome = ({ user, navigation, onEditProfile }) => {
  const { width } = useWindowDimensions();
  const isWide = width > 1100;
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [records, setRecords] = useState([]);
  const [beds, setBeds] = useState(null);
  const [shift, setShift] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, emrRes, bedRes, schRes] = await Promise.all([
        get('/api/v1/visits/my-queue').catch(() => null),
        get('/emr/records').catch(() => null),
        get('/api/v1/hospital-beds/map-summary').catch(() => null),
        get('/api/v1/schedules/my-schedule').catch(() => null),
      ]);
      setVisits(qRes?.visits || []);
      setRecords(Array.isArray(emrRes?.data) ? emrRes.data : []);
      setBeds(bedRes?.data?.summary || null);
      const list = schRes?.data?.schedules;
      setShift(Array.isArray(list) ? list.find((x) => isToday(x.date)) || null : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions?.({ headerShown: false }); }, [navigation]);

  const stats = useMemo(() => {
    // Chờ đo sinh hiệu: lượt chưa kết thúc, chưa có sinh hiệu — cấp cứu lên đầu, đến trước lên trước
    const waiting = visits
      .filter((v) => !DONE.includes(v.status) && !hasVitals(v))
      .sort((a, b) => ((b.priority === 'khẩn cấp') - (a.priority === 'khẩn cấp')) || (new Date(a.createdAt) - new Date(b.createdAt)));
    const measuredToday = visits.filter((v) => hasVitals(v) && isToday(v.updatedAt || v.createdAt));
    const inpatients = records.filter((r) => r.admissionType === 'Nội trú' && r.status !== 'Đã xuất viện');
    return { waiting, measuredToday, inpatients, urgent: waiting.filter((v) => v.priority === 'khẩn cấp').length };
  }, [visits, records]);

  const name = (user?.profile?.name || user?.profile?.fullName || 'Điều dưỡng').replace(/\s*\(.*\)\s*$/, '');
  const openVisit = (v) => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } });

  const kpis = [
    { icon: HeartPulse, label: 'Chờ đo sinh hiệu', value: stats.waiting.length, color: '#D97706', bg: '#FEF3C7', hint: stats.urgent ? `${stats.urgent} ca cấp cứu` : null },
    { icon: BadgeCheck, label: 'Đã đo sinh hiệu', value: stats.measuredToday.length, color: '#0F9D6B', bg: '#E3F7EF' },
    { icon: NotebookPen, label: 'Nội trú cần theo dõi', value: stats.inpatients.length, color: '#7C3AED', bg: '#F3EEFF' },
    { icon: BedDouble, label: 'Giường trống', value: beds?.availableCount ?? 0, color: '#067A5E', bg: '#E7F6F0', hint: beds ? `trên tổng ${beds.totalBeds} giường` : null },
  ];

  const actions = [
    { icon: Megaphone, title: 'Gọi đo sinh hiệu', desc: stats.waiting.length ? `${stats.waiting.length} người đang chờ gọi` : 'Chưa có bệnh nhân chờ', bg: '#067A5E', shade: '#05634D', go: () => navigation.navigate('NurseTriage') },
    { icon: ClipboardList, title: 'Nhập sinh hiệu', desc: 'Phiếu khám, chỉ định & lập phiếu thu', bg: '#0F9D6B', shade: '#0B7A53', go: () => navigation.navigate('NurseReception', { tab: 'myQueue' }) },
    { icon: NotebookPen, title: 'Phiếu chăm sóc', desc: 'Theo dõi người bệnh nội trú trong ca', bg: '#7C3AED', shade: '#6D28D9', go: () => navigation.navigate('EMRDashboard', { tab: 'care' }) },
    { icon: BedDouble, title: 'Sơ đồ giường bệnh', desc: beds ? `${beds.availableCount}/${beds.totalBeds} giường đang trống` : 'Phân bổ buồng giường nội trú', bg: '#4F46E5', shade: '#3730A3', go: () => navigation.navigate('EMRDashboard', { tab: 'beds' }) },
  ];

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      <StaffBanner
        image={RECEPTION_IMAGES.tabletScan}
        tone="teal"
        eyebrow={`${greetingOf(new Date())},`}
        title={name}
        subtitle="Bàn làm việc Điều dưỡng — gọi đo sinh hiệu, chăm sóc nội trú và theo dõi giường bệnh."
        right={<LiveClock label="Đang trong ca" shift={shift} />}
      >
        <View style={s.bannerBtns}>
        <TouchableOpacity style={s.bannerBtn} onPress={() => navigation.navigate('NurseTriage')} dataSet={{ hover: 'glow' }}>
          <Megaphone size={16} color="#064E4A" />
          <Text style={s.bannerBtnText}>Gọi bệnh nhân đo sinh hiệu</Text>
        </TouchableOpacity>
        {onEditProfile ? (
          <TouchableOpacity style={s.bannerGhost} onPress={onEditProfile} dataSet={{ hover: 'glow' }}>
            <UserRound size={16} color="#FFFFFF" />
            <Text style={s.bannerGhostText}>Hồ sơ cá nhân</Text>
          </TouchableOpacity>
        ) : null}
        </View>
      </StaffBanner>

      <View style={s.kpiRow}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Reveal key={k.label} delay={i * 90} style={[s.kpi, { width: isWide ? '23.6%' : '48.5%' }]} dataSet={{ hover: 'lift' }}>
              <View style={[s.kpiIcon, { backgroundColor: k.bg }]}><Icon size={20} color={k.color} /></View>
              <CountUp value={k.value} style={[s.kpiValue, { color: k.color }]} />
              <Text style={s.kpiLabel}>{k.label}</Text>
              {k.hint ? <Text style={s.kpiHint}>{k.hint}</Text> : null}
              <View style={[s.kpiAccent, { backgroundColor: k.color }]} />
            </Reveal>
          );
        })}
      </View>

      <Text style={s.sectionTitle}>Bắt đầu nhanh</Text>
      <View style={s.actionRow}>
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <Reveal key={a.title} delay={i * 100} style={{ width: isWide ? '23.9%' : '48.5%' }}>
              <TouchableOpacity style={[s.action, { backgroundColor: a.bg }]} onPress={a.go} dataSet={{ hover: 'lift' }}>
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
        {/* Hàng chờ đo sinh hiệu */}
        <Reveal style={[s.panel, isWide && { flex: 1.45 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>Chờ đo sinh hiệu</Text>
              <Text style={s.panelSub}>{stats.waiting.length} bệnh nhân · cấp cứu luôn ở trên cùng</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={load} dataSet={{ hover: 'tint' }}>
              <RefreshCw size={15} color="#067A5E" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#067A5E" style={{ marginVertical: 32 }} />
          ) : stats.waiting.length === 0 ? (
            <EmptyState icon={HeartPulse} tint="#0F9D6B" title="Không còn bệnh nhân chờ đo" text="Bệnh nhân lễ tân vừa tiếp nhận sẽ hiện ở đây." />
          ) : (
            stats.waiting.slice(0, 7).map((v, i) => (
              <TouchableOpacity key={v._id} style={s.tlRow} dataSet={{ hover: 'tint' }} onPress={() => openVisit(v)}>
                <View style={s.tlTimeCol}>
                  <Text style={s.tlTime}>{new Date(v.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  {!isToday(v.createdAt) ? <Text style={s.tlDate}>{new Date(v.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</Text> : null}
                  {i < Math.min(stats.waiting.length, 7) - 1 && <View style={s.tlLine} />}
                </View>
                <Avatar name={personName(v.patientId)} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.tlName} numberOfLines={1}>{personName(v.patientId)}</Text>
                  <View style={s.tlMeta}>
                    <Stethoscope size={12} color="#64748B" />
                    <Text style={s.tlMetaText} numberOfLines={1}>{v.reason || 'Khám tổng quát'} · {personName(v.doctorId)}</Text>
                  </View>
                </View>
                {v.priority === 'khẩn cấp' && (
                  <View style={s.urgent}><Siren size={11} color="#DC2626" /><Text style={s.urgentText}>CẤP CỨU</Text></View>
                )}
                <View style={s.measureBtn}><Activity size={13} color="#FFFFFF" /><Text style={s.measureBtnText}>Đo ngay</Text></View>
              </TouchableOpacity>
            ))
          )}
        </Reveal>

        {/* Người bệnh nội trú */}
        <Reveal delay={120} style={[s.panel, s.wardPanel, isWide && { flex: 1 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>Nội trú cần theo dõi</Text>
              <Text style={s.panelSub}>Ghi phiếu chăm sóc trong ca</Text>
            </View>
            <View style={s.countBubble}><Text style={s.countBubbleText}>{stats.inpatients.length}</Text></View>
          </View>
          {stats.inpatients.length === 0 ? (
            <EmptyState icon={Users} tint="#7C3AED" title="Không có bệnh nhân nội trú" text="Bệnh nhân nhập viện sẽ hiện ở đây để theo dõi trong ca." />
          ) : (
            stats.inpatients.slice(0, 5).map((r) => (
              <TouchableOpacity key={r._id} style={s.ward} onPress={() => navigation.navigate('EMRDashboard', { tab: 'care' })} dataSet={{ hover: 'lift' }}>
                <View style={s.wardIcon}><NotebookPen size={16} color="#7C3AED" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.wardName} numberOfLines={1}>{r.patientName}</Text>
                  <Text style={s.wardMeta} numberOfLines={1}>{r.diagnosis || r.department || 'Đang điều trị'}</Text>
                </View>
                <Text style={s.wardGo}>Ghi phiếu →</Text>
              </TouchableOpacity>
            ))
          )}
        </Reveal>
      </View>
    </ScrollView>
  );
};

const shadow = isWeb ? { boxShadow: '0 10px 30px -18px rgba(11,42,91,0.35)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F7FC' },
  pageContent: { padding: 28, paddingBottom: 48, maxWidth: 1320, width: '100%', alignSelf: 'center', gap: 22 },

  bannerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  bannerBtnText: { color: '#064E4A', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  kpi: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', ...shadow },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiValue: { fontSize: 28, fontWeight: '800' },
  kpiLabel: { fontSize: 13, color: '#475569', marginTop: 2, fontWeight: '600' },
  kpiHint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  kpiAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0B2A55', marginBottom: -8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  action: { borderRadius: 20, padding: 22, minHeight: 168, overflow: 'hidden', position: 'relative' },
  actionBlob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, top: -60, opacity: 0.7 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  actionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  actionDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, lineHeight: 19 },
  actionGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  actionGoText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  twoCol: { gap: 18, alignItems: 'flex-start' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...shadow },
  wardPanel: { backgroundColor: '#FAF7FF', borderColor: '#E9DDFD' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  panelSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E7F6F0', alignItems: 'center', justifyContent: 'center' },
  countBubble: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countBubbleText: { color: '#FFFFFF', fontWeight: '800' },

  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  tlTimeCol: { width: 58, alignItems: 'center', alignSelf: 'stretch' },
  tlTime: { fontSize: 12, fontWeight: '700', color: '#067A5E', marginTop: 10, textAlign: 'center' },
  tlDate: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  tlLine: { flex: 1, width: 2, backgroundColor: '#D3EFE4', marginTop: 6, marginBottom: -16 },
  tlName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  tlMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tlMetaText: { fontSize: 12, color: '#64748B', flexShrink: 1 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentText: { color: '#DC2626', fontSize: 10, fontWeight: '800' },
  measureBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#067A5E', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  measureBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  ward: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EDE4FE' },
  wardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center' },
  wardName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  wardMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  wardGo: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
});

export default NurseHome;
