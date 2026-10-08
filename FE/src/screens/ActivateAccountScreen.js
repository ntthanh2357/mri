import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Modal,
  Image,
  Platform,
} from 'react-native';
import Colors from '../constants/colors';
import PressableScale from '../components/PressableScale';
import { put, setAuthToken, get } from '../services/api.service';
import { Lock, Shield, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

const ROLE_LABELS = {
  doctor: 'Bác sĩ chuyên khoa',
  nurse: 'Điều dưỡng & Y tá',
  technician: 'Kỹ thuật viên phòng MRI',
  hospital_admin: 'Quản trị viên Bệnh viện',
};

const ROLE_COLORS = {
  doctor: { bg: '#EEF2FF', text: '#4F46E5', label: 'Bác sĩ chuyên khoa' },
  nurse: { bg: '#F0FDFA', text: '#0D9488', label: 'Điều dưỡng & Y tá' },
  technician: { bg: '#FEF3C7', text: '#D97706', label: 'Kỹ thuật viên phòng MRI' },
  hospital_admin: { bg: '#E6F4EA', text: '#047857', label: 'Quản trị viên Bệnh viện' },
};

const ActivateAccountScreen = ({ route, navigation }) => {
  const { user, accessToken } = route.params || {};
  const isTempEmail = user?.email?.includes('@temp.neuroscan.internal');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '', onClose: null });

  const showAlert = (type, title, message, onClose = null) =>
    setAlert({ visible: true, type, title, message, onClose });

  const handleActivate = async () => {
    if (isTempEmail && !newEmail.trim()) {
      showAlert('error', 'Thiếu thông tin', 'Vui lòng nhập Email đăng nhập chính thức mới.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (isTempEmail && !emailRegex.test(newEmail.trim())) {
      showAlert('error', 'Email không hợp lệ', 'Định dạng Email đăng nhập chính thức không đúng.');
      return;
    }
    if (!currentPassword) {
      showAlert('error', 'Thiếu thông tin', 'Vui lòng nhập mật khẩu tạm thời đã được cấp.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showAlert('error', 'Mật khẩu không hợp lệ', 'Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('error', 'Không khớp', 'Mật khẩu mới và xác nhận mật khẩu không khớp nhau.');
      return;
    }
    if (currentPassword === newPassword) {
      showAlert('error', 'Mật khẩu trùng', 'Mật khẩu mới phải khác mật khẩu tạm thời.');
      return;
    }

    setLoading(true);
    try {
      const res = await put('/auth/password', { 
        currentPassword, 
        newPassword,
        newEmail: isTempEmail ? newEmail.trim() : undefined
      });

      if (res.accessToken) {
        await setAuthToken(res.accessToken);
      }

      let destination = 'Home';
      let destParams = { user: res.user };

      if (res.user?.role === 'hospital_admin') {
        try {
          const hRes = await get('/api/v1/hospital/me');
          const hStatus = hRes.hospital?.status || hRes.data?.hospital?.status;
          if (hStatus === 'provisioned') {
            destination = 'HospitalOnboarding';
          } else {
            destination = 'ClinicDashboard';
          }
        } catch (err) {
          console.error('Lỗi kiểm tra trạng thái bệnh viện sau kích hoạt:', err);
          destination = 'HospitalOnboarding';
        }
      } else if (res.user?.role === 'doctor' || res.user?.role === 'technician') {
        destination = 'Home';
      } else if (res.user?.role === 'nurse') {
        destination = 'DoctorWorkQueue';
      } else if (res.user?.role === 'admin') {
        destination = 'AdminBackoffice';
      }

      showAlert('success', 'Kích hoạt thành công!', 'Tài khoản của bạn đã được kích hoạt. Đang chuyển tiếp bạn vào hệ thống...', () => {
        navigation.replace(destination, destParams);
      });
    } catch (err) {
      showAlert('error', 'Kích hoạt thất bại', err.message || 'Mật khẩu tạm thời không chính xác. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const roleInfo = ROLE_COLORS[user?.role] || { bg: '#F1F5F9', text: '#475569', label: user?.role || 'Nhân viên hệ thống' };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandName}>
              Neuro<Text style={styles.brandNameAccent}>Scan</Text> AI
            </Text>
            <Text style={styles.brandSub}>HỆ THỐNG CHẨN ĐOÁN HÌNH ẢNH THẦN KINH</Text>
          </View>
        </View>

        {/* Form Card wrapper */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.lockBadge}>
              <Lock size={26} color={Colors.brandGreen} />
            </View>
            <Text style={styles.title}>Kích hoạt tài khoản</Text>
            <Text style={styles.subtitle}>
              Vui lòng cập nhật email đăng nhập chính thức và thiết lập mật khẩu mới để kích hoạt tài khoản.
            </Text>
          </View>

          {/* Account Detail Info section */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tài khoản tạm thời:</Text>
              <Text style={styles.infoValue}>{user?.email || '—'}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.infoLabel}>Vai trò truy cập:</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleInfo.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleInfo.text }]}>{roleInfo.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* New Email (only if temporary email) */}
          {isTempEmail && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email đăng nhập chính thức *</Text>
              <Text style={styles.hint}>Nhập email thực của bạn để sử dụng đăng nhập sau này</Text>
              <View style={[
                styles.passwordRow,
                focusedInput === 'newEmail' ? styles.passwordRowFocused : null
              ]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="vidu@neuroscan.com"
                  placeholderTextColor={Colors.secondary}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setFocusedInput('newEmail')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>
          )}

          {/* Current (temp) password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu tạm thời *</Text>
            <Text style={styles.hint}>Mật khẩu do Admin cấp cho bạn lúc đầu</Text>
            <View style={[
              styles.passwordRow,
              focusedInput === 'currentPassword' ? styles.passwordRowFocused : null
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập mật khẩu tạm thời"
                placeholderTextColor={Colors.secondary}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
                onFocus={() => setFocusedInput('currentPassword')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                {showCurrent ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* New password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu mới *</Text>
            <Text style={styles.hint}>Tối thiểu 6 ký tự bảo mật</Text>
            <View style={[
              styles.passwordRow,
              focusedInput === 'newPassword' ? styles.passwordRowFocused : null
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Đặt mật khẩu mới của bạn"
                placeholderTextColor={Colors.secondary}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                onFocus={() => setFocusedInput('newPassword')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                {showNew ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu mới *</Text>
            <View style={[
              styles.passwordRow,
              focusedInput === 'confirmPassword' ? styles.passwordRowFocused : null
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor={Colors.secondary}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                {showConfirm ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Strength indicator */}
          {newPassword.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 8 ? '#047857' : newPassword.length >= 6 ? '#B45309' : '#B91C1C' }]} />
              <Text style={[styles.strengthText, { color: newPassword.length >= 8 ? '#047857' : newPassword.length >= 6 ? '#B45309' : '#B91C1C' }]}>
                {newPassword.length >= 8 ? 'Độ bảo mật: Mạnh' : newPassword.length >= 6 ? 'Độ bảo mật: Trung bình' : 'Độ bảo mật: Yếu'}
              </Text>
            </View>
          )}

          {/* Submit */}
          <PressableScale
            style={[styles.activateBtn, loading && { opacity: 0.7 }]}
            hoverStyle={styles.activateBtnHover}
            onPress={handleActivate}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.activateBtnText}>Đang xác thực thông tin...</Text>
              </View>
            ) : (
              <Text style={styles.activateBtnText}>Kích hoạt và vào hệ thống</Text>
            )}
          </PressableScale>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Shield size={18} color={Colors.brandGreen} style={{ marginTop: 1 }} />
          <Text style={styles.securityText}>
            Mật khẩu được mã hóa một chiều (bcrypt) trước khi lưu. Không chia sẻ mật khẩu với bất kỳ ai, kể cả nhân viên hỗ trợ.
          </Text>
        </View>

      </ScrollView>

      {/* Alert Modal */}
      <Modal visible={alert.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={[
              styles.alertIconCircle,
              alert.type === 'success' && { backgroundColor: Colors.brandGreenSoft },
              alert.type === 'error' && { backgroundColor: '#FEF2F2' },
            ]}>
              {alert.type === 'success' ? (
                <CheckCircle2 size={32} color={Colors.brandGreen} />
              ) : (
                <AlertCircle size={32} color="#DC2626" />
              )}
            </View>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: alert.type === 'success' ? Colors.brandGreen : '#B91C1C' }]}
              onPress={() => {
                setAlert(prev => ({ ...prev, visible: false }));
                if (alert.onClose) alert.onClose();
              }}
            >
              <Text style={styles.alertBtnText}>
                {alert.type === 'success' ? 'Vào hệ thống' : 'Thử lại'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingVertical: 48, alignItems: 'center' },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 48,
    height: 48,
    marginRight: 10,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.brandNavy,
    letterSpacing: -0.2,
  },
  brandNameAccent: { color: Colors.brandGreen },
  brandSub: {
    fontSize: 11,
    color: Colors.brandGreen,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    boxShadow: '0 1px 2px rgba(11, 42, 85, 0.05), 0 16px 36px -20px rgba(11, 42, 85, 0.25)',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandGreenSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CDEBDF',
  },
  lockEmoji: { fontSize: 24 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.brandNavy, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.slateMuted, textAlign: 'center', lineHeight: 20 },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoLabel: { fontSize: 13, color: Colors.slateMuted, fontWeight: '500' },
  infoValue: { fontSize: 13, color: Colors.slateDark, fontWeight: '700' },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateDark, marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.secondary, marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      }
    }),
  },
  passwordRowFocused: {
    borderColor: Colors.brandGreen,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: '0 0 0 3px rgba(6, 122, 94, 0.18)',
      }
    }),
  },
  passwordInput: { flex: 1, height: 46, paddingHorizontal: 14, fontSize: 15, color: Colors.slateDark },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 16, color: '#64748B' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 16 },
  strengthBar: { height: 4, width: 60, borderRadius: 2 },
  strengthText: { fontSize: 12, fontWeight: '600' },
  activateBtn: {
    height: 48,
    backgroundColor: Colors.brandGreen,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '0 10px 22px -12px rgba(6, 122, 94, 0.7)',
  },
  activateBtnHover: { backgroundColor: Colors.brandGreenPressed },
  activateBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 24,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 420,
  },
  securityIcon: { fontSize: 16 },
  securityText: { flex: 1, fontSize: 13, color: Colors.slateMuted, lineHeight: 19 },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(11, 42, 85, 0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  alertIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertIconText: { fontSize: 24, fontWeight: 'bold' },
  alertTitle: { fontSize: 17, fontWeight: '800', color: Colors.brandNavy, marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: Colors.slateMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  alertBtn: { width: '100%', height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});

export default ActivateAccountScreen;
