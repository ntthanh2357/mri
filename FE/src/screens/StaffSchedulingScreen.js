import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { ReceptionScheduleHeader, ReceptionWeekStrip, weekHoursOf } from '../components/reception/ReceptionSchedule';
import { get, post, put, del } from '../services/api.service';
import {
  Calendar,
  User,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Edit2,
  Clock,
  PlusCircle,
  ArrowLeftRight,
  CheckCircle2,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  Check,
  X,
  Trash2,
  CalendarCheck,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

const SHIFT_CONFIG = {
  'sáng': {
    label: 'Ca Sáng',
    time: '07:00 - 15:00',
    startTime: '07:00',
    endTime: '15:00',
    icon: Sun,
    bg: '#FEF3C7',
    border: '#FCD34D',
    text: '#B45309',
    badgeBg: '#FFFBEB',
  },
  'chiều': {
    label: 'Ca Chiều',
    time: '14:00 - 22:00',
    startTime: '14:00',
    endTime: '22:00',
    icon: Sunset,
    bg: '#E7F0FE',
    border: '#93C5FD',
    text: '#1D4ED8',
    badgeBg: '#F0F9FF',
  },
  'tối': {
    label: 'Ca Đêm',
    time: '22:00 - 06:00',
    startTime: '22:00',
    endTime: '06:00',
    icon: Moon,
    bg: '#F3E8FF',
    border: '#D8B4FE',
    text: '#6D28D9',
    badgeBg: '#FAF5FF',
  },
  'cả ngày': {
    label: 'Trực 24 Giờ',
    time: '07:00 - 07:00',
    startTime: '07:00',
    endTime: '07:00',
    icon: Clock,
    bg: '#D1FAE5',
    border: '#6EE7B7',
    text: '#047857',
    badgeBg: '#ECFDF5',
  },
};

const DAYS_OF_WEEK = [
  { label: 'Thứ 2', short: 'T2', key: 1 },
  { label: 'Thứ 3', short: 'T3', key: 2 },
  { label: 'Thứ 4', short: 'T4', key: 3 },
  { label: 'Thứ 5', short: 'T5', key: 4 },
  { label: 'Thứ 6', short: 'T6', key: 5 },
  { label: 'Thứ 7', short: 'T7', key: 6 },
  { label: 'Chủ Nhật', short: 'CN', key: 0 },
];

/** Format Date object or ISO string to standard YYYY-MM-DD */
const formatDateKey = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Get Monday 00:00:00 of the week containing the given date */
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const timeToMinutes = (t) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isTimeOverlap = (aStart, aEnd, bStart, bEnd) => {
  const s1 = timeToMinutes(aStart);
  const e1 = timeToMinutes(aEnd);
  const s2 = timeToMinutes(bStart);
  const e2 = timeToMinutes(bEnd);
  if (s1 === null || e1 === null || s2 === null || e2 === null) return false;
  return s1 < e2 && s2 < e1;
};

export default function StaffSchedulingScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Tabs: 'weekly' | 'my-schedule' | 'registrations' | 'swap'
  const [activeTab, setActiveTab] = useState('weekly');
  const [currentUser, setCurrentUser] = useState(null);

  // Weekly Grid Data
  const [staffList, setStaffList] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Shift Registrations & Swap Requests
  const [registrations, setRegistrations] = useState([]);
  const [registrationFilter, setRegistrationFilter] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'rejected'
  const [swapRequests, setSwapRequests] = useState([]);

  // Modal: Create / Register / Edit Shift
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Form Fields
  const [shift, setShift] = useState('sáng');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('confirmed');

  // Modal: Swap Request
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSchedule, setSwapSchedule] = useState(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [targetDateStr, setTargetDateStr] = useState('');
  const [swapReason, setSwapReason] = useState('');

  // Modal: Admin Reject Registration with Reason
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Cross-Platform Confirmation Dialog
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);
  const showDialog = (title, message, buttons = [{ text: 'Đóng' }]) => {
    setDialog({
      title,
      message,
      buttons: buttons.map((b) => ({
        ...b,
        onPress: () => {
          closeDialog();
          b.onPress?.();
        },
      })),
    });
  };

  const isHospitalAdmin = useMemo(() => {
    return ['hospital_admin', 'admin', 'system_admin'].includes(currentUser?.role);
  }, [currentUser]);

  // Fetch Current User
  const fetchCurrentUser = async () => {
    try {
      const res = await get('/auth/me');
      if (res && res.user) {
        const u = { ...res.user, id: res.user._id || res.user.id };
        setCurrentUser(u);
        if (!['hospital_admin', 'admin', 'system_admin'].includes(u.role)) {
          setActiveTab('my-schedule');
        }
      }
    } catch (err) {
      console.error('Lỗi lấy thông tin User:', err);
    }
  };

  // Fetch Staff List
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

  // Fetch Weekly Schedules
  const fetchWeeklySchedules = async () => {
    setLoading(true);
    try {
      const mondayStr = formatDateKey(currentWeekStart);
      const res = await get(`/api/v1/schedules?week=${mondayStr}`);
      if (res && res.success) {
        setWeeklySchedules(res.data?.schedules || []);
      }
    } catch (err) {
      console.error('Lỗi lấy lịch tuần:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Registrations
  const fetchRegistrations = async () => {
    try {
      const queryParam = registrationFilter !== 'all' ? `?status=${registrationFilter}` : '';
      const res = await get(`/api/v1/schedules/registrations${queryParam}`);
      if (res && res.success) {
        setRegistrations(res.data?.registrations || []);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách đăng ký ca:', err);
    }
  };

  // Fetch Swap Requests
  const fetchSwapRequests = async () => {
    try {
      const res = await get('/api/v1/schedules/swap-requests');
      if (res && res.success) {
        setSwapRequests(res.data?.requests || []);
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
    } else if (activeTab === 'registrations') {
      fetchRegistrations();
    } else if (activeTab === 'swap') {
      fetchSwapRequests();
    }
  }, [activeTab, currentWeekStart, registrationFilter]);

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

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  // 7 Dates of the current week (Mon -> Sun)
  const weekDates = useMemo(() => {
    const dates = [];
    const monday = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentWeekStart]);

  // Format Week Range Display String
  const formatWeekRange = () => {
    const monday = weekDates[0];
    const sunday = weekDates[6];
    return `Tuần từ ${monday.getDate()}/${monday.getMonth() + 1} đến ${sunday.getDate()}/${sunday.getMonth() + 1}/${sunday.getFullYear()}`;
  };

  // Find schedules for staff and date using safe YYYY-MM-DD key comparison
  const findSchedules = (staffId, date) => {
    const targetKey = formatDateKey(date);
    return weeklySchedules.filter((s) => {
      const sStaffId = s.staffId?._id || s.staffId?.id || s.staffId;
      return sStaffId === staffId && formatDateKey(s.date) === targetKey;
    });
  };

  // Select a preset shift in modal
  const handleSelectShiftPreset = (shiftType) => {
    setShift(shiftType);
    const cfg = SHIFT_CONFIG[shiftType];
    if (cfg) {
      setStartTime(cfg.startTime);
      setEndTime(cfg.endTime);
    }
  };

  // Open Modal: Staff Self-Register for a specific date
  const handleOpenSelfRegister = (date = new Date()) => {
    setSelectedSchedule(null);
    setSelectedStaff(currentUser);
    setSelectedDate(date);
    handleSelectShiftPreset('sáng');
    setNotes('');
    setStatus('pending');
    setShowScheduleModal(true);
  };

  // Open Modal: Admin Add Shift for a specific staff/date
  const handleOpenAdminAddShift = (staff, date) => {
    setSelectedSchedule(null);
    setSelectedStaff(staff);
    setSelectedDate(date);
    handleSelectShiftPreset('sáng');
    setNotes('');
    setStatus('confirmed');
    setShowScheduleModal(true);
  };

  // Open Modal: Edit existing shift (Admin only, or staff if viewing)
  const handleOpenEditShift = (sched, staff, date) => {
    setSelectedSchedule(sched);
    setSelectedStaff(staff || sched.staffId);
    setSelectedDate(new Date(sched.date));
    setShift(sched.shift);
    setStartTime(sched.startTime || SHIFT_CONFIG[sched.shift]?.startTime || '07:00');
    setEndTime(sched.endTime || SHIFT_CONFIG[sched.shift]?.endTime || '15:00');
    setNotes(sched.notes || '');
    setStatus(sched.status || 'confirmed');
    setShowScheduleModal(true);
  };

  // Perform Save Schedule (Register vs Admin Assign)
  const performSaveSchedule = async () => {
    setSubmitting(true);
    try {
      const targetDateKey = formatDateKey(selectedDate);
      let res;

      if (selectedSchedule) {
        // Update existing schedule (Admin)
        res = await put(`/api/v1/schedules/${selectedSchedule._id}`, {
          shift,
          startTime,
          endTime,
          notes,
          status,
        });
      } else if (isHospitalAdmin && selectedStaff?._id !== currentUser?.id) {
        // Admin assigns a shift directly to a staff member
        res = await post('/api/v1/schedules', {
          staffId: selectedStaff._id || selectedStaff.id,
          date: targetDateKey,
          shift,
          startTime,
          endTime,
          notes,
          status,
        });
      } else {
        // Staff self-registers for a shift (or Admin self-registers)
        res = await post('/api/v1/schedules/register', {
          date: targetDateKey,
          shift,
          startTime,
          endTime,
          notes,
        });
      }

      if (res && res.success) {
        showDialog(
          'Thành công',
          selectedSchedule
            ? 'Đã cập nhật ca làm việc thành công!'
            : isHospitalAdmin && selectedStaff?._id !== currentUser?.id
            ? 'Đã phân ca làm việc thành công cho nhân sự!'
            : 'Đã gửi phiếu đăng ký ca trực thành công! Vui lòng chờ Trưởng khoa phê duyệt.'
        );
        setShowScheduleModal(false);
        fetchWeeklySchedules();
        fetchRegistrations();
      }
    } catch (err) {
      showDialog('Lỗi', err.message || 'Không thể lưu lịch làm việc. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Save Schedule with Overlap Warning
  const handleSaveSchedule = () => {
    const staffId = selectedStaff?._id || selectedStaff?.id;
    const siblingShifts = findSchedules(staffId, selectedDate).filter(
      (s) => !selectedSchedule || s._id !== selectedSchedule._id
    );

    const conflict = siblingShifts.find((s) => isTimeOverlap(startTime, endTime, s.startTime, s.endTime));

    if (conflict) {
      showDialog(
        'Trùng giờ ca trực',
        `Ca này (${startTime}-${endTime}) chồng giờ với ${SHIFT_CONFIG[conflict.shift]?.label || conflict.shift} (${conflict.startTime}-${conflict.endTime}) đã có trong ngày. Bạn có chắc chắn muốn tiếp tục lưu?`,
        [
          { text: 'Hủy bỏ', style: 'cancel' },
          { text: 'Vẫn tiếp tục', onPress: performSaveSchedule },
        ]
      );
      return;
    }

    performSaveSchedule();
  };

  // Delete Schedule
  const handleDeleteSchedule = () => {
    if (!selectedSchedule) return;
    showDialog(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa ca làm việc này khỏi hệ thống không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa ca',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await del(`/api/v1/schedules/${selectedSchedule._id}`);
              if (res && res.success) {
                showDialog('Đã xóa', 'Đã xóa ca làm việc thành công.');
                setShowScheduleModal(false);
                fetchWeeklySchedules();
                fetchRegistrations();
              }
            } catch (err) {
              showDialog('Lỗi', err.message || 'Không thể xóa ca làm này.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Cancel My Pending Registration
  const handleCancelRegistration = (regId) => {
    showDialog(
      'Hủy đăng ký ca',
      'Bạn có chắc muốn hủy phiếu đăng ký ca trực này?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đăng ký',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await del(`/api/v1/schedules/registrations/${regId}`);
              if (res && res.success) {
                showDialog('Đã hủy', 'Đã hủy phiếu đăng ký ca trực thành công.');
                fetchWeeklySchedules();
                fetchRegistrations();
              }
            } catch (err) {
              showDialog('Lỗi', err.message || 'Không thể hủy ca trực này.');
            }
          },
        },
      ]
    );
  };

  // Admin Approve Shift Registration
  const handleApproveRegistration = async (regId) => {
    try {
      const res = await put(`/api/v1/schedules/registrations/${regId}/review`, {
        status: 'confirmed',
        reviewNotes: 'Đã phê duyệt ca trực.',
      });
      if (res && res.success) {
        showDialog('Phê duyệt thành công', 'Ca trực đã được phê duyệt và cập nhật vào thời khóa biểu tuần!');
        fetchRegistrations();
        fetchWeeklySchedules();
      }
    } catch (err) {
      showDialog('Lỗi', err.message || 'Không thể duyệt ca trực.');
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (item) => {
    setRejectingItem(item);
    setRejectNotes('');
    setShowRejectModal(true);
  };

  // Submit Rejection
  const handleSubmitRejection = async () => {
    if (!rejectingItem) return;
    try {
      const res = await put(`/api/v1/schedules/registrations/${rejectingItem._id}/review`, {
        status: 'rejected',
        reviewNotes: rejectNotes.trim() || 'Trưởng khoa từ chối xếp ca này do đủ nhân sự.',
      });
      if (res && res.success) {
        showDialog('Đã từ chối', 'Đã từ chối phiếu đăng ký ca trực.');
        setShowRejectModal(false);
        fetchRegistrations();
        fetchWeeklySchedules();
      }
    } catch (err) {
      showDialog('Lỗi', err.message || 'Không thể từ chối ca trực.');
    }
  };

  // Open Swap Request Modal
  const handleOpenSwapModal = (schedule) => {
    setSwapSchedule(schedule);
    setTargetStaffId('');
    setTargetDateStr('');
    setSwapReason('');
    setShowSwapModal(true);
  };

  // Submit Swap Request
  const handleSwapSubmit = async () => {
    if (!targetDateStr.trim()) {
      showDialog('Thiếu thông tin', 'Vui lòng nhập ngày bạn muốn đổi ca sang (YYYY-MM-DD).');
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
        showDialog('Thành công', 'Đã gửi yêu cầu đổi ca trực thành công! Đang chờ Trưởng khoa phê duyệt.');
        setShowSwapModal(false);
        fetchWeeklySchedules();
        fetchSwapRequests();
      }
    } catch (err) {
      showDialog('Thất bại', err.message || 'Không thể tạo yêu cầu đổi ca.');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin Review Swap Request
  const handleReviewSwap = (requestId, isApproved) => {
    showDialog(
      isApproved ? 'Duyệt đổi ca' : 'Từ chối đổi ca',
      `Bạn có chắc chắn muốn ${isApproved ? 'đồng ý phê duyệt' : 'từ chối'} yêu cầu đổi ca này?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isApproved ? 'Duyệt ca' : 'Từ chối',
          onPress: async () => {
            try {
              const res = await put(`/api/v1/schedules/swap-requests/${requestId}`, {
                status: isApproved ? 'approved' : 'rejected',
                reviewNotes: isApproved ? 'Đã duyệt đổi ca trực.' : 'Không thể bố trí đổi ca.',
              });
              if (res && res.success) {
                showDialog('Hoàn tất', res.message || 'Đã cập nhật trạng thái yêu cầu đổi ca.');
                fetchSwapRequests();
                fetchWeeklySchedules();
              }
            } catch (err) {
              showDialog('Lỗi', err.message || 'Không thể xử lý yêu cầu đổi ca.');
            }
          },
        },
      ]
    );
  };

  // Role Labels
  const getRoleLabel = (role) => {
    switch (role) {
      case 'doctor':
        return 'Bác sĩ Ung Thư Não';
      case 'nurse':
        return 'Điều dưỡng Hồi sức & Chăm sóc';
      case 'technician':
        return 'KTV CĐHA & MRI 3.0T';
      case 'receptionist':
        return 'Nhân viên Tiếp đón & Phân luồng';
      case 'hospital_admin':
        return 'Trưởng Khoa / Lãnh đạo BV';
      case 'admin':
        return 'Quản trị viên Hệ thống';
      default:
        return role || 'Nhân sự';
    }
  };

  // KPI Metrics Calculation
  const kpiStats = useMemo(() => {
    const totalWeekly = weeklySchedules.length;
    const confirmedCount = weeklySchedules.filter((s) => s.status === 'confirmed').length;
    const pendingCount = weeklySchedules.filter((s) => s.status === 'pending').length;
    const swapCount = swapRequests.filter((r) => r.status === 'pending').length;
    return { totalWeekly, confirmedCount, pendingCount, swapCount };
  }, [weeklySchedules, swapRequests]);

  // Lễ tân dùng bố cục lịch riêng (banner + dải 7 ngày)
  const isReceptionistUser = currentUser?.role === 'receptionist';
  const findMine = (date) => (currentUser ? findSchedules(currentUser.id, date) : []);
  const myWeekSchedules = weekDates.flatMap((d) => findMine(d));
  const todayKey = formatDateKey(new Date());
  const nextShift = myWeekSchedules
    .filter((x) => x.status !== 'rejected' && formatDateKey(x.date) >= todayKey)
    .sort((a, b) => formatDateKey(a.date).localeCompare(formatDateKey(b.date)) || String(a.startTime).localeCompare(String(b.startTime)))[0] || null;

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="StaffScheduling">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {isReceptionistUser ? (
            <ReceptionScheduleHeader
              nextShift={nextShift}
              shiftConfig={SHIFT_CONFIG}
              weekHours={Math.round(weekHoursOf(myWeekSchedules, SHIFT_CONFIG))}
              kpi={kpiStats}
              activeTab={activeTab}
              onTab={setActiveTab}
              onRegister={() => handleOpenSelfRegister(new Date())}
              onRefresh={() => { fetchWeeklySchedules(); fetchRegistrations(); fetchSwapRequests(); }}
            />
          ) : (
          <>
          {/* Header Hero Banner */}
          <View style={styles.headerHero}>
            <View style={styles.headerHeroLeft}>
              <View style={styles.badgePill}>
                <Sparkles size={12} color="#1A5FD0" />
                <Text style={styles.badgePillText}>HỆ THỐNG PHÂN CA & ĐĂNG KÝ TRỰC LÂM SÀNG</Text>
              </View>
              <Text style={styles.heroTitle}>Lịch Làm Việc & Phân Ca Nhân Sự</Text>
              <Text style={styles.heroSub}>
                Phân bổ kíp trực buồng máy MRI 3.0T, điều dưỡng chăm sóc, tiếp đón và phê duyệt điều chuyển ca trực chuẩn y khoa.
              </Text>
            </View>

            <View style={styles.headerHeroActions}>
              <TouchableOpacity
                style={styles.btnPrimaryRegister}
                onPress={() => handleOpenSelfRegister(new Date())}
              >
                <PlusCircle size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryRegisterText}>Đăng ký ca làm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondaryRefresh}
                onPress={() => {
                  fetchWeeklySchedules();
                  fetchRegistrations();
                  fetchSwapRequests();
                }}
              >
                <RefreshCw size={14} color="#0F172A" />
                <Text style={styles.btnSecondaryRefreshText}>Làm mới</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* KPI Stat Cards */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#E7F0FE' }]}>
                <Calendar size={18} color="#0284C7" />
              </View>
              <View>
                <Text style={styles.kpiValue}>{kpiStats.totalWeekly}</Text>
                <Text style={styles.kpiLabel}>Tổng ca tuần này</Text>
              </View>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#D5F5E7' }]}>
                <CheckCircle2 size={18} color="#0F9D6B" />
              </View>
              <View>
                <Text style={styles.kpiValue}>{kpiStats.confirmedCount}</Text>
                <Text style={styles.kpiLabel}>Ca đã phê duyệt</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, kpiStats.pendingCount > 0 && styles.kpiCardHighlight]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={18} color="#D97706" />
              </View>
              <View>
                <Text style={[styles.kpiValue, kpiStats.pendingCount > 0 && { color: '#B45309' }]}>
                  {kpiStats.pendingCount}
                </Text>
                <Text style={styles.kpiLabel}>Ca chờ phê duyệt</Text>
              </View>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#F3E8FF' }]}>
                <ArrowLeftRight size={18} color="#7C3AED" />
              </View>
              <View>
                <Text style={styles.kpiValue}>{kpiStats.swapCount}</Text>
                <Text style={styles.kpiLabel}>Yêu cầu đổi ca</Text>
              </View>
            </View>
          </View>

          {/* Navigation Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'weekly' && styles.tabButtonActive]}
              onPress={() => setActiveTab('weekly')}
            >
              <View style={styles.tabContentRow}>
                <Calendar size={16} color={activeTab === 'weekly' ? '#1A5FD0' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
                  Thời khóa biểu toàn khoa
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'my-schedule' && styles.tabButtonActive]}
              onPress={() => setActiveTab('my-schedule')}
            >
              <View style={styles.tabContentRow}>
                <User size={16} color={activeTab === 'my-schedule' ? '#1A5FD0' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === 'my-schedule' && styles.tabTextActive]}>
                  Lịch làm của tôi
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'registrations' && styles.tabButtonActive]}
              onPress={() => setActiveTab('registrations')}
            >
              <View style={styles.tabContentRow}>
                <ClipboardList size={16} color={activeTab === 'registrations' ? '#1A5FD0' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === 'registrations' && styles.tabTextActive]}>
                  {isHospitalAdmin ? 'Duyệt đăng ký ca' : 'Đăng ký ca của tôi'}
                </Text>
                {kpiStats.pendingCount > 0 && (
                  <View style={styles.tabBadgeAmber}>
                    <Text style={styles.tabBadgeAmberText}>{kpiStats.pendingCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'swap' && styles.tabButtonActive]}
              onPress={() => setActiveTab('swap')}
            >
              <View style={styles.tabContentRow}>
                <RefreshCw size={16} color={activeTab === 'swap' ? '#1A5FD0' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === 'swap' && styles.tabTextActive]}>
                  Đổi ca trực
                </Text>
                {kpiStats.swapCount > 0 && (
                  <View style={styles.tabBadgePurple}>
                    <Text style={styles.tabBadgePurpleText}>{kpiStats.swapCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          </>
          )}

          {/* TAB 1: WEEKLY GRID */}
          {activeTab === 'weekly' && (
            <View style={styles.card}>
              {/* Controls Bar */}
              <View style={styles.gridControlsBar}>
                <View style={styles.weekNavGroup}>
                  <TouchableOpacity style={styles.navBtn} onPress={handlePrevWeek}>
                    <ChevronLeft size={16} color="#334155" />
                    <Text style={styles.navBtnText}>Tuần trước</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.todayJumpBtn} onPress={handleCurrentWeek}>
                    <CalendarCheck size={14} color="#1A5FD0" />
                    <Text style={styles.todayJumpBtnText}>Tuần này</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.navBtn} onPress={handleNextWeek}>
                    <Text style={styles.navBtnText}>Tuần sau</Text>
                    <ChevronRight size={16} color="#334155" />
                  </TouchableOpacity>

                  <Text style={styles.weekRangeTitle}>{formatWeekRange()}</Text>
                </View>

                {/* Role Filter */}
                <View style={styles.filterBox}>
                  <Filter size={14} color="#64748B" />
                  <Text style={styles.filterBoxLabel}>Khoa/Chức vụ:</Text>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={styles.filterSelectNative}
                  >
                    <option value="">Tất cả chức vụ lâm sàng</option>
                    <option value="doctor">Bác sĩ Ung Thư Não</option>
                    <option value="technician">Kỹ thuật viên CĐHA & MRI</option>
                    <option value="nurse">Điều dưỡng Chăm sóc</option>
                    <option value="receptionist">Nhân viên Tiếp đón</option>
                  </select>
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>Đang tải thời khóa biểu lâm sàng...</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 12 }}>
                  <View style={styles.table}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                      <View style={[styles.tableTh, { width: 180, alignItems: 'flex-start', paddingLeft: 16 }]}>
                        <Text style={styles.tableThText}>Nhân viên y tế</Text>
                      </View>
                      {weekDates.map((date, idx) => {
                        const isToday = isSameDay(date, new Date());
                        return (
                          <View key={idx} style={[styles.tableTh, { width: 130 }, isToday && styles.thToday]}>
                            <Text style={[styles.tableThText, isToday && { color: '#1A5FD0', fontWeight: 'bold' }]}>
                              {DAYS_OF_WEEK.find((d) => d.key === date.getDay())?.label}
                            </Text>
                            <Text style={[styles.thSub, isToday && { color: '#1A5FD0', fontWeight: 'bold' }]}>
                              {date.getDate()}/{date.getMonth() + 1}
                              {isToday ? ' (Hôm nay)' : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Staff Rows */}
                    {staffList
                      .filter((s) => !['patient', 'admin', 'system_admin'].includes(s.role))
                      .filter((s) => !roleFilter || s.role === roleFilter)
                      .map((staff) => {
                        const isMe = staff._id === currentUser?.id || staff._id === currentUser?._id;
                        return (
                          <View key={staff._id} style={[styles.tableTr, isMe && styles.tableTrMe]}>
                            <View style={[styles.tableTdNameCol, { width: 180 }]}>
                              <View style={styles.staffAvatarRow}>
                                <View style={[styles.staffAvatar, isMe && { backgroundColor: '#1A5FD0' }]}>
                                  <Text style={styles.staffAvatarText}>
                                    {(staff.profile?.name || staff.email || 'NV').slice(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.staffNameText} numberOfLines={1}>
                                    {staff.profile?.name || staff.email || 'Nhân viên'}
                                    {isMe ? ' (Tôi)' : ''}
                                  </Text>
                                  <Text style={styles.staffRoleText} numberOfLines={1}>
                                    {getRoleLabel(staff.role)}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {weekDates.map((date, idx) => {
                              const schedsForDay = findSchedules(staff._id, date);
                              const isToday = isSameDay(date, new Date());

                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.tableTdCell,
                                    { width: 130 },
                                    isToday && styles.tdToday,
                                  ]}
                                >
                                  {schedsForDay.length > 0 ? (
                                    <View style={{ width: '100%', gap: 6 }}>
                                      {schedsForDay.map((sched) => {
                                        const cfg = SHIFT_CONFIG[sched.shift] || SHIFT_CONFIG['sáng'];
                                        const IconComp = cfg.icon;
                                        const isPending = sched.status === 'pending';

                                        return (
                                          <TouchableOpacity
                                            key={sched._id}
                                            style={[
                                              styles.shiftChip,
                                              {
                                                backgroundColor: cfg.bg,
                                                borderColor: isPending ? '#F59E0B' : cfg.border,
                                                borderStyle: isPending ? 'dashed' : 'solid',
                                              },
                                            ]}
                                            onPress={() => {
                                              if (isHospitalAdmin) {
                                                handleOpenEditShift(sched, staff, date);
                                              } else if (isMe && sched.status === 'confirmed') {
                                                handleOpenSwapModal(sched);
                                              }
                                            }}
                                            activeOpacity={0.8}
                                          >
                                            <View style={styles.shiftChipTop}>
                                              <IconComp size={12} color={cfg.text} />
                                              <Text style={[styles.shiftChipLabel, { color: cfg.text }]}>
                                                {cfg.label}
                                              </Text>
                                            </View>

                                            {isPending ? (
                                              <View style={styles.pendingBadgeRow}>
                                                <Clock size={10} color="#B45309" />
                                                <Text style={styles.pendingBadgeText}>Chờ duyệt</Text>
                                              </View>
                                            ) : (
                                              <Text style={[styles.shiftChipHours, { color: cfg.text }]}>
                                                {sched.startTime || cfg.startTime} - {sched.endTime || cfg.endTime}
                                              </Text>
                                            )}

                                            {sched.notes ? (
                                              <Text style={styles.shiftChipNote} numberOfLines={1}>
                                                {sched.notes}
                                              </Text>
                                            ) : null}
                                          </TouchableOpacity>
                                        );
                                      })}

                                      {isHospitalAdmin && (
                                        <TouchableOpacity
                                          style={styles.btnAddExtraShift}
                                          onPress={() => handleOpenAdminAddShift(staff, date)}
                                        >
                                          <Plus size={10} color="#1A5FD0" />
                                          <Text style={styles.btnAddExtraShiftText}>Thêm ca</Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      style={
                                        isHospitalAdmin
                                          ? styles.cellEmptyAdmin
                                          : isMe
                                          ? styles.cellEmptyMe
                                          : styles.cellEmpty
                                      }
                                      onPress={() => {
                                        if (isHospitalAdmin) {
                                          handleOpenAdminAddShift(staff, date);
                                        } else if (isMe) {
                                          handleOpenSelfRegister(date);
                                        }
                                      }}
                                      disabled={!isHospitalAdmin && !isMe}
                                    >
                                      {isHospitalAdmin ? (
                                        <View style={styles.cellEmptyAdminContent}>
                                          <Plus size={12} color="#1A5FD0" />
                                          <Text style={styles.cellEmptyAdminText}>Xếp ca</Text>
                                        </View>
                                      ) : isMe ? (
                                        <View style={styles.cellEmptyAdminContent}>
                                          <Plus size={12} color="#059669" />
                                          <Text style={[styles.cellEmptyAdminText, { color: '#059669' }]}>
                                            Đăng ký
                                          </Text>
                                        </View>
                                      ) : (
                                        <Text style={styles.cellOffText}>Nghỉ</Text>
                                      )}
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 2: MY SCHEDULE — bố cục riêng cho lễ tân */}
          {activeTab === 'my-schedule' && isReceptionistUser && (
            <ReceptionWeekStrip
              weekDates={weekDates}
              weekLabel={formatWeekRange()}
              findMine={findMine}
              shiftConfig={SHIFT_CONFIG}
              isSameDay={isSameDay}
              isWide={width > 1180}
              onPrev={handlePrevWeek}
              onNext={handleNextWeek}
              onToday={handleCurrentWeek}
              onRegister={(date) => handleOpenSelfRegister(date)}
              onCancel={handleCancelRegistration}
              onSwap={handleOpenSwapModal}
            />
          )}

          {/* TAB 2: MY SCHEDULE */}
          {activeTab === 'my-schedule' && !isReceptionistUser && (
            <View style={styles.card}>
              <View style={styles.myScheduleHeader}>
                <View>
                  <Text style={styles.cardTitle}>Lịch Làm Việc Cá Nhân</Text>
                  <Text style={styles.cardSub}>
                    Kíp trực cá nhân của bạn trong tuần. Bạn có thể đăng ký thêm ca hoặc xin đổi ca trực.
                  </Text>
                </View>

                <View style={styles.weekNavGroup}>
                  <TouchableOpacity style={styles.navBtn} onPress={handlePrevWeek}>
                    <ChevronLeft size={16} color="#334155" />
                    <Text style={styles.navBtnText}>Tuần trước</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.todayJumpBtn} onPress={handleCurrentWeek}>
                    <Text style={styles.todayJumpBtnText}>Tuần này</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.navBtn} onPress={handleNextWeek}>
                    <Text style={styles.navBtnText}>Tuần sau</Text>
                    <ChevronRight size={16} color="#334155" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.myDaysGrid}>
                {weekDates.map((date, idx) => {
                  const scheds = currentUser ? findSchedules(currentUser.id, date) : [];
                  const isToday = isSameDay(date, new Date());
                  const dayName = DAYS_OF_WEEK.find((d) => d.key === date.getDay())?.label;

                  return (
                    <View key={idx} style={[styles.myDayCard, isToday && styles.myDayCardToday]}>
                      <View style={styles.myDayCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.myDayCardTitle, isToday && { color: '#1A5FD0' }]}>
                            {dayName}
                          </Text>
                          <Text style={styles.myDayCardDate}>
                            ({date.getDate()}/{date.getMonth() + 1})
                          </Text>
                        </View>
                        {isToday && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>Hôm nay</Text>
                          </View>
                        )}
                      </View>

                      {scheds.length > 0 ? (
                        <View style={{ gap: 10, marginTop: 10 }}>
                          {scheds.map((sched) => {
                            const cfg = SHIFT_CONFIG[sched.shift] || SHIFT_CONFIG['sáng'];
                            const IconComp = cfg.icon;
                            const isPending = sched.status === 'pending';
                            const isRejected = sched.status === 'rejected';

                            return (
                              <View
                                key={sched._id}
                                style={[
                                  styles.myShiftBox,
                                  {
                                    backgroundColor: isPending ? '#FFFBEB' : isRejected ? '#FEF2F2' : cfg.bg,
                                    borderColor: isPending ? '#FCD34D' : isRejected ? '#FCA5A5' : cfg.border,
                                  },
                                ]}
                              >
                                <View style={styles.myShiftBoxTop}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <IconComp size={16} color={cfg.text} />
                                    <Text style={[styles.myShiftBoxShiftName, { color: cfg.text }]}>
                                      {cfg.label}
                                    </Text>
                                    <Text style={[styles.myShiftBoxHours, { color: cfg.text }]}>
                                      ({sched.startTime || cfg.startTime} - {sched.endTime || cfg.endTime})
                                    </Text>
                                  </View>

                                  <View
                                    style={[
                                      styles.statusBadgeSmall,
                                      isPending
                                        ? styles.badgeSmallPending
                                        : isRejected
                                        ? styles.badgeSmallRejected
                                        : styles.badgeSmallConfirmed,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeSmallText,
                                        isPending
                                          ? { color: '#B45309' }
                                          : isRejected
                                          ? { color: '#DC2626' }
                                          : { color: '#0F9D6B' },
                                      ]}
                                    >
                                      {isPending ? 'Chờ duyệt' : isRejected ? 'Từ chối' : 'Đã xác nhận'}
                                    </Text>
                                  </View>
                                </View>

                                {sched.notes ? (
                                  <Text style={styles.myShiftBoxNotes}>Ghi chú: {sched.notes}</Text>
                                ) : null}

                                {sched.reviewNotes ? (
                                  <Text style={styles.myShiftBoxReviewNotes}>
                                    Phản hồi từ khoa: {sched.reviewNotes}
                                  </Text>
                                ) : null}

                                <View style={styles.myShiftBoxActions}>
                                  {isPending ? (
                                    <TouchableOpacity
                                      style={styles.btnCancelPending}
                                      onPress={() => handleCancelRegistration(sched._id)}
                                    >
                                      <Trash2 size={12} color="#DC2626" />
                                      <Text style={styles.btnCancelPendingText}>Hủy đăng ký ca này</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.btnRequestSwap}
                                      onPress={() => handleOpenSwapModal(sched)}
                                    >
                                      <RefreshCw size={12} color="#1A5FD0" />
                                      <Text style={styles.btnRequestSwapText}>Yêu cầu đổi ca</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            );
                          })}

                          <TouchableOpacity
                            style={styles.btnAddMoreShift}
                            onPress={() => handleOpenSelfRegister(date)}
                          >
                            <Plus size={12} color="#059669" />
                            <Text style={styles.btnAddMoreShiftText}>Đăng ký thêm ca trực ngày này</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.myDayEmptyBox}>
                          <Text style={styles.myDayEmptyText}>Lịch trống (Nghỉ)</Text>
                          <TouchableOpacity
                            style={styles.btnRegisterDayEmpty}
                            onPress={() => handleOpenSelfRegister(date)}
                          >
                            <Plus size={12} color="#1A5FD0" />
                            <Text style={styles.btnRegisterDayEmptyText}>+ Đăng ký ca trực ngày này</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TAB 3: REGISTRATIONS & APPROVAL INBOX */}
          {activeTab === 'registrations' && (
            <View style={styles.card}>
              <View style={styles.registrationsHeader}>
                <View>
                  <Text style={styles.cardTitle}>
                    {isHospitalAdmin ? 'Hộp Thư Phê Duyệt Phiếu Đăng Ký Ca' : 'Lịch Sử Đăng Ký Ca Trực'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {isHospitalAdmin
                      ? 'Duyệt hoặc từ chối các đề xuất ca trực của y bác sĩ, kỹ thuật viên và điều dưỡng.'
                      : 'Theo dõi tiến trình xét duyệt các ca trực bạn đã đăng ký với Trưởng khoa.'}
                  </Text>
                </View>

                {/* Filter Pills */}
                <View style={styles.filterPillsRow}>
                  {['all', 'pending', 'confirmed', 'rejected'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.filterPill,
                        registrationFilter === st && styles.filterPillActive,
                      ]}
                      onPress={() => setRegistrationFilter(st)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          registrationFilter === st && styles.filterPillTextActive,
                        ]}
                      >
                        {st === 'all'
                          ? 'Tất cả'
                          : st === 'pending'
                          ? 'Chờ duyệt'
                          : st === 'confirmed'
                          ? 'Đã duyệt'
                          : 'Từ chối'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {registrations.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <ClipboardList size={36} color="#CBD5E1" />
                  <Text style={styles.emptyStateTitle}>Không có phiếu đăng ký ca nào</Text>
                  <Text style={styles.emptyStateSub}>
                    {isHospitalAdmin
                      ? 'Hiện không có nhân viên nào gửi yêu cầu đăng ký ca phù hợp với bộ lọc.'
                      : 'Bạn chưa gửi yêu cầu đăng ký ca trực nào.'}
                  </Text>
                  {!isHospitalAdmin && (
                    <TouchableOpacity
                      style={[styles.btnPrimaryRegister, { marginTop: 14 }]}
                      onPress={() => handleOpenSelfRegister(new Date())}
                    >
                      <PlusCircle size={16} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryRegisterText}>Tạo phiếu đăng ký ca mới</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.registrationsList}>
                  {registrations.map((reg) => {
                    const cfg = SHIFT_CONFIG[reg.shift] || SHIFT_CONFIG['sáng'];
                    const IconComp = cfg.icon;
                    const dateFormatted = reg.date ? new Date(reg.date).toLocaleDateString('vi-VN') : '—';
                    const isPending = reg.status === 'pending';
                    const isConfirmed = reg.status === 'confirmed';
                    const isRejected = reg.status === 'rejected';

                    return (
                      <View key={reg._id} style={styles.registrationCard}>
                        <View style={styles.registrationCardLeft}>
                          <View style={styles.regStaffHeader}>
                            <View style={styles.staffAvatar}>
                              <Text style={styles.staffAvatarText}>
                                {(reg.staffId?.profile?.name || reg.staffId?.email || 'NV')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.regStaffName}>
                                {reg.staffId?.profile?.name || reg.staffId?.email || 'Nhân sự'}
                              </Text>
                              <Text style={styles.regStaffRole}>
                                {getRoleLabel(reg.staffId?.role || reg.role)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.regShiftInfoRow}>
                            <View
                              style={[
                                styles.shiftMiniBadge,
                                { backgroundColor: cfg.bg, borderColor: cfg.border },
                              ]}
                            >
                              <IconComp size={12} color={cfg.text} />
                              <Text style={[styles.shiftMiniBadgeText, { color: cfg.text }]}>
                                {cfg.label}
                              </Text>
                            </View>

                            <Text style={styles.regDateText}>
                              Ngày trực: <Text style={{ fontWeight: 'bold' }}>{dateFormatted}</Text>
                            </Text>

                            <Text style={styles.regHoursText}>
                              ({reg.startTime || cfg.startTime} - {reg.endTime || cfg.endTime})
                            </Text>
                          </View>

                          {reg.notes ? (
                            <Text style={styles.regNotesText}>
                              Nguyện vọng / Ghi chú: "{reg.notes}"
                            </Text>
                          ) : null}

                          {reg.reviewNotes ? (
                            <Text style={styles.regReviewNotesText}>
                              Ý kiến phản hồi: {reg.reviewNotes}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.registrationCardRight}>
                          <View
                            style={[
                              styles.statusBadge,
                              isPending
                                ? styles.badgePending
                                : isConfirmed
                                ? styles.badgeApproved
                                : styles.badgeRejected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isPending
                                  ? { color: '#B45309' }
                                  : isConfirmed
                                  ? { color: '#0F9D6B' }
                                  : { color: '#DC2626' },
                              ]}
                            >
                              {isPending ? 'Chờ duyệt' : isConfirmed ? 'Đã duyệt' : 'Từ chối'}
                            </Text>
                          </View>

                          {isHospitalAdmin && isPending && (
                            <View style={styles.adminActionRow}>
                              <TouchableOpacity
                                style={styles.btnActionReject}
                                onPress={() => handleOpenRejectModal(reg)}
                              >
                                <X size={14} color="#DC2626" />
                                <Text style={styles.btnActionRejectText}>Từ chối</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.btnActionApprove}
                                onPress={() => handleApproveRegistration(reg._id)}
                              >
                                <Check size={14} color="#FFFFFF" />
                                <Text style={styles.btnActionApproveText}>Phê duyệt</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {!isHospitalAdmin && isPending && (
                            <TouchableOpacity
                              style={styles.btnCancelMyReg}
                              onPress={() => handleCancelRegistration(reg._id)}
                            >
                              <Trash2 size={12} color="#DC2626" />
                              <Text style={styles.btnCancelMyRegText}>Hủy đăng ký</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: SWAP REQUESTS */}
          {activeTab === 'swap' && (
            <View style={styles.card}>
              <View style={styles.registrationsHeader}>
                <View>
                  <Text style={styles.cardTitle}>Phê Duyệt Đổi Ca Trực</Text>
                  <Text style={styles.cardSub}>
                    {isHospitalAdmin
                      ? 'Danh sách các đề xuất đổi hoặc bàn giao ca làm việc cần quản lý phê duyệt.'
                      : 'Danh sách các yêu cầu đổi ca làm việc của bạn.'}
                  </Text>
                </View>
              </View>

              {swapRequests.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <RefreshCw size={36} color="#CBD5E1" />
                  <Text style={styles.emptyStateTitle}>Không có yêu cầu đổi ca nào</Text>
                  <Text style={styles.emptyStateSub}>
                    Tất cả các ca trực hiện đang ổn định, chưa có nhân sự xin đổi kíp trực.
                  </Text>
                </View>
              ) : (
                <View style={styles.registrationsList}>
                  {swapRequests.map((req) => {
                    const origDate = req.scheduleId
                      ? new Date(req.scheduleId.date).toLocaleDateString('vi-VN')
                      : '—';
                    const tgtDate = req.targetDate
                      ? new Date(req.targetDate).toLocaleDateString('vi-VN')
                      : '—';
                    const shiftLabel = req.scheduleId
                      ? SHIFT_CONFIG[req.scheduleId.shift]?.label || req.scheduleId.shift
                      : '';
                    const isPending = req.status === 'pending';

                    return (
                      <View key={req._id} style={styles.registrationCard}>
                        <View style={styles.registrationCardLeft}>
                          <View style={styles.regStaffHeader}>
                            <View style={[styles.staffAvatar, { backgroundColor: '#7C3AED' }]}>
                              <Text style={styles.staffAvatarText}>
                                {(req.requesterId?.profile?.name || req.requesterId?.email || 'NV')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.regStaffName}>
                                {req.requesterId?.profile?.name || 'Nhân sự'}
                              </Text>
                              <Text style={styles.regStaffRole}>
                                {getRoleLabel(req.requesterId?.role)}
                              </Text>
                            </View>
                          </View>

                          <View style={{ gap: 4, marginTop: 8 }}>
                            <Text style={styles.swapDetailText}>
                              • Ca cần đổi:{' '}
                              <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>
                                {shiftLabel} ({origDate})
                              </Text>
                            </Text>
                            <Text style={styles.swapDetailText}>
                              • Đổi sang ngày:{' '}
                              <Text style={{ fontWeight: 'bold', color: '#1A5FD0' }}>{tgtDate}</Text>
                            </Text>
                            {req.targetStaffId ? (
                              <Text style={styles.swapDetailText}>
                                • Đổi chéo với:{' '}
                                <Text style={{ fontWeight: 'bold', color: '#059669' }}>
                                  {req.targetStaffId?.profile?.name || 'Nhân viên khác'}
                                </Text>
                              </Text>
                            ) : (
                              <Text style={styles.swapDetailText}>
                                • Hình thức: <Text style={{ fontStyle: 'italic' }}>Nhường ca / Bàn giao ca</Text>
                              </Text>
                            )}
                            {req.reason ? (
                              <Text style={styles.regNotesText}>Lý do: "{req.reason}"</Text>
                            ) : null}
                          </View>
                        </View>

                        <View style={styles.registrationCardRight}>
                          <View
                            style={[
                              styles.statusBadge,
                              req.status === 'approved'
                                ? styles.badgeApproved
                                : req.status === 'rejected'
                                ? styles.badgeRejected
                                : styles.badgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                req.status === 'approved'
                                  ? { color: '#0F9D6B' }
                                  : req.status === 'rejected'
                                  ? { color: '#DC2626' }
                                  : { color: '#B45309' },
                              ]}
                            >
                              {req.status === 'approved'
                                ? 'Đã duyệt'
                                : req.status === 'rejected'
                                ? 'Từ chối'
                                : 'Chờ duyệt'}
                            </Text>
                          </View>

                          {isHospitalAdmin && isPending && (
                            <View style={styles.adminActionRow}>
                              <TouchableOpacity
                                style={styles.btnActionReject}
                                onPress={() => handleReviewSwap(req._id, false)}
                              >
                                <X size={14} color="#DC2626" />
                                <Text style={styles.btnActionRejectText}>Từ chối</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.btnActionApprove}
                                onPress={() => handleReviewSwap(req._id, true)}
                              >
                                <Check size={14} color="#FFFFFF" />
                                <Text style={styles.btnActionApproveText}>Duyệt</Text>
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

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTER / ASSIGN / EDIT SHIFT */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <Modal
          visible={showScheduleModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: '#E7F0FE' }]}>
                    {selectedSchedule ? (
                      <Edit2 size={18} color="#1A5FD0" />
                    ) : (
                      <PlusCircle size={18} color="#1A5FD0" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>
                      {selectedSchedule
                        ? 'Cập Nhật Ca Làm Việc'
                        : isHospitalAdmin && selectedStaff?._id !== currentUser?.id
                        ? 'Phân Ca Trực Nhân Sự'
                        : 'Đăng Ký Ca Trực Mới'}
                    </Text>
                    <Text style={styles.modalSubHeader}>
                      {isHospitalAdmin && selectedStaff?._id !== currentUser?.id
                        ? 'Chỉ định kíp trực lâm sàng trực tiếp cho nhân viên.'
                        : 'Phiếu đăng ký sẽ được chuyển đến Trưởng khoa phê duyệt.'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowScheduleModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                {/* Staff Selection (Admin only) or Read-Only Card (Staff) */}
                <View style={styles.field}>
                  <Text style={styles.label}>Nhân viên y tế *</Text>
                  {isHospitalAdmin && !selectedSchedule ? (
                    <View style={styles.selectWrapper}>
                      <select
                        value={selectedStaff?._id || selectedStaff?.id || ''}
                        onChange={(e) => {
                          const s = staffList.find((item) => item._id === e.target.value);
                          if (s) setSelectedStaff(s);
                        }}
                        style={styles.htmlSelect}
                      >
                        {staffList
                          .filter((s) => !['patient', 'admin', 'system_admin'].includes(s.role))
                          .map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.profile?.name || s.email} — {getRoleLabel(s.role)}
                            </option>
                          ))}
                      </select>
                    </View>
                  ) : (
                    <View style={styles.staffReadOnlyBox}>
                      <User size={16} color="#1A5FD0" />
                      <Text style={styles.staffReadOnlyName}>
                        {selectedStaff?.profile?.name || selectedStaff?.email || 'Nhân sự'}
                      </Text>
                      <View style={styles.staffReadOnlyRole}>
                        <Text style={styles.staffReadOnlyRoleText}>
                          {getRoleLabel(selectedStaff?.role)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Date Selection */}
                <View style={styles.field}>
                  <Text style={styles.label}>Ngày trực *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD (Ví dụ: 2026-09-30)"
                    placeholderTextColor="#94A3B8"
                    value={formatDateKey(selectedDate)}
                    onChangeText={(val) => {
                      const d = new Date(val);
                      if (!isNaN(d.getTime())) {
                        setSelectedDate(d);
                      }
                    }}
                  />
                  {/* Quick Date Presets */}
                  <View style={styles.quickDateRow}>
                    <TouchableOpacity
                      style={styles.quickDateChip}
                      onPress={() => setSelectedDate(new Date())}
                    >
                      <Text style={styles.quickDateChipText}>Hôm nay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickDateChip}
                      onPress={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d);
                      }}
                    >
                      <Text style={styles.quickDateChipText}>Ngày mai</Text>
                    </TouchableOpacity>
                    {weekDates.map((wd, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.quickDateChip,
                          isSameDay(wd, selectedDate) && styles.quickDateChipActive,
                        ]}
                        onPress={() => setSelectedDate(wd)}
                      >
                        <Text
                          style={[
                            styles.quickDateChipText,
                            isSameDay(wd, selectedDate) && styles.quickDateChipTextActive,
                          ]}
                        >
                          {DAYS_OF_WEEK.find((d) => d.key === wd.getDay())?.short} ({wd.getDate()}/{wd.getMonth() + 1})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Shift Presets Grid */}
                <View style={styles.field}>
                  <Text style={styles.label}>Chọn ca làm việc *</Text>
                  <View style={styles.shiftPresetsGrid}>
                    {Object.entries(SHIFT_CONFIG).map(([k, cfg]) => {
                      const isSelected = shift === k;
                      const IconComp = cfg.icon;
                      return (
                        <TouchableOpacity
                          key={k}
                          style={[
                            styles.shiftPresetCard,
                            isSelected && {
                              borderColor: cfg.border,
                              backgroundColor: cfg.bg,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => handleSelectShiftPreset(k)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconComp size={16} color={isSelected ? cfg.text : '#64748B'} />
                            <Text
                              style={[
                                styles.shiftPresetTitle,
                                isSelected && { color: cfg.text, fontWeight: 'bold' },
                              ]}
                            >
                              {cfg.label}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.shiftPresetTime,
                              isSelected && { color: cfg.text, fontWeight: 'bold' },
                            ]}
                          >
                            {cfg.time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Custom Time Range */}
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

                {/* Notes */}
                <View style={styles.field}>
                  <Text style={styles.label}>Ghi chú ca trực / Nguyện vọng kíp trực</Text>
                  <TextInput
                    style={[styles.input, { height: 60, paddingVertical: 8 }]}
                    placeholder="Ví dụ: Kíp trực phòng MRI 3.0T buồng 2, hỗ trợ ca mổ cấp cứu..."
                    placeholderTextColor="#94A3B8"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>

                {/* Admin Status Dropdown */}
                {isHospitalAdmin && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Trạng thái ca trực</Text>
                    <View style={styles.selectWrapper}>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        style={styles.htmlSelect}
                      >
                        <option value="confirmed">Đã phê duyệt (Confirmed)</option>
                        <option value="pending">Chờ phê duyệt (Pending)</option>
                        <option value="off">Nghỉ ca (Off)</option>
                      </select>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                {selectedSchedule && isHospitalAdmin && (
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={handleDeleteSchedule}
                    disabled={submitting}
                  >
                    <Trash2 size={14} color="#DC2626" />
                    <Text style={styles.modalDeleteText}>Xóa ca</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowScheduleModal(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, submitting && styles.buttonDisabled]}
                    onPress={handleSaveSchedule}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitText}>
                        {selectedSchedule
                          ? 'Cập nhật'
                          : isHospitalAdmin && selectedStaff?._id !== currentUser?.id
                          ? 'Xác nhận phân ca'
                          : 'Gửi đăng ký'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SWAP REQUEST */}
      {/* ========================================================================= */}
      {showSwapModal && swapSchedule && (
        <Modal
          visible={showSwapModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSwapModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: '#F3E8FF' }]}>
                    <ArrowLeftRight size={18} color="#7C3AED" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Tạo Yêu Cầu Đổi Ca Trực</Text>
                    <Text style={styles.modalSubHeader}>
                      Ca: {SHIFT_CONFIG[swapSchedule.shift]?.label || swapSchedule.shift} ngày{' '}
                      {new Date(swapSchedule.date).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowSwapModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Đổi sang ngày (YYYY-MM-DD) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 2026-10-02"
                  placeholderTextColor="#94A3B8"
                  value={targetDateStr}
                  onChangeText={setTargetDateStr}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Đổi chéo với nhân sự (Để trống nếu muốn nhường ca)</Text>
                <View style={styles.selectWrapper}>
                  <select
                    value={targetStaffId}
                    onChange={(e) => setTargetStaffId(e.target.value)}
                    style={styles.htmlSelect}
                  >
                    <option value="">Chọn nhân sự đổi cùng (Không bắt buộc)</option>
                    {staffList
                      .filter((s) => s._id !== currentUser?.id)
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.profile?.name || s.email} ({getRoleLabel(s.role)})
                        </option>
                      ))}
                  </select>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Lý do xin đổi ca *</Text>
                <TextInput
                  style={[styles.input, { height: 60, paddingVertical: 8 }]}
                  placeholder="Ví dụ: Trùng lịch đào tạo chuyên sâu về MRI Não, lý do gia đình..."
                  placeholderTextColor="#94A3B8"
                  value={swapReason}
                  onChangeText={setSwapReason}
                  multiline
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSwapModal(false)}
                  disabled={submitting}
                >
                  <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, submitting && styles.buttonDisabled]}
                  onPress={handleSwapSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Gửi yêu cầu đổi ca</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REJECT REGISTRATION WITH REASON */}
      {/* ========================================================================= */}
      {showRejectModal && rejectingItem && (
        <Modal
          visible={showRejectModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRejectModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dialogContainer}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: '#FEE2E2' }]}>
                    <AlertCircle size={18} color="#DC2626" />
                  </View>
                  <Text style={styles.modalTitle}>Từ Chối Phiếu Đăng Ký Ca</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowRejectModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubHeader}>
                Nhân sự: <Text style={{ fontWeight: 'bold' }}>{rejectingItem.staffId?.profile?.name || 'Nhân sự'}</Text>
                {'\n'}Ca: {SHIFT_CONFIG[rejectingItem.shift]?.label} ngày{' '}
                {new Date(rejectingItem.date).toLocaleDateString('vi-VN')}
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Lý do từ chối (Gửi thông báo tới nhân viên)</Text>
                <TextInput
                  style={[styles.input, { height: 70, paddingVertical: 8 }]}
                  placeholder="Nhập lý do từ chối (Ví dụ: Kíp trực đã đủ quân số, đề nghị đăng ký ca khác...)"
                  placeholderTextColor="#94A3B8"
                  value={rejectNotes}
                  onChangeText={setRejectNotes}
                  multiline
                />
              </View>

              <View style={styles.dialogButtonRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRejectModal(false)}
                >
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={handleSubmitRejection}
                >
                  <Text style={styles.modalDeleteText}>Xác nhận từ chối</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* DIALOG: CROSS-PLATFORM CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {dialog && (
        <Modal visible={!!dialog} transparent={true} animationType="fade" onRequestClose={closeDialog}>
          <View style={styles.modalOverlay}>
            <View style={styles.dialogContainer}>
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              {dialog.message ? <Text style={styles.dialogMessage}>{dialog.message}</Text> : null}
              <View style={styles.dialogButtonRow}>
                {dialog.buttons.map((b, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={
                      b.style === 'destructive'
                        ? styles.modalDeleteBtn
                        : b.style === 'cancel'
                        ? styles.modalCancelBtn
                        : styles.modalSubmitBtn
                    }
                    onPress={b.onPress}
                  >
                    <Text
                      style={
                        b.style === 'destructive'
                          ? styles.modalDeleteText
                          : b.style === 'cancel'
                          ? styles.modalCancelText
                          : styles.modalSubmitText
                      }
                    >
                      {b.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ResponsiveLayout>
  );
}

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return formatDateKey(d1) === formatDateKey(d2);
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, gap: 20 },

  // Header Hero Banner
  headerHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  headerHeroLeft: { flex: 1, minWidth: 300 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F0FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgePillText: { fontSize: 10, fontWeight: 'bold', color: '#1A5FD0', letterSpacing: 0.5 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 20, maxWidth: 650 },
  headerHeroActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnPrimaryRegister: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A5FD0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#1A5FD0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  btnPrimaryRegisterText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  btnSecondaryRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSecondaryRefreshText: { color: '#334155', fontSize: 13, fontWeight: '600' },

  // KPI Stat Cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  kpiCardHighlight: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  kpiIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  kpiLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
    overflow: 'scroll',
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1A5FD0',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1A5FD0',
    fontWeight: '700',
  },
  tabBadgeAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tabBadgeAmberText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  tabBadgePurple: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tabBadgePurpleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C3AED',
  },

  // Main Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 18 },

  // Grid Controls
  gridControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  weekNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navBtnText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  todayJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F0FE',
    borderWidth: 1,
    borderColor: '#C9DCFB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  todayJumpBtnText: { fontSize: 12, fontWeight: 'bold', color: '#1A5FD0' },
  weekRangeTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginLeft: 8 },

  filterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterBoxLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterSelectNative: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    cursor: 'pointer',
  },

  // Table
  table: { flexDirection: 'column', minWidth: 1090 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableTh: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableThText: { fontSize: 12, fontWeight: 'bold', color: '#334155', textAlign: 'center' },
  thSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  thToday: { backgroundColor: '#E7F0FE' },
  tableTr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'stretch',
  },
  tableTrMe: {
    backgroundColor: '#EEFBF5',
  },
  tableTdNameCol: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  staffAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  staffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  staffNameText: { fontSize: 12, fontWeight: 'bold', color: '#0F172A' },
  staffRoleText: { fontSize: 10, color: '#64748B', marginTop: 2 },
  tableTdCell: {
    padding: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  tdToday: { backgroundColor: '#F8FAFC' },

  // Shift Chip in Grid
  shiftChip: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
    width: '100%',
  },
  shiftChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  shiftChipLabel: { fontSize: 10, fontWeight: 'bold' },
  shiftChipHours: { fontSize: 9, fontWeight: '600' },
  shiftChipNote: { fontSize: 8, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  pendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  pendingBadgeText: { fontSize: 8, fontWeight: 'bold', color: '#B45309' },

  btnAddExtraShift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  btnAddExtraShiftText: { fontSize: 9, fontWeight: 'bold', color: '#1A5FD0' },

  cellEmpty: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellOffText: { fontSize: 11, color: '#CBD5E1' },
  cellEmptyAdmin: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellEmptyMe: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6FDDB2',
    backgroundColor: '#EEFBF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellEmptyAdminContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cellEmptyAdminText: { fontSize: 10, fontWeight: 'bold', color: '#1A5FD0' },

  // My Schedule Day Cards
  myScheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  myDaysGrid: { gap: 12 },
  myDayCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  myDayCardToday: {
    borderColor: '#1A5FD0',
    backgroundColor: '#F0FDFA',
  },
  myDayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myDayCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  myDayCardDate: { fontSize: 12, color: '#64748B' },
  todayBadge: {
    backgroundColor: '#1A5FD0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' },

  myShiftBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  myShiftBoxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  myShiftBoxShiftName: { fontSize: 13, fontWeight: 'bold' },
  myShiftBoxHours: { fontSize: 12, fontWeight: '600' },
  myShiftBoxNotes: { fontSize: 11, color: '#475569', marginTop: 4 },
  myShiftBoxReviewNotes: {
    fontSize: 11,
    color: '#1A5FD0',
    fontStyle: 'italic',
    marginTop: 4,
    backgroundColor: '#F0F9FF',
    padding: 6,
    borderRadius: 6,
  },
  myShiftBoxActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  btnRequestSwap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DCFB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnRequestSwapText: { fontSize: 11, fontWeight: 'bold', color: '#1A5FD0' },
  btnCancelPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnCancelPendingText: { fontSize: 11, fontWeight: 'bold', color: '#DC2626' },

  btnAddMoreShift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6FDDB2',
    backgroundColor: '#EEFBF5',
  },
  btnAddMoreShiftText: { fontSize: 11, fontWeight: 'bold', color: '#059669' },

  myDayEmptyBox: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  myDayEmptyText: { fontSize: 12, color: '#94A3B8' },
  btnRegisterDayEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnRegisterDayEmptyText: { fontSize: 11, fontWeight: 'bold', color: '#1A5FD0' },

  // Registrations Header & List
  registrationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  filterPillsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1A5FD0',
    borderColor: '#1A5FD0',
  },
  filterPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  registrationsList: { gap: 12 },
  registrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  registrationCardLeft: { flex: 1, minWidth: 260 },
  regStaffHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  regStaffName: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  regStaffRole: { fontSize: 11, color: '#64748B', marginTop: 1 },
  regShiftInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  shiftMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  shiftMiniBadgeText: { fontSize: 11, fontWeight: 'bold' },
  regDateText: { fontSize: 12, color: '#334155' },
  regHoursText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  regNotesText: { fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 6 },
  regReviewNotesText: { fontSize: 11, color: '#1A5FD0', fontWeight: '600', marginTop: 4 },
  swapDetailText: { fontSize: 12, color: '#475569' },

  registrationCardRight: { alignItems: 'flex-end', gap: 10 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeApproved: { backgroundColor: '#D5F5E7' },
  badgeRejected: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },

  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSmallPending: { backgroundColor: '#FEF3C7' },
  badgeSmallConfirmed: { backgroundColor: '#D5F5E7' },
  badgeSmallRejected: { backgroundColor: '#FEE2E2' },
  statusBadgeSmallText: { fontSize: 10, fontWeight: 'bold' },

  adminActionRow: { flexDirection: 'row', gap: 8 },
  btnActionReject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnActionRejectText: { fontSize: 11, fontWeight: 'bold', color: '#DC2626' },
  btnActionApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnActionApproveText: { fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' },
  btnCancelMyReg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnCancelMyRegText: { fontSize: 11, fontWeight: 'bold', color: '#DC2626' },

  // Empty State Box
  emptyStateBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  emptyStateTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginTop: 10 },
  emptyStateSub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center', maxWidth: 400 },

  loadingBox: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 12, color: '#64748B' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  modalSubHeader: { fontSize: 11, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 4 },

  field: { marginBottom: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    outlineStyle: 'none',
  },
  selectWrapper: {
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  htmlSelect: {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    outline: 'none',
    cursor: 'pointer',
  },

  // Staff Read Only Box
  staffReadOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffReadOnlyName: { fontSize: 13, fontWeight: 'bold', color: '#0F172A', flex: 1 },
  staffReadOnlyRole: {
    backgroundColor: '#E7F0FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  staffReadOnlyRoleText: { fontSize: 10, fontWeight: 'bold', color: '#1A5FD0' },

  // Quick Date Presets Row
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickDateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDateChipActive: {
    backgroundColor: '#1A5FD0',
    borderColor: '#1A5FD0',
  },
  quickDateChipText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  quickDateChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  // Shift Presets Grid in Modal
  shiftPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shiftPresetCard: {
    flex: 1,
    minWidth: '47%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  shiftPresetTitle: { fontSize: 12, fontWeight: '600', color: '#334155' },
  shiftPresetTime: { fontSize: 10, color: '#64748B' },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  modalSubmitBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1A5FD0',
    shadowColor: '#1A5FD0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalSubmitText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  modalDeleteText: { fontSize: 12, fontWeight: 'bold', color: '#DC2626' },
  buttonDisabled: { opacity: 0.6 },

  dialogTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  dialogMessage: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 18 },
  dialogButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
