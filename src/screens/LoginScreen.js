import React, { useState } from 'react';
import {
  StyleSheet,
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
import { post, setAuthToken } from '../services/api.service';

const LoginScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 or 2
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      if (Platform.OS === 'web') {
        window.alert('Vui lòng nhập đầy đủ email/SĐT và mật khẩu.');
      } else {
        Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email/SĐT và mật khẩu.');
      }
      return;
    }
    setLoading(true);
    try {
      const data = await post('/auth/login', { email, password });
      setAuthToken(data.accessToken);
      if (Platform.OS === 'web') {
        window.alert('Đăng nhập thành công!');
      } else {
        Alert.alert('Thành công', 'Đăng nhập thành công!');
      }
      // Navigate to Home screen
      navigation.replace('Home');
    } catch (error) {
      console.error('Login error:', error);
      const errMsg = error.message || 'Không thể kết nối đến máy chủ.';
      if (Platform.OS === 'web') {
        window.alert('Đăng nhập thất bại: ' + errMsg);
      } else {
        Alert.alert('Đăng nhập thất bại', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      let idToken = 'mock_google_token_123';
      
      if (Platform.OS === 'web') {
        const { signInWithPopup } = require('firebase/auth');
        const { auth, googleProvider } = require('../firebase');
        const result = await signInWithPopup(auth, googleProvider);
        idToken = await result.user.getIdToken();
      }

      const data = await post('/auth/sso/google', { idToken });
      setAuthToken(data.accessToken);
      
      if (Platform.OS === 'web') {
        window.alert('Đăng nhập bằng Google thành công!');
      } else {
        Alert.alert('Thành công', 'Đăng nhập bằng Google thành công!');
      }
      navigation.replace('Home');
    } catch (error) {
      console.error('Google SSO error:', error);
      const errMsg = error.message || 'Đăng nhập Google thất bại.';
      if (Platform.OS === 'web') {
        window.alert('Lỗi: ' + errMsg);
      } else {
        Alert.alert('Lỗi', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleZaloLogin = async () => {
    setLoading(true);
    try {
      const data = await post('/auth/sso/zalo', { accessToken: 'mock_zalo_token_123' });
      setAuthToken(data.accessToken);
      if (Platform.OS === 'web') {
        window.alert('Đăng nhập bằng Zalo thành công! (MOCK)');
      } else {
        Alert.alert('Thành công', 'Đăng nhập bằng Zalo thành công! (MOCK)');
      }
      navigation.replace('Home');
    } catch (error) {
      console.error('Zalo SSO error:', error);
      const errMsg = error.message || 'Đăng nhập Zalo thất bại.';
      if (Platform.OS === 'web') {
        window.alert('Lỗi: ' + errMsg);
      } else {
        Alert.alert('Lỗi', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!forgotEmail) {
      if (Platform.OS === 'web') {
        window.alert('Vui lòng nhập email.');
      } else {
        Alert.alert('Lỗi', 'Vui lòng nhập email.');
      }
      return;
    }
    setForgotLoading(true);
    try {
      const data = await post('/auth/forgot-password', { email: forgotEmail });
      const msg = data.message || 'Mã OTP đã được gửi!';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Thông báo', msg);
      }
      setForgotStep(2);
    } catch (error) {
      console.error('Request OTP error:', error);
      const errMsg = error.message || 'Yêu cầu gửi OTP thất bại.';
      if (Platform.OS === 'web') {
        window.alert('Lỗi: ' + errMsg);
      } else {
        Alert.alert('Lỗi', errMsg);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp || !forgotNewPassword) {
      if (Platform.OS === 'web') {
        window.alert('Vui lòng nhập mã OTP và mật khẩu mới.');
      } else {
        Alert.alert('Lỗi', 'Vui lòng nhập mã OTP và mật khẩu mới.');
      }
      return;
    }
    setForgotLoading(true);
    try {
      const data = await post('/auth/verify-otp', {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      });
      if (Platform.OS === 'web') {
        window.alert('Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.');
      } else {
        Alert.alert('Thành công', 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.');
      }
      setShowForgotModal(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp('');
      setForgotNewPassword('');
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errMsg = error.message || 'Xác thực OTP thất bại.';
      if (Platform.OS === 'web') {
        window.alert('Lỗi: ' + errMsg);
      } else {
        Alert.alert('Lỗi', errMsg);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={isDesktop ? styles.desktopContainer : styles.container}>
      <View style={isDesktop ? styles.desktopCard : styles.fullWidth}>
        {/* Left Panel */}
        {isDesktop && (
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
        )}

        {/* Right Panel (Form) */}
        <View style={isDesktop ? styles.rightPanel : styles.fullWidth}>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {/* Header Logo */}
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <View style={styles.logoInner} />
              </View>
              <Text style={styles.appName}>{Config.APP_NAME}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>Chào mừng trở lại</Text>
            <Text style={styles.subtitle}>Vui lòng nhập thông tin để truy cập hệ thống</Text>

            {/* Inputs */}
            <View style={styles.form}>
              <Text style={styles.label}>Số điện thoại hoặc Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email hoặc SĐT"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Mật khẩu</Text>
                <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Đăng nhập →</Text>
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
              <TouchableOpacity style={styles.ssoButton} onPress={handleGoogleLogin}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.ssoButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.ssoButton, styles.zaloButton]} onPress={handleZaloLogin}>
                <View style={styles.zaloCircle}>
                  <Text style={styles.zaloLetter}>Z</Text>
                </View>
                <Text style={styles.ssoButtonText}>Zalo</Text>
              </TouchableOpacity>
            </View>

            {/* Sign up Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Đăng ký ngay →</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Demo Login */}
            <View style={styles.quickLoginContainer}>
              <Text style={styles.quickLoginTitle}>Đăng nhập nhanh (demo):</Text>
              <View style={styles.quickButtonsRow}>
                <TouchableOpacity style={styles.quickButton} onPress={() => {
                  setAuthToken('');
                  navigation.replace('Home', { user: { role: 'doctor', email: 'doctor@neuroscan.com', profile: { name: 'Bác sĩ Demo' } } });
                }}>
                  <Text style={styles.quickButtonText}>Bảng điều khiển</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickButton} onPress={() => {
                  setAuthToken('');
                  navigation.replace('Home', { user: { role: 'patient', email: 'patient@neuroscan.com', profile: { name: 'Bệnh nhân Demo' } } });
                }}>
                  <Text style={styles.quickButtonText}>Cổng bệnh nhân</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 16,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'between',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '500',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 24,
  },
  passwordInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 50,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    height: 50,
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 18,
  },
  loginButton: {
    height: 52,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  ssoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  ssoButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  ssoButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    marginLeft: 8,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  zaloButton: {
    // can customize zalo container styles
  },
  zaloCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zaloLetter: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  quickLoginContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  quickLoginTitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 12,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    marginBottom: 20,
  },
  registerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLink: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: 'bold',
  },
  quickButton: {
    flex: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  closeButton: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalSubmitButton: {
    height: 52,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  otpNotice: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  otpNoticeText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  otpNoticeSubtext: {
    color: '#15803D',
    fontSize: 11,
    lineHeight: 16,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBackButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 2,
    height: 52,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  desktopContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  desktopCard: {
    width: 900,
    maxWidth: '90%',
    height: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  leftPanel: {
    flex: 1.1,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 32,
    backgroundColor: '#0a2e0a',
  },
  leftPanelBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.4,
  },
  leftPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 61, 43, 0.4)',
  },
  leftPanelContent: {
    zIndex: 10,
  },
  statsBadgeContainer: {
    flexDirection: 'row',
    gap: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  statMiniCard: {
    // mini status
  },
  statMiniLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statMiniValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leftPanelTextTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  leftPanelTextHighlight: {
    color: '#4ADE80',
  },
  leftPanelTextDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  rightPanel: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  fullWidth: {
    width: '100%',
  },
});

export default LoginScreen;
