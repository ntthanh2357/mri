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
  const roleLabel = user.role === 'admin' ? 'Quản trị viên' : user.role === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân';

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
        ) : (
          /* DOCTOR & ADMIN CONSOLE */
          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column (flex: 2) */}
            <View style={isDesktop ? styles.doctorMainColumn : styles.fullWidth}>
              {isDesktop && (
                <View style={styles.desktopGreeting}>
                  <Text style={styles.greetingTitle}>Bảng điều khiển Phòng khám</Text>
                  <Text style={styles.greetingSubtitle}>
                    Chào mừng trở lại, Bs. Vane. Đây là tổng quan hiệu suất phòng khám của bạn.
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                <TouchableOpacity
                  style={styles.doctorStatCard}
                  onPress={() => navigation.navigate('ClinicDashboard')}
                >
                  <Text style={styles.doctorStatVal}>3</Text>
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
                  onPress={() => navigation.navigate('ClinicDashboard')}
                >
                  <Text style={styles.doctorStatVal}>12</Text>
                  <Text style={styles.doctorStatLabel}>Bệnh nhân</Text>
                </TouchableOpacity>
              </View>

              {/* Diagnostics Queue */}
              <Text style={styles.sectionTitle}>Danh sách ca bệnh chờ duyệt</Text>
              <View style={styles.queueCard}>
                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('AIAnalysis')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Nguyễn Văn A</Text>
                    <Text style={styles.queueDetailsText}>U màng não - CẤP CỨU (AI: 98.2%)</Text>
                  </View>
                  <View style={[styles.statusBadge, styles.statusDanger]}>
                    <Text style={styles.statusBadgeText}>Khẩn cấp</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.queueItemRow}
                  onPress={() => navigation.navigate('AIAnalysis')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Trần Thị B</Text>
                    <Text style={styles.queueDetailsText}>Không phát hiện dị dạng (AI: 99.8%)</Text>
                  </View>
                  <View style={[styles.statusBadge, styles.statusOk]}>
                    <Text style={styles.statusBadgeText}>Bình thường</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.queueItemRow, styles.lastQueueItemRow]}
                  onPress={() => navigation.navigate('AIAnalysis')}
                >
                  <View style={styles.queueLeftInfo}>
                    <Text style={styles.queuePatientName}>Lê Hoàng C</Text>
                    <Text style={styles.queueDetailsText}>Phình động mạch não (AI: 94.1%)</Text>
                  </View>
                  <View style={[styles.statusBadge, styles.statusWarn]}>
                    <Text style={styles.statusBadgeText}>Chờ duyệt</Text>
                  </View>
                </TouchableOpacity>
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
                  onPress={() => navigation.navigate('SystemAdmin')}
                >
                  <Text style={styles.doctorGridIcon}>⚙️</Text>
                  <Text style={styles.doctorGridLabel}>Cấu hình AI & RAG</Text>
                  <Text style={styles.doctorGridSub}>Xem thông số</Text>
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
    color: '#1D4ED8',
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
    color: '#1D4ED8',
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
