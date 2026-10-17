import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
  CalendarPlus, RefreshCw, ChevronLeft, ChevronRight, CalendarClock, ClipboardList, ArrowLeftRight,
  CalendarDays, Users, Trash2, Plus, Coffee,
} from 'lucide-react';
import { Reveal } from '../ui/Motion';
import { ReceptionBanner, RECEPTION_IMAGES } from './ReceptionUI';

const isWeb = Platform.OS === 'web';
const SHORT_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const hoursOf = (start, end) => {
  const toMin = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null) return 0;
  return ((b - a + 1440) % 1440 || 1440) / 60;
};

/** Phần đầu trang lịch làm việc của lễ tân: banner + ca tiếp theo + thanh tab. */
export const ReceptionScheduleHeader = ({ nextShift, shiftConfig, weekHours, kpi, activeTab, onTab, onRegister, onRefresh }) => {
  const cfg = nextShift ? shiftConfig[nextShift.shift] || shiftConfig['sáng'] : null;
  const ShiftIcon = cfg?.icon;
  const tabs = [
    { key: 'my-schedule', label: 'Lịch của tôi', icon: CalendarDays },
    { key: 'weekly', label: 'Toàn khoa', icon: Users },
    { key: 'registrations', label: 'Đăng ký ca', icon: ClipboardList, count: kpi.pendingCount, color: '#D97706' },
    { key: 'swap', label: 'Đổi ca', icon: ArrowLeftRight, count: kpi.swapCount, color: '#7C3AED' },
  ];
  return (
    <View style={{ gap: 0 }}>
      <ReceptionBanner
        image={RECEPTION_IMAGES.schedule}
        tone="plum"
        eyebrow="Lịch làm việc lễ tân"
        title="Ca trực của bạn"
        subtitle="Đăng ký ca, xem lịch toàn khoa và gửi yêu cầu đổi ca — Admin bệnh viện sẽ phê duyệt."
        right={(
          <View style={s.nextCard}>
            <Text style={s.nextLabel}>CA TIẾP THEO</Text>
            {nextShift ? (
              <>
                <View style={s.nextRow}>
                  <View style={[s.nextIcon, { backgroundColor: cfg.bg }]}><ShiftIcon size={18} color={cfg.text} /></View>
                  <View>
                    <Text style={s.nextTitle}>{cfg.label}</Text>
                    <Text style={s.nextTime}>{nextShift.startTime || cfg.startTime} - {nextShift.endTime || cfg.endTime}</Text>
                  </View>
                </View>
                <Text style={s.nextDate}>
                  {new Date(nextShift.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  {nextShift.status === 'pending' ? ' · chờ duyệt' : ''}
                </Text>
              </>
            ) : (
              <Text style={s.nextNone}>Chưa có ca nào sắp tới trong tuần này</Text>
            )}
            <View style={s.nextFoot}>
              <CalendarClock size={14} color="#F5D0FE" />
              <Text style={s.nextFootText}>{weekHours} giờ làm trong tuần</Text>
            </View>
          </View>
        )}
      >
        <View style={s.bannerActions}>
          <TouchableOpacity style={s.bannerBtn} onPress={onRegister} dataSet={{ hover: 'glow' }}>
            <CalendarPlus size={16} color="#3B0764" />
            <Text style={s.bannerBtnText}>Đăng ký ca làm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bannerGhost} onPress={onRefresh}>
            <RefreshCw size={15} color="#FFFFFF" />
            <Text style={s.bannerGhostText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      </ReceptionBanner>

      <View style={s.tabBar}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => onTab(t.key)} dataSet={active ? undefined : { hover: 'tint' }}>
              <Icon size={16} color={active ? '#FFFFFF' : '#475569'} />
              <Text style={[s.tabText, active && { color: '#FFFFFF' }]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[s.tabCount, { backgroundColor: active ? '#DB2777' : t.color }]}>
                  <Text style={s.tabCountText}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/** Dải 7 ngày kiểu lịch để bàn cho lịch cá nhân. */
export const ReceptionWeekStrip = ({
  weekDates, weekLabel, findMine, shiftConfig, isSameDay, isWide,
  onPrev, onNext, onToday, onRegister, onCancel, onSwap,
}) => (
  <View style={{ gap: 14 }}>
    <View style={s.weekBar}>
      <View style={s.weekNav}>
        <TouchableOpacity style={s.navBtn} onPress={onPrev} dataSet={{ hover: 'tint' }}><ChevronLeft size={18} color="#6B21A8" /></TouchableOpacity>
        <TouchableOpacity style={s.todayBtn} onPress={onToday}><Text style={s.todayBtnText}>Tuần này</Text></TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={onNext} dataSet={{ hover: 'tint' }}><ChevronRight size={18} color="#6B21A8" /></TouchableOpacity>
      </View>
      <Text style={s.weekLabel}>{weekLabel}</Text>
      <View style={s.legend}>
        {Object.entries(shiftConfig).map(([k, c]) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c.text }]} />
            <Text style={s.legendText}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={[s.strip, isWide && { flexDirection: 'row' }]}>
      {weekDates.map((date, idx) => {
        const scheds = findMine(date);
        const today = isSameDay(date, new Date());
        return (
          <Reveal key={idx} delay={idx * 60} style={[s.day, today && s.dayToday, isWide && { flex: 1 }]}>
            <View style={[s.dayHead, today && s.dayHeadToday]}>
              <Text style={[s.dayName, today && { color: '#FFFFFF' }]}>{SHORT_DAYS[date.getDay()]}</Text>
              <Text style={[s.dayNum, today && { color: '#FFFFFF' }]}>{date.getDate()}</Text>
              <Text style={[s.dayMonth, today && { color: 'rgba(255,255,255,0.85)' }]}>{today ? 'Hôm nay' : `Th ${date.getMonth() + 1}`}</Text>
            </View>
            <View style={s.dayBody}>
              {scheds.length === 0 ? (
                <View style={s.off}>
                  <Coffee size={18} color="#C4B5FD" />
                  <Text style={s.offText}>Nghỉ</Text>
                </View>
              ) : scheds.map((sched) => {
                const cfg = shiftConfig[sched.shift] || shiftConfig['sáng'];
                const Icon = cfg.icon;
                const pending = sched.status === 'pending';
                const rejected = sched.status === 'rejected';
                return (
                  <View key={sched._id} style={[s.shift, { backgroundColor: cfg.bg, borderColor: cfg.border }, rejected && { opacity: 0.6 }]}>
                    <View style={s.shiftTop}>
                      <Icon size={14} color={cfg.text} />
                      <Text style={[s.shiftName, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                    <Text style={[s.shiftTime, { color: cfg.text }]}>{sched.startTime || cfg.startTime} - {sched.endTime || cfg.endTime}</Text>
                    <View style={[s.shiftStatus, pending ? s.stPending : rejected ? s.stRejected : s.stOk]}>
                      <Text style={[s.shiftStatusText, { color: pending ? '#B45309' : rejected ? '#DC2626' : '#0B7A53' }]}>
                        {pending ? 'Chờ duyệt' : rejected ? 'Từ chối' : 'Đã xác nhận'}
                      </Text>
                    </View>
                    {sched.reviewNotes ? <Text style={s.shiftNote} numberOfLines={2}>{sched.reviewNotes}</Text> : null}
                    {pending ? (
                      <TouchableOpacity style={s.shiftAction} onPress={() => onCancel(sched._id)}>
                        <Trash2 size={12} color="#DC2626" />
                        <Text style={[s.shiftActionText, { color: '#DC2626' }]}>Hủy đăng ký</Text>
                      </TouchableOpacity>
                    ) : !rejected ? (
                      <TouchableOpacity style={s.shiftAction} onPress={() => onSwap(sched)}>
                        <ArrowLeftRight size={12} color="#7C3AED" />
                        <Text style={[s.shiftActionText, { color: '#7C3AED' }]}>Đổi ca</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
              <TouchableOpacity style={s.addBtn} onPress={() => onRegister(date)} dataSet={{ hover: 'tint' }}>
                <Plus size={13} color="#7E22CE" />
                <Text style={s.addText}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          </Reveal>
        );
      })}
    </View>
  </View>
);

export const weekHoursOf = (scheds, shiftConfig) =>
  scheds
    .filter((x) => x.status !== 'rejected')
    .reduce((sum, x) => {
      const cfg = shiftConfig[x.shift] || {};
      return sum + hoursOf(x.startTime || cfg.startTime, x.endTime || cfg.endTime);
    }, 0);

const s = StyleSheet.create({
  nextCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 18, minWidth: 250 },
  nextLabel: { color: '#F5D0FE', fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 10 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  nextTime: { color: '#F5D0FE', fontSize: 13, fontWeight: '600' },
  nextDate: { color: '#FFFFFF', fontSize: 12, marginTop: 10, textTransform: 'capitalize' },
  nextNone: { color: '#FFFFFF', fontSize: 13 },
  nextFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  nextFootText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  bannerBtnText: { color: '#3B0764', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', padding: 6, borderRadius: 999, marginTop: -26, marginLeft: 24, marginBottom: 8, zIndex: 3, ...(isWeb ? { boxShadow: '0 14px 30px -14px rgba(59,7,100,0.45)' } : { elevation: 4 }) },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  tabActive: { backgroundColor: '#581C87' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  tabCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  weekBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#EDE9FE' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  todayBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#7E22CE' },
  todayBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  weekLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: '#3B0764' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#475569', fontWeight: '600' },

  strip: { gap: 10, alignItems: 'stretch' },
  day: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9FE', overflow: 'hidden', minHeight: 300, ...(isWeb ? { boxShadow: '0 12px 28px -22px rgba(59,7,100,0.5)' } : {}) },
  dayToday: { borderColor: '#C084FC', borderWidth: 2 },
  dayHead: { alignItems: 'center', paddingVertical: 14, backgroundColor: '#FAF5FF', borderBottomWidth: 1, borderBottomColor: '#EDE9FE' },
  dayHeadToday: { backgroundColor: '#7E22CE' },
  dayName: { fontSize: 12, fontWeight: '800', color: '#7E22CE', letterSpacing: 1 },
  dayNum: { fontSize: 30, fontWeight: '900', color: '#3B0764', lineHeight: 36 },
  dayMonth: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  dayBody: { padding: 10, gap: 8, flex: 1 },
  off: { alignItems: 'center', gap: 4, paddingVertical: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E9D5FF', borderRadius: 14 },
  offText: { fontSize: 12, color: '#A78BFA', fontWeight: '700' },
  shift: { borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
  shiftTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftName: { fontSize: 13, fontWeight: '800' },
  shiftTime: { fontSize: 12, fontWeight: '600' },
  shiftStatus: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, marginTop: 2 },
  stPending: { backgroundColor: '#FEF3C7' },
  stRejected: { backgroundColor: '#FEE2E2' },
  stOk: { backgroundColor: '#D5F5E7' },
  shiftStatusText: { fontSize: 10, fontWeight: '800' },
  shiftNote: { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  shiftAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shiftActionText: { fontSize: 11, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 12, marginTop: 'auto' },
  addText: { fontSize: 12, fontWeight: '700', color: '#7E22CE' },
});
