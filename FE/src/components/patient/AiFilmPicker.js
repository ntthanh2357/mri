import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import Config from '../../constants/config';
import PressableScale from '../PressableScale';
import PageHeroBanner from '../PageHeroBanner';
import FadeIn from '../FadeIn';
import { useImagingHistory } from '../../controllers/useImagingHistory';
import { useLoop } from '../../controllers/useMotion';

const fullUri = (path) => (path.startsWith('http') ? path : `${Config.API_URL}${path}`);
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

// Đúng theo pipeline thật của AI Service: ensemble 3 mô hình phân loại → YOLOv8 khoanh vùng → Gemini giải thích.
const AI_STEPS = [
  { icon: 'layers', title: 'Đọc ảnh', text: '3 mô hình học sâu cùng đánh giá ảnh MRI của bạn.' },
  { icon: 'crosshair', title: 'Khoanh vùng', text: 'Đánh dấu vùng cần bác sĩ chú ý, nếu có.' },
  { icon: 'message-square', title: 'Giải thích', text: 'Viết lại kết quả bằng ngôn ngữ dễ hiểu.' },
];

const StepDot = ({ icon, index, pulse }) => {
  // Nhịp sáng chạy lần lượt qua 3 bước.
  const start = index / 3;
  const glow = pulse.reduce
    ? null
    : {
        opacity: pulse.value.interpolate({
          inputRange: [0, start, start + 0.12, start + 0.3, 1].map((v) => Math.min(v, 1)),
          outputRange: [0, 0, 0.55, 0, 0],
          extrapolate: 'clamp',
        }),
      };
  return (
    <View style={styles.stepDotWrap}>
      {glow && <Animated.View style={[styles.stepGlow, glow]} />}
      <View style={styles.stepDot}>
        <Feather name={icon} size={20} color={Colors.brandMint} />
      </View>
    </View>
  );
};

/**
 * Màn "Phân tích AI" mở từ menu (chưa có ảnh): cho chọn 1 phim của mình để phân tích,
 * thay vì báo lỗi "Không có ảnh MRI". Phim chưa có ảnh thì hiện nhưng không chọn được.
 */
