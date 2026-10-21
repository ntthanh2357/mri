import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { HeartPulse, FlaskConical, Pill, IdCard, RefreshCw, Gauge, CalendarCheck } from 'lucide-react';
import { PatientPage, PatientHero, PatientTabs, HeroButton, SideCard, PATIENT_IMAGES, P } from '../components/patient/PatientUI';

// Mức tham khảo cho người lớn — trình bày bình tĩnh, chỉ để người bệnh hiểu con số của mình
const RANGES = [
  { label: 'Huyết áp', value: 'Dưới 120/80 mmHg' },
  { label: 'Mạch', value: '60 – 100 lần/phút' },
  { label: 'SpO₂', value: 'Từ 95% trở lên' },
  { label: 'BMI', value: '18,5 – 22,9 (người châu Á)' },
];
import Colors from '../constants/colors';
import { useMyHealth } from '../controllers/useMyHealth';
import IdentityForm from '../components/patient/IdentityForm';
import ReminderTimesCard from '../components/patient/ReminderTimesCard';
import { bpStatus, pulseStatus, spo2Status, labResultFlag, drugSchedule } from '../utils/myHealth';

const TABS = ['vitals', 'labs', 'prescriptions', 'profile'];
const LAB_CATEGORY = { HOA_SINH: 'Hóa sinh máu', HUYET_HOC: 'Huyết học' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');

// Lệch mức thường gặp: màu cam + chữ (không đỏ — trang bệnh nhân giữ giọng bình tĩnh)
const StatusPill = ({ status }) => {
  if (!status) return null;
  const ok = status.level === 'normal';
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillWarn]}>
      <Feather name={ok ? 'check-circle' : 'alert-circle'} size={13} color={ok ? Colors.successText : Colors.warningText} />
      <Text style={[styles.pillText, { color: ok ? Colors.successText : Colors.warningText }]}>{status.label}</Text>
    </View>
  );
};

const StateBox = ({ state, emptyIcon, emptyTitle, emptyHint, onRetry }) => {
  if (state.loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={Colors.brandGreen} />
        <Text style={styles.stateText}>Đang tải…</Text>
      </View>
    );
  }
  if (state.error) {
    return (
      <View style={styles.stateBox}>
        <Feather name="wifi-off" size={26} color={Colors.warningText} />
        <Text style={styles.stateTitle}>{state.error}</Text>
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retryBtn}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.stateBox}>
      <View style={styles.emptyIcon}><Feather name={emptyIcon} size={24} color={Colors.brandGreen} /></View>
      <Text style={styles.stateTitle}>{emptyTitle}</Text>
      <Text style={styles.stateText}>{emptyHint}</Text>
    </View>
  );
};

