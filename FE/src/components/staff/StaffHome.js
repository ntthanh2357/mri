import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import Layout from '../../constants/layout';
import PageContainer from '../layout/PageContainer';
import PageHeader, { HeaderAction } from '../layout/PageHeader';
import ClinicalStatusBadge from '../ClinicalStatusBadge';
import useStaffHome from '../../controllers/useStaffHome';
import { SHIFT_LABELS } from '../../utils/staffTasks';

const ROLE_LABEL = {
  doctor: 'Bác sĩ',
  technician: 'Kỹ thuật viên chẩn đoán hình ảnh',
  nurse: 'Điều dưỡng',
  receptionist: 'Tiếp đón & thu ngân',
};
// 1 hành động chính mỗi role — phần còn lại đã có ở menu bên trái
const PRIMARY_ACTION = {
  doctor: { label: 'Mở hàng đợi khám', icon: 'activity', route: 'DoctorWorkQueue', params: { tab: 'examQueue' } },
  technician: { label: 'Nhập kết quả chụp', icon: 'upload-cloud', route: 'CreateImagingResult' },
  nurse: { label: 'Tạo lượt khám', icon: 'user-plus', route: 'NurseReception', params: { tab: 'createVisit' } },
  receptionist: { label: 'Tạo lượt khám', icon: 'user-plus', route: 'NurseReception', params: { tab: 'createVisit' } },
};
const NEXT_TITLE = {
  doctor: 'Bệnh nhân tiếp theo',
  technician: 'Ca chụp tiếp theo',
  nurse: 'Chờ đo sinh hiệu',
  receptionist: 'Lượt khám đang mở',
};
const MRI_STATUSES = ['chờ chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật', 'đang chụp', 'chờ kết quả AI', 'chờ bác sĩ đọc'];

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
};
// "TS.BS Nguyễn A (Trưởng khoa X)" → "TS.BS Nguyễn A"
const shortName = (name = '') => String(name).replace(/\s*\(.*\)\s*$/, '').trim();
// Giờ nếu là hôm nay, kèm ngày nếu là ca tồn từ hôm trước
const fmtTime = (d) => {
  const t = new Date(d);
  const opts = t.toDateString() === new Date().toDateString()
    ? { hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' };
  return t.toLocaleString('vi-VN', opts);
};

const Loading = () => (
  <View style={styles.empty}>
    <ActivityIndicator size="small" color={Colors.brandGreen} />
    <Text style={styles.emptyText}>Đang tải…</Text>
  </View>
);

const StaffHome = ({ user, navigation, onEditProfile }) => {
  const { width } = useWindowDimensions();
  const wide = width >= Layout.wide;
  const { loading, schedule, tasks, nextUp } = useStaffHome(user);
  const role = user.role;
  const primary = PRIMARY_ACTION[role];
  const pendingCount = tasks.filter(t => t.count > 0).length;
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const openVisit = (v) => {
    if (role === 'receptionist') return navigation.navigate('NurseReception', { tab: 'myQueue' });
    return navigation.navigate('DoctorWorkQueue', { tab: MRI_STATUSES.includes(v.status) ? 'mriQueue' : 'examQueue' });
  };

  return (
    <ScrollView>
      <PageContainer style={styles.page}>
        <PageHeader
          title={`${greeting()}, ${shortName(user.profile?.name) || 'bạn'}`}
          subtitle={`${ROLE_LABEL[role] || 'Nhân viên'} · ${today}`}
          actions={
            <>
              <HeaderAction icon="user" label="Hồ sơ cá nhân" onPress={onEditProfile} />
              {primary ? (
                <HeaderAction variant="primary" icon={primary.icon} label={primary.label} onPress={() => navigation.navigate(primary.route, primary.params)} />
              ) : null}
            </>
          }
        />

        <View style={styles.shift}>
          <Feather name="clock" size={16} color={Colors.brandGreen} />
          <Text style={styles.shiftText}>
            {schedule ? (
              <>
                Ca trực hôm nay: <Text style={styles.shiftStrong}>{SHIFT_LABELS[schedule.shift] || schedule.shift}</Text>
                {schedule.startTime ? ` · ${schedule.startTime}–${schedule.endTime}` : ''}
              </>
            ) : loading ? 'Đang tải ca trực…' : 'Hôm nay bạn không có ca trực.'}
          </Text>
          <Pressable onPress={() => navigation.navigate('StaffScheduling')} accessibilityRole="link" hitSlop={8}>
            {({ hovered }) => <Text style={[styles.link, hovered && styles.linkHover]}>Xem lịch trực</Text>}
          </Pressable>
        </View>

        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={wide ? styles.colMain : null}>
            <Text style={styles.sectionTitle}>
              Việc cần làm{!loading && pendingCount > 0 ? ` · ${pendingCount} mục` : ''}
            </Text>
            <View style={styles.panel}>
              {loading ? <Loading /> : tasks.map((t, i) => {
                const done = t.count === 0;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => navigation.navigate(t.route, t.params)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label}: ${t.count}`}
                    style={({ hovered }) => [styles.taskRow, i > 0 && styles.rowBorder, hovered && styles.rowHover]}
                  >
                    <View style={[styles.taskCount, done && styles.taskCountDone]}>
                      {done
                        ? <Feather name="check" size={18} color={Colors.successText} />
                        : <Text style={styles.taskCountText}>{t.count}</Text>}
                    </View>
                    <View style={styles.grow}>
                      <Text style={[styles.taskLabel, done && styles.taskLabelDone]}>{t.label}</Text>
                      <Text style={styles.sub}>{done ? 'Không còn việc tồn' : t.hint}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={Colors.secondary} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={wide ? styles.colSide : null}>
            <Text style={styles.sectionTitle}>{NEXT_TITLE[role] || 'Ca tiếp theo'}</Text>
            <View style={styles.panel}>
              {loading ? <Loading /> : nextUp.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="inbox" size={22} color={Colors.brandGreen} />
                  <Text style={styles.emptyText}>Hiện không có ca nào đang chờ bạn.</Text>
                </View>
              ) : nextUp.map((v, i) => (
                <Pressable
                  key={v._id}
                  onPress={() => openVisit(v)}
                  accessibilityRole="button"
                  style={({ hovered }) => [styles.visitRow, i > 0 && styles.rowBorder, hovered && styles.rowHover]}
                >
                  <View style={styles.grow}>
                    <Text style={styles.visitName} numberOfLines={1}>{v.patientId?.profile?.name || v.patientId?.email || 'Bệnh nhân'}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{v.reason || 'Khám tổng quát'} · {fmtTime(v.createdAt)}</Text>
                    {v.priority === 'khẩn cấp' ? (
                      <View style={styles.urgent}>
                        <Feather name="alert-triangle" size={12} color={Colors.errorText} />
                        <Text style={styles.urgentText}>Cấp cứu</Text>
                      </View>
                    ) : null}
                  </View>
                  <ClinicalStatusBadge status={v.status} size="sm" />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </PageContainer>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 40 },
  shift: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 20, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10 },
  shiftText: { flex: 1, minWidth: 180, fontSize: 14, color: Colors.slateMuted },
  shiftStrong: { fontWeight: '700', color: Colors.brandNavy },
  link: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  linkHover: { textDecorationLine: 'underline' },
  columns: { gap: 28, marginTop: 28 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  colMain: { flex: 1.25, minWidth: 0 },
  colSide: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy, marginBottom: 12 },
  panel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden' },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowHover: { backgroundColor: Colors.background },
  grow: { flex: 1, minWidth: 0 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 14, paddingHorizontal: 16 },
  taskCount: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  taskCountDone: { backgroundColor: Colors.successBg },
  taskCountText: { fontSize: 20, fontWeight: '700', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  taskLabel: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  taskLabelDone: { fontWeight: '600', color: Colors.slateMuted },
  sub: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 12, paddingHorizontal: 16 },
  visitName: { fontSize: 15, fontWeight: '600', color: Colors.brandNavy },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  urgentText: { fontSize: 12, fontWeight: '700', color: Colors.errorText },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 16 },
  emptyText: { fontSize: 14, color: Colors.secondary, textAlign: 'center' },
});

export default StaffHome;
