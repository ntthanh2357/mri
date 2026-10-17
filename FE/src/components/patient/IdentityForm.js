import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';

// UC-PAT-02 — Hồ sơ cá nhân & BHYT bệnh nhân tự khai.
// CCCD / số thẻ đã lưu chỉ hiện dạng che: để trống ô = giữ nguyên, nhập số mới = thay thế.

const BHYT_STATUS = {
  '': { label: 'Chưa khai báo', tone: 'muted', icon: 'minus-circle' },
  pending: { label: 'Chờ lễ tân xác nhận', tone: 'info', icon: 'clock' },
  verified: { label: 'Đã xác nhận', tone: 'ok', icon: 'check-circle' },
  rejected: { label: 'Thông tin chưa khớp thẻ thật, vui lòng kiểm tra lại', tone: 'warn', icon: 'alert-circle' },
};
const TONE = {
  muted: { bg: Colors.background, fg: Colors.slateMuted },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
  ok: { bg: Colors.successBg, fg: Colors.successText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
};

const toDisplayDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return isNaN(t) ? '' : `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
};
/** "31/12/2027" → "2027-12-31"; rỗng → ''; sai → null */
const parseDisplayDate = (s) => {
  const v = (s || '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isNaN(new Date(iso)) ? null : iso;
};

const Field = ({ label, hint, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>
);

const Input = (props) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={Colors.secondary}
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused && styles.inputFocus, props.style]}
    />
  );
};

const IdentityForm = ({ state, onSave, onRetry }) => {
  const d = state.data;
  const [citizenId, setCitizenId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [place, setPlace] = useState('');
  const [contact, setContact] = useState({ name: '', relation: '', phone: '' });
  const [allergies, setAllergies] = useState([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Nạp lại form mỗi khi dữ liệu từ server đổi (lần đầu, sau khi lưu)
  useEffect(() => {
    if (!d) return;
    setExpiry(toDisplayDate(d.bhyt?.expiresAt));
    setPlace(d.bhyt?.registrationPlace || '');
    setContact({ name: d.emergencyContact?.name || '', relation: d.emergencyContact?.relation || '', phone: d.emergencyContact?.phone || '' });
    setAllergies(d.drugAllergies || []);
  }, [d]);

  if (state.loading && !d) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={Colors.brandGreen} />
        <Text style={styles.hint}>Đang tải…</Text>
      </View>
    );
  }
  if (state.error && !d) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.errorText}>{state.error}</Text>
        <Pressable onPress={onRetry} style={styles.secondaryBtn} accessibilityRole="button"><Text style={styles.secondaryBtnText}>Thử lại</Text></Pressable>
      </View>
    );
  }

  const status = BHYT_STATUS[d?.bhyt?.status || ''] || BHYT_STATUS[''];
  const tone = TONE[status.tone];

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (v && !allergies.some((a) => a.toLowerCase() === v.toLowerCase())) setAllergies([...allergies, v]);
    setAllergyInput('');
  };

  const handleSave = async () => {
    const expiryIso = parseDisplayDate(expiry);
    if (expiryIso === null) { setMessage({ ok: false, text: 'Hạn thẻ BHYT nhập theo dạng ngày/tháng/năm, ví dụ 31/12/2027.' }); return; }
    const payload = {};
    if (citizenId.trim()) payload.citizenId = citizenId.trim();
    if (cardNumber.trim()) payload.bhytCardNumber = cardNumber.trim();
    if (expiry !== toDisplayDate(d?.bhyt?.expiresAt)) payload.bhytExpiresAt = expiryIso;
    if (place !== (d?.bhyt?.registrationPlace || '')) payload.bhytRegistrationPlace = place;
    payload.emergencyContact = contact;
    payload.drugAllergies = allergies;
    setSaving(true);
    const res = await onSave(payload);
    setSaving(false);
    setMessage({ ok: res.ok, text: res.message });
    if (res.ok) { setCitizenId(''); setCardNumber(''); }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Giấy tờ tùy thân</Text>
        <Field label="Số căn cước công dân (CCCD)" hint={d?.hasCitizenId ? `Đã lưu: ${d.citizenIdMasked}. Để trống nếu không đổi.` : 'Gồm 12 chữ số. Được mã hoá khi lưu.'}>
          <Input value={citizenId} onChangeText={(v) => setCitizenId(v.replace(/\D/g, ''))} placeholder={d?.hasCitizenId ? 'Nhập số mới để thay thế…' : 'Ví dụ: 079201001234'} keyboardType="number-pad" maxLength={12} accessibilityLabel="Số căn cước công dân" />
        </Field>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, styles.grow]}>Thẻ bảo hiểm y tế</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Feather name={status.icon} size={13} color={tone.fg} />
            <Text style={[styles.pillText, { color: tone.fg }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.note}>Khi bạn đến khám, lễ tân sẽ đối chiếu với thẻ thật rồi xác nhận. Thẻ đã xác nhận mới được dùng để tính phần BHYT chi trả.</Text>
        <Field label="Mã thẻ BHYT" hint={d?.bhyt?.cardNumberMasked ? `Đã lưu: ${d.bhyt.cardNumberMasked}. Để trống nếu không đổi.` : '15 ký tự: 2 chữ cái và 13 chữ số.'}>
          <Input value={cardNumber} onChangeText={(v) => setCardNumber(v.toUpperCase().replace(/\s/g, ''))} placeholder={d?.bhyt?.cardNumberMasked ? 'Nhập mã mới để thay thế…' : 'Ví dụ: HS4010123456789'} autoCapitalize="characters" maxLength={15} accessibilityLabel="Mã thẻ BHYT" />
        </Field>
        <View style={styles.row}>
          <View style={styles.col}>
            <Field label="Hạn sử dụng">
              <Input value={expiry} onChangeText={setExpiry} placeholder="ngày/tháng/năm" maxLength={10} accessibilityLabel="Hạn sử dụng thẻ BHYT" />
            </Field>
          </View>
          <View style={styles.col}>
            <Field label="Nơi đăng ký KCB ban đầu">
              <Input value={place} onChangeText={setPlace} placeholder="Ví dụ: BV Đà Nẵng…" accessibilityLabel="Nơi đăng ký khám chữa bệnh ban đầu" />
            </Field>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Người liên hệ khẩn cấp</Text>
        <Text style={styles.note}>Bệnh viện sẽ gọi người này khi cần báo tin gấp.</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Field label="Họ và tên">
              <Input value={contact.name} onChangeText={(v) => setContact({ ...contact, name: v })} placeholder="Ví dụ: Nguyễn Thị Lan…" accessibilityLabel="Họ tên người liên hệ khẩn cấp" />
            </Field>
          </View>
          <View style={styles.col}>
            <Field label="Quan hệ">
              <Input value={contact.relation} onChangeText={(v) => setContact({ ...contact, relation: v })} placeholder="Ví dụ: Mẹ…" accessibilityLabel="Quan hệ với người liên hệ" />
            </Field>
          </View>
        </View>
        <Field label="Số điện thoại">
          <Input value={contact.phone} onChangeText={(v) => setContact({ ...contact, phone: v })} placeholder="Ví dụ: 0905123456…" keyboardType="phone-pad" maxLength={15} accessibilityLabel="Số điện thoại người liên hệ" />
        </Field>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dị ứng thuốc</Text>
        <Text style={styles.note}>Bác sĩ và điều dưỡng sẽ thấy danh sách này khi khám và kê đơn cho bạn.</Text>
        <View style={styles.chips}>
          {allergies.length === 0 ? <Text style={styles.hint}>Chưa ghi nhận dị ứng thuốc nào.</Text> : null}
          {allergies.map((a) => (
            <View key={a} style={styles.chip}>
              <Text style={styles.chipText}>{a}</Text>
              <Pressable onPress={() => setAllergies(allergies.filter((x) => x !== a))} accessibilityRole="button" accessibilityLabel={`Bỏ ${a}`} hitSlop={10}>
                <Feather name="x" size={14} color={Colors.warningText} />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Input style={styles.grow} value={allergyInput} onChangeText={setAllergyInput} onSubmitEditing={addAllergy} placeholder="Tên thuốc, ví dụ: Penicillin…" accessibilityLabel="Thêm thuốc bị dị ứng" />
          <Pressable onPress={addAllergy} style={styles.secondaryBtn} accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>Thêm</Text>
          </Pressable>
        </View>
      </View>

      {message ? (
        <View style={[styles.message, { backgroundColor: message.ok ? Colors.successBg : Colors.warningBg }]} accessibilityLiveRegion="polite">
          <Feather name={message.ok ? 'check-circle' : 'alert-circle'} size={15} color={message.ok ? Colors.successText : Colors.warningText} />
          <Text style={[styles.messageText, { color: message.ok ? Colors.successText : Colors.warningText }]}>{message.text}</Text>
        </View>
      ) : null}
      <Pressable onPress={handleSave} disabled={saving} accessibilityRole="button" style={({ hovered }) => [styles.primaryBtn, hovered && styles.primaryBtnHover, saving && styles.disabled]}>
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Lưu thông tin</Text>}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  col: { flexGrow: 1, flexBasis: 200 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  hint: { fontSize: 13, color: Colors.secondary },
  input: { height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, backgroundColor: Colors.surface, fontSize: 16, color: Colors.slateDark },
  inputFocus: { borderColor: Colors.brandGreen },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: '100%' },
  pillText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 10, height: 34, borderRadius: 17, backgroundColor: Colors.warningBg },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.warningText },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  messageText: { flex: 1, fontSize: 14, fontWeight: '600' },
  primaryBtn: { height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 46, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  errorText: { fontSize: 15, color: Colors.warningText, textAlign: 'center' },
});

export default IdentityForm;
