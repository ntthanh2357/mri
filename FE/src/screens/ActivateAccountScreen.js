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
import { put, setAuthToken } from '../services/api.service';

const ROLE_LABELS = {
  doctor: 'Bác sĩ',
  nurse: 'Điều dưỡng / Y tá',
  technician: 'Kỹ thuật viên',
  receptionist: 'Lễ tân',
  hospital_admin: 'Admin Bệnh viện',
};

const ActivateAccountScreen = ({ route, navigation }) => {
  const { user, accessToken } = route.params || {};

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '', onClose: null });

  const showAlert = (type, title, message, onClose = null) =>
    setAlert({ visible: true, type, title, message, onClose });

  const handleActivate = async () => {
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
      // Token đã được lưu từ LoginScreen trước khi navigate sang đây
      const res = await put('/auth/password', { currentPassword, newPassword });
      showAlert('success', 'Kích hoạt thành công! 🎉', 'Tài khoản của bạn đã được kích hoạt. Bạn có thể bắt đầu sử dụng hệ thống.', () => {
        // Navigate to the correct home based on role
        const role = user?.role;
        if (role === 'hospital_admin') {
          navigation.replace('ClinicDashboard');
        } else {
          navigation.replace('Home');
        }
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerBadge}>
          <Text style={styles.headerEmoji}>🔐</Text>
        </View>
        <Text style={styles.title}>Kích hoạt tài khoản</Text>
        <Text style={styles.subtitle}>
          Tài khoản của bạn đã được Admin tạo sẵn. Hãy đặt mật khẩu mới để kích hoạt và bắt đầu sử dụng.
        </Text>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Vai trò</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Current (temp) password */}
          <Text style={styles.label}>Mật khẩu tạm thời *</Text>
          <Text style={styles.hint}>Mật khẩu do Admin cấp cho bạn</Text>
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

          {/* New password */}
          <Text style={styles.label}>Mật khẩu mới *</Text>
          <Text style={styles.hint}>Tối thiểu 6 ký tự</Text>
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

          {/* Confirm password */}
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

          {/* Strength indicator */}
          {newPassword.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 8 ? '#15803D' : newPassword.length >= 6 ? '#D97706' : '#EF4444' }]} />
              <Text style={[styles.strengthText, { color: newPassword.length >= 8 ? '#15803D' : newPassword.length >= 6 ? '#D97706' : '#EF4444' }]}>
                {newPassword.length >= 8 ? 'Mạnh' : newPassword.length >= 6 ? 'Trung bình' : 'Yếu'}
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
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.activateBtnText}>Kích hoạt tài khoản →</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityIcon}>🛡️</Text>
          <Text style={styles.securityText}>
            Mật khẩu của bạn được mã hóa an toàn (bcrypt). Admin không thể xem mật khẩu sau khi kích hoạt.
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
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  scroll: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  headerBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 3, borderColor: '#BBF7D0',
  },
  headerEmoji: { fontSize: 32 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, maxWidth: 340 },
  infoCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#0F172A', fontWeight: 'bold' },
  roleBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#166534' },
  form: { width: '100%', maxWidth: 400 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 3 },
  hint: { fontSize: 11, color: '#94A3B8', marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    backgroundColor: '#FFFFFF', marginBottom: 16, overflow: 'hidden',
  },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 14, color: '#0F172A' },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 18 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 16 },
  strengthBar: { height: 4, width: 60, borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '600' },
  activateBtn: {
    height: 52, backgroundColor: '#15803D', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: '#15803D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
    elevation: 4,
  },
  activateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 24, padding: 12, backgroundColor: '#F8FAFC',
    borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', maxWidth: 400,
  },
  securityIcon: { fontSize: 16 },
  securityText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },
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
