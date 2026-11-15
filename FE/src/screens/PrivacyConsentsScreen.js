import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post } from '../services/api.service';
import { WorkButton, WorkCard, WorkField, ChoiceChips, EmptyNote, fmtDateTime, workStyles as w } from '../components/staff/WorkUI';

// Người bệnh xem, tạo và rút lại đồng ý xử lý dữ liệu cá nhân.

const PURPOSES = [
  { key: 'medicalCareAndEmr', label: 'Khám chữa bệnh và lưu hồ sơ bệnh án', locked: true },
  { key: 'aiAssistedAnalysis', label: 'AI hỗ trợ phân tích hình ảnh' },
  { key: 'cloudStorageBackup', label: 'Sao lưu hồ sơ lên hệ thống đám mây' },
  { key: 'scientificResearchAnonymized', label: 'Nghiên cứu khoa học, dữ liệu đã ẩn danh' },
];
const STATUS = { granted: 'Đang có hiệu lực', partially_revoked: 'Đã rút một phần', fully_revoked: 'Đã rút toàn bộ' };
const RELATIONSHIPS = ['Bản thân', 'Người giám hộ', 'Đại diện hợp pháp'].map((v) => ({ value: v, label: v }));
const REVOKE_TYPES = [{ value: 'partially', label: 'Rút một phần' }, { value: 'fully', label: 'Rút toàn bộ' }];
const defaultPurposes = { medicalCareAndEmr: true, aiAssistedAnalysis: true, cloudStorageBackup: true, scientificResearchAnonymized: false };

const PrivacyConsentsScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [purposes, setPurposes] = useState(defaultPurposes);
  const [signerName, setSignerName] = useState('');
  const [relationship, setRelationship] = useState('Bản thân');
  const [nationalId, setNationalId] = useState('');
  const [revokingId, setRevokingId] = useState(null);
  const [revokeType, setRevokeType] = useState('fully');
  const [revokeReason, setRevokeReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/emr/privacy-consents');
      const rows = res?.data || res?.consents || [];
      setConsents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      notify('Không tải được dữ liệu', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    get('/auth/me').then((res) => setSignerName(res?.user?.profile?.fullName || res?.user?.profile?.name || '')).catch(() => {});
  }, []);

  const create = async () => {
    if (!signerName.trim()) {
      notify('Thiếu thông tin', 'Vui lòng nhập họ tên người ký.', 'error');
      return;
    }
    setBusy(true);
    try {
      await post('/emr/privacy-consents', {
        purposes,
        signerName: signerName.trim(),
        signerNationalId: nationalId.trim() || undefined,
        signerRelationship: relationship,
      });
      notify('Đã ghi nhận', 'Đã lưu đồng ý xử lý dữ liệu của bạn.', 'success');
      setCreating(false);
      setNationalId('');
      await load();
    } catch (err) {
      notify('Chưa lưu được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (consent) => {
    setBusy(true);
    try {
      await post(`/emr/privacy-consents/${consent._id}/revoke`, { revokeType, reason: revokeReason.trim() || undefined });
      notify('Đã rút đồng ý', 'Yêu cầu của bạn đã được ghi nhận.', 'success');
      setRevokingId(null);
      setRevokeReason('');
      await load();
    } catch (err) {
      notify('Chưa thực hiện được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PrivacyConsents">
      <View style={w.root}>
        <PageHeader
          bar
          title="Dữ liệu cá nhân của tôi"
          subtitle="Bạn có quyền xem và rút lại đồng ý bất cứ lúc nào."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {!creating ? (
              <View style={w.actions}>
                <WorkButton label="Tạo đồng ý mới" onPress={() => { setPurposes(defaultPurposes); setCreating(true); }} />
              </View>
            ) : (
              <WorkCard>
                <Text style={w.title}>Đồng ý xử lý dữ liệu cá nhân</Text>
                {PURPOSES.map((p) => (
                  <View key={p.key} style={[w.head, { alignItems: 'center' }]}>
                    <Text style={[w.body, { flex: 1, minWidth: 200 }]}>{p.label}{p.locked ? ' (bắt buộc để khám chữa bệnh)' : ''}</Text>
                    <Switch
                      value={purposes[p.key]}
                      disabled={p.locked}
                      accessibilityLabel={p.label}
                      onValueChange={(v) => setPurposes((prev) => ({ ...prev, [p.key]: v }))}
                    />
                  </View>
                ))}
                <WorkField label="Họ tên người ký" value={signerName} onChangeText={setSignerName} />
                <ChoiceChips label="Quan hệ với người bệnh" options={RELATIONSHIPS} value={relationship} onChange={setRelationship} />
                <WorkField label="Số CCCD (không bắt buộc)" keyboardType="number-pad" value={nationalId} onChangeText={setNationalId} />
                <View style={w.actions}>
                  <WorkButton label="Xác nhận đồng ý" busy={busy} onPress={create} />
                  <WorkButton label="Hủy" variant="ghost" onPress={() => setCreating(false)} />
                </View>
              </WorkCard>
            )}

            {loading ? <ActivityIndicator color={Colors.brandGreen} />
              : consents.length === 0 ? <EmptyNote text="Bạn chưa có bản đồng ý nào." />
                : consents.map((c) => (
                  <WorkCard key={c._id}>
                    <View style={w.head}>
                      <Text style={w.title}>Ký ngày {fmtDateTime(c.signedAt || c.createdAt)}</Text>
                      <Text style={c.consentStatus === 'granted' ? w.status : w.statusAlert}>{STATUS[c.consentStatus] || c.consentStatus}</Text>
                    </View>
                    {PURPOSES.map((p) => (
                      <Text key={p.key} style={w.meta}>{c.purposes?.[p.key] ? 'Đồng ý' : 'Không đồng ý'}: {p.label}</Text>
                    ))}
                    <Text style={w.meta}>Người ký: {c.signerName}{c.signerRelationship ? ` (${c.signerRelationship})` : ''}</Text>
                    {c.revokedAt ? <Text style={w.meta}>Rút ngày {fmtDateTime(c.revokedAt)}: {c.revocationReason}</Text> : null}
                    {c.consentStatus !== 'fully_revoked' ? (
                      revokingId === c._id ? (
                        <View style={{ gap: 8 }}>
                          <ChoiceChips label="Phạm vi rút" options={REVOKE_TYPES} value={revokeType} onChange={setRevokeType} />
                          <WorkField label="Lý do" value={revokeReason} onChangeText={setRevokeReason} />
                          <View style={w.actions}>
                            <WorkButton label="Xác nhận rút đồng ý" variant="danger" busy={busy} onPress={() => revoke(c)} />
                            <WorkButton label="Hủy" variant="ghost" onPress={() => setRevokingId(null)} />
                          </View>
                        </View>
                      ) : (
                        <View style={w.actions}>
                          <WorkButton label="Rút lại đồng ý" variant="ghost" onPress={() => { setRevokeType('fully'); setRevokeReason(''); setRevokingId(c._id); }} />
                        </View>
                      )
                    ) : null}
                  </WorkCard>
                ))}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default PrivacyConsentsScreen;
