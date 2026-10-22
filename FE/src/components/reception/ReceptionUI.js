import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { FloatingOrb } from '../ui/Motion';

const isWeb = Platform.OS === 'web';

export const RECEPTION_IMAGES = {
  lobby: require('../../../assets/reception/hospital_lobby.jpg'),
  tablet: require('../../../assets/reception/tablet_reception.jpg'),
  corridor: require('../../../assets/reception/corridor.jpg'),
  payment: require('../../../assets/reception/card_terminal.jpg'),
  waiting: require('../../../assets/reception/waiting_chairs.jpg'),
  schedule: require('../../../assets/reception/planner.jpg'),
  support: require('../../../assets/reception/support_headset.jpg'),
  office: require('../../../assets/reception/support_office.jpg'),
  doctorDesk: require('../../../assets/landing/doctor_desk.jpg'),
  tabletScan: require('../../../assets/landing/doctor_tablet_scan.jpg'),
  mriDiscuss: require('../../../assets/landing/doctors_mri_discuss.jpg'),
  mriFilms: require('../../../assets/landing/mri_films.jpg'),
};

// Mỗi trang lễ tân một tông màu riêng để không lẫn nhau
export const TONES = {
  navy: { from: 'rgba(11,42,91,0.96)', mid: 'rgba(11,42,91,0.80)', to: 'rgba(6, 122, 94,0.25)', accent: '#6FDDB2' },
  teal: { from: 'rgba(6,78,74,0.96)', mid: 'rgba(11,122,83,0.80)', to: 'rgba(15,157,107,0.20)', accent: '#A7F3D0' },
  indigo: { from: 'rgba(30,27,75,0.96)', mid: 'rgba(55,48,163,0.78)', to: 'rgba(99,102,241,0.20)', accent: '#C7D2FE' },
  ocean: { from: 'rgba(8,47,73,0.96)', mid: 'rgba(3,105,161,0.80)', to: 'rgba(14,165,233,0.20)', accent: '#BFE5D6' },
  plum: { from: 'rgba(59,7,100,0.95)', mid: 'rgba(126,34,206,0.78)', to: 'rgba(219,39,119,0.22)', accent: '#F5D0FE' },
  amber: { from: 'rgba(69,26,3,0.95)', mid: 'rgba(146,64,14,0.80)', to: 'rgba(217,119,6,0.20)', accent: '#FDE68A' },
};

export const formatVnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

export const personName = (p) => p?.profile?.name || p?.profile?.fullName || p?.email || 'Chưa rõ';

const AVATAR_COLORS = ['#067A5E', '#0F9D6B', '#7C3AED', '#DB2777', '#D97706', '#067A5E', '#4F46E5', '#DC2626'];
export const initialsOf = (name = '') => {
  const parts = String(name).replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
export const colorOf = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const Avatar = ({ name, size = 40, ring = false }) => {
  const bg = colorOf(name);
  return (
    <View style={[
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
      ring && { borderWidth: 3, borderColor: '#FFFFFF' },
    ]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.36 }}>{initialsOf(name)}</Text>
    </View>
  );
};

/** Banner đầu trang có ảnh nền + gradient theo tông màu. */
export const ReceptionBanner = ({ image, tone = 'navy', eyebrow, title, subtitle, children, right, compact = false }) => {
  const t = TONES[tone] || TONES.navy;
  return (
    <View style={[s.banner, compact && s.bannerCompact]} dataSet={{ anim: 'fade-up' }}>
      <Image source={image} style={s.bannerImage} resizeMode="cover" />
      <View style={[s.bannerOverlay, { backgroundColor: t.mid }]} dataSet={{ tone }} />
      <FloatingOrb size={260} color="rgba(255,255,255,0.10)" style={{ top: -110, right: '22%' }} slow />
      <View style={s.bannerContent}>
        <View style={{ flex: 1, minWidth: 260 }}>
          {eyebrow ? <Text style={[s.bannerEyebrow, { color: t.accent }]}>{eyebrow}</Text> : null}
          <Text style={[s.bannerTitle, compact && { fontSize: 26 }]}>{title}</Text>
          {subtitle ? <Text style={s.bannerSub}>{subtitle}</Text> : null}
          {children}
        </View>
        {right}
      </View>
    </View>
  );
};

