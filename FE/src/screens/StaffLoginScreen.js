/**
 * ============================================================================
 * STAFF LOGIN — Cổng Nội Bộ (B2B) · NeuroScan AI
 * ============================================================================
 * Đăng nhập DÀNH RIÊNG cho nhân viên y tế (doctor / nurse / technician /
 * receptionist / hospital_admin / admin), truy cập qua đường dẫn riêng /staff.
 *
 * Điểm nhấn bảo mật:
 *  - Tách hoàn toàn khỏi cổng bệnh nhân phổ thông (/) — không lộ giao diện nội bộ.
 *  - Luôn gửi roleType='staff' → Backend áp dụng phân tách vai trò nghiêm ngặt
 *    (tài khoản bệnh nhân bị chặn tại tầng API, bất kể giao diện).
 *  - Xác thực 2 lớp (2FA) bắt buộc với mọi nhân viên.
 *  - Tự động hết phiên 15 phút không tương tác (xử lý tại StaffPortal).
 * ============================================================================
 */
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  ScrollView,
  Image,
} from 'react-native';
import { ShieldCheck, Lock, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { get, post, setAuthToken } from '../services/api.service';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const StaffLoginScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 2FA — xác thực phía SERVER qua /auth/verify-2fa
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [resendingOtp, setResendingOtp] = useState(false);

  // Quên mật khẩu — modal luồng đầy đủ (email → OTP + mật khẩu mới)
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Tự động nhận diện phiên nhân viên còn hợp lệ (accessToken trong storage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await get('/auth/me');
        if (cancelled) return;
        const role = data && data.user ? data.user.role : data ? data.role : null;
        if (role && role !== 'patient') {
          navigation.reset({ index: 0, routes: [{ name: getDestinationByRole(role) }] });
          return;
        }
      } catch (e) {
        // Chưa đăng nhập hoặc token hết hạn → ở lại màn hình đăng nhập
      }
      if (!cancelled) setCheckingAuth(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const getDestinationByRole = (role) => {
    if (role === 'admin' || role === 'system_admin') return 'AdminBackoffice';
    if (role === 'hospital_admin') return 'ClinicDashboard';
    return 'Home';
  };

  const showAlert = (type, title, message, onOk) =>
    Alert.alert(title, message, [{ text: 'Tiếp tục', onPress: onOk }]);

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');
    setTwoFactorError('');

    if (!email.trim()) { setEmailError('Vui lòng nhập Mã nhân sự hoặc Email nội bộ.'); return; }
    if (!password) { setPasswordError('Vui lòng nhập mật khẩu.'); return; }

    setLoading(true);
    try {
      const data = await post('/auth/login', {
        email: email.trim(),
        password,
        roleType: 'staff', // Cổng nội bộ: luôn là staff — BE chặn tài khoản bệnh nhân
      });

      const role = data.user ? data.user.role : null;

      // Phòng thủ doubly-safe: nếu tài khoản bệnh nhân lọt tới đây thì chặn tại FE
      if (role === 'patient') {
        showAlert('error', 'Cổng nội bộ',
          'Tài khoản của bạn thuộc phân hệ Bệnh nhân. Vui lòng sử dụng cổng bệnh nhân để đăng nhập.');
        return;
      }

      // Nhân viên mới được cấp tài khoản → bắt buộc kích hoạt & đặt mật khẩu mới
      if (data.requiresActivation) {
        // Lưu kèm refreshToken để gia hạn phiên ngầm (silent refresh)
        await setAuthToken(data.accessToken, data.refreshToken);
        navigation.replace('ActivateAccount', { user: data.user, accessToken: data.accessToken });
        return;
      }

      // Xác thực 2 lớp bắt buộc với nhân viên nội bộ — server chỉ trả token
      // sau khi nhập đúng OTP qua /auth/verify-2fa
      if (data.requires2FA) {
        setTwoFactorEmail((data.twoFactorEmail || email).trim());
        setShowTwoFactor(true);
        showAlert('info', 'Xác thực 2 lớp',
          'Mật khẩu chính xác. Mã OTP xác thực 2 lớp đã được gửi tới email cơ quan của bạn. Vui lòng kiểm tra và nhập mã để tiếp tục.' +
          (data.otp2FA ? `\n(Mã debug: ${data.otp2FA})` : ''));
      } else {
        // Dự phòng: server không yêu cầu 2FA (đã kích hoạt qua luồng khác)
        await setAuthToken(data.accessToken, data.refreshToken);
        const role = data.user ? data.user.role : 'doctor';
        navigation.reset({ index: 0, routes: [{ name: getDestinationByRole(role) }] });
      }
    } catch (error) {
      let errMsg = error.message || 'Không thể kết nối đến máy chủ.';
      // BE trả message chung theo kiểu "tab" (cho app di động) — diễn đạt lại
      // theo ngữ cảnh Cổng nội bộ trên web.
      if (errMsg.includes('thuộc phân hệ Bệnh nhân')) {
        errMsg = 'Tài khoản Bệnh nhân không thể đăng nhập Cổng nội bộ. Vui lòng sử dụng Cổng bệnh nhân (đường dẫn phổ thông).';
        showAlert('error', 'Truy cập bị từ chối', errMsg);
        return;
      }
      if (errMsg.toLowerCase().includes('không chính xác') || errMsg.toLowerCase().includes('không tồn tại')) {
        setPasswordError('Thông tin đăng nhập chưa chính xác, vui lòng kiểm tra lại.');
      } else {
        setPasswordError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2Factor = async () => {
    setTwoFactorError('');
    if (!twoFactorCode) { setTwoFactorError('Vui lòng nhập mã xác thực OTP.'); return; }
    if (twoFactorCode.length !== 6) { setTwoFactorError('Mã OTP phải gồm 6 chữ số.'); return; }

    setLoading(true);
    try {
      // Xác thực OTP phía SERVER — token chỉ được cấp khi mã đúng
      const data = await post('/auth/verify-2fa', {
        email: twoFactorEmail,
        otp: twoFactorCode.trim(),
      });
      // [Tách luồng] Chặn tài khoản Bệnh nhân — đề phòng mã OTP được sinh từ
      // phiên đăng nhập ở cổng khác nhưng lại được xác thực tại Cổng nội bộ.
      if (data.user && data.user.role === 'patient') {
        showAlert('error', 'Truy cập bị từ chối',
          'Tài khoản Bệnh nhân không thể đăng nhập Cổng nội bộ. Vui lòng sử dụng Cổng bệnh nhân.');
        return;
      }

      await setAuthToken(data.accessToken, data.refreshToken);
      const role = data.user ? data.user.role : 'doctor';
      showAlert('success', 'Đăng nhập thành công', 'Xác thực 2 lớp thành công! Chào mừng trở lại hệ thống nội bộ NeuroScan AI!', () => {
        setShowTwoFactor(false);
        setTwoFactorCode('');
        setTwoFactorEmail('');
        // Điều hướng KHÔNG kèm params: HomeScreen sẽ tự fetch /auth/me —
        // tránh lỗi serialize "user=[object Object]" trên URL web.
        navigation.reset({ index: 0, routes: [{ name: getDestinationByRole(role) }] });
      });
    } catch (error) {
      setTwoFactorError(error.message || 'Xác thực 2 lớp thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP xác thực 2 lớp (mã cũ bị vô hiệu hoá, mã mới hiệu lực 5 phút)
  const handleResend2FA = async () => {
    setTwoFactorError('');
    setResendingOtp(true);
    try {
      const data = await post('/auth/resend-2fa', { email: twoFactorEmail });
      setTwoFactorError('');
      showAlert('info', 'Đã gửi lại mã',
        (data.message || 'Mã OTP mới đã được gửi tới email của bạn.') +
        (data.otp2FA ? `\n(Mã debug: ${data.otp2FA})` : ''));
    } catch (error) {
      setTwoFactorError(error.message || 'Không thể gửi lại mã. Vui lòng thử lại sau.');
    } finally {
      setResendingOtp(false);
    }
  };

  const goPatientPortal = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const renderFieldError = (msg) =>
    msg ? <Text style={styles.fieldError}>⚠ {msg}</Text> : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flexOne}>
      <ScrollView contentContainerStyle={[styles.container, !isDesktop && styles.containerMobile]} bounces={false}>
        {/* ===== Branding nội bộ ===== */}
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.brandText}>NEUROSCAN AI</Text>
            <Text style={styles.brandSub}>Hệ thống Quản lý Bệnh án & Chẩn đoán Hình ảnh</Text>
          </View>
        </View>

        <View style={[styles.card, !isDesktop && styles.cardMobile]}>
          {/* ===== Header ===== */}
          <View style={styles.headerRow}>
            <ShieldCheck color="#22D3EE" size={26} />
            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>Cổng Nội Bộ</Text>
              <Text style={styles.headerSub}>Dành riêng cho Nhân viên Y tế & Quản trị</Text>
            </View>
          </View>

          <View style={styles.secureBadge}>
            <Lock size={12} color="#22D3EE" />
            <Text style={styles.secureText}>Kết nối nội bộ · Xác thực 2 lớp bắt buộc · Phiên tự đóng sau 15 phút</Text>
          </View>

          {checkingAuth ? (
            <View style={styles.checkingBox}>
              <ActivityIndicator color="#22D3EE" />
              <Text style={styles.checkingText}>Đang kiểm tra phiên làm việc…</Text>
            </View>
          ) : showTwoFactor ? (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>Xác thực 2 lớp</Text>
              <Text style={styles.formSub}>Nhập mã 6 chữ số đã được gửi tới email cơ quan của bạn.</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập 6 chữ số"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
              />
              {renderFieldError(twoFactorError)}
              <Text style={styles.otpEmailHint}>
                Mã được gửi tới: <Text style={{ fontWeight: '700', color: '#CBD5E1' }}>{twoFactorEmail}</Text>
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify2Factor} disabled={loading}>
                {loading ? <ActivityIndicator color="#0B0F17" /> : <Text style={styles.primaryBtnText}>Xác nhận & Vào hệ thống</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={handleResend2FA} disabled={resendingOtp || loading}>
                {resendingOtp ? (
                  <ActivityIndicator size="small" color="#22D3EE" />
                ) : (
                  <RefreshCw size={13} color="#22D3EE" />
                )}
                <Text style={styles.resendBtnText}>
                  {resendingOtp ? 'Đang gửi lại…' : 'Chưa nhận được mã? Gửi lại mã'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => { setShowTwoFactor(false); setTwoFactorCode(''); setTwoFactorError(''); }}>
                <Text style={styles.ghostBtnText}>← Quay lại đăng nhập</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>Đăng nhập Nội bộ</Text>
              <Text style={styles.formSub}>Sử dụng Mã nhân sự hoặc Email cơ quan (*.@neuroscan.com)</Text>

              <Text style={styles.label}>Mã nhân sự / Email nội bộ *</Text>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="vidu@neuroscan.com"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                onSubmitEditing={handleLogin}
              />
              {renderFieldError(emailError)}

              <Text style={styles.label}>Mật khẩu *</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, passwordError ? styles.inputError : null]}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
              {renderFieldError(passwordError)}

              <TouchableOpacity
                style={[styles.primaryBtn, (loading || !email || !password) ? styles.btnDisabled : null]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#0B0F17" /> : <Text style={styles.primaryBtnText}>Đăng nhập Nội bộ →</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotLinkBtn} onPress={() => setShowForgotPassword(true)}>
                <Text style={styles.forgotLinkText}>Quên mật khẩu? Đặt lại qua mã OTP email</Text>
              </TouchableOpacity>

              <Text style={styles.noteText}>
                Hỗ trợ kỹ thuật nội bộ: Hotline 0236 3650 676 (8:00–17:00 các ngày làm việc).
              </Text>
            </View>
          )}
        </View>

        {/* ===== Footer ===== */}
        <TouchableOpacity style={styles.backLink} onPress={goPatientPortal}>
          <ArrowLeft size={13} color="#64748B" />
          <Text style={styles.backLinkText}>Về cổng bệnh nhân (cổng phổ thông)</Text>
        </TouchableOpacity>
        <Text style={styles.footerText}>© 2026 NeuroScan AI · Khu vực truy cập hạn chế — chỉ dành cho nhân viên được ủy quyền</Text>
      </ScrollView>

      {/* Quên mật khẩu — luồng đầy đủ (email → OTP → mật khẩu mới), giao diện tối */}
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={email}
        theme="dark"
        onSuccess={(resetEmail) => {
          setShowForgotPassword(false);
          setEmail(resetEmail);
          setPassword('');
          showAlert('success', 'Đặt lại mật khẩu thành công', 'Mật khẩu mới đã được cập nhật. Vui lòng đăng nhập bằng mật khẩu mới của bạn.');
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  containerMobile: { justifyContent: 'flex-start', paddingTop: 60 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  brandLogo: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B',
  },
  brandText: { color: '#F1F5F9', fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },
  brandSub: { color: '#94A3B8', fontSize: 11 },
  card: {
    width: 440, maxWidth: '100%', backgroundColor: '#111827',
    borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', padding: 28,
  },
  cardMobile: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTitle: { color: '#F1F5F9', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#94A3B8', fontSize: 12 },
  headerTextBox: { flex: 1 },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0B0F17',
    borderRadius: 10, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 8,
    marginBottom: 18, flexWrap: 'wrap',
  },
  secureText: { color: '#94A3B8', fontSize: 10.5, flex: 1 },
  checkingBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  checkingText: { color: '#94A3B8', fontSize: 12 },
  formBox: { width: '100%' },
  formTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  formSub: { color: '#94A3B8', fontSize: 11.5, marginBottom: 18 },
  label: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#0B0F17', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12,
    color: '#F1F5F9', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, width: '100%',
  },
  inputError: { borderColor: '#DC2626' },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  eyeBtn: { position: 'absolute', right: 12 },
  fieldError: { color: '#F87171', fontSize: 11, marginTop: 5 },
  primaryBtn: {
    backgroundColor: '#22D3EE', borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    marginTop: 16, marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#0B0F17', fontSize: 14, fontWeight: '800' },
  ghostBtn: { alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { color: '#94A3B8', fontSize: 12 },
  otpEmailHint: { color: '#64748B', fontSize: 10.5, textAlign: 'center', marginTop: 6 },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 6, marginBottom: 4,
  },
  resendBtnText: { color: '#22D3EE', fontSize: 12, fontWeight: '600' },
  forgotLinkBtn: { alignItems: 'center', paddingVertical: 6, marginTop: 2, marginBottom: 8 },
  forgotLinkText: { color: '#22D3EE', fontSize: 12, fontWeight: '600' },
  noteText: { color: '#64748B', fontSize: 10.5, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, padding: 6 },
  backLinkText: { color: '#64748B', fontSize: 12 },
  footerText: { color: '#475569', fontSize: 10, marginTop: 8, textAlign: 'center' },
});

export default StaffLoginScreen;
