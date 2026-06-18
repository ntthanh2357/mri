import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import Config from '../constants/config';
import { post } from '../services/api.service';


const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient'); // 'patient' or 'doctor'
  // BHYT removed for privacy regulations
  const [licenseUrl, setLicenseUrl] = useState(''); // Doctor only
  const [loading, setLoading] = useState(false);

  // OTP Verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpModalVisible, setOtpModalVisible] = useState(false);

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

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [licenseUrlError, setLicenseUrlError] = useState('');

  const handleRegister = async () => {
    // Reset errors
    setNameError('');
    setEmailError('');
    setPhoneError('');
    setPasswordError('');
    setLicenseUrlError('');

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

    // Phone number is required for Phone+OTP verification
    if (!phone.trim()) {
      setPhoneError('Vui lòng nhập Số điện thoại.');
      hasError = true;
    } else {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone.trim())) {
        setPhoneError('Số điện thoại phải chứa đúng 10 số.');
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

    if (role === 'doctor' && !licenseUrl.trim()) {
      setLicenseUrlError('Vui lòng cung cấp đường dẫn Chứng chỉ hành nghề.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);
    try {
      // Step 1: Send registration OTP
      const data = await post('/auth/phone-register-request', { phone: phone.trim() });
      setOtpSent(true);
      setOtpModalVisible(true);
      showAlert('success', 'Gửi OTP thành công', data.message || 'Mã OTP xác thực số điện thoại đã được gửi.');
    } catch (error) {
      console.error('Register OTP request error:', error);
      showAlert('error', 'Đăng ký thất bại', error.message || 'Không thể gửi mã OTP xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegisterOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      showAlert('info', 'Thông báo', 'Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }

    const payload = {
      phone: phone.trim(),
      otp: otpCode.trim(),
      email: email.trim(),
      password,
      name: name.trim(),
      role,
      // bhytNumber removed for privacy regulations
      licenseUrl: role === 'doctor' ? licenseUrl.trim() : undefined,
    };

    setLoading(true);
    try {
      // Step 2: Verify OTP and save registration details
      await post('/auth/phone-register-verify', payload);
      setOtpModalVisible(false);
      setOtpCode('');
      showAlert('success', 'Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.', () => {
        navigation.navigate('Login');
      });
    } catch (error) {
      console.error('Register verify OTP error:', error);
      showAlert('error', 'Xác thực thất bại', error.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header Logo */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.appName}>{Config.APP_NAME}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Đăng ký tài khoản</Text>
        <Text style={styles.subtitle}>Tạo tài khoản mới để trải nghiệm chẩn đoán AI</Text>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Họ và tên *</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            placeholder="Nguyễn Văn A"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          <Text style={styles.label}>Địa chỉ Email *</Text>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            placeholder="vidu@neuroscan.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={[styles.input, phoneError ? styles.inputError : null]}
            placeholder="09XXXXXXXX"
            placeholderTextColor="#94A3B8"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (phoneError) setPhoneError('');
            }}
            keyboardType="phone-pad"
          />
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          <Text style={styles.label}>Mật khẩu *</Text>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError('');
            }}
            autoCapitalize="none"
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {/* Role selector */}
          <Text style={styles.label}>Bạn đăng ký với tư cách là *</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleTab, role === 'patient' && styles.activeRoleTab]}
              onPress={() => setRole('patient')}
            >
              <Text style={[styles.roleTabText, role === 'patient' && styles.activeRoleTabText]}>
                Bệnh nhân
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleTab, role === 'doctor' && styles.activeRoleTab]}
              onPress={() => setRole('doctor')}
            >
              <Text style={[styles.roleTabText, role === 'doctor' && styles.activeRoleTabText]}>
                Bác sĩ chuyên khoa
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conditional inputs */}
          {role === 'patient' ? null : (
            <View>
              <Text style={styles.label}>Đường dẫn Chứng chỉ hành nghề (CCHN) *</Text>
              <TextInput
                style={[styles.input, licenseUrlError ? styles.inputError : null]}
                placeholder="https://drive.google.com/... hoặc file path"
                placeholderTextColor="#94A3B8"
                value={licenseUrl}
                onChangeText={(text) => {
                  setLicenseUrl(text);
                  if (licenseUrlError) setLicenseUrlError('');
                }}
                autoCapitalize="none"
              />
              {licenseUrlError ? <Text style={styles.errorText}>{licenseUrlError}</Text> : null}
              <Text style={styles.helperText}>
                * Tài khoản bác sĩ sẽ được Ban quản trị phê duyệt thủ công sau khi kiểm tra CCHN.
              </Text>
            </View>
          )}

          {/* Register Button */}
          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.registerButtonText}>Đăng ký ngay</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Đăng nhập →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <Modal visible={otpModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác minh Số điện thoại</Text>
              <TouchableOpacity onPress={() => {
                setOtpModalVisible(false);
                setOtpCode('');
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.otpNotice}>
                <Text style={styles.otpNoticeText}>
                  Mã OTP đã được gửi đến số điện thoại {phone}.
                </Text>
                <Text style={styles.otpNoticeSubtext}>
                  * Vui lòng kiểm tra mã OTP tại terminal console của Server.
                </Text>
              </View>

              <Text style={styles.label}>Mã OTP (6 số)</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="Nhập 6 số"
                placeholderTextColor="#94A3B8"
                maxLength={6}
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={setOtpCode}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalBackButton}
                  onPress={() => {
                    setOtpModalVisible(false);
                    setOtpCode('');
                  }}
                >
                  <Text style={styles.modalBackText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleVerifyRegisterOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Xác nhận</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    marginTop: 8,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  appName: {
    fontSize: 16,
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
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRoleTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeRoleTabText: {
    color: '#15803D',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  registerButton: {
    height: 52,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  footerLink: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: 'bold',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
    fontWeight: '500',
    paddingLeft: 4,
  },
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
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  alertCard: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertIconText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
