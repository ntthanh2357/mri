import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { setAuthToken } from '../services/api.service';
import Colors from '../constants/colors';
import PressableScale from './PressableScale';
import { portalLoginRoute } from '../utils/navigationRef';
import { filterMenuInScope, isFeatureEnabled } from '../constants/featureScope';
import performLogout from '../utils/logout';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Calendar, 
  Building2, 
  Users, 
  DollarSign, 
  Package, 
  PhoneCall, 
  LogOut, 
  Brain, 
  Activity, 
  FileText, 
  ClipboardList, 
  CreditCard,
  Bell,
  AlertTriangle,
  X,
  ChevronRight,
  ShieldCheck,
  ArrowRightLeft,
  Stethoscope,
  UploadCloud,
  Menu,
  Database,
  Heart,
  Ticket,
  QrCode,
  FileCheck,
  MessageCircle,
  ScanLine,
  Sliders,
  Pill,
  Gauge,
  FileSearch,
  Shuffle,
  ClipboardCheck,
  Monitor,
  User,
  Mail,
  Phone,
  MapPin,
  Edit3,
  Save,
} from 'lucide-react';
import ProfileFormFields from './ProfileFormFields';
import { formatDobDisplay, formatDobSummary, buildProfilePayload } from '../utils/profileFields';

const DEPARTMENT_LABELS = {
  'KUTN-SURG': 'Phẫu thuật & Hồi tỉnh Mở Sọ (KUTN-SURG)',
  'KUTN-ICU': 'Hồi sức Cấp cứu U Não (Neuro-ICU)',
  'KUTN-CHEMO': 'Hóa trị & Xạ trị U Não (KUTN-CHEMO)',
  'KUTN-PAL': 'Chăm sóc Giảm nhẹ & Phục hồi (KUTN-PAL)',
  'KUTN-CLI': 'Phòng khám U Não & Tiếp đón (KUTN-CLI)',
  KCDHA: 'Chẩn đoán Hình ảnh & Mini-PACS (KCDHA)',
  KD: 'Khoa Dược & Pha chế Hóa chất (KD)',
  KXN: 'Xét nghiệm & GPB Sinh học Phân tử (KXN)',
  KUTN: 'Khoa Ung Thư Não (Trung tâm / Văn phòng Khoa)',
  KNT: 'Khoa Ngoại Thần Kinh (KNT)',
  ICU: 'Hồi Sức Cấp Cứu (ICU)',
};

const SPECIALTY_LABELS = {
  neurosurgeon_radiologist: 'Khám Lâm Sàng & Đọc Phim CĐHA',
  neurosurgeon: 'Phẫu thuật Thần kinh U Não',
  neuro_oncologist: 'Ung thư Thần kinh Lâm sàng (Hóa xạ trị)',
  neuroradiologist: 'Chẩn đoán Hình ảnh Thần kinh & MRI',
  neuro_icu_nurse: 'Điều dưỡng Hồi sức Cấp cứu Neuro-ICU',
  oncology_nurse: 'Điều dưỡng Hóa trị & Nội trú',
  surgical_nurse: 'Điều dưỡng Hồi tỉnh Mở Sọ',
  mri_technician: 'KTV Vận hành Máy MRI 3.0T Sọ Não',
  radiation_technician: 'KTV Mô phỏng & Xạ trị Gia tốc',
  general: 'Chuyên khoa chung',
};

// Màu khung theo role: bệnh nhân dùng màu logo 2026; nhân viên giữ teal cũ tới khi màn của họ được thiết kế lại.
// Khung giao diện dùng chung 1 bộ màu thương hiệu cho mọi role (quyết định 2026-10-04 — bỏ teal của nhân viên).
const SHELL_THEME = {
  accent: Colors.brandGreen, accentSoft: Colors.brandGreenSoft, accentBorder: '#CDEBDF',
  dark: Colors.brandNavy, darkRaised: '#16386B', onDarkAccent: Colors.brandGreenOnDark, onDarkSub: Colors.brandGreenOnDark,
  onDarkActiveBg: 'rgba(61, 219, 166, 0.15)', avatar: Colors.brandNavy,
};

