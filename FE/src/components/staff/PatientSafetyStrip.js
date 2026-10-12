import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { usePatientSafety } from '../../controllers/usePatientSafety';

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
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  strip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  warn: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBg },
  neutral: { backgroundColor: Colors.surface, borderColor: Colors.border },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.warningText },
  warnStrong: { fontWeight: '700' },
  mutedText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  strong: { fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
});

export default PatientSafetyStrip;
