import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import Colors from '../constants/colors';
import { get, post, put, del } from '../services/api.service';
import Config from '../constants/config';

const STATUS_LABEL = {
  provisioned: { text: 'Chờ điền thông tin', bg: '#fef9c3', color: '#a16207' },
  submitted: { text: 'Chờ duyệt', bg: '#dbeafe', color: '#1d4ed8' },
  active: { text: 'Đã kích hoạt', bg: '#dcfce7', color: '#15803d' },
  rejected: { text: 'Từ chối', bg: '#fee2e2', color: '#b91c1c' },
};

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'provisioned', label: 'Chờ điền TT' },
  { value: 'submitted', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đã kích hoạt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'locked', label: '🔒 Bị khoá' },
];

export default function AdminHospitalsView() {
  const [hospitals, setHospitals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showProvision, setShowProvision] = useState(false);
  const [provHospitalName, setProvHospitalName] = useState('');
  const [provItEmail, setProvItEmail] = useState('');
  const [provLoading, setProvLoading] = useState(false);
  const [provResult, setProvResult] = useState(null);
  const [provError, setProvError] = useState('');

  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState('');

  const [locking, setLocking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [resetResult, setResetResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await get('/admin/hospitals');
      setHospitals(res.hospitals || []);
    } catch {
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHospitals(); }, []);

  const fetchDetail = async (id) => {
    try {
      const res = await get(`/admin/hospitals/${id}`);
      setSelected(res.hospital || null);
      setActivateMsg('');
      setResetResult(null);
    } catch {
      setSelected(null);
    }
  };

  const handleProvision = async () => {
    if (!provHospitalName.trim() || !provItEmail.trim()) {
      setProvError('Vui lòng nhập đầy đủ tên bệnh viện và email IT.');
      return;
    }
    setProvLoading(true);
    setProvError('');
    try {
      const res = await post('/admin/hospitals/provision', {
        hospitalName: provHospitalName.trim(),
        itEmail: provItEmail.trim(),
      });
      setProvResult(res.credentials);
      await fetchHospitals();
    } catch (err) {
      setProvError(err?.message || 'Tạo tài khoản thất bại.');
    } finally {
      setProvLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await post(`/admin/hospitals/${selected._id}/reset-password`, {});
      setResetResult(res.credentials);
    } catch (err) {
      setResetResult({ error: err?.message || 'Reset thất bại.' });
    } finally {
      setResetting(false);
    }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setActivating(true);
    setActivateMsg('');
    try {
      await put(`/admin/hospitals/${selected._id}/activate`, {});
      setActivateMsg('success');
      await fetchDetail(selected._id);
      await fetchHospitals();
    } catch (err) {
      setActivateMsg(err?.message || 'Kích hoạt thất bại.');
    } finally {
      setActivating(false);
    }
  };

  const handleToggleLock = async () => {
    if (!selected) return;
    setLocking(true);
    try {
      await put(`/admin/hospitals/${selected._id}/toggle-lock`, {});
      await fetchDetail(selected._id);
      await fetchHospitals();
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Thao tác khoá/mở khoá thất bại.');
    } finally {
      setLocking(false);
    }
  };

  const handleDeleteHospital = async () => {
    if (!selected) return;
    if (deleteConfirmName !== selected.code) {
      setDeleteError('Mã xác nhận không khớp.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await del(`/admin/hospitals/${selected._id}`);
      setSelected(null);
      setShowDeleteConfirm(false);
      await fetchHospitals();
    } catch (err) {
      setDeleteError(err?.message || 'Xoá bệnh viện thất bại.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = hospitals.filter((h) => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.name?.toLowerCase().includes(q) || h.code?.toLowerCase().includes(q) || h.loginEmail?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || (filterStatus === 'locked' ? h.isActive === false : h.status === filterStatus);
    return matchSearch && matchStatus;
  });

  const pendingCount = hospitals.filter((h) => h.status === 'submitted').length;

  const addressText = (address) => {
    if (!address) return null;
    return typeof address === 'string'
      ? address
      : [address.street, address.ward, address.district, address.province].filter(Boolean).join(', ');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Quản lý Bệnh viện & Onboarding</Text>
        <Text style={styles.headerSubtitle}>Cấp tài khoản tạm, theo dõi xác thực bệnh viện</Text>
        <View style={styles.headerRow}>
          {pendingCount > 0 && (
            <View style={[styles.pill, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1d4ed8' }}>Chờ duyệt: {pendingCount}</Text>
            </View>
          )}
          <View style={[styles.pill, { backgroundColor: '#f1f5f9' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.secondary }}>Tổng: {hospitals.length}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.provisionBtn}
          onPress={() => { setShowProvision(true); setProvResult(null); setProvError(''); setProvHospitalName(''); setProvItEmail(''); }}
        >
          <Text style={styles.provisionBtnText}>+ Cấp tài khoản tạm</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm theo tên, mã BV, email..."
        placeholderTextColor={Colors.secondary}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilterStatus(f.value)}
            style={[styles.filterChip, filterStatus === f.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterStatus === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listCard}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 24 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>🏥 Chưa có bệnh viện nào</Text>
        ) : (
          filtered.map((h) => {
            const s = STATUS_LABEL[h.status] || STATUS_LABEL.provisioned;
            return (
              <TouchableOpacity key={h._id} onPress={() => fetchDetail(h._id)} style={styles.hospitalRow}>
                <View style={styles.hospitalIcon}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.secondary }}>{h.name?.charAt(0) || 'B'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hospitalName} numberOfLines={1}>{h.name}</Text>
                  <Text style={styles.hospitalSub} numberOfLines={1}>{h.code} · {h.loginEmail || `${h.tempUsername}@temp`}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {h.isActive === false && (
                    <View style={[styles.pill, { backgroundColor: '#fee2e2' }]}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#b91c1c' }}>🔒 Khoá</Text>
                    </View>
                  )}
                  <View style={[styles.pill, { backgroundColor: s.bg }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: s.color }}>{s.text}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết Bệnh viện</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView style={{ maxHeight: 500 }}>
                <View style={styles.statusRow}>
                  <View style={[styles.pill, { backgroundColor: (STATUS_LABEL[selected.status] || STATUS_LABEL.provisioned).bg }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: (STATUS_LABEL[selected.status] || STATUS_LABEL.provisioned).color }}>
                      {(STATUS_LABEL[selected.status] || STATUS_LABEL.provisioned).text}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.secondary }}>{selected.code}</Text>
                </View>

                <DetailRow label="Tên bệnh viện" value={selected.name} />
                <DetailRow label="Tên viết tắt" value={selected.nameShort} />
                <DetailRow label="Mã số thuế" value={selected.taxCode} />
                <DetailRow label="Email đăng nhập" value={selected.loginEmail} highlight />
                <DetailRow label="Email liên hệ" value={selected.contactEmail} />
                <DetailRow label="Điện thoại" value={selected.phone} />
                <DetailRow label="Website" value={selected.website} />
                {addressText(selected.address) && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.detailLabel}>Địa chỉ</Text>
                    <Text style={styles.detailValueBlock}>{addressText(selected.address)}</Text>
                  </View>
                )}

                {selected.legalRep?.name && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Người đại diện pháp luật</Text>
                    <DetailRow label="Họ tên" value={`${selected.legalRep.name} — ${selected.legalRep.position || ''}`} />
                    <DetailRow label="Điện thoại" value={selected.legalRep.phone} />
                    <DetailRow label="Email" value={selected.legalRep.email} />
                  </View>
                )}

                {selected.itContact?.name && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>IT phụ trách</Text>
                    <DetailRow label="Họ tên" value={selected.itContact.name} />
                    <DetailRow label="Điện thoại" value={selected.itContact.phone} />
                    <DetailRow label="Email" value={selected.itContact.email} />
                  </View>
                )}

                {selected.licenseFile && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Giấy phép hoạt động</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(selected.licenseFile.startsWith('http') ? selected.licenseFile : `${Config.API_URL}${selected.licenseFile}`)}
                    >
                      <Text style={styles.linkText}>Xem Giấy phép hoạt động 🔗</Text>
                    </TouchableOpacity>
                    {/\.(jpg|jpeg|png|webp|gif)$/i.test(selected.licenseFile) && (
                      <Image
                        source={{ uri: selected.licenseFile.startsWith('http') ? selected.licenseFile : `${Config.API_URL}${selected.licenseFile}` }}
                        style={styles.licenseImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                )}

                {selected.status !== 'active' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tài khoản tạm</Text>
                    <Text style={styles.mutedText}>
                      Email đăng nhập: {selected.code?.toLowerCase()}@temp.neuroscan.internal
                    </Text>
                    {resetResult && !resetResult.error && (
                      <View style={styles.resetBox}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>Mật khẩu mới:</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.black, marginTop: 2 }}>{resetResult.tempPassword}</Text>
                      </View>
                    )}
                    {resetResult?.error && <Text style={styles.errorText}>{resetResult.error}</Text>}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', marginTop: 8 }]}
                      onPress={handleResetPassword}
                      disabled={resetting}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>
                        {resetting ? 'Đang reset...' : '🔑 Reset mật khẩu tạm'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selected.status === 'submitted' && (
                  <View style={styles.section}>
                    {activateMsg === 'success' ? (
                      <Text style={{ color: '#15803d', fontWeight: '700', textAlign: 'center', fontSize: 13 }}>✓ Đã kích hoạt thành công!</Text>
                    ) : (
                      <>
                        {!!activateMsg && <Text style={styles.errorText}>{activateMsg}</Text>}
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={handleActivate} disabled={activating}>
                          <Text style={styles.actionBtnText}>{activating ? 'Đang xác thực...' : '✓ Xác thực tài khoản'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Hành động quản trị</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: selected.isActive === false ? '#ecfdf5' : '#fffbeb', borderWidth: 1, borderColor: selected.isActive === false ? '#a7f3d0' : '#fde68a' }]}
                      onPress={handleToggleLock}
                      disabled={locking}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: selected.isActive === false ? '#059669' : '#b45309' }}>
                        {locking ? 'Đang xử lý...' : selected.isActive === false ? '🔓 Mở khoá' : '🔒 Khoá'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecdd3' }]}
                      onPress={() => { setDeleteConfirmName(''); setShowDeleteConfirm(true); setDeleteError(''); }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#e11d48' }}>❌ Xoá bệnh viện</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Provision modal */}
      <Modal visible={showProvision} animationType="fade" transparent onRequestClose={() => setShowProvision(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.centerSheet}>
            <Text style={styles.modalTitle}>Cấp tài khoản tạm cho Bệnh viện</Text>
            <Text style={styles.mutedText}>Hệ thống sẽ tạo mã đăng nhập tạm BV_XXX và gửi về email IT.</Text>

            {provResult ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={styles.successBox}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d' }}>✓ Tạo thành công! Lưu lại thông tin sau:</Text>
                  <Text style={styles.mutedText}>Tên đăng nhập:</Text>
                  <Text style={styles.mono}>{provResult.tempUsername}</Text>
                  <Text style={styles.mutedText}>Mật khẩu tạm:</Text>
                  <Text style={styles.mono}>{provResult.tempPassword}</Text>
                  <Text style={styles.mutedText}>Đã gửi email đến: {provResult.itEmail}</Text>
                </View>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.black }]} onPress={() => { setShowProvision(false); setProvResult(null); }}>
                  <Text style={styles.actionBtnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                <View>
                  <Text style={styles.inputLabel}>Tên bệnh viện *</Text>
                  <TextInput style={styles.modalInput} placeholder="VD: Bệnh viện Bạch Mai" value={provHospitalName} onChangeText={setProvHospitalName} />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Email IT nhận thông tin *</Text>
                  <TextInput style={styles.modalInput} placeholder="it@benhvien.com" value={provItEmail} onChangeText={setProvItEmail} autoCapitalize="none" keyboardType="email-address" />
                </View>
                {!!provError && <Text style={styles.errorText}>{provError}</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => setShowProvision(false)}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.secondary }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: '#2563eb' }]} onPress={handleProvision} disabled={provLoading}>
                    <Text style={styles.actionBtnText}>{provLoading ? 'Đang tạo...' : 'Tạo tài khoản tạm'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.centerSheet}>
            <Text style={[styles.modalTitle, { color: '#dc2626' }]}>⚠️ Xác nhận xoá Bệnh viện vĩnh viễn</Text>
            <Text style={styles.mutedText}>
              Hành động này sẽ xoá vĩnh viễn bệnh viện {selected?.name} cùng tất cả tài khoản nhân sự trực thuộc. Không thể khôi phục.
            </Text>
            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Nhập mã bệnh viện "{selected?.code}" để xác nhận:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Nhập ${selected?.code || ''}`}
              value={deleteConfirmName}
              onChangeText={setDeleteConfirmName}
              autoCapitalize="characters"
            />
            {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#f1f5f9' }]}
                onPress={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); setDeleteError(''); }}
                disabled={deleting}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.secondary }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#dc2626', opacity: deleting || deleteConfirmName !== selected?.code ? 0.5 : 1 }]}
                onPress={handleDeleteHospital}
                disabled={deleting || deleteConfirmName !== selected?.code}
              >
                <Text style={styles.actionBtnText}>{deleting ? 'Đang xoá...' : 'Xác nhận xoá'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: '#2563eb' }]} numberOfLines={1}>{value}</Text>
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
  headerSubtitle: { fontSize: 11, color: Colors.secondary, marginTop: 3 },
  headerRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  provisionBtn: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  provisionBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
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
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
  },
  emptyText: { fontSize: 12, color: Colors.secondary, padding: 24, textAlign: 'center' },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  hospitalIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hospitalName: { fontSize: 13, fontWeight: '700', color: Colors.black },
  hospitalSub: { fontSize: 11, color: Colors.secondary, marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  centerSheet: { backgroundColor: Colors.white, borderRadius: 18, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 12 },
  modalTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  modalClose: { fontSize: 16, color: Colors.secondary, padding: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 11, color: Colors.secondary },
  detailValue: { fontSize: 12, fontWeight: '600', color: Colors.black, maxWidth: '60%' },
  detailValueBlock: { fontSize: 12, fontWeight: '600', color: Colors.black, marginTop: 2 },
  section: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sectionTitle: { fontSize: 10.5, fontWeight: '800', color: Colors.secondary, textTransform: 'uppercase', marginBottom: 6 },
  mutedText: { fontSize: 11, color: Colors.secondary, marginTop: 4 },
  linkText: { fontSize: 12, fontWeight: '700', color: '#2563eb', textDecorationLine: 'underline' },
  licenseImage: { width: '100%', height: 160, borderRadius: 10, marginTop: 8, backgroundColor: '#f1f5f9' },
  mono: { fontSize: 13, fontWeight: '700', color: Colors.black, marginTop: 1 },
  resetBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 10, marginTop: 8 },
  successBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, gap: 2 },
  errorText: { fontSize: 11, fontWeight: '700', color: '#e11d48', marginTop: 6 },
  actionBtn: { paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.black,
  },
});
