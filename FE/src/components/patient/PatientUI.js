import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { FloatingOrb } from '../ui/Motion';

const isWeb = Platform.OS === 'web';

// Bảng màu cổng bệnh nhân: navy đậm + xanh bạc hà — dịu hơn các trang nhân viên, đồng bộ với Tổng quan bệnh nhân
export const P = {
  navy: '#0B2A55',
  navyDeep: '#071E3D',
  mint: '#6FDDB2',
  mintSoft: '#E6F7F0',
  teal: '#0E8A7A',
  tealDark: '#0B6E62',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  page: '#F3F7FC',
};

export const PATIENT_IMAGES = {
  lobby: require('../../../assets/reception/hospital_lobby.jpg'),
  waiting: require('../../../assets/reception/waiting_chairs.jpg'),
  tabletScan: require('../../../assets/landing/doctor_tablet_scan.jpg'),
  doctorDesk: require('../../../assets/landing/doctor_desk.jpg'),
  mriFilms: require('../../../assets/landing/mri_films.jpg'),
};
export const PATIENT_ILLUS = {
  records: require('../../../assets/images/illus-records.png'),
  passport: require('../../../assets/images/illus-health-passport.png'),
  films: require('../../../assets/images/illus-films.png'),
  support: require('../../../assets/images/illus-support.png'),
};

/** Khung trang bệnh nhân: dùng hết bề rộng (tối đa 1320) thay vì cột hẹp ở giữa. */
export const PatientPage = ({ children, style }) => (
  <ScrollView style={s.page} contentContainerStyle={[s.pageContent, style]} keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);

/**
 * Banner đầu trang bệnh nhân: nền navy, ảnh mờ dần về phía phải (hoặc hình minh họa), số liệu nằm dưới vạch kẻ
 * — cùng kiểu banner trang Tổng quan / Phim MRI của bệnh nhân.
 * stats: [{ value, label }]
 */
