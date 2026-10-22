import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import {
  Stethoscope, ScanLine, FileSignature, ClipboardCheck, ArrowRight, RefreshCw, Siren, Hourglass,
  Activity, Inbox, UserRound, CheckCircle2, ChevronRight, UploadCloud, CalendarDays, Brain,
  ShieldAlert, PackageCheck, Pill, Package, CalendarX,
} from 'lucide-react';
import useStaffHome from '../../controllers/useStaffHome';
import ClinicalStatusBadge from '../ClinicalStatusBadge';
import { Reveal, CountUp } from '../ui/Motion';
import { StaffBanner, RECEPTION_IMAGES, LiveClock, Avatar, EmptyState, personName } from '../reception/ReceptionUI';

const isWeb = Platform.OS === 'web';
const MRI_STATUSES = ['chờ chụp', 'chờ chụp lại', 'chờ chụp sau phẫu thuật', 'đang chụp', 'chờ kết quả AI', 'chờ bác sĩ đọc'];

const greetingOf = (d) => {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};
const isToday = (date) => date && new Date(date).toDateString() === new Date().toDateString();

// Màu cho từng loại việc của bác sĩ (dùng chung cho thẻ số liệu & danh sách việc)
const TASK_TONE = {
  assign: { icon: ClipboardCheck, color: '#4F46E5', bg: '#EEF0FF' },
  exam: { icon: Hourglass, color: '#D97706', bg: '#FEF3C7' },
  examining: { icon: Stethoscope, color: '#067A5E', bg: '#E7F6F0' },
  read: { icon: ScanLine, color: '#7C3AED', bg: '#F3EEFF' },
  scan: { icon: Activity, color: '#0369A1', bg: '#E0F2FE' },
  sign: { icon: FileSignature, color: '#DB2777', bg: '#FDF2F8' },
  upload: { icon: UploadCloud, color: '#0369A1', bg: '#E0F2FE' },
  verify: { icon: ShieldAlert, color: '#DC2626', bg: '#FEE2E2' },
  ready: { icon: PackageCheck, color: '#0F9D6B', bg: '#E3F7EF' },
  dispense: { icon: Pill, color: '#D97706', bg: '#FEF3C7' },
};

// Cấu hình theo vai trò: bác sĩ (tông chàm) / kỹ thuật viên MRI (tông xanh biển)
const VARIANTS = {
  doctor: {
    image: 'mriDiscuss', tone: 'indigo', label: 'Bác sĩ', kpis: ['exam', 'examining', 'read', 'sign'],
    primary: { icon: Stethoscope, label: 'Mở hàng đợi khám', route: 'DoctorWorkQueue', params: { tab: 'examQueue' } },
  },
  pharmacist: {
    image: 'tabletScan', tone: 'teal', label: 'Dược sĩ', kpis: ['verify', 'ready', 'dispense'],
    primary: { icon: Package, label: 'Mở hàng đợi Khoa Dược', route: 'PharmacyQueue' },
  },
  technician: {
    image: 'mriFilms', tone: 'ocean', label: 'Kỹ thuật viên MRI', kpis: ['scan', 'upload'],
    primary: { icon: UploadCloud, label: 'Nhập kết quả chụp', route: 'CreateImagingResult' },
  },
};

