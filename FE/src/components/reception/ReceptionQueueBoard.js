import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { RefreshCw, UserPlus, Hourglass, Stethoscope, Siren, Volume2, Inbox, Timer } from 'lucide-react';
import { get } from '../../services/api.service';
import ClinicalStatusBadge from '../ClinicalStatusBadge';
import { Reveal } from '../ui/Motion';
import { ReceptionBanner, RECEPTION_IMAGES, Avatar, EmptyState, personName } from './ReceptionUI';

const isWeb = Platform.OS === 'web';
const WAITING = ['đang chờ', 'tái khám định kỳ'];
const IN_EXAM = ['đang khám'];

const minutesSince = (date, now) => Math.max(0, Math.round((now - new Date(date).getTime()) / 60000));
const formatWait = (m) => (m >= 60 ? `${Math.floor(m / 60)}g ${m % 60}p` : `${m} phút`);
const pad = (n) => String(n).padStart(3, '0');
const idOf = (ref) => ref?._id || ref;

// Màn hình "gọi số" dành cho lễ tân: mỗi bác sĩ một làn, kèm danh sách chờ theo số thứ tự
const ReceptionQueueBoard = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width > 1180;
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        get('/api/v1/visits/my-queue').catch(() => null),
        get('/api/v1/visits/staff').catch(() => null),
      ]);
      setVisits(vRes?.visits || []);
      setDoctors(sRes?.doctors || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Cập nhật thời gian chờ mỗi 30 giây
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const data = useMemo(() => {
    // Số thứ tự theo giờ tiếp nhận trong ngày
    const ordered = [...visits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const numberOf = new Map(ordered.map((v, i) => [v._id, pad(i + 1)]));
    const waiting = ordered
      .filter((v) => WAITING.includes(v.status))
      .sort((a, b) => (b.priority === 'khẩn cấp') - (a.priority === 'khẩn cấp') || new Date(a.createdAt) - new Date(b.createdAt));
    const inExam = ordered.filter((v) => IN_EXAM.includes(v.status));
    const lanes = doctors.map((d) => ({
      doctor: d,
      current: inExam.find((v) => idOf(v.doctorId) === d._id) || null,
      next: waiting.filter((v) => idOf(v.doctorId) === d._id).slice(0, 3),
      total: waiting.filter((v) => idOf(v.doctorId) === d._id).length,
    }));
    const avgWait = waiting.length
      ? Math.round(waiting.reduce((sum, v) => sum + minutesSince(v.createdAt, now), 0) / waiting.length)
      : 0;
    return { numberOf, waiting, inExam, lanes, avgWait };
  }, [visits, doctors, now]);

  const openVisit = (v) => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } });

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      <ReceptionBanner
        image={RECEPTION_IMAGES.waiting}
        tone="ocean"
        eyebrow="Sảnh chờ khám"
        title="Hàng chờ ca khám"
        subtitle="Theo dõi bệnh nhân đang chờ từng bác sĩ, số đang được gọi và thời gian chờ thực tế."
        right={(
          <View style={s.bannerStats}>
            <View style={s.bannerStat}>
              <Hourglass size={16} color="#BFE5D6" />
              <Text style={s.bannerStatValue}>{data.waiting.length}</Text>
              <Text style={s.bannerStatLabel}>đang chờ</Text>
            </View>
            <View style={s.bannerStat}>
              <Stethoscope size={16} color="#BFE5D6" />
              <Text style={s.bannerStatValue}>{data.inExam.length}</Text>
              <Text style={s.bannerStatLabel}>đang khám</Text>
            </View>
            <View style={s.bannerStat}>
              <Timer size={16} color="#BFE5D6" />
              <Text style={s.bannerStatValue}>{data.avgWait}<Text style={{ fontSize: 14 }}>p</Text></Text>
              <Text style={s.bannerStatLabel}>chờ trung bình</Text>
            </View>
          </View>
        )}
      >
        <View style={s.bannerActions}>
          <TouchableOpacity style={s.bannerBtn} onPress={() => navigation.navigate('NurseReception', { tab: 'createVisit' })} dataSet={{ hover: 'glow' }}>
            <UserPlus size={16} color="#082F49" />
            <Text style={s.bannerBtnText}>Tiếp nhận bệnh nhân</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bannerGhost} onPress={load}>
            <RefreshCw size={15} color="#FFFFFF" />
            <Text style={s.bannerGhostText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      </ReceptionBanner>

      {loading ? (
        <ActivityIndicator size="large" color="#0369A1" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Bảng gọi số theo bác sĩ */}
          <Reveal style={s.display}>
            <View style={s.displayHead}>
              <Volume2 size={18} color="#34D399" />
              <Text style={s.displayTitle}>BẢNG GỌI SỐ PHÒNG KHÁM</Text>
              <View style={s.displayLive}><View style={s.liveDot} dataSet={{ anim: 'ping' }} /><Text style={s.displayLiveText}>TRỰC TIẾP</Text></View>
            </View>
            <View style={[s.lanes, isWide && { flexDirection: 'row' }]}>
              {data.lanes.map((lane, i) => (
                <View key={lane.doctor._id} style={[s.lane, isWide && { flex: 1 }]}>
                  <View style={s.laneHead}>
                    <Avatar name={personName(lane.doctor)} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.laneDoctor} numberOfLines={1}>{personName(lane.doctor)}</Text>
                      <Text style={s.laneRoom}>Phòng khám {String(i + 1).padStart(2, '0')} · {lane.total} đang chờ</Text>
                    </View>
                  </View>
                  <Text style={s.laneLabel}>ĐANG KHÁM</Text>
                  <Text style={[s.ledNumber, !lane.current && s.ledIdle]}>{lane.current ? data.numberOf.get(lane.current._id) : '---'}</Text>
                  <Text style={s.lanePatient} numberOfLines={1}>{lane.current ? personName(lane.current.patientId) : 'Phòng đang trống'}</Text>
                  <View style={s.laneDivider} />
                  <Text style={s.laneLabel}>TIẾP THEO</Text>
                  {lane.next.length === 0 ? (
                    <Text style={s.laneEmpty}>Không có bệnh nhân chờ</Text>
                  ) : lane.next.map((v) => (
                    <View key={v._id} style={s.nextRow}>
                      <Text style={s.nextNumber}>{data.numberOf.get(v._id)}</Text>
                      <Text style={s.nextName} numberOfLines={1}>{personName(v.patientId)}</Text>
                      {v.priority === 'khẩn cấp' && <Siren size={13} color="#F87171" />}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </Reveal>

          {/* Danh sách chờ */}
          <Reveal delay={120} style={s.card}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.cardTitle}>Danh sách chờ khám</Text>
                <Text style={s.cardSub}>Ca cấp cứu luôn được ưu tiên lên đầu · thời gian chờ tự cập nhật</Text>
              </View>
            </View>
            {data.waiting.length === 0 ? (
              <EmptyState
                icon={Inbox}
                tint="#0369A1"
                title="Không có bệnh nhân nào đang chờ"
                text="Bệnh nhân vừa được tiếp nhận sẽ xuất hiện ở đây kèm số thứ tự."
                actionLabel="Tiếp nhận bệnh nhân"
                onAction={() => navigation.navigate('NurseReception', { tab: 'createVisit' })}
              />
            ) : data.waiting.map((v, idx) => {
              const wait = minutesSince(v.createdAt, now);
              const level = wait >= 45 ? 'high' : wait >= 20 ? 'mid' : 'low';
              return (
                <TouchableOpacity key={v._id} style={[s.row, v.priority === 'khẩn cấp' && s.rowUrgent]} onPress={() => openVisit(v)} dataSet={{ hover: 'tint' }}>
                  <View style={[s.ticketNo, idx === 0 && s.ticketNoFirst]}>
                    <Text style={[s.ticketNoText, idx === 0 && { color: '#FFFFFF' }]}>{data.numberOf.get(v._id)}</Text>
                  </View>
                  <Avatar name={personName(v.patientId)} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName} numberOfLines={1}>{personName(v.patientId)}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>BS. {personName(v.doctorId)} · {v.reason || 'Khám tổng quát'}</Text>
                  </View>
                  {v.priority === 'khẩn cấp' && (
                    <View style={s.urgent}><Siren size={12} color="#DC2626" /><Text style={s.urgentText}>Cấp cứu</Text></View>
                  )}
                  <View style={[s.wait, s[`wait_${level}`]]}>
                    <Timer size={12} color={level === 'high' ? '#DC2626' : level === 'mid' ? '#B45309' : '#0F9D6B'} />
                    <Text style={[s.waitText, { color: level === 'high' ? '#DC2626' : level === 'mid' ? '#B45309' : '#0F9D6B' }]}>{formatWait(wait)}</Text>
                  </View>
                  <ClinicalStatusBadge status={v.status} size="sm" />
                </TouchableOpacity>
              );
            })}
          </Reveal>
        </>
      )}
    </ScrollView>
  );
};

const shadow = isWeb ? { boxShadow: '0 12px 30px -20px rgba(8,47,73,0.4)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F8FB' },
  pageContent: { padding: 28, paddingBottom: 56, maxWidth: 1360, width: '100%', alignSelf: 'center', gap: 22 },

  bannerStats: { flexDirection: 'row', gap: 10 },
  bannerStat: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, minWidth: 104, gap: 2 },
  bannerStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  bannerStatLabel: { color: '#BFE5D6', fontSize: 11, fontWeight: '600' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  bannerBtnText: { color: '#082F49', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  display: { backgroundColor: '#04111F', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#0C2A44', ...(isWeb ? { boxShadow: '0 24px 50px -24px rgba(4,17,31,0.7)' } : { elevation: 6 }) },
  displayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  displayTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '800', letterSpacing: 2, flex: 1 },
  displayLive: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(52,211,153,0.12)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  displayLiveText: { color: '#6EE7B7', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  lanes: { gap: 14 },
  lane: { backgroundColor: '#0A1D33', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#12324F' },
  laneHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  laneDoctor: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  laneRoom: { color: '#7DD3FC', fontSize: 11, marginTop: 1 },
  laneLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  ledNumber: { color: '#34D399', fontSize: 52, fontWeight: '900', letterSpacing: 4, fontVariant: ['tabular-nums'], ...(isWeb ? { textShadow: '0 0 18px rgba(52,211,153,0.55)' } : {}) },
  ledIdle: { color: '#1E3A5F', ...(isWeb ? { textShadow: 'none' } : {}) },
  lanePatient: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  laneDivider: { height: 1, backgroundColor: '#12324F', marginVertical: 14 },
  laneEmpty: { color: '#475569', fontSize: 12, marginTop: 6 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  nextNumber: { color: '#FBBF24', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], width: 44 },
  nextName: { color: '#E2E8F0', fontSize: 13, flex: 1 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', ...shadow },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowUrgent: { backgroundColor: '#FEF2F2' },
  ticketNo: { width: 58, paddingVertical: 8, borderRadius: 12, backgroundColor: '#E7F6F0', alignItems: 'center' },
  ticketNoFirst: { backgroundColor: '#0369A1' },
  ticketNoText: { fontSize: 16, fontWeight: '900', color: '#0369A1', fontVariant: ['tabular-nums'] },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  urgentText: { color: '#DC2626', fontSize: 11, fontWeight: '800' },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  wait_low: { backgroundColor: '#E3F7EF' },
  wait_mid: { backgroundColor: '#FEF3C7' },
  wait_high: { backgroundColor: '#FEE2E2' },
  waitText: { fontSize: 11, fontWeight: '800' },
});

export default ReceptionQueueBoard;
