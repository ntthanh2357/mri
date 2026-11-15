import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { get } from '../../services/api.service';
import { usePatientSafety } from '../../controllers/usePatientSafety';
import { usePatientPreScreening } from '../../controllers/usePatientPreScreening';
import { ANSWER_LABEL, RISK_META, SCREEN_QUESTIONS } from '../../utils/preScreening';
import { can } from '../../constants/clinicalPermissions';
import PreScreeningModal from './PreScreeningModal';

const RISK_TONE = {
  success: { bg: Colors.successBg, fg: Colors.successText, border: Colors.successBg },
  warning: { bg: Colors.warningBg, fg: Colors.warningText, border: Colors.warningBg },
  error: { bg: Colors.errorBg, fg: Colors.errorText, border: Colors.errorBg },
};
const fmtDateTime = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

// UC-NUR-03: kết quả sàng lọc dị ứng & chống chỉ định do điều dưỡng ghi — bác sĩ đọc ngay trong bệnh án
const PreScreeningStrip = ({ patientId, role }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingVisit, setEditingVisit] = useState(null);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const { loading, latest, error } = usePatientPreScreening(patientId, refreshKey);
  const canEdit = role === 'nurse';

  const handleOpenScreening = async () => {
    if (!canEdit || loadingVisit) return;
    setActionNote('');
    setLoadingVisit(true);
    try {
      const targetId = String(patientId || '').trim();
      const res = await get('/api/v1/visits/my-queue').catch(() => ({ visits: [] }));
      const matches = (res?.visits || []).filter((it) =>
        it.patientId?._id === targetId ||
        it.patientId === targetId ||
        it.patientId?.profile?.medicalId === targetId
      );
      const openVisit = matches.find((it) => !['đã đóng', 'đã hủy'].includes(it.status)) || null;
      if (openVisit?._id) {
        setEditingVisit({
          ...openVisit,
          preScreening: openVisit.preScreening?.screened ? openVisit.preScreening : latest || openVisit.preScreening,
        });
      } else if (latest?.visitId) {
        setEditingVisit({
          _id: latest.visitId,
          patientId: { _id: targetId },
          preScreening: latest,
        });
      } else {
        setActionNote('Bệnh nhân chưa có lượt khám đang mở để sàng lọc.');
      }
    } finally {
      setLoadingVisit(false);
    }
  };

  if (loading) return null;

  const actionButton = canEdit ? (
    <View style={styles.actionRow}>
      <Pressable
        onPress={handleOpenScreening}
        disabled={loadingVisit}
        style={({ hovered, pressed }) => [
          styles.editBtn,
          (hovered || pressed) && styles.editBtnHover,
        ]}
      >
        {loadingVisit ? (
          <ActivityIndicator size="small" color={Colors.tealPrimary || '#0D9488'} />
        ) : (
          <Feather name="edit-2" size={13} color={Colors.tealPrimary || '#0D9488'} />
        )}
        <Text style={styles.editBtnText}>
          {latest ? 'Điều chỉnh sàng lọc' : 'Sàng lọc ngay'}
        </Text>
      </Pressable>
      {actionNote ? <Text style={styles.actionNote}>{actionNote}</Text> : null}
    </View>
  ) : null;

  const modal = canEdit ? (
    <PreScreeningModal
      visible={Boolean(editingVisit)}
      visit={editingVisit}
      onClose={() => setEditingVisit(null)}
      onSaved={() => {
        setEditingVisit(null);
        setRefreshKey((k) => k + 1);
      }}
    />
  ) : null;

  if (error) {
    return (
      <View style={[styles.strip, styles.neutral, styles.colStrip]}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Feather name="alert-circle" size={16} color={Colors.slateMuted} />
            <Text style={styles.mutedText}>Không tải được kết quả sàng lọc chống chỉ định. Hỏi lại bệnh nhân về hen, suy thận, phản ứng thuốc cản quang.</Text>
          </View>
          {actionButton}
        </View>
        {modal}
      </View>
    );
  }
  if (!latest) {
    return (
      <View style={[styles.strip, styles.neutral, styles.colStrip]}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Feather name="clipboard" size={16} color={Colors.slateMuted} />
            <Text style={styles.mutedText}>Điều dưỡng chưa sàng lọc dị ứng & chống chỉ định cho bệnh nhân này.</Text>
          </View>
          {actionButton}
        </View>
        {modal}
      </View>
    );
  }
  const meta = RISK_META[latest.riskLevel] || RISK_META.none;
  const tone = RISK_TONE[meta.tone];
  return (
    <View style={[styles.strip, { backgroundColor: tone.bg, borderColor: tone.border, flexDirection: 'column', gap: 6 }]} accessibilityRole={latest.riskLevel === 'none' ? undefined : 'alert'}>
      <View style={styles.rowBetween}>
        <View style={[styles.row, { flex: 1 }]}>
          <Feather name={latest.riskLevel === 'none' ? 'check-circle' : 'alert-triangle'} size={16} color={tone.fg} />
          <Text style={[styles.warnText, { color: tone.fg }]}>
            Sàng lọc chống chỉ định: <Text style={styles.warnStrong}>{meta.label}</Text>
          </Text>
        </View>
        {actionButton}
      </View>
      <Text style={[styles.lineText, { color: tone.fg }]}>
        {SCREEN_QUESTIONS.map((q) => `${q.title}: ${ANSWER_LABEL[latest[q.key]?.answer] || 'Chưa rõ'}${latest[q.key]?.answer === 'yes' && latest[q.key]?.note ? ` (${latest[q.key].note})` : ''}`).join(' · ')}
      </Text>
      {latest.otherAllergies ? <Text style={[styles.lineText, { color: tone.fg }]}>Dị ứng khác: {latest.otherAllergies}</Text> : null}
      {(latest.flags || []).map((f) => <Text key={f} style={[styles.lineText, { color: tone.fg }]}>• {f}</Text>)}
      {latest.notes ? <Text style={[styles.lineText, { color: tone.fg }]}>Ghi chú điều dưỡng: {latest.notes}</Text> : null}
      <Text style={[styles.meta, { color: tone.fg }]}>
        {latest.screenedByName || 'Điều dưỡng'} · {latest.screenedAt ? fmtDateTime(latest.screenedAt) : ''}
      </Text>
      {modal}
    </View>
  );
};

