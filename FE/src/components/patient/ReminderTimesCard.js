import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { useReminderSettings } from '../../controllers/useReminderSettings';

// UC-PAT-13 — bệnh nhân tự đặt giờ cho 4 khung nhắc uống thuốc; các lần nhắc sắp tới đổi giờ theo.
const SLOTS = [
  { key: 'morning', label: 'Sáng', icon: 'sunrise' },
  { key: 'noon', label: 'Trưa', icon: 'sun' },
  { key: 'afternoon', label: 'Chiều', icon: 'sunset' },
  { key: 'evening', label: 'Tối', icon: 'moon' },
];

const ReminderTimesCard = () => {
  const { loading, times, defaults, save } = useReminderSettings();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (times || defaults) setValues(times || defaults); }, [times, defaults]);

  const submit = async () => {
    setSaving(true);
    const res = await save(values);
    setSaving(false);
    setMsg(res);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Feather name="bell" size={18} color={Colors.brandGreen} />
        <Text style={styles.title}>Giờ nhắc uống thuốc</Text>
      </View>
      <Text style={styles.note}>
        {times
          ? 'Ứng dụng nhắc bạn theo các giờ dưới đây. Thuốc 2 lần/ngày nhắc Sáng và Tối; 3 lần/ngày nhắc Sáng, Trưa và Tối.'
          : 'Bạn đang dùng giờ nhắc mặc định của bệnh viện. Đặt lại cho hợp giờ sinh hoạt; thuốc 2 lần/ngày nhắc Sáng và Tối.'}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.brandGreen} />
      ) : (
        <View style={styles.grid}>
          {SLOTS.map((s) => (
            <View key={s.key} style={styles.slot}>
              <View style={styles.slotHead}>
                <Feather name={s.icon} size={14} color={Colors.slateMuted} />
                <Text style={styles.slotLabel}>{s.label}</Text>
              </View>
              <TextInput
                value={values[s.key] || ''}
                onChangeText={(v) => setValues({ ...values, [s.key]: v.replace(/[^\d:]/g, '').slice(0, 5) })}
                placeholder="hh:mm"
                placeholderTextColor={Colors.secondary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.input}
                accessibilityLabel={`Giờ nhắc buổi ${s.label.toLowerCase()}`}
              />
            </View>
          ))}
        </View>
      )}
      {msg ? (
        <View style={[styles.message, { backgroundColor: msg.ok ? Colors.successBg : Colors.warningBg }]} accessibilityLiveRegion="polite">
          <Feather name={msg.ok ? 'check-circle' : 'alert-circle'} size={15} color={msg.ok ? Colors.successText : Colors.warningText} />
          <Text style={[styles.messageText, { color: msg.ok ? Colors.successText : Colors.warningText }]}>{msg.message}</Text>
        </View>
      ) : null}
      <Pressable onPress={submit} disabled={saving || loading} accessibilityRole="button"
        style={({ hovered }) => [styles.btn, hovered && styles.btnHover, (saving || loading) && styles.disabled]}>
        {saving ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : <Text style={styles.btnText}>Lưu giờ nhắc</Text>}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slot: { flexGrow: 1, flexBasis: 120, gap: 6 },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotLabel: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  input: { height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, backgroundColor: Colors.surface, fontSize: 18, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  messageText: { flex: 1, fontSize: 14, fontWeight: '600' },
  btn: { alignSelf: 'flex-start', height: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  btnHover: { backgroundColor: Colors.brandGreenSoft },
  btnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

export default ReminderTimesCard;
