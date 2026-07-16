import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import Config from '../constants/config';
import { post, setAuthToken, get } from '../services/api.service';
import { signInWithGoogleWeb } from '../firebase';
import styles from './LoginScreen.styles';

const LoginScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Phone Login OTP states
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Role, Focus, Inline error, and 2FA states
  const [loginRole, setLoginRole] = useState('patient'); // 'patient' or 'staff'
  const [focusedInput, setFocusedInput] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempLoginResponse, setTempLoginResponse] = useState(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 or 2
  const [forgotLoading, setForgotLoading] = useState(false);

  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    type: 'success', // 'success' | 'error' | 'info'
    title: '',
    message: '',
    onClose: null,
  });

  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await get('/auth/me');
        if (data && data.user) {
          const destination = data.user.role === 'admin' ? 'AdminBackoffice' : (data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
          navigation.reset({
            index: 0,
            routes: [{ name: destination, params: { user: data.user } }],
          });
          return;
        }
      } catch (err) {
        console.log('Login auto-login check failed or no token:', err.message);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color="#15803D" />
      </SafeAreaView>
    );
  }

  const showAlert = (type, title, message, onClose = null) => {
    setCustomAlert({
      visible: true,
      type,
      title,
      message,
      onClose,
    });
  };

  const handleSendOtp = async () => {
    if (!email) {
      showAlert('info', 'Thông báo', 'Vui lòng nhập số điện thoại để nhận mã OTP.');
      return;
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(email.trim())) {
      showAlert('error', 'Lỗi', 'Số điện thoại đăng nhập bằng OTP phải chứa đúng 10 chữ số.');
      return;
    }

    setLoading(true);
    try {
      const data = await post('/auth/phone-login-request', { phone: email.trim() });
      setOtpSent(true);
      showAlert('success', 'Gửi mã thành công', data.message || 'Mã OTP đăng nhập đã được gửi.');
    } catch (error) {
      console.error('Send login OTP error:', error);
      showAlert('error', 'Lỗi gửi mã OTP', error.message || 'Số điện thoại này chưa được đăng ký hoặc không thể gửi OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    if (!email || !otpCode) {
      showAlert('info', 'Thông báo', 'Vui lòng nhập đầy đủ số điện thoại và mã OTP.');
      return;
    }
    setLoading(true);
    try {
      const data = await post('/auth/phone-login-verify', { phone: email.trim(), otp: otpCode.trim() });
      setAuthToken(data.accessToken);
      showAlert('success', 'Đăng nhập thành công', 'Chào mừng bạn quay trở lại với NeuroScan AI!', () => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { user: data.user } }],
        });
      });
    } catch (error) {
      console.error('Verify login OTP error:', error);
      showAlert('error', 'Đăng nhập thất bại', error.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');

    if (loginMethod === 'otp') {
      if (!email) {
        setEmailError('Vui lòng nhập số điện thoại để nhận mã OTP.');
        return;
      }
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(email.trim())) {
        setEmailError('Số điện thoại đăng nhập bằng OTP phải chứa đúng 10 chữ số.');
        return;
      }

      if (!otpSent) {
        await handleSendOtp();
      } else {
        if (!otpCode) {
          setPasswordError('Vui lòng nhập mã OTP.');
          return;
        }
        await handleVerifyLoginOtp();
      }
      return;
    }

    if (!email) {
      if (loginRole === 'patient') {
        setEmailError('Vui lòng nhập Số điện thoại, Email hoặc CCCD.');
      } else {
        setEmailError('Vui lòng nhập Mã nhân sự hoặc Email nội bộ.');
      }
      return;
    }
    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const data = await post('/auth/login', { email, password });

      // Nhân viên chưa kích hoạt → bắt buộc đặt mật khẩu mới
      if (data.requiresActivation) {
        await setAuthToken(data.accessToken);
        navigation.replace('ActivateAccount', { user: data.user, accessToken: data.accessToken });
        return;
      }

      // If logging in as staff/doctor, trigger 2FA OTP simulation
      if (loginRole === 'staff' || (data.user && data.user.role !== 'patient')) {
        setTempLoginResponse(data);
        setShowTwoFactor(true);
      } else {
        await setAuthToken(data.accessToken);
        const destination = data.user && data.user.role === 'admin'
          ? 'AdminBackoffice'
          : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');
        showAlert('success', 'Đăng nhập thành công', 'Chào mừng bạn quay trở lại với NeuroScan AI!', () => {
          navigation.reset({
            index: 0,
            routes: [{ name: destination, params: { user: data.user } }],
          });
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      const errMsg = error.message || 'Không thể kết nối đến máy chủ.';
      if (errMsg.toLowerCase().includes('không chính xác') || errMsg.toLowerCase().includes('không tồn tại')) {
        setPasswordError('Thông tin đăng nhập chưa chính xác, bạn vui lòng kiểm tra lại nhé.');
      } else {
        setPasswordError(errMsg);
      }
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
      // Simulate network request duration
      await new Promise(resolve => setTimeout(resolve, 800));

      const data = tempLoginResponse;
      await setAuthToken(data.accessToken);
      const destination = data.user && data.user.role === 'admin'
        ? 'AdminBackoffice'
        : (data.user && data.user.role === 'hospital_admin' ? 'ClinicDashboard' : 'Home');

      showAlert('success', 'Đăng nhập thành công', 'Xác thực 2 lớp thành công!', () => {
        setShowTwoFactor(false);
        setTwoFactorCode('');
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

  const handleRequestOtp = async () => {
    if (!forgotEmail) {
      showAlert('info', 'Thông báo', 'Vui lòng nhập email.');
      return;
    }
    setForgotLoading(true);
    try {
      const data = await post('/auth/forgot-password', { email: forgotEmail });
      const msg = data.message || 'Mã OTP đã được gửi!';
      showAlert('success', 'Gửi mã thành công', msg, () => {
        setForgotStep(2);
      });
    } catch (error) {
      console.error('Request OTP error:', error);
      const errMsg = error.message || 'Yêu cầu gửi OTP thất bại.';
      showAlert('error', 'Lỗi gửi OTP', errMsg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp || !forgotNewPassword) {
      showAlert('info', 'Thông báo', 'Vui lòng nhập mã OTP và mật khẩu mới.');
      return;
    }
    setForgotLoading(true);
    try {
      const data = await post('/auth/verify-otp', {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      });
      showAlert('success', 'Thành công', 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.', () => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotEmail('');
        setForgotOtp('');
        setForgotNewPassword('');
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errMsg = error.message || 'Xác thực OTP thất bại.';
      showAlert('error', 'Lỗi xác thực', errMsg);
    } finally {
      setForgotLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP HEADER (Navigation Bar) */}
      <View style={styles.navbar}>
        <View style={styles.navbarContainer}>
          {/* Logo & Brand */}
          <TouchableOpacity style={styles.brandContainer} onPress={() => navigation.navigate('Welcome')}>
            <Image
              source={require('../../assets/logo.jpg')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandName}>NeuroScan AI</Text>
              <Text style={styles.brandSub}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
            </View>
          </TouchableOpacity>

          {/* Back to Home Button on the Right */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.homeLinkBtn}
              onPress={() => navigation.navigate('Welcome')}
            >
              <Text style={styles.homeLinkBtnText}>← Quay lại Trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Body */}
      {isDesktop ? (
        <View style={styles.desktopMainBody}>
          <View style={styles.desktopCard}>
            {/* Left Panel */}
            <View style={styles.leftPanel}>
              <Image
                source={require('../../assets/nero.png')}
                style={styles.leftPanelBg}
                resizeMode="cover"
              />
              <View style={styles.leftPanelOverlay} />
              <View style={styles.leftPanelContent}>
                <View style={styles.statsBadgeContainer}>
                  <View style={styles.statMiniCard}>
                    <Text style={styles.statMiniLabel}>ĐỘ CHÍNH XÁC</Text>
                    <Text style={styles.statMiniValue}>99.8%</Text>
                  </View>
                  <View style={styles.statMiniCard}>
                    <Text style={styles.statMiniLabel}>THỜI GIAN XỬ LÝ</Text>
                    <Text style={styles.statMiniValue}>&lt; 2 Giây</Text>
                  </View>
                </View>
                <Text style={styles.leftPanelTextTitle}>
                  Chẩn đoán thông minh hơn với{' '}
                  <Text style={styles.leftPanelTextHighlight}>NeuroScan AI</Text>
                </Text>
                <Text style={styles.leftPanelTextDesc}>
                  Giải pháp AI hàng đầu cho phân tích hình ảnh hệ thần kinh và hỗ trợ bác sĩ lâm sàng với độ chính xác tuyệt đối.
                </Text>
              </View>
            </View>

            {/* Right Panel (Form) */}
            <View style={styles.rightPanel}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.desktopScrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {showTwoFactor ? (
                  <View style={styles.desktopForm}>
                    <View style={styles.desktopTitleContainer}>
                      <Text style={styles.desktopTitle}>Xác thực 2 lớp (2FA)</Text>
                      <Text style={styles.desktopSubtitle}>Vui lòng nhập mã OTP từ Google Authenticator hoặc SMS để tiếp tục</Text>
                    </View>

                    <Text style={styles.desktopLabel}>Mã xác thực OTP (6 chữ số)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.desktopInput,
                        { letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 'bold' },
                        focusedInput === 'twoFactor' ? styles.inputFocused : null,
                        twoFactorError ? styles.inputError : null
                      ]}
                      placeholder="------"
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
                    {twoFactorError ? <Text style={styles.inlineError}>{twoFactorError}</Text> : null}

                    <TouchableOpacity
                      style={[styles.loginButton, styles.desktopLoginButton]}
                      onPress={handleVerify2Factor}
                      disabled={loading}
                    >
                      {loading ? (
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <ActivityIndicator color="#FFF" size="small" />
                          <Text style={styles.loginButtonText}>Đang thiết lập kết nối an toàn...</Text>
                        </View>
                      ) : (
                        <Text style={styles.loginButtonText}>Xác nhận & Đăng nhập →</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.homeLinkBtn, { marginTop: 12, height: 42, justifyContent: 'center', alignItems: 'center' }]}
                      onPress={() => {
                        setShowTwoFactor(false);
                        setTwoFactorCode('');
                        setTwoFactorError('');
                      }}
                    >
                      <Text style={styles.homeLinkBtnText}>← Quay lại form đăng nhập</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.desktopTitleContainer}>
                      <Text style={styles.desktopTitle}>Chào mừng trở lại</Text>
                      <Text style={styles.desktopSubtitle}>Vui lòng nhập thông tin để truy cập hệ thống</Text>
                    </View>

                    {/* Role Selection Tabs */}
                    <View style={styles.roleTabsContainer}>
                      <TouchableOpacity
                        style={[styles.roleTab, loginRole === 'patient' && styles.activeRoleTab]}
                        onPress={() => {
                          setLoginRole('patient');
                          setEmailError('');
                          setPasswordError('');
                        }}
                      >
                        <Text style={[styles.roleTabText, loginRole === 'patient' && styles.activeRoleTabText]}>
                          Dành cho Bệnh nhân
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.roleTab, loginRole === 'staff' && styles.activeRoleTab]}
                        onPress={() => {
                          setLoginRole('staff');
                          setLoginMethod('password');
                          setEmailError('');
                          setPasswordError('');
                          setOtpSent(false);
                        }}
                      >
                        <Text style={[styles.roleTabText, loginRole === 'staff' && styles.activeRoleTabText]}>
                          Bác sĩ / Nhân viên
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Method Tabs - Only show for patient */}
                    {loginRole === 'patient' && (
                      <View style={styles.methodTabsContainer}>
                        <TouchableOpacity
                          style={[styles.methodTab, loginMethod === 'password' && styles.activeMethodTab]}
                          onPress={() => {
                            setLoginMethod('password');
                            setEmailError('');
                            setPasswordError('');
                            setOtpSent(false);
                          }}
                        >
                          <Text style={[styles.methodTabText, loginMethod === 'password' && styles.activeMethodTabText]}>
                            Mật khẩu
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.methodTab, loginMethod === 'otp' && styles.activeMethodTab]}
                          onPress={() => {
                            setLoginMethod('otp');
                            setEmailError('');
                            setPasswordError('');
                            setOtpSent(false);
                          }}
                        >
                          <Text style={[styles.methodTabText, loginMethod === 'otp' && styles.activeMethodTabText]}>
                            Mã OTP
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Inputs */}
                    <View style={styles.desktopForm}>
                      <Text style={styles.desktopLabel}>
                        {loginRole === 'staff'
                          ? 'Mã nhân sự hoặc Email nội bộ'
                          : loginMethod === 'otp'
                            ? 'Số điện thoại'
                            : 'Số điện thoại, Email hoặc CCCD'}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.desktopInput,
                          focusedInput === 'email' ? styles.inputFocused : null,
                          emailError ? styles.inputError : null
                        ]}
                        placeholder={
                          loginRole === 'staff'
                            ? 'Nhập mã nhân sự hoặc email'
                            : loginMethod === 'otp'
                              ? 'Nhập 10 số điện thoại'
                              : 'Nhập SĐT, email hoặc số CCCD'
                        }
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (emailError) setEmailError('');
                        }}
                        autoCapitalize="none"
                        keyboardType={loginRole === 'patient' && loginMethod === 'otp' ? 'phone-pad' : 'email-address'}
                        editable={loginMethod === 'otp' ? !otpSent : true}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                        onSubmitEditing={handleLogin}
                      />
                      {emailError ? <Text style={styles.inlineError}>{emailError}</Text> : null}

                      {loginMethod === 'password' ? (
                        <>
                          <View style={styles.passwordHeader}>
                            <Text style={styles.desktopLabel}>Mật khẩu</Text>
                            <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={[styles.passwordContainer, styles.desktopPasswordContainer]}>
                            <TextInput
                              style={[
                                styles.passwordInput,
                                styles.desktopPasswordInput,
                                focusedInput === 'password' ? styles.inputFocused : null,
                                passwordError ? styles.inputError : null
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
                            <TouchableOpacity style={[styles.eyeButton, styles.desktopEyeButton]} onPress={() => setShowPassword(!showPassword)}>
                              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                          </View>
                          {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
                        </>
                      ) : otpSent ? (
                        <>
                          <View style={styles.passwordHeader}>
                            <Text style={styles.desktopLabel}>Mã xác thực OTP (Xem log ở server)</Text>
                          </View>
                          <View style={[styles.passwordContainer, styles.desktopPasswordContainer]}>
                            <TextInput
                              style={[
                                styles.passwordInput,
                                styles.desktopPasswordInput,
                                { letterSpacing: 4, textAlign: 'center', fontWeight: 'bold' },
                                focusedInput === 'otp' ? styles.inputFocused : null,
                                passwordError ? styles.inputError : null
                              ]}
                              placeholder="Nhập 6 chữ số"
                              placeholderTextColor="#94A3B8"
                              keyboardType="number-pad"
                              maxLength={6}
                              value={otpCode}
                              onChangeText={(text) => {
                                setOtpCode(text);
                                if (passwordError) setPasswordError('');
                              }}
                              onFocus={() => setFocusedInput('otp')}
                              onBlur={() => setFocusedInput(null)}
                              onSubmitEditing={handleLogin}
                            />
                            <TouchableOpacity
                              style={[styles.eyeButton, styles.desktopEyeButton, { right: 10, width: 80, height: 40, justifyContent: 'center' }]}
                              onPress={() => setOtpSent(false)}
                            >
                              <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '600' }}>Gửi lại mã</Text>
                            </TouchableOpacity>
                          </View>
                          {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
                        </>
                      ) : null}

                      {/* Security Remember checkbox */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 }}
                        onPress={() => setRememberMe(!rememberMe)}
                      >
                        <Text style={{ fontSize: 16, color: rememberMe ? '#15803D' : '#94A3B8', marginRight: 8, fontWeight: 'bold' }}>
                          {rememberMe ? '☑' : '☐'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
                          Lưu thông tin đăng nhập <Text style={{ color: '#C2410C', fontWeight: '600' }}>(Không khuyến nghị trên thiết bị công cộng)</Text>
                        </Text>
                      </TouchableOpacity>

                      {/* Login Button */}
                      <TouchableOpacity style={[styles.loginButton, styles.desktopLoginButton]} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <ActivityIndicator color="#FFF" size="small" />
                            <Text style={styles.loginButtonText}>Đang thiết lập kết nối an toàn...</Text>
                          </View>
                        ) : (
                          <Text style={styles.loginButtonText}>
                            {loginMethod === 'password'
                              ? 'Đăng nhập →'
                              : otpSent
                                ? 'Xác nhận & Đăng nhập →'
                                : 'Gửi mã OTP →'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.desktopDividerContainer}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>HOẶC ĐĂNG NHẬP VỚI</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* SSO Grid */}
                    <View style={styles.desktopSsoContainer}>
                      <TouchableOpacity style={[styles.ssoButton, styles.desktopSsoButton, { width: '100%' }]} onPress={handleGoogleLogin}>
                        <Text style={styles.googleIcon}>G</Text>
                        <Text style={styles.ssoButtonText}>Google</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sign up Link */}
                    <View style={styles.desktopRegisterContainer}>
                      <Text style={styles.registerText}>Chưa có tài khoản? </Text>
                      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.registerLink}>Đăng ký ngay →</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Hotline text helper */}
                <Text style={styles.hotlineText}>
                  Bạn gặp khó khăn khi đăng nhập? Gọi ngay Hotline:{' '}
                  <Text style={styles.hotlineLink}>0236 3650 676</Text>
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.mainBody}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {showTwoFactor ? (
            <View style={styles.form}>
              <Text style={styles.title}>Xác thực 2 lớp (2FA)</Text>
              <Text style={styles.subtitle}>Vui lòng nhập mã OTP từ Google Authenticator hoặc SMS để tiếp tục</Text>

              <Text style={styles.label}>Mã xác thực OTP (6 chữ số)</Text>
              <TextInput
                style={[
                  styles.input,
                  { letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 'bold' },
                  focusedInput === 'twoFactor' ? styles.inputFocused : null,
                  twoFactorError ? styles.inputError : null
                ]}
                placeholder="------"
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
              {twoFactorError ? <Text style={styles.inlineError}>{twoFactorError}</Text> : null}

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleVerify2Factor}
                disabled={loading}
              >
                {loading ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.loginButtonText}>Đang thiết lập kết nối an toàn...</Text>
                  </View>
                ) : (
                  <Text style={styles.loginButtonText}>Xác nhận & Đăng nhập →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.homeLinkBtn, { marginTop: 12, height: 46, justifyContent: 'center', alignItems: 'center' }]}
                onPress={() => {
                  setShowTwoFactor(false);
                  setTwoFactorCode('');
                  setTwoFactorError('');
                }}
              >
                <Text style={styles.homeLinkBtnText}>← Quay lại form đăng nhập</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Title */}
              <Text style={styles.title}>Chào mừng trở lại</Text>
              <Text style={styles.subtitle}>Vui lòng nhập thông tin để truy cập hệ thống</Text>

              {/* Inputs */}
              <View style={styles.form}>
                {/* Role Selection Tabs */}
                <View style={styles.roleTabsContainer}>
                  <TouchableOpacity
                    style={[styles.roleTab, loginRole === 'patient' && styles.activeRoleTab]}
                    onPress={() => {
                      setLoginRole('patient');
                      setEmailError('');
                      setPasswordError('');
                    }}
                  >
                    <Text style={[styles.roleTabText, loginRole === 'patient' && styles.activeRoleTabText]}>
                      Dành cho Bệnh nhân
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleTab, loginRole === 'staff' && styles.activeRoleTab]}
                    onPress={() => {
                      setLoginRole('staff');
                      setLoginMethod('password');
                      setEmailError('');
                      setPasswordError('');
                      setOtpSent(false);
                    }}
                  >
                    <Text style={[styles.roleTabText, loginRole === 'staff' && styles.activeRoleTabText]}>
                      Bác sĩ / Nhân viên
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Method Tabs - Only show for patient */}
                {loginRole === 'patient' && (
                  <View style={styles.methodTabsContainer}>
                    <TouchableOpacity
                      style={[styles.methodTab, loginMethod === 'password' && styles.activeMethodTab]}
                      onPress={() => {
                        setLoginMethod('password');
                        setEmailError('');
                        setPasswordError('');
                        setOtpSent(false);
                      }}
                    >
                      <Text style={[styles.methodTabText, loginMethod === 'password' && styles.activeMethodTabText]}>
                        Mật khẩu
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.methodTab, loginMethod === 'otp' && styles.activeMethodTab]}
                      onPress={() => {
                        setLoginMethod('otp');
                        setEmailError('');
                        setPasswordError('');
                        setOtpSent(false);
                      }}
                    >
                      <Text style={[styles.methodTabText, loginMethod === 'otp' && styles.activeMethodTabText]}>
                        Mã OTP
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.label}>
                  {loginRole === 'staff'
                    ? 'Mã nhân sự hoặc Email nội bộ'
                    : loginMethod === 'otp'
                      ? 'Số điện thoại'
                      : 'Số điện thoại, Email hoặc CCCD'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === 'email' ? styles.inputFocused : null,
                    emailError ? styles.inputError : null
                  ]}
                  placeholder={
                    loginRole === 'staff'
                      ? 'Nhập mã nhân sự hoặc email'
                      : loginMethod === 'otp'
                        ? 'Nhập 10 số điện thoại'
                        : 'Nhập SĐT, email hoặc số CCCD'
                  }
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  autoCapitalize="none"
                  keyboardType={loginRole === 'patient' && loginMethod === 'otp' ? 'phone-pad' : 'email-address'}
                  editable={loginMethod === 'otp' ? !otpSent : true}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  onSubmitEditing={handleLogin}
                />
                {emailError ? <Text style={styles.inlineError}>{emailError}</Text> : null}

                {loginMethod === 'password' ? (
                  <>
                    <View style={styles.passwordHeader}>
                      <Text style={styles.label}>Mật khẩu</Text>
                      <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[
                          styles.passwordInput,
                          focusedInput === 'password' ? styles.inputFocused : null,
                          passwordError ? styles.inputError : null
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
                      <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                        <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>
                    {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
                  </>
                ) : otpSent ? (
                  <>
                    <View style={styles.passwordHeader}>
                      <Text style={styles.label}>Mã xác thực OTP (Xem log ở server)</Text>
                    </View>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[
                          styles.passwordInput,
                          { letterSpacing: 4, textAlign: 'center', fontWeight: 'bold' },
                          focusedInput === 'otp' ? styles.inputFocused : null,
                          passwordError ? styles.inputError : null
                        ]}
                        placeholder="Nhập 6 chữ số"
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={(text) => {
                          setOtpCode(text);
                          if (passwordError) setPasswordError('');
                        }}
                        onFocus={() => setFocusedInput('otp')}
                        onBlur={() => setFocusedInput(null)}
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity
                        style={[styles.eyeButton, { right: 10, width: 80, height: 50, justifyContent: 'center' }]}
                        onPress={() => setOtpSent(false)}
                      >
                        <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '600' }}>Gửi lại mã</Text>
                      </TouchableOpacity>
                    </View>
                    {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
                  </>
                ) : null}

                {/* Security Remember checkbox */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 }}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <Text style={{ fontSize: 16, color: rememberMe ? '#15803D' : '#94A3B8', marginRight: 8, fontWeight: 'bold' }}>
                    {rememberMe ? '☑' : '☐'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
                    Lưu thông tin đăng nhập <Text style={{ color: '#C2410C', fontWeight: '600' }}>(Không khuyến nghị trên thiết bị công cộng)</Text>
                  </Text>
                </TouchableOpacity>

                {/* Login Button */}
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                  {loading ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <ActivityIndicator color="#FFF" size="small" />
                      <Text style={styles.loginButtonText}>Đang thiết lập kết nối an toàn...</Text>
                    </View>
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {loginMethod === 'password'
                        ? 'Đăng nhập →'
                        : otpSent
                          ? 'Xác nhận & Đăng nhập →'
                          : 'Gửi mã OTP →'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>HOẶC ĐĂNG NHẬP VỚI</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* SSO Grid */}
              <View style={styles.ssoContainer}>
                <TouchableOpacity style={[styles.ssoButton, { width: '100%' }]} onPress={handleGoogleLogin}>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.ssoButtonText}>Google</Text>
                </TouchableOpacity>
              </View>

              {/* Sign up Link */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Chưa có tài khoản? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.registerLink}>Đăng ký ngay →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Hotline text helper */}
          <Text style={styles.hotlineText}>
            Bạn gặp khó khăn khi đăng nhập? Gọi ngay Hotline:{' '}
            <Text style={styles.hotlineLink}>0236 3650 676</Text>
          </Text>
        </ScrollView>
      )}

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quên mật khẩu</Text>
              <TouchableOpacity onPress={() => {
                setShowForgotModal(false);
                setForgotStep(1);
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView contentContainerStyle={styles.modalBody}>
              {forgotStep === 1 ? (
                <View>
                  <Text style={styles.modalDesc}>
                    Nhập email tài khoản của bạn. Hệ thống sẽ gửi một mã OTP gồm 6 chữ số để xác minh.
                  </Text>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="vidu@neuroscan.com"
                    placeholderTextColor="#94A3B8"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onSubmitEditing={handleRequestOtp}
                  />
                  <TouchableOpacity
                    style={styles.modalSubmitButton}
                    onPress={handleRequestOtp}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Gửi mã OTP →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.otpNotice}>
                    <Text style={styles.otpNoticeText}>
                      Mã OTP đã được gửi đến {forgotEmail}.
                    </Text>
                    <Text style={styles.otpNoticeSubtext}>
                      * Lưu ý: Nếu test dưới máy cục bộ (local), hãy xem mã OTP tại console/log của server.
                    </Text>
                  </View>

                  <Text style={styles.label}>Mã OTP (6 số)</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="Nhập 6 số"
                    placeholderTextColor="#94A3B8"
                    maxLength={6}
                    keyboardType="number-pad"
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    onSubmitEditing={handleVerifyOtp}
                  />

                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={forgotNewPassword}
                    onChangeText={setForgotNewPassword}
                    autoCapitalize="none"
                    onSubmitEditing={handleVerifyOtp}
                  />

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalBackButton}
                      onPress={() => setForgotStep(1)}
                    >
                      <Text style={styles.modalBackText}>Quay lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalConfirmButton}
                      onPress={handleVerifyOtp}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.modalConfirmText}>Đặt lại</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

;


export default LoginScreen;
