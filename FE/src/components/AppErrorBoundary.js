import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../constants/colors';

// Bắt lỗi khi vẽ giao diện ở bất kỳ màn nào: hiện lời báo + nút tải lại, thay vì để trắng cả trang.
// Không hiện chi tiết lỗi cho người dùng (chỉ ghi ra console, và hiện khi đang chạy bản dev).
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Lỗi giao diện:', error, info?.componentStack);
  }

  retry() {
    // web: tải lại cả trang (lấy lại mã mới nhất, xoá trạng thái hỏng); điện thoại: vẽ lại ứng dụng
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.page} accessibilityRole="alert">
        <View style={styles.card}>
          <View style={styles.icon}><Feather name="alert-circle" size={28} color={Colors.errorText} /></View>
          <Text style={styles.title}>Có lỗi xảy ra khi hiển thị trang này</Text>
          <Text style={styles.body}>
            Dữ liệu của bạn không bị ảnh hưởng. Hãy tải lại trang; nếu vẫn gặp lỗi, vui lòng liên hệ bộ phận hỗ trợ.
          </Text>
          {__DEV__ ? <Text style={styles.dev} selectable>{String(error?.message || error)}</Text> : null}
          <Pressable onPress={this.retry} accessibilityRole="button" accessibilityLabel="Tải lại trang"
            style={({ hovered, pressed }) => [styles.btn, (hovered || pressed) && styles.btnHover]}>
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text style={styles.btnText}>Tải lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: Colors.background },
  card: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 12, padding: 24, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.errorBg },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: Colors.brandNavy, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark, textAlign: 'center' },
  dev: { alignSelf: 'stretch', fontSize: 12, lineHeight: 16, color: Colors.errorText, backgroundColor: Colors.errorBg, padding: 8, borderRadius: 6 },
  btn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.brandGreen },
  btnHover: { backgroundColor: Colors.brandGreenPressed },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
