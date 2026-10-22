import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';

/**
 * Tab gạch chân dùng chung cho màn vận hành. Cuộn ngang khi không đủ chỗ (điện thoại).
 * tabs: [{ key, label, count? }] · value: key đang chọn · onChange(key)
 *
 * Fix tràn ngang (2026-10): thanh tab nhiều mục dài (vd. 6 chức danh ở Quản lý nhân sự
 * ≈ 1337px) rộng hơn vùng chứa. Trước đây: scrollbar ẩn + không nút điều hướng + không tự
 * cuộn theo tab đang chọn → resize/đổi tab làm nội dung bị cắt cả 2 đầu, người dùng
 * kẹt không chạm được tab khuất. Giờ:
 *  1. Nút ‹ › hai đầu — chỉ hiện khi phía đó còn nội dung khuất, bấm cuộn ~80% bề rộng.
 *  2. Tab đang chọn TỰ cuộn vào vùng nhìn thấy khi đổi tab / đổi kích thước màn.
 *  3. Vị trí cuộn được đo lại liên tục (onScroll/onLayout) nên nút luôn đúng trạng thái.
 */

const EDGE = 36; // khoảng đệm 2 đầu khi ép tab active vào vùng nhìn thấy (chừa chỗ nút ‹ ›)

/**
 * Cuộn ngang mượt tới vị trí `left` (đã kẹp trong khoảng cuộn được).
 * LƯU Ý: RN-web gán đè `node.scrollTo` bằng API {x, y, animated} của nó —
 * gọi `el.scrollTo({left, behavior})` sẽ bị hiểu thành x=undefined → luôn về 0.
 * Vì vậy phải gọi bản native của Element.prototype và kẹp left thủ công.
 */
const scrollToX = (el, left) => {
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const target = Math.max(0, Math.min(left, max));
  if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo === 'function') {
    Element.prototype.scrollTo.call(el, { left: target, behavior: 'smooth' });
  } else if (typeof el.scrollTo === 'function') {
    el.scrollTo({ x: target, animated: true });
  } else {
    el.scrollLeft = target;
  }
};

const PageTabs = ({ tabs, value, onChange, style }) => {
  const scrollRef = useRef(null);
  const activeRef = useRef(null); // node DOM của tab đang chọn (RN-web không render aria-selected nên không query DOM được)
  const [edges, setEdges] = useState({ canLeft: false, canRight: false });
  const { width: windowWidth } = useWindowDimensions(); // re-render khi đổi kích thước màn hình

  const node = useCallback(
    () => (scrollRef.current && scrollRef.current.getScrollableNode ? scrollRef.current.getScrollableNode() : null),
    []
  );

  /** Đo xem 2 đầu còn nội dung khuất không → hiện/ẩn nút ‹ ›. */
  const measure = useCallback(() => {
    const el = node();
    if (!el) return;
    const canLeft = el.scrollLeft > 4;
    const canRight = el.scrollWidth - el.scrollLeft - el.clientWidth > 4;
    setEdges((prev) => (prev.canLeft === canLeft && prev.canRight === canRight ? prev : { canLeft, canRight }));
  }, [node]);

  /** Cuộn tab đang chọn vào vùng nhìn thấy (đổi tab, resize, mount lần đầu). */
  const ensureActiveVisible = useCallback(() => {
    const el = node();
    const a = activeRef.current && activeRef.current.getBoundingClientRect ? activeRef.current.getBoundingClientRect() : null;
    if (!el || !a) return;
    const n = el.getBoundingClientRect();
    if (a.left < n.left + EDGE || a.right > n.right - EDGE) {
      scrollToX(el, el.scrollLeft + (a.left - n.left) - EDGE);
    }
  }, [node]);

  useEffect(() => {
    measure();
    ensureActiveVisible();
  }, [tabs, value, windowWidth, measure, ensureActiveVisible]);

  /** Bấm nút ‹ ›: cuộn một bước ~80% bề rộng (tối thiểu 160px). */
  const nudge = (dir) => {
    const el = node();
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.8));
    scrollToX(el, el.scrollLeft + dir * step);
  };

  const arrow = (dir) => (
    <Pressable
      key={dir < 0 ? 'arrow-l' : 'arrow-r'}
      onPress={() => nudge(dir)}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Cuộn về các tab trước' : 'Cuộn tới các tab sau'}
      style={({ hovered }) => [
        styles.arrow,
        dir < 0 ? styles.arrowL : styles.arrowR,
        hovered && styles.arrowHover,
      ]}
    >
      <Feather name={dir < 0 ? 'chevron-left' : 'chevron-right'} size={18} color={Colors.brandNavy} />
    </Pressable>
  );

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={measure}
        onLayout={measure}
        onContentSizeChange={measure}
        scrollEventThrottle={64}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              ref={active ? activeRef : undefined}
              style={({ hovered, focused }) => [styles.tab, active && styles.tabActive, (hovered || focused) && !active && styles.tabHover]}
            >
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{t.label}</Text>
              {t.count != null ? (
                <View style={[styles.count, active && styles.countActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{t.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {edges.canLeft ? arrow(-1) : null}
      {edges.canRight ? arrow(1) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 1 },
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.brandGreen },
  tabHover: { borderBottomColor: Colors.borderStrong },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  labelActive: { color: Colors.brandGreen, fontWeight: '700' },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: Colors.brandGreenSoft },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  countTextActive: { color: Colors.brandGreen },
  arrow: {
    position: 'absolute', top: 7, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2,
  },
  arrowL: { left: 0 },
  arrowR: { right: 0 },
  arrowHover: { borderColor: Colors.brandGreen, backgroundColor: '#FFFFFF' },
});

export default PageTabs;