/** Banner dùng chung cho mọi trang nhân viên (lễ tân, điều dưỡng...). */
export const StaffBanner = ReceptionBanner;

const SHIFT_LABELS = { 'sáng': 'Ca Sáng', 'chiều': 'Ca Chiều', 'tối': 'Ca Tối', 'cả ngày': 'Cả Ngày' };

/** Đồng hồ chạy theo giây + ca trực hôm nay, đặt ở góc phải banner. */
export const LiveClock = ({ label = 'Đang làm việc', shift }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={s.clock}>
      <View style={s.clockRow}>
        <View style={s.liveDot} dataSet={{ anim: 'ping' }} />
        <Text style={s.clockLabel}>{label}</Text>
      </View>
      <Text style={s.clockTime}>{now.toLocaleTimeString('vi-VN', { hour12: false })}</Text>
      <Text style={s.clockDate}>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
      {shift === false ? null : (
      <View style={s.clockShift}>
        <CalendarClock size={14} color="#6FDDB2" />
        <Text style={s.clockShiftText}>
          {shift ? `${SHIFT_LABELS[shift.shift] || shift.shift}${shift.startTime ? ` · ${shift.startTime} - ${shift.endTime}` : ''}` : 'Hôm nay chưa có ca đăng ký'}
        </Text>
      </View>
      )}
    </View>
  );
};

/** Ô số liệu kính mờ trên banner: [{ icon, value, label }]. */
export const BannerStats = ({ items = [] }) => (
  <View style={s.bStats}>
    {items.map((it) => {
      const Icon = it.icon;
      return (
        <View key={it.label} style={s.bStat}>
          {Icon ? <Icon size={15} color="rgba(255,255,255,0.85)" /> : null}
          <Text style={s.bStatValue}>{it.value}</Text>
          <Text style={s.bStatLabel}>{it.label}</Text>
        </View>
      );
    })}
  </View>
);

