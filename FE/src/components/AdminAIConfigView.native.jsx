import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Colors from '../constants/colors';
import { apiRequest } from '../utils/apiClient';

const CLASS_META = {
  glioma: { color: '#6366f1', label: 'U thần kinh đệm (Glioma)' },
  meningioma: { color: '#10b981', label: 'U màng não (Meningioma)' },
  pituitary: { color: '#f59e0b', label: 'U tuyến yên (Pituitary)' },
  notumor: { color: '#64748b', label: 'Không có u (No Tumor)' },
  unknown: { color: '#94a3b8', label: 'Không xác định' },
};

function ClassBar({ label, correct, corrected }) {
  const total = correct + corrected;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const meta = CLASS_META[label] || { color: '#6366f1', label };
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.classBarTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
          <Text style={styles.classLabel} numberOfLines={1}>{meta.label}</Text>
        </View>
        <Text style={styles.classValue}>{correct}/{total} · {pct}%</Text>
      </View>
      <View style={styles.classTrack}>
        <View style={[styles.classFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
      </View>
    </View>
  );
}

function AccuracyBadge({ accuracy = 0 }) {
  const color = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <View style={[styles.accuracyBadge, { borderColor: color }]}>
      <Text style={[styles.accuracyValue, { color }]}>{accuracy}%</Text>
      <Text style={styles.accuracyLabel}>Độ chính xác</Text>
    </View>
  );
}

