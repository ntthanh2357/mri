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
import { get, put, setAuthToken } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './HomeScreen.styles';
import Colors from '../constants/colors';

const SHIFT_LABELS = {
  'sáng': 'Ca Sáng',
  'chiều': 'Ca Chiều',
  'tối': 'Ca Tối',
  'cả ngày': 'Cả Ngày',
};

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
  const [queueVisits, setQueueVisits] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [todayReminders, setTodayReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(false);

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
            const hStatus = hRes.hospital?.status;
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
        const [patientsRes, emrRes, queueRes, schedRes] = await Promise.all([
          get('/api/patients'),
          get('/emr/records'),
          get('/api/v1/visits/my-queue').catch(() => null),
          get('/api/v1/schedules/my-schedule').catch(() => null)
        ]);

        if (patientsRes && patientsRes.success && Array.isArray(patientsRes.data)) {
          setTotalPatients(patientsRes.data.length);
        }

        if (emrRes && emrRes.status === 'success' && Array.isArray(emrRes.data)) {
          setEmrRecords(emrRes.data);
          const pending = emrRes.data.filter(r => r.signStatus === 'Chưa duyệt');
          setPendingRecords(pending);
        }
        
        if (queueRes && queueRes.visits) {
          setQueueVisits(queueRes.visits);
        }
        
        const todaySchedules = schedRes?.data?.schedules;
        if (Array.isArray(todaySchedules)) {
          const todayStr = new Date().toDateString();
          const todayS = todaySchedules.find(s => new Date(s.date).toDateString() === todayStr);
          setTodaySchedule(todayS || null);
        }
      } catch (err) {
        console.error('Lỗi khi tải thống kê HomeScreen:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

<<<<<<< HEAD
  const fetchTodayReminders = async () => {
    setLoadingReminders(true);
    try {
      const res = await get('/api/v1/patient/reminders/today');
      if (res && res.success) {
        setTodayReminders(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch trình uống thuốc:', err);
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'patient') return;
    fetchTodayReminders();
  }, [user]);

  const handleMarkReminderDone = async (id) => {
    try {
      await put(`/api/v1/patient/reminders/${id}/done`, {});
    } catch (err) {
      console.error('Lỗi khi đánh dấu đã uống thuốc:', err);
    }
    fetchTodayReminders();
  };

  const handleLogout = () => {
    setAuthToken('');
    navigation.replace('Welcome');
=======
  const handleLogout = async () => {
    await setAuthToken('');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
>>>>>>> origin/dinhhuyhoang
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
  const isNurse = user.role === 'nurse';
  const isDoctor = user.role === 'doctor';
  const roleLabel = 
    user.role === 'admin' ? 'Quản trị viên' : 
    user.role === 'doctor' ? 'Bác sĩ' : 
    user.role === 'nurse' ? 'Điều dưỡng' : 'Bệnh nhân';

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
                    Hôm nay là {(() => { const d = new Date(); const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']; return days[d.getDay()]; })()}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}. Sức khỏe của bạn đang rất tốt.
                  </Text>
                </View>
              )}

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
                      onPress={() => navigation.navigate('RecordVault')}
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
                  {loadingReminders ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} />
                  ) : todayReminders.length === 0 ? (
                    <Text style={styles.scheduleDesc}>Không có lịch uống thuốc nào hôm nay.</Text>
                  ) : (
                    todayReminders.map((item, idx) => {
                      const isDone = item.status === 'done';
                      const isSkipped = item.status === 'skipped';
                      const dotColor = isDone ? '#22C55E' : isSkipped ? '#94A3B8' : '#3B82F6';
                      return (
                        <View key={item._id} style={styles.scheduleItem}>
                          <View style={styles.scheduleTimeline}>
                            <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                            {idx < todayReminders.length - 1 && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.scheduleContent}>
                            <Text style={styles.scheduleTime}>{item.time}</Text>
                            <Text style={styles.scheduleTitle}>Uống thuốc: {item.drugName}</Text>
                            <Text style={styles.scheduleDesc}>{item.dosageText}</Text>
                            <View style={styles.scheduleTags}>
                              {isDone ? (
                                <View style={[styles.scheduleTag, styles.tagSuccess]}>
                                  <Text style={[styles.scheduleTagText, styles.tagSuccessText]}>Đã uống</Text>
                                </View>
                              ) : isSkipped ? (
                                <View style={styles.scheduleTag}>
                                  <Text style={styles.scheduleTagText}>Đã bỏ qua</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.scheduleTag, styles.tagInfo]}
                                  onPress={() => handleMarkReminderDone(item._id)}
                                >
                                  <Text style={[styles.scheduleTagText, styles.tagInfoText]}>Đánh dấu đã uống</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
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
                    {isNurse ? 'Bảng điều khiển Điều dưỡng'
                      : 'Bảng điều khiển Bác sĩ'}
                  </Text>
                  <Text style={styles.greetingSubtitle}>
                    {isNurse
                      ? `Chào mừng trở lại, ${user.profile?.name || 'Nhân viên'}. Quản lý hàng đợi, tiếp đón bệnh nhân và cập nhật sinh hiệu.`
                      : `Chào mừng trở lại, Bs. ${user?.profile?.name || user?.email || 'Bác sĩ'}. Đây là tổng quan hiệu suất phòng khám của bạn.`
                    }
                  </Text>
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.doctorStatsRow}>
                {isNurse ? (
                  <>
                    <View style={styles.doctorStatCard}>
                      {loadingStats ? (
                        <ActivityIndicator size="small" color="#15803D" />
                      ) : (
                        <Text style={[styles.doctorStatVal, { color: '#15803D' }]}>
                          {todaySchedule ? (SHIFT_LABELS[todaySchedule.shift] || todaySchedule.shift) : 'Nghỉ'}
                        </Text>
                      )}
                      <Text style={styles.doctorStatLabel}>
                        {todaySchedule?.startTime ? `${todaySchedule.startTime} - ${todaySchedule.endTime}` : 'Ca trực hôm nay'}
                      </Text>
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
                      onPress={() => navigation.navigate('DoctorWorkQueue')}
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
                      <Text style={[styles.doctorStatVal, { color: '#D97706' }]}>94.7%</Text>
                      <Text style={styles.doctorStatLabel}>AI Chính xác</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Today's Schedule Section (FIX-9) */}
              {(user.role === 'doctor' || user.role === 'nurse') && (
                <>
                  <Text style={styles.sectionTitle}>Lịch Làm Việc Hôm Nay</Text>
                  <View style={[styles.queueCard, { marginBottom: 20 }]}>
                    {todaySchedule ? (
                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                         <Text style={{ fontSize: 24, marginRight: 12 }}>⏰</Text>
                         <View>
                           <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0F172A' }}>Ca: {SHIFT_LABELS[todaySchedule.shift] || todaySchedule.shift}</Text>
                           {todaySchedule.startTime ? (
                             <Text style={{ fontSize: 13, color: '#64748B' }}>Giờ: {todaySchedule.startTime} - {todaySchedule.endTime}</Text>
                           ) : null}
                         </View>
                       </View>
                    ) : (
                       <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>Hôm nay bạn không có lịch trực.</Text>
                    )}
                  </View>
                </>
              )}

              {/* Queue Section - differs by role */}
              <Text style={styles.sectionTitle}>
                {isNurse
                  ? 'Bệnh nhân nội trú cần theo dõi sinh hiệu'
                  : 'Danh sách ca bệnh & Chỉ định chờ xử lý'
                }
              </Text>
              <View style={styles.queueCard}>
                {loadingStats ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#15803D" />
                  </View>
                ) : isNurse ? (
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
                ) : (
                  <>
                    {/* Doctor pending records from Queue */}
                    {queueVisits.length === 0 ? (
                      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có ca bệnh nào chờ duyệt.</Text>
                      </View>
                    ) : (
                      queueVisits.map((v, index) => {
                        const isLast = index === queueVisits.length - 1;
                        return (
                          <TouchableOpacity
                            key={v._id}
                            style={[styles.queueItemRow, isLast && styles.lastQueueItemRow]}
                            onPress={() => navigation.navigate('DoctorWorkQueue')}
                          >
                            <View style={styles.queueLeftInfo}>
                              <Text style={styles.queuePatientName}>🩺 {v.patientId?.profile?.name || v.patientId?.email}</Text>
                              <Text style={styles.queueDetailsText}>{v.reason}</Text>
                            </View>
                            <View style={[styles.statusBadge, v.status === 'đang chờ' ? styles.statusDanger : styles.statusWarn]}>
                              <Text style={styles.statusBadgeText}>
                                {v.status === 'đang chờ' ? 'Chưa bắt đầu' : v.status}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Right Column (flex: 1) */}
            <View style={isDesktop ? styles.doctorSideColumn : styles.fullWidth}>
              {/* Quick Actions Grid - differs by role */}
              <Text style={styles.sectionTitle}>
                {isNurse ? 'Công cụ điều dưỡng & tiếp đón' : 'Công cụ nghiệp vụ & Quản lý'}
              </Text>
              <View style={styles.doctorGrid}>
                {isNurse ? (
                  <>
                    <TouchableOpacity
                      style={styles.doctorGridCard}
                      onPress={() => navigation.navigate('NurseReception')}
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
                      onPress={() => navigation.navigate('NurseReception')}
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
                      onPress={() => navigation.navigate('DoctorWorkQueue')}
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

export default HomeScreen;
