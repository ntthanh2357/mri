import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Colors from '../../constants/colors';

// Thành phần dùng chung cho các trang nghiệp vụ nội bộ, để nút và thẻ giống nhau giữa các màn hình.

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
export const personName = (p) => p?.profile?.fullName || p?.profile?.name || p?.email || '—';

export const WorkButton = ({ label, onPress, variant = 'primary', busy = false, disabled = false }) => {
  const isDisabled = busy || disabled;
  const look = variant === 'danger' ? s.btnDanger : variant === 'ghost' ? s.btnGhost : s.btnPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy }}
      style={({ pressed, hovered }) => [s.btn, look, isDisabled && s.btnDisabled, (pressed || hovered) && !isDisabled && s.btnActive]}
    >
      {busy
        ? <ActivityIndicator size="small" color={variant === 'ghost' ? Colors.brandGreen : '#FFFFFF'} />
        : <Text style={variant === 'ghost' ? s.btnGhostText : s.btnText}>{label}</Text>}
    </Pressable>
  );
};

export const WorkCard = ({ children, tone }) => (
  <View style={[s.card, tone === 'alert' && s.cardAlert]}>{children}</View>
);

export const WorkField = ({ label, multiline, style, ...props }) => (
  <View style={s.field}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={Colors.secondary}
      multiline={multiline}
      style={[s.input, multiline && s.inputMulti, style]}
      {...props}
    />
  </View>
);

export const ChoiceChips = ({ label, options, value, onChange }) => (
  <View style={s.field}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <View style={s.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[s.chip, active && s.chipOn]}
          >
            <Text style={[s.chipText, active && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

export const StatTiles = ({ items }) => (
  <View style={s.stats}>
    {items.map((it) => (
      <View key={it.label} style={s.stat}>
        <Text style={s.statValue}>{it.value}</Text>
        <Text style={s.statLabel}>{it.label}</Text>
      </View>
    ))}
  </View>
);

export const EmptyNote = ({ text }) => <Text style={s.empty}>{text}</Text>;

export const workStyles = StyleSheet.create({
  root: { flex: 1 },
  page: { gap: 12, paddingVertical: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.brandNavy },
  section: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy, marginTop: 4 },
  status: { fontSize: 12, fontWeight: '600', color: Colors.brandGreenPressed },
  statusAlert: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  meta: { fontSize: 12, color: Colors.secondary, lineHeight: 18 },
  body: { fontSize: 14, color: '#0F172A', lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

const s = StyleSheet.create({
  btn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnDanger: { backgroundColor: '#B91C1C' },
  btnGhost: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  btnActive: { opacity: 0.85 },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnGhostText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, gap: 8 },
  cardAlert: { borderColor: '#DC2626' },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#0F172A', backgroundColor: '#FFFFFF' },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipText: { fontSize: 12, color: '#334155' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, minWidth: 130, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: Colors.secondary },
  empty: { color: Colors.secondary, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
});
