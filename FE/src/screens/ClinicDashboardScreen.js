import React, { useState, useEffect } from 'react';
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
import { post, get } from '../services/api.service';
import styles from './ClinicDashboardScreen.styles';

const ClinicDashboardScreen = ({ navigation }) => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState('doctor');
  const [creatingUser, setCreatingUser] = useState(false);

  const [hospitalStaff, setHospitalStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const ROLE_LABELS = {
    doctor: 'Bác sĩ',
    nurse: 'Điều dưỡng & Lễ tân',
    technician: 'Kỹ thuật viên'
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
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleOpenStaffModal = () => {
    fetchHospitalStaff();
    setShowAddUserModal(true);
  };

  // Dynamic dashboard states
  const [currentUser, setCurrentUser] = useState(null);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [demographics, setDemographics] = useState([
    { name: 'Người lớn (18–60)', value: 0, color: '#15803D' },
    { name: 'Người cao tuổi (60+)', value: 0, color: '#475569' },
    { name: 'Nhi khoa', value: 0, color: '#CBD5E1' },
  ]);
  const [loadingStats, setLoadingStats] = useState(true);

  // New hospital operations statistics
  const [totalPatientsToday, setTotalPatientsToday] = useState(0);
  const [statusDistribution, setStatusDistribution] = useState({});
  const [aiProcessedCount, setAiProcessedCount] = useState(0);
  const [revenue, setRevenue] = useState({ totalRevenue: 0, aiRevenue: 0 });
  const [examFee, setExamFee] = useState('150000');
  const [mriFee, setMriFee] = useState('1500000');
  const [aiFee, setAiFee] = useState('200000');
  const [maxPatients, setMaxPatients] = useState('50');
  const [updatingPricing, setUpdatingPricing] = useState(false);

  const fetchDashboardData = async () => {
    setLoadingStats(true);
    try {
      // 1. Fetch current user
      const userRes = await get('/auth/me');
      if (userRes && userRes.user) {
        setCurrentUser(userRes.user);
      }

      // 2. Fetch hospital-specific stats
      const statsRes = await get('/admin/dashboard');
      if (statsRes && statsRes.success) {
        setTotalPatients(statsRes.totalPatients ?? 0);
        setTotalScans(statsRes.totalScans ?? 0);
        setTotalPatientsToday(statsRes.totalPatientsToday ?? 0);
        setStatusDistribution(statsRes.statusDistribution ?? {});
        setAiProcessedCount(statsRes.aiProcessedCount ?? 0);
        setRevenue(statsRes.revenue ?? { totalRevenue: 0, aiRevenue: 0 });

        if (statsRes.demographics) {
          setDemographics(statsRes.demographics);
        }
        if (statsRes.recentActivity) {
          setRecentActivity(statsRes.recentActivity);
        }
        if (statsRes.pricing) {
          setExamFee(String(statsRes.pricing.examFee ?? 150000));
          setMriFee(String(statsRes.pricing.mriFee ?? 1500000));
          setAiFee(String(statsRes.pricing.aiFee ?? 200000));
          setMaxPatients(String(statsRes.pricing.maxPatients ?? 50));
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin tổng quan phòng khám:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchHospitalStaff();
  }, []);

  const handleUpdatePricing = async () => {
    const parsedExam = Number(examFee);
    const parsedMri = Number(mriFee);
    const parsedAi = Number(aiFee);
    const parsedMax = Number(maxPatients);

    if (isNaN(parsedExam) || isNaN(parsedMri) || isNaN(parsedAi) || isNaN(parsedMax)) {
      Alert.alert('Lỗi', 'Bảng giá dịch vụ và số bệnh nhân tối đa phải là chữ số hợp lệ.');
      return;
    }

    setUpdatingPricing(true);
    try {
      const { put } = require('../services/api.service');
      const response = await put('/admin/hospital-pricing', {
        examFee: parsedExam,
        mriFee: parsedMri,
        aiFee: parsedAi,
        maxPatients: parsedMax
      });

      if (response && response.success) {
        Alert.alert('Thành công', 'Cập nhật cấu hình bệnh viện thành công!');
        if (response.pricing) {
          setExamFee(String(response.pricing.examFee));
          setMriFee(String(response.pricing.mriFee));
          setAiFee(String(response.pricing.aiFee));
          setMaxPatients(String(response.pricing.maxPatients ?? 50));
        }
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể cập nhật cấu hình.');
      }
    } catch (err) {
      console.error('Error updating hospital pricing:', err);
      Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.');
    } finally {
      setUpdatingPricing(false);
    }
  };

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
        role: activeRoleTab,
        hospitalId: currentUser?.hospitalId || undefined,
      });

      if (response.success || response.user) {
        Alert.alert('Thành công', `Đã cấp tài khoản thành công cho ${newUserName} (${ROLE_LABELS[activeRoleTab].toUpperCase()})!`);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        // Refresh stats and staff list
        fetchDashboardData();
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
            <Text style={styles.subtitle}>
              Chào mừng trở lại, Bs. {currentUser?.profile?.name || currentUser?.email || 'Bác sĩ'}. Đây là tổng quan phòng khám.
            </Text>
          </View>

          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column (flex: 2) */}
            <View style={isDesktop ? styles.leftColumn : styles.fullWidth}>
              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButtonOutline} onPress={() => navigation.navigate('Financials')}>
                  <Text style={styles.actionButtonOutlineText}>📊 Báo cáo Tài chính</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButtonSolid} onPress={() => navigation.navigate('StaffManagement')}>
                  <Text style={styles.actionButtonSolidText}>👤 Quản lý & Cấp tài khoản nhân sự</Text>
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
                  {loadingStats ? (
                    <ActivityIndicator size="small" color="#15803D" style={{ marginVertical: 6 }} />
                  ) : (
                    <Text style={styles.statValue}>{totalPatients}</Text>
                  )}
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>Hoạt động thực tế</Text>
                  </View>
                </View>

                {/* AI Scans Metric */}
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={styles.statEmojiIcon}>🧠</Text>
                  </View>
                  <Text style={styles.statLabel}>Tổng số lượt quét AI</Text>
                  {loadingStats ? (
                    <ActivityIndicator size="small" color="#15803D" style={{ marginVertical: 6 }} />
                  ) : (
                    <Text style={styles.statValue}>{totalScans}</Text>
                  )}
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>Từ dữ liệu quét thật</Text>
                  </View>
                </View>
              </View>

              {/* Daily Operational Stats Card */}
              <View style={styles.walletCard}>
                <View style={styles.walletHeader}>
                  <View>
                    <Text style={styles.walletTitle}>Doanh thu hôm nay (lũy kế)</Text>
                    <Text style={styles.walletBalance}>
                      {loadingStats ? '...' : (revenue.totalRevenue ? revenue.totalRevenue.toLocaleString('vi-VN') + 'đ' : '0đ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.walletTitle, { color: '#4ADE80' }]}>Doanh thu AI hôm nay</Text>
                    <Text style={[styles.walletBalance, { fontSize: 18, color: '#4ADE80' }]}>
                      {loadingStats ? '...' : (revenue.aiRevenue ? revenue.aiRevenue.toLocaleString('vi-VN') + 'đ' : '0đ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.walletFooter}>
                  <View style={styles.walletFooterItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#4ADE80' }]} />
                    <Text style={styles.walletFooterText}>Ca phân tích AI: {aiProcessedCount || 0}</Text>
                  </View>
                  <View style={styles.walletFooterItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#60A5FA' }]} />
                    <Text style={styles.walletFooterText}>Tiếp đón hôm nay: {totalPatientsToday || 0}</Text>
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
                {loadingStats ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#15803D" />
                  </View>
                ) : recentActivity.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có hoạt động nào gần đây.</Text>
                  </View>
                ) : (
                  recentActivity.map((activity, index) => (
                    <View key={activity.id} style={[styles.activityRow, index === recentActivity.length - 1 && styles.lastActivityRow]}>
                      <View style={styles.activityLeft}>
                        <Text style={styles.patientId}>Ca #{activity.id} - {activity.patientName}</Text>
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
                  ))
                )}
              </View>
            </View>

            {/* Right Column (flex: 1) */}
            <View style={isDesktop ? styles.rightColumn : styles.fullWidth}>
              {/* Demographic Section */}
              <Text style={styles.sectionTitle}>Nhân khẩu học bệnh nhân</Text>
              <View style={styles.demographicCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalVal}>{totalPatients}</Text>
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

              {/* Bảng giá dịch vụ Bệnh viện */}
              <Text style={styles.sectionTitle}>Bảng giá dịch vụ</Text>
              <View style={styles.pricingCard}>
                <Text style={styles.pricingDesc}>Cấu hình giá dịch vụ áp dụng cho hóa đơn khám chữa bệnh tại cơ sở của bạn.</Text>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.pricingInputLabel}>Phí khám lâm sàng (đ)</Text>
                  <TextInput
                    style={styles.pricingInput}
                    keyboardType="numeric"
                    value={examFee}
                    onChangeText={setExamFee}
                    placeholder="Ví dụ: 150000"
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.pricingInputLabel}>Phí chụp phim MRI (đ)</Text>
                  <TextInput
                    style={styles.pricingInput}
                    keyboardType="numeric"
                    value={mriFee}
                    onChangeText={setMriFee}
                    placeholder="Ví dụ: 1500000"
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.pricingInputLabel}>Phí phân tích tự động AI (đ)</Text>
                  <TextInput
                    style={styles.pricingInput}
                    keyboardType="numeric"
                    value={aiFee}
                    onChangeText={setAiFee}
                    placeholder="Ví dụ: 200000"
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.pricingInputLabel}>Số bệnh nhân tối đa trong ngày</Text>
                  <TextInput
                    style={styles.pricingInput}
                    keyboardType="numeric"
                    value={maxPatients}
                    onChangeText={setMaxPatients}
                    placeholder="Ví dụ: 50"
                  />
                </View>

                <TouchableOpacity
                  style={styles.pricingSubmitBtn}
                  onPress={handleUpdatePricing}
                  disabled={updatingPricing}
                >
                  {updatingPricing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.pricingSubmitBtnText}>💾 Cập nhật cấu hình</Text>
                  )}
                </TouchableOpacity>
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
            <View style={{ backgroundColor: '#FFFFFF', width: isDesktop ? 680 : '100%', maxHeight: '90%', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, overflow: 'hidden' }}>

              {/* Modal Header */}
              <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>Quản lý & Cấp tài khoản nhân sự</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Phân quyền và cấp tài khoản làm việc cho từng chức vụ.</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddUserModal(false)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#94A3B8' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Roles Tabs Bar */}
              <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16, paddingTop: 10 }}>
                {Object.keys(ROLE_LABELS).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 10,
                      borderBottomWidth: 2,
                      borderBottomColor: activeRoleTab === role ? '#15803D' : 'transparent',
                      marginRight: 8,
                    }}
                    onPress={() => setActiveRoleTab(role)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: activeRoleTab === role ? '#15803D' : '#64748B' }}>
                      {role === 'doctor' ? '🩺 Bác sĩ' : role === 'nurse' ? '🏥 Điều dưỡng' : role === 'technician' ? '🔬 Kỹ thuật viên' : '💼 Lễ tân'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={{ padding: 20 }}>

                {/* Form Section */}
                <View style={{ marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 14 }}>
                    ➕ Cấp tài khoản {ROLE_LABELS[activeRoleTab]} mới
                  </Text>

                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, marginBottom: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Họ và tên *</Text>
                      <TextInput
                        style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                        placeholder={`Ví dụ: ${activeRoleTab === 'doctor' ? 'Bác sĩ Lê Mạnh Minh' : activeRoleTab === 'nurse' ? 'Y tá Nguyễn Thị Hà' : activeRoleTab === 'technician' ? 'KTV Trần Văn Hùng' : 'Lễ tân Vũ Hoài An'}`}
                        value={newUserName}
                        onChangeText={setNewUserName}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Địa chỉ Email *</Text>
                      <TextInput
                        style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                        placeholder="email@benhvien.vn"
                        value={newUserEmail}
                        onChangeText={setNewUserEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Mật khẩu ban đầu *</Text>
                      <TextInput
                        style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                        placeholder="Nhập từ 6 ký tự"
                        secureTextEntry
                        value={newUserPassword}
                        onChangeText={setNewUserPassword}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      <TouchableOpacity
                        style={{ height: 40, backgroundColor: '#15803D', borderRadius: 8, justifyContent: 'center', alignItems: 'center', opacity: creatingUser ? 0.7 : 1 }}
                        onPress={handleCreateUser}
                        disabled={creatingUser}
                      >
                        {creatingUser ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>💾 Tạo tài khoản {ROLE_LABELS[activeRoleTab]}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* List Section */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 12 }}>
                    📋 Danh sách {ROLE_LABELS[activeRoleTab]} hiện tại ({hospitalStaff.filter(s => s.role === activeRoleTab).length})
                  </Text>

                  {loadingStaff ? (
                    <ActivityIndicator size="small" color="#15803D" style={{ marginVertical: 20 }} />
                  ) : hospitalStaff.filter(s => s.role === activeRoleTab).length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 }}>
                      <Text style={{ color: '#94A3B8', fontSize: 13 }}>Chưa có tài khoản {ROLE_LABELS[activeRoleTab]} nào được cấp.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {hospitalStaff
                        .filter(s => s.role === activeRoleTab)
                        .map((s) => {
                          const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '—';
                          return (
                            <View key={s.email} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10 }}>
                              <View>
                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }}>{s.profile?.name || 'Nhân viên'}</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{s.email}</Text>
                                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Ngày tạo: {dateStr}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: s.isLocked ? '#FEE2E2' : s.isVerified ? '#DCFCE7' : '#FEF3C7'
                                }}>
                                  <Text style={{
                                    fontSize: 10,
                                    fontWeight: '600',
                                    color: s.isLocked ? '#991B1B' : s.isVerified ? '#166534' : '#B45309'
                                  }}>
                                    {s.isLocked ? 'Đã khóa' : s.isVerified ? 'Hoạt động' : 'Chờ kích hoạt'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Modal Footer */}
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#F8FAFC', flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  style={{ height: 36, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}
                  onPress={() => setShowAddUserModal(false)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};



export default ClinicDashboardScreen;
