import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Colors from '../constants/colors';
import { apiRequest } from '../utils/apiClient';

function mapApiUser(u) {
  return {
    id: u._id || u.id,
    name: u.profile?.name || u.email,
    email: u.email,
    phone: u.profile?.phone || u.phone || '',
    role: u.role,
    avatarUrl:
      u.profile?.photoUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(u.profile?.name || u.email)}&background=e2e8f0&color=475569&bold=true`,
    status: u.isLocked ? 'Locked' : 'Active',
    lastActive: u.createdAt,
  };
}

function mapApiUserDetail(u) {
  return {
    _id: u._id,
    email: u.email,
    phone: u.profile?.phone || u.phone || '',
    role: u.role,
    isVerified: u.isVerified,
    isLocked: u.isLocked,
    profile: u.profile,
    createdAt: u.createdAt,
  };
}

function roleLabel(role) {
  switch (role) {
    case 'patient': return 'Bệnh nhân';
    case 'doctor': return 'Bác sĩ';
    case 'admin': return 'Quản trị viên';
    case 'hospital_admin': return 'Admin Bệnh viện';
    case 'technician': return 'Kỹ thuật viên';
    case 'nurse': return 'Điều dưỡng & Lễ tân';
    default: return role;
  }
}

const ROLE_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'patient', label: '🧑‍⚕️ Bệnh nhân' },
  { value: 'doctor', label: '👨‍⚕️ Bác sĩ' },
  { value: 'hospital_admin', label: '🏥 QL Bệnh viện' },
  { value: 'nurse', label: '👩‍⚕️ Điều dưỡng' },
  { value: 'technician', label: '🔬 Kỹ thuật viên' },
  { value: 'admin', label: '🛡️ Admin' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Active', label: 'Đang hoạt động' },
  { value: 'Locked', label: 'Đã bị khóa' },
];

export default function AdminUsersView() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest('/admin/users');
        setUsersList((data.users ?? []).map(mapApiUser));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách người dùng.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleSelectUser = async (userId) => {
    setSelectedUserId(userId);
    setSelectedUserDetail(null);
    setDetailError(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      const data = await apiRequest(`/admin/users/${userId}`);
      setSelectedUserDetail(mapApiUserDetail(data.user));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Không thể tải chi tiết người dùng.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedUserId(null);
    setSelectedUserDetail(null);
    setDetailError(null);
  };

  const handleLockUser = async (userId) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/lock`, { method: 'PUT' });
      const updatedStatus = data.user.isLocked ? 'Locked' : 'Active';
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updatedStatus } : u)));
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isLocked: data.user.isLocked });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể khóa tài khoản.');
    }
  };

  const handleUnlockUser = async (userId) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/unlock`, { method: 'PUT' });
      const updatedStatus = data.user.isLocked ? 'Locked' : 'Active';
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updatedStatus } : u)));
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isLocked: data.user.isLocked });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể mở khóa tài khoản.');
    }
  };

  const handleVerifyUser = async (userId, verified) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isVerified: data.user.isVerified });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái xác thực.');
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.id.toLowerCase().includes(query) ||
      u.phone.includes(query);
    const matchRole = roleFilter === '' || u.role === roleFilter;
    const matchStatus = statusFilter === '' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Quản lý Tài Khoản & Khóa User</Text>
        <Text style={styles.headerSubtitle}>Tổng: {usersList.length} tài khoản</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm theo Tên, Email, SĐT..."
        placeholderTextColor={Colors.secondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 6 }}>
        {ROLE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setRoleFilter(f.value)}
            style={[styles.filterChip, roleFilter === f.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, roleFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 6 }}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setStatusFilter(f.value)}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listCard}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 24 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filteredUsers.length === 0 ? (
          <Text style={styles.emptyText}>Không tìm thấy người dùng nào phù hợp.</Text>
        ) : (
          filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              onPress={() => handleSelectUser(user.id)}
              style={[styles.userRow, user.status === 'Locked' && styles.userRowLocked]}
            >
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                <View style={styles.userMetaRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{roleLabel(user.role)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: user.status === 'Active' ? '#ecfdf5' : '#fef2f2' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: user.status === 'Active' ? '#059669' : '#e11d48' }}>
                      {user.status}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); user.status === 'Active' ? handleLockUser(user.id) : handleUnlockUser(user.id); }}
                style={styles.lockBtn}
              >
                <Text style={{ fontSize: 14 }}>{user.status === 'Active' ? '🔒' : '🔓'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Detail modal */}
      <Modal visible={!!selectedUserId} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết Hồ sơ Quản trị</Text>
              <TouchableOpacity onPress={closeDetail}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }}>
              {detailLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 40 }} />
              ) : detailError ? (
                <Text style={styles.errorText}>{detailError}</Text>
              ) : selectedUserDetail ? (
                <View style={{ gap: 12 }}>
                  {actionError && <Text style={styles.errorText}>{actionError}</Text>}

                  <View style={styles.detailHeaderRow}>
                    <Image
                      source={{
                        uri:
                          selectedUserDetail.profile?.photoUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUserDetail.profile?.name || selectedUserDetail.email)}&background=e2e8f0&color=475569&bold=true`,
                      }}
                      style={styles.detailAvatar}
                    />
                    <View>
                      <Text style={styles.detailName}>{selectedUserDetail.profile?.name || selectedUserDetail.email}</Text>
                      <Text style={styles.detailRole}>{roleLabel(selectedUserDetail.role)}</Text>
                    </View>
                  </View>

                  <DetailRow label="Email liên hệ" value={selectedUserDetail.email} />
                  <DetailRow label="Số điện thoại" value={selectedUserDetail.phone || '—'} />
                  <DetailRow label="Địa chỉ" value={selectedUserDetail.profile?.address || '—'} />
                  <DetailRow
                    label="Trạng thái khóa"
                    value={selectedUserDetail.isLocked ? 'Locked' : 'Active'}
                    valueColor={selectedUserDetail.isLocked ? '#e11d48' : '#059669'}
                  />
                  <DetailRow
                    label="Xác minh danh tính"
                    value={selectedUserDetail.isVerified ? '✅ Verified' : '⚠️ Unverified'}
                  />
                  <DetailRow
                    label="Ngày tạo tài khoản"
                    value={new Date(selectedUserDetail.createdAt).toLocaleDateString('vi-VN')}
                  />

                  <View style={{ gap: 8, marginTop: 8 }}>
                    {selectedUserDetail.isLocked ? (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleUnlockUser(selectedUserDetail._id)}>
                        <Text style={styles.actionBtnText}>🔓 Mở Khóa Tài Khoản</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecdd3' }]} onPress={() => handleLockUser(selectedUserDetail._id)}>
                        <Text style={[styles.actionBtnText, { color: '#e11d48' }]}>🔒 Khóa Tài Khoản</Text>
                      </TouchableOpacity>
                    )}

                    {selectedUserDetail.role === 'hospital_admin' && (
                      selectedUserDetail.isVerified ? (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]} onPress={() => handleVerifyUser(selectedUserDetail._id, false)}>
                          <Text style={[styles.actionBtnText, { color: '#b45309' }]}>⚠️ Hủy duyệt Quản lý bệnh viện</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2563eb' }]} onPress={() => handleVerifyUser(selectedUserDetail._id, true)}>
                          <Text style={styles.actionBtnText}>✅ Duyệt Quản lý bệnh viện</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, valueColor }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  headerSubtitle: { fontSize: 11, color: Colors.secondary, marginTop: 4 },
  searchInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.black,
  },
  filterRow: { flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userRowLocked: { backgroundColor: '#fff5f5' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e2e8f0' },
  userName: { fontSize: 13, fontWeight: '700', color: Colors.black },
  userEmail: { fontSize: 11, color: Colors.secondary, marginTop: 1 },
  userMetaRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  roleBadgeText: { fontSize: 9.5, fontWeight: '700', color: '#1d4ed8' },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  lockBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { fontSize: 12, fontWeight: '700', color: '#e11d48', padding: 12, textAlign: 'center' },
  emptyText: { fontSize: 12, color: Colors.secondary, padding: 20, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  modalClose: { fontSize: 16, color: Colors.secondary, padding: 4 },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  detailAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e2e8f0' },
  detailName: { fontSize: 14, fontWeight: '800', color: Colors.black },
  detailRole: { fontSize: 10, color: Colors.secondary, marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  detailLabel: { fontSize: 10.5, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, color: Colors.black, fontWeight: '700', maxWidth: '55%' },
  actionBtn: {
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
});
