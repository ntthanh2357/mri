import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { copyStatus } from '../utils/recordCopy';

// Nhãn trạng thái yêu cầu bản sao bệnh án (icon + chữ + màu nền), dùng chung bệnh nhân và bệnh viện.
const TONE = {
  warning: { bg: Colors.warningBg, fg: Colors.warningText },
  success: { bg: Colors.successBg, fg: Colors.successText },
  error: { bg: Colors.errorBg, fg: Colors.errorText },
  muted: { bg: Colors.background, fg: Colors.slateMuted },
};

const CopyStatusBadge = ({ status }) => {
  const st = copyStatus(status);
  const t = TONE[st.tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Feather name={st.icon} size={13} color={t.fg} />
      <Text style={[styles.text, { color: t.fg }]}>{st.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  text: { fontSize: 13, fontWeight: '600' },
});

export default CopyStatusBadge;
