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
import styles from './RegisterScreen.styles';


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
          <View style={styles.roleGrid}>
            {[
              { id: 'patient', label: 'Bệnh nhân' },
              { id: 'doctor', label: 'Bác sĩ' },
              { id: 'nurse', label: 'Điều dưỡng' },
              { id: 'technician', label: 'Kỹ thuật viên' },
              { id: 'receptionist', label: 'Tiếp tân' },
            ].map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.roleGridTab, role === r.id && styles.activeRoleGridTab]}
                onPress={() => setRole(r.id)}
              >
                <Text style={[styles.roleGridTabText, role === r.id && styles.activeRoleGridTabText]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Conditional inputs for Doctor only */}
          {role === 'doctor' && (
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

;

export default RegisterScreen;
