import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Linking } from 'react-native';
import Colors from '../../constants/colors';
import Config from '../../constants/config';
import { assetUrl } from '../../utils/recordShare';

// UC-PAT-09 — Phần chi tiết của từng mục trong bệnh án được chia sẻ (chỉ đọc). Dùng chung cho 2 cách xem ở trang
// người xem: "Theo nhóm" và "Tất cả tài liệu".

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

export const Field = ({ label, value }) => (value ? (
  <Text style={styles.field}><Text style={styles.fieldLabel}>{label}: </Text>{value}</Text>
) : null);

export const Item = ({ title, sub, children }) => (
  <View style={styles.item}>
    <Text style={styles.itemTitle}>{title}</Text>
    {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
    {children}
  </View>
);

const Imaging = ({ item: img, thumb }) => (
  <>
    {img.images?.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.images}>
        {img.images.map((u, i) => (
          <Image key={i} source={{ uri: assetUrl(u, Config.API_URL) }} style={[styles.image, { width: thumb, height: thumb }]} resizeMode="cover" accessibilityLabel={`Ảnh phim ${i + 1}`} />
        ))}
      </ScrollView>
    ) : null}
    <Field label="Mô tả" value={img.findings} />
    <Field label="Kết luận" value={img.conclusion} />
  </>
);

const Visit = ({ item: v }) => (
  <>
    {v.vitals?.bloodPressure ? <Text style={styles.note}>Sinh hiệu: huyết áp {v.vitals.bloodPressure}, mạch {v.vitals.pulse}, SpO₂ {v.vitals.spo2}%{v.vitals.temperature ? `, nhiệt độ ${v.vitals.temperature} °C` : ''}</Text> : null}
    {v.mriRegion ? <Text style={styles.note}>Chỉ định chụp MRI: {v.mriRegion}</Text> : null}
  </>
);

const Prescription = ({ item: p }) => (
  <>
    {(p.drugs || []).map((d, j) => (
      <Text key={j} style={styles.drug}>• <Text style={styles.bold}>{d.name}</Text>{d.quantity ? `, ${d.quantity} ${d.unit || ''}` : ''}{d.usage ? `: ${d.usage}` : ''}</Text>
    ))}
  </>
);

const Lab = ({ item: l }) => (
  <>
    {(l.results || []).map((r, j) => (
      <Text key={j} style={[styles.drug, r.is_abnormal && styles.abnormal]}>
        • {r.biomarker_name}: <Text style={styles.bold}>{r.value_result} {r.unit}</Text>{r.reference_range_display ? ` (tham chiếu ${r.reference_range_display})` : ''}{r.is_abnormal ? (r.abnormal_direction === 'LOW' ? ', thấp' : ', cao') : ''}
      </Text>
    ))}
  </>
);

const Vital = ({ item: v }) => (
  <>
    <Field label="Cân nặng" value={v.weight ? `${v.weight} kg` : ''} />
    <Field label="Chiều cao" value={v.height ? `${v.height} cm` : ''} />
    <Field label="BMI" value={v.bmi} />
  </>
);

const Inpatient = ({ item: r }) => (
  <>
    <Field label="Dị ứng (bệnh viện ghi trong bệnh án)" value={Array.isArray(r.allergies) ? r.allergies.filter(Boolean).join(', ') : ''} />
    <Field label="Hướng điều trị" value={r.treatmentPlan} />
    <Field label="Loại u" value={[r.tumorType, r.whoGrade ? `WHO độ ${r.whoGrade}` : null].filter(Boolean).join(', ')} />
    {r.careSheets?.length ? <Text style={styles.note}>{r.careSheets.length} phiếu chăm sóc. Gần nhất: {r.careSheets[0].progressNotes}</Text> : null}
    {r.consultations?.map((c, i) => <Field key={i} label={`Hội chẩn ${fmtDate(c.meetingDate)}`} value={c.treatmentConclusion || c.diagnosis} />)}
  </>
);

const Discharge = ({ item: d }) => (
  <>
    <Field label="Điều trị" value={d.treatment} />
    <Field label="Ghi chú" value={d.note} />
  </>
);

const Transfer = ({ item: t }) => (
  <>
    <Field label="Lý do" value={t.reasonDetail || t.reason} />
    <Field label="Tóm tắt lâm sàng" value={t.clinicalSummary} />
  </>
);

const ScannedDocument = ({ item: d }) => {
  const uri = assetUrl(d.imageUrl, Config.API_URL);
  return (
    <>
      <Image source={{ uri }} style={styles.docImage} resizeMode="contain" accessibilityLabel={`Ảnh giấy tờ: ${d.title}`} />
      <Text accessibilityRole="link" onPress={() => Linking.openURL(uri)} style={styles.link}>Mở ảnh gốc cỡ lớn</Text>
      <Field label="Ngày ghi trên giấy" value={d.fields?.date} />
      <Field label="Nơi khám" value={d.fields?.facility} />
      <Field label="Bác sĩ" value={d.fields?.doctor} />
      <Field label="Chẩn đoán" value={d.fields?.diagnosis} />
      {d.fields?.medications?.length ? (
        <View>
          <Text style={[styles.field, styles.fieldLabel]}>Thuốc ({d.fields.medications.length}), máy đọc từ ảnh và bệnh nhân tự kiểm tra, hãy đối chiếu ảnh gốc</Text>
          {d.fields.medications.map((m, j) => (
            <Text key={j} style={styles.drug}>• <Text style={styles.bold}>{m.name}</Text>{m.quantity ? `, ${m.quantity}` : ''}{m.usage ? `: ${m.usage}` : ''}</Text>
          ))}
        </View>
      ) : null}
      {d.text ? (
        <>
          <Text style={[styles.field, styles.fieldLabel]}>Toàn bộ chữ trên giấy</Text>
          <Text style={styles.docText}>{d.text}</Text>
        </>
      ) : <Text style={styles.note}>Bệnh nhân không nhập phần chữ.</Text>}
    </>
  );
};

const BODIES = {
  imaging: Imaging, visits: Visit, prescriptions: Prescription, labs: Lab, vitals: Vital,
  inpatient: Inpatient, discharge: Discharge, transfer: Transfer, documents: ScannedDocument,
};

/** Mục có phần chi tiết để mở ra xem hay không (dị ứng, liên hệ khẩn cấp đã hiện đủ ở dòng tóm tắt). */
export const hasBody = (kind) => !!BODIES[kind];

/** Chi tiết của 1 mục; `kind` theo utils/shareCatalog: flattenSharedRecord. */
export const ItemBody = ({ kind, item, thumb = 160 }) => {
  const Body = BODIES[kind];
  return Body ? <Body item={item} thumb={thumb} /> : null;
};

const styles = StyleSheet.create({
  item: { gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  itemTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  itemSub: { fontSize: 13, color: Colors.slateMuted },
  field: { fontSize: 14, lineHeight: 21, color: Colors.slateDark },
  fieldLabel: { fontWeight: '600', color: Colors.slateMuted },
  bold: { fontWeight: '700' },
  drug: { fontSize: 14, lineHeight: 21, color: Colors.slateDark },
  abnormal: { color: Colors.warningText },
  images: { gap: 8, paddingVertical: 6 },
  image: { borderRadius: 10, backgroundColor: '#0B1220' },
  docImage: { width: '100%', height: 360, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginTop: 6 },
  docText: { fontSize: 15, lineHeight: 23, color: Colors.slateDark, marginTop: 4 },
  link: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen, paddingVertical: 6 },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
});
