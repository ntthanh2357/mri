import React, { useRef } from 'react';
import {
  View, Text, Image, ScrollView, SafeAreaView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Linking, Platform,
} from 'react-native';
import { FileText, Sparkles, LifeBuoy, ArrowRight } from 'lucide-react';
import { LandingNav, HeroIntro, LandingBody, LANDING_IMAGES } from '../components/landing/LandingSections';
import { Reveal, FloatingOrb } from '../components/ui/Motion';

const isWeb = Platform.OS === 'web';

// Trang chủ công khai (tách riêng khỏi trang đăng nhập)
const LandingScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 900;
  const scrollRef = useRef(null);
  const offsets = useRef({});

  const scrollToSection = (key) => {
    const y = key === 'top' ? 0 : (offsets.current[key] ?? 0) - 72;
    scrollRef.current?.scrollTo({ y: Math.max(y, 0), animated: true });
  };
  const goLogin = () => navigation.navigate('Welcome');
  const goRegister = () => navigation.navigate('Welcome', { mode: 'register' });
  const call = () => Linking.openURL('tel:02363650676').catch(() => {});
  const email = () => Linking.openURL('mailto:support@neuroscan.com').catch(() => {});

  const quickActions = [
    { icon: FileText, title: 'Xem kết quả MRI', desc: 'Phim chụp và kết luận đã ký số', onPress: goLogin },
    { icon: Sparkles, title: 'Phân tích bằng AI', desc: 'Kết quả sàng lọc trong vài giây', onPress: goLogin },
    { icon: LifeBuoy, title: 'Hỗ trợ 24/7', desc: 'Hotline 1800 1234', onPress: call },
  ];

  return (
    <SafeAreaView style={s.page}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} stickyHeaderIndices={[0]}>
        <LandingNav isDesktop={isDesktop} onNavigate={scrollToSection} onLogin={goLogin} />

        {/* Hero ảnh toàn khung */}
        <View style={[s.hero, !isDesktop && s.heroMobile]}>
          <Image source={LANDING_IMAGES.doctorsDiscuss} style={s.heroImage} resizeMode="cover" />
          <View style={s.heroOverlay} dataSet={{ bg: 'hero-overlay' }} />
          <FloatingOrb size={380} color="rgba(52,211,153,0.22)" style={{ bottom: -180, left: '25%' }} slow />
          <View style={[s.container, { flexDirection: 'row' }]}>
            <View style={{ maxWidth: 640, width: '100%' }}>
              <HeroIntro isDesktop={isDesktop} onExplore={() => scrollToSection('ai')} onStart={goRegister} />
            </View>
          </View>
        </View>

        {/* Thanh thao tác nhanh nổi trên mép hero */}
        <View style={[s.container, s.quickWrap]}>
          <View style={[s.quickBar, isDesktop && { flexDirection: 'row' }]}>
            {quickActions.map((q, i) => {
              const Icon = q.icon;
              return (
                <Reveal key={q.title} delay={i * 120} style={[s.quickItem, isDesktop && { flex: 1 }, i > 0 && (isDesktop ? s.quickDividerV : s.quickDividerH)]}>
                  <TouchableOpacity style={s.quickInner} onPress={q.onPress} dataSet={{ hover: 'tint' }}>
                    <View style={s.quickIcon}><Icon size={22} color="#067A5E" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.quickTitle}>{q.title}</Text>
                      <Text style={s.quickDesc}>{q.desc}</Text>
                    </View>
                    <ArrowRight size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </Reveal>
              );
            })}
          </View>
        </View>

        <LandingBody
          isDesktop={isDesktop}
          onSectionLayout={(key, y) => { offsets.current[key] = y; }}
          onLogin={goLogin}
          onRegister={goRegister}
          onCall={call}
          onEmail={email}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 },
  hero: { position: 'relative', minHeight: 640, justifyContent: 'center', paddingTop: 72, paddingBottom: 120, overflow: 'hidden', backgroundColor: '#0B2A55' },
  heroMobile: { minHeight: 0, paddingTop: 48, paddingBottom: 96 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,42,91,0.78)' },
  quickWrap: { marginTop: -56, zIndex: 5 },
  quickBar: {
    backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
    ...(isWeb ? { boxShadow: '0 24px 50px -18px rgba(11,42,91,0.35)' } : { elevation: 6 }),
  },
  quickItem: {},
  quickDividerV: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  quickDividerH: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  quickInner: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 22, paddingHorizontal: 24 },
  quickIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E7F6F0', alignItems: 'center', justifyContent: 'center' },
  quickTitle: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  quickDesc: { color: '#64748B', fontSize: 13, marginTop: 2 },
});

export default LandingScreen;