/** Bàn làm việc Bác sĩ — cùng phong cách trang chủ Lễ tân / Điều dưỡng, tông chàm riêng. */
const DoctorHome = ({ user, navigation, onEditProfile, variant = 'doctor' }) => {
  const cfg = VARIANTS[variant] || VARIANTS.doctor;
  const isTech = variant === 'technician';
  const isPharm = variant === 'pharmacist';
  const { width } = useWindowDimensions();
  const isWide = width > 1100;
  const { loading, schedule, tasks, nextUp, reload } = useStaffHome(user);

  useEffect(() => { navigation.setOptions?.({ headerShown: false }); }, [navigation]);

  const byKey = Object.fromEntries(tasks.map((t) => [t.key, t]));
  const name = (user?.profile?.name || user?.profile?.fullName || 'Bác sĩ').replace(/\s*\(.*\)\s*$/, '');
  const pending = tasks.filter((t) => t.count > 0).length;

  const kpis = cfg.kpis.map((k) => ({ key: k, ...TASK_TONE[k], label: byKey[k]?.label || '', value: byKey[k]?.count || 0, task: byKey[k] }));

  const actions = isPharm ? [
    { icon: Package, title: 'Hàng đợi Khoa Dược', desc: `${(byKey.verify?.count || 0) + (byKey.ready?.count || 0) + (byKey.dispense?.count || 0)} đơn cần xử lý`, bg: '#0F766E', shade: '#115E59', go: () => navigation.navigate('PharmacyQueue') },
    { icon: Pill, title: 'Danh mục thuốc', desc: 'Tồn kho theo lô (FEFO)', bg: '#0369A1', shade: '#075985', go: () => navigation.navigate('DrugManagement', { tab: 'list' }) },
    { icon: CalendarX, title: 'Thuốc hết hạn', desc: 'Lô sắp & đã hết hạn', bg: '#B45309', shade: '#92400E', go: () => navigation.navigate('DrugManagement', { tab: 'expiry' }) },
  ] : isTech ? [
    { icon: Brain, title: 'Phòng chụp MRI', desc: `${byKey.scan?.count || 0} ca chờ chụp`, bg: '#0369A1', shade: '#075985', go: () => navigation.navigate('DoctorWorkQueue', { tab: 'mriQueue' }) },
    { icon: UploadCloud, title: 'Tải phim MRI/PACS', desc: `${byKey.upload?.count || 0} ca chưa nộp phim`, bg: '#0F766E', shade: '#115E59', go: () => navigation.navigate('CreateImagingResult') },
    { icon: CalendarDays, title: 'Lịch làm việc', desc: schedule ? 'Xem ca trực hôm nay' : 'Đăng ký ca trực', bg: '#4F46E5', shade: '#3730A3', go: () => navigation.navigate('StaffScheduling') },
  ] : [
    { icon: Stethoscope, title: 'Hàng chờ khám bệnh', desc: `${byKey.exam?.count || 0} bệnh nhân chờ khám`, bg: '#312E81', shade: '#1E1B4B', go: () => navigation.navigate('DoctorWorkQueue', { tab: 'examQueue' }) },
    { icon: ScanLine, title: 'Đọc phim MRI', desc: `${byKey.read?.count || 0} phim chờ kết luận`, bg: '#7C3AED', shade: '#6D28D9', go: () => navigation.navigate('DoctorWorkQueue', { tab: 'mriQueue' }) },
    { icon: FileSignature, title: 'Ký bệnh án', desc: `${byKey.sign?.count || 0} hồ sơ chưa ký số`, bg: '#0F766E', shade: '#115E59', go: () => navigation.navigate('EMRDashboard', { tab: 'records' }) },
    { icon: ClipboardCheck, title: 'Phân công của tôi', desc: byKey.assign?.count ? `${byKey.assign.count} ca chờ xác nhận` : 'Không có ca chờ xác nhận', bg: '#0B2A5B', shade: '#071E3D', go: () => navigation.navigate('MyAssignments') },
  ];

  const openVisit = (v) => isPharm ? navigation.navigate('PharmacyQueue') : navigation.navigate('DoctorWorkQueue', { tab: isTech || MRI_STATUSES.includes(v.status) ? 'mriQueue' : 'examQueue' });

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      <StaffBanner
        image={RECEPTION_IMAGES[cfg.image]}
        tone={cfg.tone}
        eyebrow={`${greetingOf(new Date())},`}
        title={name}
        subtitle={pending ? `Bàn làm việc ${cfg.label} — hôm nay còn ${pending} nhóm việc cần xử lý.` : `Bàn làm việc ${cfg.label} — không còn việc tồn đọng.`}
        right={<LiveClock label="Đang trong ca" shift={schedule} />}
      >
        <View style={s.bannerBtns}>
          <TouchableOpacity style={s.bannerBtn} onPress={() => navigation.navigate(cfg.primary.route, cfg.primary.params)} dataSet={{ hover: 'glow' }}>
            <cfg.primary.icon size={16} color="#1E1B4B" />
            <Text style={s.bannerBtnText}>{cfg.primary.label}</Text>
          </TouchableOpacity>
          {onEditProfile ? (
            <TouchableOpacity style={s.bannerGhost} onPress={onEditProfile} dataSet={{ hover: 'glow' }}>
              <UserRound size={16} color="#FFFFFF" />
              <Text style={s.bannerGhostText}>Hồ sơ cá nhân</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </StaffBanner>

      <View style={s.kpiRow}>
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Reveal key={k.key} delay={i * 90} style={[s.kpiWrap, { width: !isWide ? '48.5%' : kpis.length === 3 ? '32.2%' : kpis.length > 3 ? '23.6%' : '48.5%' }]}>
              <TouchableOpacity style={s.kpi} onPress={() => k.task && navigation.navigate(k.task.route, k.task.params)} dataSet={{ hover: 'lift' }}>
                <View style={[s.kpiIcon, { backgroundColor: k.bg }]}><Icon size={20} color={k.color} /></View>
                <CountUp value={k.value} style={[s.kpiValue, { color: k.color }]} />
                <Text style={s.kpiLabel}>{k.label}</Text>
                <View style={[s.kpiAccent, { backgroundColor: k.color }]} />
              </TouchableOpacity>
            </Reveal>
          );
        })}
      </View>

      <Text style={s.sectionTitle}>Bắt đầu nhanh</Text>
      <View style={s.actionRow}>
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <Reveal key={a.title} delay={i * 100} style={{ width: isWide ? (actions.length === 3 ? '32.2%' : '23.9%') : '48.5%' }}>
              <TouchableOpacity style={[s.action, { backgroundColor: a.bg }]} onPress={a.go} dataSet={{ hover: 'lift' }}>
                <View style={[s.actionBlob, { backgroundColor: a.shade }]} />
                <View style={s.actionIcon}><Icon size={24} color="#FFFFFF" /></View>
                <Text style={s.actionTitle}>{a.title}</Text>
                <Text style={s.actionDesc}>{a.desc}</Text>
                <View style={s.actionGo}>
                  <Text style={s.actionGoText}>Mở</Text>
                  <ArrowRight size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </Reveal>
          );
        })}
      </View>

      <View style={[s.twoCol, isWide && { flexDirection: 'row' }]}>
        {/* Bệnh nhân tiếp theo */}
        <Reveal style={[s.panel, isWide && { flex: 1.35 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>{isPharm ? 'Đơn thuốc cần xử lý' : isTech ? 'Ca chụp tiếp theo' : 'Bệnh nhân tiếp theo'}</Text>
              <Text style={s.panelSub}>Ca cấp cứu luôn ở trên cùng</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={reload} dataSet={{ hover: 'tint' }}>
              <RefreshCw size={15} color="#4F46E5" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#4F46E5" style={{ marginVertical: 32 }} />
          ) : nextUp.length === 0 ? (
            <EmptyState icon={Inbox} tint="#4F46E5" title="Không có ca nào đang chờ bạn" text="Bệnh nhân được phân công sẽ hiện ở đây." />
          ) : (
            nextUp.map((v) => (
              <TouchableOpacity key={v._id} style={[s.visitRow, v.priority === 'khẩn cấp' && s.visitUrgent]} onPress={() => openVisit(v)} dataSet={{ hover: 'tint' }}>
                <Avatar name={personName(v.patientId)} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.visitName} numberOfLines={1}>{personName(v.patientId)}</Text>
                  <Text style={s.visitMeta} numberOfLines={1}>{v.reason || 'Khám tổng quát'}</Text>
                </View>
                {v.priority === 'khẩn cấp' && (
                  <View style={s.urgent}><Siren size={11} color="#DC2626" /><Text style={s.urgentText}>CẤP CỨU</Text></View>
                )}
                <ClinicalStatusBadge status={v.status} size="sm" />
              </TouchableOpacity>
            ))
          )}
        </Reveal>

        {/* Việc cần làm */}
        <Reveal delay={120} style={[s.panel, s.taskPanel, isWide && { flex: 1 }]}>
          <View style={s.panelHead}>
            <View>
              <Text style={s.panelTitle}>Việc cần làm</Text>
              <Text style={s.panelSub}>{pending ? `${pending} nhóm việc còn tồn` : 'Đã xử lý hết'}</Text>
            </View>
            <View style={s.countBubble}><Text style={s.countBubbleText}>{pending}</Text></View>
          </View>
          {tasks.map((t) => {
            const tone = TASK_TONE[t.key] || TASK_TONE.exam;
            const Icon = t.count === 0 ? CheckCircle2 : tone.icon;
            return (
              <TouchableOpacity key={t.key} style={s.task} onPress={() => navigation.navigate(t.route, t.params)} dataSet={{ hover: 'lift' }}>
                <View style={[s.taskIcon, { backgroundColor: t.count === 0 ? '#E3F7EF' : tone.bg }]}>
                  <Icon size={16} color={t.count === 0 ? '#0F9D6B' : tone.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.taskLabel, t.count === 0 && { color: '#94A3B8' }]} numberOfLines={1}>{t.label}</Text>
                  <Text style={s.taskHint} numberOfLines={1}>{t.count === 0 ? 'Không còn việc tồn đọng' : t.hint}</Text>
                </View>
                {t.count > 0 ? <Text style={[s.taskCount, { color: tone.color }]}>{t.count}</Text> : null}
                <ChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            );
          })}
        </Reveal>
      </View>
    </ScrollView>
  );
};

