import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post } from '../services/api.service';
import { WorkButton, WorkCard, WorkField, ChoiceChips, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';

// Hậu kiểm đơn thuốc phát khẩn và thống kê bác sĩ bỏ qua cảnh báo an toàn thuốc.

const DECISIONS = [
  { value: 'APPROVED', label: 'Phù hợp' },
  { value: 'FLAGGED_DEVIATION', label: 'Có sai lệch' },
];

const PharmacyOversightScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [decision, setDecision] = useState('APPROVED');
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, statRes] = await Promise.all([
        get('/api/drugs/queue?postHocOnly=true'),
        get('/api/drugs/audit/override-stats'),
      ]);
      setPending(queueRes?.data?.prescriptions || []);
      const rows = statRes?.data?.stats || statRes?.data || [];
      setStats(Array.isArray(rows) ? rows : []);
    } catch (err) {
      notify('Không tải được dữ liệu', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async (prescription) => {
    if (decision === 'FLAGGED_DEVIATION' && note.trim().length < 5) {
      notify('Thiếu nội dung', 'Vui lòng ghi rõ sai lệch đã phát hiện.', 'error');
      return;
    }
    setBusyId(prescription._id);
    try {
      await post(`/api/drugs/prescriptions/${prescription._id}/post-hoc-review`, { decision, note: note.trim() || undefined });
      notify('Đã lưu hậu kiểm', 'Kết quả hậu kiểm đã được ghi nhận.', 'success');
      setActiveId(null);
      setNote('');
      await load();
    } catch (err) {
      notify('Chưa lưu được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PharmacyOversight">
      <View style={w.root}>
        <PageHeader
          bar
          title="Hậu kiểm dược"
          subtitle="Đơn phát khẩn cần dược sĩ khác kiểm tra lại, và thống kê bỏ qua cảnh báo thuốc."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {loading ? <ActivityIndicator color={Colors.brandGreen} /> : (
              <>
                <Text style={w.section}>Đơn chờ hậu kiểm ({pending.length})</Text>
                {pending.length === 0 ? <EmptyNote text="Không có đơn nào chờ hậu kiểm." /> : pending.map((p) => (
                  <WorkCard key={p._id}>
                    <View style={w.head}>
                      <Text style={w.title}>{personName(p.patient_id)}</Text>
                      <Text style={w.meta}>{fmtDateTime(p.createdAt)}</Text>
                    </View>
                    <Text style={w.meta}>Bác sĩ: {personName(p.doctorId)}</Text>
                    <Text style={w.body}>{(p.drugs || []).map((d) => `${d.name} x${d.quantity}`).join(', ') || 'Không có dữ liệu thuốc'}</Text>
                    {p.clinicalSafety?.overrideReason ? <Text style={w.meta}>Lý do bỏ qua cảnh báo: {p.clinicalSafety.overrideReason}</Text> : null}
                    {activeId === p._id ? (
                      <View style={{ gap: 8 }}>
                        <ChoiceChips label="Kết quả hậu kiểm" options={DECISIONS} value={decision} onChange={setDecision} />
                        <WorkField label="Ghi chú" multiline value={note} onChangeText={setNote} />
                        <View style={w.actions}>
                          <WorkButton label="Lưu hậu kiểm" busy={busyId === p._id} onPress={() => submit(p)} />
                          <WorkButton label="Hủy" variant="ghost" onPress={() => setActiveId(null)} />
                        </View>
                      </View>
                    ) : (
                      <View style={w.actions}>
                        <WorkButton label="Hậu kiểm" onPress={() => { setDecision('APPROVED'); setNote(''); setActiveId(p._id); }} />
                      </View>
                    )}
                  </WorkCard>
                ))}

                <Text style={w.section}>Bác sĩ bỏ qua cảnh báo an toàn thuốc</Text>
                {stats.length === 0 ? <EmptyNote text="Chưa có đơn nào bỏ qua cảnh báo." /> : stats.map((row) => (
                  <WorkCard key={String(row.doctorId)} tone={row.alertFlag === 'HIGH_EMERGENCY_OVERRIDE_FREQUENCY' ? 'alert' : undefined}>
                    <View style={w.head}>
                      <Text style={w.title}>{row.doctorName || 'Bác sĩ'}</Text>
                      {row.alertFlag === 'HIGH_EMERGENCY_OVERRIDE_FREQUENCY' ? <Text style={w.statusAlert}>Tần suất cấp cứu cao</Text> : null}
                    </View>
                    <Text style={w.meta}>
                      Tổng {row.totalOverrides} lần · Cấp cứu {row.acuteEmergencyCount} ({Math.round(row.acuteEmergencyRate || 0)}%) · Lợi ích lớn hơn nguy cơ {row.benefitExceedsRiskCount} · Đã dung nạp trước đó {row.toleratedPreviouslyCount} · Không có thuốc thay thế {row.alternativeUnavailableCount} · Chờ hậu kiểm {row.pendingPostHocCount}
                    </Text>
                  </WorkCard>
                ))}
              </>
            )}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default PharmacyOversightScreen;
