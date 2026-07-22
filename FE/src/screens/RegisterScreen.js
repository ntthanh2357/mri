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
  useWindowDimensions,
  Image,
} from 'react-native';
import Config from '../constants/config';
import { post } from '../services/api.service';
import styles from './RegisterScreen.styles';


const RegisterScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient'); // only 'patient' can self-register
  // BHYT removed for privacy regulations
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);



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

  const handleRegister = async () => {
    // Reset errors
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

    // Phone is optional — validate format only when provided
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
      // Directly register the user (no OTP step required)
      const payload = {
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'patient',
        phone: phone.trim() || undefined,
      };
      const data = await post('/auth/register', payload);
      showAlert('success', 'Đăng ký thành công', 'Tài khoản đã được tạo! Vui lòng đăng nhập.', () => {
        navigation.navigate('Login');
      });
    } catch (error) {
      console.error('Register error:', error);
      showAlert('error', 'Đăng ký thất bại', error.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
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
                {/* Back Button */}
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={styles.backButtonText}>← Quay lại đăng nhập</Text>
                </TouchableOpacity>

                {/* Title */}
                <View style={styles.desktopTitleContainer}>
                  <Text style={styles.desktopTitle}>Đăng ký tài khoản</Text>
                  <Text style={styles.desktopSubtitle}>Tạo tài khoản mới để trải nghiệm chẩn đoán AI</Text>
                </View>

                {/* Form */}
                <View style={styles.desktopForm}>
                  <Text style={styles.desktopLabel}>Họ và tên *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.desktopInput,
                      focusedInput === 'name' ? styles.inputFocused : null,
                      nameError ? styles.inputError : null
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
                  {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

                  <Text style={styles.desktopLabel}>Địa chỉ Email *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.desktopInput,
                      focusedInput === 'email' ? styles.inputFocused : null,
                      emailError ? styles.inputError : null
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
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                  <Text style={styles.desktopLabel}>Số điện thoại (tùy chọn)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.desktopInput,
                      focusedInput === 'phone' ? styles.inputFocused : null,
                      phoneError ? styles.inputError : null
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
                  {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

                  <Text style={styles.desktopLabel}>Mật khẩu *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.desktopInput,
                      focusedInput === 'password' ? styles.inputFocused : null,
                      passwordError ? styles.inputError : null
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
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
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                  {/* Info banner for staff */}
                  <View style={styles.staffNotice}>
                    <Text style={styles.staffNoticeIcon}>🏥</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffNoticeTitle}>Bạn là nhân viên y tế?</Text>
                      <Text style={styles.staffNoticeText}>
                        Tài khoản Bác sĩ, Điều dưỡng, KTV được cấp bởi <Text style={{ fontWeight: 'bold' }}>Admin Bệnh viện</Text>.
                      </Text>
                    </View>
                  </View>

                  {/* Register Button */}
                  <TouchableOpacity style={[styles.registerButton, { height: 42 }]} onPress={handleRegister} disabled={loading}>
                    {loading ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={styles.registerButtonText}>Đang đăng ký...</Text>
                      </View>
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
            </View>
          </View>
        </View>
      ) : (
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
              style={[
                styles.input,
                focusedInput === 'name' ? styles.inputFocused : null,
                nameError ? styles.inputError : null
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
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            <Text style={styles.label}>Địa chỉ Email *</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'email' ? styles.inputFocused : null,
                emailError ? styles.inputError : null
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
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <Text style={styles.label}>Số điện thoại (tùy chọn)</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'phone' ? styles.inputFocused : null,
                phoneError ? styles.inputError : null
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
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <Text style={styles.label}>Mật khẩu *</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'password' ? styles.inputFocused : null,
                passwordError ? styles.inputError : null
              ]}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
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
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            {/* Info banner for staff */}
            <View style={styles.staffNotice}>
              <Text style={styles.staffNoticeIcon}>🏥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffNoticeTitle}>Bạn là nhân viên y tế?</Text>
                <Text style={styles.staffNoticeText}>
                  Tài khoản Bác sĩ, Điều dưỡng, KTV, Lễ tân được cấp bởi <Text style={{ fontWeight: 'bold' }}>Admin Bệnh viện</Text>. Vui lòng liên hệ quản trị viên cơ sở của bạn để được cấp thông tin đăng nhập.
                </Text>
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
              {loading ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.registerButtonText}>Đang đăng ký...</Text>
                </View>
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



export default RegisterScreen;

