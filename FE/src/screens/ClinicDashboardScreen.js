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
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Layout from '../constants/layout';

// "PGS.TS Vũ Đình Hoàng (Giám đốc …)" → "PGS.TS Vũ Đình Hoàng"
const shortName = (name = '') => String(name).replace(/\s*\(.*\)\s*$/, '').trim();
const fmtVnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
import { Stethoscope, HeartPulse, Microscope, Briefcase, UserPlus, List, Save, X } from 'lucide-react';

const getRoleBadgeStyle = (role) => {
  switch (role) {
    case 'doctor':
      return { bg: '#EFF6FF', text: '#1E40AF', label: 'Bác sĩ' };
    case 'nurse':
      return { bg: Colors.brandGreenSoft, text: Colors.brandGreenPressed, label: 'Điều dưỡng' };
    case 'technician':
      return { bg: '#F5F3FF', text: '#5B21B6', label: 'Kỹ thuật viên' };
    case 'receptionist':
      return { bg: '#FFF7ED', text: '#9A3412', label: 'Lễ tân' };
    default:
      return { bg: '#F1F5F9', text: '#475569', label: 'Nhân sự' };
  }
};

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
    nurse: 'Điều dưỡng',
    technician: 'Kỹ thuật viên',
    receptionist: 'Lễ tân'
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
    { name: 'Người lớn (18–60)', value: 0, color: Colors.brandGreen },
    { name: 'Người cao tuổi (60+)', value: 0, color: '#475569' },
    { name: 'Nhi khoa', value: 0, color: '#CBD5E1' },
  ]);
  const [loadingStats, setLoadingStats] = useState(true);

  // New hospital operations statistics
  const [totalPatientsToday, setTotalPatientsToday] = useState(0);
  const [statusDistribution, setStatusDistribution] = useState({});
  const [aiProcessedCount, setAiProcessedCount] = useState(0);
  const [revenue, setRevenue] = useState({ totalRevenue: 0, aiRevenue: 0 });

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
        if (statsRes.recentActivity) {
          setRecentActivity(statsRes.recentActivity);
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
  const isWide = width >= Layout.wide;


  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="ClinicDashboard"
    >
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <PageContainer style={styles.page}>
            <PageHeader
              title="Tổng quan bệnh viện"
              subtitle={`Chào ${shortName(currentUser?.profile?.name) || 'bạn'} · tình hình vận hành hôm nay.`}
              actions={<HeaderAction icon="refresh-cw" label="Làm mới" onPress={() => { fetchDashboardData(); fetchHospitalStaff(); }} />}
            />

            {/* Chỉ số chính: 1 số nổi bật (tiếp nhận hôm nay), còn lại nhỏ hơn kèm ngữ cảnh */}
            <View style={[styles.kpiStrip, !isWide && styles.kpiStripWrap]}>
              {[
                { key: 'today', label: 'Tiếp nhận hôm nay', value: totalPatientsToday || 0, sub: `${aiProcessedCount || 0} ca có phân tích AI`, main: true },
                { key: 'revenue', label: 'Doanh thu hôm nay', value: fmtVnd(revenue.totalRevenue), sub: `Từ AI: ${fmtVnd(revenue.aiRevenue)}` },
                { key: 'patients', label: 'Tổng bệnh nhân', value: totalPatients, sub: 'Đã có hồ sơ tại viện' },
                { key: 'scans', label: 'Lượt quét AI', value: totalScans, sub: 'Tính từ khi triển khai' },
              ].map((k, i) => (
                <View
                  key={k.key}
                  style={[
                    styles.kpi,
                    isWide ? styles.kpiFill : styles.kpiHalf,
                    k.main && styles.kpiMain,
                    isWide ? i > 0 && styles.kpiBorderLeft : [i % 2 === 1 && styles.kpiBorderLeft, i > 1 && styles.kpiBorderTop],
                  ]}
                >
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                  {loadingStats ? (
                    <ActivityIndicator size="small" color={Colors.brandGreen} style={styles.kpiLoading} />
                  ) : (
                    <Text style={[styles.kpiValue, k.main && styles.kpiValueMain]} numberOfLines={1}>{k.value}</Text>
                  )}
                  <Text style={styles.kpiSub}>{k.sub}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.columns, isWide && styles.columnsWide]}>
              <View style={isWide ? styles.colMain : null}>
                <View style={styles.recentSectionHeader}>
                  <Text style={styles.sectionTitle}>Hoạt động gần đây</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('EMRDashboard', { tab: 'records' })} accessibilityRole="link">
                    <Text style={styles.viewAllText}>Xem bệnh án</Text>
                  </TouchableOpacity>
                </View>
              <View style={styles.activityCard}>
                {/* Table Header for Desktop */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Mã ca / Bệnh nhân</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Bác sĩ phụ trách</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Phương pháp</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Trạng thái</Text>
                </View>

                {loadingStats ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={Colors.brandGreen} />
                  </View>
                ) : recentActivity.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: Colors.secondary, fontSize: 13 }}>Không có hoạt động nào gần đây.</Text>
                  </View>
                ) : (
                  recentActivity.map((activity, index) => (
                    <View key={activity.id} style={[styles.activityRow, index === recentActivity.length - 1 && styles.lastActivityRow]}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.patientId}>Ca #{activity.id}</Text>
                        <Text style={styles.patientNameText}>{activity.patientName}</Text>
                      </View>
                      <Text style={[styles.activityTableCellText, { flex: 1.2 }]}>{activity.doctor}</Text>
                      <Text style={[styles.activityTableCellText, { flex: 1 }]}>{activity.scanType}</Text>
                      <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
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

              <View style={isWide ? styles.colSide : null}>
                <View style={styles.recentSectionHeader}>
                  <Text style={styles.sectionTitle}>Nhân sự</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('StaffManagement')} accessibilityRole="link">
                    <Text style={styles.viewAllText}>Quản lý nhân sự</Text>
                  </TouchableOpacity>
                </View>
              <View style={styles.doctorsCard}>
                {loadingStaff ? (
                  <ActivityIndicator size="small" color={Colors.brandGreen} style={{ marginVertical: 20 }} />
                ) : hospitalStaff.length === 0 ? (
                  <Text style={{ color: Colors.secondary, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
                    Chưa có nhân sự hoạt động.
                  </Text>
                ) : (
                  hospitalStaff.slice(0, 5).map((staff, idx) => {
                    const badgeConfig = getRoleBadgeStyle(staff.role);
                    return (
                      <View key={staff.email} style={[styles.doctorItemRow, idx === Math.min(hospitalStaff.length, 5) - 1 && { borderBottomWidth: 0 }]}>
                        <View style={styles.doctorItemLeft}>
                          <Text style={styles.doctorItemName}>{staff.profile?.name || 'Nhân sự'}</Text>
                          <Text style={styles.doctorItemEmail}>{staff.email}</Text>
                        </View>
                        <View style={[styles.roleBadgeStyle, { backgroundColor: badgeConfig.bg }]}>
                          <Text style={[styles.roleBadgeText, { color: badgeConfig.text }]}>
                            {badgeConfig.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>


                <Text style={[styles.sectionTitle, styles.sectionGap]}>Nhân khẩu học bệnh nhân</Text>
              <View style={styles.demographicCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalVal}>{totalPatients}</Text>
                  <Text style={styles.totalLabel}>TỔNG CỘNG</Text>
                </View>

                {totalPatients === 0 || demographics.every(d => d.value === 0) ? (
                  <View style={styles.emptyChartContainer}>
                    <View style={styles.emptyChartCircle}>
                      <Text style={styles.emptyChartPercent}>0%</Text>
                    </View>
                    <Text style={styles.emptyChartText}>Chưa có dữ liệu phân tích nhân khẩu học</Text>
                  </View>
                ) : (
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
                )}
              </View>

              </View>
            </View>
          </PageContainer>
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
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.brandNavy }}>Quản lý & Cấp tài khoản nhân sự</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Phân quyền và cấp tài khoản làm việc cho từng chức vụ.</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddUserModal(false)} style={{ padding: 6 }}>
                  <X size={20} color={Colors.secondary} />
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
                      borderBottomColor: activeRoleTab === role ? Colors.brandGreen : 'transparent',
                      marginRight: 8,
                    }}
                    onPress={() => setActiveRoleTab(role)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {role === 'doctor' ? (
                        <Stethoscope size={14} color={activeRoleTab === role ? Colors.brandGreen : '#64748B'} />
                      ) : role === 'nurse' ? (
                        <HeartPulse size={14} color={activeRoleTab === role ? Colors.brandGreen : '#64748B'} />
                      ) : role === 'technician' ? (
                        <Microscope size={14} color={activeRoleTab === role ? Colors.brandGreen : '#64748B'} />
                      ) : (
                        <Briefcase size={14} color={activeRoleTab === role ? Colors.brandGreen : '#64748B'} />
                      )}
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: activeRoleTab === role ? Colors.brandGreen : '#64748B' }}>
                        {role === 'doctor' ? 'Bác sĩ' : role === 'nurse' ? 'Điều dưỡng' : role === 'technician' ? 'Kỹ thuật viên' : 'Lễ tân'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={{ padding: 20 }}>

                {/* Form Section */}
                <View style={{ marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <UserPlus size={16} color={Colors.brandGreen} />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#334155' }}>
                      Cấp tài khoản {ROLE_LABELS[activeRoleTab]} mới
                    </Text>
                  </View>

                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, marginBottom: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Họ và tên *</Text>
                      <TextInput
                        style={{ height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                        placeholder={`Ví dụ: ${activeRoleTab === 'doctor' ? 'Bác sĩ Lê Mạnh Minh' : activeRoleTab === 'nurse' ? 'Y tá Nguyễn Thị Hà' : activeRoleTab === 'technician' ? 'KTV Trần Văn Hùng' : 'Lễ tân Vũ Hoài An'}`}
                        value={newUserName}
                        onChangeText={setNewUserName}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Địa chỉ Email *</Text>
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
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>Mật khẩu ban đầu *</Text>
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
                        style={{ height: 40, backgroundColor: Colors.brandGreen, borderRadius: 8, justifyContent: 'center', alignItems: 'center', opacity: creatingUser ? 0.7 : 1 }}
                        onPress={handleCreateUser}
                        disabled={creatingUser}
                      >
                        {creatingUser ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Save size={14} color="#FFF" />
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>Tạo tài khoản {ROLE_LABELS[activeRoleTab]}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* List Section */}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <List size={16} color={Colors.brandGreen} />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#334155' }}>
                      Danh sách {ROLE_LABELS[activeRoleTab]} hiện tại ({hospitalStaff.filter(s => s.role === activeRoleTab).length})
                    </Text>
                  </View>

                  {loadingStaff ? (
                    <ActivityIndicator size="small" color={Colors.brandGreen} style={{ marginVertical: 20 }} />
                  ) : hospitalStaff.filter(s => s.role === activeRoleTab).length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 }}>
                      <Text style={{ color: Colors.secondary, fontSize: 13 }}>Chưa có tài khoản {ROLE_LABELS[activeRoleTab]} nào được cấp.</Text>
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
                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.brandNavy }}>{s.profile?.name || 'Nhân viên'}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{s.email}</Text>
                                <Text style={{ fontSize: 12, color: Colors.secondary, marginTop: 2 }}>Ngày tạo: {dateStr}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <View style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: s.isLocked ? '#FEE2E2' : s.isVerified ? Colors.brandGreenSoft : '#FEF3C7'
                                }}>
                                  <Text style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: s.isLocked ? '#991B1B' : s.isVerified ? Colors.brandGreenPressed : '#B45309'
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
