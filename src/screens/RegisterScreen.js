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
} from 'react-native';
import Config from '../constants/config';
import { post } from '../services/api.service';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient'); // 'patient' or 'doctor'
  const [bhytNumber, setBhytNumber] = useState(''); // Patient only
  const [licenseUrl, setLicenseUrl] = useState(''); // Doctor only
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Email, Mật khẩu và Họ tên.');
      return;
    }

    const payload = {
      email,
      password,
      name,
      phone: phone || undefined,
      role,
      bhytNumber: role === 'patient' ? bhytNumber : undefined,
      licenseUrl: role === 'doctor' ? licenseUrl : undefined,
    };

    setLoading(true);
    try {
      const data = await post('/auth/register', payload);
      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Register error:', error);
      Alert.alert('Đăng ký thất bại', error.message || 'Đã xảy ra lỗi khi kết nối.');
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
            style={styles.input}
            placeholder="Nguyễn Văn A"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Địa chỉ Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="vidu@neuroscan.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={styles.input}
            placeholder="09XXXXXXXX"
            placeholderTextColor="#94A3B8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Mật khẩu *</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />

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
          {role === 'patient' ? (
            <View>
              <Text style={styles.label}>Số thẻ BHYT (nếu có)</Text>
              <TextInput
                style={styles.input}
                placeholder="GD401XXXXXXXXXX"
                placeholderTextColor="#94A3B8"
                value={bhytNumber}
                onChangeText={setBhytNumber}
                autoCapitalize="characters"
              />
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Đường dẫn Chứng chỉ hành nghề (CCHN) *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://drive.google.com/... hoặc file path"
                placeholderTextColor="#94A3B8"
                value={licenseUrl}
                onChangeText={setLicenseUrl}
                autoCapitalize="none"
              />
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
});

export default RegisterScreen;
