import React, { useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

// Mạng nơ-ron trang trí: toạ độ theo % của khung NETWORK_BOX, cạnh nối theo chỉ số nút.
const NETWORK_BOX = { width: 300, height: 220 };
const NODES = [
  { x: 0.08, y: 0.55 }, { x: 0.30, y: 0.20 }, { x: 0.38, y: 0.72 },
  { x: 0.60, y: 0.40 }, { x: 0.78, y: 0.12 }, { x: 0.86, y: 0.66 }, { x: 0.56, y: 0.94 },
];
const EDGES = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [2, 6], [5, 6], [1, 4]];

const point = (i) => ({ x: NODES[i].x * NETWORK_BOX.width, y: NODES[i].y * NETWORK_BOX.height });

/**
 * Lớp hiệu ứng trên ảnh hero Welcome: vạch quét MRI + mạng nơ-ron nhấp nháy.
 * Chỉ trang trí — không nhận chạm, bị ẩn với trình đọc màn hình.
 */
const HeroScanOverlay = ({ scan, pulse, reduceMotion, scanRange = [0.08, 0.58], networkStyle, showScan = true }) => {
  const [height, setHeight] = useState(0);

  // Vạch quét chỉ chạy trong scanRange (mặc định 8% → 58% chiều cao), không đè lên khối chữ phía dưới.
  const scanStyle = {
    opacity: scan.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [height * scanRange[0], height * scanRange[1]] }) }],
  };

  // Mỗi nút sáng lệch pha nhau theo vị trí trong vòng lặp pulse.
  const nodeStyle = (i) => {
    const phase = i / NODES.length;
    const peak = Math.min(phase + 0.15, 0.99);
    return {
      opacity: pulse.interpolate({
        inputRange: [0, phase, peak, 1],
        outputRange: [0.45, 0.45, 1, 0.45],
        extrapolate: 'clamp',
      }),
      transform: [{
        scale: pulse.interpolate({
          inputRange: [0, phase, peak, 1],
          outputRange: [1, 1, 1.5, 1],
          extrapolate: 'clamp',
        }),
      }],
    };
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {showScan && !reduceMotion && height > 0 && (
        <Animated.View style={[styles.scanWrap, scanStyle]}>
          <View style={styles.scanTrail} />
          <View style={styles.scanLine} />
        </Animated.View>
      )}

      {/* Animated.View để networkStyle nhận được giá trị động (vd. opacity theo slide hero) */}
      <Animated.View style={[styles.network, networkStyle]}>
        {EDGES.map(([a, b]) => {
          const p1 = point(a);
          const p2 = point(b);
          const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          return (
            <View
              key={`${a}-${b}`}
              style={[styles.edge, {
                width: length,
                left: (p1.x + p2.x) / 2 - length / 2,
                top: (p1.y + p2.y) / 2,
                transform: [{ rotate: `${angle}rad` }],
              }]}
            />
          );
        })}
        {NODES.map((_, i) => {
          const p = point(i);
          return (
            <Animated.View
              key={i}
              style={[styles.node, { left: p.x - 5, top: p.y - 5 }, reduceMotion ? null : nodeStyle(i)]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scanWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  scanTrail: {
    height: 90,
    marginTop: -90,
    backgroundColor: 'rgba(164, 251, 229, 0.06)', // brandMint mờ — vệt sáng phía sau vạch quét
  },
  scanLine: {
    height: 2,
    backgroundColor: Colors.brandMint,
    opacity: 0.8,
    boxShadow: '0 0 18px 4px rgba(164, 251, 229, 0.45)',
  },
  network: {
    position: 'absolute',
    top: 130,
    right: 48,
    width: NETWORK_BOX.width,
    height: NETWORK_BOX.height,
  },
  edge: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(164, 251, 229, 0.35)',
  },
  node: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brandGreenOnDark,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    boxShadow: '0 0 12px 2px rgba(61, 219, 166, 0.6)',
  },
});

export default HeroScanOverlay;
