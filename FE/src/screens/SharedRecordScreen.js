import React from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../constants/colors';
import Config from '../constants/config';
import VitalsChart from '../components/patient/VitalsChart';
import { useSharedRecord } from '../controllers/useSharedRecord';
import { assetUrl, sectionsSummary, ALL_SECTION_KEYS } from '../utils/recordShare';

// UC-PAT-09 — Trang công khai: bệnh án bệnh nhân chia sẻ qua QR (chỉ đọc, không cần đăng nhập).

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const GENDER = { nam: 'Nam', nu: 'Nữ', khac: 'Khác', male: 'Nam', female: 'Nữ' };
const ageOf = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

const Section = ({ icon, title, count, children }) => (
  <View style={styles.card}>
    <View style={styles.sectionHead}>
      <Feather name={icon} size={18} color={Colors.brandGreen} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count ? <Text style={styles.count}>{count}</Text> : null}
    </View>
    {children}
  </View>
);

const Field = ({ label, value }) => (value ? (
  <Text style={styles.field}><Text style={styles.fieldLabel}>{label}: </Text>{value}</Text>
) : null);

const Item = ({ title, sub, children }) => (
  <View style={styles.item}>
    <Text style={styles.itemTitle}>{title}</Text>
    {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
    {children}
  </View>
);

const SharedRecordScreen = ({ route, navigation }) => {
  const { loading, data, error } = useSharedRecord(route, navigation);
  const { width } = useWindowDimensions();
  const thumb = width < 600 ? 140 : 180;

  let body;
  if (loading) {
    body = <View style={styles.state}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.note}>Đang mở bệnh án…</Text></View>;
  } else if (error) {
    body = (
      <View style={styles.state}>
        <Feather name="lock" size={32} color={Colors.slateMuted} />
        <Text style={styles.stateTitle}>{error}</Text>
      </View>
    );
  } else {
    const p = data.patient;
    const age = ageOf(p.dateOfBirth);
    const s = data.safety;
    const keys = data.sections || ALL_SECTION_KEYS;
    const shown = (k) => keys.includes(k); // nhóm bệnh nhân không chọn: ẩn hẳn, không ghi "chưa có"
    const partial = sectionsSummary(keys) !== 'Toàn bộ bệnh án';
    body = (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Text style={styles.patientName}>{p.name}</Text>
          <Text style={styles.note}>
            {[GENDER[p.gender] || null, age !== null ? `${age} tuổi` : null, p.dateOfBirth ? `sinh ngày ${fmtDate(p.dateOfBirth)}` : null, p.medicalId ? `mã bệnh nhân ${p.medicalId}` : null].filter(Boolean).join(', ')}
          </Text>
          {partial ? <Text style={styles.note}>Bệnh nhân chọn chia sẻ: <Text style={styles.bold}>{sectionsSummary(keys)}</Text>.</Text> : null}
          {!shown('safety') ? null : s.drugAllergies.length ? (
            <View style={styles.allergy} accessibilityRole="alert">
              <Feather name="alert-triangle" size={16} color={Colors.warningText} />
              <Text style={styles.allergyText}>Dị ứng thuốc: <Text style={styles.bold}>{s.drugAllergies.join(', ')}</Text></Text>
            </View>
          ) : <Text style={styles.note}>Bệnh nhân chưa khai báo dị ứng thuốc.</Text>}
          {shown('safety') && (s.emergencyContact?.name || s.emergencyContact?.phone) ? (
            <Text style={styles.note}>
              Liên hệ khẩn cấp: <Text style={styles.bold}>{[s.emergencyContact.name, s.emergencyContact.relation ? `(${s.emergencyContact.relation})` : null, s.emergencyContact.phone].filter(Boolean).join(' ')}</Text>
            </Text>
          ) : null}
        </View>

        {shown('imaging') ? (
          <Section icon="film" title="Phim MRI/CT" count={data.imaging.length || null}>
            {data.imaging.length ? data.imaging.map((img) => (
              <Item key={img._id} title={img.procedure || img.imagingType || 'Phim chụp'} sub={`Kết luận ngày ${fmtDate(img.reportDate)}${img.radiologist ? `, bác sĩ ${img.radiologist}` : ''}`}>
                {img.images?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.images}>
                    {img.images.map((u, i) => (
                      <Image key={i} source={{ uri: assetUrl(u, Config.API_URL) }} style={[styles.image, { width: thumb, height: thumb }]} resizeMode="cover" accessibilityLabel={`Ảnh phim ${i + 1}`} />
                    ))}
                  </ScrollView>
                ) : null}
                <Field label="Mô tả" value={img.findings} />
                <Field label="Kết luận" value={img.conclusion} />
              </Item>
            )) : <Text style={styles.note}>Chưa có phim đã có kết luận.</Text>}
          </Section>
        ) : null}

        {shown('vitals') && data.vitals.length ? <VitalsChart items={data.vitals} /> : null}

        {shown('visits') ? (
          <Section icon="clipboard" title="Lịch sử khám" count={data.visits.length || null}>
            {data.visits.length ? data.visits.map((v, i) => (
              <Item key={i} title={`${fmtDate(v.date)}${v.reason ? `: ${v.reason}` : ''}`} sub={[v.visitType, v.doctor ? `bác sĩ ${v.doctor}` : null, v.status].filter(Boolean).join(', ')}>
                {v.vitals?.bloodPressure ? <Text style={styles.note}>Sinh hiệu: huyết áp {v.vitals.bloodPressure}, mạch {v.vitals.pulse}, SpO₂ {v.vitals.spo2}%{v.vitals.temperature ? `, nhiệt độ ${v.vitals.temperature} °C` : ''}</Text> : null}
                {v.mriRegion ? <Text style={styles.note}>Chỉ định chụp MRI: {v.mriRegion}</Text> : null}
              </Item>
            )) : <Text style={styles.note}>Chưa có lượt khám.</Text>}
          </Section>
        ) : null}

        {shown('prescriptions') ? (
          <Section icon="package" title="Đơn thuốc" count={data.prescriptions.length || null}>
            {data.prescriptions.length ? data.prescriptions.map((p, i) => (
              <Item key={i} title={`Đơn ngày ${fmtDate(p.recorded_at)}`} sub={[p.doctor_name ? `bác sĩ ${p.doctor_name}` : null, p.diagnosis ? `chẩn đoán ${p.diagnosis}` : null].filter(Boolean).join(', ')}>
                {(p.drugs || []).map((d, j) => (
                  <Text key={j} style={styles.drug}>• <Text style={styles.bold}>{d.name}</Text>{d.quantity ? `, ${d.quantity} ${d.unit || ''}` : ''}{d.usage ? `: ${d.usage}` : ''}</Text>
                ))}
              </Item>
            )) : <Text style={styles.note}>Chưa có đơn thuốc.</Text>}
          </Section>
        ) : null}

        {shown('labs') ? (
          <Section icon="droplet" title="Xét nghiệm" count={data.labs.length || null}>
            {data.labs.length ? data.labs.map((l, i) => (
              <Item key={i} title={`${l.category || 'Xét nghiệm'}, ngày ${fmtDate(l.resulted_at || l.ordered_at)}`} sub={l.status}>
                {(l.results || []).map((r, j) => (
                  <Text key={j} style={[styles.drug, r.is_abnormal && styles.abnormal]}>
                    • {r.biomarker_name}: <Text style={styles.bold}>{r.value_result} {r.unit}</Text>{r.reference_range_display ? ` (tham chiếu ${r.reference_range_display})` : ''}{r.is_abnormal ? (r.abnormal_direction === 'LOW' ? ', thấp' : ', cao') : ''}
                  </Text>
                ))}
              </Item>
            )) : <Text style={styles.note}>Chưa có kết quả xét nghiệm.</Text>}
          </Section>
        ) : null}

        {shown('inpatient') && data.inpatientRecords.length ? (
          <Section icon="folder" title="Bệnh án nội trú" count={data.inpatientRecords.length}>
            {data.inpatientRecords.map((r) => (
              <Item key={r._id} title={`${r.department || 'Nội trú'}${r.diagnosis ? `: ${r.diagnosis}` : ''}`} sub={[r.doctorInCharge ? `bác sĩ ${r.doctorInCharge}` : null, r.status, r.dischargeDate ? `ra viện ${fmtDate(r.dischargeDate)}` : null].filter(Boolean).join(', ')}>
                <Field label="Hướng điều trị" value={r.treatmentPlan} />
                <Field label="Loại u" value={[r.tumorType, r.whoGrade ? `WHO độ ${r.whoGrade}` : null].filter(Boolean).join(', ')} />
                {r.careSheets?.length ? <Text style={styles.note}>{r.careSheets.length} phiếu chăm sóc. Gần nhất: {r.careSheets[0].progressNotes}</Text> : null}
                {r.consultations?.map((c, i) => <Field key={i} label={`Hội chẩn ${fmtDate(c.meetingDate)}`} value={c.treatmentConclusion || c.diagnosis} />)}
              </Item>
            ))}
          </Section>
        ) : null}

        {shown('papers') && (data.dischargePapers.length || data.transferForms.length) ? (
          <Section icon="file-text" title="Giấy ra viện, chuyển viện">
            {data.dischargePapers.map((d, i) => (
              <Item key={`d${i}`} title={`Giấy ra viện ${fmtDate(d.dateOut || d.recorded_at)}`} sub={d.diagnosis}>
                <Field label="Điều trị" value={d.treatment} />
                <Field label="Ghi chú" value={d.note} />
              </Item>
            ))}
            {data.transferForms.map((t, i) => (
              <Item key={`t${i}`} title={`Chuyển viện ${fmtDate(t.recorded_at)}${t.transferTo ? ` đến ${t.transferTo}` : ''}`} sub={t.diagnosis}>
                <Field label="Lý do" value={t.reasonDetail || t.reason} />
                <Field label="Tóm tắt lâm sàng" value={t.clinicalSummary} />
              </Item>
            ))}
          </Section>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>NeuroScan AI</Text>
        <Text style={styles.topSub}>Bệnh án được chia sẻ</Text>
      </View>
      <View style={styles.page}>
        <View style={styles.notice}>
          <Feather name="shield" size={15} color={Colors.infoText} />
          <Text style={styles.noticeText}>Bệnh nhân đã chia sẻ bệnh án này với bạn qua mã QR. Chỉ để xem; bệnh nhân có thể dừng chia sẻ bất cứ lúc nào.</Text>
        </View>
        {body}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topbar: { backgroundColor: Colors.brandNavy, paddingHorizontal: 20, paddingVertical: 16 },
  brand: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  topSub: { fontSize: 13, color: Colors.brandMint, marginTop: 2 },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 48, gap: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.infoText },
  stack: { gap: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 10 },
  patientName: { fontSize: 22, fontWeight: '800', color: Colors.brandNavy },
  allergy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.warningBg },
  allergyText: { flex: 1, fontSize: 15, color: Colors.warningText },
  bold: { fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  count: { fontSize: 13, fontWeight: '700', color: Colors.slateMuted, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  item: { gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  itemTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  itemSub: { fontSize: 13, color: Colors.slateMuted },
  field: { fontSize: 14, lineHeight: 21, color: Colors.slateDark },
  fieldLabel: { fontWeight: '600', color: Colors.slateMuted },
  drug: { fontSize: 14, lineHeight: 21, color: Colors.slateDark },
  abnormal: { color: Colors.warningText },
  images: { gap: 8, paddingVertical: 6 },
  image: { borderRadius: 10, backgroundColor: '#0B1220' },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  state: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center', maxWidth: 420 },
});

export default SharedRecordScreen;
