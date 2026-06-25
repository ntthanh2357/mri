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
} from 'react-native';
import { put, setAuthToken, get } from '../services/api.service';

const ROLE_LABELS = {
  doctor: 'Bác sĩ',
  nurse: 'Điều dưỡng & Lễ tân',
  technician: 'Kỹ thuật viên',
  hospital_admin: 'Admin Bệnh viện',
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
      // Gửi mật khẩu & email đăng nhập mới lên backend
      const res = await put('/auth/password', { 
        currentPassword, 
        newPassword,
        newEmail: isTempEmail ? newEmail.trim() : undefined
      });

      // Lưu trữ JWT Token mới ngay lập tức
      if (res.accessToken) {
        await setAuthToken(res.accessToken);
      }

      // Xác định màn hình chuyển tiếp tùy thuộc vào vai trò và trạng thái
      let destination = 'Home';
      let destParams = { user: res.user };

      if (res.user?.role === 'hospital_admin') {
        try {
          const hRes = await get('/api/v1/hospital/me');
          const hStatus = hRes.hospital?.status || hRes.data?.hospital?.status;
          // Nếu bệnh viện vừa mới được cấp (status: provisioned) -> đi đến onboarding
          if (hStatus === 'provisioned') {
            destination = 'HospitalOnboarding';
          } else {
            destination = 'ClinicDashboard';
          }
        } catch (err) {
          console.error('Lỗi kiểm tra trạng thái bệnh viện sau kích hoạt:', err);
          destination = 'HospitalOnboarding'; // Fallback an toàn
        }
      } else if (res.user?.role === 'doctor') {
        destination = 'DoctorWorkQueue';
      } else if (res.user?.role === 'technician') {
        destination = 'TechnicianQueue';
      } else if (res.user?.role === 'admin') {
        destination = 'AdminBackoffice';
      }

      showAlert('success', 'Kích hoạt thành công! 🎉', 'Tài khoản của bạn đã được kích hoạt. Đang chuyển tiếp bạn vào hệ thống...', () => {
        navigation.replace(destination, destParams);
      });
    } catch (err) {
      showAlert('error', 'Kích hoạt thất bại', err.message || 'Mật khẩu tạm thời không chính xác. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Nhân viên';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInner} />
          </View>
          <View>
            <Text style={styles.brandName}>NeuroScan AI</Text>
            <Text style={styles.brandSub}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
          </View>
        </View>

        {/* Form Card wrapper */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.lockBadge}>
              <Text style={styles.lockEmoji}>🔐</Text>
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
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* New Email (only if temporary email) */}
          {isTempEmail && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email đăng nhập chính thức *</Text>
              <Text style={styles.hint}>Nhập email thực của bạn để sử dụng đăng nhập sau này</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="vidu@neuroscan.com"
                  placeholderTextColor="#94A3B8"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>
          )}

          {/* Current (temp) password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu tạm thời *</Text>
            <Text style={styles.hint}>Mật khẩu do Admin cấp cho bạn lúc đầu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập mật khẩu tạm thời"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showCurrent ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* New password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu mới *</Text>
            <Text style={styles.hint}>Tối thiểu 6 ký tự bảo mật</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Đặt mật khẩu mới của bạn"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showNew ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu mới *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Strength indicator */}
          {newPassword.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 8 ? '#16A34A' : newPassword.length >= 6 ? '#D97706' : '#EF4444' }]} />
              <Text style={[styles.strengthText, { color: newPassword.length >= 8 ? '#16A34A' : newPassword.length >= 6 ? '#D97706' : '#EF4444' }]}>
                {newPassword.length >= 8 ? 'Độ bảo mật: Mạnh' : newPassword.length >= 6 ? 'Độ bảo mật: Trung bình' : 'Độ bảo mật: Yếu'}
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.activateBtn, loading && { opacity: 0.7 }]}
            onPress={handleActivate}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.activateBtnText}>Đang xác thực thông tin...</Text>
              </View>
            ) : (
              <Text style={styles.activateBtnText}>Kích hoạt tài khoản & Vào hệ thống →</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityIcon}>🛡️</Text>
          <Text style={styles.securityText}>
            Hệ thống sử dụng cơ chế mã hóa một chiều an toàn (bcrypt) cho mật khẩu. Thông tin tài khoản được bảo mật tuyệt đối theo tiêu chuẩn HIPAA.
          </Text>
        </View>

      </ScrollView>

      {/* Alert Modal */}
      <Modal visible={alert.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={[
              styles.alertIconCircle,
              alert.type === 'success' && { backgroundColor: '#F0FDF4' },
              alert.type === 'error' && { backgroundColor: '#FEF2F2' },
            ]}>
              <Text style={[styles.alertIconText, { color: alert.type === 'success' ? '#16A34A' : '#DC2626' }]}>
                {alert.type === 'success' ? '✓' : '✕'}
              </Text>
            </View>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: alert.type === 'success' ? '#15803D' : '#DC2626' }]}
              onPress={() => {
                setAlert(prev => ({ ...prev, visible: false }));
                if (alert.onClose) alert.onClose();
              }}
            >
              <Text style={styles.alertBtnText}>
                {alert.type === 'success' ? 'Vào hệ thống →' : 'Thử lại'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingHorizontal: 20, paddingVertical: 48, alignItems: 'center' },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  brandName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 9,
    color: '#15803D',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: -2,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 4,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  lockEmoji: { fontSize: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
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
  infoLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 12, color: '#0F172A', fontWeight: 'bold' },
  roleBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#166534' },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 },
  hint: { fontSize: 11, color: '#94A3B8', marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  passwordInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 14, color: '#0F172A' },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 16 },
  strengthBar: { height: 4, width: 60, borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '600' },
  activateBtn: {
    height: 50,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activateBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 24,
    padding: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 420,
  },
  securityIcon: { fontSize: 16 },
  securityText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16 },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { width: 320, backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  alertIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertIconText: { fontSize: 24, fontWeight: 'bold' },
  alertTitle: { fontSize: 17, fontWeight: 'bold', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  alertBtn: { width: '100%', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});

export default ActivateAccountScreen;
