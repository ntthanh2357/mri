import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  useWindowDimensions,
  Image,
} from 'react-native';
import { get, setAuthToken } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Colors from '../constants/colors';

const scheduleData = [
  {
    time: '08:00 AM',
    title: 'Uống thuốc hỗ trợ trí nhớ',
    desc: 'Liều lượng: 1 viên Donepezil 5mg sau ăn sáng.',
    tags: ['Đã uống', 'Nhắc lại sau 15p'],
    tagTypes: ['success', 'normal'],
    dotColor: '#22C55E',
  },
  {
    time: '10:30 AM',
    title: 'Khám lâm sàng định kỳ',
    desc: 'Bác sĩ: Dr. Lê Minh - Chuyên khoa Thần kinh.',
    tags: ['Cuộc gọi Video sẽ bắt đầu sau 2h'],
    tagTypes: ['info'],
    dotColor: '#3B82F6',
  },
  {
    time: '04:00 PM',
    title: 'Tập luyện nhận thức',
    desc: '30 phút trò chơi giải đố & ghi nhớ trên ứng dụng.',
    tags: [],
    tagTypes: [],
    dotColor: '#94A3B8',
  },
];

const HomeScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [user, setUser] = useState(route.params?.user || null);
  const [loading, setLoading] = useState(!route.params?.user);
  const [error, setError] = useState(null);

  // Dynamic statistics states
  const [totalPatients, setTotalPatients] = useState(0);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [emrRecords, setEmrRecords] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    // If user is already provided via navigation params (quick login), skip fetching
    if (user) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await get('/auth/me');
        setUser(data.user);
      } catch (err) {
        console.error('Fetch profile error:', err);
        setError('Phiên đăng nhập đã hết hạn hoặc không tìm thấy người dùng.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigation.replace('AdminBackoffice');
      } else if (user.role === 'hospital_admin') {
        (async () => {
          try {
            const hRes = await get('/api/v1/hospital/me');
            const hStatus = hRes.data?.hospital?.status;
            if (hStatus === 'provisioned') {
              navigation.replace('HospitalOnboarding');
            } else {
              navigation.replace('ClinicDashboard');
            }
          } catch {
            navigation.replace('HospitalOnboarding');
          }
        })();
      }
    }
  }, [user, navigation]);

  useEffect(() => {
    if (!user || user.role === 'patient') return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const [patientsRes, emrRes] = await Promise.all([
          get('/api/patients'),
          get('/emr/records')
        ]);

        if (patientsRes && patientsRes.success && Array.isArray(patientsRes.data)) {
          setTotalPatients(patientsRes.data.length);
        }

        if (emrRes && emrRes.status === 'success' && Array.isArray(emrRes.data)) {
          setEmrRecords(emrRes.data);
          const pending = emrRes.data.filter(r => r.signStatus === 'Chưa duyệt');
          setPendingRecords(pending);
        }
      } catch (err) {
        console.error('Lỗi khi tải thống kê HomeScreen:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleLogout = () => {
    setAuthToken('');
    navigation.replace('Welcome');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803D" />
        <Text style={styles.loadingText}>Đang tải thông tin cá nhân...</Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error || 'Không tìm thấy thông tin người dùng.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleLogout}>
          <Text style={styles.retryButtonText}>Quay lại trang chủ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPatient = user.role === 'patient';
  const isNurseOrRec = user.role === 'nurse' || user.role === 'receptionist';
  const isTechnician = user.role === 'technician';
  const isDoctorOrTech = user.role === 'doctor' || user.role === 'technician';
  const roleLabel = 
    user.role === 'admin' ? 'Quản trị viên' : 
    (user.role === 'doctor' || user.role === 'technician') ? 'Bác sĩ & Kỹ thuật viên' : 
    (user.role === 'nurse' || user.role === 'receptionist') ? 'Điều dưỡng & Lễ tân' : 'Bệnh nhân';

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="Home"
      user={user}
      onLogout={handleLogout}
    >
      <SafeAreaView style={styles.container}>
        {/* Header Banner */}
        {!isDesktop && (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(user.profile?.name)}</Text>
              </View>
              <View>
                <Text style={styles.welcomeText}>Xin chào,</Text>
                <Text style={styles.userName}>{user.profile?.name || 'Người dùng'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Đăng xuất 🚪</Text>
            </TouchableOpacity>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* User Role Badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isPatient ? styles.patientBadge : styles.doctorBadge]}>
            <Text style={[styles.badgeText, isPatient ? styles.patientBadgeText : styles.doctorBadgeText]}>
              ● {roleLabel}
            </Text>
          </View>
          <Text style={styles.emailText}>{user.email}</Text>
        </View>

        {isPatient ? (
          /* PATIENT PORTAL */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column (flex: 2) */}
            <View style={isDesktop ? styles.patientMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Chào buổi sáng, {user.profile?.name || 'Người dùng'}</Text>
                  <Text style={styles.greetingSubtitle}>
                    Hôm nay là Thứ Tư, ngày 24 tháng 5 năm 2024. Sức khỏe của bạn đang rất tốt.
                  </Text>
                </View>
              )}

              {/* Health Metrics */}
              <View style={styles.metricsContainer}>
                {/* Heart Rate */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricIconBox, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={styles.metricEmoji}>❤️</Text>
                    </View>
                    <View style={styles.metricBadge}>
                      <Text style={styles.metricBadgeText}>Ổn định</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabel}>Nhịp tim</Text>
                  <Text style={styles.metricValue}>
                    72 <Text style={styles.metricUnit}>BPM</Text>
                  </Text>
                  <View style={styles.sparkline}>
                    {[15, 25, 20, 30, 20, 25, 15].map((h, i) => (
                      <View key={i} style={[styles.sparklineBar, { height: h, backgroundColor: '#EF4444' }]} />
                    ))}
                  </View>
                </View>

                {/* Sleep */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={styles.metricEmoji}>🌙</Text>
                    </View>
                    <View style={[styles.metricBadge, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.metricBadgeText, { color: '#0284C7' }]}>+15%</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabel}>Giấc ngủ</Text>
                  <Text style={styles.metricValue}>7h 45m</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: '80%', backgroundColor: '#6366F1' }]} />
                  </View>
                </View>

                {/* Activity */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricIconBox, { backgroundColor: '#FEFCE8' }]}>
                      <Text style={styles.metricEmoji}>⚡</Text>
                    </View>
                    <Text style={styles.metricBadgeValue}>8,421</Text>
                  </View>
                  <Text style={styles.metricLabel}>Hoạt động</Text>
                  <Text style={styles.metricValue}>
                    84% <Text style={styles.metricUnit}>mục tiêu</Text>
                  </Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: '84%', backgroundColor: '#22C55E' }]} />
                  </View>
                </View>
              </View>

              {/* MRI Result Card */}
              <View style={styles.mriCard}>
                <View style={isDesktop ? styles.mriRowLayout : styles.mriColumnLayout}>
                  <View style={isDesktop ? styles.mriImageContainerDesktop : styles.mriImageContainerMobile}>
                    <Image
                      source={require('../../assets/nero3.png')}
                      style={styles.mriImage}
                      resizeMode="cover"
                    />
                    <View style={styles.aiOverlayBadge}>
                      <View style={styles.aiDot} />
                      <Text style={styles.aiOverlayText}>PHÁT HIỆN BỞI AI</Text>
                    </View>
                  </View>
                  <View style={styles.mriInfoContainer}>
                    <View style={styles.mriHeaderRow}>
                      <Text style={styles.mriIdText}>ID: NS-2024-0524</Text>
                      <Text style={styles.mriTimeText}>Cập nhật 2 giờ trước</Text>
                    </View>
                    <Text style={styles.mriTitle}>Kết quả phân tích MRI Não</Text>
                    <Text style={styles.mriDesc}>
                      Hệ thống AI đã hoàn tất việc quét và so sánh dữ liệu với 1.2 triệu ca lâm sàng tương tự. Kết quả không cho thấy dấu hiệu bất thường về cấu trúc vỏ não.
                    </Text>
                    <View style={styles.mriSpecsGrid}>
                      <View style={styles.mriSpecBox}>
                        <Text style={styles.mriSpecLabel}>MẬT ĐỘ NƠ-RON</Text>
                        <Text style={styles.mriSpecValue}>Bình thường</Text>
                      </View>
                      <View style={styles.mriSpecBox}>
                        <Text style={styles.mriSpecLabel}>TỈ LỆ ĐỐI XỨNG</Text>
                        <Text style={styles.mriSpecValue}>98.4%</Text>
                      </View>
                    </View>
                     <TouchableOpacity
                       style={styles.mriReportBtn}
                       onPress={() => navigation.navigate('ImagingHistory')}
                     >
                       <Text style={styles.mriReportBtnText}>Xem báo cáo chi tiết →</Text>
                     </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Mobile Only: Premium and Actions grid */}
              {!isDesktop && (
                <>
                  {/* Premium Promo */}
                  <View style={styles.promoCard}>
                    <View style={styles.promoLeft}>
                      <Text style={styles.promoTitle}>Nâng cấp Premium 💎</Text>
                      <Text style={styles.promoDesc}>Chẩn đoán MRI không giới hạn, xem kết quả dạng 3D.</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.promoButton}
                      onPress={() => navigation.navigate('Premium')}
                    >
                      <Text style={styles.promoButtonText}>Mua</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Actions Grid */}
                  <Text style={styles.sectionTitle}>Chức năng chính</Text>
                  <View style={styles.grid}>
                    <TouchableOpacity
                      style={styles.gridCard}
                      onPress={() => navigation.navigate('AIAnalysis')}
                    >
                      <Text style={styles.gridIcon}>📸</Text>
                      <Text style={styles.gridLabel}>Tải ảnh MRI</Text>
                      <Text style={styles.gridSub}>Phân tích bằng AI</Text>
                    </TouchableOpacity>

                     <TouchableOpacity
                       style={styles.gridCard}
                       onPress={() => navigation.navigate('ImagingHistory')}
                     >
                       <Text style={styles.gridIcon}>🧠</Text>
                       <Text style={styles.gridLabel}>Phim MRI & CT</Text>
                       <Text style={styles.gridSub}>Xem phim & kết quả</Text>
                     </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.gridCard}
                      onPress={() => navigation.navigate('Support')}
                    >
                      <Text style={styles.gridIcon}>👨‍⚕️</Text>
                      <Text style={styles.gridLabel}>Tư vấn Bác sĩ</Text>
                      <Text style={styles.gridSub}>Đặt lịch trực tiếp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.gridCard}
                      onPress={() => navigation.navigate('MedicalRecordForm')}
                    >
                      <Text style={styles.gridIcon}>📋</Text>
                      <Text style={styles.gridLabel}>Khai báo bệnh án</Text>
                      <Text style={styles.gridSub}>Bệnh sử, tiền sử</Text>
                    </TouchableOpacity>

                     <TouchableOpacity
                       style={styles.gridCard}
                       onPress={() => Alert.alert('Thông tin liên hệ', 'Email: ' + user.email + '\nSố điện thoại: ' + (user.phone || 'Chưa cập nhật'))}
                     >
                       <Text style={styles.gridIcon}>📞</Text>
                       <Text style={styles.gridLabel}>Thông tin liên hệ</Text>
                       <Text style={styles.gridSub}>Xem thông tin</Text>
                     </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Right Column (flex: 1.2) */}
            <View style={isDesktop ? styles.patientSideColumn : styles.fullWidth}>
              {/* Lịch trình (Schedule) */}
              <View style={styles.sideCard}>
                <View style={styles.sideCardHeader}>
                  <Text style={styles.sideCardTitle}>Lịch trình</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('PatientRecords')}>
                    <Text style={styles.sideCardLink}>Xem tất cả</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.scheduleList}>
                  {scheduleData.map((item, idx) => (
                    <View key={idx} style={styles.scheduleItem}>
                      <View style={styles.scheduleTimeline}>
                        <View style={[styles.timelineDot, { backgroundColor: item.dotColor }]} />
                        {idx < scheduleData.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.scheduleContent}>
                        <Text style={styles.scheduleTime}>{item.time}</Text>
                        <Text style={styles.scheduleTitle}>{item.title}</Text>
                        <Text style={styles.scheduleDesc}>{item.desc}</Text>
                        {item.tags.length > 0 && (
                          <View style={styles.scheduleTags}>
                            {item.tags.map((tag, tagIdx) => {
                              const isSuccess = item.tagTypes[tagIdx] === 'success';
                              const isInfo = item.tagTypes[tagIdx] === 'info';
                              return (
                                <View
                                  key={tagIdx}
                                  style={[
                                    styles.scheduleTag,
                                    isSuccess && styles.tagSuccess,
                                    isInfo && styles.tagInfo,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.scheduleTagText,
                                      isSuccess && styles.tagSuccessText,
                                      isInfo && styles.tagInfoText,
                                    ]}
                                  >
                                    {tag}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* NeuroAI Chat Box */}
              <View style={styles.aiChatCard}>
                <View style={styles.aiChatHeader}>
                  <View style={styles.aiChatStatusDot} />
                  <Text style={styles.aiChatTitle}>NEUROAI TRỰC TUYẾN</Text>
                </View>
                <Text style={styles.aiChatQuestion}>Bạn cần hỗ trợ gì ngay bây giờ không?</Text>
                <View style={styles.aiChatQuote}>
                  <Text style={styles.aiChatQuoteText}>
                    "Hôm nay tôi thấy hơi đau đầu nhẹ ở vùng thái dương, đây có phải là tác dụng phụ của thuốc không?"
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.aiChatBtn}
                  onPress={() => navigation.navigate('Support')}
                >
                  <Text style={styles.aiChatBtnText}>💬 Hỏi AI ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* ALL STAFF CONSOLE: TECHNICIAN, NURSE, RECEPTIONIST, DOCTOR & ADMIN */
          /* NURSE, RECEPTIONIST, DOCTOR & ADMIN CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column (flex: 2) */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>
                    {isNurseOrRec ? 'Bảng điều khiển Điều dưỡng & Lễ tân'
                      : 'Bảng điều khiển Bác sĩ & Kỹ thuật viên'}
                  </Text>
                  <Text style={styles.greetingSubtitle}>
                    {isNurseOrRec
                      ? `Chào mừng trở lại, ${user.profile?.name || 'Nhân viên'}. Quản lý hàng đợi, tiếp đón bệnh nhân và cập nhật sinh hiệu.`
                      : isTechnician
                        ? `Chào mừng trở lại, KTV. ${user.profile?.name || user?.email || 'Kỹ thuật viên'}. Thực hiện chỉ định PACS/MRI và nhập kết quả LIS.`
                        : `Chào mừng trở lại, Bs. ${user?.profile?.name || user?.email || 'Bác sĩ'}. Đây là tổng quan hiệu suất phòng khám của bạn.`
                    }
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                {isNurseOrRec ? (
                  <>
                    <View style={styles.doctorStatCard}>
                      <Text style={[styles.doctorStatVal, { color: '#15803D' }]}>Ca trực</Text>
                      <Text style={styles.doctorStatLabel}>Ca sáng (07h–13h)</Text>
                    </View>
                    <View style={styles.doctorStatCard}>
                      {loadingStats ? (
                        <ActivityIndicator size="small" color="#D97706" />
                      ) : (
                        <Text style={[styles.doctorStatVal, { color: '#D97706' }]}>
                          {pendingRecords.length} phiếu
                        </Text>
                      )}
                      <Text style={styles.doctorStatLabel}>
                        {user.role === 'nurse' ? 'Chăm sóc cần lập' : 'Tiếp nhận hôm nay'}
                      </Text>
                    </View>
                    <View style={styles.doctorStatCard}>
                      {loadingStats ? (
                        <ActivityIndicator size="small" color="#15803D" />
                      ) : (
                        <Text style={[styles.doctorStatVal, { color: '#0284C7' }]}>
                          {emrRecords.filter(r => r.admissionType === 'Nội trú').length} ca
                        </Text>
                      )}
                      <Text style={styles.doctorStatLabel}>Bệnh nhân nội trú</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.doctorStatCard}
                      onPress={() => navigation.navigate('DoctorWorkQueue')}
                    >
                      {loadingStats ? (
                        <ActivityIndicator size="small" color="#15803D" />
                      ) : (
                        <Text style={styles.doctorStatVal}>{pendingRecords.length}</Text>
                      )}
                      <Text style={styles.doctorStatLabel}>Ca chờ duyệt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.doctorStatCard}
                      onPress={() => navigation.navigate('TechnicianQueue')}
                    >
                      <Text style={[styles.doctorStatVal, { color: '#7C3AED' }]}>MRI/PACS</Text>
                      <Text style={styles.doctorStatLabel}>Hàng đợi chụp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.doctorStatCard}
                      onPress={() => navigation.navigate('DoctorPatientList')}
                    >
                      {loadingStats ? (
                        <ActivityIndicator size="small" color="#15803D" />
                      ) : (
                        <Text style={[styles.doctorStatVal, { color: '#0284C7' }]}>{totalPatients}</Text>
                      )}
                      <Text style={styles.doctorStatLabel}>Bệnh nhân</Text>
                    </TouchableOpacity>
                    <View style={styles.doctorStatCard}>
                      <Text style={[styles.doctorStatVal, { color: '#D97706' }]}>99.8%</Text>
                      <Text style={styles.doctorStatLabel}>AI Chính xác</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Queue Section - differs by role */}
              <Text style={styles.sectionTitle}>
                {isNurseOrRec
                  ? (user.role === 'nurse' ? 'Bệnh nhân nội trú cần theo dõi sinh hiệu' : 'Hàng chờ tiếp đón ban đầu')
                  : 'Danh sách ca bệnh & Chỉ định chờ xử lý'
                }
              </Text>
              <View style={styles.queueCard}>
                {loadingStats ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#15803D" />
                  </View>
                ) : isNurseOrRec ? (
                  user.role === 'receptionist' ? (
                    /* Receptionist: static reception queue */
                    <>
                      <TouchableOpacity style={styles.queueItemRow} onPress={() => navigation.navigate('ReceptionistDashboard')}>
                        <View style={styles.queueLeftInfo}>
                          <Text style={styles.queuePatientName}>Đăng ký mới: Lê Trần Gia Huy</Text>
                          <Text style={styles.queueDetailsText}>Yêu cầu: Khám ngoại thần kinh · Chờ bác sĩ</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                          <Text style={[styles.statusBadgeText, { color: '#EF4444', fontSize: 10, fontWeight: 'bold' }]}>Chờ phân vai</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.queueItemRow, styles.lastQueueItemRow]} onPress={() => navigation.navigate('ReceptionistDashboard')}>
                        <View style={styles.queueLeftInfo}>
                          <Text style={styles.queuePatientName}>Bệnh nhân Tuấn Thành</Text>
                          <Text style={styles.queueDetailsText}>Tái khám u màng não · Đã phân công Bs. Gia Huy</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                          <Text style={[styles.statusBadgeText, { color: '#15803D', fontSize: 10, fontWeight: 'bold' }]}>Đang chờ khám</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  ) : (
                    /* Nurse: inpatient list */
                    emrRecords.filter(r => r.admissionType === 'Nội trú').length === 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có bệnh nhân nội trú cần theo dõi.</Text>
                      </View>
                    ) : (
                      emrRecords.filter(r => r.admissionType === 'Nội trú').map((record, index) => {
                        const lst = emrRecords.filter(r => r.admissionType === 'Nội trú');
                        const isLast = index === lst.length - 1;
                        return (
                          <TouchableOpacity key={record._id || index} style={[styles.queueItemRow, isLast && styles.lastQueueItemRow]} onPress={() => navigation.navigate('EMRDashboard')}>
                            <View style={styles.queueLeftInfo}>
                              <Text style={styles.queuePatientName}>{record.patientName}</Text>
                              <Text style={styles.queueDetailsText}>{record.diagnosis} · {record.department || 'Khoa Thần Kinh'}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: record.signStatus === 'Chưa duyệt' ? '#FEE2E2' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                              <Text style={[styles.statusBadgeText, { color: record.signStatus === 'Chưa duyệt' ? '#EF4444' : '#D97706', fontSize: 10, fontWeight: 'bold' }]}>
                                {record.signStatus === 'Chưa duyệt' ? 'Theo dõi sát' : 'Cần theo dõi'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )
                  )
                ) : (
                  <>
                    {/* Doctor pending records */}
                    {pendingRecords.length === 0 ? (
                      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có ca bệnh nào chờ duyệt.</Text>
                      </View>
                    ) : (
                      pendingRecords.map((record, index) => {
                        return (
                          <TouchableOpacity
                            key={record._id}
                            style={styles.queueItemRow}
                            onPress={() => navigation.navigate('DoctorWorkQueue')}
                          >
                            <View style={styles.queueLeftInfo}>
                              <Text style={styles.queuePatientName}>🩺 {record.patientName}</Text>
                              <Text style={styles.queueDetailsText}>{record.diagnosis} ({record.admissionType})</Text>
                            </View>
                            <View style={[styles.statusBadge, record.admissionType === 'Cấp cứu' ? styles.statusDanger : styles.statusWarn]}>
                              <Text style={styles.statusBadgeText}>
                                {record.admissionType === 'Cấp cứu' ? 'Khẩn cấp' : 'Chờ duyệt'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}

                    {/* Technician PACS queue */}
                    <TouchableOpacity style={styles.queueItemRow} onPress={() => navigation.navigate('TechnicianQueue')}>
                      <View style={styles.queueLeftInfo}>
                        <Text style={styles.queuePatientName}>🔬 Bệnh nhân Tuấn Thành (26025699)</Text>
                        <Text style={styles.queueDetailsText}>Yêu cầu: Chụp MRI sọ não có cản từ · Đã hoàn tất chụp</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#15803D', fontSize: 10, fontWeight: 'bold' }]}>Chờ nạp PACS</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.queueItemRow, styles.lastQueueItemRow]} onPress={() => navigation.navigate('TechnicianQueue')}>
                      <View style={styles.queueLeftInfo}>
                        <Text style={styles.queuePatientName}>🔬 Nguyễn Văn A</Text>
                        <Text style={styles.queueDetailsText}>Chỉ định: Huyết học 18 chỉ số · Barcode: LIS-HH-8422</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#D97706', fontSize: 10, fontWeight: 'bold' }]}>Chờ kết nối LIS</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Right Column (flex: 1) */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              {/* Quick Actions Grid - differs by role */}
              <Text style={styles.sectionTitle}>
                {isNurseOrRec ? 'Công cụ điều dưỡng & tiếp đón' : 'Công cụ nghiệp vụ & Quản lý'}
              </Text>
              <View style={styles.doctorGrid}>
                {isNurseOrRec ? (
                  <>
                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('ReceptionistDashboard')}
                    >
                      <Text style={styles.doctorGridIcon}>📋</Text>
                      <Text style={styles.doctorGridLabel}>Tiếp nhận Bệnh nhân</Text>
                      <Text style={styles.doctorGridSub}>Tạo Visit mới & phân ca</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('DoctorWorkQueue')}
                    >
                      <Text style={styles.doctorGridIcon}>🩺</Text>
                      <Text style={styles.doctorGridLabel}>Hàng đợi ca khám</Text>
                      <Text style={styles.doctorGridSub}>Xem ca đợi & sinh hiệu</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('EMRDashboard')}
                    >
                      <Text style={styles.doctorGridIcon}>📝</Text>
                      <Text style={styles.doctorGridLabel}>Phiếu chăm sóc EMR</Text>
                      <Text style={styles.doctorGridSub}>Quản lý & đo sinh hiệu</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('ReceptionistDashboard')}
                    >
                      <Text style={styles.doctorGridIcon}>💳</Text>
                      <Text style={styles.doctorGridLabel}>Thanh toán & Thu ngân</Text>
                      <Text style={styles.doctorGridSub}>Quản lý hóa đơn chờ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('Support')}
                    >
                      <Text style={styles.doctorGridIcon}>📞</Text>
                      <Text style={styles.doctorGridLabel}>Hỗ trợ kỹ thuật</Text>
                      <Text style={styles.doctorGridSub}>Liên hệ nhanh</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('DoctorWorkQueue')}
                    >
                      <Text style={styles.doctorGridIcon}>🩺</Text>
                      <Text style={styles.doctorGridLabel}>Hàng đợi khám</Text>
                      <Text style={styles.doctorGridSub}>Khám bệnh & Y lệnh</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('TechnicianQueue')}
                    >
                      <Text style={styles.doctorGridIcon}>🔬</Text>
                      <Text style={styles.doctorGridLabel}>Hàng đợi chụp MRI</Text>
                      <Text style={styles.doctorGridSub}>Chỉ định & Kết quả MRI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('CreateImagingResult')}
                    >
                      <Text style={styles.doctorGridIcon}>📸</Text>
                      <Text style={styles.doctorGridLabel}>Tải phim MRI/PACS</Text>
                      <Text style={styles.doctorGridSub}>Tải kết quả chẩn đoán</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('DoctorPatientList')}
                    >
                      <Text style={styles.doctorGridIcon}>📂</Text>
                      <Text style={styles.doctorGridLabel}>Bệnh án Điện tử</Text>
                      <Text style={styles.doctorGridSub}>Quản lý hồ sơ</Text>
                    </TouchableOpacity>

                    {user.role === 'admin' && (
                      <TouchableOpacity
                        style={styles.doctorGridCard}
                        onPress={() => navigation.navigate('AdminBackoffice')}
                      >
                        <Text style={styles.doctorGridIcon}>🛠️</Text>
                        <Text style={styles.doctorGridLabel}>Admin Backoffice</Text>
                        <Text style={styles.doctorGridSub}>Dashboard quản trị</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('Support')}
                    >
                      <Text style={styles.doctorGridIcon}>📞</Text>
                      <Text style={styles.doctorGridLabel}>Hỗ trợ kỹ thuật</Text>
                      <Text style={styles.doctorGridSub}>Ticket & Hotline</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Research Whitepaper Card */}
              <View style={styles.researchCard}>
                <Text style={styles.researchCategory}>NGHIÊN CỨU TIÊN TIẾN</Text>
                <Text style={styles.researchTitle}>Sách trắng kết nối thần kinh 2024</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Tài liệu y khoa', 'Tính năng đọc sách trắng sẽ khả dụng ở phiên bản tiếp theo.')}
                >
                  <Text style={styles.researchLink}>Đọc thêm →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#15803D',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  welcomeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 10,
  },
  patientBadge: {
    backgroundColor: '#DCFCE7',
  },
  doctorBadge: {
    backgroundColor: '#DBEAFE',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  patientBadgeText: {
    color: '#15803D',
  },
  doctorBadgeText: {
    color: '#15803D',
  },
  emailText: {
    fontSize: 13,
    color: '#64748B',
  },
  promoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  promoLeft: {
    flex: 1,
    marginRight: 16,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  promoButton: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 28,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  gridIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  gridSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    paddingBottom: 4,
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  lastTimelineItem: {
    marginBottom: 10,
  },
  timelineBullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#15803D',
    marginTop: 4,
    marginRight: 16,
    zIndex: 2,
  },
  emptyBullet: {
    backgroundColor: '#E2E8F0',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  timelineTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  // Doctor Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  queueContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 28,
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastQueueItem: {
    borderBottomWidth: 0,
  },
  queueLeft: {
    flex: 1,
    marginRight: 12,
  },
  patientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  queueDetails: {
    fontSize: 11,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusWarn: {
    backgroundColor: '#FEF3C7',
  },
  statusOk: {
    backgroundColor: '#D1FAE5',
  },
  statusDanger: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
  clinicLinkRow: {
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  clinicLinkText: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: 'bold',
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
  patientMainColumn: {
    flex: 2,
  },
  patientSideColumn: {
    flex: 1.2,
  },
  doctorMainColumn: {
    flex: 2,
  },
  doctorSideColumn: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  desktopGreeting: {
    marginBottom: 20,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricEmoji: {
    fontSize: 16,
  },
  metricBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metricBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#64748B',
  },
  sparkline: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
    height: 30,
    marginTop: 10,
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 2,
  },
  barContainer: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricBadgeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  mriCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mriRowLayout: {
    flexDirection: 'row',
  },
  mriColumnLayout: {
    flexDirection: 'column',
  },
  mriImageContainerDesktop: {
    width: '40%',
    minHeight: 220,
    position: 'relative',
    backgroundColor: '#090D16',
  },
  mriImageContainerMobile: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#090D16',
  },
  mriImage: {
    width: '100%',
    height: '100%',
  },
  aiOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#15803D',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  aiOverlayText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  mriInfoContainer: {
    flex: 1,
    padding: 20,
  },
  mriHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mriIdText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mriTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  mriTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  mriDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  mriSpecsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mriSpecBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  mriSpecLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  mriSpecValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  mriReportBtn: {
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mriReportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sideCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sideCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sideCardLink: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: 'bold',
  },
  scheduleList: {
    gap: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    gap: 12,
  },
  scheduleTimeline: {
    alignItems: 'center',
    width: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
  },
  scheduleContent: {
    flex: 1,
    paddingBottom: 12,
  },
  scheduleTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  scheduleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 2,
  },
  scheduleDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  scheduleTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  scheduleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  scheduleTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  tagSuccess: {
    backgroundColor: '#DCFCE7',
  },
  tagSuccessText: {
    color: '#15803D',
  },
  tagInfo: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tagInfoText: {
    color: '#15803D',
  },
  aiChatCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  aiChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiChatStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  aiChatTitle: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  aiChatQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aiChatQuote: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  aiChatQuoteText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  aiChatBtn: {
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  aiChatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  doctorStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  doctorStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doctorStatVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 4,
  },
  doctorStatLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  queueItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastQueueItemRow: {
    borderBottomWidth: 0,
  },
  queueLeftInfo: {
    flex: 1,
    marginRight: 12,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  queueDetailsText: {
    fontSize: 11,
    color: '#64748B',
  },
  doctorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  doctorGridCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  doctorGridIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  doctorGridLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  doctorGridSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  researchCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  researchCategory: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4ADE80',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  researchTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  researchLink: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '600',
  },
});

export default HomeScreen;
