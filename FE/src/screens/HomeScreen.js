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
import styles from './HomeScreen.styles';

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
  const roleLabel = 
    user.role === 'admin' ? 'Quản trị viên' : 
    user.role === 'doctor' ? 'Bác sĩ' : 
    user.role === 'nurse' ? 'Điều dưỡng / Y tá' :
    user.role === 'technician' ? 'Kỹ thuật viên' :
    user.role === 'receptionist' ? 'Tiếp tân / Tiếp tiếp' : 'Bệnh nhân';

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
                      <Text style={[styles.metricBadgeText, { color: '#2563EB' }]}>+15%</Text>
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
        ) : user.role === 'nurse' ? (
          /* NURSE CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Bảng điều khiển Điều dưỡng</Text>
                  <Text style={styles.greetingSubtitle}>
                    Chào mừng trở lại, Đd. {user.profile?.name || 'Lâm nghiệp'}. Xem hàng đợi chăm sóc và cập nhật sinh hiệu.
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#0D9488' }]}>Ca trực</Text>
                  <Text style={styles.doctorStatLabel}>Ca sáng (07h - 13h)</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#D97706' }]}>3 phiếu</Text>
                  <Text style={styles.doctorStatLabel}>Chăm sóc cần lập</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#2563EB' }]}>8 ca</Text>
                  <Text style={styles.doctorStatLabel}>Bệnh nhân nội trú</Text>
                </View>
              </View>

              {/* Patient observations list */}
              <Text style={styles.sectionTitle}>Bệnh nhân nội trú cần theo dõi sinh hiệu</Text>
              <View style={styles.queueCard}>
                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Nguyễn Văn A</Text>
                    <Text style={styles.queueDetailsText}>U màng não thái dương · Phòng 301 · Giường 02</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#EF4444', fontSize: 10, fontWeight: 'bold' }]}>Theo dõi sát (Cấp 1)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Trần Thị B</Text>
                    <Text style={styles.queueDetailsText}>Phẫu thuật sau u màng não ngày thứ 3 · Phòng 302</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#D97706', fontSize: 10, fontWeight: 'bold' }]}>Cần đo sinh hiệu (Cấp 2)</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Column */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              <Text style={styles.sectionTitle}>Công cụ chăm sóc</Text>
              <View style={styles.doctorGrid}>
                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <Text style={styles.doctorGridIcon}>📋</Text>
                  <Text style={styles.doctorGridLabel}>Danh sách Bệnh nhân</Text>
                  <Text style={styles.doctorGridSub}>Ghi sinh hiệu & chăm sóc</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <Text style={styles.doctorGridIcon}>📝</Text>
                  <Text style={styles.doctorGridLabel}>Phiếu chăm sóc EMR</Text>
                  <Text style={styles.doctorGridSub}>Quản lý & OCR quét tay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('Support')}
                >
                  <Text style={styles.doctorGridIcon}>📞</Text>
                  <Text style={styles.doctorGridLabel}>Hỗ trợ kỹ thuật</Text>
                  <Text style={styles.doctorGridSub}>Liên hệ nhanh</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : user.role === 'technician' ? (
          /* TECHNICIAN CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Bảng điều khiển Kỹ thuật viên</Text>
                  <Text style={styles.greetingSubtitle}>
                    Chào mừng trở lại. Thực hiện chỉ định PACS/MRI/CT và nhập kết quả xét nghiệm huyết học/hóa sinh.
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#7C3AED' }]}>4 ca</Text>
                  <Text style={styles.doctorStatLabel}>Chụp MRI/CT chờ nạp</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#059669' }]}>8 chỉ định</Text>
                  <Text style={styles.doctorStatLabel}>Chờ xét nghiệm LIS</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#2563EB' }]}>99.5%</Text>
                  <Text style={styles.doctorStatLabel}>Độ sẵn sàng thiết bị</Text>
                </View>
              </View>

              {/* Lab / PACS queue */}
              <Text style={styles.sectionTitle}>Danh sách phim chụp PACS & Xét nghiệm chờ xử lý</Text>
              <View style={styles.queueCard}>
                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('CreateImagingResult')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Bệnh nhân Tuấn Thành (26025699)</Text>
                    <Text style={styles.queueDetailsText}>Yêu cầu: Chụp MRI sọ não có cản từ · Đã hoàn tất chụp</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#1D4ED8', fontSize: 10, fontWeight: 'bold' }]}>Chờ nạp PACS</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Nguyễn Văn A</Text>
                    <Text style={styles.queueDetailsText}>Chỉ định: Huyết học 18 chỉ số · Barcode: LIS-HH-8422</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#D97706', fontSize: 10, fontWeight: 'bold' }]}>Chờ kết nối LIS</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Column */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              <Text style={styles.sectionTitle}>Công cụ nghiệp vụ</Text>
              <View style={styles.doctorGrid}>
                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('CreateImagingResult')}
                >
                  <Text style={styles.doctorGridIcon}>📸</Text>
                  <Text style={styles.doctorGridLabel}>Nhập phim MRI / CT</Text>
                  <Text style={styles.doctorGridSub}>Đẩy ảnh & Quét OCR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <Text style={styles.doctorGridIcon}>🧪</Text>
                  <Text style={styles.doctorGridLabel}>Truyền dữ liệu LIS</Text>
                  <Text style={styles.doctorGridSub}>Simulate & nạp chỉ số</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('Support')}
                >
                  <Text style={styles.doctorGridIcon}>📞</Text>
                  <Text style={styles.doctorGridLabel}>Hỗ trợ thiết bị</Text>
                  <Text style={styles.doctorGridSub}>Ticket kỹ thuật</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : user.role === 'receptionist' ? (
          /* RECEPTIONIST CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Bảng điều khiển Tiếp tân</Text>
                  <Text style={styles.greetingSubtitle}>
                    Chào mừng trở lại. Tiếp đón bệnh nhân, đăng ký EMR ban đầu và phân công bác sĩ điều trị.
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#059669' }]}>15 ca</Text>
                  <Text style={styles.doctorStatLabel}>Tiếp nhận hôm nay</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#EA580C' }]}>2 ca</Text>
                  <Text style={styles.doctorStatLabel}>Chờ phân bác sĩ</Text>
                </View>
                <View style={styles.doctorStatCard}>
                  <Text style={[styles.doctorStatVal, { color: '#2563EB' }]}>98%</Text>
                  <Text style={styles.doctorStatLabel}>Hài lòng dịch vụ</Text>
                </View>
              </View>

              {/* Reception wait queue */}
              <Text style={styles.sectionTitle}>Hàng chờ tiếp đón ban đầu</Text>
              <View style={styles.queueCard}>
                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Đăng ký mới: Lê Trần Gia Huy</Text>
                    <Text style={styles.queueDetailsText}>Yêu cầu: Khám chuyên khoa ngoại thần kinh · Chờ chỉ định bác sĩ</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#EF4444', fontSize: 10, fontWeight: 'bold' }]}>Chờ phân vai</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Bệnh nhân Tuấn Thành</Text>
                    <Text style={styles.queueDetailsText}>Yêu cầu: Tái khám u màng não · Đã phân công Bs. Gia Huy</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: '#15803D', fontSize: 10, fontWeight: 'bold' }]}>Đang chờ khám</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Column */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              <Text style={styles.sectionTitle}>Công cụ tiếp đón</Text>
              <View style={styles.doctorGrid}>
                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <Text style={styles.doctorGridIcon}>📋</Text>
                  <Text style={styles.doctorGridLabel}>Tiếp nhận & Tạo EMR</Text>
                  <Text style={styles.doctorGridSub}>Đăng ký mới & Quét OCR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <Text style={styles.doctorGridIcon}>👨‍⚕️</Text>
                  <Text style={styles.doctorGridLabel}>Phân công Bác sĩ</Text>
                  <Text style={styles.doctorGridSub}>Đồng bộ điều phối phòng khám</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('Support')}
                >
                  <Text style={styles.doctorGridIcon}>📞</Text>
                  <Text style={styles.doctorGridLabel}>Hỗ trợ kỹ thuật</Text>
                  <Text style={styles.doctorGridSub}>Ticket & Hotline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* DOCTOR & ADMIN CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column (flex: 2) */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Bảng điều khiển Phòng khám</Text>
                  <Text style={styles.greetingSubtitle}>
                    Chào mừng trở lại, Bs. {user?.profile?.name || user?.email || 'Bác sĩ'}. Đây là tổng quan hiệu suất phòng khám của bạn.
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                <TouchableOpacity
                  style={styles.doctorStatCard}
                  onPress={() => navigation.navigate('EMRDashboard')}
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
                  onPress={() => navigation.navigate('ClinicDashboard')}
                >
                  <Text style={styles.doctorStatVal}>99.8%</Text>
                  <Text style={styles.doctorStatLabel}>AI Chính xác</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doctorStatCard}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  {loadingStats ? (
                    <ActivityIndicator size="small" color="#15803D" />
                  ) : (
                    <Text style={styles.doctorStatVal}>{totalPatients}</Text>
                  )}
                  <Text style={styles.doctorStatLabel}>Bệnh nhân</Text>
                </TouchableOpacity>
              </View>

              {/* Diagnostics Queue */}
              <Text style={styles.sectionTitle}>Danh sách ca bệnh chờ duyệt</Text>
              <View style={styles.queueCard}>
                {loadingStats ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#15803D" />
                  </View>
                ) : pendingRecords.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có ca bệnh nào chờ duyệt.</Text>
                  </View>
                ) : (
                  pendingRecords.map((record, index) => {
                    const isLast = index === pendingRecords.length - 1;
                    return (
                      <TouchableOpacity
                        key={record._id}
                        style={[styles.queueItemRow, isLast && styles.lastQueueItemRow]}
                        onPress={() => navigation.navigate('EMRDashboard')}
                      >
                        <View style={styles.queueLeftInfo}>
                          <Text style={styles.queuePatientName}>{record.patientName}</Text>
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
              </View>
            </View>

            {/* Right Column (flex: 1) */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              {/* Quick Actions Grid */}
              <Text style={styles.sectionTitle}>Công cụ quản lý</Text>
              <View style={styles.doctorGrid}>
                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('DoctorPatientList')}
                >
                  <Text style={styles.doctorGridIcon}>📂</Text>
                  <Text style={styles.doctorGridLabel}>Bệnh án Điện tử</Text>
                  <Text style={styles.doctorGridSub}>Quản lý hồ sơ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('EMRDashboard')}
                >
                  <Text style={styles.doctorGridIcon}>🏥</Text>
                  <Text style={styles.doctorGridLabel}>Quản lý EMR</Text>
                  <Text style={styles.doctorGridSub}>Biểu mẫu & Bệnh án</Text>
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
                  onPress={() => navigation.navigate('Financials')}
                >
                  <Text style={styles.doctorGridIcon}>💰</Text>
                  <Text style={styles.doctorGridLabel}>Báo cáo tài chính</Text>
                  <Text style={styles.doctorGridSub}>Ví & Giao dịch</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doctorGridCard}
                  onPress={() => navigation.navigate('Support')}
                >
                  <Text style={styles.doctorGridIcon}>📞</Text>
                  <Text style={styles.doctorGridLabel}>Hỗ trợ kỹ thuật</Text>
                  <Text style={styles.doctorGridSub}>Ticket & Hotline</Text>
                </TouchableOpacity>
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

;

export default HomeScreen;
