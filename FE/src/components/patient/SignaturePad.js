import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Colors from '../../constants/colors';
import { strokesToPath, SIGNATURE_VIEWBOX } from '../../utils/signature';

// Khung ký bằng ngón tay (dùng trên điện thoại). Trả đường SVG chuẩn hoá 300x120 qua onChange('' khi xoá).
const RATIO = SIGNATURE_VIEWBOX.width / SIGNATURE_VIEWBOX.height;

const SignaturePad = ({ onChange }) => {
  const [strokes, setStrokes] = useState([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const strokesRef = useRef([]);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = (next) => { strokesRef.current = next; setStrokes(next); };
  const emit = (next) => {
    update(next);
    onChangeRef.current(strokesToPath(next, sizeRef.current));
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      update([...strokesRef.current, [{ x, y }]]);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const all = strokesRef.current;
      if (!all.length) return;
      update([...all.slice(0, -1), [...all[all.length - 1], { x, y }]]);
    },
    onPanResponderRelease: () => emit(strokesRef.current),
  }), []);

  // Vẽ trực tiếp theo toạ độ khung (không qua làm tròn) cho mượt
  const drawn = strokes
    .filter((st) => st.length)
    .map((st) => `M${st[0].x} ${st[0].y} ` + (st.length > 1 ? st.slice(1).map((p) => `L${p.x} ${p.y}`).join(' ') : `L${st[0].x + 0.5} ${st[0].y + 0.5}`))
    .join(' ');

  return (
    <View style={styles.wrap}>
      <View
        style={styles.pad}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        accessible
        accessibilityLabel="Khung ký tên, dùng ngón tay để ký"
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          <Path d={drawn} stroke={Colors.brandNavy} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
        {strokes.length === 0 ? <Text style={styles.placeholder} pointerEvents="none">Ký tên vào đây</Text> : null}
        <View style={styles.baseline} pointerEvents="none" />
      </View>
      <Pressable onPress={() => emit([])} disabled={!strokes.length} accessibilityRole="button" hitSlop={8} style={styles.clear}>
        <Text style={[styles.clearText, !strokes.length && styles.clearDisabled]}>Ký lại</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  pad: { width: '100%', aspectRatio: RATIO, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  placeholder: { position: 'absolute', fontSize: 15, color: Colors.secondary },
  baseline: { position: 'absolute', left: 24, right: 24, bottom: '28%', height: 1, backgroundColor: Colors.border },
  clear: { alignSelf: 'flex-end', paddingVertical: 4 },
  clearText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  clearDisabled: { color: Colors.secondary },
});

export default SignaturePad;
