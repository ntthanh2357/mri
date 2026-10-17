import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { NATIVE_DRIVER, useReduceMotion, enterStyle } from '../controllers/useMotion';

/**
 * Bọc 1 khối để nó hiện dần + trượt lên khi mount. Dùng cho từng phần tử danh sách:
 * <FadeIn delay={index * 70}>…</FadeIn>. Giảm chuyển động → hiện ngay.
 */
const FadeIn = ({ delay = 0, distance = 14, style, children }) => {
  const value = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce) {
      value.setValue(1);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: 1,
      duration: 480,
      delay: Math.min(delay, 600), // danh sách dài: không bắt người dùng chờ
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce]);

  return <Animated.View style={[style, enterStyle(value, distance)]}>{children}</Animated.View>;
};

export default FadeIn;
