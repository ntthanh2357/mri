import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Colors from '../constants/colors';
import { GENDER_OPTIONS, formatDobDigits, parseDobInput } from '../utils/profileFields';

/**
 * Bộ trường nhập liệu hồ sơ cá nhân đầy đủ (Họ tên, Giới tính, Ngày sinh DD/MM/YYYY, SĐT, Địa chỉ).
 * Dùng chung cho modal xem/sửa ở ResponsiveLayout và modal chỉnh sửa tại HomeScreen.
 */
const ProfileFormFields = ({
  name,
  onChangeName,
  gender,
  onChangeGender,
  dobText,
  onChangeDobText,
  phone,
  onChangePhone,
  phoneLast4,
  address,
  onChangeAddress,
  accentColor = Colors.brandGreen,
}) => {
  const dobCheck = dobText?.trim() ? parseDobInput(dobText) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.label}>Họ và tên *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={onChangeName}
          placeholder="Nhập họ và tên đầy đủ"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onChangeGender(active ? '' : opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ hovered }) => [
                  styles.chip,
                  hovered && !active && styles.chipHover,
                  active && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Ngày tháng năm sinh</Text>
          {dobCheck?.ok && dobCheck.age != null ? (
            <Text style={[styles.ageBadge, { color: accentColor }]}>{dobCheck.age} tuổi</Text>
          ) : null}
        </View>
        <TextInput
          style={styles.input}
          value={dobText}
          onChangeText={(txt) => onChangeDobText(formatDobDigits(txt))}
          placeholder="DD/MM/YYYY (ví dụ: 15/08/1995)"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={10}
        />
        {dobCheck && !dobCheck.ok ? (
          <Text style={styles.fieldHintError}>{dobCheck.message}</Text>
        ) : (
          <Text style={styles.fieldHint}>Nhập đủ 8 chữ số ngày, tháng, năm sinh (DD/MM/YYYY)</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Số điện thoại mới (để trống nếu giữ nguyên)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={onChangePhone}
          placeholder={phoneLast4 ? `Đang liên kết •••• ${phoneLast4} — nhập số mới nếu đổi` : 'Ví dụ: 0912345678'}
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Địa chỉ liên hệ</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={onChangeAddress}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          placeholderTextColor="#94A3B8"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  field: { gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '600', color: '#334155' },
  ageBadge: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flex: 1,
    minWidth: 78,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  chipHover: { backgroundColor: '#F1F5F9', borderColor: '#94A3B8' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  fieldHint: { fontSize: 11, color: '#64748B' },
  fieldHintError: { fontSize: 11, color: '#DC2626', fontWeight: '500' },
});

export default ProfileFormFields;

