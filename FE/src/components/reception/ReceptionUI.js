import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { FloatingOrb } from '../ui/Motion';

const isWeb = Platform.OS === 'web';

export const RECEPTION_IMAGES = {
  lobby: require('../../../assets/reception/hospital_lobby.jpg'),
  tablet: require('../../../assets/reception/tablet_reception.jpg'),
  corridor: require('../../../assets/reception/corridor.jpg'),
  payment: require('../../../assets/reception/card_terminal.jpg'),
  waiting: require('../../../assets/reception/waiting_chairs.jpg'),
  schedule: require('../../../assets/reception/planner.jpg'),
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

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyHalo: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 380 },
  emptyBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
