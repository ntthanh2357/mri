import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, Platform } from 'react-native';

// react-native-web không có native driver — bật trên iOS/Android, tắt trên web để khỏi cảnh báo.
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** true khi người dùng bật "Giảm chuyển động" (iOS/Android/web prefers-reduced-motion). */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduce(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** Hiện dần + trượt lên `distance`px cho một Animated.Value 0→1. */
export const enterStyle = (value, distance = 16) => ({
  opacity: value,
  transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
});

/**
 * `count` khối hiện lần lượt cách nhau `stagger` ms. Chạy lại khi `trigger` đổi
 * (vd. khi dữ liệu tải xong). Giảm chuyển động → hiện ngay.
 */
export function useStaggeredEntrance(count, { stagger = 90, trigger = true } = {}) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!trigger) return;
    if (reduce) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    const anim = Animated.stagger(
      stagger,
      values.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER })
      )
    );
    anim.start();
    return () => anim.stop();
  }, [trigger, reduce]);

  return values;
}

/** Số đếm từ 0 lên `target` (dùng cho thống kê nhỏ). Trả về số nguyên đang hiển thị. */
export function useCountUp(target, duration = 900) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce || !target) {
      setDisplay(target || 0);
      return;
    }
    const id = value.addListener(({ value: v }) => setDisplay(Math.round(v)));
    value.setValue(0);
    const anim = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => {
      anim.stop();
      value.removeListener(id);
    };
  }, [target, reduce]);

  return display;
}

/** Giá trị 0→1 lặp vô hạn (vạch quét, nhịp sáng). `pause` ms nghỉ giữa các vòng. Giảm chuyển động → đứng yên ở 0. */
export function useLoop(duration, { pause = 0, easing = Easing.inOut(Easing.quad) } = {}) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      value.setValue(0);
      return;
    }
    const steps = [Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: NATIVE_DRIVER })];
    if (pause) steps.push(Animated.delay(pause));
    steps.push(Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: NATIVE_DRIVER }));
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [reduce]);

  return { value, reduce };
}

/** Giá trị 0→1→0 qua lại rất chậm (ảnh nền trôi kiểu Ken Burns, không giật khi quay vòng). Giảm chuyển động → đứng yên. */
export function useDrift(duration = 16000) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      value.setValue(0);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: ease, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(value, { toValue: 0, duration, easing: ease, useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce]);

  return { value, reduce };
}

/** Kiểu transform phóng nhẹ + trượt ngang theo giá trị drift (0..1). */
export const driftStyle = (value, { scale = [1.02, 1.08], shift = 12 } = {}) => ({
  transform: [
    { scale: value.interpolate({ inputRange: [0, 1], outputRange: scale }) },
    { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, -shift] }) },
  ],
});

/** Thanh tiến độ: animate độ rộng 0→ratio (0..1). Dùng width % nên không chạy native driver. */
export function useProgress(ratio, duration = 700) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      value.setValue(ratio);
      return;
    }
    const anim = Animated.timing(value, { toValue: ratio, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [ratio, reduce]);
  return value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
}
