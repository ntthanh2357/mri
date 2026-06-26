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
} from 'react-native';
import { get, post, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';

const ReceptionistDashboardScreen = ({ route, navigation }) => {
  const [activeTab, setActiveTab] = useState('createVisit'); // 'createVisit' | 'myQueue' | 'billing'
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

  // myQueue / All Visits State
  const [visits, setVisits] = useState([]);
  
  // billing State
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    if (!user) {
      get('/auth/me')
        .then(res => setUser(res.user))
        .catch(() => Alert.alert("Lỗi", "Vui lòng đăng nhập lại"));
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'createVisit') {
      fetchStaffAndPatients();
    } else if (activeTab === 'myQueue') {
      fetchVisits();
    } else if (activeTab === 'billing') {
      fetchInvoices();
    }
  }, [activeTab]);

  const fetchStaffAndPatients = async () => {
    setLoading(true);
    try {
      // Fetch Patients
      const ptRes = await get('/api/patients');
      if (ptRes.success) setPatients(ptRes.data);

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
    if (!selectedPatientId || !selectedDoctorId || !selectedNurseId || !reason) {
      Alert.alert("Thông báo", "Vui lòng chọn đầy đủ Bệnh nhân, Bác sĩ, Điều dưỡng và nhập lý do khám.");
      return;
    }
    setLoading(true);
    try {
      await post('/api/v1/visits', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        nurseId: selectedNurseId,
        reason
      });
      Alert.alert("Thành công", "Đã tạo lượt khám mới và phân công thành công.");
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedNurseId('');
      setReason('');
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

  const filteredPatients = patients.filter(p => 
    p.email?.toLowerCase().includes(searchPatient.toLowerCase()) || 
    p.profile?.name?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.profile?.fullName?.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.profile?.medicalId?.toLowerCase().includes(searchPatient.toLowerCase())
  );

  return (
    <ResponsiveLayout navigation={navigation} title="Receptionist Dashboard" user={user} activeRoute="ReceptionistDashboard">
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
          <ActivityIndicator size="large" color="#15803D" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView style={styles.contentContainer}>
            {activeTab === 'createVisit' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. Chọn Bệnh Nhân</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Tìm theo tên, email, hoặc mã y tế..." 
                  value={searchPatient}
                  onChangeText={setSearchPatient}
                />
                <View style={styles.listWrapper}>
                  {filteredPatients.slice(0, 5).map(p => (
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
                  {doctors.map(d => (
                    <TouchableOpacity 
                      key={d._id} 
                      style={[styles.cardItem, selectedDoctorId === d._id && styles.selectedCardItem]}
                      onPress={() => setSelectedDoctorId(d._id)}
                    >
                      <Text style={styles.cardItemText}>{d.profile?.name || d.profile?.fullName || d.email}</Text>
                    </TouchableOpacity>
                  ))}
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
                  <View key={v._id} style={styles.visitCard}>
                    <View style={styles.visitHeader}>
                      <Text style={styles.visitPatientName}>{v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email}</Text>
                      <Text style={styles.statusBadge(v.status)}>{v.status.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.visitDetail}>Lý do: {v.reason}</Text>
                    <Text style={styles.visitDetail}>Bác sĩ: {v.doctorId?.profile?.name || 'Đã phân công'}</Text>
                    <Text style={styles.visitDetail}>Điều dưỡng: {v.nurseId?.profile?.name || 'Đã phân công'}</Text>
                    <Text style={styles.visitTime}>Tạo lúc: {new Date(v.createdAt).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'billing' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chờ Thanh Toán</Text>
                {invoices.length === 0 ? <Text style={styles.emptyText}>Không có hóa đơn chờ thanh toán.</Text> : null}
                {invoices.map(inv => (
                  <View key={inv._id} style={styles.invoiceCard}>
                    <View style={styles.invoiceHeader}>
                      <Text style={styles.invoiceTitle}>Mã Visit: {inv.visitId}</Text>
                      <Text style={styles.invoiceTotal}>{inv.totalAmount.toLocaleString()} VNĐ</Text>
                    </View>
                    {inv.items.map((item, idx) => (
                      <View key={idx} style={styles.invoiceItemRow}>
                        <Text style={styles.invoiceItemDesc}>{item.description}</Text>
                        <Text style={styles.invoiceItemAmount}>{item.amount.toLocaleString()}</Text>
                      </View>
                    ))}
                    <View style={styles.invoiceFooter}>
                      <Text style={styles.statusBadge(inv.status)}>{inv.status.toUpperCase()}</Text>
                      {inv.status === 'chờ thanh toán' && (
                        <TouchableOpacity style={styles.payBtn} onPress={() => handlePayInvoice(inv._id)}>
                          <Text style={styles.payBtnText}>Xác nhận thanh toán</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
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
    backgroundColor: '#15803D',
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
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  cardItemText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#15803D',
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
      '#15803D',
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
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});

export default ReceptionistDashboardScreen;
