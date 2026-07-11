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
  Modal,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post, put, del } from '../services/api.service';

const SHIFT_LABELS = {
  'sáng': '🌅 Ca Sáng',
  'chiều': '☀️ Ca Chiều',
  'tối': '🌙 Ca Tối',
  'cả ngày': '🕒 Cả Ngày',
};

const SHIFT_COLORS = {
  'sáng': { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  'chiều': { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
  'tối': { bg: '#F3E8FF', text: '#7C3AED', border: '#E9D5FF' },
  'cả ngày': { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0' },
};

const DAYS_OF_WEEK = [
  { label: 'Thứ 2', key: 1 },
  { label: 'Thứ 3', key: 2 },
  { label: 'Thứ 4', key: 3 },
  { label: 'Thứ 5', key: 4 },
  { label: 'Thứ 6', key: 5 },
  { label: 'Thứ 7', key: 6 },
  { label: 'Chủ Nhật', key: 0 },
];

export default function StaffSchedulingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' | 'my-schedule' | 'swap'
  const [currentUser, setCurrentUser] = useState(null);
  
  // Weekly grid data
  const [staffList, setStaffList] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Swap requests
  const [swapRequests, setSwapRequests] = useState([]);

  // Modals and form state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null); // For edit/delete
  
  // Schedule Form fields
  const [shift, setShift] = useState('sáng');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('confirmed');

  // Swap Request Form Modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSchedule, setSwapSchedule] = useState(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [targetDateStr, setTargetDateStr] = useState('');
  const [swapReason, setSwapReason] = useState('');

  // Fetch Core Information
  const fetchCurrentUser = async () => {
    try {
      const res = await get('/auth/me');
      if (res && res.user) {
        setCurrentUser(res.user);
        // Default to personal schedule if not hospital admin
        if (res.user.role !== 'hospital_admin' && res.user.role !== 'admin') {
          setActiveTab('my-schedule');
        }
      }
    } catch (err) {
      console.error('Lỗi lấy thông tin User:', err);
    }
  };

  const fetchStaffList = async () => {
    try {
      const res = await get('/api/v1/hospital/staff');
      if (res && res.success) {
        setStaffList(res.staff || []);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách nhân viên:', err);
    }
  };

  const getWeekStartString = (date) => {
    const d = new Date(date);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  };


  const fetchWeeklySchedules = async () => {
    setLoading(true);
    try {
      const monday = getWeekStartString(new Date(currentWeekStart));
      const res = await get(`/api/v1/schedules?week=${monday.toISOString()}`);
      if (res && res.success) {
        setWeeklySchedules(res.schedules || []);
      }
    } catch (err) {
      console.error('Lỗi lấy lịch làm việc tuần:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSwapRequests = async () => {
    try {
      const res = await get('/api/v1/schedules/swap-requests');
      if (res && res.success) {
        setSwapRequests(res.requests || []);
      }
    } catch (err) {
      console.error('Lỗi lấy yêu cầu đổi ca:', err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchStaffList();
  }, []);

  useEffect(() => {
    if (activeTab === 'weekly' || activeTab === 'my-schedule') {
      fetchWeeklySchedules();
    } else if (activeTab === 'swap') {
      fetchSwapRequests();
    }
  }, [activeTab, currentWeekStart]);

  const isHospitalAdmin = currentUser?.role === 'hospital_admin';

  // Navigate Weeks
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  // Get Dates for Current Week columns
  const getWeekDates = () => {
    const monday = getWeekStartString(new Date(currentWeekStart));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Find Schedule for staff member and date
  const findSchedule = (staffId, date) => {
    const dateStr = date.toDateString();
    return weeklySchedules.find(
      (s) => s.staffId?._id === staffId && new Date(s.date).toDateString() === dateStr
    );
  };

  // Open Schedule Dialog for assignment or registration
  const handleCellPress = (staff, date) => {
    const existing = findSchedule(staff._id || staff.id, date);
    
    if (!isHospitalAdmin) {
      if (existing) return; // Staff cannot edit existing from this flow
      // Allow registration
      setSelectedStaff(staff);
      setSelectedDate(date);
      setSelectedSchedule(null);
      setShift('sáng');
      setStartTime('');
      setEndTime('');
      setNotes('');
      setStatus('pending');
      setShowScheduleModal(true);
      return;
    }

    // Admin flow
    setSelectedStaff(staff);
    setSelectedDate(date);
    if (existing) {
      setSelectedSchedule(existing);
      setShift(existing.shift);
      setStartTime(existing.startTime || '');
      setEndTime(existing.endTime || '');
      setNotes(existing.notes || '');
      setStatus(existing.status || 'confirmed');
    } else {
      setSelectedSchedule(null);
      setShift('sáng');
      setStartTime('07:00');
      setEndTime('15:00');
      setNotes('');
      setStatus('confirmed');
    }
    setShowScheduleModal(true);
  };

  // Create / Update Schedule
  const handleSaveSchedule = async () => {
    setSubmitting(true);
    try {
      const payload = {
        staffId: selectedStaff._id || selectedStaff.id,
        date: selectedDate.toISOString(),
        shift,
        startTime,
        endTime,
        notes,
        status,
      };

      let res;
      if (!isHospitalAdmin) {
        // Staff registers shift
        res = await post('/api/v1/schedules/register', payload);
      } else if (selectedSchedule) {
        res = await put(`/api/v1/schedules/${selectedSchedule._id}`, payload);
      } else {
        res = await post('/api/v1/schedules', payload);
      }

      if (res && res.success) {
        Alert.alert('Thành công', isHospitalAdmin ? 'Đã lưu ca làm việc thành công!' : 'Đã gửi đăng ký ca làm việc thành công!');
        setShowScheduleModal(false);
        fetchWeeklySchedules();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu lịch làm.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc muốn xóa ca làm này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await del(`/api/v1/schedules/${selectedSchedule._id}`);
              if (res && res.success) {
                Alert.alert('Đã xóa', 'Xóa ca làm thành công.');
                setShowScheduleModal(false);
                fetchWeeklySchedules();
              }
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể xóa ca làm này.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Submit Shift Swap Request
  const handleOpenSwapModal = (schedule) => {
    setSwapSchedule(schedule);
    setTargetStaffId('');
    setTargetDateStr('');
    setSwapReason('');
    setShowSwapModal(true);
  };

  const handleSwapSubmit = async () => {
    if (!targetDateStr.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập ngày muốn đổi sang.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await post('/api/v1/schedules/swap-requests', {
        scheduleId: swapSchedule._id,
        targetStaffId: targetStaffId || undefined,
        targetDate: new Date(targetDateStr).toISOString(),
        reason: swapReason,
      });

      if (res && res.success) {
        Alert.alert('Thành công', 'Đã gửi yêu cầu đổi ca thành công! Chờ quản trị viên duyệt.');
        setShowSwapModal(false);
        fetchWeeklySchedules();
      }
    } catch (err) {
      Alert.alert('Thất bại', err.message || 'Không thể tạo yêu cầu đổi ca.');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve / Reject Swap Request
  const handleReviewSwap = async (requestId, isApproved) => {
    Alert.alert(
      isApproved ? 'Duyệt đổi ca' : 'Từ chối đổi ca',
      `Bạn có chắc chắn muốn ${isApproved ? 'đồng ý' : 'từ chối'} yêu cầu này?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isApproved ? 'Duyệt' : 'Từ chối',
          onPress: async () => {
            try {
              const res = await put(`/api/v1/schedules/swap-requests/${requestId}`, {
                status: isApproved ? 'approved' : 'rejected',
                reviewNotes: 'Đã xử lý bởi Admin.',
              });
              if (res && res.success) {
                Alert.alert('Xử lý thành công', res.message || 'Đã cập nhật trạng thái yêu cầu.');
                fetchSwapRequests();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xử lý yêu cầu.');
            }
          },
        },
      ]
    );
  };

  // Formatting Date labels
  const formatWeekRange = () => {
    const monday = weekDates[0];
    const sunday = weekDates[6];
    return `Tuần từ ${monday.getDate()}/${monday.getMonth() + 1} đến ${sunday.getDate()}/${sunday.getMonth() + 1}/${sunday.getFullYear()}`;
  };

  const getRoleLabel = (role) => {
    if (role === 'doctor') return 'Bác sĩ';
    if (role === 'nurse') return 'Điều dưỡng';
    return role;
  };


  return (
    <ResponsiveLayout navigation={navigation} activeRoute="StaffScheduling">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Lịch làm việc & Phân ca nhân sự</Text>
            <Text style={styles.subtitle}>
              Xếp ca trực nhật, quản lý thời khóa biểu hàng tuần và phê duyệt các yêu cầu đổi ca trực.
            </Text>
          </View>

          {/* Tab buttons */}
          <View style={styles.tabBar}>
            {isHospitalAdmin && (
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'weekly' && styles.tabButtonActive]}
                onPress={() => setActiveTab('weekly')}
              >
                <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
                  🗓️ Toàn bộ thời khóa biểu
                </Text>
              </TouchableOpacity>
            )}
            
            {!isHospitalAdmin && (
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'my-schedule' && styles.tabButtonActive]}
                onPress={() => setActiveTab('my-schedule')}
              >
                <Text style={[styles.tabText, activeTab === 'my-schedule' && styles.tabTextActive]}>
                  👤 Lịch làm của tôi
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'swap' && styles.tabButtonActive]}
              onPress={() => setActiveTab('swap')}
            >
              <Text style={[styles.tabText, activeTab === 'swap' && styles.tabTextActive]}>
                🔄 Yêu cầu đổi ca
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: WEEKLY GRID */}
          {activeTab === 'weekly' && (
            <View style={styles.card}>
              <View style={styles.weekNavRow}>
                <TouchableOpacity style={styles.navBtn} onPress={handlePrevWeek}>
                  <Text style={styles.navBtnText}>◀ Tuần trước</Text>
                </TouchableOpacity>
                <Text style={styles.weekRangeTitle}>{formatWeekRange()}</Text>
                <TouchableOpacity style={styles.navBtn} onPress={handleNextWeek}>
                  <Text style={styles.navBtnText}>Tuần sau ▶</Text>
                </TouchableOpacity>
              </View>

              {/* Advanced Role Filter for Managing MRI Modalities */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>🔍 Lọc nhân sự buồng máy:</Text>
                <View style={styles.filterSelectWrapper}>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      paddingHorizontal: 10,
                      fontSize: 12,
                      color: '#0F172A',
                      border: 'none',
                      backgroundColor: 'transparent',
                      outline: 'none',
                    }}
                  >
                    <option value="">Tất cả chức vụ</option>
                    <option value="doctor">Bác sĩ</option>
                    <option value="nurse">Điều dưỡng</option>
                  </select>
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 15 }}>
                  <View style={styles.table}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                      <View style={[styles.tableTh, { width: 140 }]}>
                        <Text style={styles.tableThText}>Nhân viên</Text>
                      </View>
                      {weekDates.map((date, idx) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                          <View key={idx} style={[styles.tableTh, { width: 100 }, isToday && styles.thToday]}>
                            <Text style={[styles.tableThText, isToday && { color: '#15803D' }]}>
                              {DAYS_OF_WEEK.find((d) => d.key === date.getDay())?.label}
                            </Text>
                            <Text style={styles.thSub}>{` (${date.getDate()}/${date.getMonth() + 1})`}</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Data Rows */}
                    {staffList
                      .filter((staff) => !['patient', 'admin', 'hospital_admin'].includes(staff.role))
                      .filter((staff) => !roleFilter || staff.role === roleFilter)
                      .map((staff) => (
                        <View key={staff._id} style={styles.tableTr}>
                          <View style={[styles.tableTdNameCol, { width: 140 }]}>
                            <Text style={styles.staffNameText}>{staff.profile?.name || 'Nhân viên'}</Text>
                            <Text style={styles.staffRoleText}>{getRoleLabel(staff.role)}</Text>
                          </View>
                          {weekDates.map((date, idx) => {
                            const sched = findSchedule(staff._id, date);
                            const shiftStyle = sched ? SHIFT_COLORS[sched.shift] : null;
                            return (
                              <TouchableOpacity
                                key={idx}
                                style={[styles.tableTdCell, { width: 100 }]}
                                onPress={() => handleCellPress(staff, date)}
                                disabled={!isHospitalAdmin && staff._id !== currentUser?.id}
                              >
                                {sched ? (
                                  <View style={{
                                    backgroundColor: shiftStyle.bg,
                                    borderColor: sched.status === 'pending' ? '#F59E0B' : shiftStyle.border,
                                    color: shiftStyle.text,
                                    borderWidth: 1,
                                    borderStyle: sched.status === 'pending' ? 'dashed' : 'solid',
                                    padding: 6,
                                    borderRadius: 6,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    opacity: sched.status === 'pending' ? 0.7 : 1
                                  }}>
                                    <Text style={{
                                      color: shiftStyle.text,
                                      fontSize: 11,
                                      textAlign: 'center',
                                      fontWeight: '600'
                                    }}>
                                      {SHIFT_LABELS[sched.shift]}
                                    </Text>
                                    {sched.status === 'pending' && (
                                      <Text style={{ fontSize: 9, color: '#D97706', marginTop: 2, fontWeight: 'bold' }}>Chờ duyệt</Text>
                                    )}
                                    {sched.startTime && sched.status !== 'pending' ? (
                                      <Text style={[styles.cellTime, { color: shiftStyle.text }]}>
                                        {`\n${sched.startTime}-${sched.endTime}`}
                                      </Text>
                                    ) : null}
                                  </View>
                                ) : (
                                  <View style={isHospitalAdmin || staff._id === currentUser?.id ? styles.emptyCellAdmin : styles.emptyCell}>
                                    <Text style={isHospitalAdmin || staff._id === currentUser?.id ? styles.emptyCellAdminText : styles.emptyCellText}>
                                      {isHospitalAdmin || staff._id === currentUser?.id ? '➕ Xếp ca' : 'Nghỉ'}
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 2: MY SCHEDULE */}
          {activeTab === 'my-schedule' && (
            <View style={styles.card}>
              <View style={styles.weekNavRow}>
                <TouchableOpacity style={styles.navBtn} onPress={handlePrevWeek}>
                  <Text style={styles.navBtnText}>◀ Tuần trước</Text>
                </TouchableOpacity>
                <Text style={styles.weekRangeTitle}>{formatWeekRange()}</Text>
                <TouchableOpacity style={styles.navBtn} onPress={handleNextWeek}>
                  <Text style={styles.navBtnText}>Tuần sau ▶</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              ) : (
                <View style={styles.mySchedulesList}>
                  {weekDates.map((date, idx) => {
                    const sched = currentUser ? findSchedule(currentUser.id, date) : null;
                    const shiftStyle = sched ? SHIFT_COLORS[sched.shift] : null;
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <View key={idx} style={[styles.myScheduleDayCard, isToday && styles.myDayToday]}>
                        <View style={styles.myDayHeader}>
                          <Text style={styles.myDayLabel}>
                            {DAYS_OF_WEEK.find((d) => d.key === date.getDay())?.label} ({date.getDate()}/{date.getMonth() + 1})
                          </Text>
                          {isToday && <Text style={styles.todayBadge}>Hôm nay</Text>}
                        </View>

                        {sched ? (
                          <View style={styles.myShiftDetails}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={{
                                backgroundColor: shiftStyle.bg,
                                color: shiftStyle.text,
                                borderColor: shiftStyle.border,
                                borderWidth: 1,
                                paddingVertical: 3,
                                paddingHorizontal: 10,
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 'bold'
                              }}>
                                {SHIFT_LABELS[sched.shift]}
                              </Text>
                              {sched.startTime && (
                                <Text style={styles.myShiftTime}>
                                  Thời gian: {sched.startTime} - {sched.endTime}
                                </Text>
                              )}
                            </View>
                            {sched.notes ? (
                              <Text style={styles.myShiftNotes}>Ghi chú: {sched.notes}</Text>
                            ) : null}
                            
                            <TouchableOpacity
                              style={styles.btnSwapRequest}
                              onPress={() => handleOpenSwapModal(sched)}
                            >
                              <Text style={styles.btnSwapText}>🔄 Yêu cầu đổi ca làm việc</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.myShiftEmpty}>
                            <Text style={styles.myShiftEmptyText}>Không có ca làm việc được phân (Nghỉ)</Text>
                            <TouchableOpacity
                              style={[styles.btnSwapRequest, { backgroundColor: '#10B981', marginTop: 8, alignSelf: 'flex-start' }]}
                              onPress={() => handleCellPress(currentUser, date)}
                            >
                              <Text style={styles.btnSwapText}>➕ Đăng ký ca làm việc</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: SWAP REQUESTS */}
          {activeTab === 'swap' && (
            <View style={styles.card}>
              <View style={styles.listHeader}>
                <Text style={styles.cardTitle}>🔄 Phê duyệt yêu cầu đổi ca trực</Text>
                <Text style={styles.cardSub}>
                  {isHospitalAdmin
                    ? 'Danh sách các đề xuất đổi hoặc bàn giao ca làm việc cần quản lý phê duyệt.'
                    : 'Danh sách các yêu cầu đổi ca làm của bạn.'}
                </Text>
              </View>

              {swapRequests.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Không có yêu cầu đổi ca nào.</Text>
                </View>
              ) : (
                <View style={styles.requestsList}>
                  {swapRequests.map((req) => {
                    const originalDate = req.scheduleId ? new Date(req.scheduleId.date).toLocaleDateString('vi-VN') : '—';
                    const targetDateFormatted = req.targetDate ? new Date(req.targetDate).toLocaleDateString('vi-VN') : '—';
                    return (
                      <View key={req._id} style={styles.requestCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reqHeader}>
                            🧑‍⚕️ {req.requesterId?.profile?.name || 'Nhân sự'} ({getRoleLabel(req.requesterId?.role)})
                          </Text>
                          <Text style={styles.reqDetails}>
                            • Muốn đổi ca:{' '}
                            <Text style={{ fontWeight: 'bold' }}>
                              {req.scheduleId ? SHIFT_LABELS[req.scheduleId.shift] : ''} ({originalDate})
                            </Text>
                          </Text>
                          <Text style={styles.reqDetails}>
                            • Sang ngày:{' '}
                            <Text style={{ fontWeight: 'bold', color: '#15803D' }}>{targetDateFormatted}</Text>
                          </Text>
                          {req.targetStaffId && (
                            <Text style={styles.reqDetails}>
                              • Đổi cùng nhân sự:{' '}
                              <Text style={{ fontWeight: 'bold' }}>{req.targetStaffId?.profile?.name}</Text>
                            </Text>
                          )}
                          {req.reason ? (
                            <Text style={styles.reqReason}>Lý do: "{req.reason}"</Text>
                          ) : null}
                        </View>
                        
                        <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <Text style={[
                            styles.statusBadge,
                            req.status === 'approved'
                              ? styles.badgeApproved
                              : req.status === 'rejected'
                              ? styles.badgeRejected
                              : styles.badgePending
                          ]}>
                            {req.status === 'approved'
                              ? 'Đã duyệt'
                              : req.status === 'rejected'
                              ? 'Từ chối'
                              : 'Chờ duyệt'}
                          </Text>

                          {isHospitalAdmin && req.status === 'pending' && (
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                              <TouchableOpacity
                                style={styles.btnReject}
                                onPress={() => handleReviewSwap(req._id, false)}
                              >
                                <Text style={styles.btnRejectText}>Từ chối</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.btnApprove}
                                onPress={() => handleReviewSwap(req._id, true)}
                              >
                                <Text style={styles.btnApproveText}>Duyệt</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* SCHEDULE MODAL (ASSIGN SHIFT) */}
      {showScheduleModal && (
        <Modal
          visible={showScheduleModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {!isHospitalAdmin ? '📝 Đăng ký ca làm việc' : (selectedSchedule ? '✏️ Cập nhật ca làm việc' : '➕ Phân ca làm việc')}
              </Text>
              {selectedStaff && (
                <Text style={styles.modalSub}>
                  Nhân sự: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedStaff.profile?.name}</Text>
                  {`\n`}Ngày trực: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedDate.toLocaleDateString('vi-VN')}</Text>
                </Text>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Ca làm việc *</Text>
                <View style={styles.selectWrapper}>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderWidth: 0,
                      backgroundColor: 'transparent',
                      paddingHorizontal: 10,
                      fontSize: 13,
                      color: '#0F172A',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="sáng">Ca Sáng (🌅)</option>
                    <option value="chiều">Ca Chiều (☀️)</option>
                    <option value="tối">Ca Tối (🌙)</option>
                    <option value="cả ngày">Cả Ngày (🕒)</option>
                  </select>
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Giờ bắt đầu</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="07:00"
                    placeholderTextColor="#94A3B8"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Giờ kết thúc</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="15:00"
                    placeholderTextColor="#94A3B8"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Ghi chú ca trực</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: Trực phòng cấp cứu..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {isHospitalAdmin && (
                <View style={styles.field}>
                  <Text style={styles.label}>Trạng thái phê duyệt</Text>
                  <View style={styles.selectWrapper}>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        paddingHorizontal: 10,
                        fontSize: 13,
                        color: status === 'pending' ? '#F59E0B' : '#15803D',
                        fontWeight: 'bold',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="confirmed">Đã phê duyệt (Confirmed)</option>
                      <option value="pending">Chờ phê duyệt (Pending)</option>
                      <option value="off">Nghỉ (Off)</option>
                    </select>
                  </View>
                </View>
              )}

              <View style={styles.modalFooter}>
                {selectedSchedule && (
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={handleDeleteSchedule}
                    disabled={submitting}
                  >
                    <Text style={styles.modalDeleteText}>Xóa ca</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flexDirection: 'row', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowScheduleModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, submitting && styles.buttonDisabled]}
                    onPress={handleSaveSchedule}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Lưu lịch</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* SWAP REQUEST MODAL */}
      {showSwapModal && swapSchedule && (
        <Modal
          visible={showSwapModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSwapModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>🔄 Tạo yêu cầu đổi ca trực</Text>
              <Text style={styles.modalSub}>
                Đang chọn ca: {SHIFT_LABELS[swapSchedule.shift]} ngày {new Date(swapSchedule.date).toLocaleDateString('vi-VN')}
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Đổi sang ngày (YYYY-MM-DD) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 2026-07-05"
                  placeholderTextColor="#94A3B8"
                  value={targetDateStr}
                  onChangeText={setTargetDateStr}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Đổi cùng với nhân sự (Để trống nếu muốn nhường ca)</Text>
                <View style={styles.selectWrapper}>
                  <select
                    value={targetStaffId}
                    onChange={(e) => setTargetStaffId(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderWidth: 0,
                      backgroundColor: 'transparent',
                      paddingHorizontal: 10,
                      fontSize: 13,
                      color: '#0F172A',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Chọn nhân sự đổi chéo (Không bắt buộc)</option>
                    {staffList
                      .filter((s) => s._id !== currentUser?.id)
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.profile?.name} ({getRoleLabel(s.role)})
                        </option>
                      ))}
                  </select>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Lý do xin đổi ca *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: Trùng lịch học chuyên sâu..."
                  placeholderTextColor="#94A3B8"
                  value={swapReason}
                  onChangeText={setSwapReason}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSwapModal(false)}
                >
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, submitting && styles.buttonDisabled]}
                  onPress={handleSwapSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Gửi yêu cầu</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, gap: 20 },
  titleContainer: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 16 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 8 },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#15803D' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#15803D', fontWeight: 'bold' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  cardSub: { fontSize: 11, color: '#64748B', marginBottom: 16, lineHeight: 16 },
  weekNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  navBtnText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  weekRangeTitle: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  emptyBox: { paddingVertical: 60, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 },
  emptyText: { color: '#94A3B8', fontSize: 12 },
  
  // Weekly Grid Table
  table: { flexDirection: 'column', marginTop: 10, minWidth: 840 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  tableTh: { paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  tableThText: { fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center' },
  thSub: { fontSize: 9, color: '#94A3B8' },
  thToday: { backgroundColor: '#DCFCE7' },
  tableTr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  tableTdNameCol: { paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  staffNameText: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  staffRoleText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  tableTdCell: { padding: 8, justifyContent: 'center' },
  cellTime: { fontSize: 9, fontWeight: 'normal', textAlign: 'center' },
  emptyCell: { width: '100%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  emptyCellText: { fontSize: 11, color: '#CBD5E1', textAlign: 'center' },
  emptyCellAdmin: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingVertical: 8, backgroundColor: '#F8FAFC', width: '100%', alignItems: 'center', justifyContent: 'center' },
  emptyCellAdminText: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  // My schedule Day Cards
  mySchedulesList: { gap: 12 },
  myScheduleDayCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  myDayToday: { borderColor: '#15803D', backgroundColor: '#F0FDF4' },
  myDayHeader: { flex: 1 },
  myDayLabel: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  todayBadge: { backgroundColor: '#15803D', color: '#FFFFFF', paddingVertical: 1, paddingHorizontal: 6, borderRadius: 4, fontSize: 9, fontWeight: 'bold', marginLeft: 8 },
  myShiftDetails: { flex: 2, alignItems: 'flex-end', gap: 6 },
  myShiftTime: { fontSize: 12, color: '#475569' },
  myShiftNotes: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
  btnSwapRequest: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  btnSwapText: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
  myShiftEmpty: { flex: 2, alignItems: 'flex-end' },
  myShiftEmptyText: { fontSize: 12, color: '#94A3B8' },

  // Swap requests
  listHeader: { marginBottom: 16 },
  requestsList: { gap: 12 },
  requestCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  reqHeader: { fontSize: 13, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  reqDetails: { fontSize: 12, color: '#475569', marginBottom: 2 },
  reqReason: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: '10px', fontWeight: 'bold', alignSelf: 'flex-end' },
  badgePending: { backgroundColor: '#FEF3C7', color: '#D97706' },
  badgeApproved: { backgroundColor: '#DCFCE7', color: '#15803D' },
  badgeRejected: { backgroundColor: '#FEE2E2', color: '#DC2626' },
  btnReject: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 6 },
  btnRejectText: { fontSize: 11, fontWeight: 'bold', color: '#DC2626' },
  btnApprove: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#15803D', borderRadius: 6 },
  btnApproveText: { fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  filterSelectWrapper: {
    width: 200,
    height: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  filterHtmlSelect: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, borderHeight: 1, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 20, lineHeight: 18 },
  field: { marginBottom: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  input: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC', color: '#0F172A', outlineStyle: 'none' },
  selectWrapper: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  htmlSelect: { width: '100%', height: '100%', borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 10, fontSize: 13, color: '#0F172A', outlineStyle: 'none', cursor: 'pointer' },
  modalFooter: { flexDirection: 'row', marginTop: 15, gap: 10 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  modalSubmitBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#15803D', justifyContent: 'center', alignItems: 'center' },
  modalSubmitText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  modalDeleteBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  modalDeleteText: { fontSize: 12, fontWeight: 'bold', color: '#DC2626' },
  buttonDisabled: { opacity: 0.7 },
});
