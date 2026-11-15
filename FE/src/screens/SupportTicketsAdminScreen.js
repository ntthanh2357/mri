import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, put } from '../services/api.service';
import { WorkButton, WorkCard, WorkField, ChoiceChips, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';

// Quản trị nền tảng xử lý yêu cầu hỗ trợ kỹ thuật của mọi viện.

const STATUS = { open: 'Mới', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng' };
const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'open', label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
];
const NEXT_ACTIONS = {
  open: [{ status: 'in_progress', label: 'Nhận xử lý' }, { status: 'closed', label: 'Đóng' }],
  in_progress: [{ status: 'resolved', label: 'Đã giải quyết' }, { status: 'open', label: 'Trả về mới' }],
  resolved: [{ status: 'closed', label: 'Đóng' }, { status: 'in_progress', label: 'Mở lại' }],
  closed: [{ status: 'in_progress', label: 'Mở lại' }],
};

const SupportTicketsAdminScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/v1/support/tickets/all${filter ? `?status=${filter}` : ''}`);
      setTickets(res?.tickets || []);
    } catch (err) {
      notify('Không tải được yêu cầu', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (ticket, status) => {
    setBusyId(ticket._id);
    try {
      await put(`/api/v1/support/tickets/${ticket._id}/status`, { status, note: notes[ticket._id]?.trim() || undefined });
      await load();
    } catch (err) {
      notify('Chưa cập nhật được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="SupportTicketsAdmin">
      <View style={w.root}>
        <PageHeader
          bar
          title="Yêu cầu hỗ trợ"
          subtitle="Yêu cầu kỹ thuật từ người dùng các bệnh viện."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            <ChoiceChips options={FILTERS} value={filter} onChange={setFilter} />
            {loading ? <ActivityIndicator color={Colors.brandGreen} />
              : tickets.length === 0 ? <EmptyNote text="Không có yêu cầu nào." />
                : tickets.map((t) => (
                  <WorkCard key={t._id} tone={t.priority === 'high' && t.status === 'open' ? 'alert' : undefined}>
                    <View style={w.head}>
                      <Text style={w.title}>{t.topic || 'Yêu cầu hỗ trợ'}</Text>
                      <Text style={w.status}>{STATUS[t.status] || t.status}</Text>
                    </View>
                    <Text style={w.meta}>{personName(t.userId)} · {t.hospitalId?.name || 'Không gắn viện'} · {fmtDateTime(t.createdAt)}{t.priority === 'high' ? ' · Ưu tiên cao' : ''}</Text>
                    <Text style={w.body}>{t.message}</Text>
                    {t.note ? <Text style={w.meta}>Ghi chú: {t.note}</Text> : null}
                    <WorkField
                      label="Ghi chú xử lý"
                      value={notes[t._id] || ''}
                      onChangeText={(v) => setNotes((prev) => ({ ...prev, [t._id]: v }))}
                    />
                    <View style={w.actions}>
                      {(NEXT_ACTIONS[t.status] || []).map((a, i) => (
                        <WorkButton key={a.status} label={a.label} variant={i === 0 ? 'primary' : 'ghost'} busy={busyId === t._id} onPress={() => update(t, a.status)} />
                      ))}
                    </View>
                  </WorkCard>
                ))}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default SupportTicketsAdminScreen;