const shadow = isWeb ? { boxShadow: '0 10px 30px -18px rgba(30,27,75,0.35)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F7FC' },
  pageContent: { padding: 28, paddingBottom: 48, maxWidth: 1320, width: '100%', alignSelf: 'center', gap: 22 },

  bannerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  bannerBtnText: { color: '#1E1B4B', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  kpiWrap: {},
  kpi: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', ...shadow },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiValue: { fontSize: 28, fontWeight: '800' },
  kpiLabel: { fontSize: 13, color: '#475569', marginTop: 2, fontWeight: '600' },
  kpiAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E1B4B', marginBottom: -8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  action: { borderRadius: 20, padding: 22, minHeight: 168, overflow: 'hidden', position: 'relative' },
  actionBlob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, top: -60, opacity: 0.7 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  actionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  actionDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, lineHeight: 19 },
  actionGo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  actionGoText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  twoCol: { gap: 18, alignItems: 'flex-start' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...shadow },
  taskPanel: { backgroundColor: '#F8F7FF', borderColor: '#E4E1FB' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  panelSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF0FF', alignItems: 'center', justifyContent: 'center' },
  countBubble: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countBubbleText: { color: '#FFFFFF', fontWeight: '800' },

  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  visitUrgent: { backgroundColor: '#FFF5F5' },
  visitName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  visitMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentText: { color: '#DC2626', fontSize: 10, fontWeight: '800' },

  task: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#ECEAFD' },
  taskIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taskLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  taskHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  taskCount: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

export default DoctorHome;
