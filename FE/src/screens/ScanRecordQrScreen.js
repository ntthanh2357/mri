import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import QrScanner, { CAMERA_SCAN_AVAILABLE, pickQrImage } from '../components/staff/QrScanner';
import Colors from '../constants/colors';
import { useScanRecordQr } from '../controllers/useScanRecordQr';

// UC-PAT-09 (mở rộng) — Nhân viên quét mã QR bệnh nhân đưa để mở bệnh án ngay trong cổng nội bộ.
// Khác với quét bằng camera điện thoại: nhân viên đang đăng nhập nên bệnh nhân thấy tên người đã mở.

const ScanRecordQrScreen = ({ navigation }) => {
  const { busy, error, open, fail } = useScanRecordQr(navigation);
  const [cameraOn, setCameraOn] = useState(false);
  const [link, setLink] = useState('');
  const [focused, setFocused] = useState(false);
  const onScreen = useIsFocused(); // rời màn hình (đã mở bệnh án) thì tắt camera

  // Đọc được 1 mã là tắt camera, kể cả khi mã sai/hết hạn: để nguyên camera sẽ gửi lại đúng mã đó liên tục
  const onDetect = (text) => { setCameraOn(false); open(text); };

  const onCameraError = (message) => { setCameraOn(false); fail(message); };

  const onPickImage = async () => {
    try {
      const text = await pickQrImage();
      if (text === null) return; // người dùng huỷ
      if (!text) { fail('Không thấy mã QR trong ảnh này. Hãy chụp rõ, đủ sáng và đủ cả 4 góc của mã.'); return; }
      open(text);
    } catch (err) {
      fail(err.message);
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="ScanRecordQr">
      <View style={styles.container}>
        <PageHeader bar title="Quét mã bệnh án" subtitle="Mở bệnh án bệnh nhân chia sẻ qua mã QR." />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>
            <View style={styles.stack}>
              <View style={styles.notice}>
                <Feather name="user-check" size={15} color={Colors.infoText} />
                <Text style={styles.noticeText}>Bệnh nhân sẽ thấy tên và vai trò của bạn trong danh sách người đã mở bệnh án.</Text>
              </View>

              {CAMERA_SCAN_AVAILABLE ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Quét bằng camera</Text>
                  <Text style={styles.body}>Nhờ bệnh nhân mở mục "Chia sẻ bệnh án", bấm "Tạo mã QR" rồi đưa mã vào khung hình. Mã chỉ quét được trong 5 phút.</Text>
                  <QrScanner active={cameraOn && !busy && onScreen} onDetect={onDetect} onError={onCameraError} />
                  <View style={styles.row}>
                    <Pressable onPress={() => setCameraOn((on) => !on)} disabled={busy} accessibilityRole="button"
                      style={({ hovered }) => [styles.primaryBtn, hovered && styles.primaryBtnHover, busy && styles.disabled]}>
                      <Feather name={cameraOn ? 'video-off' : 'camera'} size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>{cameraOn ? 'Tắt camera' : 'Bật camera'}</Text>
                    </Pressable>
                    <Pressable onPress={onPickImage} disabled={busy} accessibilityRole="button"
                      style={({ hovered }) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover, busy && styles.disabled]}>
                      <Feather name="image" size={16} color={Colors.brandGreen} />
                      <Text style={styles.secondaryBtnText}>Chọn ảnh có mã QR</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Quét bằng camera</Text>
                  <Text style={styles.body}>Ứng dụng điện thoại chưa quét trực tiếp được. Hãy mở cổng nội bộ trên trình duyệt để quét, hoặc dán liên kết chia sẻ ở ô bên dưới.</Text>
                </View>
              )}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dán liên kết chia sẻ</Text>
                <Text style={styles.label}>Liên kết bệnh nhân gửi</Text>
                <TextInput value={link} onChangeText={setLink} accessibilityLabel="Liên kết bệnh nhân gửi" autoCapitalize="none" autoCorrect={false}
                  placeholder="Ví dụ: https://…/xem-benh-an?q=…" placeholderTextColor={Colors.slateMuted}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSubmitEditing={() => open(link)}
                  style={[styles.input, focused && styles.inputFocus]} />
                <Pressable onPress={() => open(link)} disabled={busy || !link.trim()} accessibilityRole="button"
                  style={({ hovered }) => [styles.secondaryBtn, styles.selfStart, hovered && styles.secondaryBtnHover, (busy || !link.trim()) && styles.disabled]}>
                  <Text style={styles.secondaryBtnText}>Mở bệnh án</Text>
                </Pressable>
              </View>

              {busy ? (
                <View style={styles.row} accessibilityLiveRegion="polite">
                  <ActivityIndicator size="small" color={Colors.brandGreen} />
                  <Text style={styles.body}>Đang mở bệnh án…</Text>
                </View>
              ) : null}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            </View>
          </PageContainer>
        </ScrollView>
      </View>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  page: { paddingTop: 20, paddingBottom: 40 },
  stack: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.infoText },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  label: { fontSize: 13, fontWeight: '600', color: Colors.slateDark },
  error: { fontSize: 15, lineHeight: 22, color: Colors.errorText },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.slateDark },
  inputFocus: { borderColor: Colors.brandGreen },
  primaryBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.brandGreen },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  secondaryBtnHover: { backgroundColor: Colors.brandGreenSoft, borderColor: Colors.brandGreen },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  selfStart: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
});

export default ScanRecordQrScreen;
