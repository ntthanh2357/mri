import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Colors from '../constants/colors';
import { SIGNATURE_VIEWBOX } from '../utils/signature';

// Hiển thị chữ ký đã lưu: nét vẽ tay (đường SVG 300x120) hoặc chữ ký gõ tên.
const SignatureView = ({ kind, svgPath, text, height = 64 }) => {
  if (kind === 'drawn' && svgPath) {
    return (
      <View style={{ height, aspectRatio: SIGNATURE_VIEWBOX.width / SIGNATURE_VIEWBOX.height }} accessibilityLabel="Chữ ký tay">
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`}>
          <Path d={svgPath} stroke={Colors.brandNavy} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    );
  }
  if (text) return <Text style={styles.typed}>{text}</Text>;
  return null;
};

const styles = StyleSheet.create({
  typed: { fontSize: 22, fontStyle: 'italic', fontWeight: '500', color: Colors.brandNavy },
});

export default SignatureView;
