import React, { useState, useEffect, useCallback } from 'react';
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

const ENTITY_ICON = {
  User: '👥',
  Dataset: '🗄️',
  AuditLog: '📋',
  Patient: '📄',
  MedicalRecord: '📄',
};

export default function AdminAuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [anonymizing, setAnonymizing] = useState(false);
  const [anonymizeError, setAnonymizeError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const [hospitals, setHospitals] = useState([]);
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => {
        if (data && data.user) {
          const isUserAdmin = data.user.role === 'admin';
          setIsAdmin(isUserAdmin);
          if (isUserAdmin) {
            apiRequest('/admin/hospitals')
              .then((res) => setHospitals(res.hospitals ?? []))
              .catch((err) => console.error('Failed to load hospitals:', err));
          }
        }
      })
      .catch((err) => console.error('Failed to load profile:', err));
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = hospitalFilter !== 'all' ? `/admin/audit-logs?hospitalId=${hospitalFilter}` : '/admin/audit-logs';
      const data = await apiRequest(url);
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleAnonymize = async () => {
    setAnonymizing(true);
    setAnonymizeError(null);
    try {
      await apiRequest('/admin/anonymize', { method: 'POST' });
      await fetchLogs();
    } catch (err) {
      setAnonymizeError(err.message || 'Ẩn danh dữ liệu thất bại');
    } finally {
      setAnonymizing(false);
    }
  };

  const entitiesAvailable = Array.from(new Set(logs.map((l) => l.entity)));

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      log.performedBy.toLowerCase().includes(q) ||
      (log.details ?? '').toLowerCase().includes(q);
    const matchesEntity = entityFilter === 'all' || log.entity === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleString('vi-VN');
    } catch {
      return String(value);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Audit Logs & Tuân thủ</Text>
          <Text style={styles.subtitle}>Theo dõi hoạt động hệ thống và ẩn danh dữ liệu</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.anonymizeBtn} onPress={handleAnonymize} disabled={anonymizing || loading}>
        <Text style={styles.anonymizeBtnText}>{anonymizing ? '⏳ Đang xử lý...' : '🔒 Ẩn danh dữ liệu (HIPAA)'}</Text>
      </TouchableOpacity>
      {!!anonymizeError && <Text style={styles.errorTextSmall}>{anonymizeError}</Text>}

      <View style={styles.complianceCard}>
        <View style={styles.complianceHeaderRow}>
          <View style={styles.complianceIcon}><Text style={{ fontSize: 16 }}>🛡️</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.complianceTitle}>Quy trình ẩn danh dữ liệu (HIPAA)</Text>
            <Text style={styles.complianceSubtitle}>Loại bỏ thông tin nhận dạng cá nhân (PII) khỏi hồ sơ</Text>
          </View>
        </View>
        <View style={styles.complianceTagsRow}>
          {['Ẩn Họ Tên', 'Masking SĐT', 'Redact Email', 'Giấu địa chỉ'].map((t) => (
            <View key={t} style={styles.complianceTag}><Text style={styles.complianceTagText}>{t}</Text></View>
          ))}
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Sẵn sàng</Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm theo hành động, entity, người thực hiện..."
        placeholderTextColor={Colors.secondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {isAdmin && hospitals.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
          <TouchableOpacity onPress={() => setHospitalFilter('all')} style={[styles.filterChip, hospitalFilter === 'all' && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, hospitalFilter === 'all' && styles.filterChipTextActive]}>Tất cả bệnh viện</Text>
          </TouchableOpacity>
          {hospitals.map((h) => (
            <TouchableOpacity key={h._id} onPress={() => setHospitalFilter(h._id)} style={[styles.filterChip, hospitalFilter === h._id && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, hospitalFilter === h._id && styles.filterChipTextActive]} numberOfLines={1}>{h.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        <TouchableOpacity onPress={() => setEntityFilter('all')} style={[styles.filterChip, entityFilter === 'all' && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, entityFilter === 'all' && styles.filterChipTextActive]}>Tất cả entity</Text>
        </TouchableOpacity>
        {entitiesAvailable.map((e) => (
          <TouchableOpacity key={e} onPress={() => setEntityFilter(e)} style={[styles.filterChip, entityFilter === e && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, entityFilter === e && styles.filterChipTextActive]}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listCard}>
        {loading ? (
          <ActivityIndicator color={Colors.black} style={{ paddingVertical: 24 }} />
        ) : error ? (
          <View style={{ alignItems: 'center', padding: 20, gap: 6 }}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchLogs}><Text style={styles.retryText}>Thử lại</Text></TouchableOpacity>
          </View>
        ) : filteredLogs.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchQuery || entityFilter !== 'all' ? 'Không tìm thấy log nào phù hợp.' : 'Chưa có log nào.'}
          </Text>
        ) : (
          filteredLogs.map((log) => (
            <TouchableOpacity key={log._id} style={styles.logRow} onPress={() => setSelectedLog(log)}>
              <View style={{ flex: 1 }}>
                <View style={styles.logTopRow}>
                  <View style={styles.entityBadge}>
                    <Text style={{ fontSize: 10 }}>{ENTITY_ICON[log.entity] || '👁️'} {log.entity}</Text>
                  </View>
                  <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
                </View>
                <Text style={styles.logAction} numberOfLines={1}>{log.action}</Text>
                <Text style={styles.logPerformer} numberOfLines={1}>
                  {log.performedByName || log.performedBy}{isAdmin && log.hospitalName ? ` · ${log.hospitalName}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Modal visible={!!selectedLog} animationType="fade" transparent onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.centerSheet}>
            {selectedLog && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalMono} numberOfLines={1}>{selectedLog._id}</Text>
                    <Text style={styles.subtitle}>{formatDate(selectedLog.createdAt)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedLog(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 10 }}>
                  <DetailBlock label="Người thực hiện" value={selectedLog.performedBy} mono />
                  <DetailBlock label="Entity ID" value={selectedLog.entityId} mono />
                  <DetailBlock label="Entity" value={`${ENTITY_ICON[selectedLog.entity] || '👁️'} ${selectedLog.entity}`} />
                  <DetailBlock label="Hành động" value={selectedLog.action} />
                  <View>
                    <Text style={styles.detailLabel}>Chi tiết</Text>
                    <Text style={styles.detailBox}>{selectedLog.details || '—'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedLog(null)}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailBlock({ label, value, mono }) {
  return (
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.black },
  subtitle: { fontSize: 11, color: Colors.secondary, marginTop: 2 },
  anonymizeBtn: { backgroundColor: '#d97706', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  anonymizeBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  errorTextSmall: { fontSize: 11, color: '#e11d48', fontWeight: '700' },
  complianceCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 14, gap: 10 },
  complianceHeaderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  complianceIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' },
  complianceTitle: { fontSize: 12.5, fontWeight: '700', color: Colors.white },
  complianceSubtitle: { fontSize: 10.5, color: '#cbd5e1', marginTop: 2 },
  complianceTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  complianceTag: { backgroundColor: 'rgba(51,65,85,0.5)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  complianceTagText: { fontSize: 9.5, color: '#e2e8f0' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#34d399' },
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
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, maxWidth: 160 },
  filterChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  listCard: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 6 },
  errorText: { fontSize: 12, color: '#b91c1c', fontWeight: '600', textAlign: 'center' },
  retryText: { fontSize: 11, color: '#b91c1c', fontWeight: '700', textDecorationLine: 'underline' },
  emptyText: { fontSize: 12, color: Colors.secondary, padding: 24, textAlign: 'center' },
  logRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entityBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  logDate: { fontSize: 9.5, color: Colors.secondary, fontFamily: 'monospace' },
  logAction: { fontSize: 12.5, fontWeight: '700', color: Colors.black },
  logPerformer: { fontSize: 10.5, color: Colors.secondary, marginTop: 2 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  centerSheet: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, gap: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  modalMono: { fontSize: 12, fontWeight: '700', color: Colors.black, fontFamily: 'monospace' },
  modalClose: { fontSize: 16, color: Colors.secondary, padding: 4 },
  detailLabel: { fontSize: 9.5, color: Colors.secondary, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  detailValue: { fontSize: 12, color: Colors.black, fontWeight: '600' },
  detailBox: { fontSize: 12, color: Colors.black, backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginTop: 2 },
  mono: { fontFamily: 'monospace' },
  closeBtn: { marginTop: 14, alignSelf: 'flex-end', backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
});
