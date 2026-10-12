import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, Platform } from 'react-native';

// react-native-web không có native driver — bật trên iOS/Android, tắt trên web để khỏi cảnh báo.
const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Animation cho WelcomeScreen:
 * - intro: logo → tiêu đề → mô tả → từng dòng tính năng hiện dần + trượt lên; thẻ đăng nhập trồi lên.
 * - kenBurns: ảnh hero phóng to/thu nhỏ rất chậm.
 * - slides: các ảnh hero desktop chuyển mờ dần lần lượt (mỗi ảnh ~6,5 s).
 * - scan: vạch quét MRI chạy dọc vùng ảnh.
 * - pulse: nhịp sáng cho các nút mạng nơ-ron.
 * Khi máy bật "Giảm chuyển động": hiện ngay trạng thái cuối, không chạy vòng lặp.
 */
export default function useWelcomeAnimations(featureCount, slideCount = 1) {
  // Ảnh hero desktop: slide đầu hiện sẵn, các slide sau chuyển mờ dần lần lượt.
  const slides = useRef(Array.from({ length: slideCount }, (_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const brand = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const subtitle = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const features = useRef(Array.from({ length: featureCount }, () => new Animated.Value(0))).current;
  const kenBurns = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const running = [];

    const enter = (value, delay = 0) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 560,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIVE_DRIVER,
      });

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        setReduceMotion(reduce);
        if (reduce) {
          [brand, title, subtitle, card, ...features].forEach((v) => v.setValue(1));
          return;
        }

        const intro = Animated.parallel([
          Animated.stagger(110, [brand, title, subtitle, ...features].map((v) => enter(v))),
          enter(card, 180),
        ]);

        const kenBurnsLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(kenBurns, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
            Animated.timing(kenBurns, { toValue: 0, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
          ])
        );

        const scanLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(scan, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
            Animated.delay(1400),
            Animated.timing(scan, { toValue: 0, duration: 0, useNativeDriver: NATIVE_DRIVER }),
          ])
        );

        const pulseLoop = Animated.loop(
          Animated.timing(pulse, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: NATIVE_DRIVER })
        );

        running.push(intro, kenBurnsLoop, scanLoop, pulseLoop);

        if (slides.length > 1) {
          const fade = (value, toValue) =>
            Animated.timing(value, { toValue, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER });
          const slideshow = Animated.loop(
            Animated.sequence(
              slides.map((current, i) =>
                Animated.sequence([
                  Animated.delay(6500),
                  Animated.parallel([fade(current, 0), fade(slides[(i + 1) % slides.length], 1)]),
                ])
              )
            )
          );
          running.push(slideshow);
        }
        running.forEach((a) => a.start());
      });

    return () => {
      cancelled = true;
      running.forEach((a) => a.stop());
    };
  }, []);

  // Hiện dần + trượt lên 16px
  const enterStyle = (value, distance = 16) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  const kenBurnsStyle = {
    transform: [
      { scale: kenBurns.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.12] }) },
      { translateX: kenBurns.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
    ],
  };

  return { brand, title, subtitle, card, features, slides, scan, pulse, reduceMotion, enterStyle, kenBurnsStyle };
}