const Metric = ({ label, value, unit, status }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>
      {value}
      {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
    </Text>
    <StatusPill status={status} />
  </View>
);

const VitalsTab = ({ state, onRetry }) => {
  if (state.loading || state.error || state.items.length === 0) {
    return <StateBox state={state} onRetry={onRetry} emptyIcon="activity" emptyTitle="Chưa có lần đo sinh hiệu nào" emptyHint="Điều dưỡng sẽ đo huyết áp, mạch và SpO₂ khi bạn đến khám. Kết quả sẽ hiện ở đây." />;
  }
  const history = [...state.items].reverse(); // BE trả cũ → mới
  const latest = history[0];
  const bp = latest.blood_pressure;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lần đo gần nhất</Text>
        <Text style={styles.cardSub}>Ngày {fmtDate(latest.recorded_at)}</Text>
        <View style={styles.metrics}>
          <Metric label="Huyết áp" value={bp ? `${bp.systolic}/${bp.diastolic}` : '—'} unit="mmHg" status={bpStatus(bp)} />
          <Metric label="Mạch" value={latest.pulse ?? '—'} unit="lần/phút" status={pulseStatus(latest.pulse)} />
          <Metric label="SpO₂" value={latest.spo2 ?? '—'} unit="%" status={spo2Status(latest.spo2)} />
          {latest.weight ? <Metric label="Cân nặng" value={latest.weight} unit="kg" /> : null}
          {latest.bmi ? <Metric label="BMI" value={Number(latest.bmi).toFixed(1)} /> : null}
        </View>
      </View>

      {history.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Các lần đo trước</Text>
          {history.slice(1).map((v) => (
            <View key={v._id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{fmtDate(v.recorded_at)}</Text>
              <Text style={styles.historyText}>
                Huyết áp {v.blood_pressure?.systolic}/{v.blood_pressure?.diastolic}, mạch {v.pulse}, SpO₂ {v.spo2}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.note}>
        <Feather name="info" size={15} color={Colors.slateMuted} />
        <Text style={styles.noteText}>
          Các mức "bình thường" ở trên là mức tham khảo cho người lớn. Nếu bạn lo lắng về chỉ số của mình, hãy hỏi bác sĩ điều trị.
        </Text>
      </View>
    </View>
  );
};

const LabsTab = ({ state, onRetry }) => {
  if (state.loading || state.error || state.items.length === 0) {
    return <StateBox state={state} onRetry={onRetry} emptyIcon="droplet" emptyTitle="Chưa có phiếu xét nghiệm nào" emptyHint="Khi bác sĩ chỉ định xét nghiệm, phiếu và kết quả sẽ hiện ở đây." />;
  }
  return (
    <View style={styles.stack}>
      {state.items.map((o) => {
        const done = o.status === 'COMPLETED';
        const abnormal = (o.results || []).filter((r) => r.is_abnormal).length;
        return (
          <View key={o._id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{LAB_CATEGORY[o.category] || 'Xét nghiệm'}</Text>
                <Text style={styles.cardSub}>Chỉ định ngày {fmtDate(o.ordered_at)}{done ? `, có kết quả ngày ${fmtDate(o.resulted_at)}` : ''}</Text>
              </View>
              <View style={[styles.pill, done ? styles.pillOk : styles.pillInfo]}>
                <Feather name={done ? 'check-circle' : 'clock'} size={13} color={done ? Colors.successText : Colors.infoText} />
                <Text style={[styles.pillText, { color: done ? Colors.successText : Colors.infoText }]}>{done ? 'Đã có kết quả' : 'Đang chờ kết quả'}</Text>
              </View>
            </View>
            {done ? (
              <>
                <Text style={styles.summary}>
                  {abnormal === 0 ? 'Tất cả chỉ số nằm trong khoảng tham chiếu.' : `${abnormal} chỉ số nằm ngoài khoảng tham chiếu, bác sĩ sẽ giải thích khi tái khám.`}
                </Text>
                {(o.results || []).map((r) => (
                  <View key={r.biomarker_code} style={styles.resultRow}>
                    <View style={styles.grow}>
                      <Text style={styles.resultName}>{r.biomarker_name}</Text>
                      {r.reference_range_display ? <Text style={styles.resultRef}>Tham chiếu: {r.reference_range_display} {r.unit !== 'N/A' ? r.unit : ''}</Text> : null}
                    </View>
                    <View style={styles.resultRight}>
                      <Text style={styles.resultValue}>{r.value_result} <Text style={styles.metricUnit}>{r.unit !== 'N/A' ? r.unit : ''}</Text></Text>
                      <StatusPill status={labResultFlag(r)} />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const PrescriptionsTab = ({ state, onRetry }) => {
  if (state.loading || state.error || state.items.length === 0) {
    return <StateBox state={state} onRetry={onRetry} emptyIcon="package" emptyTitle="Chưa có đơn thuốc nào" emptyHint="Đơn thuốc bác sĩ kê sau mỗi lần khám sẽ hiện ở đây." />;
  }
  return (
    <View style={styles.stack}>
      {state.items.map((p) => (
        <View key={p._id} style={styles.card}>
          <Text style={styles.cardTitle}>Đơn thuốc ngày {fmtDate(p.recorded_at || p.createdAt)}</Text>
          <Text style={styles.cardSub}>{[p.doctor_name ? `Bác sĩ ${p.doctor_name}` : null, p.diagnosis ? `Chẩn đoán: ${p.diagnosis}` : null].filter(Boolean).join('. ')}</Text>
          {(p.drugs || []).map((d, i) => (
            <View key={`${d.name}-${i}`} style={styles.drugRow}>
              <View style={styles.drugIcon}><Feather name="disc" size={14} color={Colors.brandGreen} /></View>
              <View style={styles.grow}>
                <Text style={styles.drugName}>{d.name} <Text style={styles.drugQty}>({d.quantity} {d.unit})</Text></Text>
                {d.usage ? <Text style={styles.drugUsage}>{d.usage}</Text> : null}
                {drugSchedule(d) ? <Text style={styles.drugSchedule}>{drugSchedule(d)}</Text> : null}
              </View>
            </View>
          ))}
          {p.note ? (
            <View style={styles.adviceBox}>
              <Text style={styles.adviceLabel}>Lời dặn của bác sĩ</Text>
              <Text style={styles.adviceText}>{p.note}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const MyHealthScreen = ({ navigation, route }) => {
  const initial = TABS.includes(route?.params?.tab) ? route.params.tab : 'vitals';
  const [tab, setTab] = useState(initial);
  const { vitals, labs, prescriptions, reload, identity, reloadIdentity, saveIdentity } = useMyHealth();
  const reloadAll = () => { reload(); reloadIdentity(); };
  const { width } = useWindowDimensions();
  const isWide = width > 1100;
  const lastVital = vitals.items.length ? vitals.items[vitals.items.length - 1] : null;
  const pendingLabs = labs.items.filter((o) => o.status !== 'COMPLETED').length;

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MyHealth">
      <PatientPage>
        <PatientHero
          image={PATIENT_IMAGES.tabletScan}
          eyebrow="Sức khỏe của tôi"
          title="Theo dõi sức khỏe mỗi ngày"
          subtitle="Sinh hiệu, xét nghiệm, đơn thuốc từ các lần khám và hồ sơ cá nhân của bạn — tất cả ở một nơi."
          stats={[
            { value: vitals.items.length, label: 'lần đo sinh hiệu' },
            { value: labs.items.length, label: 'phiếu xét nghiệm' },
            { value: prescriptions.items.length, label: 'đơn thuốc' },
          ]}
        >
          <HeroButton icon={RefreshCw} label="Tải lại" onPress={reloadAll} ghost />
        </PatientHero>

        <PatientTabs
          tabs={[
            { key: 'vitals', label: 'Sinh hiệu', icon: HeartPulse },
            { key: 'labs', label: 'Xét nghiệm', icon: FlaskConical, count: labs.items.length },
            { key: 'prescriptions', label: 'Đơn thuốc', icon: Pill, count: prescriptions.items.length },
            { key: 'profile', label: 'Hồ sơ & BHYT', icon: IdCard },
          ]}
          value={tab}
          onChange={setTab}
        />

        <View style={[styles.columns, isWide && styles.columnsWide]}>
          <View style={[styles.mainCol, isWide && { flex: 1.7 }]}>
            {tab === 'vitals' && <VitalsTab state={vitals} onRetry={reload} />}
            {tab === 'labs' && <LabsTab state={labs} onRetry={reload} />}
            {tab === 'prescriptions' && (
              <View style={styles.stack}>
                <ReminderTimesCard />
                <PrescriptionsTab state={prescriptions} onRetry={reload} />
              </View>
            )}
            {tab === 'profile' && <IdentityForm state={identity} onSave={saveIdentity} onRetry={reloadIdentity} />}
          </View>

          <View style={[styles.sideCol, isWide && { flex: 1 }]}>
            <SideCard icon={Gauge} title="Hiểu chỉ số của bạn" subtitle="Mức tham khảo cho người lớn" tone="navy">
              {RANGES.map((r) => (
                <View key={r.label} style={styles.rangeRow}>
                  <Text style={styles.rangeLabel}>{r.label}</Text>
                  <Text style={styles.rangeValue}>{r.value}</Text>
                </View>
              ))}
            </SideCard>
            <SideCard icon={CalendarCheck} title="Tóm tắt gần đây" tone="mint">
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Lần đo sinh hiệu gần nhất</Text>
                <Text style={styles.sumValue}>{lastVital ? fmtDate(lastVital.recorded_at) : '—'}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Xét nghiệm đang chờ kết quả</Text>
                <Text style={styles.sumValue}>{pendingLabs}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Đơn thuốc đã nhận</Text>
                <Text style={styles.sumValue}>{prescriptions.items.length}</Text>
              </View>
              <Text style={styles.sumNote}>Lo lắng về chỉ số nào? Hãy hỏi bác sĩ điều trị ở lần tái khám tới.</Text>
            </SideCard>
          </View>
        </View>
      </PatientPage>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { gap: 16 },
  sideCol: { gap: 16 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  rangeLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  rangeValue: { fontSize: 13, color: P.mint, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  sumLabel: { fontSize: 13, color: '#334155', flexShrink: 1 },
  sumValue: { fontSize: 14, fontWeight: '800', color: P.navy, fontVariant: ['tabular-nums'] },
  sumNote: { fontSize: 12, lineHeight: 18, color: P.muted, marginTop: 4 },
  stack: { gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  cardSub: { fontSize: 14, color: Colors.secondary, marginBottom: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metric: { flexGrow: 1, flexBasis: 128, gap: 6, padding: 16, borderRadius: 16, backgroundColor: '#F4F7FB', borderWidth: 1, borderColor: '#E8EEF6' },
  metricLabel: { fontSize: 14, color: Colors.slateMuted },
  metricValue: { fontSize: 24, fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 14, fontWeight: '500', color: Colors.secondary },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillOk: { backgroundColor: Colors.successBg },
  pillWarn: { backgroundColor: Colors.warningBg },
  pillInfo: { backgroundColor: Colors.infoBg },
  pillText: { fontSize: 13, fontWeight: '600' },
  historyRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, gap: 2 },
  historyDate: { fontSize: 14, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  historyText: { fontSize: 15, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  summary: { fontSize: 15, color: Colors.slateDark, marginBottom: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  resultName: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  resultRef: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  resultRight: { alignItems: 'flex-end', gap: 4 },
  resultValue: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  drugRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  drugIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  drugName: { fontSize: 16, fontWeight: '700', color: Colors.slateDark },
  drugQty: { fontSize: 14, fontWeight: '500', color: Colors.secondary },
  drugUsage: { fontSize: 15, color: Colors.slateMuted, marginTop: 2 },
  drugSchedule: { fontSize: 14, color: Colors.brandGreen, fontWeight: '600', marginTop: 2 },
  adviceBox: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.warningBg },
  adviceLabel: { fontSize: 13, fontWeight: '700', color: Colors.warningText, marginBottom: 2 },
  adviceText: { fontSize: 15, color: Colors.slateDark, lineHeight: 21 },
  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
  stateText: { fontSize: 15, color: Colors.secondary, textAlign: 'center', maxWidth: 420, lineHeight: 21 },
  retryBtn: { marginTop: 4, height: 40, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen, justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default MyHealthScreen;
