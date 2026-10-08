import React, { useRef } from 'react';
import { Animated, Pressable, Platform } from 'react-native';

const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Nút có phản hồi xúc giác: nhấn thì co nhẹ (0.97), hover/focus (web) đổi style.
 * Thay cho TouchableOpacity ở các nút chính — xem skill make-interfaces-feel-better.
 */
// containerStyle: style cho lớp bọc ngoài (vd. { flex: 1 } khi nút nằm trong hàng chia đều).
const PressableScale = ({ style, containerStyle, hoverStyle, focusStyle, disabled, children, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        style={({ hovered, focused }) => [
          style,
          hovered && !disabled && hoverStyle,
          focused && focusStyle,
          disabled && { opacity: 0.7 },
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default PressableScale;