/** Thanh tab dạng viên nổi lên mép dưới banner: tabs = [{ key, label, icon?, count?, warn? }]. */
export const PillTabs = ({ tabs = [], value, onChange, overlap = true }) => {
  // Luôn 1 dòng: nhiều tab thì cuộn ngang (nút ‹ › ở 2 đầu) — không xuống dòng tràn khỏi banner
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = (e) => {
    const el = e?.nativeEvent?.target || ref.current?.getScrollableNode?.() || ref.current;
    if (!el || el.scrollWidth == null) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const scrollBy = (dx) => {
    const el = ref.current?.getScrollableNode?.() || ref.current;
    if (el && typeof Element !== 'undefined' && el instanceof Element) Element.prototype.scrollBy.call(el, { left: dx, behavior: 'smooth' });
    setTimeout(() => measure({ nativeEvent: { target: el } }), 350);
  };
  useEffect(() => {
    const el = ref.current?.getScrollableNode?.() || ref.current;
    measure({ nativeEvent: { target: el } });
    // Tab đang chọn tự cuộn vào vùng nhìn thấy
    if (el?.querySelector) el.querySelector('[data-pill-active="1"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [value, tabs.length]);
  return (
    <View style={[s.tabBar, overlap && s.tabBarOverlap]}>
      {edge.left ? (
        <TouchableOpacity style={[s.tabArrow, { left: 4 }]} onPress={() => scrollBy(-260)}><ChevronLeft size={16} color="#0B2A5B" /></TouchableOpacity>
      ) : null}
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={measure}
        scrollEventThrottle={50}
        onContentSizeChange={() => measure({ nativeEvent: { target: ref.current?.getScrollableNode?.() || ref.current } })}
        contentContainerStyle={s.tabRow}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = value === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => onChange?.(t.key)} dataSet={active ? { pillActive: '1' } : { hover: 'tint' }}>
              {Icon ? <Icon size={16} color={active ? '#FFFFFF' : '#475569'} /> : null}
              <Text style={[s.tabText, active && s.tabTextActive]} numberOfLines={1}>{t.label}</Text>
              {t.count > 0 ? (
                <View style={[s.tabCount, active ? s.tabCountActive : t.warn && s.tabCountWarn]}>
                  <Text style={[s.tabCountText, (active || t.warn) && { color: '#FFFFFF' }]}>{t.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {edge.right ? (
        <TouchableOpacity style={[s.tabArrow, { right: 4 }]} onPress={() => scrollBy(260)}><ChevronRight size={16} color="#0B2A5B" /></TouchableOpacity>
      ) : null}
    </View>
  );
};

/** Trạng thái trống có minh họa nhẹ. */
export const EmptyState = ({ icon: Icon, title, text, actionLabel, onAction, tint = '#067A5E' }) => (
  <View style={s.empty}>
    <View style={[s.emptyHalo, { backgroundColor: `${tint}14` }]}>
      <View style={[s.emptyIcon, { backgroundColor: `${tint}22` }]}>
        <Icon size={30} color={tint} strokeWidth={1.8} />
      </View>
    </View>
    <Text style={s.emptyTitle}>{title}</Text>
    {text ? <Text style={s.emptyText}>{text}</Text> : null}
    {actionLabel ? (
      <TouchableOpacity style={[s.emptyBtn, { backgroundColor: tint }]} onPress={onAction} dataSet={{ hover: 'glow' }}>
        <Text style={s.emptyBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const s = StyleSheet.create({
  banner: { position: 'relative', borderRadius: 24, overflow: 'hidden', minHeight: 210, backgroundColor: '#0B2A55', ...(isWeb ? { boxShadow: '0 24px 50px -24px rgba(11,42,91,0.55)' } : {}) },
  bannerCompact: { minHeight: 170 },
  bannerImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerContent: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20, padding: 32 },
  bannerEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8, textTransform: 'uppercase' },
  bannerTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  bannerSub: { color: '#D3EFE4', fontSize: 15, marginTop: 8, lineHeight: 22, maxWidth: 560 },

  clock: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: 18, minWidth: 240, ...(isWeb ? { backdropFilter: 'blur(8px)' } : {}) },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  clockLabel: { color: '#A7F3D0', fontSize: 12, fontWeight: '700' },
  clockTime: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', letterSpacing: 1, marginTop: 6, fontVariant: ['tabular-nums'] },
  clockDate: { color: '#D3EFE4', fontSize: 13, textTransform: 'capitalize' },
  clockShift: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  clockShiftText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  bStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bStat: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, minWidth: 104, ...(isWeb ? { backdropFilter: 'blur(8px)' } : {}) },
  bStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  bStatLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '600' },

  tabBar: { position: 'relative', alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#FFFFFF', padding: 6, borderRadius: 999, overflow: 'hidden', zIndex: 3, ...(isWeb ? { boxShadow: '0 14px 30px -14px rgba(11,42,91,0.45)' } : { elevation: 4 }) },
  tabBarOverlap: { marginTop: -44, marginLeft: 24, maxWidth: isWeb ? 'calc(100% - 48px)' : '92%' },
  tabRow: { flexDirection: 'row', gap: 6 },
  tabArrow: { position: 'absolute', top: 6, bottom: 6, width: 34, zIndex: 5, borderRadius: 999, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...(isWeb ? { boxShadow: '0 0 12px 6px #FFFFFF' } : {}) },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: '#0B2A5B' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  tabCountActive: { backgroundColor: '#0F9D6B' },
  tabCountWarn: { backgroundColor: '#D97706' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyHalo: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 380 },
  emptyBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
