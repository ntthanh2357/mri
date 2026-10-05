import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import Colors from '../../constants/colors';

/**
 * Tab gạch chân dùng chung cho màn vận hành. Cuộn ngang khi không đủ chỗ (điện thoại).
 * tabs: [{ key, label, count? }] · value: key đang chọn · onChange(key)
 */
const PageTabs = ({ tabs, value, onChange, style }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.scroll, style]} contentContainerStyle={styles.row}>
    {tabs.map((t) => {
      const active = t.key === value;
      return (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          style={({ hovered, focused }) => [styles.tab, active && styles.tabActive, (hovered || focused) && !active && styles.tabHover]}
        >
          <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{t.label}</Text>
          {t.count != null ? (
            <View style={[styles.count, active && styles.countActive]}>
              <Text style={[styles.countText, active && styles.countTextActive]}>{t.count}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.brandGreen },
  tabHover: { borderBottomColor: Colors.borderStrong },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  labelActive: { color: Colors.brandGreen, fontWeight: '700' },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: Colors.brandGreenSoft },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  countTextActive: { color: Colors.brandGreen },
});

export default PageTabs;
