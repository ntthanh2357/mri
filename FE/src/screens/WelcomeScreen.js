import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  Modal,
  Linking,
} from 'react-native';
import Config from '../constants/config';
import Colors from '../constants/colors';
import { get, post, setAuthToken } from '../services/api.service';
import { signInWithGoogleWeb } from '../firebase';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle, Info, ShieldCheck, Sparkles, Check, Brain, Microscope, Stethoscope, RefreshCw,
  ArrowRight, ArrowLeft, Mail, Lock, KeyRound, Phone, UserRound, UserPlus, LogIn, House,
} from 'lucide-react';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import PressableScale from '../components/PressableScale';
import HeroScanOverlay from '../components/HeroScanOverlay';
import { FloatingOrb } from '../components/ui/Motion';
import useWelcomeAnimations from '../controllers/useWelcomeAnimations';
import styles from './WelcomeScreen.styles';
import { useDialogKeys } from '../utils/useDialogKeys';

// Ảnh hero desktop (Welcome): banner thương hiệu + 2 ảnh tạo bằng Gemini (nguồn ở assets/brand-src).
const HERO_SLIDES = [
  require('../../assets/welcome-hero.jpg'),
  require('../../assets/images/welcome-hero-2.jpg'),
  require('../../assets/images/welcome-hero-3.jpg'),
];

// Dữ liệu dịch vụ (static, dùng chung white-label)
const servicesData = [
  { id: 1, title: 'Chụp cộng hưởng từ MRI Não', icon: 'Brain' },
  { id: 2, title: 'Phân tích & Tầm soát U não AI', icon: 'Sparkles' },
  { id: 3, title: 'Chẩn đoán hình ảnh Ung thư Não', icon: 'Microscope' },
];

// ===== Thành phần hiển thị của thẻ đăng nhập (không chứa logic nghiệp vụ) =====
// Khai báo ngoài WelcomeScreen để ô nhập không bị tạo lại (mất focus) mỗi lần gõ.
const IS_WEB = Platform.OS === 'web';
const FIELD_ICON = { idle: '#8A9AB3', focus: '#0E8A7A', error: '#C2410C' };

/** Ô nhập có biểu tượng đầu dòng; viền + vòng sáng khi focus nằm ở khung ngoài. */
const AuthField = ({ icon: Icon, focused, error, trailing, style, inputStyle, ...inputProps }) => (
  <View style={[styles.fieldShell, style, focused && styles.fieldShellFocused, !!error && styles.fieldShellError]}>
    {Icon ? (
      <Icon size={18} strokeWidth={2} color={error ? FIELD_ICON.error : focused ? FIELD_ICON.focus : FIELD_ICON.idle} />
    ) : null}
    <TextInput style={[styles.fieldInput, inputStyle]} placeholderTextColor={Colors.secondary} {...inputProps} />
    {trailing}
  </View>
);

/** Dòng báo lỗi dưới ô nhập. */
const FieldError = ({ message }) =>
  message ? (
    <View style={styles.inlineErrorRow}>
      <AlertCircle size={13} color={FIELD_ICON.error} />
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  ) : null;

/** Mã OTP thử nghiệm — chỉ có khi backend bật ENABLE_DEBUG_OTP. */
const DevOtpNote = ({ code }) =>
  code ? (
    <View style={styles.devOtpBox}>
      <Text style={styles.devOtpTag}>DEV</Text>
      <Text style={styles.devOtpText}>
        Mã OTP thử nghiệm: <Text style={styles.devOtpCode}>{code}</Text>
      </Text>
    </View>
  ) : null;

