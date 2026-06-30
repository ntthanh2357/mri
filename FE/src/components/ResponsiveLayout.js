import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { setAuthToken } from '../services/api.service';

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

  const fetchNotifications = async () => {
    try {
      const { get } = require('../services/api.service');
      const res = await get('/api/v1/notifications');
      if (res && res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      // Quietly ignore network failures in background polling
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
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleDefaultLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      setAuthToken('');
      navigation.replace('Welcome');
    }
  };

  if (!isDesktop) {
    return <>{children}</>;
  }

  const isPatient = localUser?.role === 'patient';
  const roleLabel = localUser?.role === 'admin' ? 'Quản trị viên hệ thống' : 
                    localUser?.role === 'hospital_admin' ? 'Quản lý bệnh viện' : 
                    (localUser?.role === 'doctor' || localUser?.role === 'technician') ? 'Bác sĩ & Kỹ thuật viên' : 
                    (localUser?.role === 'nurse' || localUser?.role === 'receptionist') ? 'Điều dưỡng & Lễ tân' : 'Bệnh nhân';

  // Menu items config
  const getMenuItems = (role) => {
    switch (role) {
      case 'patient':
        return [
          { label: 'Tổng quan', route: 'Home', icon: '📊' },
          { label: 'Phim MRI & CT', route: 'ImagingHistory', icon: '🧠' },
          { label: 'Phân tích AI', route: 'AIAnalysis', icon: '📸' },
          { label: 'Lịch sử khám', route: 'PatientRecords', icon: '📜' },
          { label: 'Khai báo bệnh án', route: 'MedicalRecordForm', icon: '📋' },
          { label: 'Mua Premium', route: 'Premium', icon: '💎' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '👨‍⚕️' },
        ];
      case 'admin':
        return [
          { label: 'Tổng quan', route: 'AdminBackoffice', icon: '📊' },
          { label: 'Báo cáo tài chính', route: 'Financials', icon: '💰' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '📞' },
        ];
      case 'hospital_admin':
        return [
          { label: 'Tổng quan', route: 'ClinicDashboard', icon: '📊' },
          { label: 'Quản lý EMR', route: 'EMRDashboard', icon: '📂' },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: '🗓️' },
          { label: 'Thông tin bệnh viện', route: 'HospitalOnboarding', icon: '🏥' },
          { label: 'Quản lý tài khoản', route: 'StaffManagement', icon: '👥' },
          { label: 'Báo cáo tài chính', route: 'Financials', icon: '💰' },
          { label: 'Quản lý kho thuốc', route: 'DrugManagement', icon: '📦' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '📞' },
        ];
      case 'doctor':
      case 'technician':
        return [
          { label: 'Tổng quan', route: 'Home', icon: '📊' },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: '🗓️' },
          { label: 'Hàng đợi khám', route: 'DoctorWorkQueue', icon: '🩺' },
          { label: 'Phòng chụp phim (MRI)', route: 'TechnicianQueue', icon: '🔬' },
          { label: 'Danh mục thuốc', route: 'DrugManagement', icon: '📦' },
          { label: 'Bệnh án Điện tử', route: 'DoctorPatientList', icon: '📂' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '📞' },
        ];
      case 'nurse':
      case 'receptionist':
        return [
          { label: 'Tổng quan', route: 'Home', icon: '📊' },
          { label: 'Lịch làm việc', route: 'StaffScheduling', icon: '🗓️' },
          { label: 'Tiếp nhận Bệnh nhân', route: 'ReceptionistDashboard', icon: '📋' },
          { label: 'Hàng đợi ca khám', route: 'DoctorWorkQueue', icon: '🩺' },
          { label: 'Quản lý kho thuốc', route: 'DrugManagement', icon: '📦' },
          { label: 'Bệnh án Điện tử', route: 'EMRDashboard', icon: '📂' },
          { label: 'Thu ngân & Hóa đơn', route: 'ReceptionistDashboard', icon: '💳' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '📞' },
        ];
      default:
        return [
          { label: 'Tổng quan', route: 'Home', icon: '📊' },
          { label: 'Hỗ trợ kỹ thuật', route: 'Support', icon: '📞' },
        ];
    }
  };

  const menuItems = getMenuItems(localUser?.role);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <View style={styles.desktopWrapper}>
      {/* Left Sidebar */}
      <View style={styles.sidebar}>
        {/* Brand Logo */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInner} />
          </View>
          <View>
            <Text style={styles.brandName}>NeuroScan AI</Text>
            <Text style={styles.brandSub}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
          </View>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {localUser ? getInitials(localUser.profile?.name) : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {localUser?.profile?.name || 'Người dùng'}
            </Text>
            <Text style={styles.userRole}>
              {roleLabel}
            </Text>
          </View>
          {localUser && (
            <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotifModal(true)}>
              <Text style={styles.bellIconText}>🔔</Text>
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
          {menuItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={`${item.route}_${item.label}`}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => navigation.navigate(item.route)}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.sidebarFooter}>
          {isPatient && (
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Nâng cấp Premium 💎</Text>
              <Text style={styles.upgradeDesc}>
                Chỉ 99k/năm. Chat AI 24/7 & Phân tích chuyên sâu.
              </Text>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => navigation.navigate('Premium')}
              >
                <Text style={styles.upgradeBtnText}>Nâng cấp ngay</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleDefaultLogout}>
            <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Pane */}
      <View style={styles.mainContent}>
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
                <Text style={styles.modalTitle}>🔔 Thông báo nội bộ</Text>
                <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                  <Text style={styles.modalCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalSub}>Lịch sử thông báo y khoa & hệ thống</Text>
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
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    leadingHeight: 18,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#15803D',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#15803D',
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
  },
  userName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  userRole: {
    fontSize: 11,
    color: '#64748B',
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
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: '#DCFCE7',
  },
  navIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  navLabelActive: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  upgradeCard: {
    backgroundColor: '#15803D',
    borderRadius: 12,
    padding: 12,
  },
  upgradeTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  upgradeDesc: {
    color: '#D1FADF',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10,
  },
  upgradeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: 'bold',
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
    backgroundColor: '#F8FAFC',
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
});

export default ResponsiveLayout;
