import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post, put } from '../services/api.service';
import { WorkButton, WorkCard, StatTiles, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';
import { canUpdateTask } from '../utils/taskPermission';

// Công việc theo ca: các bước của từng lượt khám, phân theo vai trò, kèm số liệu tổng quan ca trực.

const COLUMNS = [
  { key: 'pending', label: 'Chờ làm' },
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'completed', label: 'Đã xong' },
];
const DEADLINE_ROLES = ['hospital_admin', 'department_head'];

const TaskBoardScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState({ pending: [], in_progress: [], completed: [] });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kanban, shift] = await Promise.all([
        get('/api/v1/tasks/kanban'),
        get('/api/v1/tasks/shift-overview'),
      ]);
      const data = kanban?.data?.kanban || kanban?.data || {};
      setBoard({ pending: data.pending || [], in_progress: data.in_progress || [], completed: data.completed || [] });
      setOverview(shift?.data || null);
    } catch (err) {
      notify('Không tải được công việc', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { get('/auth/me').then((res) => setMe(res?.user || null)).catch(() => {}); }, []);

  const updateStatus = async (task, status) => {
    setBusyId(task._id);
    try {
      await put(`/api/v1/tasks/${task._id}/status`, { status });
      await load();
    } catch (err) {
      notify('Chưa cập nhật được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const checkDeadlines = async () => {
    setBusyId('deadlines');
    try {
      const res = await post('/api/v1/tasks/check-deadlines', {});
      notify('Đã kiểm tra', res?.message || 'Đã kiểm tra các công việc quá hạn.', 'success');
      await load();
    } catch (err) {
      notify('Chưa kiểm tra được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderTask = (task) => {
    const overdue = task.status !== 'completed' && task.deadlineAt && new Date(task.deadlineAt) < new Date();
    const emergency = task.visitId?.priority === 'khẩn cấp';
    return (
      <WorkCard key={task._id} tone={overdue || emergency ? 'alert' : undefined}>
        <View style={w.head}>
          <Text style={w.title}>Bước {task.stepNumber}: {task.title}</Text>
          {overdue ? <Text style={w.statusAlert}>Quá hạn</Text> : emergency ? <Text style={w.statusAlert}>Cấp cứu</Text> : null}
        </View>
        <Text style={w.meta}>Bệnh nhân: {personName(task.patientId)}{task.assignedToUserId ? ` · Phụ trách: ${personName(task.assignedToUserId)}` : ''}</Text>
        {task.deadlineAt ? <Text style={w.meta}>Hạn: {fmtDateTime(task.deadlineAt)}</Text> : null}
        {canUpdateTask(task, me) ? (
          <View style={w.actions}>
            {task.status === 'pending' ? <WorkButton label="Bắt đầu" busy={busyId === task._id} onPress={() => updateStatus(task, 'in_progress')} /> : null}
            {task.status === 'in_progress' ? <WorkButton label="Hoàn thành" busy={busyId === task._id} onPress={() => updateStatus(task, 'completed')} /> : null}
            {task.status === 'pending' ? <WorkButton label="Bỏ qua bước này" variant="ghost" disabled={busyId === task._id} onPress={() => updateStatus(task, 'skipped')} /> : null}
            {task.status === 'in_progress' ? <WorkButton label="Trả về chờ" variant="ghost" disabled={busyId === task._id} onPress={() => updateStatus(task, 'pending')} /> : null}
          </View>
        ) : task.status !== 'completed' && me ? (
          <Text style={w.meta}>{task.roleRequired === 'auto' ? 'Bước do hệ thống tự cập nhật.' : 'Bước này do người khác phụ trách.'}</Text>
        ) : null}
      </WorkCard>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="TaskBoard">
      <View style={w.root}>
        <PageHeader
          bar
          title="Công việc ca trực"
          subtitle="Các bước của từng lượt khám thuộc vai trò của bạn."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {overview ? (
              <StatTiles items={[
                { label: 'Lượt khám hôm nay', value: overview.totalVisitsToday ?? 0 },
                { label: 'Đang xử lý', value: overview.activeVisits ?? 0 },
                { label: 'Ca cấp cứu', value: overview.emergencyVisits ?? 0 },
                { label: 'Công việc quá hạn', value: overview.overdueTasksCount ?? 0 },
              ]} />
            ) : null}
            {DEADLINE_ROLES.includes(me?.role) ? (
              <View style={w.actions}>
                <WorkButton label="Kiểm tra công việc quá hạn" variant="ghost" busy={busyId === 'deadlines'} onPress={checkDeadlines} />
              </View>
            ) : null}
            {loading ? <ActivityIndicator color={Colors.brandGreen} /> : COLUMNS.map((col) => (
              <View key={col.key} style={{ gap: 8 }}>
                <Text style={w.section}>{col.label} ({board[col.key].length})</Text>
                {board[col.key].length === 0
                  ? <Text style={w.meta}>Không có công việc.</Text>
                  : board[col.key].slice(0, 50).map(renderTask)}
              </View>
            ))}
            {!loading && COLUMNS.every((c) => board[c.key].length === 0) ? <EmptyNote text="Chưa có công việc nào cho vai trò của bạn." /> : null}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default TaskBoardScreen;
