import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get } from '../services/api.service';
import { WorkButton, WorkCard, ChoiceChips, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';

// Lịch sử các sự kiện cấp cứu của viện, phục vụ hậu kiểm.

const PAGE_SIZE = 20;
const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'in_progress', label: 'Đang xử trí' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'cancelled', label: 'Báo nhầm' },
];
const STATUS = {
  active: 'Đang kích hoạt',
  triggered: 'Đã phát lệnh',
  acknowledged: 'Kíp trực đã nhận',
  in_progress: 'Đang xử trí',
  escalated: 'Đã leo thang',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  cancelled: 'Báo nhầm',
};

const EmergencyHistoryScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/v1/emergency/history?page=${page}&limit=${PAGE_SIZE}${filter ? `&status=${filter}` : ''}`);
      setAlerts(res?.data?.alerts || []);
      setTotal(res?.data?.total || 0);
    } catch (err) {
      notify('Không tải được lịch sử', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filter, notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="EmergencyHistory">
      <View style={w.root}>
        <PageHeader
          bar
          title="Lịch sử cấp cứu"
          subtitle={`${total} sự kiện`}
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            <ChoiceChips options={FILTERS} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />
            {loading ? <ActivityIndicator color={Colors.brandGreen} />
              : alerts.length === 0 ? <EmptyNote text="Không có sự kiện cấp cứu nào." />
                : alerts.map((alert) => {
                  const open = expanded === alert._id;
                  const location = [alert.location?.department, alert.location?.roomNumber, alert.location?.bedNumber].filter(Boolean).join(' · ');
                  return (
                    <WorkCard key={alert._id} tone={alert.level === 'RED' && !['closed', 'cancelled', 'resolved'].includes(alert.status) ? 'alert' : undefined}>
                      <View style={w.head}>
                        <Text style={w.title}>{personName(alert.patientId)} · Mức {alert.level === 'RED' ? 'Đỏ' : alert.level === 'ORANGE' ? 'Cam' : alert.level}</Text>
                        <Text style={w.status}>{STATUS[alert.status] || alert.status}</Text>
                      </View>
                      <Text style={w.meta}>{fmtDateTime(alert.triggeredAt)}{location ? ` · ${location}` : ''} · Kích hoạt bởi {personName(alert.triggeredByUserId)}</Text>
                      {alert.triggerReason ? <Text style={w.body}>{alert.triggerReason}</Text> : null}
                      {open ? (alert.timelineMilestones || []).map((m, i) => (
                        <Text key={i} style={w.meta}>{fmtDateTime(m.timestamp)} · {m.action}{m.performedByName ? ` · ${m.performedByName}` : ''}</Text>
                      )) : null}
                      <View style={w.actions}>
                        <WorkButton label={open ? 'Ẩn diễn biến' : 'Xem diễn biến'} variant="ghost" onPress={() => setExpanded(open ? null : alert._id)} />
                      </View>
                    </WorkCard>
                  );
                })}
            <View style={[w.actions, { alignItems: 'center' }]}>
              <WorkButton label="Trang trước" variant="ghost" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
              <Text style={w.meta}>Trang {page}/{pageCount}</Text>
              <WorkButton label="Trang sau" variant="ghost" disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)} />
            </View>
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default EmergencyHistoryScreen;