const AiFilmPicker = ({ navigation, isDesktop }) => {
  const { width } = useWindowDimensions();
  const { results, loading, error, refresh } = useImagingHistory();
  const pulse = useLoop(3600);

  const pick = (item) =>
    navigation.replace('AIAnalysis', { imageUrl: item.images[0], resultId: item._id, activeRoute: 'AIAnalysis' });

  return (
    <ScrollView contentContainerStyle={[styles.page, isDesktop && styles.pageDesktop]}>
      <PageHeroBanner
        source={require('../../../assets/images/ai-analysis-hero.jpg')}
        title="Chọn phim để AI phân tích"
        subtitle="AI đọc ảnh MRI, khoanh vùng cần chú ý và giải thích kết quả cho bạn."
        wide={width > 980}
      />

      <View>
        <Text style={styles.sectionTitle}>Phim của bạn</Text>
        {loading ? (
          <Text style={styles.muted}>Đang tải danh sách phim…</Text>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Không tải được danh sách phim</Text>
            <Text style={styles.muted}>{error}</Text>
            <PressableScale style={styles.retryBtn} hoverStyle={styles.retryBtnHover} onPress={refresh}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </PressableScale>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.stateBox}>
            <Image source={require('../../../assets/images/illus-films.png')} style={styles.stateIllus} resizeMode="contain" accessible={false} />
            <Text style={styles.stateTitle}>Bạn chưa có phim nào</Text>
            <Text style={styles.muted}>Phim MRI/CT sẽ có ở đây sau khi bệnh viện tải lên hệ thống.</Text>
          </View>
        ) : (
          <View style={[styles.list, isDesktop && styles.listDesktop]}>
            {results.map((item, i) => {
              const hasImage = Array.isArray(item.images) && item.images.length > 0;
              return (
                <FadeIn key={item._id} delay={150 + i * 80} style={isDesktop ? styles.cell : null}>
                  <PressableScale
                    style={[styles.card, !hasImage && styles.cardDisabled]}
                    hoverStyle={styles.cardHover}
                    disabled={!hasImage}
                    onPress={() => pick(item)}
                    accessibilityLabel={hasImage ? `Phân tích phim ${item.procedure}` : `${item.procedure}: phim chưa có ảnh, không phân tích được`}
                  >
                    <View style={styles.thumb}>
                      {hasImage ? (
                        <Image source={{ uri: fullUri(item.images[0]) }} style={styles.thumbImg} resizeMode="cover" accessible={false} />
                      ) : (
                        <Feather name="image" size={22} color="#64748B" />
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.date}>{item.imagingType || 'MRI'} · {formatDate(item.reportDate || item.orderDate)}</Text>
                      <Text style={styles.procedure}>{item.procedure || 'Phim chụp'}</Text>
                      {hasImage ? (
                        <View style={styles.cta}>
                          <Text style={styles.ctaText}>Phân tích phim này</Text>
                          <Feather name="arrow-right" size={14} color={Colors.brandGreen} />
                        </View>
                      ) : (
                        <Text style={styles.noImage}>Phim chưa có ảnh trên hệ thống nên chưa phân tích được.</Text>
                      )}
                    </View>
                  </PressableScale>
                </FadeIn>
              );
            })}
          </View>
        )}
      </View>

      <FadeIn delay={260} style={styles.howPanel}>
        <Text style={styles.howTitle}>AI đọc phim như thế nào</Text>
        <View style={[styles.steps, isDesktop && styles.stepsDesktop]}>
          {isDesktop && <View style={styles.stepLine} />}
          {AI_STEPS.map((s, i) => (
            <View key={s.title} style={[styles.step, isDesktop && styles.stepDesktop]}>
              <StepDot icon={s.icon} index={i} pulse={pulse} />
              <View style={isDesktop ? styles.stepTextDesktop : styles.stepTextMobile}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={[styles.stepText, isDesktop && styles.stepTextCenter]}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.note}>
          <Feather name="info" size={16} color={Colors.brandMint} />
          <Text style={styles.noteText}>Kết quả AI chỉ để tham khảo. Chẩn đoán cuối cùng thuộc về bác sĩ của bạn.</Text>
        </View>
      </FadeIn>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: { padding: 16, gap: 24 },
  pageDesktop: { padding: 28, maxWidth: 1240, width: '100%', alignSelf: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy, marginBottom: 12 },
  muted: { fontSize: 14, color: Colors.secondary, textAlign: 'center', lineHeight: 20 },

  list: { gap: 12 },
  listDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { width: '48%', flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardHover: { borderColor: Colors.brandGreen, boxShadow: '0 10px 24px -12px rgba(11, 42, 85, 0.3)' },
  cardDisabled: { backgroundColor: '#F8FAFC' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#E8EDF3', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  cardBody: { flex: 1 },
  date: { fontSize: 13, color: Colors.secondary, fontVariant: ['tabular-nums'] },
  procedure: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy, marginTop: 2, lineHeight: 21 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ctaText: { fontSize: 14, fontWeight: '700', color: Colors.brandGreen },
  noImage: { fontSize: 13, color: '#B45309', marginTop: 6, lineHeight: 18 },

  // AI đọc phim như thế nào
  howPanel: {
    backgroundColor: Colors.brandNavy,
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 12px 28px -16px rgba(11, 42, 85, 0.55)',
  },
  howTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 18 },
  steps: { gap: 18 },
  stepsDesktop: { flexDirection: 'row', gap: 24, position: 'relative' },
  stepLine: { position: 'absolute', top: 27, left: '16%', right: '16%', height: 2, backgroundColor: 'rgba(164, 251, 229, 0.22)' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepDesktop: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 12 },
  stepDotWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  stepGlow: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.brandGreenLogo },
  stepDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#123A70',
    borderWidth: 1,
    borderColor: 'rgba(164, 251, 229, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTextMobile: { flex: 1 },
  stepTextDesktop: { alignItems: 'center', maxWidth: 290 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandMint },
  stepText: { fontSize: 14, lineHeight: 20, color: '#D7E3F4', marginTop: 2 },
  stepTextCenter: { textAlign: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(164, 251, 229, 0.18)',
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#D7E3F4' },

  stateIllus: { width: 150, height: 150 },
  stateBox: { alignItems: 'center', padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderStrong, backgroundColor: Colors.surface, gap: 6 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  retryBtn: { marginTop: 10, height: 44, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.brandGreen, justifyContent: 'center' },
  retryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default AiFilmPicker;