// Dải an toàn đầu trang chi tiết bệnh nhân: dị ứng thuốc (nổi bật khi có) + liên hệ khẩn cấp.
// Phân biệt "chưa ghi nhận" với "không tải được" để bác sĩ không hiểu nhầm là bệnh nhân không dị ứng.
// role: vai trò người xem — chỉ gọi kết quả sàng lọc khi vai trò được BE cho đọc (lễ tân không có quyền → trước đây 403)
const PatientSafetyStrip = ({ patientId, role }) => {
  const { loading, data, error } = usePatientSafety(patientId);
  const showPreScreening = !role || can(role, 'preScreeningRead');
  if (!patientId || loading) return null;

  if (error) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.strip, styles.neutral]}>
          <Feather name="alert-circle" size={16} color={Colors.slateMuted} />
          <Text style={styles.mutedText}>Không tải được thông tin dị ứng thuốc. Hỏi lại bệnh nhân trước khi kê đơn.</Text>
        </View>
        {showPreScreening ? <PreScreeningStrip patientId={patientId} role={role} /> : null}
      </View>
    );
  }

  const allergies = data?.drugAllergies || [];
  const c = data?.emergencyContact || {};
  const hasContact = Boolean(c.name || c.phone);

  return (
    <View style={styles.wrap}>
      {allergies.length > 0 ? (
        <View style={[styles.strip, styles.warn]} accessibilityRole="alert">
          <Feather name="alert-triangle" size={16} color={Colors.warningText} />
          <Text style={styles.warnText}>
            Dị ứng thuốc: <Text style={styles.warnStrong}>{allergies.join(', ')}</Text>
          </Text>
        </View>
      ) : (
        <View style={[styles.strip, styles.neutral]}>
          <Feather name="info" size={16} color={Colors.slateMuted} />
          <Text style={styles.mutedText}>Bệnh nhân chưa khai báo dị ứng thuốc.</Text>
        </View>
      )}
      {hasContact ? (
        <View style={[styles.strip, styles.neutral]}>
          <Feather name="phone" size={16} color={Colors.slateMuted} />
          <Text style={styles.mutedText}>
            Liên hệ khẩn cấp: <Text style={styles.strong}>{[c.name, c.relation ? `(${c.relation})` : null].filter(Boolean).join(' ')}</Text>
            {c.phone ? <Text style={styles.strong}>{`, ${c.phone}`}</Text> : null}
          </Text>
        </View>
      ) : null}
      {showPreScreening ? <PreScreeningStrip patientId={patientId} role={role} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  strip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  colStrip: { flexDirection: 'column', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, width: '100%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0D9488',
  },
  editBtnHover: { backgroundColor: '#F0FDFA' },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  actionNote: { fontSize: 12, color: Colors.errorText, fontWeight: '500' },
  meta: { fontSize: 12, opacity: 0.85 },
  lineText: { fontSize: 14, lineHeight: 20 },
  warn: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBg },
  neutral: { backgroundColor: Colors.surface, borderColor: Colors.border },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.warningText },
  warnStrong: { fontWeight: '700' },
  mutedText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  strong: { fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
});

export default PatientSafetyStrip;
