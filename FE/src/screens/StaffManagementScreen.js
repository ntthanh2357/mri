import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post, put } from '../services/api.service';

const ROLE_LABELS = {
  doctor: 'Bác sĩ',
  nurse: 'Điều dưỡng & Lễ tân',
  technician: 'Kỹ thuật viên',
};

export default function StaffManagementScreen({ navigation }) {
  const [activeRoleTab, setActiveRoleTab] = useState('doctor');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [hospitalStaff, setHospitalStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await get('/auth/me');
      if (res && res.user) {
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Lỗi lấy thông tin admin:', err);
    }
  };

  const fetchHospitalStaff = async () => {
    setLoadingStaff(true);
    try {
      const res = await get('/api/v1/hospital/staff');
      if (res && res.success) {
        setHospitalStaff(res.staff || []);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách nhân viên:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách nhân sự.');
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchHospitalStaff();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      Alert.alert('Yêu cầu', 'Vui lòng nhập đầy đủ các trường thông tin.');
      return;
    }
    setCreatingUser(true);
    try {
      const response = await post('/auth/register', {
        email: newUserEmail.trim(),
        password: newUserPassword,
        name: newUserName.trim(),
        role: activeRoleTab,
        hospitalId: currentUser?.hospitalId || undefined,
      });

      if (response.success || response.user) {
        Alert.alert('Thành công', `Đã cấp tài khoản thành công cho ${newUserName} (${ROLE_LABELS[activeRoleTab].toUpperCase()})!`);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        fetchHospitalStaff();
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể tạo tài khoản.');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleLock = async (staffId, email, isLocked) => {
    const actionText = isLocked ? 'MỞ KHÓA' : 'KHÓA';
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn ${actionText.toLowerCase()} tài khoản ${email}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: actionText,
          style: isLocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await put(`/api/v1/hospital/staff/${staffId}/toggle-lock`, {});
              if (res && res.success) {
                Alert.alert('Thành công', `Đã ${isLocked ? 'mở khóa' : 'khóa'} tài khoản ${email}.`);
                fetchHospitalStaff();
              }
            } catch (err) {
              console.error('Lỗi khi thay đổi trạng thái khóa:', err);
              Alert.alert('Lỗi', err.message || 'Thay đổi trạng thái thất bại.');
            }
          },
        },
      ]
    );
  };

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const filteredStaff = hospitalStaff.filter((s) => {
    const isRole = s.role === activeRoleTab;
    const matchesSearch =
      !searchQuery.trim() ||
      s.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return isRole && matchesSearch;
  });

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="StaffManagement">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Quản trị & Cấp tài khoản nhân sự</Text>
            <Text style={styles.subtitle}>
              Cấp tài khoản làm việc, phân quyền chức danh và quản lý trạng thái hoạt động của nhân viên cơ sở.
            </Text>
          </View>

          {/* Tab buttons */}
          <View style={styles.tabBar}>
            {Object.keys(ROLE_LABELS).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.tabButton, activeRoleTab === role && styles.tabButtonActive]}
                onPress={() => setActiveRoleTab(role)}
              >
                <Text style={[styles.tabText, activeRoleTab === role && styles.tabTextActive]}>
                  {role === 'doctor' ? '🩺 Bác sĩ' : role === 'nurse' ? '🏥 Điều dưỡng & Lễ tân' : '🔬 Kỹ thuật viên'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Grid Layout */}
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Form Column */}
            <View style={isDesktop ? styles.formColumn : styles.fullWidth}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>➕ Cấp tài khoản {ROLE_LABELS[activeRoleTab]} mới</Text>
                <Text style={styles.cardSub}>Điền đầy đủ thông tin để cấp tài khoản. Tài khoản mới sẽ ở trạng thái chờ kích hoạt.</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Họ và tên nhân viên *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Ví dụ: ${
                      activeRoleTab === 'doctor'
                        ? 'Bác sĩ Lê Mạnh Minh'
                        : activeRoleTab === 'nurse'
                        ? 'Điều dưỡng Nguyễn Thị Hà'
                        : 'KTV Trần Văn Hùng'
                    }`}
                    placeholderTextColor="#94A3B8"
                    value={newUserName}
                    onChangeText={setNewUserName}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Địa chỉ Email *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="email@benhvien.vn"
                    placeholderTextColor="#94A3B8"
                    value={newUserEmail}
                    onChangeText={setNewUserEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mật khẩu ban đầu *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập từ 6 ký tự trở lên"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={newUserPassword}
                    onChangeText={setNewUserPassword}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, creatingUser && styles.buttonDisabled]}
                  onPress={handleCreateUser}
                  disabled={creatingUser}
                >
                  {creatingUser ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>💾 Tạo tài khoản {ROLE_LABELS[activeRoleTab]}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* List Column */}
            <View style={isDesktop ? styles.listColumn : styles.fullWidth}>
              <View style={styles.card}>
                <View style={styles.listHeader}>
                  <Text style={styles.cardTitle}>📋 Danh sách {ROLE_LABELS[activeRoleTab]} hiện có</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm kiếm theo tên, email..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {loadingStaff ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="medium" color={Colors.primary} />
                  </View>
                ) : filteredStaff.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Chưa có tài khoản {ROLE_LABELS[activeRoleTab]} nào phù hợp.</Text>
                  </View>
                ) : (
                  <View style={styles.staffList}>
                    {filteredStaff.map((item) => {
                      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—';
                      return (
                        <View key={item.email} style={styles.staffItem}>
                          <View style={styles.staffInfo}>
                            <Text style={styles.staffName}>{item.profile?.name || 'Nhân viên'}</Text>
                            <Text style={styles.staffEmail}>{item.email}</Text>
                            <Text style={styles.staffDate}>Ngày tạo: {dateStr}</Text>
                          </View>
                          
                          <View style={styles.staffActions}>
                            <View style={[
                              styles.statusBadge,
                              item.isLocked ? styles.badgeLocked : item.isVerified ? styles.badgeActive : styles.badgePending
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                item.isLocked ? styles.textLocked : item.isVerified ? styles.textActive : styles.textPending
                              ]}>
                                {item.isLocked ? 'Đã khóa' : item.isVerified ? 'Hoạt động' : 'Chờ kích hoạt'}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => handleToggleLock(item._id, item.email, item.isLocked)}
                              style={[styles.lockButton, item.isLocked ? styles.unlockButton : styles.lockButton]}
                            >
                              <Text style={styles.lockButtonText}>
                                {item.isLocked ? '🔓 Mở khóa' : '🔒 Khóa'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, gap: 20 },
  titleContainer: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 0, marginBottom: 16 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 8 },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#15803D' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#15803D', fontWeight: 'bold' },
  desktopRow: { flexDirection: 'row', gap: 20 },
  mobileColumn: { flexDirection: 'column', gap: 20 },
  formColumn: { flex: 1 },
  listColumn: { flex: 1.5 },
  fullWidth: { width: '100%' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderHeight: 1, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  cardSub: { fontSize: 11, color: '#64748B', marginBottom: 16, lineHeight: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  input: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC', color: '#0F172A' },
  submitButton: { height: 40, backgroundColor: '#15803D', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  listHeader: { flexDirection: 'column', gap: 10, marginBottom: 16 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 12, backgroundColor: '#F8FAFC', color: '#0F172A' },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { paddingVertical: 40, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 },
  emptyText: { color: '#94A3B8', fontSize: 12 },
  staffList: { gap: 8 },
  staffItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10 },
  staffInfo: { flex: 1, marginRight: 10 },
  staffName: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  staffEmail: { fontSize: 11, color: '#64748B', marginTop: 1 },
  staffDate: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  staffActions: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeLocked: { backgroundColor: '#FEE2E2' },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgePending: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  textLocked: { color: '#991B1B' },
  textActive: { color: '#166534' },
  textPending: { color: '#B45309' },
  lockButton: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, backgroundColor: '#FFFFFF' },
  unlockButton: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  lockButtonText: { fontSize: 10, fontWeight: '600', color: '#475569' },
});
