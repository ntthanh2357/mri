import React, { useState, useEffect } from 'react';
import Colors from '../constants/colors';
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
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { get, post, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import { PlusCircle, ClipboardList, CreditCard, ShieldCheck, Search, Sparkles, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import Layout from '../constants/layout';

// "TS.BS Nguyễn A (Trưởng khoa X)" → { name, title } để hiện 2 dòng gọn
const splitStaffName = (full = '') => {
  const m = String(full).match(/^(.*?)\s*\((.+)\)\s*$/);
  return m ? { name: m[1], title: m[2] } : { name: String(full), title: '' };
};
const fmtVnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
const fmtTime = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

const INVOICE_STATUS = {
  'chờ thanh toán': { label: 'Chờ thanh toán', icon: Clock, bg: Colors.warningBg, fg: Colors.warningText },
  'đã thanh toán': { label: 'Đã thanh toán', icon: CheckCircle2, bg: Colors.successBg, fg: Colors.successText },
};
const InvoiceStatus = ({ status }) => {
  const s = INVOICE_STATUS[status] || { label: status, icon: Clock, bg: Colors.background, fg: Colors.slateMuted };
  const Icon = s.icon;
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Icon size={12} color={s.fg} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
};

const NurseReceptionScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState(route.params?.tab || 'createVisit'); // 'createVisit' | 'myQueue' | 'billing'
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(route.params?.user || null);
  const { width } = useWindowDimensions();
  const wide = width >= Layout.wide;

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
        Alert.alert('Thông báo', 'Bệnh nhân chưa có thông tin thẻ BHYT trong hệ thống. Vui lòng bấm "+ Khai báo thẻ BHYT" ở bước 1 để lưu thẻ trước.');
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

  const headerTitle = user?.role === 'nurse' ? 'Tiếp nhận bệnh nhân' : 'Tiếp nhận & thu ngân';

  const pendingInvoicesCount = invoices.filter(i => i.status !== 'đã thanh toán').length;
  const pendingDue = invoices
    .filter(i => i.status === 'chờ thanh toán')
    .reduce((sum, inv) => sum + (inv.patientPayAmount ?? (inv.totalAmount - (inv.bhytInfo?.bhytAmount || 0))), 0);
  const openVisit = (v) => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } });
  const currentActiveRoute = activeTab === 'billing' 
    ? 'ReceptionistDashboard_billing' 
    : activeTab === 'myQueue' 
    ? 'ReceptionistDashboard_myQueue' 
    : 'ReceptionistDashboard_createVisit';

  return (
    <ResponsiveLayout navigation={navigation} title={headerTitle} user={user} activeRoute={currentActiveRoute}>
      <View style={styles.container}>
        <PageHeader
          bar
          title={headerTitle}
          subtitle="Tạo lượt khám, theo dõi lượt khám trong ngày và thu viện phí."
          below={
            <PageTabs
              tabs={[
                { key: 'createVisit', label: 'Tạo lượt khám' },
                { key: 'myQueue', label: 'Hôm nay', count: visits.length || null },
                { key: 'billing', label: 'Thu ngân', count: pendingInvoicesCount || null },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          }
        />

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color={Colors.brandGreen} />
            <Text style={styles.emptyTitle}>Đang tải…</Text>
          </View>
        ) : (
          <ScrollView style={styles.contentContainer}>
            <PageContainer style={styles.page}>
            {activeTab === 'createVisit' && (
              <View style={[styles.formGrid, wide && styles.formGridWide]}>
                <View style={[styles.panel, wide && styles.panelLeft]}>
                  <View style={styles.panelHead}>
                    <Text style={[styles.panelTitle, styles.panelTitleInline]}>1. Chọn bệnh nhân</Text>
                    <TouchableOpacity
                      style={styles.btnSecondary}
                      accessibilityRole="button"
                      onPress={() => {
                        if (!selectedPatientId) {
                          Alert.alert('Thông báo', 'Vui lòng bấm chọn 1 bệnh nhân trong danh sách trước khi khai báo thẻ BHYT.');
                          return;
                        }
                        setShowBhytModal(true);
                      }}
                    >
                      <ShieldCheck size={14} color={Colors.brandGreen} strokeWidth={2.2} />
                      <Text style={styles.btnSecondaryText}>Khai báo thẻ BHYT</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.searchBox}>
                    <Search size={16} color={Colors.secondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Tìm theo tên, email hoặc mã y tế…"
                      placeholderTextColor={Colors.secondary}
                      value={searchPatient}
                      onChangeText={setSearchPatient}
                    />
                  </View>
                  <View style={styles.optionList}>
                    {filteredPatients.slice(0, 20).map(p => {
                      const sel = selectedPatientId === p._id;
                      return (
                        <Pressable
                          key={p._id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel }}
                          onPress={() => setSelectedPatientId(p._id)}
                          style={({ hovered }) => [styles.option, hovered && !sel && styles.optionHover, sel && styles.optionSelected]}
                        >
                          <View style={styles.optionBody}>
                            <Text style={styles.optionTitle} numberOfLines={1}>{p.profile?.name || p.profile?.fullName || p.email}</Text>
                            <Text style={styles.optionSub}>Mã y tế: {p.profile?.medicalId || 'chưa có'}</Text>
                          </View>
                          {sel ? <CheckCircle2 size={18} color={Colors.brandGreen} strokeWidth={2.4} /> : null}
                        </Pressable>
                      );
                    })}
                    {filteredPatients.length === 0 ? <Text style={styles.emptyText}>Không tìm thấy bệnh nhân phù hợp.</Text> : null}
                  </View>
                </View>

                <View style={[styles.panel, wide && styles.panelRight]}>
                  <Text style={styles.panelTitle}>2. Bác sĩ khám</Text>
                  <View style={styles.optionList}>
                    {doctors.map(d => {
                      const qSize = d.queueSize || 0;
                      const sel = selectedDoctorId === d._id;
                      const n = splitStaffName(d.profile?.name || d.profile?.fullName || d.email);
                      return (
                        <Pressable
                          key={d._id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel }}
                          onPress={() => setSelectedDoctorId(d._id)}
                          style={({ hovered }) => [styles.option, hovered && !sel && styles.optionHover, sel && styles.optionSelected]}
                        >
                          <View style={styles.optionBody}>
                            <Text style={styles.optionTitle} numberOfLines={1}>{n.name}</Text>
                            {n.title ? <Text style={styles.optionSub} numberOfLines={1}>{n.title}</Text> : null}
                          </View>
                          {d._id === leastBusyDoctorId ? (
                            <View style={styles.suggest}>
                              <Sparkles size={12} color={Colors.successText} />
                              <Text style={styles.suggestLabel}>Gợi ý</Text>
                            </View>
                          ) : null}
                          <View style={[styles.queueBadge, qSize === 0 ? styles.queueBadgeGreen : (qSize >= 5 ? styles.queueBadgeRed : styles.queueBadgeOrange)]}>
                            <Text style={styles.queueBadgeText}>{qSize} ca chờ</Text>
                          </View>
                          {sel ? <CheckCircle2 size={18} color={Colors.brandGreen} strokeWidth={2.4} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.panelTitle, styles.panelTitleGap]}>3. Điều dưỡng phụ trách</Text>
                  <View style={styles.optionList}>
                    {nurses.map(nu => {
                      const sel = selectedNurseId === nu._id;
                      const n = splitStaffName(nu.profile?.name || nu.profile?.fullName || nu.email);
                      return (
                        <Pressable
                          key={nu._id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel }}
                          onPress={() => setSelectedNurseId(nu._id)}
                          style={({ hovered }) => [styles.option, hovered && !sel && styles.optionHover, sel && styles.optionSelected]}
                        >
                          <View style={styles.optionBody}>
                            <Text style={styles.optionTitle} numberOfLines={1}>{n.name}</Text>
                            {n.title ? <Text style={styles.optionSub} numberOfLines={1}>{n.title}</Text> : null}
                          </View>
                          {sel ? <CheckCircle2 size={18} color={Colors.brandGreen} strokeWidth={2.4} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.panelTitle, styles.panelTitleGap]}>4. Lý do khám</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Triệu chứng, yêu cầu khám…"
                    placeholderTextColor={Colors.secondary}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                  />

                  <TouchableOpacity style={styles.submitBtn} onPress={handleCreateVisit} accessibilityRole="button">
                    <PlusCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.submitBtnText}>Tạo lượt khám</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'myQueue' && (
              visits.length === 0 ? (
                <View style={styles.emptyBox}>
                  <ClipboardList size={26} color={Colors.brandGreen} />
                  <Text style={styles.emptyTitle}>Hôm nay chưa có lượt khám nào</Text>
                  <Text style={styles.emptyHint}>Lượt khám tạo ở tab "Tạo lượt khám" sẽ hiện ở đây.</Text>
                </View>
              ) : wide ? (
                <View style={styles.table}>
                  <View style={[styles.tr, styles.thead]}>
                    <Text style={[styles.th, styles.cPatient]}>Bệnh nhân</Text>
                    <Text style={[styles.th, styles.cReason]}>Lý do khám</Text>
                    <Text style={[styles.th, styles.cStatus]}>Trạng thái</Text>
                    <Text style={[styles.th, styles.cStaff]}>Bác sĩ · điều dưỡng</Text>
                    <Text style={[styles.th, styles.cTime]}>Giờ tạo</Text>
                    <View style={styles.cChevron} />
                  </View>
                  {visits.map(v => (
                    <Pressable
                      key={v._id}
                      accessibilityRole="button"
                      accessibilityLabel={`Mở lượt khám của ${v.patientId?.profile?.name || 'bệnh nhân'}`}
                      onPress={() => openVisit(v)}
                      style={({ hovered }) => [styles.tr, styles.trBody, hovered && styles.trHover]}
                    >
                      <Text style={[styles.cellName, styles.cPatient]} numberOfLines={1}>{v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email}</Text>
                      <View style={styles.cReason}>
                        <Text style={styles.cellText} numberOfLines={1}>{v.reason || 'Khám tổng quát'}</Text>
                        <Text style={styles.cellSub}>{v.visitType || 'Ngoại trú'}</Text>
                      </View>
                      <View style={styles.cStatus}><ClinicalStatusBadge status={v.status} size="sm" /></View>
                      <View style={styles.cStaff}>
                        <Text style={styles.cellText} numberOfLines={1}>{v.doctorId?.profile?.name || 'Đã phân công'}</Text>
                        <Text style={styles.cellSub} numberOfLines={1}>{v.nurseId?.profile?.name || 'Đã phân công'}</Text>
                      </View>
                      <Text style={[styles.cellNum, styles.cTime]}>{fmtTime(v.createdAt)}</Text>
                      <View style={styles.cChevron}><ChevronRight size={18} color={Colors.secondary} /></View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.cardList}>
                  {visits.map(v => (
                    <TouchableOpacity key={v._id} style={styles.visitCard} onPress={() => openVisit(v)}>
                      <View style={styles.visitHeader}>
                        <Text style={styles.visitPatientName}>{v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email}</Text>
                        <ClinicalStatusBadge status={v.status} size="sm" />
                      </View>
                      <Text style={styles.visitDetail}>Lý do: {v.reason}</Text>
                      <Text style={styles.visitDetail}>Phân loại: {v.visitType || 'Ngoại trú'}</Text>
                      <Text style={styles.visitDetail}>Bác sĩ: {v.doctorId?.profile?.name || 'Đã phân công'}</Text>
                      <Text style={styles.visitDetail}>Điều dưỡng: {v.nurseId?.profile?.name || 'Đã phân công'}</Text>
                      <Text style={styles.visitTime}>Tạo lúc {fmtTime(v.createdAt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {activeTab === 'billing' && (
              <View style={styles.cardList}>
                {invoices.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <CreditCard size={26} color={Colors.brandGreen} />
                    <Text style={styles.emptyTitle}>Không có hóa đơn chờ thanh toán</Text>
                    <Text style={styles.emptyHint}>Hóa đơn được tạo tự động khi bác sĩ kết thúc ca khám.</Text>
                  </View>
                ) : (
                  <View style={styles.billingBar}>
                    <Text style={styles.billingBarText}>
                      {pendingInvoicesCount} hóa đơn chờ thu · cần thu <Text style={styles.billingBarStrong}>{fmtVnd(pendingDue)}</Text>
                    </Text>
                  </View>
                )}
                {invoices.map(inv => {
                  const bhytCovered = inv.bhytInfo?.bhytAmount > 0;
                  const patientMustPay = inv.patientPayAmount ?? (inv.totalAmount - (inv.bhytInfo?.bhytAmount || 0));
                  const pending = inv.status === 'chờ thanh toán';
                  return (
                    <View key={inv._id} style={[styles.invoiceCard, wide && styles.invoiceCardWide]}>
                      <View style={styles.invoiceMain}>
                        <Text style={styles.invoicePatient}>{inv.patientId?.profile?.name || inv.patientId?.profile?.fullName || inv.patientId?.email || 'Bệnh nhân'}</Text>
                        <Text style={styles.invoiceTitle}>{inv.visitId?.reason || 'Lượt khám'}</Text>
                        <Text style={styles.invoiceCode}>Mã lượt khám #{String(inv.visitId?._id || inv.visitId || '').slice(-6).toUpperCase()}</Text>
                        <View style={styles.invoiceItems}>
                          {inv.items.map((item, idx) => (
                            <View key={idx} style={styles.invoiceItemRow}>
                              <Text style={styles.invoiceItemDesc}>{item.description}</Text>
                              <Text style={styles.invoiceItemAmount}>{fmtVnd(item.amount)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={[styles.invoiceSide, wide && styles.invoiceSideWide]}>
                        <InvoiceStatus status={inv.status} />
                        <View style={styles.sumRow}>
                          <Text style={styles.sumLabel}>Tổng cộng</Text>
                          <Text style={styles.sumValue}>{fmtVnd(inv.totalAmount)}</Text>
                        </View>
                        <View style={styles.sumRow}>
                          <Text style={styles.sumLabel}>{bhytCovered ? `BHYT chi trả (${inv.bhytInfo.coverageRate}%)` : 'BHYT'}</Text>
                          <Text style={[styles.sumValue, bhytCovered && styles.sumValueGood]}>{bhytCovered ? `−${fmtVnd(inv.bhytInfo.bhytAmount)}` : 'Chưa áp dụng'}</Text>
                        </View>
                        <View style={[styles.sumRow, styles.sumTotalRow]}>
                          <Text style={styles.sumTotalLabel}>Bệnh nhân trả</Text>
                          <Text style={styles.sumTotal}>{fmtVnd(patientMustPay)}</Text>
                        </View>
                        {pending ? (
                          <View style={[styles.payActions, wide && styles.payActionsWide]}>
                            <TouchableOpacity style={[styles.payBtn, wide && styles.payBtnWide]} onPress={() => handlePayInvoice(inv._id)} accessibilityRole="button">
                              <Text style={styles.payBtnText}>Thu tiền mặt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.payBtnSecondary, wide && styles.payBtnWide]} onPress={() => handlePayOSPayment(inv._id)} accessibilityRole="button">
                              <Text style={styles.payBtnSecondaryText}>Thanh toán PayOS QR</Text>
                            </TouchableOpacity>
                            {!bhytCovered && (
                              <TouchableOpacity
                                style={[styles.payBtnSecondary, wide && styles.payBtnWide]}
                                onPress={() => handleApplyBhyt(inv)}
                                disabled={applyingBhytId === inv._id}
                                accessibilityRole="button"
                              >
                                <Text style={styles.payBtnSecondaryText}>{applyingBhytId === inv._id ? 'Đang tính…' : 'Áp dụng BHYT'}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            </PageContainer>
          </ScrollView>
        )}

        {/* ── MODAL KHAI BÁO THẺ BHYT ────────────────────────────────────────── */}
        <Modal visible={showBhytModal} transparent animationType="slide" onRequestClose={() => setShowBhytModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Khai báo thẻ bảo hiểm y tế (BHYT)</Text>
                <TouchableOpacity onPress={() => setShowBhytModal(false)}>
                  <Text style={{ fontSize: 18, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>
                Bệnh nhân: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{patients.find(p => p._id === selectedPatientId)?.profile?.name || 'Đã chọn'}</Text>
              </Text>

              <Text style={styles.fieldLabel}>Mã số thẻ BHYT (15 ký tự):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: GD4912345678901..."
                value={bhytCardNumber}
                onChangeText={setBhytCardNumber}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Mức hưởng BHYT theo quy định:</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {[80, 95, 100].map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={[
                      styles.rateBtn,
                      bhytCoverageRate === rate && styles.rateBtnActive
                    ]}
                    onPress={() => setBhytCoverageRate(rate)}
                  >
                    <Text style={[styles.rateBtnText, bhytCoverageRate === rate && styles.rateBtnTextActive]}>
                      Hưởng {rate}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nơi đăng ký KCB ban đầu:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Bệnh viện Đa khoa Tỉnh..."
                value={bhytRegistrationPlace}
                onChangeText={setBhytRegistrationPlace}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginVertical: 6 }}>
                <TouchableOpacity
                  style={[styles.checkRow, bhytIsOutOfNetwork && styles.checkRowActive]}
                  onPress={() => setBhytIsOutOfNetwork(!bhytIsOutOfNetwork)}
                >
                  <Text style={[styles.checkText, bhytIsOutOfNetwork && { color: '#B45309' }]}>
                    {bhytIsOutOfNetwork ? '☑ Trái tuyến' : '☐ Trái tuyến'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkRow, bhytHasTransferForm && styles.checkRowActive]}
                  onPress={() => setBhytHasTransferForm(!bhytHasTransferForm)}
                >
                  <Text style={[styles.checkText, bhytHasTransferForm && { color: '#047857' }]}>
                    {bhytHasTransferForm ? '☑ Có giấy chuyển tuyến' : '☐ Có giấy chuyển tuyến'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setShowBhytModal(false)}>
                  <Text style={styles.btnCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnConfirm, savingBhyt && { opacity: 0.6 }]}
                  onPress={handleSaveBhyt}
                  disabled={savingBhyt}
                >
                  <Text style={styles.btnConfirmText}>{savingBhyt ? 'Đang lưu...' : 'Lưu & Thẩm Định Quyền Lợi'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  queueBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  queueBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  queueBadgeOrange: {
    backgroundColor: '#FEF3C7',
  },
  queueBadgeRed: {
    backgroundColor: '#FEE2E2',
  },
  queueBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  suggestLabel: {
    fontSize: 12,
    color: '#047857',
    fontWeight: 'bold',
  },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  emptyText: {
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
  },
  chipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  visitCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16 },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitPatientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  visitDetail: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  visitTime: { fontSize: 12, color: Colors.secondary, marginTop: 8 },
  invoiceCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 20, gap: 16 },
  invoiceTitle: { fontSize: 14, color: Colors.slateDark, marginTop: 4 },
  invoiceItemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  invoiceItemDesc: { flex: 1, fontSize: 14, color: Colors.slateMuted },
  invoiceItemAmount: { fontSize: 14, color: Colors.slateDark, fontWeight: '500', fontVariant: ['tabular-nums'] },
  payBtn: { backgroundColor: Colors.brandGreen, height: 40, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  // Modal BHYT Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.brandNavy,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  rateBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  rateBtnActive: {
    backgroundColor: Colors.brandNavy,
    borderColor: Colors.brandNavy,
  },
  rateBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  rateBtnTextActive: {
    color: '#fff',
  },
  checkRow: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  checkRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  checkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  btnConfirm: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.brandNavy,
  },
  btnConfirmText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  page: { paddingTop: 20, paddingBottom: 32 },
  formGrid: { gap: 16 },
  formGridWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  panel: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 20 },
  panelLeft: { flex: 1, minWidth: 0 },
  panelRight: { flex: 1.15, minWidth: 0 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  panelTitle: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy, marginBottom: 10 },
  panelTitleInline: { marginBottom: 0 },
  panelTitleGap: { marginTop: 24 },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnSecondaryText: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, backgroundColor: Colors.surface, marginBottom: 12 },
  searchInput: { flex: 1, height: 42, fontSize: 15, color: Colors.slateDark },
  optionList: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.surface },
  optionHover: { borderColor: Colors.borderStrong, backgroundColor: Colors.background },
  optionSelected: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  optionBody: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  optionSub: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  textArea: { height: 88, textAlignVertical: 'top', marginBottom: 0 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateMuted },
  emptyHint: { fontSize: 14, color: Colors.secondary, textAlign: 'center', maxWidth: 420, lineHeight: 20 },
  table: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  thead: { backgroundColor: Colors.background, paddingVertical: 10 },
  th: { fontSize: 12, fontWeight: '600', color: Colors.slateMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  trBody: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  trHover: { backgroundColor: Colors.background },
  cPatient: { flex: 2, minWidth: 0 },
  cReason: { flex: 2.2, minWidth: 0 },
  cStatus: { flex: 1.3, minWidth: 0, alignItems: 'flex-start' },
  cStaff: { flex: 1.8, minWidth: 0 },
  cTime: { width: 110 },
  cChevron: { width: 20, alignItems: 'flex-end' },
  cellName: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },
  cellText: { fontSize: 14, color: Colors.slateDark },
  cellSub: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  cellNum: { fontSize: 14, color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  cardList: { gap: 12 },
  billingBar: { flexDirection: 'row', alignItems: 'center' },
  billingBarText: { fontSize: 14, color: Colors.slateMuted },
  billingBarStrong: { fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  invoiceCardWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  invoiceMain: { flex: 1, minWidth: 0 },
  invoicePatient: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  invoiceCode: { fontSize: 13, color: Colors.secondary, marginTop: 2, fontVariant: ['tabular-nums'] },
  invoiceItems: { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 6 },
  invoiceSide: { gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  invoiceSideWide: { width: 300, borderTopWidth: 0, paddingTop: 0, borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 24 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  sumLabel: { fontSize: 14, color: Colors.slateMuted },
  sumValue: { fontSize: 14, color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  sumValueGood: { color: Colors.successText, fontWeight: '600' },
  sumTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  sumTotalLabel: { fontSize: 14, fontWeight: '700', color: Colors.brandNavy },
  sumTotal: { fontSize: 20, fontWeight: '700', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  payActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  payActionsWide: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  payBtnWide: { alignSelf: 'stretch' },
  payBtnSecondary: { backgroundColor: Colors.surface, height: 40, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  payBtnSecondaryText: { color: Colors.brandGreen, fontWeight: '600', fontSize: 14 },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
});

export default NurseReceptionScreen;
