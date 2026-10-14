import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { SHARE_SECTIONS } from '../../utils/recordShare';
import { PERIODS, SOURCES, NO_FILTER, isFiltering } from '../../utils/shareCatalog';

// UC-PAT-09 — Thanh tìm kiếm và phân loại tài liệu trong bệnh án: từ khoá, loại tài liệu, thời gian, nguồn.
// Dùng chung cho bệnh nhân (lúc chọn nội dung chia sẻ) và người xem (trang bệnh án được chia sẻ).

const Chip = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" aria-pressed={on} accessibilityLabel={label} hitSlop={4}
    style={({ hovered }) => [styles.chip, on && styles.chipOn, hovered && !on && styles.chipHover]}>
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </Pressable>
);

const Group = ({ label, children }) => (
  <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <View style={styles.chips}>{children}</View>
  </View>
);

/**
 * `filter` { query, section, period, source } + `onChange(next)`; `counts` { nhóm: số mục } để ghi số bên cạnh từng loại
 * (loại không có mục nào thì ẩn); `total`: tổng số mục.
 */
const RecordFilterBar = ({ filter, onChange, counts, total, placeholder = 'Tìm theo tên thuốc, chẩn đoán, bác sĩ…' }) => {
  const set = (patch) => onChange({ ...filter, ...patch });
  const types = SHARE_SECTIONS.filter((s) => counts[s.key] > 0);
  return (
    <View style={styles.bar}>
      <View style={styles.search}>
        <Feather name="search" size={18} color={Colors.slateMuted} />
        <TextInput value={filter.query} onChangeText={(query) => set({ query })} placeholder={placeholder} placeholderTextColor={Colors.slateMuted}
          accessibilityLabel="Tìm tài liệu" autoCorrect={false} autoCapitalize="none" maxLength={80} returnKeyType="search" style={styles.input} />
        {filter.query ? (
          <Pressable onPress={() => set({ query: '' })} accessibilityRole="button" accessibilityLabel="Xoá từ khoá" hitSlop={10} style={styles.clear}>
            <Feather name="x" size={16} color={Colors.slateMuted} />
          </Pressable>
        ) : null}
      </View>

      <Group label="Loại tài liệu">
        <Chip label={`Tất cả (${total})`} on={filter.section === 'all'} onPress={() => set({ section: 'all' })} />
        {types.map((s) => <Chip key={s.key} label={`${s.label} (${counts[s.key]})`} on={filter.section === s.key} onPress={() => set({ section: s.key })} />)}
      </Group>
      <View style={styles.pair}>
        <Group label="Thời gian">
          {PERIODS.map((p) => <Chip key={p.key} label={p.label} on={filter.period === p.key} onPress={() => set({ period: p.key })} />)}
        </Group>
        <Group label="Nguồn">
          {SOURCES.map((s) => <Chip key={s.key} label={s.label} on={filter.source === s.key} onPress={() => set({ source: s.key })} />)}
        </Group>
      </View>
      {isFiltering(filter) ? (
        <Pressable onPress={() => onChange(NO_FILTER)} accessibilityRole="button" hitSlop={8} style={styles.reset}>
          <Feather name="rotate-ccw" size={14} color={Colors.brandGreen} />
          <Text style={styles.resetText}>Xoá bộ lọc</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: Colors.slateDark, paddingVertical: 10 },
  clear: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12 },
  group: { gap: 6 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: Colors.slateMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  chipOn: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreen },
  chipHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  chipText: { fontSize: 14, color: Colors.slateDark },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  resetText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
});

export default RecordFilterBar;
