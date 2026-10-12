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
import PressableScale from '../components/PressableScale';
import Colors from '../constants/colors';

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
        <View style={[styles.glow, styles.glowGreen]} pointerEvents="none" />
        <View style={[styles.glow, styles.glowMint]} pointerEvents="none" />
        {/* ===== Branding nội bộ ===== */}
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.brandLogo}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.brandText}>Neuro<Text style={styles.brandTextAccent}>Scan</Text> AI</Text>
            <Text style={styles.brandSub}>Hệ thống Quản lý Bệnh án & Chẩn đoán Hình ảnh</Text>
          </View>
        </View>

        <View style={[styles.card, !isDesktop && styles.cardMobile]}>
          {/* ===== Header ===== */}
          <View style={styles.headerRow}>
            <ShieldCheck color={Colors.brandMint} size={26} />
            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>Cổng nội bộ</Text>
              <Text style={styles.headerSub}>Dành riêng cho Nhân viên Y tế & Quản trị</Text>
            </View>
          </View>

          <View style={styles.secureBadge}>
            <Lock size={12} color={Colors.brandMint} />
            <Text style={styles.secureText}>Kết nối nội bộ · Xác thực 2 lớp bắt buộc · Phiên tự đóng sau 15 phút</Text>
          </View>

          {checkingAuth ? (
            <View style={styles.checkingBox}>
              <ActivityIndicator color={Colors.brandMint} />
              <Text style={styles.checkingText}>Đang kiểm tra phiên làm việc…</Text>
            </View>
          ) : showTwoFactor ? (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>Xác thực 2 lớp</Text>
              <Text style={styles.formSub}>Nhập mã 6 chữ số đã được gửi tới email cơ quan của bạn.</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập 6 chữ số"
                placeholderTextColor={Colors.onDarkSubtle}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
              />
              {renderFieldError(twoFactorError)}
              <Text style={styles.otpEmailHint}>
                Mã được gửi tới: <Text style={{ fontWeight: '700', color: Colors.onDarkText }}>{twoFactorEmail}</Text>
              </Text>
              <PressableScale style={styles.primaryBtn} hoverStyle={styles.primaryBtnHover} focusStyle={styles.btnFocus} onPress={handleVerify2Factor} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Xác nhận & Vào hệ thống</Text>}
              </PressableScale>
              <TouchableOpacity style={styles.resendBtn} onPress={handleResend2FA} disabled={resendingOtp || loading}>
                {resendingOtp ? (
                  <ActivityIndicator size="small" color={Colors.brandMint} />
                ) : (
                  <RefreshCw size={13} color={Colors.brandMint} />
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
              <Text style={styles.formTitle}>Đăng nhập</Text>
              <Text style={styles.formSub}>Dùng mã nhân sự hoặc email cơ quan (@neuroscan.com).</Text>

              <Text style={styles.label}>Mã nhân sự / Email nội bộ *</Text>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="vidu@neuroscan.com"
                placeholderTextColor={Colors.onDarkSubtle}
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
                  placeholderTextColor={Colors.onDarkSubtle}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} color={Colors.onDarkMuted} /> : <Eye size={16} color={Colors.onDarkMuted} />}
                </TouchableOpacity>
              </View>
              {renderFieldError(passwordError)}

              <PressableScale
                style={[styles.primaryBtn, (loading || !email || !password) ? styles.btnDisabled : null]}
                hoverStyle={styles.primaryBtnHover}
                focusStyle={styles.btnFocus}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Đăng nhập nội bộ</Text>}
              </PressableScale>

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
          <ArrowLeft size={14} color={Colors.onDarkMuted} />
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
  flexOne: { flex: 1, backgroundColor: Colors.brandNavyDeep },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.brandNavyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
    overflow: 'hidden',
  },
  containerMobile: { justifyContent: 'flex-start', paddingTop: 56, paddingHorizontal: 16 },
  glow: { position: 'absolute', borderRadius: 999 },
  glowGreen: { width: 520, height: 520, top: -220, right: -160, backgroundColor: 'rgba(8, 168, 128, 0.18)', filter: 'blur(60px)' },
  glowMint: { width: 420, height: 420, bottom: -200, left: -140, backgroundColor: 'rgba(164, 251, 229, 0.08)', filter: 'blur(60px)' },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF' },
  brandText: { color: Colors.onDarkText, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  brandTextAccent: { color: Colors.brandGreenOnDark },
  brandSub: { color: Colors.onDarkMuted, fontSize: 12, marginTop: 1 },

  card: {
    width: 440,
    maxWidth: '100%',
    backgroundColor: Colors.brandNavy,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.onDarkBorder,
    padding: 28,
    boxShadow: '0 24px 48px -24px rgba(0, 0, 0, 0.55)',
  },
  cardMobile: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerTitle: { color: Colors.onDarkText, fontSize: 20, fontWeight: '800' },
  headerSub: { color: Colors.onDarkMuted, fontSize: 13, marginTop: 1 },
  headerTextBox: { flex: 1 },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(164, 251, 229, 0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.onDarkBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 20,
  },
  secureText: { color: Colors.onDarkMuted, fontSize: 12, lineHeight: 17, flex: 1 },
  checkingBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  checkingText: { color: Colors.onDarkMuted, fontSize: 13 },
  formBox: { width: '100%' },
  formTitle: { color: Colors.onDarkText, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  formSub: { color: Colors.onDarkMuted, fontSize: 13, lineHeight: 19, marginBottom: 18 },
  label: { color: Colors.onDarkText, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input: {
    backgroundColor: Colors.brandNavyInput,
    borderWidth: 1,
    borderColor: Colors.onDarkBorder,
    borderRadius: 10,
    color: Colors.onDarkText,
    fontSize: 15,
    paddingHorizontal: 14,
    height: 46,
    width: '100%',
  },
  inputError: { borderColor: '#F87171' },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  eyeBtn: { position: 'absolute', right: 6, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fieldError: { color: '#FCA5A5', fontSize: 12, marginTop: 6 },
  primaryBtn: {
    backgroundColor: Colors.brandGreen,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
    boxShadow: '0 10px 22px -12px rgba(6, 122, 94, 0.9)',
  },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  btnFocus: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: Colors.brandMint, outlineOffset: 2 },
  btnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { color: Colors.onDarkMuted, fontSize: 13 },
  otpEmailHint: { color: Colors.onDarkSubtle, fontSize: 12, textAlign: 'center', marginTop: 8 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginBottom: 2 },
  resendBtnText: { color: Colors.brandMint, fontSize: 13, fontWeight: '600' },
  forgotLinkBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 6 },
  forgotLinkText: { color: Colors.brandMint, fontSize: 13, fontWeight: '600' },
  noteText: { color: Colors.onDarkSubtle, fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 17 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, padding: 8 },
  backLinkText: { color: Colors.onDarkMuted, fontSize: 13 },
  footerText: { color: Colors.onDarkSubtle, fontSize: 12, marginTop: 6, textAlign: 'center', maxWidth: 440, lineHeight: 17 },
});

export default StaffLoginScreen;
