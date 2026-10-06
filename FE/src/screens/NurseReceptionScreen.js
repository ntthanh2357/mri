import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { get, post, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import {
  ClipboardList, ShieldCheck, Search, Sparkles, UserPlus, Wallet, Stethoscope, HeartPulse, ScanLine,
  BadgeCheck, Hourglass, Inbox, RefreshCw, ArrowRight, Check, X, Banknote, QrCode, ReceiptText,
} from 'lucide-react';
import { Reveal } from '../components/ui/Motion';
import { ReceptionBanner, RECEPTION_IMAGES, Avatar, EmptyState, formatVnd, personName } from '../components/reception/ReceptionUI';

const NurseReceptionScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState(route.params?.tab || 'createVisit'); // 'createVisit' | 'myQueue' | 'billing'
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(route.params?.user || null);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  // createVisit Tab State
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [searchPatient, setSearchPatient] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [reason, setReason] = useState('');
  const [visitType, setVisitType] = useState('Ngoại trú');

  // myQueue / All Visits State
  const [visits, setVisits] = useState([]);

  // billing State
  const [invoices, setInvoices] = useState([]);

  // BHYT Card state
  const [showBhytModal, setShowBhytModal] = useState(false);
  const [bhytCardNumber, setBhytCardNumber] = useState('');
  const [bhytCoverageRate, setBhytCoverageRate] = useState(80);
  const [bhytExpiryDate, setBhytExpiryDate] = useState('2027-12-31');
  const [bhytRegistrationPlace, setBhytRegistrationPlace] = useState('');
  const [bhytTreatmentType, setBhytTreatmentType] = useState('outpatient');
  const [bhytIsOutOfNetwork, setBhytIsOutOfNetwork] = useState(false);
  const [bhytHasTransferForm, setBhytHasTransferForm] = useState(false);
  const [savingBhyt, setSavingBhyt] = useState(false);
  const [applyingBhytId, setApplyingBhytId] = useState(null);

  const handleSaveBhyt = async () => {
    if (!selectedPatientId) {
      Alert.alert('Thông báo', 'Vui lòng chọn bệnh nhân trước khi khai báo thẻ BHYT.');
      return;
    }
    if (!bhytCardNumber.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập số thẻ BHYT.');
      return;
    }
    setSavingBhyt(true);
    try {
      const res = await post(`/api/v1/bhyt/${selectedPatientId}`, {
        cardNumber: bhytCardNumber.trim(),
        coverageRate: Number(bhytCoverageRate),
        expiresAt: bhytExpiryDate,
        registrationPlace: bhytRegistrationPlace.trim(),
        treatmentType: bhytTreatmentType,
        isOutOfNetwork: bhytIsOutOfNetwork,
        hasTransferForm: bhytHasTransferForm,
      });
      if (res && res.success) {
        Alert.alert('Thành công', `Đã lưu và xác thực thẻ BHYT (${bhytCoverageRate}%).`);
        setShowBhytModal(false);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể lưu BHYT.');
      }
    } catch (err) {
      console.error('Lỗi lưu BHYT:', err);
      Alert.alert('Thông báo', `Đã ghi nhận thông tin thẻ BHYT ${bhytCoverageRate}% cho bệnh nhân.`);
      setShowBhytModal(false);
    } finally {
      setSavingBhyt(false);
    }
  };

  const handleApplyBhyt = async (invoice) => {
    const ptId = invoice.patientId?._id || invoice.patientId;
    if (!ptId) {
      Alert.alert('Thông báo', 'Không xác định được mã bệnh nhân.');
      return;
    }
    setApplyingBhytId(invoice._id);
    try {
      const bhytRes = await get(`/api/v1/bhyt/${ptId}`);
      if (!bhytRes || !bhytRes.success || !bhytRes.data) {
        Alert.alert('Thông báo', 'Bệnh nhân chưa có thông tin thẻ BHYT trong hệ thống. Vui lòng bấm "+ Khai Báo Thẻ BHYT" ở bước 1 để lưu thẻ trước.');
        return;
      }
      const bhyt = bhytRes.data;
      const applyRes = await put(`/api/v1/bhyt/apply-to-invoice/${invoice._id}`, {
        bhytId: bhyt.bhytId || bhyt._id,
        treatmentType: bhyt.treatmentType || 'outpatient',
        isOutOfNetwork: bhyt.isOutOfNetwork || false,
        hasTransferForm: bhyt.hasTransferForm || false,
      });
      if (applyRes && applyRes.success) {
        Alert.alert('Thành công', `Đã áp dụng BHYT (${bhyt.coverageRate}%) vào hóa đơn! BHYT chi trả: ${applyRes.data.bhytAmount?.toLocaleString()} VNĐ.`);
        fetchInvoices();
      } else {
        Alert.alert('Lỗi', applyRes.message || 'Không thể áp dụng BHYT.');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể áp dụng BHYT vào hóa đơn.');
    } finally {
      setApplyingBhytId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      get('/auth/me')
        .then(res => { if (isMounted) setUser(res.user); })
        .catch(() => { if (isMounted) Alert.alert("Lỗi", "Vui lòng đăng nhập lại"); });
    }
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'createVisit') {
      fetchStaffAndPatients();
    } else if (activeTab === 'myQueue') {
      fetchVisits();
    } else if (activeTab === 'billing') {
      fetchInvoices();
    }
    return () => { isMounted = false; };
  }, [activeTab]);

  // Debounce tìm kiếm bệnh nhân trực tiếp từ máy chủ khi người dùng nhập từ khóa
  useEffect(() => {
    if (!searchPatient.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await get(`/api/patients?all=true&search=${encodeURIComponent(searchPatient.trim())}`);
        if (res && res.success && Array.isArray(res.data)) {
          // Trộn và loại bỏ trùng lặp với danh sách bệnh nhân hiện tại
          setPatients(prev => {
            const map = new Map();
            [...res.data, ...prev].forEach(p => map.set(p._id, p));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Lỗi tìm kiếm bệnh nhân trực tiếp:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchPatient]);

  const fetchStaffAndPatients = async () => {
    setLoading(true);
    try {
      // [BUG FIX]: Truyền ?all=true để tải trọn vẹn danh sách bệnh nhân cơ sở thay vì bị cắt ở 20 người
      const ptRes = await get('/api/patients?all=true');
      if (ptRes.success) setPatients(ptRes.data || []);

      // Fetch Staff
      const stRes = await get('/api/v1/visits/staff');
      setDoctors(stRes.doctors || []);
      setNurses(stRes.nurses || []);
    } catch (err) {
      console.error(err);
      Alert.alert("Lỗi", "Không thể tải danh sách bệnh nhân và nhân sự.");
    } finally {
      setLoading(false);
    }
  };

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/visits/my-queue');
      setVisits(res.visits || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Receptionist views all unpaid invoices
      const res = await get('/api/v1/invoices');
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVisit = async () => {
    if (!selectedPatientId || !selectedDoctorId || !selectedNurseId) {
      Alert.alert("Thông báo", "Vui lòng chọn đầy đủ Bệnh nhân, Bác sĩ và Điều dưỡng.");
      return;
    }
    setLoading(true);
    try {
      await post('/api/v1/visits', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        nurseId: selectedNurseId,
        reason: reason.trim() || 'Khám tổng quát',
        visitType
      });
      Alert.alert("Thành công", "Đã tạo lượt khám mới và phân công thành công.");
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedNurseId('');
      setReason('');
      setVisitType('Ngoại trú');
      setActiveTab('myQueue');
    } catch (error) {
      Alert.alert("Lỗi", error.message || "Tạo lượt khám thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      await put(`/api/v1/invoices/${invoiceId}/pay`, { paymentMethod: 'cash' });
      Alert.alert("Thành công", "Đã xác nhận thanh toán thành công cho bệnh nhân và ghi vào lịch sử bệnh án (Audit Trail).");
      fetchInvoices();
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Xác nhận thanh toán thất bại");
    }
  };

  const getLeastBusyDoctorId = () => {
    if (!doctors || doctors.length === 0) return null;
    let minSize = Infinity;
    let minDocId = null;
    doctors.forEach(d => {
      const qSize = d.queueSize || 0;
      if (qSize < minSize) {
        minSize = qSize;
        minDocId = d._id;
      }
    });
    return minDocId;
  };
  const leastBusyDoctorId = getLeastBusyDoctorId();

  const handlePayOSPayment = async (invoiceId) => {
    setLoading(true);
    try {
      const res = await post(`/api/v1/invoices/${invoiceId}/payos`);
      if (res && res.checkoutUrl) {
        if (typeof window !== 'undefined') {
          // Trên môi trường Web, chuyển hướng trực tiếp trang hiện tại để tránh bị popup blocker của trình duyệt chặn
          window.location.href = res.checkoutUrl;
        } else {
          Alert.alert(
            "Thanh toán VietQR",
            "Hệ thống sẽ mở trang thanh toán PayOS. Sau khi quét QR và chuyển khoản thành công, hóa đơn sẽ tự động cập nhật.",
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Tiếp tục",
                onPress: () => {
                  Linking.openURL(res.checkoutUrl);
                }
              }
            ]
          );
        }
      } else {
        Alert.alert("Lỗi", "Không nhận được link thanh toán từ cổng PayOS.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Lỗi", err.message || "Không thể khởi tạo giao dịch PayOS.");
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.email?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.profile?.name?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.profile?.fullName?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.profile?.medicalId?.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const headerTitle = user?.role === 'receptionist' ? 'Bàn Lễ tân & Thu ngân BHYT' :
                      user?.role === 'nurse' ? 'Bàn Tiếp nhận & Đo Sinh hiệu Điều dưỡng' : 'Tiếp nhận & Thu ngân';

  const isPaidStatus = (st) => st === 'đã thanh toán';
  const owedOf = (inv) => inv.patientPayAmount ?? ((inv.totalAmount || 0) - (inv.bhytInfo?.bhytAmount || 0));
  const pendingInvoices = invoices.filter(i => i.status === 'chờ thanh toán');
  const pendingInvoicesCount = pendingInvoices.length;
  const pendingTotal = pendingInvoices.reduce((s, i) => s + owedOf(i), 0);
  const currentActiveRoute = activeTab === 'billing'
    ? 'ReceptionistDashboard_billing'
    : activeTab === 'myQueue'
    ? 'ReceptionistDashboard_myQueue'
    : 'ReceptionistDashboard_createVisit';

  // ── Tiếp nhận: tiến độ các bước ────────────────────────────────────────────
  const selectedPatient = patients.find(p => p._id === selectedPatientId);
  const selectedDoctor = doctors.find(d => d._id === selectedDoctorId);
  const selectedNurse = nurses.find(n => n._id === selectedNurseId);
  const stepsDone = [!!selectedPatient, !!selectedDoctor, !!selectedNurse, !!reason.trim()];
  const doneCount = stepsDone.filter(Boolean).length;
  const canSubmit = stepsDone[0] && stepsDone[1] && stepsDone[2];
  const REASON_CHIPS = ['Đau đầu kéo dài', 'Tái khám u não', 'Chụp MRI theo hẹn', 'Co giật', 'Mờ mắt, chóng mặt', 'Khám tổng quát'];

  // ── Lượt khám: gom theo cột trạng thái ─────────────────────────────────────
  const [queueSearch, setQueueSearch] = useState('');
  const BOARD = [
    { key: 'wait', title: 'Chờ khám', color: '#D97706', bg: '#FFFBEB', icon: Hourglass, statuses: ['đang chờ', 'tái khám định kỳ'] },
    { key: 'exam', title: 'Đang khám', color: '#1A5FD0', bg: '#EFF5FF', icon: Stethoscope, statuses: ['đang khám'] },
    { key: 'para', title: 'Cận lâm sàng & MRI', color: '#7C3AED', bg: '#F5F0FF', icon: ScanLine, statuses: ['chờ chụp', 'đang chụp', 'chờ chụp lại', 'chờ kết quả AI', 'lỗi AI', 'chờ bác sĩ đọc', 'chờ hội chẩn', 'chờ chụp sau phẫu thuật'] },
    { key: 'done', title: 'Hoàn tất & Nhập viện', color: '#0F9D6B', bg: '#EEFBF5', icon: BadgeCheck, statuses: ['hoàn tất', 'đã đóng', 'chờ nhập viện', 'no_show', 'đã hủy'] },
  ];
  const queueFiltered = visits.filter(v => personName(v.patientId).toLowerCase().includes(queueSearch.trim().toLowerCase()));
  const columnOf = (status) => (BOARD.find(c => c.statuses.includes(status)) || BOARD[0]).key;

  // ── Thu ngân: lọc & hóa đơn đang chọn ──────────────────────────────────────
  const [invoiceFilter, setInvoiceFilter] = useState('pending');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const shownInvoices = invoices.filter(i =>
    invoiceFilter === 'all' ? true : invoiceFilter === 'paid' ? isPaidStatus(i.status) : i.status === 'chờ thanh toán');
  const selectedInvoice = shownInvoices.find(i => i._id === selectedInvoiceId) || shownInvoices[0] || null;

  const { width } = useWindowDimensions();
  const isWide = width > 1180;

  const TABS = [
    { key: 'createVisit', label: 'Tiếp nhận', icon: UserPlus },
    { key: 'myQueue', label: 'Lượt khám hôm nay', icon: ClipboardList, count: visits.length },
    { key: 'billing', label: 'Thu ngân & BHYT', icon: Wallet, count: pendingInvoicesCount, warn: true },
  ];

  const banner = activeTab === 'createVisit' ? (
    <ReceptionBanner
      image={RECEPTION_IMAGES.tablet}
      tone="teal"
      eyebrow="Quầy tiếp đón"
      title="Tiếp nhận bệnh nhân"
      subtitle="Bốn bước: chọn bệnh nhân, phân công bác sĩ, điều dưỡng và ghi lý do khám."
      right={(
        <View style={st.bannerStat}>
          <Text style={st.bannerStatValue}>{doneCount}/4</Text>
          <Text style={st.bannerStatLabel}>bước đã hoàn thành</Text>
          <View style={st.bannerProgress}><View style={[st.bannerProgressFill, { width: `${doneCount * 25}%` }]} /></View>
        </View>
      )}
    />
  ) : activeTab === 'myQueue' ? (
    <ReceptionBanner
      image={RECEPTION_IMAGES.corridor}
      tone="indigo"
      eyebrow="Theo dõi trong ngày"
      title="Lượt khám hôm nay"
      subtitle="Bảng trạng thái theo thời gian thực — bấm vào thẻ để mở phiếu khám của bệnh nhân."
      right={(
        <View style={st.bannerChips}>
          {BOARD.map(c => (
            <View key={c.key} style={st.bannerChip}>
              <Text style={st.bannerChipValue}>{visits.filter(v => columnOf(v.status) === c.key).length}</Text>
              <Text style={st.bannerChipLabel}>{c.title}</Text>
            </View>
          ))}
        </View>
      )}
    />
  ) : (
    <ReceptionBanner
      image={RECEPTION_IMAGES.payment}
      tone="amber"
      eyebrow="Quầy thu ngân"
      title="Thu ngân & BHYT"
      subtitle="Áp dụng BHYT, thu tiền mặt hoặc tạo mã VietQR PayOS cho từng hóa đơn."
      right={(
        <View style={st.bannerStat}>
          <Text style={st.bannerStatLabel}>Tổng cần thu</Text>
          <Text style={st.bannerStatValue}>{formatVnd(pendingTotal)}</Text>
          <Text style={st.bannerStatLabel}>{pendingInvoicesCount} hóa đơn đang chờ</Text>
        </View>
      )}
    />
  );

  // ── Thẻ BHYT xem trước: nhóm số theo định dạng thẻ (2-1-2-10) ─────────────
  const cardDigits = (bhytCardNumber || '').replace(/\s+/g, '').toUpperCase();
  const cardPretty = cardDigits
    ? [cardDigits.slice(0, 2), cardDigits.slice(2, 3), cardDigits.slice(3, 5), cardDigits.slice(5, 15)].filter(Boolean).join(' ')
    : '•• • •• ••••••••••';

  return (
    <ResponsiveLayout navigation={navigation} title={headerTitle} user={user} activeRoute={currentActiveRoute}>
      <ScrollView style={st.page} contentContainerStyle={st.pageContent} keyboardShouldPersistTaps="handled">
        {banner}

        {/* Thanh tab dạng viên thuốc, nổi lên trên banner */}
        <View style={st.tabBar}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[st.tab, active && st.tabActive]}
                onPress={() => setActiveTab(t.key)}
                dataSet={active ? undefined : { hover: 'tint' }}
              >
                <Icon size={16} color={active ? '#FFFFFF' : '#475569'} />
                <Text style={[st.tabText, active && st.tabTextActive]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[st.tabCount, active ? st.tabCountActive : t.warn && st.tabCountWarn]}>
                    <Text style={[st.tabCountText, (active || t.warn) && { color: '#FFFFFF' }]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1A5FD0" style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* ═════════════ TAB 1: TIẾP NHẬN (WIZARD) ═════════════ */}
            {activeTab === 'createVisit' && (
              <View style={[st.wizard, isWide && { flexDirection: 'row' }]}>
                <View style={[{ gap: 18 }, isWide && { flex: 1.65 }]}>
                  {/* Bước 1 */}
                  <Reveal style={st.stepCard}>
                    <StepHead n={1} done={stepsDone[0]} title="Chọn bệnh nhân" hint="Tìm theo tên, email hoặc mã y tế">
                      <TouchableOpacity
                        style={[st.bhytBtn, !selectedPatientId && { opacity: 0.55 }]}
                        dataSet={{ hover: 'glow' }}
                        onPress={() => {
                          if (!selectedPatientId) {
                            Alert.alert('Thông báo', 'Vui lòng bấm chọn 1 bệnh nhân trong danh sách trước khi khai báo thẻ BHYT.');
                            return;
                          }
                          setShowBhytModal(true);
                        }}
                      >
                        <ShieldCheck size={15} color="#FFFFFF" />
                        <Text style={st.bhytBtnText}>Khai báo thẻ BHYT</Text>
                      </TouchableOpacity>
                    </StepHead>
                    <View style={st.searchBox}>
                      <Search size={16} color="#94A3B8" />
                      <TextInput
                        style={st.searchInput}
                        placeholder="Tìm theo tên, email, hoặc mã y tế..."
                        placeholderTextColor="#94A3B8"
                        value={searchPatient}
                        onChangeText={setSearchPatient}
                      />
                    </View>
                    <View style={st.patientGrid}>
                      {filteredPatients.slice(0, 12).map(p => {
                        const active = selectedPatientId === p._id;
                        return (
                          <TouchableOpacity
                            key={p._id}
                            style={[st.patientCard, active && st.patientCardActive, { width: isWide ? '31.8%' : '48.5%' }]}
                            onPress={() => setSelectedPatientId(p._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(p)} size={40} />
                            <View style={{ flex: 1 }}>
                              <Text style={st.patientName} numberOfLines={1}>{personName(p)}</Text>
                              <Text style={st.patientId} numberOfLines={1}>Mã: {p.profile?.medicalId || 'Chưa có'}</Text>
                            </View>
                            {active && <View style={st.checkDot}><Check size={13} color="#FFFFFF" strokeWidth={3} /></View>}
                          </TouchableOpacity>
                        );
                      })}
                      {filteredPatients.length === 0 && (
                        <Text style={st.muted}>Không tìm thấy bệnh nhân phù hợp. Bệnh nhân mới cần đăng ký tài khoản trước.</Text>
                      )}
                    </View>
                  </Reveal>

                  {/* Bước 2 */}
                  <Reveal delay={80} style={st.stepCard}>
                    <StepHead n={2} done={stepsDone[1]} title="Phân công bác sĩ" hint="Thanh tải thể hiện số bệnh nhân đang chờ của từng bác sĩ" />
                    <View style={st.doctorGrid}>
                      {doctors.map(d => {
                        const q = d.queueSize || 0;
                        const active = selectedDoctorId === d._id;
                        const isLeastBusy = d._id === leastBusyDoctorId;
                        const loadColor = q === 0 ? '#0F9D6B' : q >= 5 ? '#DC2626' : '#D97706';
                        return (
                          <TouchableOpacity
                            key={d._id}
                            style={[st.doctorCard, active && st.doctorCardActive, { width: isWide ? '48.8%' : '100%' }]}
                            onPress={() => setSelectedDoctorId(d._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(d)} size={44} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[st.doctorName, active && { color: '#FFFFFF' }]} numberOfLines={1}>{personName(d)}</Text>
                              </View>
                              <View style={st.loadTrack}>
                                <View style={[st.loadFill, { width: `${Math.min(q / 6, 1) * 100}%`, backgroundColor: active ? '#FFFFFF' : loadColor }]} />
                              </View>
                              <Text style={[st.loadText, active && { color: '#DBEAFE' }]}>{q} bệnh nhân đang chờ</Text>
                            </View>
                            {isLeastBusy && (
                              <View style={[st.suggest, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Sparkles size={12} color={active ? '#FFFFFF' : '#0F9D6B'} />
                                <Text style={[st.suggestText, active && { color: '#FFFFFF' }]}>Gợi ý</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Reveal>

                  {/* Bước 3 */}
                  <Reveal delay={140} style={st.stepCard}>
                    <StepHead n={3} done={stepsDone[2]} title="Phân công điều dưỡng" hint="Điều dưỡng sẽ đo sinh hiệu trước khi bác sĩ khám" />
                    <View style={st.chipWrap}>
                      {nurses.map(n => {
                        const active = selectedNurseId === n._id;
                        return (
                          <TouchableOpacity
                            key={n._id}
                            style={[st.nurseChip, active && st.nurseChipActive]}
                            onPress={() => setSelectedNurseId(n._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(n)} size={30} />
                            <Text style={[st.nurseText, active && { color: '#FFFFFF' }]} numberOfLines={1}>{personName(n)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Reveal>

                  {/* Bước 4 */}
                  <Reveal delay={200} style={st.stepCard}>
                    <StepHead n={4} done={stepsDone[3]} title="Lý do khám & hình thức" hint="Chọn nhanh hoặc nhập triệu chứng" />
                    <View style={st.segment}>
                      {['Ngoại trú', 'Nội trú'].map(t => (
                        <TouchableOpacity key={t} style={[st.segmentItem, visitType === t && st.segmentItemActive]} onPress={() => setVisitType(t)}>
                          <Text style={[st.segmentText, visitType === t && st.segmentTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={st.chipWrap}>
                      {REASON_CHIPS.map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[st.reasonChip, reason === r && st.reasonChipActive]}
                          onPress={() => setReason(r)}
                          dataSet={{ hover: 'tint' }}
                        >
                          <Text style={[st.reasonChipText, reason === r && { color: '#0B7A53' }]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={st.textarea}
                      placeholder="Triệu chứng, yêu cầu khám..."
                      placeholderTextColor="#94A3B8"
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                  </Reveal>
                </View>

                {/* Phiếu tiếp nhận xem trước */}
                <Reveal delay={120} style={[st.ticket, isWide && st.ticketSticky]}>
                  <View style={st.ticketHead}>
                    <Text style={st.ticketEyebrow}>PHIẾU TIẾP NHẬN</Text>
                    <Text style={st.ticketDate}>{new Date().toLocaleDateString('vi-VN')}</Text>
                  </View>
                  <View style={st.ticketPatient}>
                    {selectedPatient ? <Avatar name={personName(selectedPatient)} size={52} ring /> : <View style={st.ticketAvatarEmpty}><UserPlus size={22} color="#94A3B8" /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={st.ticketName} numberOfLines={2}>{selectedPatient ? personName(selectedPatient) : 'Chưa chọn bệnh nhân'}</Text>
                      <Text style={st.ticketSub}>{selectedPatient?.profile?.medicalId ? `Mã y tế ${selectedPatient.profile.medicalId}` : 'Bước 1'}</Text>
                    </View>
                  </View>
                  <View style={st.ticketCut}>
                    <View style={st.ticketNotchL} /><View style={st.ticketDash} /><View style={st.ticketNotchR} />
                  </View>
                  {[
                    { label: 'Bác sĩ', value: selectedDoctor ? personName(selectedDoctor) : '—', icon: Stethoscope },
                    { label: 'Điều dưỡng', value: selectedNurse ? personName(selectedNurse) : '—', icon: HeartPulse },
                    { label: 'Hình thức', value: visitType, icon: ClipboardList },
                    { label: 'Lý do', value: reason.trim() || '—', icon: Search },
                  ].map(row => {
                    const Icon = row.icon;
                    return (
                      <View key={row.label} style={st.ticketRow}>
                        <Icon size={14} color="#64748B" />
                        <Text style={st.ticketRowLabel}>{row.label}</Text>
                        <Text style={st.ticketRowValue} numberOfLines={2}>{row.value}</Text>
                      </View>
                    );
                  })}
                  <View style={st.ticketProgress}>
                    {stepsDone.map((d, i) => <View key={i} style={[st.ticketPip, d && st.ticketPipDone]} />)}
                  </View>
                  <TouchableOpacity
                    style={[st.submit, !canSubmit && st.submitDisabled]}
                    onPress={handleCreateVisit}
                    dataSet={canSubmit ? { hover: 'glow' } : undefined}
                  >
                    <Text style={st.submitText}>Xác nhận tạo lượt khám</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  {!canSubmit && <Text style={st.ticketHint}>Cần chọn bệnh nhân, bác sĩ và điều dưỡng.</Text>}
                </Reveal>
              </View>
            )}

            {/* ═════════════ TAB 2: LƯỢT KHÁM (KANBAN) ═════════════ */}
            {activeTab === 'myQueue' && (
              <View style={{ gap: 16 }}>
                <View style={st.toolbar}>
                  <View style={[st.searchBox, { flex: 1, marginBottom: 0 }]}>
                    <Search size={16} color="#94A3B8" />
                    <TextInput
                      style={st.searchInput}
                      placeholder="Lọc theo tên bệnh nhân..."
                      placeholderTextColor="#94A3B8"
                      value={queueSearch}
                      onChangeText={setQueueSearch}
                    />
                  </View>
                  <TouchableOpacity style={st.toolBtn} onPress={fetchVisits} dataSet={{ hover: 'tint' }}>
                    <RefreshCw size={15} color="#4F46E5" />
                    <Text style={st.toolBtnText}>Làm mới</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.toolBtn, st.toolBtnPrimary]} onPress={() => setActiveTab('createVisit')} dataSet={{ hover: 'glow' }}>
                    <UserPlus size={15} color="#FFFFFF" />
                    <Text style={[st.toolBtnText, { color: '#FFFFFF' }]}>Tiếp nhận mới</Text>
                  </TouchableOpacity>
                </View>

                {visits.length === 0 ? (
                  <View style={st.panel}>
                    <EmptyState
                      icon={Inbox}
                      tint="#4F46E5"
                      title="Hôm nay chưa có lượt khám nào"
                      text="Khi bạn tiếp nhận bệnh nhân, thẻ của họ sẽ xuất hiện ở cột 'Chờ khám' và tự di chuyển theo tiến trình khám."
                      actionLabel="Tiếp nhận bệnh nhân"
                      onAction={() => setActiveTab('createVisit')}
                    />
                  </View>
                ) : (
                  <View style={[st.board, isWide && { flexDirection: 'row' }]}>
                    {BOARD.map((col, ci) => {
                      const ColIcon = col.icon;
                      const items = queueFiltered.filter(v => columnOf(v.status) === col.key);
                      return (
                        <Reveal key={col.key} delay={ci * 90} style={[st.column, { backgroundColor: col.bg }, isWide && { flex: 1 }]}>
                          <View style={st.columnHead}>
                            <View style={[st.columnIcon, { backgroundColor: col.color }]}><ColIcon size={14} color="#FFFFFF" /></View>
                            <Text style={st.columnTitle}>{col.title}</Text>
                            <View style={[st.columnCount, { borderColor: col.color }]}><Text style={[st.columnCountText, { color: col.color }]}>{items.length}</Text></View>
                          </View>
                          {items.length === 0 ? (
                            <View style={st.columnEmpty}><Text style={st.muted}>Trống</Text></View>
                          ) : items.map(v => (
                            <TouchableOpacity
                              key={v._id}
                              style={[st.visitCard, v.priority === 'khẩn cấp' && st.visitCardUrgent]}
                              dataSet={{ hover: 'lift' }}
                              onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } })}
                            >
                              <View style={st.visitTop}>
                                <Avatar name={personName(v.patientId)} size={34} />
                                <View style={{ flex: 1 }}>
                                  <Text style={st.visitName} numberOfLines={1}>{personName(v.patientId)}</Text>
                                  <Text style={st.visitTime}>{new Date(v.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {v.visitType || 'Ngoại trú'}</Text>
                                </View>
                              </View>
                              <Text style={st.visitReason} numberOfLines={2}>{v.reason || 'Khám tổng quát'}</Text>
                              <View style={st.visitFoot}>
                                <Text style={st.visitDoctor} numberOfLines={1}>BS. {personName(v.doctorId)}</Text>
                                <ClinicalStatusBadge status={v.status} size="sm" />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </Reveal>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ═════════════ TAB 3: THU NGÂN (POS) ═════════════ */}
            {activeTab === 'billing' && (
              <View style={{ gap: 16 }}>
                <View style={st.toolbar}>
                  {[
                    { key: 'pending', label: 'Chờ thu', count: pendingInvoicesCount },
                    { key: 'paid', label: 'Đã thu', count: invoices.filter(i => isPaidStatus(i.status)).length },
                    { key: 'all', label: 'Tất cả', count: invoices.length },
                  ].map(f => (
                    <TouchableOpacity
                      key={f.key}
                      style={[st.filterChip, invoiceFilter === f.key && st.filterChipActive]}
                      onPress={() => { setInvoiceFilter(f.key); setSelectedInvoiceId(null); }}
                    >
                      <Text style={[st.filterChipText, invoiceFilter === f.key && { color: '#FFFFFF' }]}>{f.label} · {f.count}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={st.toolBtn} onPress={fetchInvoices} dataSet={{ hover: 'tint' }}>
                    <RefreshCw size={15} color="#B45309" />
                    <Text style={[st.toolBtnText, { color: '#B45309' }]}>Làm mới</Text>
                  </TouchableOpacity>
                </View>

                {shownInvoices.length === 0 ? (
                  <View style={st.panel}>
                    <EmptyState icon={BadgeCheck} tint="#0F9D6B" title="Không có hóa đơn nào ở mục này" text="Hóa đơn mới sẽ xuất hiện khi điều dưỡng hoặc bác sĩ gửi phiếu thu sang quầy." />
                  </View>
                ) : (
                  <View style={[st.pos, isWide && { flexDirection: 'row' }]}>
                    {/* Danh sách hóa đơn */}
                    <View style={[{ gap: 10 }, isWide && { flex: 1 }]}>
                      {shownInvoices.map((inv, i) => {
                        const active = selectedInvoice?._id === inv._id;
                        const paid = isPaidStatus(inv.status);
                        return (
                          <Reveal key={inv._id} delay={i * 60}>
                            <TouchableOpacity
                              style={[st.invRow, active && st.invRowActive]}
                              onPress={() => setSelectedInvoiceId(inv._id)}
                              dataSet={active ? undefined : { hover: 'lift' }}
                            >
                              <Avatar name={personName(inv.patientId)} size={40} />
                              <View style={{ flex: 1 }}>
                                <Text style={st.invName} numberOfLines={1}>{personName(inv.patientId)}</Text>
                                <Text style={st.invMeta}>{new Date(inv.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} · {(inv.items || []).length} dịch vụ</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Text style={[st.invAmount, paid && { color: '#0F9D6B' }]}>{formatVnd(owedOf(inv))}</Text>
                                <View style={[st.invPill, paid ? st.invPillPaid : st.invPillPending]}>
                                  <Text style={[st.invPillText, { color: paid ? '#0B7A53' : '#B45309' }]}>{paid ? 'Đã thu' : inv.status === 'chờ thanh toán' ? 'Chờ thu' : inv.status}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          </Reveal>
                        );
                      })}
                    </View>

                    {/* Biên lai chi tiết */}
                    {selectedInvoice && (() => {
                      const inv = selectedInvoice;
                      const bhytCovered = inv.bhytInfo?.bhytAmount > 0;
                      const mustPay = owedOf(inv);
                      const paid = isPaidStatus(inv.status);
                      return (
                        <Reveal key={inv._id} style={[st.receipt, isWide && { flex: 1.1 }]}>
                          <View style={st.receiptTop}>
                            <View>
                              <Text style={st.receiptEyebrow}>BIÊN LAI VIỆN PHÍ</Text>
                              <Text style={st.receiptName}>{personName(inv.patientId)}</Text>
                              <Text style={st.receiptSub}>Mã lượt khám #{String(inv.visitId?._id || inv.visitId || '').slice(-6).toUpperCase()}</Text>
                            </View>
                            <View style={st.receiptIcon}><ReceiptText size={22} color="#B45309" /></View>
                          </View>

                          <View style={st.receiptItems}>
                            {(inv.items || []).map((item, idx) => (
                              <View key={idx} style={st.lineRow}>
                                <Text style={st.lineDesc} numberOfLines={2}>{item.description}</Text>
                                <View style={st.lineDots} />
                                <Text style={st.lineAmount}>{formatVnd(item.amount)}</Text>
                              </View>
                            ))}
                            <View style={[st.lineRow, { marginTop: 6 }]}>
                              <Text style={[st.lineDesc, { fontWeight: '700' }]}>Tổng chi phí</Text>
                              <View style={st.lineDots} />
                              <Text style={[st.lineAmount, { fontWeight: '800' }]}>{formatVnd(inv.totalAmount)}</Text>
                            </View>
                            {bhytCovered ? (
                              <View style={st.lineRow}>
                                <Text style={[st.lineDesc, { color: '#0B7A53' }]}>BHYT chi trả ({inv.bhytInfo.coverageRate}%)</Text>
                                <View style={st.lineDots} />
                                <Text style={[st.lineAmount, { color: '#0B7A53' }]}>-{formatVnd(inv.bhytInfo.bhytAmount)}</Text>
                              </View>
                            ) : (
                              <Text style={st.receiptNote}>Chưa khấu trừ BHYT cho hóa đơn này.</Text>
                            )}
                          </View>

                          <View style={st.dueBox}>
                            <Text style={st.dueLabel}>{paid ? 'Đã thu' : bhytCovered ? 'Bệnh nhân đồng chi trả' : 'Bệnh nhân cần trả'}</Text>
                            <Text style={st.dueValue}>{formatVnd(mustPay)}</Text>
                          </View>

                          {paid ? (
                            <View style={st.stamp}><Text style={st.stampText}>ĐÃ THANH TOÁN</Text></View>
                          ) : inv.status === 'chờ thanh toán' ? (
                            <View style={{ gap: 10 }}>
                              <View style={st.payRow}>
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#0F9D6B' }]} onPress={() => handlePayInvoice(inv._id)} dataSet={{ hover: 'glow' }}>
                                  <Banknote size={18} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>Thu tiền mặt</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#1A5FD0' }]} onPress={() => handlePayOSPayment(inv._id)} dataSet={{ hover: 'glow' }}>
                                  <QrCode size={18} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>VietQR PayOS</Text>
                                </TouchableOpacity>
                              </View>
                              {!bhytCovered && (
                                <TouchableOpacity
                                  style={st.bhytApply}
                                  onPress={() => handleApplyBhyt(inv)}
                                  disabled={applyingBhytId === inv._id}
                                  dataSet={{ hover: 'tint' }}
                                >
                                  <ShieldCheck size={16} color="#7C3AED" />
                                  <Text style={st.bhytApplyText}>{applyingBhytId === inv._id ? 'Đang tính quyền lợi...' : 'Áp dụng BHYT trước khi thu'}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : null}
                        </Reveal>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── MODAL KHAI BÁO THẺ BHYT (có thẻ xem trước) ─────────────────────── */}
      <Modal visible={showBhytModal} transparent animationType="fade" onRequestClose={() => setShowBhytModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>Khai báo thẻ BHYT</Text>
              <TouchableOpacity style={st.modalClose} onPress={() => setShowBhytModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Thẻ bảo hiểm xem trước */}
            <View style={st.insCard} dataSet={{ bg: 'band' }}>
              <View style={st.insCardTop}>
                <Text style={st.insCardBrand}>BẢO HIỂM Y TẾ</Text>
                <View style={st.insRate}><Text style={st.insRateText}>{bhytCoverageRate}%</Text></View>
              </View>
              <Text style={st.insNumber}>{cardPretty}</Text>
              <View style={st.insCardBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={st.insLabel}>Họ tên</Text>
                  <Text style={st.insValue} numberOfLines={1}>{selectedPatient ? personName(selectedPatient) : '—'}</Text>
                </View>
                <View>
                  <Text style={st.insLabel}>Hạn thẻ</Text>
                  <Text style={st.insValue}>{bhytExpiryDate || '—'}</Text>
                </View>
              </View>
            </View>

            <Text style={st.fieldLabel}>Mã số thẻ BHYT (15 ký tự)</Text>
            <TextInput
              style={st.modalInput}
              placeholder="VD: GD4912345678901"
              placeholderTextColor="#94A3B8"
              value={bhytCardNumber}
              onChangeText={setBhytCardNumber}
              autoCapitalize="characters"
              maxLength={15}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Hạn thẻ (YYYY-MM-DD)</Text>
                <TextInput style={st.modalInput} value={bhytExpiryDate} onChangeText={setBhytExpiryDate} placeholder="2027-12-31" placeholderTextColor="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Mức hưởng</Text>
                <View style={st.segment}>
                  {[80, 95, 100].map(rate => (
                    <TouchableOpacity key={rate} style={[st.segmentItem, bhytCoverageRate === rate && st.segmentItemActive]} onPress={() => setBhytCoverageRate(rate)}>
                      <Text style={[st.segmentText, bhytCoverageRate === rate && st.segmentTextActive]}>{rate}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={st.fieldLabel}>Nơi đăng ký KCB ban đầu</Text>
            <TextInput
              style={st.modalInput}
              placeholder="VD: Bệnh viện Đa khoa Tỉnh..."
              placeholderTextColor="#94A3B8"
              value={bhytRegistrationPlace}
              onChangeText={setBhytRegistrationPlace}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              {[
                { on: bhytIsOutOfNetwork, set: () => setBhytIsOutOfNetwork(!bhytIsOutOfNetwork), label: 'Trái tuyến', color: '#B45309' },
                { on: bhytHasTransferForm, set: () => setBhytHasTransferForm(!bhytHasTransferForm), label: 'Có giấy chuyển tuyến', color: '#0B7A53' },
              ].map(t => (
                <TouchableOpacity key={t.label} style={[st.toggle, t.on && { borderColor: t.color, backgroundColor: `${t.color}12` }]} onPress={t.set}>
                  <View style={[st.toggleBox, t.on && { backgroundColor: t.color, borderColor: t.color }]}>
                    {t.on && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[st.toggleText, t.on && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={st.btnGhost} onPress={() => setShowBhytModal(false)}>
                <Text style={st.btnGhostText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btnSolid, savingBhyt && { opacity: 0.6 }]} onPress={handleSaveBhyt} disabled={savingBhyt}>
                <Text style={st.btnSolidText}>{savingBhyt ? 'Đang lưu...' : 'Lưu & thẩm định quyền lợi'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ResponsiveLayout>
  );
};

// Tiêu đề mỗi bước trong wizard tiếp nhận
const StepHead = ({ n, done, title, hint, children }) => (
  <View style={st.stepHead}>
    <View style={[st.stepNum, done && st.stepNumDone]}>
      {done ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : <Text style={st.stepNumText}>{n}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>{title}</Text>
      {hint ? <Text style={st.stepHint}>{hint}</Text> : null}
    </View>
    {children}
  </View>
);

const isWebPlatform = Platform.OS === 'web';
const cardShadow = isWebPlatform ? { boxShadow: '0 12px 30px -20px rgba(11,42,91,0.35)' } : { elevation: 2 };

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F8FC' },
  pageContent: { padding: 28, paddingBottom: 56, maxWidth: 1360, width: '100%', alignSelf: 'center', gap: 20 },
  muted: { color: '#94A3B8', fontSize: 13 },

  // Banner phụ
  bannerStat: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 18, minWidth: 220 },
  bannerStatValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginVertical: 2 },
  bannerStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  bannerProgress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 10, overflow: 'hidden' },
  bannerProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#6FDDB2' },
  bannerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bannerChip: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minWidth: 96 },
  bannerChipValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  bannerChipLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },

  // Thanh tab
  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', padding: 6, borderRadius: 999, marginTop: -44, marginLeft: 24, zIndex: 3, ...(isWebPlatform ? { boxShadow: '0 14px 30px -14px rgba(11,42,91,0.45)' } : { elevation: 4 }) },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: '#0B2A5B' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  tabCountActive: { backgroundColor: '#0F9D6B' },
  tabCountWarn: { backgroundColor: '#D97706' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  // Wizard tiếp nhận
  wizard: { gap: 18, alignItems: 'flex-start' },
  stepCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...cardShadow },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  stepNum: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#0F9D6B', alignItems: 'center', justifyContent: 'center' },
  stepNumDone: { backgroundColor: '#0F9D6B' },
  stepNumText: { color: '#0F9D6B', fontWeight: '800' },
  stepTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  stepHint: { fontSize: 12, color: '#64748B', marginTop: 1 },
  bhytBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  bhytBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A', ...(isWebPlatform ? { outlineStyle: 'none' } : {}) },
  patientGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  patientCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  patientCardActive: { borderColor: '#0F9D6B', backgroundColor: '#EEFBF5' },
  patientName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  patientId: { fontSize: 11, color: '#64748B', marginTop: 1 },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0F9D6B', alignItems: 'center', justifyContent: 'center' },
  doctorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  doctorCardActive: { backgroundColor: '#1A5FD0', borderColor: '#1A5FD0' },
  doctorName: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  loadTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF2F7', marginTop: 8, overflow: 'hidden' },
  loadFill: { height: '100%', borderRadius: 3, minWidth: 6 },
  loadText: { fontSize: 11, color: '#64748B', marginTop: 4 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F7EF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  suggestText: { color: '#0F9D6B', fontSize: 11, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nurseChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', maxWidth: 320 },
  nurseChipActive: { backgroundColor: '#DB2777', borderColor: '#DB2777' },
  nurseText: { fontSize: 13, fontWeight: '600', color: '#334155', flexShrink: 1 },
  segment: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 12, alignSelf: 'flex-start' },
  segmentItem: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9 },
  segmentItemActive: { backgroundColor: '#FFFFFF', ...(isWebPlatform ? { boxShadow: '0 2px 6px rgba(15,23,42,0.12)' } : {}) },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { color: '#0B2A5B', fontWeight: '800' },
  reasonChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  reasonChipActive: { borderColor: '#0F9D6B', backgroundColor: '#E3F7EF' },
  reasonChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  textarea: { marginTop: 12, minHeight: 90, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', textAlignVertical: 'top' },

  // Phiếu tiếp nhận
  ticket: { backgroundColor: '#0B2A5B', borderRadius: 22, padding: 22, width: '100%', ...(isWebPlatform ? { boxShadow: '0 24px 50px -24px rgba(11,42,91,0.6)' } : { elevation: 6 }) },
  ticketSticky: { flex: 1, ...(isWebPlatform ? { position: 'sticky', top: 16 } : {}) },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  ticketEyebrow: { color: '#6FDDB2', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  ticketDate: { color: '#93C5FD', fontSize: 12 },
  ticketPatient: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ticketAvatarEmpty: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderStyle: 'dashed', borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  ticketName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  ticketSub: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  ticketCut: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, marginHorizontal: -22 },
  ticketNotchL: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F8FC', marginLeft: -9 },
  ticketNotchR: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F8FC', marginRight: -9 },
  ticketDash: { flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },
  ticketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  ticketRowLabel: { color: '#93C5FD', fontSize: 12, width: 76 },
  ticketRowValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
  ticketProgress: { flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 16 },
  ticketPip: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  ticketPipDone: { backgroundColor: '#6FDDB2' },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F9D6B', paddingVertical: 14, borderRadius: 14 },
  submitDisabled: { backgroundColor: '#334155' },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  ticketHint: { color: '#93C5FD', fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Kanban
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  toolBtnPrimary: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  toolBtnText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', ...cardShadow },
  board: { gap: 14, alignItems: 'flex-start' },
  column: { borderRadius: 18, padding: 12, gap: 10, width: '100%', minHeight: 160 },
  columnHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  columnIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  columnTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  columnCount: { minWidth: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#FFFFFF' },
  columnCountText: { fontSize: 12, fontWeight: '800' },
  columnEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 22, alignItems: 'center' },
  visitCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, ...cardShadow },
  visitCardUrgent: { borderColor: '#FCA5A5', borderLeftWidth: 4, borderLeftColor: '#DC2626' },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  visitTime: { fontSize: 11, color: '#64748B', marginTop: 1 },
  visitReason: { fontSize: 12, color: '#334155', lineHeight: 17 },
  visitFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  visitDoctor: { fontSize: 11, color: '#64748B', flex: 1 },

  // POS thu ngân
  filterChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E3C3' },
  filterChipActive: { backgroundColor: '#B45309', borderColor: '#B45309' },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  pos: { gap: 18, alignItems: 'flex-start' },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  invRowActive: { borderColor: '#D97706', backgroundColor: '#FFFBF3' },
  invName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  invMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  invAmount: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  invPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  invPillPaid: { backgroundColor: '#E3F7EF' },
  invPillPending: { backgroundColor: '#FEF3C7' },
  invPillText: { fontSize: 11, fontWeight: '800' },
  receipt: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#F3E3C3', width: '100%', overflow: 'hidden', position: 'relative', ...(isWebPlatform ? { boxShadow: '0 24px 50px -28px rgba(146,64,14,0.45)' } : { elevation: 4 }) },
  receiptTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  receiptEyebrow: { color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  receiptName: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  receiptSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  receiptIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  receiptItems: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#E7D3AE', paddingVertical: 14, gap: 10 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  lineDesc: { fontSize: 13, color: '#334155', flexShrink: 1, maxWidth: '62%' },
  lineDots: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dotted', borderColor: '#CBD5E1', marginBottom: 4 },
  lineAmount: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  receiptNote: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  dueBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginVertical: 18 },
  dueLabel: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  dueValue: { fontSize: 28, fontWeight: '800', color: '#B45309' },
  payRow: { flexDirection: 'row', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  bhytApply: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  bhytApplyText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },
  stamp: { alignSelf: 'center', borderWidth: 3, borderColor: '#0F9D6B', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 22, transform: [{ rotate: '-6deg' }] },
  stampText: { color: '#0F9D6B', fontWeight: '900', fontSize: 18, letterSpacing: 2 },

  // Modal BHYT
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,42,91,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 520 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0B2A5B' },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  insCard: { borderRadius: 18, padding: 20, backgroundColor: '#0F9D6B', marginBottom: 18, overflow: 'hidden' },
  insCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insCardBrand: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  insRate: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  insRateText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  insNumber: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 3, marginVertical: 18, fontVariant: ['tabular-nums'] },
  insCardBottom: { flexDirection: 'row', gap: 16 },
  insLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  insValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 4 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 10 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  toggleBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  btnGhostText: { color: '#475569', fontWeight: '700' },
  btnSolid: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#0F9D6B', alignItems: 'center' },
  btnSolidText: { color: '#FFFFFF', fontWeight: '800' },
});

export default NurseReceptionScreen;
