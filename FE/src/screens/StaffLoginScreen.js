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
  Animated,
} from 'react-native';
import {
  ShieldCheck, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, RefreshCw, AlertCircle,
  Mail, KeyRound, UserRound, UsersRound, Clock, Phone, ScanLine, ClipboardList, CalendarClock, House,
} from 'lucide-react';
import { get, post, setAuthToken } from '../services/api.service';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import PressableScale from '../components/PressableScale';
import Colors from '../constants/colors';
import HeroScanOverlay from '../components/HeroScanOverlay';
import { FloatingOrb } from '../components/ui/Motion';
import useWelcomeAnimations from '../controllers/useWelcomeAnimations';

// Ảnh cột trái: cảnh làm việc của đội ngũ y tế (khác bộ ảnh cổng bệnh nhân)
const HERO_SLIDES = [
  require('../../assets/landing/doctors_mri_discuss.jpg'),
  require('../../assets/landing/doctor_tablet_scan.jpg'),
  require('../../assets/landing/mri_films.jpg'),
  require('../../assets/landing/doctor_desk.jpg'),
  require('../../assets/reception/tablet_reception.jpg'),
  require('../../assets/reception/hospital_lobby.jpg'),
  require('../../assets/reception/corridor.jpg'),
];
// Chú thích từng ảnh (cùng thứ tự HERO_SLIDES) — hiện/ẩn theo ảnh đang chiếu
const SLIDE_CAPTIONS = [
  'Bác sĩ hội chẩn phim MRI',
  'Đọc kết quả chẩn đoán trên máy tính bảng',
  'Phim chụp cắt lớp sọ não',
  'Khám & tư vấn tại phòng bác sĩ',
  'Lễ tân tiếp đón & xếp lịch hẹn',
  'Sảnh tiếp nhận bệnh viện',
  'Khu khám & chẩn đoán hình ảnh',
];

const IS_WEB = Platform.OS === 'web';

// Ô nhập có biểu tượng + viền sáng khi focus. Khai báo ngoài màn hình để ô không bị
// dựng lại mỗi lần gõ (tránh mất focus).
const StaffField = ({ icon: Icon, error, trailing, inputStyle, onFocus, onBlur, ...inputProps }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldInvalid]}>
      {Icon ? <Icon size={17} color={focused ? '#0E8A7A' : '#94A3B8'} /> : null}
      <TextInput
        {...inputProps}
        placeholderTextColor="#94A3B8"
        style={[styles.fieldInput, inputStyle]}
        onFocus={(e) => { setFocused(true); if (onFocus) onFocus(e); }}
        onBlur={(e) => { setFocused(false); if (onBlur) onBlur(e); }}
      />
      {trailing}
    </View>
  );
};


const StaffLoginScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 960; // màn hẹp hơn: một cột (logo → thẻ)
  const anim = useWelcomeAnimations(4, HERO_SLIDES.length); // 4 dòng tính năng + ảnh hero

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
  // [FIX] OTP debug (ENABLE_DEBUG_OTP=true) hiển thị INLINE trong form 2FA,
  // không dùng modal chặn khiến nút "Xác nhận" không bấm được trên web.
  const [debugOtp, setDebugOtp] = useState('');

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
    if (loading) return; // bấm Enter liên tục không gửi đăng nhập nhiều lần
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
        // [FIX] form 2FA đã tự mô tả "mã đã được gửi tới email cơ quan" — bỏ modal chặn,
        // OTP debug (nếu có) hiển thị inline ngay trong form.
        setDebugOtp(data.otp2FA || '');
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
    if (loading) return; // bấm Enter liên tục không gửi mã nhiều lần
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
      // [FIX] OTP debug hiển thị inline (mã mới) thay vì modal chặn form
      if (data.otp2FA) {
        setDebugOtp(data.otp2FA);
      } else {
        showAlert('info', 'Đã gửi lại mã',
          (data.message || 'Mã OTP mới đã được gửi tới email của bạn.'));
      }
    } catch (error) {
      setTwoFactorError(error.message || 'Không thể gửi lại mã. Vui lòng thử lại sau.');
    } finally {
      setResendingOtp(false);
    }
  };

  // Về trang chủ công khai (đường dẫn '/') — Cổng nội bộ là ứng dụng riêng nên chuyển hẳn trang trên web
  const goHome = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const renderFieldError = (msg) =>
    msg ? (
      <View style={styles.errorRow}>
        <AlertCircle size={13} color="#DC2626" style={{ marginTop: 1 }} />
        <Text style={styles.errorText}>{msg}</Text>
      </View>
    ) : null;

  const PrimaryButton = ({ label, onPress, dim }) => (
    <PressableScale
      style={[styles.primaryBtn, dim ? styles.btnDim : null]}
      hoverStyle={styles.primaryBtnHover}
      focusStyle={styles.btnFocus}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.primaryBtnInner}>
          <Text style={styles.primaryBtnText}>{label}</Text>
          <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      )}
    </PressableScale>
  );

  // Đồng hồ ở thanh trạng thái (cập nhật mỗi 30 giây)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const clockText = `${pad(now.getHours())}:${pad(now.getMinutes())} · ${WEEKDAYS[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  // ===== Thẻ đăng nhập (dùng chung cho máy tính & điện thoại) =====
  const card = (
    <Animated.View style={[styles.cardStack, isDesktop ? anim.enterStyle(anim.card, 24) : null]}>
      <View style={styles.card} dataSet={{ staffcard: '1' }}>
        {IS_WEB ? <View style={styles.cardAccent} pointerEvents="none" /> : null}

        {/* Đầu thẻ */}
        <View style={[styles.cardHead, !isDesktop && styles.cardHeadMobile]}>
          <View style={styles.headIcon}>
            <ShieldCheck size={22} color={Colors.brandMint} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrowText}>CỔNG NỘI BỘ · STAFF</Text>
            <Text style={styles.headerTitle} accessibilityRole="header" dataSet={{ font: 'display' }}>
              {showTwoFactor ? 'Xác thực 2 lớp' : 'Đăng nhập nhân viên'}
            </Text>
          </View>
        </View>
        <Text style={[styles.headerSub, !isDesktop && styles.padMobile]}>
          {showTwoFactor
            ? 'Nhập mã 6 chữ số đã được gửi tới email cơ quan của bạn.'
            : 'Sử dụng mã nhân sự hoặc email cơ quan (@neuroscan.com) do bệnh viện cấp.'}
        </Text>

        {/* Thân thẻ */}
        <View style={[styles.cardBody, !isDesktop && styles.padMobile]}>
          {checkingAuth ? (
            <View style={styles.checkingBox}>
              <ActivityIndicator color={Colors.brandGreen} />
              <Text style={styles.checkingText}>Đang kiểm tra phiên làm việc…</Text>
            </View>
          ) : showTwoFactor ? (
            <View style={styles.formBox}>
              <View style={styles.otpMailBox}>
                <Mail size={16} color={Colors.brandGreen} />
                <Text style={styles.otpMailText} numberOfLines={1}>
                  Đã gửi tới <Text style={styles.otpMailValue}>{twoFactorEmail}</Text>
                </Text>
              </View>

              <Text style={styles.label}>Mã xác thực OTP</Text>
              <StaffField
                icon={KeyRound}
                error={!!twoFactorError}
                inputStyle={twoFactorCode ? styles.otpInput : null}
                placeholder="Nhập 6 chữ số"
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                autoFocus
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                returnKeyType="done"
                onSubmitEditing={handleVerify2Factor}
              />
              {renderFieldError(twoFactorError)}
              {debugOtp ? (
                <View style={styles.devOtp}>
                  <Text style={styles.devOtpText}>(DEV) Mã OTP thử nghiệm: <Text style={styles.devOtpCode}>{debugOtp}</Text></Text>
                </View>
              ) : null}

              <PrimaryButton label="Xác nhận & vào hệ thống" onPress={handleVerify2Factor} />

              <View style={styles.twoFaLinks}>
                <TouchableOpacity style={styles.linkBtn} onPress={() => { setShowTwoFactor(false); setTwoFactorCode(''); setTwoFactorError(''); setDebugOtp(''); }}>
                  <ArrowLeft size={13} color="#64748B" />
                  <Text style={styles.linkMuted}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={handleResend2FA} disabled={resendingOtp || loading}>
                  {resendingOtp ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : <RefreshCw size={13} color={Colors.brandGreen} />}
                  <Text style={styles.linkAccent}>{resendingOtp ? 'Đang gửi lại…' : 'Gửi lại mã'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.formBox}>
              <Text style={styles.label}>Mã nhân sự / Email nội bộ</Text>
              <StaffField
                icon={UserRound}
                error={!!emailError}
                placeholder="vidu@neuroscan.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                onSubmitEditing={handleLogin}
              />
              {renderFieldError(emailError)}

              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Mật khẩu</Text>
                <TouchableOpacity onPress={() => setShowForgotPassword(true)}>
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
              <StaffField
                icon={Lock}
                error={!!passwordError}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                onSubmitEditing={handleLogin}
                trailing={(
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={17} color="#94A3B8" /> : <Eye size={17} color="#94A3B8" />}
                  </TouchableOpacity>
                )}
              />
              {renderFieldError(passwordError)}

              <PrimaryButton label="Đăng nhập hệ thống" onPress={handleLogin} />
            </View>
          )}
        </View>

        {/* Dải bảo mật cuối thẻ */}
        <View style={styles.cardFoot}>
          <View style={styles.footItem}>
            <KeyRound size={13} color={Colors.brandGreen} />
            <Text style={styles.footText}>Xác thực 2 lớp</Text>
          </View>
          <View style={styles.footSep} />
          <View style={styles.footItem}>
            <Clock size={13} color={Colors.brandGreen} />
            <Text style={styles.footText}>Tự đóng sau 15 phút</Text>
          </View>
          <View style={styles.footSep} />
          <View style={styles.footItem}>
            <Lock size={13} color={Colors.brandGreen} />
            <Text style={styles.footText}>Kết nối mã hóa</Text>
          </View>
        </View>
      </View>

      {/* Dưới thẻ (nền tối) */}
      <View style={styles.belowCard}>
        <View style={styles.belowItem}>
          <Phone size={13} color={Colors.brandMint} />
          <Text style={styles.belowText}>Hỗ trợ kỹ thuật: <Text style={styles.belowStrong}>0236 3650 676</Text></Text>
        </View>
        {!isDesktop ? (
          <TouchableOpacity style={styles.belowItem} onPress={goHome}>
            <House size={13} color={Colors.brandMint} />
            <Text style={[styles.belowText, styles.belowLink]}>Về trang chủ</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );

  const TILES = [
    [ScanLine, 'Chẩn đoán MRI có AI', 'Phân tích & khoanh vùng tổn thương'],
    [ClipboardList, 'Bệnh án điện tử', 'Hồ sơ, chỉ định, kết quả tập trung'],
    [CalendarClock, 'Lịch hẹn & tiếp đón', 'Điều phối bệnh nhân theo ca'],
    [UsersRound, 'Phân quyền vai trò', 'Bác sĩ · Điều dưỡng · KTV · Lễ tân'],
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flexOne}>
      {isDesktop ? (
        <View style={styles.desktop}>
          {/* ===== Cột trái: ảnh đội ngũ y tế + bảng thông tin hệ thống ===== */}
          <View style={styles.leftCol}>
            {HERO_SLIDES.map((source, i) => (
              <Animated.Image
                key={i}
                source={source}
                style={[styles.leftBg, anim.reduceMotion ? null : anim.kenBurnsStyle, { opacity: anim.slides[i] }]}
                resizeMode="cover"
                accessible={false}
              />
            ))}
            <View style={styles.leftTint} pointerEvents="none" />
            <HeroScanOverlay scan={anim.scan} pulse={anim.pulse} reduceMotion={anim.reduceMotion} networkStyle={{ opacity: 0 }} scanRange={[0.06, 0.42]} />

            <View style={styles.leftContent}>
              {/* Hàng trên: thương hiệu + nhãn khu vực */}
              <Animated.View style={[styles.topRow, anim.enterStyle(anim.brand)]}>
                <View style={styles.brandRow}>
                  <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="cover" />
                  <View>
                    <Text style={styles.brandText}>Neuro<Text style={styles.brandTextAccent}>Scan</Text> AI</Text>
                    <Text style={styles.brandSub}>Hệ thống Quản lý Bệnh án & Chẩn đoán Hình ảnh</Text>
                  </View>
                </View>
                <View style={styles.staffTag}>
                  <Lock size={11} color={Colors.brandMint} strokeWidth={2.4} />
                  <Text style={styles.staffTagText}>STAFF ONLY</Text>
                </View>
              </Animated.View>

              {/* Khối dưới: tiêu đề + ô chức năng + thanh trạng thái */}
              <View>
                {/* Chú thích ảnh đang chiếu + chấm tiến trình */}
                <Animated.View style={[styles.slideMeta, anim.enterStyle(anim.title)]}>
                  <View style={styles.slideCaptionBox}>
                    {SLIDE_CAPTIONS.map((caption, i) => (
                      <Animated.View key={i} style={[styles.slideCaptionItem, { opacity: anim.slides[i] }]}>
                        <View style={styles.slideCaptionBar} />
                        <Text style={styles.slideCaption} numberOfLines={1}>{caption}</Text>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
                <Animated.Text style={[styles.heroEyebrow, anim.enterStyle(anim.title)]}>CLINICAL WORKSPACE</Animated.Text>
                <Animated.Text style={[styles.heroTitle, anim.enterStyle(anim.title, 24)]} dataSet={{ font: 'display' }}>
                  Hệ thống nội bộ{'\n'}dành cho <Text style={styles.heroTitleAccent}>đội ngũ y tế</Text>
                </Animated.Text>
                <Animated.Text style={[styles.heroSub, anim.enterStyle(anim.subtitle)]}>
                  Một nơi làm việc chung cho bác sĩ, điều dưỡng, kỹ thuật viên và lễ tân.
                </Animated.Text>

                <View style={styles.tiles}>
                  {TILES.map(([Icon, title, desc], i) => (
                    <Animated.View key={title} style={[styles.tile, anim.enterStyle(anim.features[i])]}>
                      <Icon size={18} color={Colors.brandMint} strokeWidth={2} />
                      <Text style={styles.tileTitle}>{title}</Text>
                      <Text style={styles.tileDesc}>{desc}</Text>
                    </Animated.View>
                  ))}
                </View>

                <View style={styles.statusBar}>
                  <View style={styles.statusItem}>
                    <View style={styles.statusDot} dataSet={{ anim: 'ping' }} />
                    <Text style={styles.statusText}>Hệ thống hoạt động ổn định</Text>
                  </View>
                  <View style={styles.statusItem}>
                    <Clock size={13} color={Colors.onDarkSubtle} />
                    <Text style={styles.statusText}>{clockText}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ===== Cột phải: nền navy tối + lưới mảnh, thẻ trắng ở giữa ===== */}
          <View style={styles.rightCol}>
            {/* Nút "Về trang chủ" — góc trên phải */}
            <TouchableOpacity style={styles.homeBtn} onPress={goHome}>
              <ArrowLeft size={15} color={Colors.brandNavy} />
              <House size={15} color={Colors.brandGreen} />
              <Text style={styles.homeBtnText}>Về trang chủ</Text>
            </TouchableOpacity>
            {IS_WEB ? <View style={styles.rightGrid} pointerEvents="none" /> : null}
            {IS_WEB ? <View style={styles.rightScene} pointerEvents="none" dataSet={{ anim: 'float-slow' }} /> : null}
            <FloatingOrb size={460} color="rgba(120, 200, 255, 0.20)" style={{ top: -200, right: -170 }} />
            <FloatingOrb size={380} color="rgba(255, 255, 255, 0.12)" style={{ bottom: -170, left: -140 }} slow />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.rightScroll} keyboardShouldPersistTaps="handled">
              {card}
              <Text style={styles.footerText}>© 2026 NeuroScan AI · Khu vực truy cập hạn chế — chỉ dành cho nhân viên được ủy quyền</Text>
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.mobilePage} contentContainerStyle={styles.containerMobile} keyboardShouldPersistTaps="handled" bounces={false}>
          {IS_WEB ? <View style={styles.rightGrid} pointerEvents="none" /> : null}
            {IS_WEB ? <View style={styles.rightScene} pointerEvents="none" dataSet={{ anim: 'float-slow' }} /> : null}
          <View style={[styles.brandRow, { marginBottom: 22 }]}>
            <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="cover" />
            <View>
              <Text style={styles.brandText}>Neuro<Text style={{ color: Colors.brandMint }}>Scan</Text> AI</Text>
              <Text style={[styles.brandSub, { color: 'rgba(255, 255, 255, 0.85)' }]}>Cổng nội bộ · Nhân viên y tế</Text>
            </View>
          </View>
          {card}
          <Text style={styles.footerText}>© 2026 NeuroScan AI · Chỉ dành cho nhân viên được ủy quyền</Text>
        </ScrollView>
      )}

      {/* Quên mật khẩu — luồng đầy đủ (email → OTP → mật khẩu mới) */}
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={email}
        theme="light"
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

const web = (webStyle, fallback = {}) => Platform.select({ web: webStyle, default: fallback });

const INK = '#0F172A';
const MUTED = '#64748B';
const DEEP = '#061A36';
const LIGHT_BG = '#0B3F9C'; // xanh dương hoàng gia

const styles = StyleSheet.create({
  flexOne: { flex: 1, backgroundColor: LIGHT_BG },

  // ----- Bố cục máy tính -----
  desktop: { flex: 1, flexDirection: 'row', overflow: 'hidden', ...web({ height: '100vh' }) },
  leftCol: {
    flex: 1.05, overflow: 'hidden', backgroundColor: '#0B3F9C',
    borderRightWidth: 0,
  },
  leftBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  leftTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 63, 156, 0.6)',
    ...web({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(180deg, rgba(7, 42, 110, 0.62) 0%, rgba(22, 96, 201, 0.22) 26%, rgba(11, 63, 156, 0.52) 52%, rgba(7, 42, 110, 0.86) 78%, rgba(7, 36, 96, 0.95) 100%),' +
        'linear-gradient(110deg, rgba(7, 42, 110, 0.35) 0%, rgba(45, 127, 224, 0.14) 70%)',
    }),
  },
  leftContent: { flex: 1, paddingHorizontal: 52, paddingTop: 44, paddingBottom: 36, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF' },
  brandText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  brandTextAccent: { color: Colors.brandMint },
  brandSub: { color: Colors.onDarkMuted, fontSize: 12, marginTop: 1 },
  staffTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(164, 251, 229, 0.35)',
    backgroundColor: 'rgba(6, 26, 54, 0.55)',
  },
  staffTagText: { color: Colors.brandMint, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },

  slideMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 26, maxWidth: 620 },
  slideCaptionBox: { flex: 1, height: 30, justifyContent: 'center' },
  slideCaptionItem: {
    position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 10, paddingRight: 14, height: 30, borderRadius: 999,
    backgroundColor: 'rgba(6, 26, 54, 0.55)', borderWidth: 1, borderColor: 'rgba(164, 251, 229, 0.18)',
    ...web({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }),
  },
  slideCaptionBar: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brandGreenOnDark },
  slideCaption: { color: Colors.onDarkText, fontSize: 12.5, fontWeight: '600' },
  heroEyebrow: { color: Colors.brandMint, fontSize: 12, fontWeight: '800', letterSpacing: 2.6, marginBottom: 14, ...web({ textShadow: '0 1px 8px rgba(7, 30, 61, 0.45)' }) },
  heroTitle: { color: '#FFFFFF', fontSize: 42, lineHeight: 52, fontWeight: '700', letterSpacing: -0.5 },
  heroTitleAccent: { color: Colors.brandMint },
  heroSub: { color: Colors.onDarkMuted, fontSize: 15.5, lineHeight: 23, marginTop: 14, maxWidth: 520 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 26, maxWidth: 620 },
  tile: {
    width: '48%', flexGrow: 1, minWidth: 220,
    paddingHorizontal: 20, paddingVertical: 16, borderRadius: 22, gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.22)',
    ...web({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }),
  },
  tileTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  tileDesc: { color: Colors.onDarkSubtle, fontSize: 12.5, lineHeight: 17 },

  statusBar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginTop: 26, paddingTop: 16, maxWidth: 620,
    borderTopWidth: 1, borderTopColor: 'rgba(164, 251, 229, 0.12)',
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusText: { color: Colors.onDarkMuted, fontSize: 12.5 },

  rightCol: {
    flex: 0.95, overflow: 'hidden', backgroundColor: LIGHT_BG,
    ...web({
      backgroundImage: 'radial-gradient(900px 640px at 92% 8%, rgba(110, 200, 255, 0.45), transparent 60%), linear-gradient(135deg, #072A6E 0%, #0B3F9C 38%, #1660C9 70%, #2D7FE0 100%)',
      boxShadow: 'inset 14px 0 28px -22px rgba(11, 42, 85, 0.55)',
    }),
  },
  homeBtn: {
    position: 'absolute', top: 28, right: 32, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1, borderColor: '#E2E8F0',
    ...web({ cursor: 'pointer', boxShadow: '0 8px 20px -12px rgba(11, 42, 85, 0.35)', transition: 'box-shadow 0.2s ease' }),
  },
  homeBtnText: { color: Colors.brandNavy, fontSize: 13, fontWeight: '700' },
  // Lưới tổ ong nhỏ mờ (lặp lại)
  rightGrid: web({
    ...StyleSheet.absoluteFillObject,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2766%27%20height%3D%2738.1%27%20viewBox%3D%270%200%2066%2038.1%27%3E%3Cg%20fill%3D%27none%27%20stroke%3D%27white%27%20stroke-opacity%3D%270.09%27%20stroke-width%3D%271%27%3E%3Cpolygon%20points%3D%2722.0%2C0.0%2011.0%2C19.1%20-11.0%2C19.1%20-22.0%2C0.0%20-11.0%2C-19.1%2011.0%2C-19.1%27%2F%3E%3Cpolygon%20points%3D%2722.0%2C38.1%2011.0%2C57.2%20-11.0%2C57.2%20-22.0%2C38.1%20-11.0%2C19.1%2011.0%2C19.1%27%2F%3E%3Cpolygon%20points%3D%2755.0%2C19.1%2044.0%2C38.1%2022.0%2C38.1%2011.0%2C19.1%2022.0%2C0.0%2044.0%2C0.0%27%2F%3E%3Cpolygon%20points%3D%2788.0%2C0.0%2077.0%2C19.1%2055.0%2C19.1%2044.0%2C0.0%2055.0%2C-19.1%2077.0%2C-19.1%27%2F%3E%3Cpolygon%20points%3D%2788.0%2C38.1%2077.0%2C57.2%2055.0%2C57.2%2044.0%2C38.1%2055.0%2C19.1%2077.0%2C19.1%27%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E")',
    backgroundSize: '66px 38.1px',
  }),
  // Cảnh trang trí: mạng lục giác phát sáng, dấu thập y tế, vệt sáng (SVG vẽ tay)
  rightScene: web({
    position: 'absolute', top: -30, left: -30, right: -30, bottom: -30,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27900%27%20height%3D%271000%27%20viewBox%3D%270%200%20900%201000%27%20preserveAspectRatio%3D%27xMidYMid%20slice%27%3E%3Cdefs%3E%3Cfilter%20id%3D%27g%27%20x%3D%27-30%25%27%20y%3D%27-30%25%27%20width%3D%27160%25%27%20height%3D%27160%25%27%3E%3CfeGaussianBlur%20stdDeviation%3D%279%27%2F%3E%3C%2Ffilter%3E%3ClinearGradient%20id%3D%27bar%27%20x1%3D%270%27%20x2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%236FB6FF%27%20stop-opacity%3D%270%27%2F%3E%3Cstop%20offset%3D%270.5%27%20stop-color%3D%27%236FB6FF%27%20stop-opacity%3D%270.55%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%236FB6FF%27%20stop-opacity%3D%270%27%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%27band%27%20x1%3D%270%27%20x2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%233D8BFF%27%20stop-opacity%3D%270%27%2F%3E%3Cstop%20offset%3D%270.4%27%20stop-color%3D%27%233D8BFF%27%20stop-opacity%3D%270.30%27%2F%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%233D8BFF%27%20stop-opacity%3D%270.05%27%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20x%3D%2740%27%20y%3D%27150%27%20width%3D%27330%27%20height%3D%277%27%20fill%3D%27url(%23bar)%27%2F%3E%3Crect%20x%3D%27230%27%20y%3D%27760%27%20width%3D%27640%27%20height%3D%2780%27%20fill%3D%27url(%23band)%27%2F%3E%3Cg%20fill%3D%27none%27%20stroke%3D%27%234FE6F7%27%20stroke-width%3D%2716%27%20stroke-opacity%3D%270.35%27%20filter%3D%27url(%23g)%27%3E%3Cpolygon%20points%3D%27715.0%2C200.0%20662.5%2C290.9%20557.5%2C290.9%20505.0%2C200.0%20557.5%2C109.1%20662.5%2C109.1%27%2F%3E%3Cpolygon%20points%3D%27872.5%2C290.9%20820.0%2C381.9%20715.0%2C381.9%20662.5%2C290.9%20715.0%2C200.0%20820.0%2C200.0%27%2F%3E%3Cpolygon%20points%3D%27715.0%2C381.9%20662.5%2C472.8%20557.5%2C472.8%20505.0%2C381.9%20557.5%2C290.9%20662.5%2C290.9%27%2F%3E%3Cpolygon%20points%3D%27557.5%2C290.9%20505.0%2C381.9%20400.0%2C381.9%20347.5%2C290.9%20400.0%2C200.0%20505.0%2C200.0%27%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%27none%27%20stroke%3D%27%235CEBFA%27%20stroke-width%3D%275%27%20stroke-opacity%3D%270.95%27%20stroke-linejoin%3D%27round%27%3E%3Cpolygon%20points%3D%27715.0%2C200.0%20662.5%2C290.9%20557.5%2C290.9%20505.0%2C200.0%20557.5%2C109.1%20662.5%2C109.1%27%2F%3E%3Cpolygon%20points%3D%27872.5%2C290.9%20820.0%2C381.9%20715.0%2C381.9%20662.5%2C290.9%20715.0%2C200.0%20820.0%2C200.0%27%2F%3E%3Cpolygon%20points%3D%27715.0%2C381.9%20662.5%2C472.8%20557.5%2C472.8%20505.0%2C381.9%20557.5%2C290.9%20662.5%2C290.9%27%2F%3E%3Cpolygon%20points%3D%27557.5%2C290.9%20505.0%2C381.9%20400.0%2C381.9%20347.5%2C290.9%20400.0%2C200.0%20505.0%2C200.0%27%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%27%239AF6FF%27%20fill-opacity%3D%270.9%27%3E%3Ccircle%20cx%3D%27715.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27662.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27557.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27505.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27557.5%27%20cy%3D%27109.1%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27662.5%27%20cy%3D%27109.1%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27872.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27820.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27715.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27662.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27715.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27820.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27715.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27662.5%27%20cy%3D%27472.8%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27557.5%27%20cy%3D%27472.8%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27505.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27557.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27662.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27557.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27505.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27400.0%27%20cy%3D%27381.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27347.5%27%20cy%3D%27290.9%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27400.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3Ccircle%20cx%3D%27505.0%27%20cy%3D%27200.0%27%20r%3D%275%27%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%27M70%2C640%20h110%20v110%20h110%20v110%20h-110%20v110%20h-110%20v-110%20h-110%20v-110%20h110%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.1%27%2F%3E%3Cpath%20d%3D%27M356.6666666666667%2C70%20h26.666666666666668%20v26.666666666666664%20h26.666666666666664%20v26.666666666666668%20h-26.666666666666664%20v26.666666666666664%20h-26.666666666666668%20v-26.666666666666664%20h-26.666666666666664%20v-26.666666666666668%20h26.666666666666664%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.45%27%2F%3E%3Cpath%20d%3D%27M513.3333333333334%2C30%20h13.333333333333334%20v13.333333333333332%20h13.333333333333332%20v13.333333333333334%20h-13.333333333333332%20v13.333333333333332%20h-13.333333333333334%20v-13.333333333333332%20h-13.333333333333332%20v-13.333333333333334%20h13.333333333333332%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.55%27%2F%3E%3Cpath%20d%3D%27M310%2C230%20h10%20v10%20h10%20v10%20h-10%20v10%20h-10%20v-10%20h-10%20v-10%20h10%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.25%27%2F%3E%3Cpath%20d%3D%27M275.3333333333333%2C210%20h5.333333333333333%20v5.333333333333334%20h5.333333333333334%20v5.333333333333333%20h-5.333333333333334%20v5.333333333333334%20h-5.333333333333333%20v-5.333333333333334%20h-5.333333333333334%20v-5.333333333333333%20h5.333333333333334%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.2%27%2F%3E%3Cpath%20d%3D%27M703.3333333333334%2C720%20h23.333333333333332%20v23.333333333333336%20h23.333333333333336%20v23.333333333333332%20h-23.333333333333336%20v23.333333333333336%20h-23.333333333333332%20v-23.333333333333336%20h-23.333333333333336%20v-23.333333333333332%20h23.333333333333336%20z%27%20fill%3D%27none%27%20stroke%3D%27%23FFFFFF%27%20stroke-opacity%3D%270.9%27%20stroke-width%3D%272.5%27%20stroke-linejoin%3D%27round%27%2F%3E%3Cpath%20d%3D%27M444%2C800%20h14%20v14%20h14%20v14%20h-14%20v14%20h-14%20v-14%20h-14%20v-14%20h14%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.8%27%2F%3E%3Cpath%20d%3D%27M787.3333333333334%2C140%20h7.333333333333333%20v7.333333333333334%20h7.333333333333334%20v7.333333333333333%20h-7.333333333333334%20v7.333333333333334%20h-7.333333333333333%20v-7.333333333333334%20h-7.333333333333334%20v-7.333333333333333%20h7.333333333333334%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.8%27%2F%3E%3Cpath%20d%3D%27M825.3333333333334%2C260%20h5.333333333333333%20v5.333333333333334%20h5.333333333333334%20v5.333333333333333%20h-5.333333333333334%20v5.333333333333334%20h-5.333333333333333%20v-5.333333333333334%20h-5.333333333333334%20v-5.333333333333333%20h5.333333333333334%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.7%27%2F%3E%3Cpath%20d%3D%27M156%2C420%20h6%20v6%20h6%20v6%20h-6%20v6%20h-6%20v-6%20h-6%20v-6%20h6%20z%27%20fill%3D%27%23FFFFFF%27%20fill-opacity%3D%270.3%27%2F%3E%3Cpath%20d%3D%27M770%2C900%20h10%20v10%20h10%20v10%20h-10%20v10%20h-10%20v-10%20h-10%20v-10%20h10%20z%27%20fill%3D%27none%27%20stroke%3D%27%23FFFFFF%27%20stroke-opacity%3D%270.25%27%20stroke-width%3D%272.5%27%20stroke-linejoin%3D%27round%27%2F%3E%3Cg%20fill%3D%27white%27%20fill-opacity%3D%270.8%27%3E%3Ccircle%20cx%3D%27480%27%20cy%3D%27690%27%20r%3D%272.5%27%2F%3E%3Ccircle%20cx%3D%27520%27%20cy%3D%27740%27%20r%3D%272%27%2F%3E%3Ccircle%20cx%3D%27850%27%20cy%3D%2760%27%20r%3D%272.5%27%2F%3E%3Ccircle%20cx%3D%27620%27%20cy%3D%27600%27%20r%3D%271.8%27%2F%3E%3Ccircle%20cx%3D%27120%27%20cy%3D%27300%27%20r%3D%271.8%27%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }),
  rightScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 84, paddingBottom: 32 }, // chừa chỗ nút 'Về trang chủ'

  // ----- Điện thoại -----
  mobilePage: {
    flex: 1, backgroundColor: LIGHT_BG,
    ...web({ backgroundImage: 'radial-gradient(900px 640px at 92% 8%, rgba(110, 200, 255, 0.45), transparent 60%), linear-gradient(135deg, #072A6E 0%, #0B3F9C 38%, #1660C9 70%, #2D7FE0 100%)' }),
  },
  containerMobile: { flexGrow: 1, alignItems: 'center', paddingTop: 36, paddingBottom: 28, paddingHorizontal: 16 },

  // ----- Thẻ -----
  cardStack: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  card: {
    width: '100%', borderRadius: 30, backgroundColor: '#FFFFFF', overflow: 'hidden',
    ...web({ boxShadow: '0 40px 80px -36px rgba(7, 30, 61, 0.65), 0 18px 36px -24px rgba(7, 30, 61, 0.35)' }),
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 40, right: 40, height: 3, zIndex: 2, borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
    ...web({ backgroundImage: 'linear-gradient(90deg, #0B2A55, #0E8A7A 55%, #3DDBA6)' }),
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 34, paddingTop: 40 },
  cardHeadMobile: { paddingHorizontal: 22, paddingTop: 26 },
  padMobile: { paddingHorizontal: 22 },
  headIcon: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brandNavy,
    ...web({ backgroundImage: 'linear-gradient(140deg, #0B2A55, #0D4F6E)', boxShadow: '0 10px 20px -10px rgba(11, 42, 85, 0.8)' }),
  },
  eyebrowText: { color: '#0B6E62', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  headerTitle: { color: Colors.brandNavy, fontSize: 26, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 },
  headerSub: { color: MUTED, fontSize: 13.5, lineHeight: 20, paddingHorizontal: 34, marginTop: 16 },

  cardBody: { paddingHorizontal: 34, paddingTop: 24, paddingBottom: 32 },
  checkingBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  checkingText: { color: MUTED, fontSize: 13 },
  formBox: { width: '100%' },

  label: { color: '#1E3A5F', fontSize: 13, fontWeight: '700', marginBottom: 8, paddingLeft: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8, paddingHorizontal: 4 },
  forgotText: { color: '#0B6E62', fontSize: 13, fontWeight: '700' },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    height: 52, borderRadius: 999, paddingLeft: 20, paddingRight: 8,
    backgroundColor: '#F5F8FC',
    borderWidth: 1, borderColor: '#D9E2EE',
    ...web({ transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease' }),
  },
  fieldFocused: {
    borderColor: '#0E8A7A',
    backgroundColor: '#FFFFFF',
    ...web({ boxShadow: '0 0 0 4px rgba(14, 138, 122, 0.13)' }),
  },
  fieldInvalid: { borderColor: '#F87171' },
  fieldInput: { flex: 1, height: '100%', color: INK, fontSize: 15, ...web({ outlineStyle: 'none' }) },
  otpInput: { fontSize: 18, letterSpacing: 6, fontWeight: '700' },
  eyeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },

  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { color: '#DC2626', fontSize: 12.5, lineHeight: 17, flex: 1 },

  devOtp: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FEF3C7' },
  devOtpText: { color: '#92400E', fontSize: 12, textAlign: 'center' },
  devOtpCode: { fontWeight: '800', letterSpacing: 2 },

  otpMailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, marginBottom: 18,
    backgroundColor: Colors.brandGreenSoft,
  },
  otpMailText: { color: MUTED, fontSize: 13, flex: 1 },
  otpMailValue: { color: INK, fontWeight: '700' },

  primaryBtn: {
    height: 54, borderRadius: 999, marginTop: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brandNavy,
    ...web({
      backgroundImage: 'linear-gradient(110deg, #0B2A55 0%, #0D4F6E 50%, #0E8A7A 100%)',
      backgroundSize: '200% 100%',
      backgroundPosition: 'left',
      transition: 'background-position 0.5s ease, box-shadow 0.25s ease',
      cursor: 'pointer',
      boxShadow: '0 14px 28px -14px rgba(11, 42, 85, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    }),
  },
  primaryBtnHover: web(
    { backgroundPosition: 'right', boxShadow: '0 18px 32px -14px rgba(14, 138, 122, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.16)' },
    { backgroundColor: '#0B6E62' },
  ),
  btnFocus: web(
    { outlineStyle: 'none', boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(14, 138, 122, 0.55)' },
    { borderWidth: 2, borderColor: '#0E8A7A' },
  ),
  btnDim: { opacity: 0.85 },
  primaryBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700', letterSpacing: 0.2 },

  twoFaLinks: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  linkMuted: { color: MUTED, fontSize: 13, fontWeight: '600' },
  linkAccent: { color: '#0B6E62', fontSize: 13, fontWeight: '700' },

  cardFoot: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#F5F8FC', borderTopWidth: 1, borderTopColor: '#E8EEF5',
  },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footText: { color: '#526179', fontSize: 11.5, fontWeight: '600' },
  footSep: { width: 1, height: 12, backgroundColor: '#D9E2EE' },

  belowCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 },
  belowItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  belowText: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 },
  belowStrong: { color: '#FFFFFF', fontWeight: '700' },
  belowLink: { color: Colors.brandMint, fontWeight: '700' },
  belowDot: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 },
  footerText: { color: 'rgba(255, 255, 255, 0.72)', fontSize: 12, marginTop: 14, textAlign: 'center', lineHeight: 17, maxWidth: 440 },
});

export default StaffLoginScreen;
