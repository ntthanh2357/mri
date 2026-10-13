import React, { useState } from 'react';
import { View, Text, TextInput, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import Config from '../../constants/config';
import { assetUrl, SCAN_DOC_TYPES } from '../../utils/recordShare';

// UC-PAT-09 (mở rộng) — Bệnh nhân chụp giấy tờ khám nơi khác; máy tự cắt nền, đọc chữ và tách thông tin;
// bệnh nhân kiểm tra rồi lưu. Chỉ giấy tờ đã lưu (đã kiểm tra) mới vào được bệnh án chia sẻ qua QR.

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const imageOf = (doc) => ({ uri: assetUrl(doc.imageUrl, Config.API_URL) });
const EMPTY_MED = { name: '', quantity: '', usage: '' };

const Input = ({ label, style, ...input }) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput {...input} accessibilityLabel={label} placeholderTextColor={Colors.slateMuted}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[styles.input, input.multiline && styles.textarea, focused && styles.inputFocus, style]} />
  );
};

const Field = ({ label, hint, style, ...input }) => (
  <View style={[styles.field, style]}>
    <Text style={styles.label}>{label}</Text>
    {hint ? <Text style={styles.note}>{hint}</Text> : null}
    <Input label={label} {...input} />
  </View>
);

const DocEditor = ({ doc, cropNote, onSave, onDelete, onClose, onRescan }) => {
  const [title, setTitle] = useState(doc.title || '');
  const [text, setText] = useState(doc.text || '');
  const [fields, setFields] = useState(doc.fields || {});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState(null);
  const meds = fields.medications || [];
  const set = (key) => (value) => setFields((f) => ({ ...f, [key]: value }));
  const setMed = (i, key) => (value) => setFields((f) => ({ ...f, medications: (f.medications || []).map((m, j) => (j === i ? { ...m, [key]: value } : m)) }));
  const showMeds = fields.docType === 'prescription' || meds.length > 0;

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setErr(res.message);
  };

  return (
    <View style={styles.editor}>
      <Image source={imageOf(doc)} style={styles.preview} resizeMode="contain" accessibilityLabel={`Ảnh giấy tờ: ${doc.title}`} />
      {cropNote ? (
        <View style={styles.cropNote}>
          <Feather name="crop" size={15} color={Colors.infoText} />
          <Text style={styles.cropText}>Máy đã tự cắt nền và nắn thẳng ảnh. Nếu ảnh bị cắt mất chữ, hãy quét lại giữ nguyên khung.</Text>
          <Pressable onPress={() => run(onRescan)} disabled={busy} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkText}>Quét lại không tự cắt</Text>
          </Pressable>
        </View>
      ) : null}
      {doc.ocrStatus === 'failed' && !doc.text ? (
        <Text style={styles.warn}>Chưa đọc được chữ tự động. Bạn có thể tự gõ nội dung theo giấy gốc.</Text>
      ) : null}

      <Field label="Tên giấy tờ" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ví dụ: Đơn thuốc ngày 10/10…" />

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Thông tin chính</Text>
        <Text style={styles.note}>Máy điền sẵn theo giấy. So với giấy gốc và sửa chỗ sai; ô nào giấy không ghi thì để trống.</Text>
        <Text style={styles.label}>Loại giấy tờ</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {SCAN_DOC_TYPES.map((t) => {
            const on = (fields.docType || 'other') === t.key;
            return (
              <Pressable key={t.key} onPress={() => set('docType')(t.key)} accessibilityRole="radio" aria-checked={on}
                style={({ hovered }) => [styles.chip, on && styles.chipOn, hovered && !on && styles.chipHover]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.grid}>
          <Field style={styles.cell} label="Ngày ghi trên giấy" value={fields.date || ''} onChangeText={set('date')} maxLength={40} placeholder="Ví dụ: 10/10/2026…" />
          <Field style={styles.cell} label="Nơi khám" value={fields.facility || ''} onChangeText={set('facility')} maxLength={200} placeholder="Tên phòng khám, bệnh viện…" />
          <Field style={styles.cell} label="Bác sĩ" value={fields.doctor || ''} onChangeText={set('doctor')} maxLength={120} placeholder="Tên bác sĩ ký…" />
          <Field style={styles.cell} label="Chẩn đoán" value={fields.diagnosis || ''} onChangeText={set('diagnosis')} maxLength={500} placeholder="Dòng chẩn đoán trên giấy…" />
        </View>

        {showMeds ? (
          <View style={styles.meds}>
            <Text style={styles.label}>Thuốc ({meds.length})</Text>
            {meds.map((m, i) => (
              <View key={i} style={styles.medRow}>
                <Input style={styles.medName} label={`Tên thuốc ${i + 1}`} value={m.name} onChangeText={setMed(i, 'name')} maxLength={200} placeholder="Tên thuốc, hàm lượng…" />
                <Input style={styles.medQty} label={`Số lượng thuốc ${i + 1}`} value={m.quantity} onChangeText={setMed(i, 'quantity')} maxLength={80} placeholder="Số lượng…" />
                <Input style={styles.medUsage} label={`Cách dùng thuốc ${i + 1}`} value={m.usage} onChangeText={setMed(i, 'usage')} maxLength={300} placeholder="Cách dùng…" />
                <Pressable onPress={() => setFields((f) => ({ ...f, medications: meds.filter((_, j) => j !== i) }))} accessibilityRole="button"
                  accessibilityLabel={`Xoá thuốc ${m.name || i + 1}`} style={styles.iconBtn} hitSlop={6}>
                  <Feather name="x" size={18} color={Colors.slateMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {meds.length < 30 ? (
          <Pressable onPress={() => setFields((f) => ({ ...f, medications: [...(f.medications || []), EMPTY_MED] }))} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkText}>+ Thêm thuốc</Text>
          </Pressable>
        ) : null}
      </View>

      <Field label="Toàn bộ chữ đã đọc" hint="So với giấy gốc và sửa chỗ đọc sai. Chỗ ghi [không đọc được] hãy tự điền."
        value={text} onChangeText={setText} multiline maxLength={20000} placeholder="Gõ nội dung giấy tờ…" />
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={() => run(() => onSave(doc._id, { title, text, fields }))} disabled={busy} accessibilityRole="button"
          style={({ hovered }) => [styles.saveBtn, hovered && styles.saveBtnHover, busy && styles.disabled]}>
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Lưu giấy tờ</Text>}
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.ghostBtn}><Text style={styles.ghostBtnText}>Đóng</Text></Pressable>
        <View style={styles.grow} />
        {confirm ? (
          <>
            <Pressable onPress={() => setConfirm(false)} accessibilityRole="button" style={styles.ghostBtn}><Text style={styles.ghostBtnText}>Giữ lại</Text></Pressable>
            <Pressable onPress={() => run(() => onDelete(doc._id))} disabled={busy} accessibilityRole="button" style={styles.dangerBtn}>
              <Text style={styles.dangerBtnText}>Xoá giấy tờ</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => setConfirm(true)} accessibilityRole="button" style={styles.ghostBtn}><Text style={styles.dangerLink}>Xoá</Text></Pressable>
        )}
      </View>
    </View>
  );
};

const DocRow = ({ doc, open, onToggle }) => {
  const saved = !!doc.confirmedAt;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" aria-expanded={open} accessibilityLabel={`${doc.title}, ${saved ? 'đã lưu' : 'chưa kiểm tra'}`}
      style={({ hovered }) => [styles.docRow, hovered && styles.docRowHover]}>
      <Image source={imageOf(doc)} style={styles.thumb} resizeMode="cover" accessibilityLabel="" />
      <View style={styles.grow}>
        <Text style={styles.docTitle}>{doc.title}</Text>
        <Text style={styles.note}>Quét ngày {fmtDate(doc.createdAt)}</Text>
      </View>
      <View style={[styles.badge, saved ? styles.badgeOk : styles.badgeWarn]}>
        <Feather name={saved ? 'check' : 'edit-3'} size={13} color={saved ? Colors.successText : Colors.warningText} />
        <Text style={[styles.badgeText, { color: saved ? Colors.successText : Colors.warningText }]}>{saved ? 'Đã lưu' : 'Chưa kiểm tra'}</Text>
      </View>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.slateMuted} />
    </Pressable>
  );
};

const ScanButton = ({ icon, label, onPress, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={({ hovered }) => [styles.scanBtn, hovered && styles.scanBtnHover, disabled && styles.disabled]}>
    <Feather name={icon} size={16} color={Colors.brandGreen} />
    <Text style={styles.scanBtnText}>{label}</Text>
  </Pressable>
);

/** `state`: kết quả của hook useScannedDocuments, do màn hình giữ. */
const ScannedDocuments = ({ state }) => {
  const { loading, docs, error, scanning, lastScan, scan, rescanUncropped, save, remove } = state;
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState(null); // { tone: 'info' | 'error', text }

  const opened = (res) => {
    if (!res.ok) { setMsg({ tone: 'error', text: res.message }); return res; }
    setOpenId(res.doc._id);
    setMsg({ tone: res.doc.ocrFailed ? 'error' : 'info', text: res.message });
    return res;
  };

  const onScan = async (camera) => {
    setMsg(null);
    const res = await scan(camera);
    if (!res.cancelled) opened(res);
  };

  const onSave = async (id, patch) => {
    const res = await save(id, patch);
    if (res.ok) { setOpenId(null); setMsg({ tone: 'info', text: 'Đã lưu. Giấy tờ này có thể chia sẻ qua mã QR.' }); }
    return res;
  };

  const onDelete = async (id) => {
    const res = await remove(id);
    if (res.ok) { setOpenId(null); setMsg({ tone: 'info', text: 'Đã xoá giấy tờ.' }); }
    return res;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Giấy tờ tự quét</Text>
      <Text style={styles.body}>
        Chụp giấy tờ khám ở nơi khác như đơn thuốc, kết quả xét nghiệm, giấy ra viện. Ứng dụng tự cắt nền, đọc chữ và điền sẵn thông tin chính;
        hãy kiểm tra lại rồi lưu. Chỉ giấy tờ đã lưu mới được chia sẻ qua mã QR.
      </Text>
      <View style={styles.point}>
        <Feather name="info" size={15} color={Colors.infoText} />
        <Text style={styles.pointText}>Ảnh được gửi tới dịch vụ AI của Google để đọc chữ.</Text>
      </View>
      <View style={styles.row}>
        <ScanButton icon="camera" label="Chụp ảnh giấy tờ" onPress={() => onScan(true)} disabled={scanning} />
        <ScanButton icon="image" label="Chọn ảnh có sẵn" onPress={() => onScan(false)} disabled={scanning} />
      </View>
      {scanning ? (
        <View style={styles.point} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={Colors.brandGreen} />
          <Text style={styles.pointText}>Đang cắt nền và đọc chữ trong ảnh…</Text>
        </View>
      ) : null}
      {msg ? <Text style={msg.tone === 'error' ? styles.error : styles.info} accessibilityLiveRegion="polite">{msg.text}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !docs.length ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : null}
      {!loading && !docs.length && !error ? <Text style={styles.note}>Bạn chưa quét giấy tờ nào.</Text> : null}
      {docs.map((doc) => (
        <View key={doc._id} style={styles.docItem}>
          <DocRow doc={doc} open={openId === doc._id} onToggle={() => setOpenId(openId === doc._id ? null : doc._id)} />
          {openId === doc._id ? (
            <DocEditor key={doc._id} doc={doc} cropNote={lastScan?.docId === doc._id && lastScan.cropped && !doc.confirmedAt /* đã lưu thì không cho thay nữa */}
              onSave={onSave} onDelete={onDelete} onClose={() => setOpenId(null)}
              onRescan={async () => opened(await rescanUncropped(doc._id))} />
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  error: { fontSize: 14, lineHeight: 20, color: Colors.errorText },
  warn: { fontSize: 14, lineHeight: 20, color: Colors.warningText },
  info: { fontSize: 14, lineHeight: 20, color: Colors.successText },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  scanBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  scanBtnHover: { backgroundColor: Colors.brandGreenSoft, borderColor: Colors.brandGreen },
  scanBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  docItem: { borderTopWidth: 1, borderTopColor: Colors.border },
  docRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 10 },
  docRowHover: { backgroundColor: Colors.background },
  thumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  docTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeOk: { backgroundColor: Colors.successBg },
  badgeWarn: { backgroundColor: Colors.warningBg },
  badgeText: { fontSize: 13, fontWeight: '600' },
  editor: { gap: 12, paddingBottom: 14 },
  preview: { width: '100%', height: 360, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  cropNote: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.infoBg },
  cropText: { flex: 1, minWidth: 200, fontSize: 14, lineHeight: 20, color: Colors.infoText },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  group: { gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  groupTitle: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },
  chip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipHover: { borderColor: Colors.brandGreen },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  chipTextOn: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexGrow: 1, flexBasis: 240 },
  meds: { gap: 8 },
  medRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  medName: { flexGrow: 2, flexBasis: 200 },
  medQty: { flexGrow: 1, flexBasis: 100 },
  medUsage: { flexGrow: 2, flexBasis: 200 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.slateDark },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  textarea: { minHeight: 200, textAlignVertical: 'top' },
  inputFocus: { borderColor: Colors.brandGreen },
  saveBtn: { height: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  saveBtnHover: { backgroundColor: Colors.brandGreenPressed },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  ghostBtn: { height: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { color: Colors.slateMuted, fontSize: 14, fontWeight: '600' },
  dangerBtn: { height: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.errorText, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dangerLink: { fontSize: 14, fontWeight: '600', color: Colors.errorText },
  disabled: { opacity: 0.5 },
});

export default ScannedDocuments;