/** Nút chính dạng viên, nền chuyển navy → xanh ngọc. */
const PrimaryButton = ({ label, loadingLabel, loading, onPress }) => (
  <PressableScale
    style={styles.formButton}
    hoverStyle={styles.formButtonHover}
    focusStyle={styles.buttonFocus}
    onPress={onPress}
    disabled={loading}
  >
    <View style={styles.btnLoadingRow}>
      {loading ? <ActivityIndicator color="#FFF" size="small" /> : null}
      <Text style={styles.formButtonText}>{loading ? loadingLabel : label}</Text>
      {loading ? null : <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
    </View>
  </PressableScale>
);

/**
 * Đầu thẻ: nhãn nhỏ + tiêu đề + mô tả + huy hiệu biểu tượng.
 * dark: nền navy (desktop, đi cùng cột ảnh bên trái); sáng: nền trắng (điện thoại — ảnh hero phía trên đã là navy).
 */
const AuthCardHeader = ({ dark, compact, eyebrow, title, subtitle }) => (
  <View style={[styles.cardHeader, dark ? styles.cardHeaderDark : styles.cardHeaderLight, compact && styles.cardHeaderCompact]}>
    {dark ? <View style={styles.cardHeaderGlow} pointerEvents="none" /> : null}
    {dark ? <View style={styles.cardHeaderRing} pointerEvents="none" /> : null}
    {!dark && IS_WEB ? <View style={styles.cardTopAccent} pointerEvents="none" /> : null}
    <View style={styles.cardHeaderRow}>
      <View style={styles.cardHeaderText}>
        <View style={[styles.eyebrowChip, dark && styles.eyebrowChipDark]}>
          <View style={[styles.eyebrowDot, dark && styles.eyebrowDotDark]} />
          <Text style={[styles.eyebrowText, dark && styles.eyebrowTextDark]}>{eyebrow}</Text>
        </View>
        <Text style={[styles.authCardTitle, dark && styles.authCardTitleDark]} accessibilityRole="header" dataSet={{ font: 'display' }}>
          {title}
        </Text>
        <Text style={[styles.authCardSub, dark && styles.authCardSubDark]}>{subtitle}</Text>
      </View>
    </View>
  </View>
);

const WelcomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // Cổng bệnh nhân (B2C): trên Web chỉ dành cho đăng nhập Bệnh nhân —
  // nhân viên y tế dùng Cổng nội bộ riêng tại /staff (tách luồng bảo mật).
  const isWeb = Platform.OS === 'web';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const scrollViewRef = useRef(null);
  const anim = useWelcomeAnimations(4, HERO_SLIDES.length); // 4 dòng tính năng + các ảnh hero desktop

  // Offset để scroll tới từng section
  const sectionOffsets = useRef({});

  // Form toggles & field states
  const [activeForm, setActiveForm] = useState('login'); // 'login' | 'register'
  const [loginRole, setLoginRole] = useState('patient'); // 'patient' | 'staff'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusedInput, setFocusedInput] = useState(null);

  // Validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // 2FA states — xác thực 2 lớp phía SERVER qua /auth/verify-2fa
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [resendingOtp, setResendingOtp] = useState(false);

  // [FIX] OTP debug (ENABLE_DEBUG_OTP=true) hiển thị INLINE trong form OTP,
  // không dùng modal chặn khiến nút "Xác nhận" không bấm được trên web.
  const [debugOtp, setDebugOtp] = useState('');

  // Quên mật khẩu — modal luồng đầy đủ (email → OTP + mật khẩu mới)
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Patient activation states
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    type: 'success', // 'success' | 'error' | 'info'
    title: '',
    message: '',
    onClose: null,
  });
  // Đóng hộp thông báo (nút "Tiếp tục", phím Enter hoặc Esc)
  const closeCustomAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
    if (customAlert.onClose) {
      customAlert.onClose();
    }
  };
  useDialogKeys(customAlert.visible, { onEnter: closeCustomAlert, onEscape: closeCustomAlert });

  const showAlert = (type, title, message, onClose = null) => {
    setCustomAlert({
      visible: true,
      type,
      title,
      message,
      onClose,
    });
  };

  const handleForgotPassword = () => {
    // Mở modal luồng quên mật khẩu đầy đủ:
    // Bước 1 nhập email → server gửi OTP; Bước 2 nhập OTP + mật khẩu mới.
    setShowForgotPassword(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await get('/auth/me');
        if (data && data.user) {
          const destination = (data.user.role === 'admin' || data.user.role === 'system_admin')
            ? 'AdminBackoffice'
            : (data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
          navigation.reset({
            index: 0,
            routes: [{ name: destination }],
          });
          return;
        }
      } catch (err) {
        console.log('Welcome auto-login check failed or no token:', err.message);
        // Xóa token chết hoặc hết hạn để tránh lặp vô tận
        await setAuthToken(null);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');
    setVerificationError('');

    if (!email) {
      if (loginRole === 'patient') {
        setEmailError('Vui lòng nhập địa chỉ Email.');
      } else {
        setEmailError('Vui lòng nhập Mã nhân sự hoặc Email nội bộ.');
      }
      return;
    }
    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu.');
      return;
    }

    if (showVerification && !verificationCode) {
      setVerificationError('Vui lòng nhập mã xác thực OTP.');
      return;
    }

    setLoading(true);
    try {
      const data = await post('/auth/login', { 
        email, 
        password,
        roleType: loginRole,
        otp: showVerification ? verificationCode : undefined
      });

      // Bệnh nhân chưa kích hoạt/xác thực email
      if (data.requiresVerification) {
        setVerificationEmail(email.trim());
        setShowVerification(true);
        // [FIX] OTP debug hiển thị inline thay vì modal chặn form
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        } else {
          showAlert(
            'info',
            'Tài khoản chưa kích hoạt',
            'Tài khoản bệnh nhân của bạn chưa được kích hoạt qua mã OTP. Một mã OTP mới đã được gửi tới email của bạn. Vui lòng nhập mã để kích hoạt và đăng nhập.'
          );
        }
        return;
      }

      // Nhân viên chưa kích hoạt → bắt buộc đặt mật khẩu mới
      if (data.requiresActivation) {
        // Lưu kèm refreshToken để gia hạn phiên ngầm (silent refresh)
      await setAuthToken(data.accessToken, data.refreshToken);
        navigation.replace('ActivateAccount', { user: data.user, accessToken: data.accessToken });
        return;
      }

      // [2FA] Xác thực 2 lớp bắt buộc với MỌI tài khoản (bệnh nhân + nhân viên).
      // Server KHÔNG trả token ở bước này — token chỉ được cấp sau khi nhập
      // đúng mã OTP qua /auth/verify-2fa (kiểm định phía server).
      if (data.requires2FA) {
        setTwoFactorEmail((data.twoFactorEmail || email).trim());
        setShowTwoFactor(true);
        // [FIX] form 2FA đã tự mô tả "mã đã được gửi tới email" — bỏ modal chặn,
        // OTP debug (nếu có) hiển thị inline ngay trong form.
        setDebugOtp(data.otp2FA || '');
        return;
      }

      // Phân tách nghiêm ngặt vai trò (Client-side defense) — đặt SAU các bước
      // chờ OTP vì response requires2FA / requiresVerification KHÔNG kèm user;
      // tới đây thì response chắc chắn đã có user (đăng nhập hoàn tất).
      const isStaffUser = data.user && data.user.role !== 'patient';
      if (loginRole === 'patient' && isStaffUser) {
        showAlert(
          'error',
          'Sai phân hệ đăng nhập',
          Platform.OS === 'web'
            ? 'Tài khoản của bạn thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng đăng nhập qua Cổng nội bộ tại địa chỉ /staff.'
            : 'Tài khoản của bạn thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng chuyển sang tab "Bác sĩ / Nhân viên" để đăng nhập.'
        );
        return;
      }
      if (loginRole === 'staff' && !isStaffUser) {
        showAlert(
          'error',
          'Sai phân hệ đăng nhập',
          'Tài khoản của bạn thuộc phân hệ Bệnh nhân. Vui lòng chuyển sang tab "Bệnh nhân" để đăng nhập.'
        );
        return;
      }

      // Trường hợp còn lại (vd: bệnh nhân vừa kích hoạt tài khoản bằng OTP
      // ngay ở bước đăng nhập) — server xác nhận email nên cấp token luôn.
      // Lưu kèm refreshToken để gia hạn phiên ngầm (silent refresh)
      await setAuthToken(data.accessToken, data.refreshToken);
      const destination = data.user && (data.user.role === 'admin' || data.user.role === 'system_admin')
        ? 'AdminBackoffice'
        : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
      showAlert('success', 'Đăng nhập thành công', 'Chào mừng bạn quay trở lại với NeuroScan AI!', () => {
        setShowVerification(false);
        setVerificationCode('');
        navigation.reset({
          index: 0,
          routes: [{ name: destination }],
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      let errMsg = error.message || 'Không thể kết nối đến máy chủ.';
      // BE trả message chung theo kiểu "tab" (cho app di động) — trên web cổng /
      // dành riêng Bệnh nhân, diễn đạt lại thành chỉ dẫn tới Cổng nội bộ /staff.
      if (Platform.OS === 'web' && errMsg.includes('thuộc phân hệ Bác sĩ')) {
        errMsg = 'Tài khoản của bạn thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng đăng nhập qua Cổng nội bộ tại địa chỉ /staff.';
        showAlert('error', 'Sai phân hệ đăng nhập', errMsg);
        return;
      }
      if (showVerification && (errMsg.includes('OTP') || errMsg.includes('xác thực') || errMsg.includes('Kích hoạt'))) {
        setVerificationError(errMsg);
      } else if (errMsg.toLowerCase().includes('không chính xác') || errMsg.toLowerCase().includes('không tồn tại')) {
        setPasswordError('Thông tin đăng nhập chưa chính xác, bạn vui lòng kiểm tra lại nhé.');
      } else {
        setPasswordError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setNameError('');
    setEmailError('');
    setPhoneError('');
    setPasswordError('');

    let hasError = false;

    if (!name.trim()) {
      setNameError('Vui lòng nhập Họ và tên.');
      hasError = true;
    }

    if (!email.trim()) {
      setEmailError('Vui lòng nhập địa chỉ Email.');
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setEmailError('Địa chỉ Email không đúng định dạng chuẩn.');
        hasError = true;
      }
    }

    if (phone.trim()) {
      const phoneRegex = /^[0-9]{9,11}$/;
      if (!phoneRegex.test(phone.trim())) {
        setPhoneError('Số điện thoại phải chứa 9–11 chữ số.');
        hasError = true;
      }
    }

    if (!password) {
      setPasswordError('Vui lòng nhập Mật khẩu.');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Mật khẩu phải chứa ít nhất 6 ký tự.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'patient',
        phone: phone.trim() || undefined,
      };
      const data = await post('/auth/register', payload);
      
      if (data.requiresVerification) {
        setVerificationEmail(email.trim());
        setShowVerification(true);
        setActiveForm('login');
        setEmail(email.trim());
        setPassword(password);
        // [FIX] OTP debug hiển thị inline trong form OTP (không modal chặn)
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        } else {
          showAlert(
            'success',
            'Đăng ký thành công!',
            'Tài khoản bệnh nhân đã được tạo. Vui lòng nhập mã OTP 6 chữ số vừa gửi đến email của bạn vào ô OTP xuất hiện ở form đăng nhập bên dưới để kích hoạt.'
          );
        }
      } else {
        showAlert('success', 'Đăng ký thành công', 'Tài khoản đã được tạo! Vui lòng đăng nhập.', () => {
          setActiveForm('login');
          setEmail('');
          setPassword('');
          setName('');
          setPhone('');
        });
      }
    } catch (error) {
      console.error('Register error:', error);
      showAlert('error', 'Đăng ký thất bại', error.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyActivation = async () => {
    setVerificationError('');
    if (!verificationCode) {
      setVerificationError('Vui lòng nhập mã OTP kích hoạt.');
      return;
    }
    if (verificationCode.length !== 6) {
      setVerificationError('Mã OTP không hợp lệ. Vui lòng nhập đúng 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      await post('/auth/verify-activation', {
        email: verificationEmail,
        otp: verificationCode
      });
      showAlert('success', 'Kích hoạt thành công!', 'Tài khoản bệnh nhân đã được kích hoạt thành công. Bây giờ bạn có thể đăng nhập.', () => {
        setShowVerification(false);
        setVerificationCode('');
        setActiveForm('login');
        setEmail(verificationEmail);
        setPassword('');
      });
    } catch (error) {
      console.error('Verify activation error:', error);
      setVerificationError(error.message || 'Mã xác thực không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendActivation = async () => {
    setLoading(true);
    const targetEmail = verificationEmail || email.trim();
    if (!targetEmail) {
      showAlert('error', 'Gửi lại thất bại', 'Không xác định được địa chỉ email nhận mã.');
      setLoading(false);
      return;
    }
    try {
      const data = await post('/auth/resend-activation', { email: targetEmail });
      // [FIX] OTP debug hiển thị inline (mã mới) thay vì modal chặn form
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      } else {
        showAlert(
          'success',
          'Gửi lại thành công',
          'Mã xác thực mới đã được gửi tới email của bạn.'
        );
      }
    } catch (error) {
      console.error('Resend activation error:', error);
      showAlert('error', 'Gửi lại thất bại', error.message || 'Không thể gửi lại mã xác thực. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2Factor = async () => {
    setTwoFactorError('');
    if (!twoFactorCode) {
      setTwoFactorError('Vui lòng nhập mã xác thực OTP.');
      return;
    }
    if (twoFactorCode.length !== 6) {
      setTwoFactorError('Mã OTP không hợp lệ. Vui lòng nhập đúng 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      // Xác thực OTP phía SERVER — token chỉ được cấp khi mã đúng
      const data = await post('/auth/verify-2fa', {
        email: twoFactorEmail,
        otp: twoFactorCode.trim(),
      });

      // [Tách luồng] Nếu tài khoản là nhân viên lâm sàng → KHÔNG lưu token vào
      // Cổng bệnh nhân (đề phòng xác thực OTP cho phiên đăng nhập sai cổng).
      const verifiedRole = data.user ? data.user.role : null;
      const clinicalStaff =
        verifiedRole && !['patient', 'admin', 'system_admin', 'hospital_admin'].includes(verifiedRole);
      if (clinicalStaff) {
        showAlert(
          'error',
          'Sai phân hệ đăng nhập',
          Platform.OS === 'web'
            ? 'Tài khoản của bạn thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng đăng nhập qua Cổng nội bộ tại địa chỉ /staff.'
            : 'Tài khoản của bạn thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng sử dụng Cổng nội bộ của bệnh viện.',
          () => {
            setShowTwoFactor(false);
            setTwoFactorCode('');
            setTwoFactorEmail('');
          }
        );
        return;
      }

      // Lưu kèm refreshToken để gia hạn phiên ngầm (silent refresh)
      await setAuthToken(data.accessToken, data.refreshToken);
      const destination = data.user && (data.user.role === 'admin' || data.user.role === 'system_admin')
        ? 'AdminBackoffice'
        : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');

      showAlert('success', 'Đăng nhập thành công', 'Xác thực 2 lớp thành công!', () => {
        setShowTwoFactor(false);
        setTwoFactorCode('');
        setTwoFactorEmail('');
        navigation.reset({
          index: 0,
          routes: [{ name: destination }],
        });
      });
    } catch (error) {
      setTwoFactorError(error.message || 'Xác thực 2 lớp thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP xác thực 2 lớp (mã cũ bị vô hiệu, mã mới có hiệu lực 5 phút)
  const handleResend2FA = async () => {
    setTwoFactorError('');
    setResendingOtp(true);
    try {
      const data = await post('/auth/resend-2fa', { email: twoFactorEmail });
      // [FIX] OTP debug hiển thị inline (mã mới) thay vì modal chặn form
      if (data.otp2FA) {
        setDebugOtp(data.otp2FA);
      } else {
        showAlert(
          'info',
          'Đã gửi lại mã',
          (data.message || 'Mã OTP mới đã được gửi tới email của bạn.')
        );
      }
    } catch (error) {
      setTwoFactorError(error.message || 'Không thể gửi lại mã. Vui lòng thử lại sau.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      let idToken = null;

      if (Platform.OS === 'web') {
        try {
          idToken = await signInWithGoogleWeb();
          if (!idToken) {
            showAlert('info', 'Thông báo', 'Đăng nhập Google bị hủy.');
            setLoading(false);
            return;
          }
        } catch (firebaseErr) {
          console.error('Firebase sign in popup error:', firebaseErr);
          showAlert('error', 'Lỗi đăng nhập', 'Không thể mở popup hoặc quá trình đăng nhập Google bị gián đoạn.');
          setLoading(false);
          return;
        }
      } else {
        showAlert('info', 'Thông báo', 'Đăng nhập Google hiện tại chỉ hỗ trợ trên nền tảng Web.');
        setLoading(false);
        return;
      }

      const data = await post('/auth/sso/google', { idToken });

      // [2FA] SSO Google giờ cũng yêu cầu OTP email — response KHÔNG có token/user.
      if (data.requires2FA) {
        setTwoFactorEmail((data.twoFactorEmail || '').trim());
        setShowTwoFactor(true);
        // [FIX] bỏ modal chặn — OTP debug hiển thị inline trong form 2FA
        setDebugOtp(data.otp2FA || '');
        return;
      }

      // Phòng thủ doubly-safe: nếu server cấp token trực tiếp (trường hợp miễn
      // 2FA đặc biệt), chặn nghiêm ngặt tài khoản nhân viên lâm sàng khỏi
      // Cổng bệnh nhân (tách luồng bảo mật).
      const staffRoleViaSso = data.user && !['patient', 'admin', 'system_admin', 'hospital_admin'].includes(data.user.role);
      if (staffRoleViaSso) {
        showAlert(
          'error',
          'Sai phân hệ đăng nhập',
          'Tài khoản Google này thuộc phân hệ Bác sĩ / Nhân viên y tế. Vui lòng đăng nhập qua Cổng nội bộ của bệnh viện.'
        );
        return;
      }

      // Lưu kèm refreshToken để gia hạn phiên ngầm (silent refresh)
      await setAuthToken(data.accessToken, data.refreshToken);
      const destination = data.user && (data.user.role === 'admin' || data.user.role === 'system_admin') ? 'AdminBackoffice' : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
      showAlert('success', 'Đăng nhập thành công', 'Đăng nhập bằng tài khoản Google thành công.', () => {
        navigation.reset({
          index: 0,
          routes: [{ name: destination }],
        });
      });
    } catch (error) {
      console.error('Google SSO error:', error);
      const errMsg = error.message || 'Đăng nhập Google thất bại.';
      showAlert('error', 'Đăng nhập thất bại', errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ===== Thẻ đăng nhập / đăng ký / xác thực 2 lớp — một khối dùng chung cho desktop và điện thoại =====
  const passwordToggle = (
    <TouchableOpacity
      style={styles.passwordVisibilityBtn}
      onPress={() => setShowPassword(!showPassword)}
      accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
    </TouchableOpacity>
  );

  const cardHeader = showTwoFactor
    ? {
        icon: ShieldCheck,
        eyebrow: 'Bảo mật 2 lớp',
        title: 'Xác thực 2 lớp',
        subtitle: 'Mã xác thực đã được gửi tới địa chỉ email đăng ký của bạn. Vui lòng nhập để tiếp tục.',
      }
    : activeForm === 'login'
      ? {
          icon: LogIn,
          eyebrow: loginRole === 'patient' ? 'Cổng bệnh nhân' : 'Cổng nhân viên y tế',
          title: isDesktop ? 'Chào mừng quay trở lại' : 'Đăng nhập',
          subtitle: isDesktop ? 'Đăng nhập để truy cập hệ thống NeuroScan AI' : 'Truy cập hệ thống NeuroScan AI',
        }
      : {
          icon: UserPlus,
          eyebrow: 'Tài khoản mới',
          title: 'Đăng ký tài khoản',
          subtitle: 'Tạo tài khoản mới để lưu lịch sử chẩn đoán MRI',
        };

  const authCard = (
    <Animated.View style={[styles.authStack, anim.enterStyle(anim.card, 24)]}>
      <View style={styles.authCardContainer} dataSet={{ authcard: 'patient' }}>
        <AuthCardHeader dark={isDesktop} compact={!isDesktop} {...cardHeader} />

        <View style={[styles.cardBody, !isDesktop && styles.cardBodyCompact]}>
          {showTwoFactor ? (
            <View style={styles.authForm}>
              <View style={styles.otpSentBox}>
                <Mail size={16} color={Colors.brandGreen} />
                <Text style={styles.otpSentText}>
                  Mã được gửi tới: <Text style={styles.otpSentEmail}>{twoFactorEmail}</Text>
                </Text>
              </View>

              <Text style={styles.formLabel}>Mã xác thực OTP (6 chữ số) *</Text>
              <AuthField
                icon={KeyRound}
                focused={focusedInput === 'twoFactor'}
                error={twoFactorError}
                inputStyle={twoFactorCode ? styles.otpInputFilled : null}
                placeholder="Nhập 6 chữ số"
                value={twoFactorCode}
                onChangeText={(text) => {
                  setTwoFactorCode(text);
                  if (twoFactorError) setTwoFactorError('');
                }}
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={6}
                onFocus={() => setFocusedInput('twoFactor')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={handleVerify2Factor}
              />
              <FieldError message={twoFactorError} />
              <DevOtpNote code={debugOtp} />

              <PrimaryButton
                label="Xác nhận & Đăng nhập"
                loadingLabel="Đang xác nhận kết nối..."
                loading={loading}
                onPress={handleVerify2Factor}
              />

              <TouchableOpacity
                style={styles.resendOtpRow}
                onPress={handleResend2FA}
                disabled={resendingOtp || loading}
              >
                {resendingOtp ? (
                  <ActivityIndicator size="small" color={Colors.brandGreen} />
                ) : (
                  <RefreshCw size={13} color={Colors.brandGreen} />
                )}
                <Text style={styles.resendOtpText}>
                  {resendingOtp ? 'Đang gửi lại…' : 'Chưa nhận được mã? Gửi lại mã'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButtonInline}
                onPress={() => {
                  setShowTwoFactor(false);
                  setTwoFactorCode('');
                  setDebugOtp('');
                }}
              >
                <ArrowLeft size={14} color="#64748B" />
                <Text style={styles.backButtonInlineText}>Quay lại đăng nhập</Text>
              </TouchableOpacity>
            </View>
          ) : activeForm === 'login' ? (
            <View style={styles.authForm}>
              {/* Role Tabs — chỉ hiển thị trên app di động (một ứng dụng duy nhất).
                  Trên Web: cổng / dành riêng Bệnh nhân, không có tab nhân viên. */}
              {!isWeb && (
              <View style={styles.roleTabsContainer}>
                <TouchableOpacity
                  style={[styles.roleTab, loginRole === 'patient' ? styles.roleTabActive : null]}
                  onPress={() => {
                    setLoginRole('patient');
                    setEmailError('');
                    setPasswordError('');
                  }}
                >
                  <Text style={[styles.roleTabText, loginRole === 'patient' ? styles.roleTabTextActive : null]}>
                    Bệnh nhân
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleTab, loginRole === 'staff' ? styles.roleTabActive : null]}
                  onPress={() => {
                    setLoginRole('staff');
                    setEmailError('');
                    setPasswordError('');
                  }}
                >
                  <Text style={[styles.roleTabText, loginRole === 'staff' ? styles.roleTabTextActive : null]}>
                    Bác sĩ / Nhân viên
                  </Text>
                </TouchableOpacity>
              </View>
              )}

              <Text style={styles.formLabel}>
                {loginRole === 'patient' ? 'Địa chỉ Email *' : 'Mã nhân sự hoặc Email nội bộ *'}
              </Text>
              <AuthField
                icon={loginRole === 'patient' ? Mail : UserRound}
                focused={focusedInput === 'email'}
                error={emailError}
                placeholder={loginRole === 'patient' ? 'vidu@neuroscan.com' : 'Nhập mã nhân sự hoặc email'}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
              <FieldError message={emailError} />

              <View style={styles.labelRow}>
                <Text style={[styles.formLabel, styles.formLabelInline]}>Mật khẩu *</Text>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordLink}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
              <AuthField
                icon={Lock}
                focused={focusedInput === 'password'}
                error={passwordError}
                trailing={passwordToggle}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                autoCapitalize="none"
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={handleLogin}
              />
              <FieldError message={passwordError} />

              {/* Bệnh nhân chưa kích hoạt: nhập mã OTP kích hoạt ngay trong thẻ đăng nhập */}
              {showVerification && (
                <View style={styles.activationBox}>
                  <Text style={styles.formLabel}>Mã xác thực OTP kích hoạt *</Text>
                  <AuthField
                    icon={KeyRound}
                    style={styles.fieldShellOnTint}
                    focused={focusedInput === 'verifyCode'}
                    error={verificationError}
                    inputStyle={verificationCode ? styles.otpInputFilled : null}
                    placeholder="Nhập 6 chữ số"
                    value={verificationCode}
                    onChangeText={(text) => {
                      setVerificationCode(text);
                      if (verificationError) setVerificationError('');
                    }}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={6}
                    onFocus={() => setFocusedInput('verifyCode')}
                    onBlur={() => setFocusedInput(null)}
                    onSubmitEditing={handleLogin}
                  />
                  <FieldError message={verificationError} />
                  <DevOtpNote code={debugOtp} />

                  <View style={styles.resendRow}>
                    <Text style={styles.resendText}>Chưa nhận được mã? </Text>
                    <TouchableOpacity onPress={handleResendActivation} disabled={loading}>
                      <Text style={styles.resendLink}>Gửi lại mã</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Remember Me Box */}
              <View style={styles.rememberRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe ? styles.checkboxChecked : null]}>
                    {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.rememberText}>
                    Lưu thông tin đăng nhập (Không khuyến nghị trên thiết bị công cộng)
                  </Text>
                </TouchableOpacity>
              </View>

              <PrimaryButton
                label={showVerification ? 'Xác nhận kích hoạt và đăng nhập' : 'Đăng nhập'}
                loadingLabel="Đang xử lý kết nối..."
                loading={loading}
                onPress={handleLogin}
              />

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>hoặc</Text>
                <View style={styles.orLine} />
              </View>

              {/* Google SSO */}
              <PressableScale style={styles.googleBtn} hoverStyle={styles.googleBtnHover} focusStyle={styles.buttonFocus} onPress={handleGoogleLogin}>
                <Image
                  source={{ uri: 'https://developers.google.com/static/identity/images/g-logo.png' }}
                  style={styles.googleLogo}
                  resizeMode="contain"
                />
                <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
              </PressableScale>

              <View style={styles.formFooter}>
                <Text style={styles.formFooterText}>Chưa có tài khoản? </Text>
                <TouchableOpacity onPress={() => {
                  setActiveForm('register');
                  setEmailError('');
                  setPasswordError('');
                }}>
                  <Text style={styles.formFooterLink}>Đăng ký ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.authForm}>
              <Text style={styles.formLabel}>Họ và tên *</Text>
              <AuthField
                icon={UserRound}
                focused={focusedInput === 'name'}
                error={nameError}
                placeholder="Nguyễn Văn A"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError('');
                }}
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
              />
              <FieldError message={nameError} />

              <Text style={styles.formLabel}>Địa chỉ Email *</Text>
              <AuthField
                icon={Mail}
                focused={focusedInput === 'email'}
                error={emailError}
                placeholder="vidu@neuroscan.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
              <FieldError message={emailError} />

              <Text style={styles.formLabel}>Số điện thoại (tùy chọn)</Text>
              <AuthField
                icon={Phone}
                focused={focusedInput === 'phone'}
                error={phoneError}
                placeholder="09XXXXXXXX"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (phoneError) setPhoneError('');
                }}
                keyboardType="phone-pad"
                onFocus={() => setFocusedInput('phone')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={handleRegister}
              />
              <FieldError message={phoneError} />

              <Text style={styles.formLabel}>Mật khẩu *</Text>
              <AuthField
                icon={Lock}
                focused={focusedInput === 'password'}
                error={passwordError}
                trailing={passwordToggle}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                autoCapitalize="none"
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={handleRegister}
              />
              <FieldError message={passwordError} />

              <PrimaryButton
                label="Đăng ký ngay"
                loadingLabel="Đang đăng ký..."
                loading={loading}
                onPress={handleRegister}
              />

              <View style={styles.formFooter}>
                <Text style={styles.formFooterText}>Đã có tài khoản? </Text>
                <TouchableOpacity onPress={() => {
                  setActiveForm('login');
                  setEmailError('');
                  setPasswordError('');
                }}>
                  <Text style={styles.formFooterLink}>Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.cardTrust}>
          <ShieldCheck size={14} color={Colors.brandGreen} />
          <Text style={styles.cardTrustText}>Bảo vệ bằng xác thực 2 lớp (mã OTP qua email)</Text>
        </View>
      </View>

      {/* Hỗ trợ — nằm dưới thẻ. Lưu ý tách luồng: KHÔNG hiển thị liên kết tới Cổng nội bộ /staff
          trên trang công khai — nhân viên dùng địa chỉ nội bộ riêng. */}
      <View style={styles.supportOutside}>
        <View style={styles.supportChips}>
          {!isDesktop ? (
            <TouchableOpacity style={styles.supportChip} onPress={() => navigation.navigate('Landing')}>
              <House size={13} color={Colors.brandGreen} />
              <Text style={[styles.supportChipText, styles.supportChipStrong]}>Về trang chủ</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.supportChip} onPress={() => Linking.openURL('tel:02363650676')}>
            <Phone size={13} color={Colors.brandGreen} />
            <Text style={styles.supportChipText}>
              Hotline hỗ trợ: <Text style={styles.supportChipStrong}>0236 3650 676</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportChip} onPress={() => Linking.openURL('mailto:support@neuroscan.com')}>
            <Mail size={13} color={Colors.brandGreen} />
            <Text style={styles.supportChipText}>
              <Text style={styles.supportChipStrong}>support@neuroscan.com</Text>
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footerCopyrightInline}>© 2026 NeuroScan AI</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isDesktop ? (
        <View style={styles.desktopContainer}>
          {/* Left Column - Full-bleed Hero Image with overlay */}
          <View style={styles.leftColumn}>
            {/* Ảnh hero chuyển mờ dần lần lượt; lớp phủ navy đã làm sẵn trong từng file ảnh */}
            {HERO_SLIDES.map((source, i) => (
              <Animated.Image
                key={i}
                source={source}
                style={[styles.leftColumnBg, anim.reduceMotion ? null : anim.kenBurnsStyle, { opacity: anim.slides[i] }]}
                resizeMode="cover"
                accessible={false}
              />
            ))}
            {/* Mạng nơ-ron chỉ hợp với slide 1 (banner) — mờ đi cùng slide 1 để không đè lên não/bác sĩ ở slide 2, 3 */}
            <HeroScanOverlay scan={anim.scan} pulse={anim.pulse} reduceMotion={anim.reduceMotion} networkStyle={{ opacity: anim.slides[0] }} />
            <View style={styles.leftColumnContent}>
              {/* Logo in white */}
              <Animated.View style={[styles.brandContainerWhite, anim.enterStyle(anim.brand)]}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.brandNameWhite}>
                    Neuro<Text style={styles.brandNameAccentOnDark}>Scan</Text> AI
                  </Text>
                  <Text style={styles.brandSubWhite}>HỆ THỐNG CHẨN ĐOÁN HÌNH ẢNH THẦN KINH</Text>
                </View>
              </Animated.View>

              {/* Slogan + tính năng gom ở đáy — vùng giữa ảnh là màn hình MRI, không đặt chữ đè lên */}
              <View style={styles.heroBottom}>
                <View style={styles.sloganContainer}>
                  <View style={styles.sloganAccent} />
                  <Animated.Text style={[styles.sloganTitle, anim.enterStyle(anim.title, 24)]} accessibilityRole="header">
                    Kết nối Bệnh viện{'\n'}
                    <Text style={styles.sloganTitleAccent}>và Bệnh nhân</Text>
                  </Animated.Text>
                  <Animated.Text style={[styles.sloganSub, anim.enterStyle(anim.subtitle)]}>
                    Nền tảng AI quản lý hình ảnh MRI/CT trên Cloud.
                  </Animated.Text>
                </View>

                {/* Feature pills — dịch vụ thực tế của hệ thống (thay cho badge số liệu) */}
                <View style={styles.featureList}>
                  <Animated.View style={[styles.featureRow, anim.enterStyle(anim.features[0])]}>
                    <View style={styles.featureIcon}>
                      <Brain size={20} color={Colors.brandMint} strokeWidth={2} />
                    </View>
                    <Text style={styles.featureText}>Chụp cộng hưởng từ MRI não bộ chuẩn hóa</Text>
                  </Animated.View>
                  <Animated.View style={[styles.featureRow, anim.enterStyle(anim.features[1])]}>
                    <View style={styles.featureIcon}>
                      <Sparkles size={20} color={Colors.brandMint} strokeWidth={2} />
                    </View>
                    <Text style={styles.featureText}>Tầm soát & phát hiện tổn thương bởi AI đa mô hình</Text>
                  </Animated.View>
                  <Animated.View style={[styles.featureRow, anim.enterStyle(anim.features[2])]}>
                    <View style={styles.featureIcon}>
                      <Microscope size={20} color={Colors.brandMint} strokeWidth={2} />
                    </View>
                    <Text style={styles.featureText}>Báo cáo chẩn đoán hình ảnh hội chẩn chuyên khoa</Text>
                  </Animated.View>
                  <Animated.View style={[styles.featureRow, anim.enterStyle(anim.features[3])]}>
                    <View style={styles.featureIcon}>
                      <Stethoscope size={20} color={Colors.brandMint} strokeWidth={2} />
                    </View>
                    <Text style={styles.featureText}>Theo dõi hồ sơ bệnh án điện tử xuyên suốt</Text>
                  </Animated.View>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column - nền chấm mờ + quầng màu thương hiệu, thẻ đăng nhập ở giữa (cuộn được khi màn hình thấp) */}
          <View style={styles.rightColumn}>
            {/* Nút 'Về trang chủ' — góc trên phải (giống Cổng nội bộ) */}
            <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Landing')} dataSet={{ hover: 'glow' }}>
              <ArrowLeft size={15} color={Colors.brandNavy} />
              <House size={15} color={Colors.brandGreen} />
              <Text style={styles.homeButtonText}>Về trang chủ</Text>
            </TouchableOpacity>
            <View style={styles.rightDots} pointerEvents="none" />
            <FloatingOrb size={440} color="rgba(111, 221, 178, 0.26)" style={{ top: -180, right: -160 }} />
            <FloatingOrb size={400} color="rgba(11, 42, 85, 0.10)" style={{ bottom: -180, left: -150 }} slow />
            <ScrollView
              style={styles.rightScroll}
              contentContainerStyle={styles.rightScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {authCard}
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.mobileScrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mobile hero: ảnh máy MRI (đáy ảnh đã phủ navy sẵn) + logo + slogan */}
          <View style={styles.mobileHero}>
            <Animated.Image
              source={require('../../assets/images/welcome-mobile-hero.jpg')}
              style={[styles.leftColumnBg, anim.reduceMotion ? null : anim.kenBurnsStyle]}
              resizeMode="cover"
              accessible={false}
            />
            <Animated.View style={[styles.mobileHeroContent, anim.enterStyle(anim.brand)]}>
              <View style={styles.brandContainerWhite}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.brandNameWhite}>
                  Neuro<Text style={styles.brandNameAccentOnDark}>Scan</Text> AI
                </Text>
              </View>
              <Animated.Text style={[styles.mobileHeroTitle, anim.enterStyle(anim.title, 16)]} accessibilityRole="header">
                Kết nối Bệnh viện{'\n'}
                <Text style={styles.sloganTitleAccent}>và Bệnh nhân</Text>
              </Animated.Text>
            </Animated.View>
          </View>

          {/* Form Card */}
          <View style={styles.mobileFormContainer}>
            {authCard}
          </View>
        </ScrollView>
      )}

      {/* Forgot Password Modal — luồng quên mật khẩu đầy đủ (email → OTP → mật khẩu mới) */}
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={email}
        theme="light"
        onSuccess={(resetEmail) => {
          setShowForgotPassword(false);
          setActiveForm('login');
          setEmail(resetEmail);
          showAlert(
            'success',
            'Đặt lại mật khẩu thành công',
            'Mật khẩu mới đã được cập nhật. Vui lòng đăng nhập bằng mật khẩu mới của bạn.'
          );
        }}
      />

      {/* Custom Alert Modal */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={[
              styles.alertIconCircle,
              customAlert.type === 'success' && { backgroundColor: '#ECFDF5' },
              customAlert.type === 'error' && { backgroundColor: '#FEF2F2' },
              customAlert.type === 'info' && { backgroundColor: '#F0F9FF' },
            ]}>
              {customAlert.type === 'success' && <CheckCircle2 size={28} color="#059669" strokeWidth={2.5} />}
              {customAlert.type === 'error' && <AlertCircle size={28} color="#DC2626" strokeWidth={2.5} />}
              {customAlert.type === 'info' && <Info size={28} color="#0090D0" strokeWidth={2.5} />}
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <TouchableOpacity
              style={[
                styles.alertButton,
                customAlert.type === 'success' && { backgroundColor: '#059669' },
                customAlert.type === 'error' && { backgroundColor: '#DC2626' },
                customAlert.type === 'info' && { backgroundColor: '#0090D0' },
              ]}
              onPress={closeCustomAlert}
            >
              <Text style={styles.alertButtonText}>Tiếp tục</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
