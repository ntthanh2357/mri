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
} from 'react-native';
import { get, post, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import { PlusCircle, ClipboardList, CreditCard, ShieldCheck, Search, Sparkles } from 'lucide-react';

const NurseReceptionScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState(route.params?.tab || 'createVisit'); // 'createVisit' | 'myQueue' | 'billing'
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(route.params?.user || null);

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

  return (
    <ResponsiveLayout navigation={navigation} title={headerTitle} user={user} activeRoute={activeTab === 'billing' ? 'ReceptionistDashboard_billing' : 'ReceptionistDashboard_createVisit'}>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'createVisit' && styles.activeTab]}
            onPress={() => setActiveTab('createVisit')}
          >
            <Text style={[styles.tabText, activeTab === 'createVisit' && styles.activeTabText]}>Tạo Lượt Khám</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'myQueue' && styles.activeTab]}
            onPress={() => setActiveTab('myQueue')}
          >
            <Text style={[styles.tabText, activeTab === 'myQueue' && styles.activeTabText]}>Lượt Khám (Hôm Nay)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'billing' && styles.activeTab]}
            onPress={() => setActiveTab('billing')}
          >
            <Text style={[styles.tabText, activeTab === 'billing' && styles.activeTabText]}>Thanh Toán</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView style={styles.contentContainer}>
            {activeTab === 'createVisit' && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.sectionTitle}>1. Chọn Bệnh Nhân</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      if (!selectedPatientId) {
                        Alert.alert('Thông báo', 'Vui lòng bấm chọn 1 bệnh nhân trong danh sách trước khi khai báo thẻ BHYT.');
                        return;
                      }
                      setShowBhytModal(true);
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>+ Khai Báo Thẻ BHYT</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Tìm theo tên, email, hoặc mã y tế..."
                  value={searchPatient}
                  onChangeText={setSearchPatient}
                />
                <View style={styles.listWrapper}>
                  {filteredPatients.slice(0, 20).map(p => (
                    <TouchableOpacity
                      key={p._id}
                      style={[styles.listItem, selectedPatientId === p._id && styles.selectedListItem]}
                      onPress={() => setSelectedPatientId(p._id)}
                    >
                      <Text style={styles.listItemTitle}>{p.profile?.name || p.profile?.fullName || p.email}</Text>
                      <Text style={styles.listItemSub}>Mã: {p.profile?.medicalId || 'N/A'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>2. Phân Công Bác Sĩ</Text>
                <View style={styles.rowWrapper}>
                  {doctors.map(d => {
                    const qSize = d.queueSize || 0;
                    const isLeastBusy = d._id === leastBusyDoctorId;
                    return (
                      <TouchableOpacity
                        key={d._id}
                        style={[
                          styles.cardItem,
                          selectedDoctorId === d._id && styles.selectedCardItem,
                          isLeastBusy && selectedDoctorId !== d._id && styles.suggestedCardItem
                        ]}
                        onPress={() => setSelectedDoctorId(d._id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[
                            styles.cardItemText,
                            selectedDoctorId === d._id && { color: '#fff' }
                          ]}>
                            {d.profile?.name || d.profile?.fullName || d.email}
                          </Text>
                          <View style={[
                            styles.queueBadge,
                            qSize === 0 ? styles.queueBadgeGreen : (qSize >= 5 ? styles.queueBadgeRed : styles.queueBadgeOrange),
                            selectedDoctorId === d._id && { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
                          ]}>
                            <Text style={[
                              styles.queueBadgeText,
                              selectedDoctorId === d._id && { color: '#fff' }
                            ]}>
                              {qSize}
                            </Text>
                          </View>
                          {isLeastBusy && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Sparkles size={12} color={selectedDoctorId === d._id ? '#fff' : '#059669'} />
                              <Text style={[
                                styles.suggestLabel,
                                selectedDoctorId === d._id && { color: '#fff' }
                              ]}>
                                Gợi ý
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionTitle}>3. Phân Công Điều Dưỡng</Text>
                <View style={styles.rowWrapper}>
                  {nurses.map(n => (
                    <TouchableOpacity
                      key={n._id}
                      style={[styles.cardItem, selectedNurseId === n._id && styles.selectedCardItem]}
                      onPress={() => setSelectedNurseId(n._id)}
                    >
                      <Text style={styles.cardItemText}>{n.profile?.name || n.profile?.fullName || n.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>4. Lý Do Khám</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Triệu chứng, yêu cầu khám..."
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateVisit}>
                  <Text style={styles.submitBtnText}>Xác Nhận Tạo Lượt Khám</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'myQueue' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Danh Sách Lượt Khám</Text>
                {visits.length === 0 ? <Text style={styles.emptyText}>Không có lượt khám nào.</Text> : null}
                {visits.map(v => (
                  <TouchableOpacity 
                    key={v._id} 
                    style={styles.visitCard}
                    onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } })}
                  >
                    <View style={styles.visitHeader}>
                      <Text style={styles.visitPatientName}>{v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email}</Text>
                      <ClinicalStatusBadge status={v.status} size="sm" />
                    </View>
                    <Text style={styles.visitDetail}>Lý do: {v.reason}</Text>
                    <Text style={styles.visitDetail}>Phân loại: {v.visitType || 'Ngoại trú'}</Text>
                    <Text style={styles.visitDetail}>Bác sĩ: {v.doctorId?.profile?.name || 'Đã phân công'}</Text>
                    <Text style={styles.visitDetail}>Điều dưỡng: {v.nurseId?.profile?.name || 'Đã phân công'}</Text>
                    <Text style={styles.visitTime}>Tạo lúc: {new Date(v.createdAt).toLocaleString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'billing' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chờ Thanh Toán (Viện Phí & Đồng Chi Trả BHYT)</Text>
                {invoices.length === 0 ? <Text style={styles.emptyText}>Không có hóa đơn chờ thanh toán.</Text> : null}
                {invoices.map(inv => {
                  const bhytCovered = inv.bhytInfo?.bhytAmount > 0;
                  const patientMustPay = inv.patientPayAmount ?? (inv.totalAmount - (inv.bhytInfo?.bhytAmount || 0));

                  return (
                    <View key={inv._id} style={styles.invoiceCard}>
                      <View style={styles.invoiceHeader}>
                        <View>
                          <Text style={styles.invoiceTitle}>Mã Visit: {inv.visitId}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            BN: {inv.patientId?.profile?.name || inv.patientId?.profile?.fullName || inv.patientId?.email || 'N/A'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.invoiceTotal}>Tổng: {inv.totalAmount.toLocaleString()} VNĐ</Text>
                          {bhytCovered ? (
                            <View style={{ alignItems: 'flex-end', marginTop: 3 }}>
                              <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold' }}>
                                BHYT chi trả ({inv.bhytInfo.coverageRate}%): -{inv.bhytInfo.bhytAmount.toLocaleString()} VNĐ
                              </Text>
                              <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: 'bold', marginTop: 1 }}>
                                BN đồng chi trả: {patientMustPay.toLocaleString()} VNĐ
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Chưa khấu trừ BHYT</Text>
                          )}
                        </View>
                      </View>

                      {inv.items.map((item, idx) => (
                        <View key={idx} style={styles.invoiceItemRow}>
                          <Text style={styles.invoiceItemDesc}>{item.description}</Text>
                          <Text style={styles.invoiceItemAmount}>{item.amount.toLocaleString()} VNĐ</Text>
                        </View>
                      ))}

                      <View style={styles.invoiceFooter}>
                        <Text style={styles.statusBadge(inv.status)}>{inv.status.toUpperCase()}</Text>
                        {inv.status === 'chờ thanh toán' && (
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            {!bhytCovered && (
                              <TouchableOpacity
                                style={[styles.payBtn, { backgroundColor: '#0284C7' }]}
                                onPress={() => handleApplyBhyt(inv)}
                                disabled={applyingBhytId === inv._id}
                              >
                                <Text style={styles.payBtnText}>
                                  {applyingBhytId === inv._id ? 'Đang tính...' : 'Áp Dụng BHYT'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.payBtn} onPress={() => handlePayInvoice(inv._id)}>
                              <Text style={styles.payBtnText}>Tiền Mặt ({patientMustPay.toLocaleString()}đ)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.payBtn]} onPress={() => handlePayOSPayment(inv._id)}>
                              <Text style={styles.payBtnText}>PayOS QR</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* ── MODAL KHAI BÁO THẺ BHYT ────────────────────────────────────────── */}
        <Modal visible={showBhytModal} transparent animationType="slide" onRequestClose={() => setShowBhytModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Khai Báo Thẻ Bảo Hiểm Y Tế (BHYT)</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#0891B2',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    marginTop: 10,
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
  listWrapper: {
    marginBottom: 10,
  },
  listItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedListItem: {
    borderColor: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  listItemSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  rowWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  cardItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  selectedCardItem: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  suggestedCardItem: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  queueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  queueBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  queueBadgeOrange: {
    backgroundColor: '#FEF3C7',
  },
  queueBadgeRed: {
    backgroundColor: '#FEE2E2',
  },
  queueBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  suggestLabel: {
    fontSize: 11,
    color: '#059669',
    fontWeight: 'bold',
  },
  cardItemText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  chipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  visitCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
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
  visitTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  statusBadge: (status) => ({
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
    backgroundColor:
      status === 'đang chờ' ? '#FEF3C7' :
        status === 'đã đóng' ? '#E2E8F0' :
          status === 'chờ thanh toán' ? '#FEE2E2' :
            '#DCFCE7',
    color:
      status === 'đang chờ' ? '#D97706' :
        status === 'đã đóng' ? '#475569' :
          status === 'chờ thanh toán' ? '#DC2626' :
            '#059669',
  }),
  invoiceCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  invoiceTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceItemDesc: {
    fontSize: 14,
    color: '#475569',
  },
  invoiceItemAmount: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  payBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
    color: '#0F172A',
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
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
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
    backgroundColor: '#0284C7',
  },
  btnConfirmText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default NurseReceptionScreen;