const ResponsiveLayout = ({
  children,
  navigation,
  activeRoute,
  user,
  onLogout,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [localUser, setLocalUser] = React.useState(user || null);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showNotifModal, setShowNotifModal] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editGender, setEditGender] = React.useState('');
  const [editDob, setEditDob] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');
  const [editAddress, setEditAddress] = React.useState('');
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileFeedback, setProfileFeedback] = React.useState(null);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [activeEmergency, setActiveEmergency] = React.useState(null);
  const isPollingStoppedRef = React.useRef(false);

  const fetchEmergencyAlerts = async () => {
    if (isPollingStoppedRef.current) return;
    // Banner cấp cứu chỉ dành cho nhân viên bệnh viện (BE ALERT_BANNER_ROLES): bệnh nhân, tài khoản nền tảng không gọi
    try {
      const { safeStorage } = require('../utils/safeStorage');
      const r = JSON.parse(safeStorage.getItem('user') || 'null')?.role;
      if (['patient', 'admin', 'system_admin'].includes(r)) { isPollingStoppedRef.current = true; return; }
    } catch { /* chưa có thông tin vai trò — gọi như cũ */ }
    try {
      const { get } = require('../services/api.service');
      const res = await get('/api/v1/emergency/alerts?recentHours=24');
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const first = res.data[0];
        const pName = first.patientId?.profile?.name || first.patientId?.profile?.fullName || first.patientName || 'Bệnh nhân cấp cứu';
        const locStr = first.location?.roomNumber ? `[${first.location.roomNumber} - ${first.location.bedNumber}]` : '';
        const mId = first.patientId?.profile?.patientId || first.isbarHandoff?.hisPatientCode || locStr || 'Cấp cứu';
        const reasonStr = first.clinicalSeverity?.reasonNotes || first.isbarHandoff?.situation || first.triggerReason || first.reason || 'Cần ưu tiên xử trí khẩn cấp!';
        setActiveEmergency({
          ...first,
          patientName: pName,
          medicalId: mId,
          reason: reasonStr
        });
      } else {
        setActiveEmergency(null);
      }
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('hết hạn') || err.message?.includes('khóa')) {
        isPollingStoppedRef.current = true;
      }
    }
  };

  const fetchNotifications = async () => {
    if (isPollingStoppedRef.current) return;
    try {
      const { get } = require('../services/api.service');
      const res = await get('/api/v1/notifications');
      if (res && res.success) {
        setNotifications(res.data?.notifications || []);
        setUnreadCount(res.data?.unreadCount || 0);
      }
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('hết hạn') || err.message?.includes('khóa')) {
        isPollingStoppedRef.current = true;
      }
    }
  };

  const markNotifRead = async (id) => {
    try {
      const { put } = require('../services/api.service');
      await put(`/api/v1/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotifsRead = async () => {
    try {
      const { put } = require('../services/api.service');
      await put('/api/v1/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  /** Mở hộp thoại hồ sơ cá nhân và làm mới dữ liệu từ /auth/me */
  const openProfileModal = async () => {
    setShowMobileMenu(false);
    setIsEditingProfile(false);
    setProfileFeedback(null);
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const { get } = require('../services/api.service');
      const data = await get('/auth/me');
      if (data?.user) {
        setLocalUser(data.user);
        try {
          const { safeStorage } = require('../utils/safeStorage');
          safeStorage.setItem('user', JSON.stringify(data.user));
        } catch { /* bỏ qua lỗi storage */ }
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const startEditProfile = () => {
    setProfileFeedback(null);
    setEditName(localUser?.profile?.name || localUser?.profile?.fullName || '');
    setEditGender(localUser?.profile?.gender || '');
    setEditDob(formatDobDisplay(localUser?.profile?.dob));
    setEditPhone('');
    setEditAddress(localUser?.profile?.address || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    const built = buildProfilePayload({
      name: editName,
      phone: editPhone,
      address: editAddress,
      gender: editGender,
      dobText: editDob,
    });
    if (!built.ok) {
      setProfileFeedback({ type: 'error', text: built.error });
      return;
    }
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      const { put } = require('../services/api.service');
      const res = await put('/auth/profile', built.payload);
      if (res && res.success) {
        const updatedUser = { ...localUser, ...res.user };
        setLocalUser(updatedUser);
        try {
          const { safeStorage } = require('../utils/safeStorage');
          safeStorage.setItem('user', JSON.stringify(updatedUser));
        } catch { /* bỏ qua lỗi storage */ }
        setIsEditingProfile(false);
        setProfileFeedback({ type: 'success', text: 'Đã cập nhật thông tin cá nhân.' });
      } else {
        setProfileFeedback({ type: 'error', text: res?.message || 'Cập nhật thất bại.' });
      }
    } catch (err) {
      setProfileFeedback({ type: 'error', text: err.message || 'Không thể lưu thông tin cá nhân.' });
    } finally {
      setSavingProfile(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      setLocalUser(user);
      return;
    }
    
    const fetchUser = async () => {
      try {
        const { get } = require('../services/api.service');
        const data = await get('/auth/me');
        setLocalUser(data.user);
      } catch (err) {
        console.error('Failed to fetch user in ResponsiveLayout:', err);
      }
    };
    fetchUser();
  }, [user]);

  React.useEffect(() => {
    fetchNotifications();
    fetchEmergencyAlerts();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchEmergencyAlerts();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDefaultLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await performLogout();
      navigation.reset({
        index: 0,
        routes: [{ name: portalLoginRoute() }],
      });
    }
  };

  const isPatient = localUser?.role === 'patient';
  const theme = SHELL_THEME;
  const roleLabel = !localUser ? 'Đang tải…' : (localUser?.role === 'admin' || localUser?.role === 'system_admin') ? 'Quản trị viên hệ thống' : 
                    localUser?.role === 'hospital_admin' ? 'Quản lý Bệnh viện' : 
                    localUser?.role === 'department_head' ? 'Trưởng khoa Ung thư Não' :
                    localUser?.role === 'radiologist' ? 'Bác sĩ Chẩn đoán Hình ảnh' :
                    localUser?.role === 'doctor' ? 'Bác sĩ Chuyên khoa' : 
                    localUser?.role === 'lab_technician' ? 'KTV Xét nghiệm' :
                    localUser?.role === 'technician' ? 'KTV Chẩn đoán Hình ảnh' : 
                    localUser?.role === 'nurse' ? 'Điều dưỡng' : 
                    localUser?.role === 'receptionist' ? 'Nhân viên Tiếp đón & Thu ngân' : 
                    localUser?.role === 'pharmacist' ? 'Dược sĩ Bệnh viện' : 'Bệnh nhân';

  // Banner cảnh báo cấp cứu: đích "Xử lý ngay" theo vai trò — Dược sĩ xử lý thuốc cấp cứu
  // (trước đây mọi role đều bị đưa sang hàng đợi đọc MRI của Bác sĩ).
  const canActOnEmergency = !['cleaner', 'lab_technician'].includes(localUser?.role);
  const emergencyNavTarget = () => {
    if (localUser?.role === 'pharmacist') return isFeatureEnabled('pharmacy') ? { route: 'PharmacyQueue', params: {} } : { route: 'Home', params: {} };
    if (localUser?.role === 'receptionist') return { route: 'NurseReception', params: { tab: 'myQueue' } };
    return { route: 'DoctorWorkQueue', params: { tab: 'mriQueue' } };
  };
  const handleEmergencyPress = () => {
    const t = emergencyNavTarget();
    navigation.navigate(t.route, t.params);
  };
  // Hiện mức cảnh báo bằng tiếng Việt thay cho mã thô trong ngoặc vuông ([RED]/[ORANGE])
  const emergencyLevelLabel = (level) => (level === 'RED' ? 'ĐỎ' : level === 'ORANGE' ? 'CAM' : level);

  // Menu items config - Tách riêng từng role hoàn chỉnh bám sát thực tế lâm sàng
  const getMenuItems = (role) => {
    switch (role) {
      case 'patient':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Lấy số khám', route: 'QueueTicket', icon: Ticket },
          { label: 'Phim MRI & CT', route: 'ImagingHistory', icon: Brain },
          { label: 'Phân tích AI', route: 'AIAnalysis', icon: Activity },
          { label: 'Lịch sử khám', route: 'PatientRecords', icon: FileText },
          { label: 'Sức khỏe của tôi', route: 'MyHealth', icon: Heart },
          { label: 'Hóa đơn viện phí', route: 'MyInvoices', icon: CreditCard },
          { label: 'Chia sẻ bệnh án', route: 'RecordShare', icon: QrCode },
          { label: 'Dữ liệu cá nhân của tôi', route: 'PrivacyConsents', icon: FileCheck },
          { label: 'Bản sao bệnh án', route: 'RecordCopies', icon: FileCheck },
          { label: 'Hỏi đáp sức khỏe', route: 'HealthChat', icon: MessageCircle },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'doctor':
      case 'department_head':
        return [
          { section: 'Khám & Chẩn đoán', label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { section: 'Khám & Chẩn đoán', label: 'Hàng đợi khám & đọc MRI', route: 'DoctorWorkQueue', params: { tab: 'all' }, icon: Stethoscope },
          { section: 'Khám & Chẩn đoán', label: 'Bình duyệt phim lần 2', route: 'PeerReview', icon: FileSearch },
          { section: 'Khám & Chẩn đoán', label: 'Y lệnh miệng cấp cứu', route: 'VerbalOrders', icon: ClipboardCheck },
          { section: 'Bệnh nhân & Hồ sơ', label: 'Bệnh nhân', route: 'DoctorPatientList', icon: Users },
          { section: 'Bệnh nhân & Hồ sơ', label: 'Bệnh án điện tử', route: 'EMRDashboard', params: { tab: 'records' }, group: true, icon: FolderOpen },
          { section: 'Bệnh nhân & Hồ sơ', label: 'Quét mã QR bệnh án', route: 'ScanRecordQr', icon: ScanLine },
          { section: 'Bệnh nhân & Hồ sơ', label: 'Sơ đồ giường bệnh', route: 'EMRDashboard', params: { tab: 'beds' }, icon: Building2 },
          { section: 'Bệnh nhân & Hồ sơ', label: 'Danh mục thuốc', route: 'DrugManagement', params: { tab: 'list' }, icon: Package },
          ...(role === 'department_head' ? [
            { section: 'Quản lý khoa', label: 'Báo cáo vận hành & lâm sàng', route: 'ClinicalReports', icon: Gauge },
            { section: 'Quản lý khoa', label: 'Công việc ca trực', route: 'TaskBoard', icon: ClipboardList },
            { section: 'Quản lý khoa', label: 'Lịch sử cấp cứu', route: 'EmergencyHistory', icon: AlertTriangle },
          ] : []),
          { section: 'Cá nhân & Ca trực', label: 'Phân công của tôi', route: 'MyAssignments', icon: ClipboardCheck },
          { section: 'Cá nhân & Ca trực', label: 'Lịch trực', route: 'StaffScheduling', icon: Calendar },
          { section: 'Cá nhân & Ca trực', label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'radiologist':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Phân công của tôi', route: 'MyAssignments', icon: ClipboardCheck },
          { label: 'Trạm đọc phim MRI / PACS', route: 'DoctorWorkQueue', params: { tab: 'mriQueue' }, icon: Brain },
          { label: 'Tất cả ca khám & Hội chẩn', route: 'DoctorWorkQueue', params: { tab: 'all' }, icon: Stethoscope },
          { label: 'Tải phim MRI/PACS (AI)', route: 'CreateImagingResult', icon: UploadCloud },
          { label: 'Bình duyệt phim lần 2', route: 'PeerReview', icon: FileSearch },
          { label: 'Phòng máy MRI', route: 'MriRooms', icon: Building2 },
          { label: 'Lịch sử cấp cứu', route: 'EmergencyHistory', icon: AlertTriangle },
          { label: 'Bệnh nhân', route: 'DoctorPatientList', icon: Users },
          { label: 'Bệnh án điện tử', route: 'EMRDashboard', params: { tab: 'records' }, group: true, icon: FolderOpen },
          { label: 'Lịch trực', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'lab_technician':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Danh sách Bệnh nhân (LIS)', route: 'DoctorPatientList', icon: Users },
          { label: 'Bệnh án & Xét nghiệm', route: 'EMRDashboard', params: { tab: 'records' }, group: true, icon: FolderOpen },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'technician':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Phòng chụp phim (MRI)', route: 'DoctorWorkQueue', params: { tab: 'mriQueue' }, icon: Brain },
          { label: 'Tải phim MRI/PACS (AI)', route: 'CreateImagingResult', icon: UploadCloud },
          { label: 'Xem ảnh DICOM (PACS)', route: 'DicomViewer', icon: Monitor },
          { label: 'Phòng máy MRI', route: 'MriRooms', icon: Building2 },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'nurse':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Gọi đo sinh hiệu', route: 'NurseTriage', icon: Activity },
          { label: 'Nhập sinh hiệu', route: 'EMRDashboard', params: { tab: 'nurseQueue' }, icon: ClipboardList },
          { label: 'Y lệnh miệng', route: 'VerbalOrders', icon: ClipboardCheck },
          { label: 'Sơ đồ giường bệnh', route: 'EMRDashboard', params: { tab: 'beds' }, icon: Building2 },
          { label: 'Bệnh án điện tử', route: 'EMRDashboard', params: { tab: 'records' }, group: true, icon: FolderOpen },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'receptionist':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Tiếp nhận bệnh nhân', route: 'NurseReception', params: { tab: 'createVisit' }, icon: ClipboardList },
          { label: 'Quét mã bệnh án', route: 'ScanRecordQr', icon: ScanLine },
          { label: isFeatureEnabled('bhyt') ? 'Khai báo BHYT & Thu ngân' : 'Thu ngân', route: 'NurseReception', params: { tab: 'billing' }, icon: CreditCard },
          { label: 'Hồ sơ Chuyển viện', route: 'EMRDashboard', params: { tab: 'transfers' }, icon: ArrowRightLeft },
          { label: 'Duyệt hoàn tiền', route: 'FinanceApprovals', icon: CreditCard },
          { label: 'Công việc ca trực', route: 'TaskBoard', icon: ClipboardList },
          { label: 'Bản sao bệnh án', route: 'RecordCopyReview', icon: FileCheck },
          { label: 'Lượt tiếp đón hôm nay', route: 'NurseReception', params: { tab: 'myQueue' }, icon: FileText },
          { label: 'Hàng chờ ca khám', route: 'DoctorWorkQueue', params: { tab: 'examQueue' }, icon: Activity },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'pharmacist':
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Hàng đợi Khoa Dược', route: 'PharmacyQueue', icon: Package },
          { label: 'Hậu kiểm dược', route: 'PharmacyOversight', icon: FileSearch },
          ...(isFeatureEnabled('pharmacy') ? [{ label: 'Hóa đơn kẹt trừ kho', route: 'FinanceApprovals', icon: CreditCard }] : []),
          { label: 'Danh mục thuốc', route: 'DrugManagement', params: { tab: 'list' }, icon: Pill },
          { label: 'Thuốc hết hạn', route: 'DrugManagement', params: { tab: 'expiry' }, icon: AlertTriangle },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'hospital_admin':
        return [
          { label: 'Tổng quan', route: 'ClinicDashboard', icon: LayoutDashboard },
          { label: 'Bệnh án điện tử', route: 'EMRDashboard', params: { tab: 'records' }, group: true, icon: FolderOpen },
          { label: 'Sơ đồ giường bệnh', route: 'EMRDashboard', params: { tab: 'beds' }, icon: Building2 },
          { label: 'Chuyển viện liên viện', route: 'EMRDashboard', params: { tab: 'transfers' }, icon: ArrowRightLeft },
          { label: 'Quản lý nhân sự', route: 'StaffManagement', icon: Users },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: Calendar },
          { label: 'Điều chuyển phân công ca', route: 'AssignmentOverride', icon: Shuffle },
          { label: 'Năng suất & SLA', route: 'SlaReport', icon: Gauge },
          { label: 'Báo cáo tài chính', route: 'Financials', icon: DollarSign },
          { label: 'Duyệt hoàn tiền và bảo lãnh', route: 'FinanceApprovals', icon: FileCheck },
          { label: 'Báo cáo vận hành và lâm sàng', route: 'ClinicalReports', icon: Gauge },
          { label: 'Công việc ca trực', route: 'TaskBoard', icon: ClipboardList },
          { label: 'Bình duyệt phim lần 2', route: 'PeerReview', icon: FileSearch },
          { label: 'Phòng máy MRI', route: 'MriRooms', icon: Building2 },
          { label: 'Lịch sử cấp cứu', route: 'EmergencyHistory', icon: AlertTriangle },
          { label: 'Hậu kiểm dược', route: 'PharmacyOversight', icon: Pill },
          { label: 'Tuân thủ và dữ liệu', route: 'ComplianceCenter', icon: Database },
          { label: 'Quản lý kho thuốc', route: 'DrugManagement', params: { tab: 'list' }, icon: Package },
          { label: 'Nhật ký kiểm toán lâm sàng', route: 'ClinicalAudit', icon: FileSearch },
          { label: 'Bản sao bệnh án', route: 'RecordCopyReview', icon: FileCheck },
          { label: 'Thông tin bệnh viện', route: 'HospitalOnboarding', icon: Building2 },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      case 'admin':
      case 'system_admin':
        return [
          { label: 'Tổng quan', route: 'AdminBackoffice', params: { tab: 'metrics' }, icon: LayoutDashboard },
          { label: 'Người dùng', route: 'AdminBackoffice', params: { tab: 'users' }, icon: Users },
          { label: 'Bệnh viện', route: 'AdminBackoffice', params: { tab: 'hospitals' }, icon: Building2 },
          { label: 'Dataset', route: 'AdminBackoffice', params: { tab: 'datasets' }, icon: Database },
          { label: 'Nhật ký hệ thống', route: 'AdminBackoffice', params: { tab: 'audit-logs' }, icon: ClipboardList },
          { label: 'SaaS Suite (nâng cao)', route: 'AdminBackoffice', params: { tab: 'saas-suite' }, icon: Sliders },
          { label: 'Huấn luyện & Chatbot AI', route: 'AdminBackoffice', params: { tab: 'ai-config' }, icon: Brain },
          // Báo cáo tài chính là số liệu của từng viện: tài khoản nền tảng không gắn viện và không đọc hóa đơn (RELEASE v3.4) → bỏ khỏi menu
          { label: 'Yêu cầu hỗ trợ', route: 'SupportTicketsAdmin', icon: MessageCircle },
          { label: 'Tuân thủ và dữ liệu', route: 'ComplianceCenter', icon: FileSearch },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
      default:
        return [
          { label: 'Tổng quan', route: 'Home', icon: LayoutDashboard },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: PhoneCall },
        ];
    }
  };

  const menuItems = localUser ? filterMenuInScope(getMenuItems(localUser.role).filter(Boolean)) : [];

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isItemActive = (item) => {
    if (item.group && activeRoute.startsWith(item.route)) {
      const hasOwnItem = menuItems.some(o => o !== item && o.params?.tab && activeRoute === `${o.route}_${o.params.tab}`);
      if (!hasOwnItem) return true;
    }
    if (item.params?.tab) {
      if (activeRoute === `${item.route}_${item.params.tab}`) return true;
      if (activeRoute === 'ReceptionistDashboard_createVisit' && item.route === 'NurseReception' && item.params?.tab === 'createVisit') return true;
      if (activeRoute === 'ReceptionistDashboard_billing' && item.route === 'NurseReception' && item.params?.tab === 'billing') return true;
      if (activeRoute === 'ReceptionistDashboard_myQueue' && item.route === 'NurseReception' && item.params?.tab === 'myQueue') return true;
      if (activeRoute === 'EMRDashboard' && item.params.tab === 'records') return true;
      if (activeRoute === 'DrugManagement' && item.params.tab === 'list') return true;
      return false;
    }
    if (item.route === 'DoctorWorkQueue' && activeRoute.startsWith('DoctorWorkQueue')) return false;
    if (item.route === 'NurseReception' && (activeRoute.startsWith('NurseReception') || activeRoute.startsWith('ReceptionistDashboard'))) return false;
    if (item.route === 'EMRDashboard' && activeRoute.startsWith('EMRDashboard')) return false;
    return activeRoute === item.route;
  };

  /** Hộp thoại xem và chỉnh sửa nhanh hồ sơ cá nhân */
  const renderProfileModal = () => {
    if (!showProfileModal) return null;
    const displayName = localUser?.profile?.name || localUser?.profile?.fullName || 'Người dùng';
    const profileRows = [
      localUser?.email ? { icon: Mail, label: 'Email đăng nhập', value: localUser.email } : null,
      { icon: ShieldCheck, label: 'Vai trò', value: roleLabel },
      !isPatient && localUser?.departmentId
        ? {
            icon: Building2,
            label: 'Khoa / Đơn vị',
            value: DEPARTMENT_LABELS[localUser.departmentId] || localUser.departmentId,
          }
        : null,
      !isPatient && localUser?.profile?.specialty
        ? {
            icon: Stethoscope,
            label: 'Chuyên môn',
            value: SPECIALTY_LABELS[localUser.profile.specialty] || localUser.profile.specialty,
          }
        : null,
      localUser?.profile?.medicalId
        ? { icon: User, label: isPatient ? 'Mã bệnh nhân' : 'Mã nhân sự / Y tế', value: localUser.profile.medicalId }
        : null,
      {
        icon: Users,
        label: 'Giới tính',
        value: localUser?.profile?.gender || 'Chưa cập nhật',
      },
      {
        icon: Calendar,
        label: 'Ngày tháng năm sinh',
        value: formatDobSummary(localUser?.profile),
      },
      {
        icon: Phone,
        label: 'Số điện thoại',
        value: localUser?.profile?.phoneLast4
          ? `•••• ${localUser.profile.phoneLast4}`
          : localUser?.phone
          ? 'Đã liên kết (bảo mật)'
          : 'Chưa cập nhật',
      },
      {
        icon: MapPin,
        label: 'Địa chỉ',
        value: localUser?.profile?.address || 'Chưa cập nhật',
      },
    ].filter(Boolean);

    return (
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={[styles.modalOverlay, { zIndex: 99999 }]}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <View style={[styles.profileModalAvatar, { backgroundColor: theme.avatar }]}>
                  <Text style={styles.profileModalAvatarText}>
                    {localUser ? getInitials(displayName) : 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text style={styles.modalSub}>{roleLabel}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Đóng hồ sơ"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {profileFeedback && (
              <View
                style={[
                  styles.profileFeedbackBox,
                  profileFeedback.type === 'error' ? styles.profileFeedbackError : styles.profileFeedbackSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.profileFeedbackText,
                    profileFeedback.type === 'error'
                      ? styles.profileFeedbackTextError
                      : styles.profileFeedbackTextSuccess,
                  ]}
                >
                  {profileFeedback.text}
                </Text>
              </View>
            )}

            {profileLoading && !localUser ? (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.modalSub, { marginTop: 8 }]}>Đang tải thông tin tài khoản…</Text>
              </View>
            ) : isEditingProfile ? (
              <ScrollView style={{ maxHeight: 400, marginTop: 8 }}>
                <ProfileFormFields
                  name={editName}
                  onChangeName={setEditName}
                  gender={editGender}
                  onChangeGender={setEditGender}
                  dobText={editDob}
                  onChangeDobText={setEditDob}
                  phone={editPhone}
                  onChangePhone={setEditPhone}
                  phoneLast4={localUser?.profile?.phoneLast4}
                  address={editAddress}
                  onChangeAddress={setEditAddress}
                  accentColor={theme.accent}
                />
              </ScrollView>
            ) : (
              <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
                <View style={styles.profileList}>
                  {profileRows.map((row) => {
                    const RowIcon = row.icon;
                    return (
                      <View key={row.label} style={styles.profileRow}>
                        <View style={styles.profileRowIcon}>
                          <RowIcon size={15} color={theme.accent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.profileRowLabel}>{row.label}</Text>
                          <Text style={styles.profileRowValue}>{row.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <View style={styles.profileActions}>
              {isEditingProfile ? (
                <>
                  <TouchableOpacity
                    style={styles.profileBtnSecondary}
                    onPress={() => {
                      setIsEditingProfile(false);
                      setProfileFeedback(null);
                    }}
                    disabled={savingProfile}
                  >
                    <Text style={styles.profileBtnSecondaryText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.profileBtnPrimary, { backgroundColor: theme.accent }]}
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    <Save size={15} color="#FFFFFF" />
                    <Text style={styles.profileBtnPrimaryText}>
                      {savingProfile ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.profileBtnSecondary}
                    onPress={() => setShowProfileModal(false)}
                  >
                    <Text style={styles.profileBtnSecondaryText}>Đóng</Text>
                  </TouchableOpacity>
                  {localUser && (
                    <TouchableOpacity
                      style={[styles.profileBtnPrimary, { backgroundColor: theme.accent }]}
                      onPress={startEditProfile}
                    >
                      <Edit3 size={15} color="#FFFFFF" />
                      <Text style={styles.profileBtnPrimaryText}>Chỉnh sửa</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // MOBILE VIEW RENDERING
  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {/* Mobile Top Navigation Header */}
        <View style={{
          backgroundColor: theme.dark,
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: theme.darkRaised,
          zIndex: 40,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setShowMobileMenu(true)}
              style={{ padding: 6, backgroundColor: theme.darkRaised, borderRadius: 8 }}
              accessibilityLabel="Mở danh mục chức năng"
            >
              <Menu size={20} color={theme.onDarkAccent} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15, letterSpacing: -0.2 }}>NeuroScan AI</Text>
              <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '500' }}>{roleLabel}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{ padding: 6 }}
              onPress={openProfileModal}
              accessibilityLabel="Xem hồ sơ cá nhân"
            >
              <User size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ padding: 6, position: 'relative' }} 
              onPress={() => setShowNotifModal(true)}
              accessibilityLabel="Thông báo"
            >
              <Bell size={18} color="#94A3B8" />
              {unreadCount > 0 && (
                <View style={[styles.bellBadge, { top: 0, right: 0 }]}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDefaultLogout}
              style={{ padding: 6, backgroundColor: theme.darkRaised, borderRadius: 8 }}
              accessibilityLabel="Đăng xuất"
            >
              <LogOut size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Emergency Alert Banner on Mobile */}
        {activeEmergency && !isPatient && (
          <TouchableOpacity
            onPress={handleEmergencyPress}
            style={{
              backgroundColor: activeEmergency.level === 'RED' ? '#B91C1C' : '#C2410C',
              paddingVertical: 8,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <AlertTriangle size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 11, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                CẤP CỨU: {activeEmergency.patientName} ({activeEmergency.medicalId})
              </Text>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', marginLeft: 6 }}>Xử lý ngay</Text>
          </TouchableOpacity>
        )}

        {/* Main Content Area on Mobile */}
        <View style={{ flex: 1 }}>
          {children}
        </View>

        {/* Mobile Navigation Drawer Modal */}
        <Modal
          visible={showMobileMenu}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowMobileMenu(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row' }}>
            <View style={{
              width: '82%',
              maxWidth: 320,
              backgroundColor: theme.dark,
              height: '100%',
              paddingTop: 20,
              paddingBottom: 24,
              paddingHorizontal: 16,
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.darkRaised }}>
                  <TouchableOpacity
                    onPress={openProfileModal}
                    activeOpacity={0.75}
                    accessibilityLabel="Xem hồ sơ cá nhân"
                    style={{ flex: 1, paddingRight: 8 }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>NeuroScan AI</Text>
                    <Text style={{ color: theme.onDarkSub, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                      {localUser?.profile?.name || 'Người dùng'} · {roleLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowMobileMenu(false)} style={{ padding: 6 }}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {menuItems.map((item, idx) => {
                    const isActive = isItemActive(item);
                    const IconComponent = item.icon;
                    const showSection = Boolean(item.section) && item.section !== menuItems[idx - 1]?.section;
                    return (
                      <React.Fragment key={`m_${item.route}_${item.label}`}>
                        {showSection ? (
                          <Text style={{
                            color: '#94A3B8',
                            fontSize: 10,
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: 0.7,
                            marginTop: idx === 0 ? 4 : 12,
                            marginBottom: 4,
                            paddingHorizontal: 14,
                          }}>
                            {item.section}
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 8,
                            marginBottom: 4,
                            backgroundColor: isActive ? theme.onDarkActiveBg : 'transparent',
                            borderLeftWidth: isActive ? 3 : 0,
                            borderLeftColor: theme.onDarkAccent,
                          }}
                          onPress={() => {
                            setShowMobileMenu(false);
                            navigation.navigate(item.route, item.params);
                          }}
                        >
                          <IconComponent size={18} color={isActive ? theme.onDarkAccent : '#94A3B8'} />
                          <Text style={{
                            color: isActive ? theme.onDarkAccent : '#E2E8F0',
                            fontWeight: isActive ? 'bold' : '500',
                            marginLeft: 12,
                            fontSize: 14,
                          }}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: theme.darkRaised,
                  borderRadius: 8,
                }}
                onPress={() => {
                  setShowMobileMenu(false);
                  handleDefaultLogout();
                }}
              >
                <LogOut size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 14 }}>Đăng xuất phiên làm việc</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowMobileMenu(false)} />
          </View>
        </Modal>

        {/* Notifications Modal on Mobile */}
        {showNotifModal && (
          <Modal
            visible={showNotifModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowNotifModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Bell size={18} color={theme.accent} strokeWidth={2.3} />
                    <Text style={styles.modalTitle}>Thông báo y khoa nội bộ</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowNotifModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.modalSub}>Lịch sử cảnh báo & cập nhật bệnh án</Text>
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllNotifsRead}>
                      <Text style={styles.markAllReadText}>Đánh dấu tất cả đã đọc</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={styles.notifScroll} contentContainerStyle={styles.notifList}>
                  {notifications.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Chưa có thông báo mới.</Text>
                    </View>
                  ) : (
                    notifications.map((n) => (
                      <TouchableOpacity
                        key={n._id}
                        style={[styles.notifItem, !n.isRead && styles.notifItemUnread]}
                        onPress={() => markNotifRead(n._id)}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text style={[styles.notifTitle, !n.isRead && styles.textBold]}>
                            {n.title}
                          </Text>
                          {!n.isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notifMessage}>{n.message}</Text>
                        <Text style={styles.notifTime}>
                          {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' - '}
                          {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {renderProfileModal()}
      </View>
    );
  }

  return (
    <View style={styles.desktopWrapper}>
      {/* Left Sidebar */}
      <View style={styles.sidebar}>
        {/* Brand Logo */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandName}>NeuroScan AI</Text>
            <Text style={[styles.brandSub, { color: theme.accent }]}>HỖ TRỢ SÀNG LỌC U NÃO & EMR</Text>
          </View>
        </View>

        {/* User Card */}
        <View style={[styles.userCard, { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }]}>
          <Pressable
            onPress={openProfileModal}
            accessibilityRole="button"
            accessibilityLabel="Xem hồ sơ cá nhân"
            style={({ hovered }) => [
              styles.userProfileTrigger,
              {
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                borderRadius: 10,
                padding: 4,
                margin: -4,
                backgroundColor: hovered ? '#F1F5F9' : 'transparent',
              },
            ]}
          >
            <View style={[styles.avatarCircle, { backgroundColor: theme.avatar, flexShrink: 0 }]}>
              <Text style={styles.avatarText}>
                {localUser ? getInitials(localUser.profile?.name) : 'U'}
              </Text>
            </View>
            <View style={[styles.userInfo, { flex: 1, minWidth: 0, overflow: 'hidden', marginRight: 6 }]}>
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                {localUser?.profile?.name || 'Người dùng'}
              </Text>
              <Text style={styles.userRole} numberOfLines={1} ellipsizeMode="tail">
                {roleLabel}
              </Text>
            </View>
          </Pressable>
          {localUser && (
            <TouchableOpacity 
              style={[styles.bellBtn, { flexShrink: 0, marginLeft: 4 }]} 
              onPress={() => setShowNotifModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Thông báo"
            >
              <Bell size={17} color={theme.accent} strokeWidth={2.2} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Nav Links */}
        <ScrollView style={styles.navLinks} contentContainerStyle={styles.navLinksContent}>
          {menuItems.map((item, idx) => {
            const isActive = isItemActive(item);
            const IconComponent = item.icon;
            const showSection = Boolean(item.section) && item.section !== menuItems[idx - 1]?.section;
            return (
              <React.Fragment key={`${item.route}_${item.label}`}>
                {showSection ? (
                  <Text style={{
                    color: '#94A3B8',
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    marginTop: idx === 0 ? 2 : 12,
                    marginBottom: 4,
                    paddingHorizontal: 10,
                  }}>
                    {item.section}
                  </Text>
                ) : null}
                <PressableScale
                  style={[styles.navItem, isActive && { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}
                  hoverStyle={!isActive && styles.navItemHover}
                  onPress={() => navigation.navigate(item.route, item.params)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[styles.navIconContainer, isActive && styles.navIconContainerActive]}>
                    <IconComponent size={17} color={isActive ? theme.accent : '#64748B'} strokeWidth={isActive ? 2.3 : 1.8} />
                  </View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive, isActive && { color: theme.accent }]}>
                    {item.label}
                  </Text>
                </PressableScale>
              </React.Fragment>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleDefaultLogout} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LogOut size={15} color="#64748B" strokeWidth={2} />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Pane */}
      <View style={styles.mainContent}>
        {/* Emergency Protocol Red/Orange Alert Banner */}
        {activeEmergency && !isPatient && (
          <View style={{
            backgroundColor: activeEmergency.level === 'RED' ? '#B91C1C' : '#C2410C',
            paddingVertical: 10,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 2,
            borderBottomColor: activeEmergency.level === 'RED' ? '#7F1D1D' : '#9A3412',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: 6,
                borderRadius: 9999,
              }}>
                <AlertTriangle size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
                  CẢNH BÁO CẤP CỨU {emergencyLevelLabel(activeEmergency.level)} - BỆNH NHÂN: {activeEmergency.patientName?.toUpperCase()} ({activeEmergency.medicalId})
                </Text>
                <Text style={{ color: '#FEE2E2', fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                  {activeEmergency.reason || 'Cần ưu tiên dời lịch & chuẩn bị phòng chụp MRI khẩn cấp!'}
                </Text>
              </View>
            </View>

            {canActOnEmergency && (
            <TouchableOpacity
              style={{
                backgroundColor: '#FFFFFF',
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              onPress={handleEmergencyPress}
              activeOpacity={0.85}
            >
              <Text style={{ color: activeEmergency.level === 'RED' ? '#B91C1C' : '#C2410C', fontWeight: 'bold', fontSize: 12 }}>
                Xử lý ngay
              </Text>
              <ChevronRight size={14} color={activeEmergency.level === 'RED' ? '#B91C1C' : '#C2410C'} strokeWidth={2.5} />
            </TouchableOpacity>
            )}
          </View>
        )}

        {children}
      </View>

      {/* Notification Modal */}
      {showNotifModal && (
        <Modal
          visible={showNotifModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowNotifModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Bell size={18} color={theme.accent} strokeWidth={2.3} />
                  <Text style={styles.modalTitle}>Thông báo y khoa nội bộ</Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotifModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalSub}>Lịch sử cảnh báo & cập nhật bệnh án</Text>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllNotifsRead}>
                    <Text style={styles.markAllReadText}>Đánh dấu tất cả đã đọc</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={styles.notifScroll} contentContainerStyle={styles.notifList}>
                {notifications.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Bạn không có thông báo nào.</Text>
                  </View>
                ) : (
                  notifications.map((notif) => (
                    <TouchableOpacity
                      key={notif._id}
                      style={[styles.notifItem, !notif.isRead && styles.notifItemUnread]}
                      onPress={() => markNotifRead(notif._id)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.notifTitle, !notif.isRead && styles.textBold]}>
                          {notif.title}
                        </Text>
                        {!notif.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(notif.createdAt).toLocaleDateString('vi-VN')} {new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {renderProfileModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  desktopWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    height: '100%',
    width: '100%',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.brandNavy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 10,
  },
  logoInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  brandName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6, // giữ cỡ cũ: chữ in hoa dài, sidebar 250px không đủ chỗ cho cỡ lớn hơn
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userProfileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.brandNavy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    marginRight: 6,
  },
  userName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brandGreenSoft,
    borderWidth: 1,
    borderColor: '#CDEBDF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  navLinks: {
    flex: 1,
  },
  navLinksContent: {
    padding: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemHover: {
    backgroundColor: '#F1F5F9',
  },
  navIconContainer: {
    marginRight: 12,
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainerActive: {
    transform: [{ scale: 1.05 }],
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  navLabelActive: {
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F3F7FC',
  },
  bellBtn: {
    padding: 8,
    position: 'relative',
    marginLeft: 'auto',
  },
  bellIconText: {
    fontSize: 18,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalCloseBtn: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
    padding: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  notifScroll: {
    flex: 1,
    marginTop: 10,
  },
  notifList: {
    gap: 10,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  notifItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  notifItemUnread: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#15803D',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  notifMessage: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
  profileModalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  profileFeedbackBox: {
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  profileFeedbackSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  profileFeedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  profileFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileFeedbackTextSuccess: {
    color: '#15803D',
  },
  profileFeedbackTextError: {
    color: '#B91C1C',
  },
  profileList: {
    gap: 10,
    paddingVertical: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  profileRowLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  profileRowValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 2,
  },
  profileField: {
    marginBottom: 12,
  },
  profileFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  profileBtnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  profileBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  profileBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  profileBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ResponsiveLayout;
