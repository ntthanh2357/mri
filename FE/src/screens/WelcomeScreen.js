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
  Modal,
} from 'react-native';
import Config from '../constants/config';
import { get, post, setAuthToken } from '../services/api.service';
import { signInWithGoogleWeb } from '../firebase';
import styles from './WelcomeScreen.styles';

// Dữ liệu dịch vụ (static, dùng chung white-label)
const servicesData = [
  { id: 1, title: 'Chụp cộng hưởng từ MRI Não', icon: '🧠' },
  { id: 2, title: 'Phân tích & Tầm soát U não AI', icon: '🤖' },
  { id: 3, title: 'Chẩn đoán hình ảnh Ung thư Não', icon: '🔬' },
];

const WelcomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const scrollViewRef = useRef(null);

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

  // 2FA states
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [tempLoginResponse, setTempLoginResponse] = useState(null);

  // Patient activation states
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [correct2FaCode, setCorrect2FaCode] = useState('');

  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    type: 'success', // 'success' | 'error' | 'info'
    title: '',
    message: '',
    onClose: null,
  });

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
    showAlert(
      'info',
      'Quên mật khẩu',
      'Vui lòng liên hệ với Quản trị viên của Bệnh viện hoặc gọi Hotline hỗ trợ kỹ thuật để được xác thực danh tính và cấp lại mật khẩu mới.'
    );
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await get('/auth/me');
        if (data && data.user) {
          const destination = data.user.role === 'admin'
            ? 'AdminBackoffice'
            : (data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
          navigation.reset({
            index: 0,
            routes: [{ name: destination, params: { user: data.user } }],
          });
          return;
        }
      } catch (err) {
        console.log('Welcome auto-login check failed or no token:', err.message);
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
        otp: showVerification ? verificationCode : undefined
      });

      // Bệnh nhân chưa kích hoạt/xác thực email
      if (data.requiresVerification) {
        setVerificationEmail(email.trim());
        setShowVerification(true);
        showAlert(
          'info',
          'Tài khoản chưa kích hoạt',
          'Tài khoản bệnh nhân của bạn chưa được kích hoạt qua mã OTP. Một mã OTP mới đã được gửi tới email của bạn. Vui lòng nhập mã để kích hoạt và đăng nhập.' +
          (data.debugOtp ? ` (Mã debug: ${data.debugOtp})` : '')
        );
        return;
      }

      // Nhân viên chưa kích hoạt → bắt buộc đặt mật khẩu mới
      if (data.requiresActivation) {
        await setAuthToken(data.accessToken);
        navigation.replace('ActivateAccount', { user: data.user, accessToken: data.accessToken });
        return;
      }

      // If logging in as staff/doctor, trigger 2FA OTP simulation
      if (loginRole === 'staff' || (data.user && data.user.role !== 'patient')) {
        setTempLoginResponse(data);
        if (data.otp2FA) {
          setCorrect2FaCode(data.otp2FA);
        }
        setShowTwoFactor(true);
        showAlert(
          'info',
          'Xác thực 2 lớp',
          'Mã xác thực 2 lớp đã được gửi tới email của bạn. Vui lòng kiểm tra và nhập mã để tiếp tục.' +
          (data.otp2FA ? ` (Mã debug: ${data.otp2FA})` : '')
        );
      } else {
        await setAuthToken(data.accessToken);
        const destination = data.user && data.user.role === 'admin'
          ? 'AdminBackoffice'
          : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
        showAlert('success', 'Đăng nhập thành công', 'Chào mừng bạn quay trở lại với NeuroScan AI!', () => {
          setShowVerification(false);
          setVerificationCode('');
          navigation.reset({
            index: 0,
            routes: [{ name: destination, params: { user: data.user } }],
          });
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      const errMsg = error.message || 'Không thể kết nối đến máy chủ.';
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
        showAlert(
          'success',
          'Đăng ký thành công! 🎉',
          'Tài khoản bệnh nhân đã được tạo. Vui lòng nhập mã OTP 6 chữ số vừa gửi đến email của bạn vào ô OTP xuất hiện ở form đăng nhập bên dưới để kích hoạt.' +
          (data.debugOtp ? ` (Mã debug: ${data.debugOtp})` : '')
        );
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
      showAlert('success', 'Kích hoạt thành công! 🎉', 'Tài khoản bệnh nhân đã được kích hoạt thành công. Bây giờ bạn có thể đăng nhập.', () => {
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
      showAlert(
        'success',
        'Gửi lại thành công',
        'Mã xác thực mới đã được gửi tới email của bạn.' +
        (data.debugOtp ? ` (Mã debug: ${data.debugOtp})` : '')
      );
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

    if (correct2FaCode && twoFactorCode !== correct2FaCode) {
      setTwoFactorError('Mã xác thực 2 lớp không chính xác.');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const data = tempLoginResponse;
      await setAuthToken(data.accessToken);
      const destination = data.user && data.user.role === 'admin'
        ? 'AdminBackoffice'
        : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');

      showAlert('success', 'Đăng nhập thành công', 'Xác thực 2 lớp thành công!', () => {
        setShowTwoFactor(false);
        setTwoFactorCode('');
        setCorrect2FaCode('');
        navigation.reset({
          index: 0,
          routes: [{ name: destination, params: { user: data.user } }],
        });
      });
    } catch (error) {
      setTwoFactorError('Xác thực 2 lớp thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
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
      await setAuthToken(data.accessToken);
      const destination = data.user && data.user.role === 'admin' ? 'AdminBackoffice' : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
      showAlert('success', 'Đăng nhập thành công', 'Đăng nhập bằng tài khoản Google thành công.', () => {
        navigation.reset({
          index: 0,
          routes: [{ name: destination, params: { user: data.user } }],
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

  return (
    <SafeAreaView style={styles.container}>
      {isDesktop ? (
        <View style={styles.desktopContainer}>
          {/* Left Column - Full-bleed Hero Image with overlay */}
          <View style={styles.leftColumn}>
            <Image
              source={require('../../assets/nero.png')}
              style={styles.leftColumnBg}
              resizeMode="cover"
            />
            <View style={styles.leftColumnOverlay} />
            <View style={styles.leftColumnContent}>
              {/* Logo in white */}
              <View style={styles.brandContainerWhite}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.brandNameWhite}>NeuroScan AI</Text>
                  <Text style={styles.brandSubWhite}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
                </View>
              </View>

              {/* Slogan */}
              <View style={styles.sloganContainer}>
                <Text style={styles.sloganTitle}>
                  Hệ thống Y tế số thông minh ứng dụng Trí tuệ nhân tạo
                </Text>
                <Text style={styles.sloganSub}>
                  Giải pháp tiên phong phân tích hình ảnh MRI sọ não, u não và hỗ trợ quyết định lâm sàng chuyên sâu với độ chính xác tuyệt đối.
                </Text>
              </View>

              {/* Stats badges */}
              <View style={styles.leftStatsContainer}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>99.8%</Text>
                  <Text style={styles.statLbl}>Độ chính xác chẩn đoán</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>&lt; 2 Giây</Text>
                  <Text style={styles.statLbl}>Thời gian phân tích</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column - Centered Form Card */}
          <View style={styles.rightColumn}>
            <View style={styles.authCardContainer}>
              {showTwoFactor ? (
                <View style={styles.authForm}>
                  <Text style={styles.authCardTitle}>Xác thực 2 lớp</Text>
                  <Text style={styles.authCardSub}>
                    Mã xác thực đã được gửi tới địa chỉ email đăng ký của bạn. Vui lòng nhập để tiếp tục.
                  </Text>

                  <Text style={styles.formLabel}>Mã xác thực OTP (6 chữ số) *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'twoFactor' ? styles.formInputFocused : null,
                      twoFactorError ? styles.formInputError : null
                    ]}
                    placeholder="Nhập 6 chữ số"
                    placeholderTextColor="#94A3B8"
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
                  {twoFactorError ? <Text style={styles.inlineErrorText}>{twoFactorError}</Text> : null}

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleVerify2Factor}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang xác nhận kết nối...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>Xác nhận kết nối</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backButtonInline}
                    onPress={() => {
                      setShowTwoFactor(false);
                      setTwoFactorCode('');
                    }}
                  >
                    <Text style={styles.backButtonInlineText}>← Quay lại đăng nhập</Text>
                  </TouchableOpacity>
                </View>
              ) : activeForm === 'login' ? (
                <View style={styles.authForm}>
                  <Text style={styles.authCardTitle}>Chào mừng quay trở lại</Text>
                  <Text style={styles.authCardSub}>Đăng nhập để truy cập hệ thống NeuroScan AI</Text>

                  {/* Role Tabs */}
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

                  <Text style={styles.formLabel}>
                    {loginRole === 'patient' ? 'Địa chỉ Email *' : 'Mã nhân sự hoặc Email nội bộ *'}
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'email' ? styles.formInputFocused : null,
                      emailError ? styles.formInputError : null
                    ]}
                    placeholder={loginRole === 'patient' ? 'vidu@neuroscan.com' : 'Nhập mã nhân sự hoặc email'}
                    placeholderTextColor="#94A3B8"
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
                  {emailError ? <Text style={styles.inlineErrorText}>{emailError}</Text> : null}

                  <View style={styles.labelRow}>
                    <Text style={styles.formLabel}>Mật khẩu *</Text>
                    <TouchableOpacity onPress={handleForgotPassword}>
                      <Text style={styles.forgotPasswordLink}>Quên mật khẩu?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { paddingRight: 45 },
                        focusedInput === 'password' ? styles.formInputFocused : null,
                        passwordError ? styles.formInputError : null
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
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
                    <TouchableOpacity
                      style={styles.passwordVisibilityBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.passwordVisibilityText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.inlineErrorText}>{passwordError}</Text> : null}

                  {/* Patient Activation OTP field inside Login card (Desktop) */}
                  {showVerification && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.formLabel}>Mã xác thực OTP kích hoạt *</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          focusedInput === 'verifyCode' ? styles.formInputFocused : null,
                          verificationError ? styles.formInputError : null
                        ]}
                        placeholder="Nhập 6 chữ số"
                        placeholderTextColor="#94A3B8"
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
                      {verificationError ? <Text style={styles.inlineErrorText}>{verificationError}</Text> : null}

                      <View style={[styles.resendRow, { justifyContent: 'flex-start', marginTop: -8, marginBottom: 0 }]}>
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
                        {rememberMe && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.rememberText}>
                        Lưu thông tin đăng nhập (Không khuyến nghị trên thiết bị công cộng)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang xử lý kết nối...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>
                        {showVerification ? 'Xác nhận kích hoạt & Đăng nhập ➔' : 'Đăng nhập ➔'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Google SSO */}
                  <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
                    <Image
                      source={{ uri: 'https://developers.google.com/static/identity/images/g-logo.png' }}
                      style={{ width: 18, height: 18, marginRight: 8 }}
                      resizeMode="contain"
                    />
                    <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
                  </TouchableOpacity>

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
                  <Text style={styles.authCardTitle}>Đăng ký tài khoản</Text>
                  <Text style={styles.authCardSub}>Tạo tài khoản mới để lưu lịch sử chẩn đoán MRI</Text>

                  <Text style={styles.formLabel}>Họ và tên *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'name' ? styles.formInputFocused : null,
                      nameError ? styles.formInputError : null
                    ]}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (nameError) setNameError('');
                    }}
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  {nameError ? <Text style={styles.inlineErrorText}>{nameError}</Text> : null}

                  <Text style={styles.formLabel}>Địa chỉ Email *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'email' ? styles.formInputFocused : null,
                      emailError ? styles.formInputError : null
                    ]}
                    placeholder="vidu@neuroscan.com"
                    placeholderTextColor="#94A3B8"
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
                  {emailError ? <Text style={styles.inlineErrorText}>{emailError}</Text> : null}

                  <Text style={styles.formLabel}>Số điện thoại (tùy chọn)</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'phone' ? styles.formInputFocused : null,
                      phoneError ? styles.formInputError : null
                    ]}
                    placeholder="09XXXXXXXX"
                    placeholderTextColor="#94A3B8"
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
                  {phoneError ? <Text style={styles.inlineErrorText}>{phoneError}</Text> : null}

                  <Text style={styles.formLabel}>Mật khẩu *</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { paddingRight: 45 },
                        focusedInput === 'password' ? styles.formInputFocused : null,
                        passwordError ? styles.formInputError : null
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
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
                    <TouchableOpacity
                      style={styles.passwordVisibilityBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.passwordVisibilityText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.inlineErrorText}>{passwordError}</Text> : null}

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang đăng ký...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>Đăng ký ngay</Text>
                    )}
                  </TouchableOpacity>

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

              {/* Support Info below Form Card on Desktop */}
              <View style={styles.formSeparator} />
              <View style={styles.supportContainerInline}>
                <Text style={styles.supportTextInline}>
                  Hotline hỗ trợ: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>0236 3650 676</Text> | Email: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>support@neuroscan.com</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.mobileScrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mobile Header Logo */}
          <View style={styles.mobileHeader}>
            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandName}>NeuroScan AI</Text>
                <Text style={styles.brandSub}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.mobileFormContainer}>
            <View style={styles.authCardContainer}>
              {showTwoFactor ? (
                <View style={styles.authForm}>
                  <Text style={styles.authCardTitle}>Xác thực 2 lớp</Text>
                  <Text style={styles.authCardSub}>
                    Mã xác thực đã được gửi tới địa chỉ email đăng ký của bạn. Vui lòng nhập để tiếp tục.
                  </Text>

                  <Text style={styles.formLabel}>Mã xác thực OTP (6 chữ số) *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'twoFactor' ? styles.formInputFocused : null,
                      twoFactorError ? styles.formInputError : null
                    ]}
                    placeholder="Nhập 6 chữ số"
                    placeholderTextColor="#94A3B8"
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
                  {twoFactorError ? <Text style={styles.inlineErrorText}>{twoFactorError}</Text> : null}

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleVerify2Factor}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang xác nhận kết nối...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>Xác nhận kết nối</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backButtonInline}
                    onPress={() => {
                      setShowTwoFactor(false);
                      setTwoFactorCode('');
                    }}
                  >
                    <Text style={styles.backButtonInlineText}>← Quay lại đăng nhập</Text>
                  </TouchableOpacity>
                </View>
              ) : activeForm === 'login' ? (
                <View style={styles.authForm}>
                  <Text style={styles.authCardTitle}>Đăng nhập</Text>
                  <Text style={styles.authCardSub}>Truy cập hệ thống NeuroScan AI</Text>

                  {/* Role Tabs */}
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

                  <Text style={styles.formLabel}>
                    {loginRole === 'patient' ? 'Địa chỉ Email *' : 'Mã nhân sự hoặc Email nội bộ *'}
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'email' ? styles.formInputFocused : null,
                      emailError ? styles.formInputError : null
                    ]}
                    placeholder={loginRole === 'patient' ? 'vidu@neuroscan.com' : 'Nhập mã nhân sự hoặc email'}
                    placeholderTextColor="#94A3B8"
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
                  {emailError ? <Text style={styles.inlineErrorText}>{emailError}</Text> : null}

                  <View style={styles.labelRow}>
                    <Text style={styles.formLabel}>Mật khẩu *</Text>
                    <TouchableOpacity onPress={handleForgotPassword}>
                      <Text style={styles.forgotPasswordLink}>Quên mật khẩu?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { paddingRight: 45 },
                        focusedInput === 'password' ? styles.formInputFocused : null,
                        passwordError ? styles.formInputError : null
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
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
                    <TouchableOpacity
                      style={styles.passwordVisibilityBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.passwordVisibilityText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.inlineErrorText}>{passwordError}</Text> : null}

                  {/* Patient Activation OTP field inside Login card (Mobile) */}
                  {showVerification && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={styles.formLabel}>Mã xác thực OTP kích hoạt *</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          focusedInput === 'verifyCode' ? styles.formInputFocused : null,
                          verificationError ? styles.formInputError : null
                        ]}
                        placeholder="Nhập 6 chữ số"
                        placeholderTextColor="#94A3B8"
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
                      {verificationError ? <Text style={styles.inlineErrorText}>{verificationError}</Text> : null}

                      <View style={[styles.resendRow, { justifyContent: 'flex-start', marginTop: -8, marginBottom: 0 }]}>
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
                        {rememberMe && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.rememberText}>
                        Lưu thông tin đăng nhập (Không khuyến nghị trên thiết bị công cộng)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang xử lý kết nối...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>
                        {showVerification ? 'Xác nhận kích hoạt & Đăng nhập ➔' : 'Đăng nhập ➔'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Google SSO */}
                  <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
                    <Image
                      source={{ uri: 'https://developers.google.com/static/identity/images/g-logo.png' }}
                      style={{ width: 18, height: 18, marginRight: 8 }}
                      resizeMode="contain"
                    />
                    <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
                  </TouchableOpacity>

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
                  <Text style={styles.authCardTitle}>Đăng ký tài khoản</Text>
                  <Text style={styles.authCardSub}>Tạo tài khoản mới để lưu lịch sử chẩn đoán MRI</Text>

                  <Text style={styles.formLabel}>Họ và tên *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'name' ? styles.formInputFocused : null,
                      nameError ? styles.formInputError : null
                    ]}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (nameError) setNameError('');
                    }}
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  {nameError ? <Text style={styles.inlineErrorText}>{nameError}</Text> : null}

                  <Text style={styles.formLabel}>Địa chỉ Email *</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'email' ? styles.formInputFocused : null,
                      emailError ? styles.formInputError : null
                    ]}
                    placeholder="vidu@neuroscan.com"
                    placeholderTextColor="#94A3B8"
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
                  {emailError ? <Text style={styles.inlineErrorText}>{emailError}</Text> : null}

                  <Text style={styles.formLabel}>Số điện thoại (tùy chọn)</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      focusedInput === 'phone' ? styles.formInputFocused : null,
                      phoneError ? styles.formInputError : null
                    ]}
                    placeholder="09XXXXXXXX"
                    placeholderTextColor="#94A3B8"
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
                  {phoneError ? <Text style={styles.inlineErrorText}>{phoneError}</Text> : null}

                  <Text style={styles.formLabel}>Mật khẩu *</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { paddingRight: 45 },
                        focusedInput === 'password' ? styles.formInputFocused : null,
                        passwordError ? styles.formInputError : null
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
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
                    <TouchableOpacity
                      style={styles.passwordVisibilityBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.passwordVisibilityText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.inlineErrorText}>{passwordError}</Text> : null}

                  <TouchableOpacity
                    style={styles.formButton}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.formButtonText}>Đang đăng ký...</Text>
                      </View>
                    ) : (
                      <Text style={styles.formButtonText}>Đăng ký ngay</Text>
                    )}
                  </TouchableOpacity>

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

              {/* Support Info below Form Card on Mobile */}
              <View style={styles.formSeparator} />
              <View style={styles.supportContainerInline}>
                <Text style={styles.supportTextInline}>
                  Hotline hỗ trợ: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>0236 3650 676</Text> | Email: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>support@neuroscan.com</Text>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Custom Alert Modal */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={[
              styles.alertIconCircle,
              customAlert.type === 'success' && { backgroundColor: '#F0FDF4' },
              customAlert.type === 'error' && { backgroundColor: '#FEF2F2' },
              customAlert.type === 'info' && { backgroundColor: '#EFF6FF' },
            ]}>
              {customAlert.type === 'success' && <Text style={[styles.alertIconText, { color: '#16A34A' }]}>✓</Text>}
              {customAlert.type === 'error' && <Text style={[styles.alertIconText, { color: '#DC2626' }]}>✕</Text>}
              {customAlert.type === 'info' && <Text style={[styles.alertIconText, { color: '#2563EB' }]}>ℹ</Text>}
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <TouchableOpacity
              style={[
                styles.alertButton,
                customAlert.type === 'success' && { backgroundColor: '#15803D' },
                customAlert.type === 'error' && { backgroundColor: '#DC2626' },
                customAlert.type === 'info' && { backgroundColor: '#2563EB' },
              ]}
              onPress={() => {
                setCustomAlert(prev => ({ ...prev, visible: false }));
                if (customAlert.onClose) {
                  customAlert.onClose();
                }
              }}
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
