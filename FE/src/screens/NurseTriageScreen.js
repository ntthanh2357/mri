import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../constants/colors';
import Layout from '../constants/layout';
import { get, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import { useQueueDesk } from '../controllers/useQueueDesk';
import PreScreeningModal from '../components/staff/PreScreeningModal';
import { RISK_META } from '../utils/preScreening';

// UC-NUR-01 — Tiếp nhận & gọi bệnh nhân đo sinh hiệu (chỉ role điều dưỡng).
// Xem danh sách bệnh nhân đã tiếp đón trong ngày → gọi người bệnh vào phòng đo sinh hiệu ban đầu.

const POLL_MS = 20000;
const ROOMS = ['Phòng đo sinh hiệu 01', 'Phòng đo sinh hiệu 02', 'Phòng đo sinh hiệu 03'];
const pad = (n) => String(n).padStart(3, '0');
const nameOf = (p) => p?.profile?.name || p?.profile?.fullName || p?.email || 'Bệnh nhân';
const minutesSince = (d, now) => Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));
const fmtWait = (m) => (m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`);
const fmtClock = (d) => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const isPending = (v) => v.status === 'đang chờ' && !v.vitals?.measuredAt;
const callState = (v) => v.vitalsCall?.status || 'none';

const Btn = ({ label, icon, onPress, variant = 'secondary', disabled }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ hovered }) => [
      styles.btn,
      variant === 'primary' ? styles.btnPrimary : styles.btnSecondary,
      hovered && !disabled && (variant === 'primary' ? styles.btnPrimaryHover : styles.btnSecondaryHover),
      disabled && styles.disabled,
    ]}
  >
    {icon ? <Feather name={icon} size={15} color={variant === 'primary' ? '#FFFFFF' : Colors.brandGreen} /> : null}
    <Text style={variant === 'primary' ? styles.btnPrimaryText : styles.btnSecondaryText}>{label}</Text>
  </Pressable>
);

const Stat = ({ label, value, tone }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, tone && { color: tone }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const NurseTriageScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const wide = width >= Layout.wide;
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState('pending');
  // UC-PAT-03: số thứ tự bệnh nhân lấy online — gộp chung với bảng gọi sinh hiệu
  const queueDesk = useQueueDesk();
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState(ROOMS[0]);
  const [roomOpen, setRoomOpen] = useState(false);
  const [screenVisit, setScreenVisit] = useState(null); // UC-NUR-03: lượt khám đang sàng lọc
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    get('/auth/me')
      .then((res) => { if (alive) setUser(res?.user || res || null); })
      .catch(() => {})
      .finally(() => { if (alive) setAuthChecked(true); });
    return () => { alive = false; };
  }, []);

  const isNurse = user?.role === 'nurse';

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const res = await get('/api/v1/visits/my-queue?today=true');
      setVisits(res?.visits || []);
    } catch (err) {
      console.error('Lỗi tải danh sách tiếp nhận:', err);
      setMsg({ ok: false, text: 'Không tải được danh sách bệnh nhân.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isNurse) return undefined;
    load();
    const poll = setInterval(() => load(true), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const unsub = navigation?.addListener ? navigation.addListener('focus', () => load(true)) : null;
    return () => { clearInterval(poll); clearInterval(clock); if (unsub) unsub(); };
  }, [isNurse, load, navigation]);

  const data = useMemo(() => {
    const ordered = [...visits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const numberOf = new Map(ordered.map((v, i) => [v._id, pad(i + 1)]));
    // Cấp cứu lên đầu, sau đó theo giờ tiếp đón
    const byPriority = (a, b) =>
      (b.priority === 'khẩn cấp') - (a.priority === 'khẩn cấp') || new Date(a.createdAt) - new Date(b.createdAt);
    const pending = ordered.filter(isPending);
    const waiting = pending.filter((v) => callState(v) === 'none').sort(byPriority);
    const called = pending.filter((v) => callState(v) === 'called')
      .sort((a, b) => new Date(b.vitalsCall.calledAt) - new Date(a.vitalsCall.calledAt));
    const missed = pending.filter((v) => callState(v) === 'missed').sort(byPriority);
    const measured = ordered.filter((v) => v.vitals?.measuredAt)
      .sort((a, b) => new Date(b.vitals.measuredAt) - new Date(a.vitals.measuredAt));
    return { numberOf, waiting, called, missed, measured };
  }, [visits]);

  // Một bảng gọi duy nhất: số online (chờ tiếp nhận tại quầy) + lượt khám (chờ đo sinh hiệu)
  const tk = queueDesk.tickets;
  const asV = (v) => ({ kind: 'visit', key: v._id, v, patient: v.patientId });
  const asT = (t) => ({ kind: 'ticket', key: t._id, t, patient: t.patientId });
  const urgentV = data.waiting.filter((v) => v.priority === 'khẩn cấp');
  const otherV = data.waiting.filter((v) => v.priority !== 'khẩn cấp');
  const lists = {
    pending: [...urgentV.map(asV), ...tk.filter((t) => ['waiting', 'arrived'].includes(t.status)).map(asT), ...otherV.map(asV)],
    called: [...data.called.map(asV), ...tk.filter((t) => t.status === 'called').map(asT)],
    missed: [...data.missed.map(asV), ...tk.filter((t) => t.status === 'missed').map(asT)],
    measured: data.measured.map(asV),
  };
  const q = search.trim().toLowerCase();
  const numberOfEntry = (e) => (e.kind === 'ticket' ? String(e.t.number) : String(data.numberOf.get(e.v._id)));
  const shown = (lists[tab] || []).filter((e) => !q
    || nameOf(e.patient).toLowerCase().includes(q)
    || String(e.patient?.profile?.medicalId || '').toLowerCase().includes(q)
    || numberOfEntry(e).includes(q));
  const nextUp = lists.pending[0] || null;
  const calledV = data.called[0] || null;
  const calledT = tk.find((t) => t.status === 'called') || null;
  const nowCalling = calledV
    ? { number: data.numberOf.get(calledV._id), name: nameOf(calledV.patientId), where: `mời vào ${calledV.vitalsCall.room}` }
    : calledT
      ? { number: String(calledT.number), name: nameOf(calledT.patientId), where: 'mời đến quầy tiếp nhận' }
      : null;

  const act = async (visit, action) => {
    setBusyId(visit._id);
    setMsg(null);
    try {
      const res = await put(`/api/v1/visits/${visit._id}/call-vitals`, { action, room: room.trim() });
      setMsg({ ok: true, text: res?.message || 'Đã cập nhật.' });
      await load(true);
      if (action === 'call') setTab('called');
    } catch (err) {
      setMsg({ ok: false, text: err?.message || 'Không thực hiện được.' });
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  const startVitals = (v) => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } });

  const renderRow = (v, i) => {
    const st = callState(v);
    const urgent = v.priority === 'khẩn cấp';
    const wait = minutesSince(v.createdAt, now);
    const busy = busyId === v._id;
    return (
      <View key={v._id} style={[styles.row, i > 0 && styles.rowBorder, urgent && styles.rowUrgent]}>
        <View style={[styles.ticket, st === 'called' && styles.ticketCalled]}>
          <Text style={[styles.ticketText, st === 'called' && { color: '#FFFFFF' }]}>{data.numberOf.get(v._id)}</Text>
        </View>
        <View style={styles.grow}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={1}>{nameOf(v.patientId)}</Text>
            {urgent ? (
              <View style={styles.urgent}><Feather name="alert-triangle" size={12} color={Colors.errorText} /><Text style={styles.urgentText}>Cấp cứu</Text></View>
            ) : null}
            {v.preScreening?.screened ? (
              <View style={[styles.stage, v.preScreening.riskLevel === 'high' ? styles.stageHigh : v.preScreening.riskLevel === 'caution' ? styles.stageCaution : styles.stageOk]}>
                <Text style={[styles.stageText, v.preScreening.riskLevel === 'high' ? styles.stageTextHigh : v.preScreening.riskLevel === 'caution' ? styles.stageTextCaution : styles.stageTextOk]}>
                  Sàng lọc: {RISK_META[v.preScreening.riskLevel]?.label || 'Đã sàng lọc'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            Mã y tế: {v.patientId?.profile?.medicalId || 'chưa có'} · {v.reason || 'Khám tổng quát'} · BS. {nameOf(v.doctorId)}
          </Text>
          <Text style={styles.meta}>
            {v.vitals?.measuredAt
              ? `Đã đo sinh hiệu lúc ${fmtClock(v.vitals.measuredAt)}${v.vitals.isAbnormal ? ' · có chỉ số bất thường' : ''}`
              : `Tiếp đón ${fmtClock(v.createdAt)} · chờ ${fmtWait(wait)}`}
            {st === 'called' ? ` · gọi lúc ${fmtClock(v.vitalsCall.calledAt)} (lần ${v.vitalsCall.callCount}) · ${v.vitalsCall.room}` : ''}
            {st === 'missed' ? ` · đã gọi ${v.vitalsCall.callCount} lần, vắng mặt` : ''}
          </Text>
        </View>
        <View style={styles.actions}>
          <Btn label={v.preScreening?.screened ? 'Sửa sàng lọc' : 'Sàng lọc'} icon="shield" onPress={() => setScreenVisit(v)} />
          {v.vitals?.measuredAt ? (
            <Btn label="Xem phiếu" icon="file-text" onPress={() => startVitals(v)} />
          ) : st === 'called' ? (
            <>
              <Btn label="Gọi lại" icon="volume-2" disabled={busy} onPress={() => act(v, 'call')} />
              <Btn label="Vắng" disabled={busy} onPress={() => act(v, 'missed')} />
              <Btn label="Bắt đầu đo" icon="activity" variant="primary" disabled={busy} onPress={() => startVitals(v)} />
            </>
          ) : st === 'missed' ? (
            <>
              <Btn label="Gọi lại" icon="volume-2" variant="primary" disabled={busy} onPress={() => act(v, 'call')} />
              <Btn label="Bắt đầu đo" icon="activity" disabled={busy} onPress={() => startVitals(v)} />
            </>
          ) : (
            <>
              <Btn label="Gọi vào đo" icon="volume-2" variant="primary" disabled={busy} onPress={() => act(v, 'call')} />
              <Btn label="Đo ngay" icon="activity" disabled={busy} onPress={() => startVitals(v)} />
            </>
          )}
          {busy ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : null}
        </View>
      </View>
    );
  };

  // Người đã lấy số online nhưng chưa có lượt khám → thao tác tại quầy
  const runTicket = async (fn, after) => {
    setBusyId('ticket');
    setMsg(null);
    const res = await fn();
    setBusyId(null);
    setMsg({ ok: res.ok, text: res.message || (res.ok ? 'Đã cập nhật.' : 'Không thực hiện được.') });
    if (res.ok && after) after(res.ticket);
  };

  // Nút "Gọi tiếp theo" chung: người đứng đầu bảng (ca cấp cứu trước)
  const callNextUp = () => {
    if (!nextUp) return;
    if (nextUp.kind === 'visit') return act(nextUp.v, 'call');
    return runTicket(queueDesk.callNext, () => setTab('called'));
  };

  const renderTicketRow = (t, i) => {
    const st = t.status;
    const busy = busyId === 'ticket';
    const label = st === 'called' ? 'Đang gọi tới quầy' : st === 'missed' ? 'Vắng, giữ số' : st === 'arrived' ? 'Đã tới, chờ gọi' : 'Chờ tiếp nhận';
    return (
      <View key={t._id} style={[styles.row, i > 0 && styles.rowBorder]}>
        <View style={[styles.ticket, st === 'called' && styles.ticketCalled]}>
          <Text style={[styles.ticketText, st === 'called' && { color: '#FFFFFF' }]}>{t.number}</Text>
        </View>
        <View style={styles.grow}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={1}>{nameOf(t.patientId)}</Text>
            <View style={styles.stage}><Text style={styles.stageText}>Số online</Text></View>
          </View>
          <Text style={styles.meta} numberOfLines={1}>Mã y tế: {t.patientId?.profile?.medicalId || 'chưa có'} · {label} · chưa có lượt khám</Text>
        </View>
        <View style={styles.actions}>
          {st === 'called' ? (
            <>
              <Btn label="Vắng" disabled={busy} onPress={() => runTicket(() => queueDesk.markMissed(t._id))} />
              <Btn label="Tiếp nhận" icon="user-plus" variant="primary" disabled={busy}
                onPress={() => runTicket(() => queueDesk.markServed(t._id), (tk2) => navigation.navigate('NurseReception', { tab: 'createVisit', queuePatient: tk2?.patientId || t.patientId }))} />
            </>
          ) : st === 'waiting' || st === 'missed' ? (
            <Btn label="Đã tới" disabled={busy} onPress={() => runTicket(() => queueDesk.markArrived(t._id))} />
          ) : null}
        </View>
      </View>
    );
  };

  const renderEntry = (e, i) => (e.kind === 'ticket' ? renderTicketRow(e.t, i) : renderRow(e.v, i));

  const emptyText = {
    pending: 'Không có bệnh nhân nào đang chờ được gọi.',
    called: 'Chưa gọi bệnh nhân nào vào phòng đo.',
    missed: 'Không có bệnh nhân vắng mặt.',
    measured: 'Hôm nay chưa đo sinh hiệu cho bệnh nhân nào.',
  }[tab];

  let body;
  if (!authChecked) {
    body = <View style={styles.state}><ActivityIndicator size="large" color={Colors.brandGreen} /></View>;
  } else if (!isNurse) {
    body = (
      <View style={styles.state}>
        <Feather name="lock" size={28} color={Colors.errorText} />
        <Text style={styles.stateTitle}>Chỉ dành cho Điều dưỡng</Text>
        <Text style={styles.muted}>Trang Tiếp nhận chỉ mở cho tài khoản có vai trò Điều dưỡng.</Text>
        <Btn label="Về tổng quan" variant="primary" onPress={() => navigation.navigate('Home')} />
      </View>
    );
  } else {
    body = (
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          {/* Bảng gọi duy nhất */}
          <View style={styles.hero}>
            <View style={styles.grow}>
              <Text style={styles.heroLabel}>Số đang gọi</Text>
              <Text style={styles.heroNumber}>{nowCalling ? nowCalling.number : '---'}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {nowCalling ? `${nowCalling.name} · ${nowCalling.where}` : 'Chưa có bệnh nhân nào được gọi'}
              </Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroHint} numberOfLines={1}>
                {nextUp ? `Tiếp theo: số ${numberOfEntry(nextUp)} · ${nameOf(nextUp.patient)}` : 'Không còn bệnh nhân chờ gọi'}
              </Text>
              <Pressable
                onPress={callNextUp}
                disabled={!nextUp || busyId !== null}
                accessibilityRole="button"
                style={({ hovered }) => [styles.callBtn, hovered && styles.callBtnHover, (!nextUp || busyId !== null) && styles.disabled]}
              >
                <Feather name="volume-2" size={18} color={Colors.brandNavy} />
                <Text style={styles.callBtnText}>Gọi số tiếp theo</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.stats, !wide && styles.statsWrap]}>
            <Stat label="Chờ gọi" value={lists.pending.length} />
            <Stat label="Đang gọi" value={lists.called.length} tone={Colors.successText} />
            <Stat label="Vắng mặt" value={lists.missed.length} tone={Colors.warningText} />
            <Stat label="Đã đo hôm nay" value={lists.measured.length} tone={Colors.infoText} />
          </View>

          <View style={[styles.roomRow, { zIndex: 20 }]}>
            <Feather name="map-pin" size={15} color={Colors.slateMuted} />
            <Text style={styles.roomLabel}>Phòng đo:</Text>
            <View>
              <Pressable
                onPress={() => setRoomOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityLabel="Chọn phòng đo sinh hiệu"
                style={({ hovered }) => [styles.roomSelect, hovered && styles.roomSelectHover]}
              >
                <Text style={styles.roomSelectText}>{room}</Text>
                <Feather name={roomOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.slateMuted} />
              </Pressable>
              {roomOpen ? (
                <View style={styles.roomMenu}>
                  {ROOMS.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => { setRoom(r); setRoomOpen(false); }}
                      accessibilityRole="menuitem"
                      style={({ hovered }) => [styles.roomOption, hovered && styles.roomOptionHover, r === room && styles.roomOptionActive]}
                    >
                      <Text style={[styles.roomOptionText, r === room && styles.roomOptionTextActive]}>{r}</Text>
                      {r === room ? <Feather name="check" size={15} color={Colors.brandGreen} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {msg ? (
            <View style={[styles.msg, { backgroundColor: msg.ok ? Colors.successBg : Colors.warningBg }]} accessibilityLiveRegion="polite">
              <Feather name={msg.ok ? 'check-circle' : 'alert-circle'} size={15} color={msg.ok ? Colors.successText : Colors.warningText} />
              <Text style={[styles.msgText, { color: msg.ok ? Colors.successText : Colors.warningText }]}>{msg.text}</Text>
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <PageTabs
                tabs={[
                  { key: 'pending', label: 'Chờ gọi', count: lists.pending.length || null },
                  { key: 'called', label: 'Đang gọi', count: lists.called.length || null },
                  { key: 'missed', label: 'Vắng mặt', count: lists.missed.length || null },
                  { key: 'measured', label: 'Đã đo', count: lists.measured.length || null },
                ]}
                value={tab}
                onChange={setTab}
              />
              <View style={styles.search}>
                <Feather name="search" size={15} color={Colors.secondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Tìm tên, mã y tế, số thứ tự"
                  style={styles.searchInput}
                  accessibilityLabel="Tìm bệnh nhân"
                />
              </View>
            </View>
            {loading && queueDesk.loading ? (
              <View style={styles.state}><ActivityIndicator size="small" color={Colors.brandGreen} /><Text style={styles.muted}>Đang tải…</Text></View>
            ) : shown.length === 0 ? (
              <View style={styles.state}>
                <Feather name="inbox" size={22} color={Colors.brandGreen} />
                <Text style={styles.muted}>{q ? 'Không tìm thấy bệnh nhân phù hợp.' : emptyText}</Text>
              </View>
            ) : shown.map(renderEntry)}
          </View>
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} user={user} activeRoute="NurseTriage">
      <View style={styles.container}>
        <PageHeader
          bar
          title="Tiếp nhận"
          subtitle="Xem bệnh nhân đang chờ tại phòng tiếp đón và gọi vào phòng đo sinh hiệu ban đầu."
          actions={isNurse ? <HeaderAction icon="refresh-cw" label="Làm mới" onPress={() => load()} /> : null}
        />
        {body}
        <PreScreeningModal
          visible={Boolean(screenVisit)}
          visit={screenVisit}
          onClose={() => setScreenVisit(null)}
          onSaved={(text) => { setMsg({ ok: true, text }); load(true); }}
        />
      </View>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  page: { paddingTop: 20, paddingBottom: 40, gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  muted: { fontSize: 13, color: Colors.slateMuted, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 16 },
  stateTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy },

  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 20, borderRadius: 14, backgroundColor: Colors.brandNavy },
  heroLabel: { fontSize: 13, fontWeight: '600', color: Colors.brandMint },
  heroNumber: { fontSize: 48, lineHeight: 56, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 14, color: Colors.onDarkMuted },
  heroRight: { gap: 8, alignItems: 'flex-start' },
  heroHint: { fontSize: 13, color: Colors.onDarkMuted },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandMint },
  callBtnHover: { backgroundColor: '#FFFFFF' },
  callBtnText: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },

  stats: { flexDirection: 'row', gap: 12 },
  statsWrap: { flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: 140, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', color: Colors.slateMuted, marginTop: 2 },

  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  roomLabel: { fontSize: 14, color: Colors.slateMuted, fontWeight: '600' },
  roomSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 38, minWidth: 220, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, backgroundColor: Colors.surface },
  roomSelectHover: { borderColor: Colors.brandGreen },
  roomSelectText: { fontSize: 14, color: Colors.slateDark, fontWeight: '600' },
  roomMenu: { position: 'absolute', top: 42, left: 0, minWidth: 220, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, paddingVertical: 4, zIndex: 30, elevation: 6 },
  roomOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  roomOptionHover: { backgroundColor: Colors.background },
  roomOptionActive: { backgroundColor: Colors.brandGreenSoft },
  roomOptionText: { fontSize: 14, color: Colors.slateDark },
  roomOptionTextActive: { fontWeight: '700', color: Colors.brandGreen },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  msgText: { flex: 1, fontSize: 14, fontWeight: '600' },

  panel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden' },
  panelHead: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: 4, paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, backgroundColor: Colors.background },
  searchInput: { flex: 1, fontSize: 14, color: Colors.slateDark, outlineStyle: 'none' },

  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowUrgent: { backgroundColor: Colors.errorBg },
  ticket: { width: 56, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.brandGreenSoft, alignItems: 'center' },
  ticketCalled: { backgroundColor: Colors.brandGreen },
  ticketText: { fontSize: 16, fontWeight: '800', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  meta: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.errorBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  urgentText: { fontSize: 11, fontWeight: '800', color: Colors.errorText },
  stage: { backgroundColor: Colors.infoBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  stageText: { fontSize: 11, fontWeight: '700', color: Colors.infoText },
  stageHigh: { backgroundColor: Colors.errorBg },
  stageCaution: { backgroundColor: Colors.warningBg },
  stageOk: { backgroundColor: Colors.successBg },
  stageTextHigh: { color: Colors.errorText },
  stageTextCaution: { color: Colors.warningText },
  stageTextOk: { color: Colors.successText },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8 },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryHover: { backgroundColor: Colors.brandGreenPressed },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnSecondaryHover: { backgroundColor: Colors.brandGreenSoft },
  btnSecondaryText: { color: Colors.brandGreen, fontSize: 14, fontWeight: '600' },
});

export default NurseTriageScreen;
