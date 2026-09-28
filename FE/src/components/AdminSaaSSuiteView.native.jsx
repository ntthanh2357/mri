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
} from 'react-native';
import Colors from '../constants/colors';
import { apiRequest } from '../utils/apiClient';

const SUB_TABS = [
  { key: 'subscriptions', label: '💳 Gói Dịch Vụ' },
  { key: 'sla', label: '⚡ SLA & Isolation' },
  { key: 'backup', label: '📂 Backup/Restore' },
  { key: 'ai-models', label: '🤖 AI Models' },
  { key: 'announcements', label: '📢 Thông báo' },
];

export default function AdminSaaSSuiteView() {
  const [subTab, setSubTab] = useState('subscriptions');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [editPlan, setEditPlan] = useState('trial');
  const [editExpiry, setEditExpiry] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  const [slaMetrics, setSlaMetrics] = useState([]);
  const [slaLoading, setSlaLoading] = useState(false);

  const [isolationResults, setIsolationResults] = useState(null);
  const [verifyingIsolation, setVerifyingIsolation] = useState(false);

  const [backupLoading, setBackupLoading] = useState({});
  const [backupFiles, setBackupFiles] = useState({});

  const [aiVersions, setAiVersions] = useState([]);
  const [currentAiVersion, setCurrentAiVersion] = useState('neuroscan-v2.1.0');
  const [aiLoading, setAiLoading] = useState(false);

  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState('info');

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const loadHospitals = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/admin/hospitals');
      setHospitals(data.hospitals ?? []);
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải danh sách bệnh viện', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHospitals(); }, []);

  const handleUpdateSubscription = async () => {
    if (!selectedHospital) return;
    try {
      await apiRequest(`/admin/hospitals/${selectedHospital._id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionPlan: editPlan, subscriptionExpiresAt: editExpiry, subscriptionStatus: editStatus }),
      });
      showToast('Cập nhật gói dịch vụ thành công!');
      setSelectedHospital(null);
      loadHospitals();
    } catch (err) {
      showToast(err.message || 'Cập nhật gói dịch vụ thất bại', true);
    }
  };

  const loadSlaMetrics = async () => {
    setSlaLoading(true);
    try {
      const data = await apiRequest('/admin/monitoring/sla');
      setSlaMetrics(data.slaMetrics ?? []);
    } catch {
      showToast('Lỗi khi tải SLA', true);
    } finally {
      setSlaLoading(false);
    }
  };

  useEffect(() => { if (subTab === 'sla') loadSlaMetrics(); }, [subTab]);

  const handleVerifyIsolation = async () => {
    setVerifyingIsolation(true);
    setIsolationResults(null);
    try {
      const data = await apiRequest('/admin/tenants/verify-isolation');
      setIsolationResults(data);
      showToast('Xác thực cách biệt dữ liệu thành công!');
    } catch {
      showToast('Xác thực thất bại', true);
    } finally {
      setVerifyingIsolation(false);
    }
  };

  const handleBackup = async (hospId) => {
    setBackupLoading((prev) => ({ ...prev, [hospId]: true }));
    try {
      const data = await apiRequest(`/admin/hospitals/${hospId}/backup`, { method: 'POST' });
      setBackupFiles((prev) => ({ ...prev, [hospId]: data.fileName }));
      showToast(`Sao lưu thành công: ${data.fileName}`);
    } catch {
      showToast('Sao lưu thất bại', true);
    } finally {
      setBackupLoading((prev) => ({ ...prev, [hospId]: false }));
    }
  };

  const handleRestore = async (hospId) => {
    const fileName = backupFiles[hospId];
    if (!fileName) {
      showToast('Không có file sao lưu nào được chọn để khôi phục.', true);
      return;
    }
    try {
      const data = await apiRequest(`/admin/hospitals/${hospId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      let msg = '✅ Khôi phục thành công!';
      if (data.restoredStats) {
        msg += ` ${data.restoredStats.visits} lượt khám · ${data.restoredStats.users} tài khoản · ${data.restoredStats.invoices} hóa đơn`;
      }
      showToast(msg);
    } catch (err) {
      showToast(err.message || 'Khôi phục thất bại', true);
    }
  };

  const loadAiVersions = async () => {
    setAiLoading(true);
    try {
      const data = await apiRequest('/admin/ai-models');
      setAiVersions(data.versions ?? []);
    } catch {
      showToast('Lỗi khi tải các phiên bản AI', true);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { if (subTab === 'ai-models') loadAiVersions(); }, [subTab]);

  const handleRollback = async (version) => {
    try {
      const data = await apiRequest('/admin/ai-models/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      setCurrentAiVersion(data.currentVersion);
      showToast(`Đã khôi phục mô hình AI về phiên bản: ${version}`);
      loadAiVersions();
    } catch {
      showToast('Khôi phục mô hình AI thất bại', true);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!annTitle || !annContent) return;
    try {
      await apiRequest('/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: annTitle, content: annContent, type: annType }),
      });
      showToast('Đã đăng thông báo hệ thống thành công!');
      setAnnTitle('');
      setAnnContent('');
    } catch {
      showToast('Gửi thông báo thất bại', true);
    }
  };

  const planStyle = (plan) => {
    if (plan === 'pro') return { bg: '#eef2ff', color: '#4338ca' };
    if (plan === 'basic') return { bg: '#e0f2fe', color: '#0369a1' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <View style={styles.wrap}>
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.isError ? '#fef2f2' : '#ecfdf5', borderColor: toast.isError ? '#fecdd3' : '#a7f3d0' }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: toast.isError ? '#e11d48' : '#059669' }}>{toast.msg}</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {SUB_TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setSubTab(t.key)} style={[styles.subTabChip, subTab === t.key && styles.subTabChipActive]}>
            <Text style={[styles.subTabText, subTab === t.key && styles.subTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {subTab === 'subscriptions' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Quản Lý Gói Dịch Vụ SaaS</Text>
              <Text style={styles.cardSubtitle}>Theo dõi thời hạn thuê bao từng bệnh viện</Text>
            </View>
            <TouchableOpacity onPress={loadHospitals}><Text style={styles.refreshText}>🔄 Làm mới</Text></TouchableOpacity>
          </View>
          {loading ? <ActivityIndicator color={Colors.primary} /> : hospitals.map((h) => {
            const ps = planStyle(h.subscriptionPlan);
            return (
              <View key={h._id} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{h.name}</Text>
                  <Text style={styles.rowSub}>{h.code}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                    <View style={[styles.pill, { backgroundColor: ps.bg }]}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: ps.color }}>{(h.subscriptionPlan || 'trial').toUpperCase()}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: h.subscriptionStatus === 'active' ? '#ecfdf5' : '#fef2f2' }]}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: h.subscriptionStatus === 'active' ? '#059669' : '#e11d48' }}>
                        {h.subscriptionStatus === 'active' ? 'Hoạt động' : 'Hết hạn/Khóa'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowSub}>Hết hạn: {h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt).toLocaleDateString('vi-VN') : 'Không xác định'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setSelectedHospital(h);
                    setEditPlan(h.subscriptionPlan || 'trial');
                    setEditExpiry(h.subscriptionExpiresAt ? h.subscriptionExpiresAt.substring(0, 10) : '');
                    setEditStatus(h.subscriptionStatus || 'active');
                  }}
                >
                  <Text style={styles.editBtnText}>Sửa Gói</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {subTab === 'sla' && (
        <View style={{ gap: 10 }}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Giám Sát SLA & Uptime AI</Text>
                <Text style={styles.cardSubtitle}>Uptime và độ trễ phản hồi hệ thống</Text>
              </View>
              <TouchableOpacity onPress={loadSlaMetrics}><Text style={styles.refreshText}>{slaLoading ? '⏳' : '🔄'} Làm mới</Text></TouchableOpacity>
            </View>
            {slaMetrics.map((m) => (
              <View key={m.hospitalId} style={styles.slaCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={styles.rowTitle}>{m.name}</Text>
                    <Text style={styles.rowSub}>{m.code}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: m.status === 'healthy' ? '#ecfdf5' : m.status === 'warning' ? '#fffbeb' : '#f1f5f9' }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: m.status === 'healthy' ? '#059669' : m.status === 'warning' ? '#b45309' : Colors.secondary }}>{m.status}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
                  <View>
                    <Text style={styles.metricLabel}>AI Uptime</Text>
                    <Text style={styles.metricValue}>{m.uptime}%</Text>
                  </View>
                  <View>
                    <Text style={styles.metricLabel}>Latency</Text>
                    <Text style={styles.metricValue}>{m.latencyMs} ms</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Xác Thực Tenant Isolation</Text>
            <Text style={styles.cardSubtitle}>Quét chéo hệ thống chứng minh cách biệt dữ liệu</Text>
            <TouchableOpacity style={styles.darkBtn} onPress={handleVerifyIsolation} disabled={verifyingIsolation}>
              <Text style={styles.darkBtnText}>{verifyingIsolation ? '⏳ Đang quét...' : '🛡️ Bắt đầu quét & xác thực'}</Text>
            </TouchableOpacity>
            {isolationResults && (
              <View style={styles.isolationBox}>
                <Text style={styles.isolationHeader}>
                  {isolationResults.allIsolated ? '✅ ĐẠT TIÊU CHUẨN ISOLATION' : '⚠️ CẢNH BÁO RÒ RỈ DỮ LIỆU'}
                </Text>
                <Text style={styles.rowSub}>{isolationResults.details}</Text>
                {isolationResults.verificationResults.map((r) => (
                  <View key={r.hospitalId} style={styles.isolationRow}>
                    <Text style={styles.rowTitle}>{r.name}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: r.status === 'isolated' ? '#059669' : '#dc2626' }}>
                      {r.status === 'isolated' ? 'Cách biệt an toàn' : `Rò rỉ: ${r.issuesCount}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {subTab === 'backup' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sao Lưu & Khôi Phục Dữ Liệu</Text>
          <Text style={styles.cardSubtitle}>Backup độc lập theo từng bệnh viện</Text>
          {hospitals.map((h) => (
            <View key={h._id} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{h.name}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{backupFiles[h._id] || 'Chưa backup trong phiên này'}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={[styles.smallActionBtn, { backgroundColor: '#2563eb' }]} onPress={() => handleBackup(h._id)} disabled={backupLoading[h._id]}>
                  <Text style={styles.smallActionText}>{backupLoading[h._id] ? '...' : '⬇ Backup'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: '#1e293b', opacity: backupFiles[h._id] ? 1 : 0.4 }]}
                  onPress={() => handleRestore(h._id)}
                  disabled={!backupFiles[h._id]}
                >
                  <Text style={styles.smallActionText}>⬆ Restore</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {subTab === 'ai-models' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Quản Lý Phiên Bản Mô Hình AI</Text>
            <View style={[styles.pill, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#1d4ed8' }}>{currentAiVersion}</Text>
            </View>
          </View>
          {aiLoading ? <ActivityIndicator color={Colors.primary} /> : aiVersions.map((v) => (
            <View key={v.version} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{v.version}</Text>
                <Text style={styles.rowSub}>Accuracy: {v.accuracy}% · {new Date(v.deployedAt).toLocaleDateString('vi-VN')}</Text>
                <View style={[styles.pill, { backgroundColor: v.version === currentAiVersion ? '#ecfdf5' : '#f1f5f9', marginTop: 4, alignSelf: 'flex-start' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: v.version === currentAiVersion ? '#059669' : Colors.secondary }}>
                    {v.version === currentAiVersion ? 'Đang chạy' : 'Sẵn sàng rollback'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: '#1e293b', opacity: v.version === currentAiVersion ? 0.4 : 1 }]}
                onPress={() => handleRollback(v.version)}
                disabled={v.version === currentAiVersion}
              >
                <Text style={styles.smallActionText}>Rollback</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {subTab === 'announcements' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng Thông Báo Khẩn Cấp Hệ Thống</Text>
          <Text style={styles.cardSubtitle}>Gửi tin nhắn khẩn cấp tới tất cả bệnh viện</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <View>
              <Text style={styles.inputLabel}>Tiêu đề thông báo</Text>
              <TextInput style={styles.modalInput} placeholder="VD: Bảo trì máy chủ AI NeuroScan" value={annTitle} onChangeText={setAnnTitle} />
            </View>
            <View>
              <Text style={styles.inputLabel}>Phân loại</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[{ v: 'info', l: 'Info' }, { v: 'warning', l: 'Warning' }, { v: 'maintenance', l: 'Maintenance' }].map((o) => (
                  <TouchableOpacity key={o.v} onPress={() => setAnnType(o.v)} style={[styles.filterChip, annType === o.v && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, annType === o.v && styles.filterChipTextActive]}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.inputLabel}>Nội dung chi tiết</Text>
              <TextInput style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]} placeholder="Nhập nội dung thông báo..." value={annContent} onChangeText={setAnnContent} multiline />
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendAnnouncement}>
              <Text style={styles.sendBtnText}>📤 Gửi thông báo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={!!selectedHospital} animationType="fade" transparent onRequestClose={() => setSelectedHospital(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.centerSheet}>
            <Text style={styles.modalTitle}>Thay đổi gói: {selectedHospital?.name}</Text>
            <View style={{ gap: 10, marginTop: 10 }}>
              <View>
                <Text style={styles.inputLabel}>Gói Dịch Vụ</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[{ v: 'trial', l: 'Trial' }, { v: 'basic', l: 'Basic' }, { v: 'pro', l: 'Pro' }].map((o) => (
                    <TouchableOpacity key={o.v} onPress={() => setEditPlan(o.v)} style={[styles.filterChip, editPlan === o.v && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, editPlan === o.v && styles.filterChipTextActive]}>{o.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text style={styles.inputLabel}>Ngày hết hạn (YYYY-MM-DD)</Text>
                <TextInput style={styles.modalInput} placeholder="2026-12-31" value={editExpiry} onChangeText={setEditExpiry} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Trạng Thái</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[{ v: 'active', l: 'Active' }, { v: 'expired', l: 'Expired' }, { v: 'suspended', l: 'Suspended' }].map((o) => (
                    <TouchableOpacity key={o.v} onPress={() => setEditStatus(o.v)} style={[styles.filterChip, editStatus === o.v && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, editStatus === o.v && styles.filterChipTextActive]}>{o.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity style={[styles.smallActionBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => setSelectedHospital(null)}>
                  <Text style={[styles.smallActionText, { color: Colors.secondary }]}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallActionBtn, { flex: 1, backgroundColor: '#2563eb' }]} onPress={handleUpdateSubscription}>
                  <Text style={styles.smallActionText}>Lưu lại</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  toast: { padding: 10, borderRadius: 10, borderWidth: 1 },
  subTabChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  subTabChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  subTabText: { fontSize: 11, fontWeight: '700', color: Colors.secondary },
  subTabTextActive: { color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.black },
  cardSubtitle: { fontSize: 10.5, color: Colors.secondary },
  refreshText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rowTitle: { fontSize: 12.5, fontWeight: '700', color: Colors.black },
  rowSub: { fontSize: 10.5, color: Colors.secondary, marginTop: 2 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  editBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  editBtnText: { fontSize: 10.5, fontWeight: '700', color: Colors.secondary },
  slaCard: { borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, padding: 10, marginTop: 8 },
  metricLabel: { fontSize: 9.5, color: Colors.secondary },
  metricValue: { fontSize: 13, fontWeight: '800', color: Colors.black, marginTop: 1 },
  darkBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  darkBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  isolationBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, marginTop: 10, gap: 4 },
  isolationHeader: { fontSize: 12, fontWeight: '800', color: Colors.black },
  isolationRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  smallActionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  smallActionText: { fontSize: 10.5, fontWeight: '700', color: Colors.white },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.black },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  sendBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  centerSheet: { backgroundColor: Colors.white, borderRadius: 18, padding: 18 },
  modalTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
});
