import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../constants/colors';
import VitalsChart from '../components/patient/VitalsChart';
import RecordFilterBar from '../components/patient/RecordFilterBar';
import { Item, ItemBody, hasBody } from '../components/patient/SharedRecordItems';
import { useSharedRecord } from '../controllers/useSharedRecord';
import { sectionsSummary, docTypeLabel, hasStructuredInfo, ALL_SECTION_KEYS } from '../utils/recordShare';
import { flattenSharedRecord, filterItems, countBySection, sectionLabel, sectionIcon, isFiltering, NO_FILTER } from '../utils/shareCatalog';

// UC-PAT-09 — Trang công khai: bệnh án bệnh nhân chia sẻ qua QR (chỉ đọc, không cần đăng nhập).
// 2 cách xem: "Theo nhóm" (từng loại 1 khối) và "Tất cả tài liệu" (1 danh sách để tìm kiếm, phân loại).

const PAGE = 40;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const GENDER = { nam: 'Nam', nu: 'Nữ', khac: 'Khác', male: 'Nam', female: 'Nữ' };
const ageOf = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

const Section = ({ icon, title, count, partial, children }) => (
  <View style={styles.card}>
    <View style={styles.sectionHead}>
      <Feather name={icon} size={18} color={Colors.brandGreen} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count ? <Text style={styles.count}>{count}</Text> : null}
    </View>
    {partial ? <PartialNote /> : null}
    {children}
  </View>
);

// Bệnh nhân chỉ chọn một số mục trong nhóm: người xem phải biết danh sách này không đầy đủ
const PartialNote = ({ text = 'Bệnh nhân chỉ chia sẻ một số mục trong nhóm này, danh sách có thể không đầy đủ.' }) => (
  <View style={styles.partial}>
    <Feather name="filter" size={14} color={Colors.infoText} />
    <Text style={styles.partialText}>{text}</Text>
  </View>
);

const Tab = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="tab" aria-selected={on} style={({ hovered }) => [styles.tab, on && styles.tabOn, hovered && !on && styles.tabHover]}>
    <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
  </Pressable>
);

// 1 dòng trong "Tất cả tài liệu": bấm để mở phần chi tiết
const Entry = ({ entry, open, onToggle, thumb }) => {
  const expandable = hasBody(entry.kind);
  const meta = [sectionLabel(entry.section), entry.date ? fmtDate(entry.date) : null, entry.source === 'self' ? 'bệnh nhân tự khai' : null].filter(Boolean).join(', ');
  const head = (
    <>
      <View style={styles.entryIcon}><Feather name={sectionIcon(entry.section)} size={16} color={Colors.brandGreen} /></View>
      <View style={styles.grow}>
        <Text style={styles.entryTitle}>{entry.title}</Text>
        {entry.sub ? <Text style={styles.entrySub}>{entry.sub}</Text> : null}
        <Text style={styles.entryMeta}>{meta}</Text>
      </View>
      {expandable ? <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.slateMuted} /> : null}
    </>
  );
  return (
    <View style={styles.entry}>
      {expandable ? (
        <Pressable onPress={onToggle} accessibilityRole="button" aria-expanded={open} accessibilityLabel={`${entry.title}, ${meta}`}
          style={({ hovered }) => [styles.entryHead, hovered && styles.entryHover]}>
          {head}
        </Pressable>
      ) : <View style={styles.entryHead}>{head}</View>}
      {expandable && open ? <View style={styles.entryBody}><ItemBody kind={entry.kind} item={entry.item} thumb={thumb} /></View> : null}
    </View>
  );
};

