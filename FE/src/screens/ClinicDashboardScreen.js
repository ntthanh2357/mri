import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { post } from '../services/api.service';

const ClinicDashboardScreen = ({ navigation }) => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('doctor');
  const [creatingUser, setCreatingUser] = useState(false);

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      Alert.alert('Yêu cầu', 'Vui lòng nhập đầy đủ các trường thông tin.');
      return;
    }
    setCreatingUser(true);
    try {
      const response = await post('/auth/register', {
        email: newUserEmail,
        password: newUserPassword,
        name: newUserName,
        role: newUserRole,
      });

      if (response.success || response.user) {
        Alert.alert('Thành công', `Đã cấp tài khoản thành công cho ${newUserName} (${newUserRole.toUpperCase()})!`);
        setShowAddUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
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

  const demographics = [
    { name: 'Người lớn (18–60)', value: 75, color: '#15803D' },
    { name: 'Người cao tuổi (60+)', value: 20, color: '#475569' },
    { name: 'Nhi khoa', value: 5, color: '#CBD5E1' },
  ];

  const recentActivity = [
    { id: 'NS-2401', doctor: 'Bs. Minh', scanType: 'MRI Não', status: 'Hoàn thành', time: '2 phút trước', isSuccess: true },
    { id: 'NS-2400', doctor: 'Bs. Lan', scanType: 'CT Đầu', status: 'Đang xử lý', time: '8 phút trước', isSuccess: false },
    { id: 'NS-2399', doctor: 'Bs. Hùng', scanType: 'MRI Cột sống', status: 'Hoàn thành', time: '15 phút trước', isSuccess: true },
  ];

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="ClinicDashboard"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Bảng điều khiển chính</Text>
            </TouchableOpacity>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Bảng điều khiển Phòng khám</Text>
          <Text style={styles.subtitle}>Chào mừng trở lại, Bs. Vane. Đây là tổng quan phòng khám.</Text>
        </View>

        <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
          {/* Left Column (flex: 2) */}
          <View style={isDesktop ? styles.leftColumn : styles.fullWidth}>
            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButtonOutline} onPress={() => Alert.alert('Thông báo', 'Đang tải sao kê về điện thoại...')}>
                <Text style={styles.actionButtonOutlineText}>📥 Xuất sao kê</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButtonSolid} onPress={() => setShowAddUserModal(true)}>
                <Text style={styles.actionButtonSolidText}>👤 Cấp tài khoản nhân sự</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.actionButtonSolid, { width: '100%', marginBottom: 20, backgroundColor: '#0F172A' }]} onPress={() => navigation.navigate('EMRDashboard')}>
              <Text style={styles.actionButtonSolidText}>🏥 Quản lý EMR</Text>
            </TouchableOpacity>

            {/* Stats Section */}
            <View style={styles.statsContainer}>
              {/* Patients Metric */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statEmojiIcon}>👥</Text>
                </View>
                <Text style={styles.statLabel}>Tổng số bệnh nhân</Text>
                <Text style={styles.statValue}>1,284</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>+12% vs tháng trước</Text>
                </View>
              </View>

              {/* AI Scans Metric */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.statEmojiIcon}>🧠</Text>
                </View>
                <Text style={styles.statLabel}>Tổng số lượt quét AI</Text>
                <Text style={styles.statValue}>8,432</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>+8% hôm nay</Text>
                </View>
              </View>
            </View>

            {/* Dark Wallet Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <View>
                  <Text style={styles.walletTitle}>Số dư ví hiện tại</Text>
                  <Text style={styles.walletBalance}>2.500.000đ</Text>
                </View>
                <TouchableOpacity style={styles.walletDepositBtn} onPress={() => navigation.navigate('Financials')}>
                  <Text style={styles.walletDepositText}>Nạp tiền</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.walletFooter}>
                <View style={styles.walletFooterItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.walletFooterText}>Đã bật tự động nạp</Text>
                </View>
                <View style={styles.walletFooterItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#64748B' }]} />
                  <Text style={styles.walletFooterText}>Chu kỳ: 15 Th10</Text>
                </View>
              </View>
            </View>

            {/* Recent Activity Section */}
            <View style={styles.recentSectionHeader}>
              <Text style={styles.sectionTitle}>Hoạt động gần đây</Text>
              <TouchableOpacity onPress={() => navigation.navigate('PatientRecords')}>
                <Text style={styles.viewAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.activityCard}>
              {recentActivity.map((activity, index) => (
                <View key={activity.id} style={[styles.activityRow, index === recentActivity.length - 1 && styles.lastActivityRow]}>
                  <View style={styles.activityLeft}>
                    <Text style={styles.patientId}>{activity.id}</Text>
                    <Text style={styles.activitySub}>{activity.doctor} • {activity.scanType}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <View style={[styles.statusBadge, activity.isSuccess ? styles.statusSuccess : styles.statusPending]}>
                      <Text style={[styles.statusBadgeText, activity.isSuccess ? styles.statusSuccessText : styles.statusPendingText]}>
                        {activity.status}
                      </Text>
                    </View>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Right Column (flex: 1) */}
          <View style={isDesktop ? styles.rightColumn : styles.fullWidth}>
            {/* Demographic Section */}
            <Text style={styles.sectionTitle}>Nhân khẩu học bệnh nhân</Text>
            <View style={styles.demographicCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalVal}>1.2k</Text>
                <Text style={styles.totalLabel}>TỔNG CỘNG</Text>
              </View>

              <View style={styles.barChartContainer}>
                {demographics.map((item, idx) => (
                  <View key={idx} style={styles.demographicRow}>
                    <View style={styles.demographicLabelRow}>
                      <View style={styles.demographicNameContainer}>
                        <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                        <Text style={styles.demographicName}>{item.name}</Text>
                      </View>
                      <Text style={styles.demographicPct}>{item.value}%</Text>
                    </View>
                    <View style={styles.barBackground}>
                      <View style={[styles.barForeground, { width: `${item.value}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Info Banner */}
            <View style={styles.bannerCard}>
              <Text style={styles.bannerCategory}>NGHIÊN CỨU TIÊN TIẾN</Text>
              <Text style={styles.bannerTitle}>Sách trắng kết nối thần kinh 2024</Text>
              <TouchableOpacity onPress={() => Alert.alert('Tài liệu y khoa', 'Tính năng đọc sách trắng sẽ khả dụng ở phiên bản tiếp theo.')}>
                <Text style={styles.bannerLink}>Đọc thêm →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
        <Modal
          visible={showAddUserModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddUserModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#FFFFFF', width: isDesktop ? 480 : '100%', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 }}>Cấp tài khoản nhân sự phòng khám</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Nhập thông tin chi tiết của nhân viên y tế để tạo tài khoản trực tiếp.</Text>

              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Họ và tên *</Text>
              <TextInput
                style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 13 }}
                placeholder="Ví dụ: Bác sĩ Lê Mạnh Minh"
                value={newUserName}
                onChangeText={setNewUserName}
              />

              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Địa chỉ Email *</Text>
              <TextInput
                style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 13 }}
                placeholder="email@benhvien.vn"
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Mật khẩu ban đầu *</Text>
              <TextInput
                style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 13 }}
                placeholder="Nhập mật khẩu từ 6 ký tự"
                secureTextEntry
                value={newUserPassword}
                onChangeText={setNewUserPassword}
                autoCapitalize="none"
              />

              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Vai trò công việc *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {['doctor', 'nurse', 'technician'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: newUserRole === role ? '#15803D' : '#F1F5F9',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    onPress={() => setNewUserRole(role)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: newUserRole === role ? '#FFFFFF' : '#475569' }}>
                      {role === 'doctor' ? 'Bác sĩ' : role === 'nurse' ? 'Y tá' : 'KTV'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setShowAddUserModal(false)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, height: 40, backgroundColor: '#15803D', borderRadius: 8, justifyContent: 'center', alignItems: 'center', opacity: creatingUser ? 0.7 : 1 }}
                  onPress={handleCreateUser}
                  disabled={creatingUser}
                >
                  {creatingUser ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>Tạo tài khoản</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButtonOutline: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonOutlineText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonSolid: {
    flex: 1,
    height: 44,
    backgroundColor: '#15803D',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonSolidText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statEmojiIcon: {
    fontSize: 18,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '600',
  },
  walletCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 16,
    marginBottom: 12,
  },
  walletTitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  walletBalance: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  walletDepositBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  walletDepositText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  walletFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  walletFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  walletFooterText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  demographicCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  totalRow: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  totalVal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  totalLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  barChartContainer: {
    gap: 12,
  },
  demographicRow: {
    width: '100%',
  },
  demographicLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  demographicNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  demographicName: {
    fontSize: 12,
    color: '#475569',
  },
  demographicPct: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  barBackground: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barForeground: {
    height: '100%',
    borderRadius: 3,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastActivityRow: {
    borderBottomWidth: 0,
  },
  activityLeft: {
    flex: 1,
  },
  patientId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  activitySub: {
    fontSize: 11,
    color: '#64748B',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusSuccessText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  statusPendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  activityTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  bannerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerCategory: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4ADE80',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 22,
  },
  bannerLink: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '600',
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
  },
  mobileColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  leftColumn: {
    flex: 2,
  },
  rightColumn: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
});

export default ClinicDashboardScreen;
