import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { usePatientSafety } from '../../controllers/usePatientSafety';
import { usePatientPreScreening } from '../../controllers/usePatientPreScreening';
import { ANSWER_LABEL, RISK_META, SCREEN_QUESTIONS } from '../../utils/preScreening';

const RISK_TONE = {
  success: { bg: Colors.successBg, fg: Colors.successText, border: Colors.successBg },
  warning: { bg: Colors.warningBg, fg: Colors.warningText, border: Colors.warningBg },
  error: { bg: Colors.errorBg, fg: Colors.errorText, border: Colors.errorBg },
};
const fmtDateTime = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

// UC-NUR-03: kết quả sàng lọc dị ứng & chống chỉ định do điều dưỡng ghi — bác sĩ đọc ngay trong bệnh án
const PreScreeningStrip = ({ patientId }) => {
  const { loading, latest, error } = usePatientPreScreening(patientId);
  if (loading) return null;
  if (error) {
    return (
      <View style={[styles.strip, styles.neutral]}>
        <Feather name="alert-circle" size={16} color={Colors.slateMuted} />
        <Text style={styles.mutedText}>Không tải được kết quả sàng lọc chống chỉ định. Hỏi lại bệnh nhân về hen, suy thận, phản ứng thuốc cản quang.</Text>
      </View>
    );
  }
  if (!latest) {
    return (
      <View style={[styles.strip, styles.neutral]}>
        <Feather name="clipboard" size={16} color={Colors.slateMuted} />
        <Text style={styles.mutedText}>Điều dưỡng chưa sàng lọc dị ứng & chống chỉ định cho bệnh nhân này.</Text>
      </View>
    );
  }
  const meta = RISK_META[latest.riskLevel] || RISK_META.none;
  const tone = RISK_TONE[meta.tone];
  return (
    <View style={[styles.strip, { backgroundColor: tone.bg, borderColor: tone.border, flexDirection: 'column', gap: 6 }]} accessibilityRole={latest.riskLevel === 'none' ? undefined : 'alert'}>
      <View style={styles.row}>
        <Feather name={latest.riskLevel === 'none' ? 'check-circle' : 'alert-triangle'} size={16} color={tone.fg} />
        <Text style={[styles.warnText, { color: tone.fg }]}>
          Sàng lọc chống chỉ định: <Text style={styles.warnStrong}>{meta.label}</Text>
        </Text>
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
    </View>
  );
};

// Dải an toàn đầu trang chi tiết bệnh nhân: dị ứng thuốc (nổi bật khi có) + liên hệ khẩn cấp.
// Phân biệt "chưa ghi nhận" với "không tải được" để bác sĩ không hiểu nhầm là bệnh nhân không dị ứng.
const PatientSafetyStrip = ({ patientId }) => {
  const { loading, data, error } = usePatientSafety(patientId);
  if (!patientId || loading) return null;

  if (error) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.strip, styles.neutral]}>
          <Feather name="alert-circle" size={16} color={Colors.slateMuted} />
          <Text style={styles.mutedText}>Không tải được thông tin dị ứng thuốc. Hỏi lại bệnh nhân trước khi kê đơn.</Text>
        </View>
        <PreScreeningStrip patientId={patientId} />
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
      <PreScreeningStrip patientId={patientId} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  strip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
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
