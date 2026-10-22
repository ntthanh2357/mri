import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';

// Ảnh giấy tờ để đối chiếu với phần chữ: phóng to / thu nhỏ, cuộn 2 chiều trong khung.

const ZOOMS = [1, 1.5, 2, 3];

const ZoomableImage = ({ uri, label, height = 360 }) => {
  const [boxWidth, setBoxWidth] = useState(0);
  const [ratio, setRatio] = useState(1.4); // cao / rộng; mặc định gần khổ giấy đứng tới khi đo được ảnh thật
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => { if (alive && w > 0) setRatio(h / w); }, () => {});
    return () => { alive = false; };
  }, [uri]);

  const zoom = ZOOMS[level];
  const width = boxWidth * zoom;
  const step = (icon, name, to, disabled) => (
    <Pressable onPress={() => setLevel(to)} disabled={disabled} accessibilityRole="button" accessibilityLabel={name} hitSlop={4}
      style={({ hovered }) => [styles.step, hovered && !disabled && styles.stepHover, disabled && styles.disabled]}>
      <Feather name={icon} size={16} color={Colors.slateDark} />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { height }]} onLayout={(e) => setBoxWidth(Math.floor(e.nativeEvent.layout.width) - 2)}>
        {boxWidth > 0 ? (
          <ScrollView>
            <ScrollView horizontal>
              <Image source={{ uri }} style={{ width, height: width * ratio }} resizeMode="contain" accessibilityLabel={label} />
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.bar}>
        {step('zoom-out', 'Thu nhỏ ảnh', level - 1, level === 0)}
        <Text style={styles.zoomText} accessibilityLiveRegion="polite">{Math.round(zoom * 100)}%</Text>
        {step('zoom-in', 'Phóng to ảnh', level + 1, level === ZOOMS.length - 1)}
        <View style={styles.grow} />
        <Text accessibilityRole="link" onPress={() => Linking.openURL(uri)} style={styles.link}>Mở ảnh ở tab mới</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grow: { flex: 1 },
  step: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  stepHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  zoomText: { minWidth: 44, textAlign: 'center', fontSize: 13, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  link: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen, paddingVertical: 8 },
  disabled: { opacity: 0.4 },
});

export default ZoomableImage;