const SharedRecordScreen = ({ route, navigation }) => {
  const { loading, data, error } = useSharedRecord(route, navigation);
  const { width } = useWindowDimensions();
  const thumb = width < 600 ? 140 : 180;
  const [mode, setMode] = useState('groups'); // 'groups' | 'all'
  const [filter, setFilter] = useState(NO_FILTER);
  const [opened, setOpened] = useState([]);
  const [limit, setLimit] = useState(PAGE);
  const entries = useMemo(() => flattenSharedRecord(data), [data]);
  const found = useMemo(() => filterItems(entries, filter), [entries, filter]);
  const changeFilter = (next) => { setFilter(next); setLimit(PAGE); };

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
    const partialKeys = data.partial || [];
    const isPartial = (k) => partialKeys.includes(k);
    const partial = sectionsSummary(keys) !== 'Toàn bộ bệnh án' || partialKeys.length > 0;
    // phần an toàn bệnh nhân chọn chia sẻ (lượt chia sẻ cũ không có `shared` = cả 2 phần)
    const safetyShared = s ? (s.shared || ['allergies', 'emergencyContact']) : [];
    const allergies = s?.drugAllergies || [];

    body = (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Text style={styles.patientName}>{p.name}</Text>
          <Text style={styles.note}>
            {[GENDER[p.gender] || null, age !== null ? `${age} tuổi` : null, p.dateOfBirth ? `sinh ngày ${fmtDate(p.dateOfBirth)}` : null, p.medicalId ? `mã bệnh nhân ${p.medicalId}` : null].filter(Boolean).join(', ')}
          </Text>
          {partial ? <Text style={styles.note}>Bệnh nhân chọn chia sẻ: <Text style={styles.bold}>{sectionsSummary(keys)}</Text>{partialKeys.length ? ' (một số nhóm chỉ gồm các mục bệnh nhân chọn)' : ''}.</Text> : null}
          {!shown('safety') ? null : !safetyShared.includes('allergies') ? (
            <Text style={styles.note}>Bệnh nhân không chia sẻ thông tin dị ứng thuốc. Hãy hỏi trực tiếp bệnh nhân trước khi kê đơn.</Text>
          ) : allergies.length ? (
            <View style={styles.allergy} accessibilityRole="alert">
              <Feather name="alert-triangle" size={16} color={Colors.warningText} />
              <Text style={styles.allergyText}>Dị ứng thuốc: <Text style={styles.bold}>{allergies.join(', ')}</Text></Text>
            </View>
          ) : <Text style={styles.note}>Bệnh nhân chưa khai báo dị ứng thuốc.</Text>}
          {shown('safety') && safetyShared.includes('emergencyContact') && (s.emergencyContact?.name || s.emergencyContact?.phone) ? (
            <Text style={styles.note}>
              Liên hệ khẩn cấp: <Text style={styles.bold}>{[s.emergencyContact.name, s.emergencyContact.relation ? `(${s.emergencyContact.relation})` : null, s.emergencyContact.phone].filter(Boolean).join(' ')}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          <Tab label="Theo nhóm" on={mode === 'groups'} onPress={() => setMode('groups')} />
          <Tab label={`Tất cả tài liệu (${entries.length})`} on={mode === 'all'} onPress={() => setMode('all')} />
        </View>

        {mode === 'all' ? (
          <View style={styles.card}>
            <RecordFilterBar filter={filter} onChange={changeFilter} counts={countBySection(entries)} total={entries.length} placeholder="Tìm theo tên thuốc, chẩn đoán, chỉ số xét nghiệm…" />
            <Text style={styles.resultCount} accessibilityLiveRegion="polite">
              {isFiltering(filter) ? `Tìm thấy ${found.length} trong ${entries.length} mục` : `${entries.length} mục, mới nhất trước`}
            </Text>
            {partialKeys.length ? <PartialNote text={`Bệnh nhân chỉ chia sẻ một số mục của: ${partialKeys.map(sectionLabel).join(', ')}. Danh sách có thể không đầy đủ.`} /> : null}
            {found.length ? found.slice(0, limit).map((e) => (
              <Entry key={e.key} entry={e} thumb={thumb} open={opened.includes(e.key)}
                onToggle={() => setOpened((cur) => (cur.includes(e.key) ? cur.filter((k) => k !== e.key) : [...cur, e.key]))} />
            )) : (
              <View style={styles.state}>
                <Feather name="search" size={24} color={Colors.slateMuted} />
                <Text style={styles.note}>{entries.length ? 'Không có mục nào khớp. Hãy thử từ khoá khác hoặc xoá bộ lọc.' : 'Bệnh nhân chưa có tài liệu nào trong phần được chia sẻ.'}</Text>
              </View>
            )}
            {found.length > limit ? (
              <Pressable onPress={() => setLimit((n) => n + PAGE)} accessibilityRole="button" style={styles.more}>
                <Text style={styles.moreText}>Hiện thêm {Math.min(PAGE, found.length - limit)} mục</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {shown('imaging') ? (
              <Section icon="film" title="Phim MRI/CT" count={data.imaging.length || null} partial={isPartial('imaging')}>
                {data.imaging.length ? data.imaging.map((img) => (
                  <Item key={img._id} title={img.procedure || img.imagingType || 'Phim chụp'} sub={`Kết luận ngày ${fmtDate(img.reportDate)}${img.radiologist ? `, bác sĩ ${img.radiologist}` : ''}`}>
                    <ItemBody kind="imaging" item={img} thumb={thumb} />
                  </Item>
                )) : <Text style={styles.note}>Chưa có phim đã có kết luận.</Text>}
              </Section>
            ) : null}

            {shown('vitals') && data.vitals.length ? (
              <View style={styles.stackSmall}>
                {isPartial('vitals') ? <PartialNote /> : null}
                <VitalsChart items={data.vitals} />
              </View>
            ) : null}

            {shown('visits') ? (
              <Section icon="clipboard" title="Lịch sử khám" count={data.visits.length || null} partial={isPartial('visits')}>
                {data.visits.length ? data.visits.map((v, i) => (
                  <Item key={i} title={`${fmtDate(v.date)}${v.reason ? `: ${v.reason}` : ''}`} sub={[v.visitType, v.doctor ? `bác sĩ ${v.doctor}` : null, v.status].filter(Boolean).join(', ')}>
                    <ItemBody kind="visits" item={v} />
                  </Item>
                )) : <Text style={styles.note}>Chưa có lượt khám.</Text>}
              </Section>
            ) : null}

            {shown('prescriptions') ? (
              <Section icon="package" title="Đơn thuốc" count={data.prescriptions.length || null} partial={isPartial('prescriptions')}>
                {data.prescriptions.length ? data.prescriptions.map((rx, i) => (
                  <Item key={i} title={`Đơn ngày ${fmtDate(rx.recorded_at)}`} sub={[rx.doctor_name ? `bác sĩ ${rx.doctor_name}` : null, rx.diagnosis ? `chẩn đoán ${rx.diagnosis}` : null].filter(Boolean).join(', ')}>
                    <ItemBody kind="prescriptions" item={rx} />
                  </Item>
                )) : <Text style={styles.note}>Chưa có đơn thuốc.</Text>}
              </Section>
            ) : null}

            {shown('labs') ? (
              <Section icon="droplet" title="Xét nghiệm" count={data.labs.length || null} partial={isPartial('labs')}>
                {data.labs.length ? data.labs.map((l, i) => (
                  <Item key={i} title={`${l.category || 'Xét nghiệm'}, ngày ${fmtDate(l.resulted_at || l.ordered_at)}`} sub={l.status}>
                    <ItemBody kind="labs" item={l} />
                  </Item>
                )) : <Text style={styles.note}>Chưa có kết quả xét nghiệm.</Text>}
              </Section>
            ) : null}

            {shown('inpatient') && data.inpatientRecords.length ? (
              <Section icon="folder" title="Bệnh án nội trú" count={data.inpatientRecords.length} partial={isPartial('inpatient')}>
                {data.inpatientRecords.map((r) => (
                  <Item key={r._id} title={`${r.department || 'Nội trú'}${r.diagnosis ? `: ${r.diagnosis}` : ''}`} sub={[r.doctorInCharge ? `bác sĩ ${r.doctorInCharge}` : null, r.status, r.dischargeDate ? `ra viện ${fmtDate(r.dischargeDate)}` : null].filter(Boolean).join(', ')}>
                    <ItemBody kind="inpatient" item={r} />
                  </Item>
                ))}
              </Section>
            ) : null}

            {shown('papers') && (data.dischargePapers.length || data.transferForms.length) ? (
              <Section icon="file-text" title="Giấy ra viện, chuyển viện" partial={isPartial('papers')}>
                {data.dischargePapers.map((d, i) => (
                  <Item key={`d${i}`} title={`Giấy ra viện ${fmtDate(d.dateOut || d.recorded_at)}`} sub={d.diagnosis}>
                    <ItemBody kind="discharge" item={d} />
                  </Item>
                ))}
                {data.transferForms.map((t, i) => (
                  <Item key={`t${i}`} title={`Chuyển viện ${fmtDate(t.recorded_at)}${t.transferTo ? ` đến ${t.transferTo}` : ''}`} sub={t.diagnosis}>
                    <ItemBody kind="transfer" item={t} />
                  </Item>
                ))}
              </Section>
            ) : null}

            {shown('documents') ? (
              <Section icon="camera" title="Giấy tờ bệnh nhân tự quét" count={data.scannedDocuments.length || null}>
                <Text style={styles.note}>Bệnh nhân tự chụp và tự kiểm tra phần chữ, chưa được bệnh viện xác nhận. Hãy đối chiếu với ảnh gốc. Bệnh nhân tự chọn giấy tờ để chia sẻ nên có thể còn giấy tờ khác.</Text>
                {data.scannedDocuments.length ? data.scannedDocuments.map((d) => (
                  <Item key={d._id} title={d.title} sub={`${hasStructuredInfo(d.fields) ? docTypeLabel(d.fields?.docType) : 'Giấy tờ dạng chữ'}, bệnh nhân chụp ngày ${fmtDate(d.createdAt)}`}>
                    <ItemBody kind="documents" item={d} />
                  </Item>
                )) : <Text style={styles.note}>Bệnh nhân chưa lưu giấy tờ nào.</Text>}
              </Section>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topbar}>
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} style={styles.back}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <View>
          <Text style={styles.brand}>NeuroScan AI</Text>
          <Text style={styles.topSub}>Bệnh án được chia sẻ</Text>
        </View>
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
  topbar: { backgroundColor: Colors.brandNavy, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  brand: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  topSub: { fontSize: 13, color: Colors.brandMint, marginTop: 2 },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 48, gap: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.infoText },
  stack: { gap: 16 },
  stackSmall: { gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 10 },
  patientName: { fontSize: 22, fontWeight: '800', color: Colors.brandNavy },
  allergy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.warningBg },
  allergyText: { flex: 1, fontSize: 15, color: Colors.warningText },
  bold: { fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  count: { fontSize: 13, fontWeight: '700', color: Colors.slateMuted, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  partial: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.infoBg },
  partialText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.infoText },
  tabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9 },
  tabOn: { backgroundColor: Colors.brandGreen },
  tabHover: { backgroundColor: Colors.brandGreenSoft },
  tabText: { fontSize: 15, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
  tabTextOn: { color: '#FFFFFF' },
  resultCount: { fontSize: 14, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  entry: { borderTopWidth: 1, borderTopColor: Colors.border },
  entryHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  entryHover: { backgroundColor: Colors.brandGreenSoft },
  entryIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  entrySub: { fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  entryMeta: { fontSize: 13, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  entryBody: { gap: 4, paddingLeft: 4, paddingBottom: 12 },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  state: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center', maxWidth: 420 },
});

export default SharedRecordScreen;