export const PatientHero = ({ image, illustration, eyebrow, title, subtitle, stats = [], children }) => (
  <View style={s.hero} dataSet={{ anim: 'fade-up' }}>
    {image ? (
      <View style={s.heroImageWrap}>
        <Image source={image} style={s.heroImage} resizeMode="cover" />
        <View style={s.heroFade} />
      </View>
    ) : null}
    <FloatingOrb size={300} color="rgba(111,221,178,0.10)" style={{ top: -140, right: '30%' }} slow />
    <View style={s.heroBody}>
      <View style={s.heroText}>
        {eyebrow ? <Text style={s.heroEyebrow}>{eyebrow}</Text> : null}
        <Text style={s.heroTitle}>{title}</Text>
        {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
        {children ? <View style={s.heroActions}>{children}</View> : null}
        {stats.length ? (
          <View style={s.heroStats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[s.heroStat, i > 0 && s.heroStatSep]}>
                <Text style={s.heroStatValue}>{st.value}</Text>
                <Text style={s.heroStatLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {illustration ? <Image source={illustration} style={s.heroIllus} resizeMode="contain" accessible={false} /> : null}
    </View>
  </View>
);

/** Nút trên banner bệnh nhân. */
export const HeroButton = ({ icon: Icon, label, onPress, ghost = false }) => (
  <TouchableOpacity style={ghost ? s.heroGhost : s.heroBtn} onPress={onPress} dataSet={{ hover: 'glow' }}>
    {Icon ? <Icon size={15} color={ghost ? '#FFFFFF' : P.navy} /> : null}
    <Text style={ghost ? s.heroGhostText : s.heroBtnText}>{label}</Text>
  </TouchableOpacity>
);

/** Tab dạng viên tông xanh bạc hà (cổng bệnh nhân). tabs = [{ key, label, icon?, count? }] */
export const PatientTabs = ({ tabs = [], value, onChange }) => (
  <View style={s.tabBar}>
    {tabs.map((t) => {
      const Icon = t.icon;
      const active = value === t.key;
      return (
        <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => onChange?.(t.key)} dataSet={active ? undefined : { hover: 'tint' }}>
          {Icon ? <Icon size={16} color={active ? '#FFFFFF' : '#475569'} /> : null}
          <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
          {t.count > 0 ? (
            <View style={[s.tabCount, active && s.tabCountActive]}>
              <Text style={[s.tabCountText, active && { color: P.tealDark }]}>{t.count}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    })}
  </View>
);

/** Thẻ bên phải: tiêu đề có biểu tượng + nội dung. tone: 'white' | 'mint' | 'navy' */
export const SideCard = ({ icon: Icon, title, subtitle, tone = 'white', children, style }) => (
  <View style={[s.side, tone === 'mint' && s.sideMint, tone === 'navy' && s.sideNavy, style]}>
    {title ? (
      <View style={s.sideHead}>
        {Icon ? (
          <View style={[s.sideIcon, tone === 'navy' && { backgroundColor: 'rgba(111,221,178,0.16)' }]}>
            <Icon size={18} color={tone === 'navy' ? P.mint : P.teal} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[s.sideTitle, tone === 'navy' && { color: '#FFFFFF' }]}>{title}</Text>
          {subtitle ? <Text style={[s.sideSub, tone === 'navy' && { color: '#B8C7DD' }]}>{subtitle}</Text> : null}
        </View>
      </View>
    ) : null}
    {children}
  </View>
);

/** Danh sách bước có đánh số (hướng dẫn ngắn). */
export const StepList = ({ steps = [], dark = false }) => (
  <View style={{ gap: 12 }}>
    {steps.map((st, i) => (
      <View key={st.title} style={s.step}>
        <View style={[s.stepNo, dark && s.stepNoDark]}><Text style={[s.stepNoText, dark && { color: P.navy }]}>{i + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.stepTitle, dark && { color: '#FFFFFF' }]}>{st.title}</Text>
          {st.text ? <Text style={[s.stepText, dark && { color: '#B8C7DD' }]}>{st.text}</Text> : null}
        </View>
      </View>
    ))}
  </View>
);

const shadow = isWeb ? { boxShadow: '0 12px 30px -18px rgba(11,42,85,0.35)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.page },
  pageContent: { padding: 28, paddingBottom: 56, maxWidth: 1320, width: '100%', alignSelf: 'center', gap: 22 },

  hero: { position: 'relative', borderRadius: 24, overflow: 'hidden', backgroundColor: P.navy, minHeight: 220, ...(isWeb ? { boxShadow: '0 22px 48px -26px rgba(11,42,85,0.65)' } : {}) },
  heroImageWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '58%' },
  heroImage: { width: '100%', height: '100%', opacity: 0.85 },
  heroFade: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    ...(isWeb ? { backgroundImage: 'linear-gradient(90deg, #0B2A55 0%, rgba(11,42,85,0.86) 30%, rgba(11,42,85,0.35) 70%, rgba(11,42,85,0.15) 100%)' } : { backgroundColor: 'rgba(11,42,85,0.55)' }),
  },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 32 },
  heroText: { flex: 1, minWidth: 260, maxWidth: 640 },
  heroEyebrow: { color: P.mint, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.4 },
  heroSub: { color: '#D7E3F4', fontSize: 15, lineHeight: 22, marginTop: 8 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', rowGap: 10 },
  heroStat: { paddingRight: 22 },
  heroStatSep: { paddingLeft: 22, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.16)' },
  heroStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroStatLabel: { color: '#B8C7DD', fontSize: 12, marginTop: 2 },
  heroIllus: { width: 190, height: 170 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  heroBtnText: { color: P.navy, fontWeight: '800', fontSize: 13 },
  heroGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  heroGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', padding: 6, borderRadius: 999, borderWidth: 1, borderColor: P.line, ...shadow },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: P.teal },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  tabCountActive: { backgroundColor: P.mintSoft },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  side: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: P.line, gap: 14, ...shadow },
  sideMint: { backgroundColor: '#F0FAF6', borderColor: '#CDEBDF' },
  sideNavy: { backgroundColor: P.navy, borderColor: P.navy },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sideIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: P.mintSoft, alignItems: 'center', justifyContent: 'center' },
  sideTitle: { fontSize: 16, fontWeight: '800', color: P.navy },
  sideSub: { fontSize: 12, color: P.muted, marginTop: 2 },

  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNo: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.teal, alignItems: 'center', justifyContent: 'center' },
  stepNoDark: { backgroundColor: P.mint },
  stepNoText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: P.ink },
  stepText: { fontSize: 13, color: P.muted, marginTop: 2, lineHeight: 19 },
});
