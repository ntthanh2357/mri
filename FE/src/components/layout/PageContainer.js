import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Layout from '../../constants/layout';

/**
 * Khung nội dung của 1 trang: căn giữa, độ rộng chuẩn, lề và khoảng cách giữa các khối thống nhất.
 * `width`: 'reading' (880) cho màn đọc, 'default' (1240) cho màn làm việc, 'full' cho bảng rất rộng.
 * `spaced`: thêm khoảng cách chuẩn giữa các khối con — chỉ bật khi mỗi con là 1 khối hoàn chỉnh
 * (màn cũ có tiêu đề mục và mô tả là 2 con liền nhau thì để tắt).
 * Đặt bên trong ScrollView của màn.
 */
const PageContainer = ({ width = 'default', spaced = false, style, children }) => {
  const { width: screen } = useWindowDimensions();
  const desktop = screen > Layout.tablet;
  return (
    <View
      style={[
        styles.base,
        {
          padding: desktop ? Layout.gutter.desktop : Layout.gutter.mobile,
          gap: spaced ? (desktop ? Layout.sectionGap.desktop : Layout.sectionGap.mobile) : 0,
        },
        width !== 'full' && { maxWidth: Layout.maxWidth[width] || Layout.maxWidth.default },
        style,
        // Điện thoại: lề gọn, không để style riêng của màn đẩy lề rộng ra
        screen < 640 && { paddingHorizontal: Layout.gutter.mobile, paddingTop: Layout.gutter.mobile },
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: { width: '100%', alignSelf: 'center' },
});

export default PageContainer;
