import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { get, put } from '../services/api.service';
import { portalLoginRoute } from '../utils/navigationRef';
import performLogout from '../utils/logout';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PatientHome from '../components/patient/PatientHome';
import StaffHome from '../components/staff/StaffHome';
import ReceptionistHome from '../components/reception/ReceptionistHome';
import Colors from '../constants/colors';
import styles from './HomeScreen.styles';
import { Edit3, AlertCircle, Save } from 'lucide-react';

const HomeScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // [FIX] Guard: params từ URL có thể là chuỗi rác ("[object Object]") do
  // serialize params khi điều hướng web — chỉ chấp nhận object hợp lệ có role,
  // ngược lại coi như không có user để effect tự fetch /auth/me (đúng role).
  const paramUser = route.params?.user;
  const validParamUser =
    paramUser && typeof paramUser === 'object' && paramUser.role ? paramUser : null;
  const [user, setUser] = useState(validParamUser);
  const [loading, setLoading] = useState(!validParamUser);
  const [error, setError] = useState(null);

  // Profile edit states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleOpenEditProfile = () => {
    setEditName(user?.profile?.name || '');
    setEditPhone(user?.phone || ''); // hashed in DB, but users can re-type it
    setEditAddress(user?.profile?.address || '');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Yêu cầu', 'Vui lòng nhập Họ và tên.');
      return;
    }
    setUpdatingProfile(true);
    try {
      const res = await put('/auth/profile', {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
      });

      if (res && res.success) {
        Alert.alert('Thành công', 'Đã cập nhật thông tin cá nhân thành công!');
        setUser(res.user);
        setShowEditProfileModal(false);
      } else {
        Alert.alert('Lỗi', res.message || 'Cập nhật thất bại.');
      }
    } catch (err) {
      console.error('Lỗi lưu thông tin cá nhân:', err);
      Alert.alert('Lỗi', err.message || 'Không thể lưu thông tin cá nhân.');
    } finally {
      setUpdatingProfile(false);
    }
  };

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

  const handleLogout = async () => {
    // Quy trình logout chuẩn: hủy phiên phía BE (xóa cookie HttpOnly refresh
    // token) + xóa token local, rồi reset về màn đăng nhập của CỔNG HIỆN TẠI
    // ('/' → Welcome, '/staff' → StaffLogin). Reset cứng về 'Welcome' trên
    // Cổng nội bộ sẽ bị React Navigation từ chối → kẹt màn hình.
    await performLogout();
    navigation.reset({
      index: 0,
      routes: [{ name: portalLoginRoute() }],
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brandGreen} />
        <Text style={styles.loadingText}>Đang tải thông tin cá nhân...</Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#B91C1C" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>{error || 'Không tìm thấy thông tin người dùng.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleLogout}>
          <Text style={styles.retryButtonText}>Quay lại trang chủ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPatient = user.role === 'patient';

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="Home"
      user={user}
      onLogout={handleLogout}
    >
      <SafeAreaView style={styles.container}>
        {isPatient ? (
          <ScrollView>
            <PatientHome user={user} isDesktop={isDesktop} navigation={navigation} onEditProfile={handleOpenEditProfile} />
          </ScrollView>
        ) : user.role === 'receptionist' ? (
          // Lễ tân: bàn làm việc tiếp đón & thu ngân riêng (dinhhuyhoang)
          <ReceptionistHome user={user} navigation={navigation} />
        ) : (
          <StaffHome user={user} navigation={navigation} onEditProfile={handleOpenEditProfile} />
        )}
    </SafeAreaView>

    {/* EDIT PROFILE MODAL */}
    {showEditProfileModal && (
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Edit3 size={18} color={Colors.brandGreen} />
              <Text style={styles.modalTitle}>Chỉnh sửa thông tin cá nhân</Text>
            </View>
            <Text style={styles.modalSub}>Cập nhật họ tên, số điện thoại và địa chỉ liên hệ của bạn.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Họ và tên *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập họ và tên đầy đủ"
                placeholderTextColor="#94A3B8"
                value={editName}
                onChangeText={setEditName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập số điện thoại mới"
                placeholderTextColor="#94A3B8"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập địa chỉ của bạn"
                placeholderTextColor="#94A3B8"
                value={editAddress}
                onChangeText={setEditAddress}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowEditProfileModal(false)}
                disabled={updatingProfile}
              >
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, updatingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={updatingProfile}
              >
                {updatingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Save size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveText}>Lưu thay đổi</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}
    </ResponsiveLayout>
  );
};

export default HomeScreen;
