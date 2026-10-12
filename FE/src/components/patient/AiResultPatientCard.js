import React, { useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import PressableScale from '../PressableScale';
import FadeIn from '../FadeIn';
import { useProgress } from '../../controllers/useMotion';

// Câu chữ cho bệnh nhân: gọi tên dễ hiểu, không dùng từ "khẩn cấp", luôn nhắc đây là gợi ý chờ bác sĩ xác nhận.
const PATIENT_COPY = {
  glioma: {
    name: 'U thần kinh đệm (glioma)',
    summary: 'AI thấy một vùng bất thường trên ảnh và xếp vào nhóm u thần kinh đệm.',
  },
  meningioma: {
    name: 'U màng não (meningioma)',
    summary: 'AI thấy một vùng bất thường trên ảnh và xếp vào nhóm u màng não. Loại này thường lành tính.',
  },
  pituitary: {
    name: 'U tuyến yên (pituitary)',
    summary: 'AI thấy một vùng bất thường gần tuyến yên trên ảnh.',
  },
  notumor: {
    name: 'Không thấy dấu hiệu khối u',
    summary: 'AI không thấy vùng nghi ngờ khối u trên ảnh này.',
  },
};

const NEXT_STEPS = [
  'Đây là gợi ý ban đầu của AI, chưa phải chẩn đoán. Bác sĩ chuyên khoa sẽ đọc phim để kết luận.',
  'Mang kết quả này khi tái khám hoặc gửi câu hỏi cho đội hỗ trợ nếu bạn chưa rõ.',
  'Nếu bị đau đầu dữ dội, co giật, yếu tay chân hoặc nói khó, hãy đến cơ sở y tế gần nhất ngay.',
];

const ProbRow = ({ label, value, highlight }) => {
  const width = useProgress(Math.max(0, Math.min(1, value / 100)));
  return (
    <View style={styles.probRow}>
      <Text style={[styles.probLabel, highlight && styles.probLabelStrong]} numberOfLines={1}>{label}</Text>
      <View style={styles.probTrack}>
        <Animated.View style={[styles.probFill, highlight && styles.probFillStrong, { width }]} />
      </View>
      <Text style={[styles.probValue, highlight && styles.probLabelStrong]}>{value}%</Text>
    </View>
  );
};

/** Thẻ kết quả phân tích AI dành cho bệnh nhân (thay khối kết quả kỹ thuật + khối duyệt của bác sĩ). */
const AiResultPatientCard = ({ result, navigation }) => {
  const [showDetail, setShowDetail] = useState(false);
  const cls = PATIENT_COPY[result.class_name] ? result.class_name : 'notumor';
  const copy = PATIENT_COPY[cls];
  const isClear = cls === 'notumor';
  const confidenceWidth = useProgress(Math.max(0, Math.min(1, (result.confidence || 0) / 100)));
  const probs = Object.entries(result.all_probabilities || {}).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.wrap}>
      <FadeIn style={styles.card}>
        <Text style={styles.eyebrow}>Kết quả gợi ý từ AI</Text>
        <View style={styles.titleRow}>
          <View style={[styles.statusIcon, isClear ? styles.statusIconClear : styles.statusIconNote]}>
            <Feather name={isClear ? 'check' : 'info'} size={20} color={isClear ? Colors.brandGreen : Colors.brandNavy} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{copy.name}</Text>
        </View>
        <Text style={styles.summary}>{copy.summary}</Text>

        <View style={styles.confBox}>
          <View style={styles.confHead}>
            <Text style={styles.confLabel}>Độ tin cậy của AI</Text>
            <Text style={styles.confValue}>{result.confidence}%</Text>
          </View>
          <View style={styles.confTrack}>
            <Animated.View style={[styles.confFill, { width: confidenceWidth }]} />
          </View>
          <Text style={styles.confHint}>Con số này cho biết AI chắc chắn đến đâu, không phải mức độ nặng của bệnh.</Text>
        </View>

        {probs.length > 0 && (
          <>
            <Pressable onPress={() => setShowDetail((v) => !v)} accessibilityRole="button" hitSlop={8} style={styles.detailToggle}>
              <Text style={styles.detailToggleText}>{showDetail ? 'Ẩn chi tiết các khả năng' : 'Xem chi tiết các khả năng'}</Text>
              <Feather name={showDetail ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.brandGreen} />
            </Pressable>
            {showDetail && (
              <View style={styles.probList}>
                {probs.map(([key, value]) => (
                  <ProbRow key={key} label={(PATIENT_COPY[key] || { name: key }).name} value={value} highlight={key === cls} />
                ))}
              </View>
            )}
          </>
        )}
      </FadeIn>

      <FadeIn delay={120} style={styles.card}>
        <Text style={styles.sectionTitle}>Bước tiếp theo</Text>
        {NEXT_STEPS.map((step, i) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <View style={styles.actions}>
          <PressableScale style={styles.primaryBtn} hoverStyle={styles.primaryBtnHover} onPress={() => navigation.navigate('Support')}>
            <Feather name="message-circle" size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Gửi câu hỏi cho đội hỗ trợ</Text>
          </PressableScale>
          <PressableScale style={styles.secondaryBtn} hoverStyle={styles.secondaryBtnHover} onPress={() => navigation.navigate('ImagingHistory')}>
            <Text style={styles.secondaryBtnText}>Xem phim của tôi</Text>
          </PressableScale>
        </View>
      </FadeIn>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    boxShadow: '0 1px 2px rgba(11, 42, 85, 0.05)',
  },
  eyebrow: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusIconClear: { backgroundColor: Colors.brandGreenSoft },
  statusIconNote: { backgroundColor: '#E8EEF7' },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: Colors.brandNavy, lineHeight: 28 },
  summary: { fontSize: 15, lineHeight: 22, color: Colors.slateDark, marginTop: 10 },

  confBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  confHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  confLabel: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  confValue: { fontSize: 20, fontWeight: '800', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  confTrack: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden', marginTop: 8 },
  confFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.brandNavy },
  confHint: { fontSize: 13, lineHeight: 19, color: Colors.secondary, marginTop: 8 },

  detailToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 14, paddingVertical: 4 },
  detailToggleText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  probList: { gap: 10, marginTop: 10 },
  probRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  probLabel: { width: 170, fontSize: 13, color: Colors.slateMuted },
  probLabelStrong: { color: Colors.brandNavy, fontWeight: '700' },
  probTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 3, backgroundColor: '#94A3B8' },
  probFillStrong: { backgroundColor: Colors.brandNavy },
  probValue: { width: 56, textAlign: 'right', fontSize: 13, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy, marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 13, fontWeight: '700', color: Colors.brandGreen },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.slateDark },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.brandGreen },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { height: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.brandGreen, justifyContent: 'center' },
  secondaryBtnHover: { backgroundColor: Colors.brandGreenSoft },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '700' },
});

export default AiResultPatientCard;
