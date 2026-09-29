/**
 * ============================================================================
 * FORGOT PASSWORD MODAL — NeuroScan AI
 * ============================================================================
 * Luồng "Quên mật khẩu" hoàn chỉnh dùng chung cho Cổng bệnh nhân (light) và
 * Cổng nội bộ (dark):
 *   Bước 1 — Người dùng nhập email → POST /auth/forgot-password (gửi OTP 6 số
 *            về email, hiệu lực 5 phút).
 *   Bước 2 — Nhập OTP + mật khẩu mới + xác nhận mật khẩu → POST /auth/verify-otp
 *            (server kiểm tra OTP, đặt lại mật khẩu, thu hồi mọi phiên cũ).
 *
 *Sau khi thành công gọi onSuccess() để màn hình cha chuyển về form đăng nhập.
 * ============================================================================
 */
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { KeyRound, MailCheck, Lock, Eye, EyeOff, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { post } from '../services/api.service';

const ForgotPasswordModal = ({
  visible,
  onClose,
  onSuccess,
  defaultEmail = '',
  theme = 'light', // 'light' (cổng bệnh nhân) | 'dark' (cổng nội bộ)
}) => {
  const isDark = theme === 'dark';

  // State
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // thông báo thành công/gợi ý từng bước
  const [debugOtp, setDebugOtp] = useState('');

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (visible) {
      setStep('email');
      setEmail(defaultEmail);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setNotice('');
      setDebugOtp('');
    }
  }, [visible]);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email đã đăng ký.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Địa chỉ email không hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      const data = await post('/auth/forgot-password', { email: email.trim() });
      setStep('reset');
      setNotice(data.message || 'Mã OTP đã được gửi tới email của bạn.');
      setDebugOtp(data.debugOtp || '');
    } catch (err) {
      setError(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setResending(true);
    try {
      const data = await post('/auth/forgot-password', { email: email.trim() });
      setNotice(data.message || 'Mã OTP mới đã được gửi tới email của bạn.');
      setDebugOtp(data.debugOtp || '');
    } catch (err) {
      setError(err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setLoading(true);
    try {
      await post('/auth/verify-otp', {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      if (onSuccess) onSuccess(email.trim());
    } catch (err) {
      setError(err.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ===== Bộ màu theo theme =====
  const palette = isDark
    ? {
        overlay: 'rgba(2, 6, 23, 0.82)',
        card: '#111827',
        cardBorder: '#1E293B',
        title: '#F1F5F9',
        text: '#CBD5E1',
        subText: '#94A3B8',
        inputBg: '#0B0F17',
        inputBorder: '#1E293B',
        inputText: '#F1F5F9',
        accent: '#22D3EE',
        accentText: '#0B0F17',
        error: '#F87171',
        noticeBg: 'rgba(34, 211, 238, 0.08)',
        noticeBorder: 'rgba(34, 211, 238, 0.25)',
        noticeText: '#67E8F9',
        link: '#94A3B8',
      }
    : {
        overlay: 'rgba(15, 23, 42, 0.55)',
        card: '#FFFFFF',
        cardBorder: '#E2E8F0',
        title: '#0F172A',
        text: '#334155',
        subText: '#64748B',
        inputBg: '#F8FAFC',
        inputBorder: '#E2E8F0',
        inputText: '#0F172A',
        accent: '#047857',
        accentText: '#FFFFFF',
        error: '#DC2626',
        noticeBg: '#ECFDF5',
        noticeBorder: '#A7F3D0',
        noticeText: '#047857',
        link: '#64748B',
      };

  const dynamicStyles = {
    card: { backgroundColor: palette.card, borderColor: palette.cardBorder },
    title: { color: palette.title },
    subText: { color: palette.subText },
    text: { color: palette.text },
    input: {
      backgroundColor: palette.inputBg,
      borderColor: palette.inputBorder,
      color: palette.inputText,
    },
    primaryBtn: { backgroundColor: palette.accent },
    primaryBtnText: { color: palette.accentText },
    errorText: { color: palette.error },
    noticeBox: {
      backgroundColor: palette.noticeBg,
      borderColor: palette.noticeBorder,
    },
    noticeText: { color: palette.noticeText },
    linkText: { color: palette.link },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <ScrollView contentContainerStyle={styles.scrollWrap} bounces={false}>
          <View style={[styles.card, dynamicStyles.card]}>
            {/* ===== Header ===== */}
            <View style={styles.headerRow}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? '#0B0F17' : '#ECFDF5', borderColor: isDark ? '#1E293B' : '#A7F3D0' }]}>
                {step === 'email' ? (
                  <KeyRound color={palette.accent} size={22} />
                ) : (
                  <ShieldCheck color={palette.accent} size={22} />
                )}
              </View>
              <View style={styles.headerTextBox}>
                <Text style={[styles.title, dynamicStyles.title]}>Quên mật khẩu</Text>
                <Text style={[styles.subText, dynamicStyles.subText]}>
                  {step === 'email'
                    ? 'Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu.'
                    : 'Nhập mã OTP và mật khẩu mới cho tài khoản của bạn.'}
                </Text>
              </View>
            </View>

            {/* ===== Bước 1: Nhập email ===== */}
            {step === 'email' && (
              <View>
                <Text style={[styles.label, dynamicStyles.text]}>Email đã đăng ký *</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input, error ? styles.inputError : null]}
                  placeholder="vidu@email.com"
                  placeholderTextColor={palette.subText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  onSubmitEditing={handleSendOtp}
                  editable={!loading}
                />
                {error ? <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, dynamicStyles.primaryBtn, loading ? styles.btnDisabled : null]}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={palette.accentText} size="small" />
                  ) : (
                    <Text style={[styles.primaryBtnText, dynamicStyles.primaryBtnText]}>Gửi mã OTP →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ===== Bước 2: OTP + mật khẩu mới ===== */}
            {step === 'reset' && (
              <View>
                <View style={[styles.emailSentBox, dynamicStyles.noticeBox]}>
                  <MailCheck size={16} color={palette.noticeText} />
                  <Text style={[styles.emailSentText, dynamicStyles.text]}>
                    Mã OTP đã được gửi tới: <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>
                  </Text>
                </View>
                {notice ? <Text style={[styles.noticeText, dynamicStyles.noticeText]}>{notice}</Text> : null}
                {debugOtp ? (
                  <Text style={[styles.debugText, dynamicStyles.noticeText]}>
                    (Môi trường demo — Mã debug: {debugOtp})
                  </Text>
                ) : null}

                <Text style={[styles.label, dynamicStyles.text]}>Mã OTP (6 chữ số) *</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input, styles.otpInput, error ? styles.inputError : null]}
                  placeholder="000000"
                  placeholderTextColor={palette.subText}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                  editable={!loading}
                />

                <Text style={[styles.label, dynamicStyles.text]}>Mật khẩu mới *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, dynamicStyles.input, error ? styles.inputError : null]}
                    placeholder="Tối thiểu 6 ký tự"
                    placeholderTextColor={palette.subText}
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={(t) => { setNewPassword(t); setError(''); }}
                    editable={!loading}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} color={palette.subText} /> : <Eye size={16} color={palette.subText} />}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, dynamicStyles.text]}>Xác nhận mật khẩu mới *</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input, error ? styles.inputError : null]}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor={palette.subText}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                  onSubmitEditing={handleResetPassword}
                  editable={!loading}
                />

                {error ? <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, dynamicStyles.primaryBtn, loading ? styles.btnDisabled : null]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={palette.accentText} size="small" />
                  ) : (
                    <Text style={[styles.primaryBtnText, dynamicStyles.primaryBtnText]}>Đặt lại mật khẩu</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendBtn} onPress={handleResendOtp} disabled={resending || loading}>
                  {resending ? (
                    <ActivityIndicator size="small" color={palette.accent} />
                  ) : (
                    <RefreshCw size={13} color={palette.accent} />
                  )}
                  <Text style={[styles.resendText, { color: palette.accent }]}>
                    {resending ? 'Đang gửi lại…' : 'Gửi lại mã OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== Đóng modal ===== */}
            <TouchableOpacity style={styles.backBtn} onPress={onClose} disabled={loading}>
              <ArrowLeft size={13} color={palette.link} />
              <Text style={[styles.backBtnText, dynamicStyles.linkText]}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: 440,
    maxWidth: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBox: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subText: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  inputError: { borderColor: '#DC2626' },
  otpInput: { letterSpacing: 6, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  eyeBtn: { position: 'absolute', right: 12 },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.55 },
  errorText: { fontSize: 11.5, marginTop: 8, marginBottom: 2 },
  noticeText: { fontSize: 11.5, marginTop: 8 },
  debugText: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  emailSentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  emailSentText: { flex: 1, fontSize: 11.5, flexWrap: 'wrap' },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  resendText: { fontSize: 12, fontWeight: '600' },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  backBtnText: { fontSize: 12 },
});

export default ForgotPasswordModal;
