import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post, put, del } from '../services/api.service';
import { WorkButton, WorkCard, WorkField, ChoiceChips, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';

// Phòng máy MRI: Ban Giám đốc quản lý phòng; nhân sự chụp xem lịch tuần và giải phóng phòng sau ca chụp.

const ROOM_STATUS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'inactive', label: 'Ngưng dùng' },
];
const SLOT_STATUS = { booked: 'Đã đặt', in_progress: 'Đang chụp', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
const RELEASE_ROLES = ['technician', 'radiologist', 'doctor', 'department_head', 'hospital_admin'];
const emptyRoom = { name: '', modelMachine: '', location: '', status: 'active', maxSlotsPerDay: '16', slotDurationMinutes: '30' };

const mondayOf = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const isoDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const MriRoomsScreen = ({ navigation }) => {
  const { dialog, confirm, notify } = useAppDialog();
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | room id
  const [form, setForm] = useState(emptyRoom);

  const canManage = me?.role === 'hospital_admin';
  const canRelease = RELEASE_ROLES.includes(me?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRes, weekRes] = await Promise.all([
        get('/api/v1/mri-rooms'),
        get(`/api/v1/mri-rooms/schedule/weekly?weekStart=${isoDate(weekStart)}`),
      ]);
      setRooms(roomRes?.data || []);
      setSchedule(weekRes?.data?.schedule || []);
    } catch (err) {
      notify('Không tải được phòng máy', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [weekStart, notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { get('/auth/me').then((res) => setMe(res?.user || null)).catch(() => {}); }, []);

  const startEdit = (room) => {
    setEditing(room ? room._id : 'new');
    setForm(room ? {
      name: room.name || '',
      modelMachine: room.modelMachine || '',
      location: room.location || '',
      status: room.status || 'active',
      maxSlotsPerDay: String(room.maxSlotsPerDay ?? 16),
      slotDurationMinutes: String(room.slotDurationMinutes ?? 30),
    } : emptyRoom);
  };

  const saveRoom = async () => {
    if (!form.name.trim()) {
      notify('Thiếu tên phòng', 'Vui lòng nhập tên phòng MRI.', 'error');
      return;
    }
    const maxSlots = Number(form.maxSlotsPerDay);
    const duration = Number(form.slotDurationMinutes);
    if (!(maxSlots > 0) || !(duration > 0)) {
      notify('Dữ liệu chưa đúng', 'Số ca mỗi ngày và thời lượng mỗi ca phải lớn hơn 0.', 'error');
      return;
    }
    const body = { ...form, name: form.name.trim(), maxSlotsPerDay: maxSlots, slotDurationMinutes: duration };
    setBusy('save');
    try {
      if (editing === 'new') await post('/api/v1/mri-rooms', body);
      else await put(`/api/v1/mri-rooms/${editing}`, body);
      notify('Đã lưu', 'Đã cập nhật phòng MRI.', 'success');
      setEditing(null);
      await load();
    } catch (err) {
      notify('Chưa lưu được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeRoom = async (room) => {
    const ok = await confirm({
      title: 'Xóa phòng MRI',
      message: `Xóa ${room.name}?`,
      note: 'Hệ thống sẽ từ chối nếu phòng còn lịch chụp chưa hoàn tất.',
      confirmText: 'Xóa phòng',
      type: 'danger',
    });
    if (!ok) return;
    setBusy(room._id);
    try {
      await del(`/api/v1/mri-rooms/${room._id}`);
      await load();
    } catch (err) {
      notify('Chưa xóa được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const releaseSlot = async (slot) => {
    const ok = await confirm({
      title: 'Giải phóng phòng',
      message: `Kết thúc ca lúc ${fmtDateTime(slot.startTime)} và mở phòng cho ca tiếp theo?`,
      confirmText: 'Giải phóng',
      type: 'info',
    });
    if (!ok) return;
    setBusy(slot._id);
    try {
      await put(`/api/v1/mri-rooms/slots/${slot._id}/release`, {});
      await load();
    } catch (err) {
      notify('Chưa giải phóng được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const shiftWeek = (days) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    setWeekStart(next);
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MriRooms">
      <View style={w.root}>
        <PageHeader
          bar
          title="Phòng máy MRI"
          subtitle="Danh sách phòng và lịch chụp theo tuần."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {canManage ? (
              <View style={w.actions}>
                <WorkButton label="Thêm phòng MRI" onPress={() => startEdit(null)} />
              </View>
            ) : null}

            {editing ? (
              <WorkCard>
                <Text style={w.title}>{editing === 'new' ? 'Thêm phòng MRI' : 'Sửa phòng MRI'}</Text>
                <WorkField label="Tên phòng" value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} />
                <WorkField label="Model máy" value={form.modelMachine} onChangeText={(v) => setForm((p) => ({ ...p, modelMachine: v }))} />
                <WorkField label="Vị trí" value={form.location} onChangeText={(v) => setForm((p) => ({ ...p, location: v }))} />
                <WorkField label="Số ca tối đa mỗi ngày" keyboardType="numeric" value={form.maxSlotsPerDay} onChangeText={(v) => setForm((p) => ({ ...p, maxSlotsPerDay: v }))} />
                <WorkField label="Thời lượng mỗi ca (phút)" keyboardType="numeric" value={form.slotDurationMinutes} onChangeText={(v) => setForm((p) => ({ ...p, slotDurationMinutes: v }))} />
                <ChoiceChips label="Trạng thái" options={ROOM_STATUS} value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} />
                <View style={w.actions}>
                  <WorkButton label="Lưu" busy={busy === 'save'} onPress={saveRoom} />
                  <WorkButton label="Hủy" variant="ghost" onPress={() => setEditing(null)} />
                </View>
              </WorkCard>
            ) : null}

            {loading ? <ActivityIndicator color={Colors.brandGreen} /> : rooms.length === 0 ? (
              <EmptyNote text="Viện chưa có phòng MRI nào." />
            ) : rooms.map((room) => (
              <WorkCard key={room._id}>
                <View style={w.head}>
                  <Text style={w.title}>{room.name}</Text>
                  <Text style={room.status === 'active' ? w.status : w.statusAlert}>{ROOM_STATUS.find((s) => s.value === room.status)?.label || room.status}</Text>
                </View>
                <Text style={w.meta}>{[room.modelMachine, room.location].filter(Boolean).join(' · ') || 'Chưa có thông tin máy'}</Text>
                <Text style={w.meta}>{room.maxSlotsPerDay} ca/ngày · {room.slotDurationMinutes} phút/ca</Text>
                {canManage ? (
                  <View style={w.actions}>
                    <WorkButton label="Sửa" variant="ghost" onPress={() => startEdit(room)} />
                    <WorkButton label="Xóa" variant="ghost" busy={busy === room._id} onPress={() => removeRoom(room)} />
                  </View>
                ) : null}
              </WorkCard>
            ))}

            <Text style={w.section}>Lịch tuần {isoDate(weekStart)} đến {isoDate(weekEnd)}</Text>
            <View style={w.actions}>
              <WorkButton label="Tuần trước" variant="ghost" onPress={() => shiftWeek(-7)} />
              <WorkButton label="Tuần này" variant="ghost" onPress={() => setWeekStart(mondayOf(new Date()))} />
              <WorkButton label="Tuần sau" variant="ghost" onPress={() => shiftWeek(7)} />
            </View>
            {!loading && schedule.map(({ room, slots }) => (
              <WorkCard key={room._id}>
                <Text style={w.title}>{room.name}</Text>
                {slots.filter((slot) => slot.status !== 'available').length === 0 ? <Text style={w.meta}>Không có lịch chụp trong tuần.</Text> : slots.filter((slot) => slot.status !== 'available').map((slot) => (
                  <View key={slot._id} style={[w.head, { alignItems: 'center' }]}>
                    <Text style={[w.meta, { flex: 1, minWidth: 180 }]}>
                      {fmtDateTime(slot.startTime)} · {personName(slot.patientId)} · {SLOT_STATUS[slot.status] || slot.status}{slot.priority === 1 ? ' · Cấp cứu' : ''}
                    </Text>
                    {canRelease && ['booked', 'in_progress'].includes(slot.status)
                      ? <WorkButton label="Giải phóng phòng" variant="ghost" busy={busy === slot._id} onPress={() => releaseSlot(slot)} />
                      : null}
                  </View>
                ))}
              </WorkCard>
            ))}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default MriRoomsScreen;
