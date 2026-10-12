import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

const isWeb = Platform.OS === 'web';
const prefersReducedMotion = () =>
  isWeb && typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Theo dõi phần tử có đang nằm trong khung nhìn hay không (chỉ web).
 * Trên mobile native luôn trả về true để nội dung hiển thị ngay.
 */
const useInView = (ref, once = true) => {
  const [inView, setInView] = useState(!isWeb);
  useEffect(() => {
    if (!isWeb || !ref.current || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const node = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, once]);
  return inView;
};

/** Hiện dần từ dưới lên khi cuộn tới (kiểu Docplanner). delay tính bằng ms. */
export const Reveal = ({ children, delay = 0, style, dataSet, ...rest }) => {
  const ref = useRef(null);
  const inView = useInView(ref);
  if (!isWeb) return <View style={style} {...rest}>{children}</View>;
  return (
    <View
      ref={ref}
      style={[style, !inView && { opacity: 0 }, inView && { animationDelay: `${delay}ms` }]}
      dataSet={{ ...dataSet, ...(inView ? { anim: 'fade-up' } : {}) }}
      {...rest}
    >
      {children}
    </View>
  );
};

/** Bọc nội dung trang để có hiệu ứng trượt nhẹ khi vừa mở. */
export const PageEnter = ({ children, style }) => (
  <View style={style} dataSet={isWeb ? { anim: 'page' } : undefined}>
    {children}
  </View>
);

/** Số chạy từ 0 đến value khi cuộn tới. */
export const CountUp = ({ value, decimals = 0, prefix = '', suffix = '', duration = 1600, style }) => {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return undefined;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      setDisplay(value * (1 - Math.pow(1 - progress, 3)));
      if (progress >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [inView, value, duration]);

  const formatted = display.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <Text ref={ref} style={style}>
      {prefix}{formatted}{suffix}
    </Text>
  );
};

/** Khối màu mờ trôi nổi làm nền trang trí. */
export const FloatingOrb = ({ size, color, style, slow = false }) => (
  <View
    pointerEvents="none"
    dataSet={isWeb ? { anim: slow ? 'float-slow' : 'float' } : undefined}
    style={[
      { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      isWeb && { filter: 'blur(48px)' },
      style,
    ]}
  />
);
