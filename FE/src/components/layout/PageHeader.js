import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import Layout from '../../constants/layout';
import PressableScale from '../PressableScale';

/**
 * Đầu trang thống nhất: [Quay lại] · Tiêu đề + mô tả · nút hành động bên phải.
 * - Màn cấp 1 (mở từ menu): KHÔNG truyền onBack — sidebar/menu đã là điều hướng.
 * - Màn cấp 2 (đi sâu vào chi tiết): truyền onBack.
 * - Điện thoại: nút hành động xuống dưới tiêu đề, kéo dài hết hàng.
 * - `bar`: dải nền trắng tràn ngang (màn vận hành có tab/bộ lọc cố định phía trên vùng cuộn);
 *   nội dung bên trong căn theo độ rộng chuẩn. `below`: đặt tab/bộ lọc ngay dưới tiêu đề trong dải đó.
 */
const PageHeader = ({ title, subtitle, onBack, backLabel = 'Quay lại', actions, bar = false, below, style }) => {
  const { width } = useWindowDimensions();
  const desktop = width > Layout.tablet;
  const content = (
    <>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={8} style={styles.back}>
          {({ hovered }) => (
            <>
              <Feather name="arrow-left" size={16} color={hovered ? Colors.brandGreen : Colors.slateMuted} />
              <Text style={[styles.backText, hovered && styles.backTextHover]}>{backLabel}</Text>
            </>
          )}
        </Pressable>
      ) : null}
      <View style={[styles.row, !desktop && styles.rowMobile]}>
        <View style={styles.textBox}>
          <Text style={[styles.title, !desktop && styles.titleMobile]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions ? <View style={[styles.actions, !desktop && styles.actionsMobile]}>{actions}</View> : null}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </>
  );
  if (!bar) return <View style={style}>{content}</View>;
  const gutter = desktop ? Layout.gutter.desktop : Layout.gutter.mobile;
  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.barInner, { paddingHorizontal: gutter, paddingTop: desktop ? 22 : 16, paddingBottom: below ? 0 : desktop ? 20 : 16 }]}>
        {content}
      </View>
    </View>
  );
};

/** Nút trong đầu trang: variant 'primary' (1 nút chính mỗi trang) | 'secondary'. */
export const HeaderAction = ({ label, icon, onPress, variant = 'secondary', disabled, accessibilityLabel }) => {
  const primary = variant === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={[styles.btn, primary ? styles.btnPrimary : styles.btnSecondary, disabled && styles.btnDisabled]}
      hoverStyle={primary ? styles.btnPrimaryHover : styles.btnSecondaryHover}
    >
      {icon ? <Feather name={icon} size={16} color={primary ? '#FFFFFF' : Colors.brandGreen} /> : null}
      <Text style={[styles.btnText, primary ? styles.btnTextPrimary : styles.btnTextSecondary]} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  bar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  barInner: { width: '100%', maxWidth: Layout.maxWidth.default, alignSelf: 'center' },
  below: { marginTop: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  backTextHover: { color: Colors.brandGreen },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  rowMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  textBox: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: Colors.brandNavy, letterSpacing: -0.3 },
  titleMobile: { fontSize: 22, lineHeight: 28 },
  subtitle: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted, marginTop: 4, maxWidth: 680 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionsMobile: { flexWrap: 'wrap' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, paddingHorizontal: 16, borderRadius: 10 },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryHover: { backgroundColor: Colors.brandGreenPressed },
  btnSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderStrong },
  btnSecondaryHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 14, fontWeight: '700' },
  btnTextPrimary: { color: '#FFFFFF' },
  btnTextSecondary: { color: Colors.brandGreen },
});

export default PageHeader;