export default function AdminAIConfigView() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');

  const [config, setConfig] = useState({ blacklist: [], system_prompt: '' });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const data = await apiRequest('/admin/ai-training-stats');
      setStats(data.stats ?? null);
    } catch (err) {
      setStatsError(err.message || 'Không thể tải thống kê huấn luyện');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const data = await apiRequest('/admin/ai-feedback');
      setFeedback(data.feedback ?? []);
    } catch (err) {
      setFeedbackError(err.message || 'Lỗi khi tải phản hồi từ bác sĩ');
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const data = await apiRequest('/admin/chatbot-config');
      if (data.config) {
        setConfig(data.config);
        setBlacklistInput(data.config.blacklist.join(', '));
      }
    } catch (err) {
      setConfigError(err.message || 'Lỗi khi tải cấu hình chatbot');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchFeedback();
    fetchConfig();
  }, [fetchStats, fetchFeedback, fetchConfig]);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainMsg('');
    try {
      const data = await apiRequest('/admin/ai-retrain', { method: 'POST' });
      if (data.success) {
        setRetrainMsg(data.message || 'Kích hoạt tiến trình huấn luyện lại thành công!');
        await fetchStats();
        await fetchFeedback();
      }
    } catch (err) {
      setRetrainMsg(`Lỗi: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaveSuccess('');
    setConfigError(null);
    const cleanBlacklist = blacklistInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    try {
      const response = await apiRequest('/admin/chatbot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blacklist: cleanBlacklist, system_prompt: config.system_prompt }),
      });
      if (response.success) {
        setSaveSuccess(response.message || 'Cấu hình Chatbot đã được cập nhật thành công!');
        setConfig(response.config);
      }
    } catch (err) {
      setConfigError(err.message || 'Lỗi khi lưu cấu hình chatbot');
    }
  };

  const allClasses = stats
    ? Array.from(new Set([...Object.keys(stats.approved_by_class || {}), ...Object.keys(stats.corrected_by_class || {})]))
    : [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.pageTitle}>Quản trị Hệ thống AI</Text>
      <Text style={styles.pageSubtitle}>Thống kê ca đúng/sai, Active Learning và cấu hình chatbot</Text>

      {/* Section 1: training stats */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>📊 Thống kê Phản hồi Bác sĩ</Text>
          <TouchableOpacity onPress={fetchStats}><Text style={styles.refreshIcon}>{loadingStats ? '⏳' : '🔄'}</Text></TouchableOpacity>
        </View>

        {loadingStats ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 20 }} />
        ) : statsError ? (
          <Text style={styles.errorText}>{statsError}</Text>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.accuracyRow}>
              <AccuracyBadge accuracy={stats?.accuracy ?? 0} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.totalLabel}>TỔNG PHẢN HỒI</Text>
                <Text style={styles.totalValue}>{stats?.total ?? 0}</Text>
                <Text style={styles.totalSub}>ca bác sĩ đã đánh giá</Text>
              </View>
            </View>

            <View style={styles.statPairRow}>
              <View style={[styles.statBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                <Text style={{ fontSize: 18 }}>✅</Text>
                <Text style={[styles.statBoxLabel, { color: '#059669' }]}>Duyệt đúng</Text>
                <Text style={[styles.statBoxValue, { color: '#047857' }]}>{stats?.approved ?? 0}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderColor: '#fecdd3' }]}>
                <Text style={{ fontSize: 18 }}>❌</Text>
                <Text style={[styles.statBoxLabel, { color: '#e11d48' }]}>Sai — đã sửa</Text>
                <Text style={[styles.statBoxValue, { color: '#be123c' }]}>{stats?.corrected ?? 0}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.subHeading}>Phân loại theo loại u</Text>
              {allClasses.length === 0 ? (
                <Text style={styles.mutedItalic}>Chưa có dữ liệu phân loại</Text>
              ) : (
                allClasses.map((cls) => (
                  <ClassBar key={cls} label={cls} correct={stats.approved_by_class[cls] || 0} corrected={stats.corrected_by_class[cls] || 0} />
                ))
              )}
            </View>
          </View>
        )}
      </View>

      {/* Section 2: retrain */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>⚡ Active Learning — Huấn luyện lại</Text>
        <View style={styles.statPairRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaBoxLabel}>Ca cần học lại</Text>
            <Text style={styles.metaBoxValue}>{feedback.length}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaBoxLabel}>Phiên bản mô hình</Text>
            <Text style={[styles.metaBoxValue, { fontSize: 13 }]}>v4.2-ensemble</Text>
          </View>
        </View>
        <View style={styles.readyPill}>
          <View style={styles.readyDot} />
          <Text style={styles.readyText}>Sẵn sàng</Text>
        </View>
        <TouchableOpacity style={styles.retrainBtn} onPress={handleRetrain} disabled={retraining || feedback.length === 0}>
          <Text style={styles.retrainBtnText}>
            {retraining ? '⏳ Đang chạy huấn luyện...' : `🤖 Chạy huấn luyện lại (${feedback.length} ca)`}
          </Text>
        </TouchableOpacity>
        {!!retrainMsg && (
          <View style={[styles.msgBox, { backgroundColor: retrainMsg.startsWith('Lỗi') ? '#fef2f2' : '#eef2ff' }]}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: retrainMsg.startsWith('Lỗi') ? '#e11d48' : '#4338ca' }}>{retrainMsg}</Text>
          </View>
        )}
      </View>

      {/* Section 3: feedback logs */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>📟 Ca sai bác sĩ đã sửa lại</Text>
          <TouchableOpacity onPress={fetchFeedback}><Text style={styles.refreshIcon}>🔄</Text></TouchableOpacity>
        </View>
        {loadingFeedback ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 20 }} />
        ) : feedbackError ? (
          <Text style={styles.errorText}>{feedbackError}</Text>
        ) : feedback.length === 0 ? (
          <Text style={styles.mutedItalic}>Chưa có ca sai nào bác sĩ cần sửa lại.</Text>
        ) : (
          feedback.map((item, idx) => (
            <View key={idx} style={styles.feedbackRow}>
              <Text style={styles.feedbackIndex}>#{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.feedbackFilename} numberOfLines={1}>{item.filename}</Text>
                <Text style={styles.feedbackBbox}>x:{item.x}, y:{item.y}, w:{item.w}, h:{item.h}</Text>
              </View>
              <View style={styles.classPill}>
                <Text style={styles.classPillText}>{item.correctClass}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Section 4: chatbot config */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🧠 Cấu hình Trợ lý lâm sàng Chatbot</Text>
        {!!configError && <Text style={styles.errorText}>{configError}</Text>}
        {!!saveSuccess && <Text style={styles.successText}>{saveSuccess}</Text>}

        <View style={{ gap: 12, marginTop: 8 }}>
          <View>
            <Text style={styles.inputLabel}>Từ khóa cấm (cách nhau bằng dấu phẩy)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="tự tử, kê đơn, sống được bao lâu..."
              value={blacklistInput}
              onChangeText={setBlacklistInput}
            />
            <Text style={styles.hintText}>Chatbot sẽ từ chối và ghi log cảnh báo khi gặp từ khóa này.</Text>
          </View>
          <View>
            <Text style={styles.inputLabel}>Chỉ dẫn hệ thống (System Prompt)</Text>
            <TextInput
              style={[styles.modalInput, { height: 110, textAlignVertical: 'top' }]}
              placeholder="Nhập vai trò hệ thống, phạm vi tư vấn..."
              value={config.system_prompt}
              onChangeText={(v) => setConfig({ ...config, system_prompt: v })}
              multiline
            />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConfig} disabled={loadingConfig}>
            <Text style={styles.saveBtnText}>{loadingConfig ? '⏳ Đang tải...' : '💾 Lưu cấu hình Chatbot'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  pageTitle: { fontSize: 16, fontWeight: '800', color: Colors.black },
  pageSubtitle: { fontSize: 11, color: Colors.secondary, marginTop: -6 },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.black },
  refreshIcon: { fontSize: 14 },
  errorText: { fontSize: 12, fontWeight: '700', color: '#e11d48' },
  successText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  accuracyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14 },
  accuracyBadge: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  accuracyValue: { fontSize: 18, fontWeight: '900' },
  accuracyLabel: { fontSize: 8, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  totalLabel: { fontSize: 9, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase' },
  totalValue: { fontSize: 24, fontWeight: '900', color: Colors.black, marginTop: 2 },
  totalSub: { fontSize: 9.5, color: Colors.secondary },
  statPairRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statBoxLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  statBoxValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  subHeading: { fontSize: 10, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  mutedItalic: { fontSize: 11.5, color: Colors.secondary, fontStyle: 'italic' },
  classBarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  classLabel: { fontSize: 11, fontWeight: '600', color: Colors.black, flexShrink: 1 },
  classValue: { fontSize: 10, color: Colors.secondary, fontFamily: 'monospace' },
  classTrack: { height: 7, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  classFill: { height: '100%', borderRadius: 4 },
  metaBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, alignItems: 'center' },
  metaBoxLabel: { fontSize: 9.5, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  metaBoxValue: { fontSize: 20, fontWeight: '900', color: Colors.black, marginTop: 4 },
  readyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  readyText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  retrainBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  retrainBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  msgBox: { padding: 10, borderRadius: 10 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  feedbackIndex: { fontSize: 10, color: Colors.secondary, fontFamily: 'monospace', width: 20 },
  feedbackFilename: { fontSize: 11.5, fontWeight: '700', color: Colors.black, fontFamily: 'monospace' },
  feedbackBbox: { fontSize: 9.5, color: Colors.secondary, fontFamily: 'monospace', marginTop: 1 },
  classPill: { backgroundColor: '#fef2f2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  classPillText: { fontSize: 9, fontWeight: '800', color: '#be123c', textTransform: 'uppercase' },
  inputLabel: { fontSize: 11.5, fontWeight: '700', color: Colors.black, marginBottom: 4 },
  hintText: { fontSize: 9.5, color: Colors.secondary, marginTop: 3 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, color: Colors.black, backgroundColor: '#f8fafc' },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
});
