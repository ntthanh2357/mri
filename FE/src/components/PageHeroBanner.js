import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Colors from '../constants/colors';
import FadeIn from './FadeIn';
import { useDrift, driftStyle } from '../controllers/useMotion';

/**
 * Banner đầu trang có ảnh (ảnh trong assets/images đã phủ sẵn màu ở vùng đặt chữ).
 * - wide (desktop): chữ đặt đè lên vùng đã phủ màu, bên trái hoặc phải (`textSide`).
 * - hẹp (điện thoại): dải ảnh phía trên, chữ bên dưới — ảnh bị cắt giữa nên không đặt chữ đè lên.
 * `tone`: 'dark' (vùng chữ phủ navy → chữ trắng) | 'light' (vùng chữ phủ nền sáng → chữ navy).
 */
const PageHeroBanner = ({ source, title, subtitle, tone = 'dark', textSide = 'left', wide, children, style }) => {
  const drift = useDrift(18000);
  const imageStyle = [styles.fill, drift.reduce ? null : driftStyle(drift.value, { shift: 10 })];
  const onDark = wide && tone === 'dark';

  const text = (
    <>
      <Text style={[styles.title, wide && styles.titleWide, onDark ? styles.titleOnDark : styles.titleOnLight]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, onDark ? styles.subtitleOnDark : styles.subtitleOnLight]}>{subtitle}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </>
  );

  if (!wide) {
    return (
      <View style={style}>
        <View style={styles.strip}>
          <Animated.Image source={source} style={imageStyle} resizeMode="cover" accessible={false} />
        </View>
        <FadeIn style={styles.textBelow}>{text}</FadeIn>
      </View>
    );
  }

  return (
    <View style={[styles.banner, tone === 'dark' ? styles.bannerDark : styles.bannerLight, style]}>
      <Animated.Image source={source} style={imageStyle} resizeMode="cover" accessible={false} />
      <FadeIn style={[styles.textOver, textSide === 'right' && styles.textRight]}>{text}</FadeIn>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },

  banner: {
    minHeight: 196,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 28,
  },
  bannerDark: { backgroundColor: Colors.brandNavy, boxShadow: '0 12px 28px -16px rgba(11, 42, 85, 0.55)' },
  bannerLight: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  textOver: { maxWidth: '46%', minWidth: 300 },
  textRight: { alignSelf: 'flex-end' },

  strip: { height: 132, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.brandNavy },
  textBelow: { paddingTop: 16 },

  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, lineHeight: 30 },
  titleWide: { fontSize: 28, lineHeight: 34 },
  titleOnDark: { color: '#FFFFFF' },
  titleOnLight: { color: Colors.brandNavy },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  subtitleOnDark: { color: '#D7E3F4' },
  subtitleOnLight: { color: Colors.slateMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
});

export default PageHeroBanner;
