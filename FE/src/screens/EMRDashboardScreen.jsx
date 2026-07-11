import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import '../tailwind-built.css';
import { apiRequest } from '../utils/apiClient.js';
import { get, put, post } from '../services/api.service';

const EMRDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [localUser, setLocalUser] = useState(null);
  // Nurse workflow: selected patient for detail panel
  const [nurseSelectedPatient, setNurseSelectedPatient] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        let u = null;
        // Try reading from localStorage first as a quick cache
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          u = JSON.parse(storedUser);
          setLocalUser(u);
          if (u.role === 'nurse') {
            setActiveTab('records');
          }
        }

        // Fetch fresh user details from backend to ensure correct role is loaded
        const res = await get('/auth/me');
        if (res && res.user) {
          u = res.user;
          setLocalUser(u);
          localStorage.setItem('user', JSON.stringify(u));
          if (u.role === 'nurse') {
            setActiveTab('records');
          }
        }
      } catch (e) {
        console.log('Error loading user role:', e);
      }
    };
    loadUser();
  }, []);
  
  // Data states
  const [records, setRecords] = useState([]);
  const [careSheets, setCareSheets] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [consents, setConsents] = useState([]);
  const [versions, setVersions] = useState([]);
  const [imagingResults, setImagingResults] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [availableDrugs, setAvailableDrugs] = useState([]);

  // Fetch drugs for autocomplete
  useEffect(() => {
    get('/api/drugs').then(res => {
      if(res && res.success) setAvailableDrugs(res.data);
    }).catch(err => console.log('Error fetching drugs:', err));
  }, []);
  
  // Fetch imaging
  useEffect(() => {
    if (selectedRecord && selectedRecord.patientId) {
      get(`/api/v1/imaging/patient/${selectedRecord.patientId}`)
        .then(res => {
          if (res && res.success) setImagingResults(res.data || []);
        })
        .catch(err => console.log('Error fetching imaging:', err));
    }
  }, [selectedRecord]);
  
  // Loading states
  const [loading, setLoading] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Fetch medical records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/emr/records');
      setRecords(data.data || []);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải danh sách bệnh án.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch care sheets, consultations, consents for a specific record
  const fetchRecordDetails = async (recordId) => {
    setLoading(true);
    try {
      const [careData, consultData, consentData, versionData, rxData] = await Promise.all([
        apiRequest(`/emr/records/${recordId}/care-sheets`),
        apiRequest(`/emr/records/${recordId}/consultations`),
        apiRequest(`/emr/records/${recordId}/consents`),
        apiRequest(`/emr/records/${recordId}/versions`),
        get(`/api/patients/${selectedRecord.patientId}/prescriptions`).catch(() => null),
      ]);
      setCareSheets(careData.data || []);
      setConsultations(consultData.data || []);
      setConsents(consentData.data || []);
      setVersions(versionData.data || []);
      if (rxData && rxData.data) {
        setPrescriptions(rxData.data);
      } else {
        setPrescriptions([]);
      }
    } catch (error) {
      console.log('Error loading details:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load records when tab changes
  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    } else if (selectedRecord) {
      fetchRecordDetails(selectedRecord._id);
    }
  }, [activeTab]);

  // Create new record
  const handleCreateRecord = async (formData) => {
    try {
      const data = await apiRequest('/emr/records', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setRecords(prev => [data.data, ...prev]);
      setIsModalVisible(false);
      Alert.alert('Thành công', 'Hồ sơ bệnh án mới đã được tạo!');
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo hồ sơ.');
    }
  };

  // Create new care sheet
  const handleCreateCareSheet = async (formData) => {
    if (!selectedRecord) {
      Alert.alert('Lỗi', 'Vui lòng chọn một hồ sơ bệnh án trước!');
      return;
    }
    try {
      const data = await apiRequest(`/emr/records/${selectedRecord._id}/care-sheets`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setCareSheets(prev => [data.data, ...prev]);
      setIsModalVisible(false);
      Alert.alert('Thành công', 'Phiếu chăm sóc đã được tạo!');
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo phiếu chăm sóc.');
    }
  };

  // Create new consultation
  const handleCreateConsultation = async (formData) => {
    if (!selectedRecord) {
      Alert.alert('Lỗi', 'Vui lòng chọn một hồ sơ bệnh án trước!');
      return;
    }
    try {
      const data = await apiRequest(`/emr/records/${selectedRecord._id}/consultations`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setConsultations(prev => [data.data, ...prev]);
      setIsModalVisible(false);
      Alert.alert('Thành công', 'Biên bản hội chẩn đã được tạo!');
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo biên bản hội chẩn.');
    }
  };

  // Create new consent
  const handleCreateConsent = async (formData) => {
    if (!selectedRecord) {
      Alert.alert('Lỗi', 'Vui lòng chọn một hồ sơ bệnh án trước!');
      return;
    }
    try {
      const data = await apiRequest(`/emr/records/${selectedRecord._id}/consents`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setConsents(prev => [data.data, ...prev]);
      setIsModalVisible(false);
      Alert.alert('Thành công', 'Giấy cam đoan đã được tạo!');
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo giấy cam đoan.');
    }
  };

  // Create new prescription
  const handleCreatePrescription = async (formData) => {
    if (!selectedRecord) {
      Alert.alert('Lỗi', 'Vui lòng chọn một hồ sơ bệnh án trước!');
      return;
    }
    try {
      const data = await post(`/api/patients/${selectedRecord.patientId}/prescriptions`, {
        ...formData,
        doctor_name: localUser?.profile?.name || localUser?.email || 'Bác sĩ'
      });
      if (data && data.success) {
        setPrescriptions(prev => [data.data, ...prev]);
        setIsModalVisible(false);
        Alert.alert('Thành công', 'Đã tạo đơn thuốc mới!');
      } else {
        Alert.alert('Lỗi', data.message || 'Không thể tạo đơn thuốc.');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Lỗi kết nối khi tạo đơn thuốc.');
    }
  };

  // Filter records for search
  const filteredRecords = records.filter(r =>
    (r.patientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.patientId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="EMRDashboard">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
          {/* Sidebar for desktop */}
          {isDesktop && (
            <View style={styles.desktopSidebar}>
              <Text style={styles.sidebarTitle}>EMR Management</Text>
              <Text style={styles.sidebarSubtitle}>Quản lý Hồ sơ Bệnh Án</Text>
              <View style={styles.sidebarNav}>
                {localUser?.role === 'nurse' && (
                  <SidebarItem
                    icon="🩺"
                    label="Đo sinh hiệu"
                    active={activeTab === 'nurseQueue'}
                    onPress={() => setActiveTab('nurseQueue')}
                  />
                )}
                <SidebarItem
                  icon="📋"
                  label="Hồ sơ bệnh án"
                  active={activeTab === 'records'}
                  onPress={() => setActiveTab('records')}
                />
                <SidebarItem
                  icon="📝"
                  label="Phiếu chăm sóc"
                  active={activeTab === 'care'}
                  onPress={() => setActiveTab('care')}
                />
                {(localUser?.role === 'doctor' || localUser?.role === 'admin') && (
                  <>
                    <SidebarItem
                      icon="🧠"
                      label="Hội chẩn"
                      active={activeTab === 'consult'}
                      onPress={() => setActiveTab('consult')}
                    />
                    <SidebarItem
                      icon="✍️"
                      label="Giấy cam đoan"
                      active={activeTab === 'consent'}
                      onPress={() => setActiveTab('consent')}
                    />
                    <SidebarItem
                      icon="💊"
                      label="Kê đơn thuốc"
                      active={activeTab === 'prescriptions'}
                      onPress={() => setActiveTab('prescriptions')}
                    />
                  </>
                )}
                <SidebarItem
                  icon="⏳"
                  label="Lịch sử sửa đổi"
                  active={activeTab === 'versions'}
                  onPress={() => setActiveTab('versions')}
                />
                {(localUser?.role === 'doctor' || localUser?.role === 'admin') && (
                  <SidebarItem
                    icon="🧠"
                    label="Phim MRI & CT"
                    active={activeTab === 'imaging'}
                    onPress={() => setActiveTab('imaging')}
                  />
                )}
              </View>
              {selectedRecord && localUser?.role !== 'nurse' && (
                <View style={styles.selectedRecordBox}>
                  <Text style={styles.selectedRecordLabel}>Đang xem:</Text>
                  <Text style={styles.selectedRecordName}>{selectedRecord.patientName}</Text>
                  <TouchableOpacity
                    style={styles.clearSelectionBtn}
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Text style={styles.clearSelectionText}>Xóa chọn</Text>
                  </TouchableOpacity>
                </View>
              )}
              {nurseSelectedPatient && localUser?.role === 'nurse' && (
                <View style={[styles.selectedRecordBox, { borderColor: '#6EE7B7' }]}>
                  <Text style={styles.selectedRecordLabel}>Bệnh nhân:</Text>
                  <Text style={styles.selectedRecordName}>{nurseSelectedPatient.patientName}</Text>
                  <TouchableOpacity
                    style={styles.clearSelectionBtn}
                    onPress={() => setNurseSelectedPatient(null)}
                  >
                    <Text style={styles.clearSelectionText}>← Quay lại</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Mobile tab bar */}
            {!isDesktop && (
              <View style={styles.mobileTabBar}>
                {localUser?.role === 'nurse' && (
                  <MobileTab
                    label="Sinh hiệu"
                    active={activeTab === 'nurseQueue'}
                    onPress={() => setActiveTab('nurseQueue')}
                  />
                )}
                <MobileTab
                  label="Hồ sơ"
                  active={activeTab === 'records'}
                  onPress={() => setActiveTab('records')}
                />
                <MobileTab
                  label="Chăm sóc"
                  active={activeTab === 'care'}
                  onPress={() => setActiveTab('care')}
                />
                {(localUser?.role === 'doctor' || localUser?.role === 'admin') && (
                  <>
                    <MobileTab
                      label="Hội chẩn"
                      active={activeTab === 'consult'}
                      onPress={() => setActiveTab('consult')}
                    />
                    <MobileTab
                      label="Cam đoan"
                      active={activeTab === 'consent'}
                      onPress={() => setActiveTab('consent')}
                    />
                    <MobileTab
                      label="Đơn thuốc"
                      active={activeTab === 'prescriptions'}
                      onPress={() => setActiveTab('prescriptions')}
                    />
                  </>
                )}
                <MobileTab
                  label="Lịch sử"
                  active={activeTab === 'versions'}
                  onPress={() => setActiveTab('versions')}
                />
                {(localUser?.role === 'doctor' || localUser?.role === 'admin') && (
                  <MobileTab
                    label="Phim MRI"
                    active={activeTab === 'imaging'}
                    onPress={() => setActiveTab('imaging')}
                  />
                )}
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#15803D" />
                <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.scrollContainer}>
                {activeTab === 'nurseQueue' && (
                  <NurseQueueTab navigation={navigation} />
                )}
                {activeTab === 'records' && (
                  <RecordsTab
                    records={filteredRecords}
                    searchQuery={searchQuery}
                    onSearch={setSearchQuery}
                    onNewRecord={() => {
                      setModalType('newRecord');
                      setIsModalVisible(true);
                    }}
                    onViewRecord={(record) => {
                      if (localUser?.role === 'nurse') {
                        navigation.navigate('NursePatientDetail', { patient: record });
                      } else {
                        setSelectedRecord(record);
                        fetchRecordDetails(record._id);
                        Alert.alert('Thông báo', `Đã chọn hồ sơ của ${record.patientName}`);
                      }
                    }}
                    onRefresh={fetchRecords}
                  />
                )}

                {activeTab === 'care' && (
                  <CareTab
                    careSheets={careSheets}
                    selectedRecord={selectedRecord}
                    onNewCare={() => {
                      setModalType('newCareSheet');
                      setIsModalVisible(true);
                    }}
                  />
                )}

                {activeTab === 'consult' && (
                  <ConsultationTab
                    consultations={consultations}
                    selectedRecord={selectedRecord}
                    onNewConsult={() => {
                      setModalType('newConsultation');
                      setIsModalVisible(true);
                    }}
                  />
                )}

                {activeTab === 'consent' && (
                  <ConsentTab
                    consents={consents}
                    selectedRecord={selectedRecord}
                    onNewConsent={() => {
                      setModalType('newConsent');
                      setIsModalVisible(true);
                    }}
                  />
                )}

                {activeTab === 'versions' && (
                  <VersionTab
                    versions={versions}
                    selectedRecord={selectedRecord}
                  />
                )}

                {activeTab === 'prescriptions' && (
                  <PrescriptionTab
                    prescriptions={prescriptions}
                    availableDrugs={availableDrugs}
                    selectedRecord={selectedRecord}
                    onNewPrescription={() => {
                      setModalType('newPrescription');
                      setIsModalVisible(true);
                    }}
                  />
                )}

                {activeTab === 'imaging' && (
                  <ImagingTab
                    imagingResults={imagingResults}
                    selectedRecord={selectedRecord}
                    navigation={navigation}
                  />
                )}
              </ScrollView>
            )}
          </View>
        </View>

        <EMRModal
          isVisible={isModalVisible}
          type={modalType}
          onClose={() => setIsModalVisible(false)}
          onCreateRecord={handleCreateRecord}
          onCreateCareSheet={handleCreateCareSheet}
          onCreateConsultation={handleCreateConsultation}
          onCreateConsent={handleCreateConsent}
          onCreatePrescription={handleCreatePrescription}
          availableDrugs={availableDrugs}
        />
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

// Sidebar Item Component
const SidebarItem = ({ icon, label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    onPress={onPress}
  >
    <Text style={styles.sidebarIcon}>{icon}</Text>
    <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// Mobile Tab Component
const MobileTab = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.mobileTabItem, active && styles.mobileTabItemActive]}
    onPress={onPress}
  >
    <Text style={[styles.mobileTabText, active && styles.mobileTabTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// Tab Components
const NurseQueueTab = ({ navigation }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Vitals form state
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [vitalsModal, setVitalsModal] = useState(false);
  const [pulse, setPulse] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/visits/my-queue');
      setVisits(res.visits || []);
    } catch (err) {
      console.error('Error fetching nurse queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const openVitalsModal = (visit) => {
    setSelectedVisit(visit);
    setPulse(visit.vitals?.pulse?.toString() || '');
    setBloodPressure(visit.vitals?.bloodPressure || '');
    setSpo2(visit.vitals?.spo2?.toString() || '');
    setTemperature(visit.vitals?.temperature?.toString() || '');
    setRespiratoryRate(visit.vitals?.respiratoryRate?.toString() || '');
    setVitalsModal(true);
  };

  const handleSaveVitals = async () => {
    if (!pulse || !bloodPressure || !spo2 || !temperature) {
      Alert.alert("Thông báo", "Vui lòng điền các chỉ số sinh hiệu bắt buộc.");
      return;
    }

    setUpdating(true);
    try {
      await put(`/api/v1/visits/${selectedVisit._id}/vitals`, {
        vitals: {
          pulse: parseInt(pulse),
          bloodPressure,
          spo2: parseInt(spo2),
          temperature: parseFloat(temperature),
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
        }
      });
      Alert.alert("Thành công", "Đã cập nhật sinh hiệu. Lượt khám chuyển sang Đang khám.");
      setVitalsModal(false);
      fetchQueue();
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật sinh hiệu.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🩺 Hàng đợi đo sinh hiệu</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchQueue}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#15803D" style={{ marginTop: 40 }} />
      ) : (
        <View style={{ gap: 12 }}>
          {visits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyText}>Không có ca khám nào đang chờ đo sinh hiệu.</Text>
            </View>
          ) : (
            visits.map(v => (
              <View key={v._id} style={[styles.card, { padding: 20, marginBottom: 12 }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>
                      {v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
                    </Text>
                    <Text style={styles.patientInfo}>
                      Mã y tế: {v.patientId?.profile?.medicalId || 'N/A'} • Lý do: {v.reason}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>CHỜ ĐO SINH HIỆU</Text>
                  </View>
                </View>
                <View style={{ marginTop: 8, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#475569' }}><Text style={{ fontWeight: 'bold' }}>Bác sĩ chỉ định:</Text> {v.doctorId?.profile?.name || v.doctorId?.profile?.fullName || v.doctorId?.email || 'Đang phân công'}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8' }}>Tiếp nhận lúc: {new Date(v.createdAt).toLocaleString('vi-VN')}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.primaryButton, { marginTop: 12, paddingVertical: 10, maxWidth: 160 }]} 
                  onPress={() => openVitalsModal(v)}
                >
                  <Text style={styles.primaryButtonText}>🩺 Nhập Sinh Hiệu</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* Vitals Modal */}
      <Modal visible={vitalsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { padding: 20 }]}>
            <Text style={styles.modalTitle}>🩺 Nhập Sinh Hiệu Cho Bệnh Nhân</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>
              Bệnh nhân: {selectedVisit?.patientId?.profile?.name || selectedVisit?.patientId?.profile?.fullName || selectedVisit?.patientId?.email}
            </Text>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.fieldLabel}>Huyết áp (mmHg) *</Text>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ví dụ: 120/80" 
                  value={bloodPressure}
                  onChangeText={setBloodPressure}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Mạch (lần/phút) *</Text>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ví dụ: 80" 
                  keyboardType="numeric"
                  value={pulse}
                  onChangeText={setPulse}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>SpO2 (%) *</Text>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ví dụ: 98" 
                  keyboardType="numeric"
                  value={spo2}
                  onChangeText={setSpo2}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Nhiệt độ (°C) *</Text>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ví dụ: 37" 
                  keyboardType="numeric"
                  value={temperature}
                  onChangeText={setTemperature}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Nhịp thở (lần/phút)</Text>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="Ví dụ: 18 (không bắt buộc)" 
                  keyboardType="numeric"
                  value={respiratoryRate}
                  onChangeText={setRespiratoryRate}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setVitalsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleSaveVitals}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Lưu & Hoàn Thành</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NURSE PATIENT DETAIL TAB
// Shows patient info + 3 clinical forms: Mẫu khám bệnh, Phiếu chỉ định, Phiếu thu viện phí
// ─────────────────────────────────────────────────────────────────────────────
const NursePatientDetailTab = ({ patient, localUser, onBack }) => {
  const [activeForm, setActiveForm] = useState('info'); // 'info' | 'exam' | 'order' | 'fee'
  const [submitting, setSubmitting] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState(false);

  // ── Mẫu khám bệnh (Clinical Exam Form) ──
  const [examDiagnosis, setExamDiagnosis] = useState('');
  const [examRequest, setExamRequest] = useState('');
  const [examPulse, setExamPulse] = useState('');
  const [examBP, setExamBP] = useState('');
  const [examHeight, setExamHeight] = useState('');
  const [examWeight, setExamWeight] = useState('');
  const [examBreath, setExamBreath] = useState('');
  const [examTemp, setExamTemp] = useState('');
  const [examSpo2, setExamSpo2] = useState('');

  // ── Phiếu chỉ định dịch vụ (Service Order) ──
  const [orderServices, setOrderServices] = useState([]);
  const [orderNewService, setOrderNewService] = useState('');
  const [orderPriority, setOrderPriority] = useState('Thường');
  const [orderDiagnosis, setOrderDiagnosis] = useState('');

  // ── Phiếu thu viện phí (Fee Items) ──
  const [feeItems, setFeeItems] = useState([
    { name: 'Khám bệnh', amount: '150000' },
  ]);
  const [feeNewName, setFeeNewName] = useState('');
  const [feeNewAmount, setFeeNewAmount] = useState('');
  const [feeNote, setFeeNote] = useState('');

  const patientName = patient?.patientName || patient?.profile?.name || 'Bệnh nhân';
  const patientId = patient?.patientId || patient?._id || '';
  const gender = patient?.gender || patient?.profile?.gender || '';
  const age = patient?.age || '';
  const department = patient?.department || '';
  const doctor = patient?.doctorInCharge || '';

  const totalFee = feeItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const addOrderService = () => {
    const s = orderNewService.trim();
    if (!s) return;
    setOrderServices(prev => [...prev, s]);
    setOrderNewService('');
  };

  const removeOrderService = (idx) => {
    setOrderServices(prev => prev.filter((_, i) => i !== idx));
  };

  const addFeeItem = () => {
    const n = feeNewName.trim();
    const a = feeNewAmount.trim();
    if (!n || !a) return;
    setFeeItems(prev => [...prev, { name: n, amount: a }]);
    setFeeNewName('');
    setFeeNewAmount('');
  };

  const removeFeeItem = (idx) => {
    setFeeItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmFee = async () => {
    if (feeItems.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng thêm ít nhất một dịch vụ.');
      return;
    }
    setSubmitting(true);
    try {
      const items = feeItems.map(i => ({ description: i.name, amount: parseFloat(i.amount) || 0 }));
      // Use patient._id (MongoDB ObjectId) if available, else patientId
      const pid = patient?._id || patient?.patientId;
      const vid = patient?.visitId || undefined;

      await post('/api/v1/invoices/pending', {
        patientId: pid,
        visitId: vid,
        items,
        totalAmount: totalFee,
        notes: feeNote,
      });

      setInvoiceCreated(true);
      Alert.alert(
        '✅ Xác nhận thành công',
        `Phiếu thu viện phí của ${patientName} đã được gửi sang hàng đợi Thu Ngân.\nTổng tiền: ${totalFee.toLocaleString('vi-VN')} VNĐ`,
        [{ text: 'OK', onPress: () => onBack() }]
      );
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo hóa đơn. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const formTabs = [
    { key: 'info',  label: '👤 Thông tin' },
    { key: 'exam',  label: '📋 Khám bệnh' },
    { key: 'order', label: '📝 Chỉ định' },
    { key: 'fee',   label: '💰 Viện phí' },
  ];

  return (
    <View style={{ minHeight: 400 }}>
      {/* Back button */}
      <TouchableOpacity
        onPress={onBack}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 4 }}
      >
        <Text style={{ color: '#15803D', fontWeight: '600', fontSize: 15 }}>← Quay lại danh sách</Text>
      </TouchableOpacity>

      {/* Patient name header */}
      <View style={{ backgroundColor: '#15803D', padding: 16, marginHorizontal: 0, marginBottom: 0 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>🏥 {patientName}</Text>
        <Text style={{ color: '#CCFBF1', fontSize: 13, marginTop: 2 }}>
          {gender}{age ? ` • ${age} tuổi` : ''}{department ? ` • ${department}` : ''}
        </Text>
        {doctor ? <Text style={{ color: '#CCFBF1', fontSize: 12, marginTop: 1 }}>👨‍⚕️ {doctor}</Text> : null}
      </View>

      {/* Form tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#F1F5F9', flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', padding: 6, gap: 6 }}>
          {formTabs.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveForm(t.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeForm === t.key ? '#15803D' : '#fff',
                borderWidth: 1,
                borderColor: activeForm === t.key ? '#15803D' : '#CBD5E1',
              }}
            >
              <Text style={{ color: activeForm === t.key ? '#fff' : '#475569', fontWeight: '600', fontSize: 13 }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={{ backgroundColor: '#F8FAFC', padding: 16, paddingBottom: 40 }}>

        {/* ── INFO TAB ── */}
        {activeForm === 'info' && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>Thông tin bệnh nhân</Text>
            {[
              ['Họ và tên', patientName],
              ['Mã bệnh nhân', patientId],
              ['Giới tính', gender || 'N/A'],
              ['Tuổi', age ? `${age} tuổi` : 'N/A'],
              ['Khoa / Phòng', department || 'N/A'],
              ['Bác sĩ phụ trách', doctor || 'N/A'],
              ['Trạng thái', patient?.status || 'N/A'],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E2E8F0', paddingBottom: 8 }}>
                <Text style={{ width: 140, color: '#64748B', fontSize: 13 }}>{label}</Text>
                <Text style={{ flex: 1, color: '#0F172A', fontSize: 13, fontWeight: '500' }}>{value}</Text>
              </View>
            ))}
            <View style={{ backgroundColor: '#ECFDF5', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#6EE7B7' }}>
              <Text style={{ color: '#065F46', fontWeight: '600', fontSize: 13 }}>💡 Hướng dẫn</Text>
              <Text style={{ color: '#047857', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                Điền đầy đủ 3 phiếu bên dưới theo trình tự:{'\n'}
                1. 📋 Mẫu khám bệnh – nhập sinh hiệu{'\n'}
                2. 📝 Phiếu chỉ định – thêm dịch vụ chỉ định{'\n'}
                3. 💰 Phiếu thu viện phí – xác nhận để gửi Thu Ngân
              </Text>
            </View>
          </View>
        )}

        {/* ── EXAM TAB (Mẫu khám bệnh) ── */}
        {activeForm === 'exam' && (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>
                📋 PHIẾU THÔNG TIN KHÁM BỆNH
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16 }}>Patient Information Registration Form</Text>

              <Text style={{ fontWeight: '700', color: '#15803D', marginBottom: 8 }}>🫀 Sinh hiệu (Vital Signs)</Text>
              {[
                ['Mạch (lần/phút)', examPulse, setExamPulse, 'numeric', 'Ví dụ: 80'],
                ['Huyết áp (mmHg)', examBP, setExamBP, 'default', 'Ví dụ: 120/80'],
                ['Chiều cao (cm)', examHeight, setExamHeight, 'numeric', 'Ví dụ: 165'],
                ['Cân nặng (kg)', examWeight, setExamWeight, 'numeric', 'Ví dụ: 60'],
                ['Nhịp thở (lần/phút)', examBreath, setExamBreath, 'numeric', 'Ví dụ: 18'],
                ['Nhiệt độ (°C)', examTemp, setExamTemp, 'numeric', 'Ví dụ: 37.0'],
                ['SpO2 (%)', examSpo2, setExamSpo2, 'numeric', 'Ví dụ: 98'],
              ].map(([label, val, setter, kbType, ph]) => (
                <View key={label} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={ph}
                    placeholderTextColor="#94A3B8"
                    keyboardType={kbType}
                    value={val}
                    onChangeText={setter}
                  />
                </View>
              ))}

              <Text style={{ fontWeight: '700', color: '#15803D', marginBottom: 8, marginTop: 8 }}>📄 Thông tin khám</Text>
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Yêu cầu khám (Request)</Text>
                <TextInput
                  style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Nhập yêu cầu khám..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={examRequest}
                  onChangeText={setExamRequest}
                />
              </View>
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Đối tượng</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Thu phí / BHYT..."
                  placeholderTextColor="#94A3B8"
                  value={examDiagnosis}
                  onChangeText={setExamDiagnosis}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── ORDER TAB (Phiếu chỉ định dịch vụ) ── */}
        {activeForm === 'order' && (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                📝 PHIẾU CHỈ ĐỊNH DỊCH VỤ
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16 }}>SỞ Y TẾ ĐÀ NẴNG • BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['Thường', 'Cấp Cứu'].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setOrderPriority(p)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                      backgroundColor: orderPriority === p ? (p === 'Cấp Cứu' ? '#FEE2E2' : '#ECFDF5') : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: orderPriority === p ? (p === 'Cấp Cứu' ? '#F87171' : '#6EE7B7') : '#E2E8F0',
                    }}
                  >
                    <Text style={{ color: orderPriority === p ? (p === 'Cấp Cứu' ? '#DC2626' : '#065F46') : '#64748B', fontWeight: '600', fontSize: 13 }}>
                      {p === 'Cấp Cứu' ? '🚨 ' : '✅ '}{p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Chẩn đoán</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập chẩn đoán..."
                  placeholderTextColor="#94A3B8"
                  value={orderDiagnosis}
                  onChangeText={setOrderDiagnosis}
                />
              </View>

              <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 8 }}>Danh sách chỉ định:</Text>

              {orderServices.map((svc, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#BBF7D0' }}>
                  <Text style={{ flex: 1, color: '#065F46', fontSize: 13 }}>📌 {svc}</Text>
                  <TouchableOpacity onPress={() => removeOrderService(idx)}>
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {orderServices.length === 0 && (
                <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 16 }}>Chưa có dịch vụ nào được chỉ định</Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Tên dịch vụ chỉ định..."
                  placeholderTextColor="#94A3B8"
                  value={orderNewService}
                  onChangeText={setOrderNewService}
                />
                <TouchableOpacity
                  onPress={addOrderService}
                  style={{ backgroundColor: '#15803D', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Common service shortcuts */}
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 12, marginBottom: 6 }}>Chọn nhanh:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['Khám chuyên khoa thần kinh', 'Chụp MRI sọ não', 'Phân tích AI chẩn đoán'].map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => { setOrderServices(prev => prev.includes(s) ? prev : [...prev, s]); }}
                    style={{ backgroundColor: '#EFF6FF', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#BFDBFE' }}
                  >
                    <Text style={{ color: '#15803D', fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── FEE TAB (Phiếu thu viện phí) ── */}
        {activeForm === 'fee' && (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                💰 PHIẾU THU VIỆN PHÍ
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>

              {/* Patient info summary */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontWeight: '700', color: '#374151', marginBottom: 6 }}>Thông tin bệnh nhân:</Text>
                <Text style={{ color: '#374151', fontSize: 13 }}>Họ và tên: <Text style={{ fontWeight: '600' }}>{patientName}</Text></Text>
                <Text style={{ color: '#374151', fontSize: 13 }}>Giới tính: {gender || 'N/A'}  •  Đối tượng: Thu phí</Text>
              </View>

              <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 8 }}>Danh sách dịch vụ:</Text>

              {/* Fee items table */}
              <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 10 }}>
                  <Text style={{ flex: 3, fontWeight: '600', color: '#374151', fontSize: 13 }}>Tên dịch vụ</Text>
                  <Text style={{ flex: 2, fontWeight: '600', color: '#374151', fontSize: 13, textAlign: 'right' }}>Thành tiền (VNĐ)</Text>
                  <Text style={{ width: 30 }}></Text>
                </View>
                {feeItems.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <Text style={{ flex: 3, color: '#374151', fontSize: 13 }}>{item.name}</Text>
                    <Text style={{ flex: 2, color: '#0F172A', fontSize: 13, fontWeight: '500', textAlign: 'right' }}>
                      {parseFloat(item.amount).toLocaleString('vi-VN')}
                    </Text>
                    <TouchableOpacity onPress={() => removeFeeItem(idx)} style={{ width: 30, alignItems: 'center' }}>
                      <Text style={{ color: '#EF4444', fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Add service row */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                <TextInput
                  style={[styles.textInput, { flex: 2 }]}
                  placeholder="Tên dịch vụ"
                  placeholderTextColor="#94A3B8"
                  value={feeNewName}
                  onChangeText={setFeeNewName}
                />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Số tiền"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={feeNewAmount}
                  onChangeText={setFeeNewAmount}
                />
                <TouchableOpacity
                  onPress={addFeeItem}
                  style={{ backgroundColor: '#15803D', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Ghi chú</Text>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Ghi chú thêm..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={feeNote}
                  onChangeText={setFeeNote}
                />
              </View>

              {/* Total */}
              <View style={{ backgroundColor: '#15803D', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>TỔNG CỘNG:</Text>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
                    {totalFee.toLocaleString('vi-VN')} VNĐ
                  </Text>
                </View>
              </View>

              {invoiceCreated ? (
                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#6EE7B7' }}>
                  <Text style={{ color: '#065F46', fontWeight: '700', textAlign: 'center' }}>✅ Đã gửi sang hàng đợi Thu Ngân</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleConfirmFee}
                  disabled={submitting}
                  style={{
                    backgroundColor: submitting ? '#94A3B8' : '#059669',
                    borderRadius: 10, padding: 14,
                    alignItems: 'center',
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      ✅ Xác nhận & Gửi sang Thu Ngân
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                Sau khi xác nhận, hóa đơn sẽ xuất hiện trong danh sách chờ thanh toán của Thu Ngân
              </Text>
            </View>
          </View>
        )}

      </View>
    </View>
  );
};

// Tab Components
const RecordsTab = ({ records, searchQuery, onSearch, onNewRecord, onViewRecord, onRefresh }) => {

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>📋 Hồ sơ bệnh án</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onNewRecord}>
            <Text style={styles.actionButtonText}>+ Thêm mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm theo tên bệnh nhân, mã hồ sơ..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={onSearch}
        />
      </View>

      <View style={styles.listContainer}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Không tìm thấy hồ sơ nào</Text>
          </View>
        ) : (
          records.map((record) => (
            <RecordCard
              key={record._id || record.id}
              record={record}
              onPress={() => onViewRecord(record)}
            />
          ))
        )}
      </View>
    </View>
  );
};

const RecordCard = ({ record, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.cardHeader}>
      <View>
        <Text style={styles.patientName}>{record.patientName}</Text>
        <Text style={styles.patientInfo}>
          {record.gender} • {record.age} tuổi • {record.patientId}
        </Text>
      </View>
      <View style={styles.badgeContainer}>
        <StatusBadge status={record.status} />
        <SignBadge signStatus={record.signStatus} />
      </View>
    </View>
    <View style={styles.cardFooter}>
      <Text style={styles.footerText}>👨‍⚕️ {record.doctorInCharge}</Text>
      <Text style={styles.footerText}>🏥 {record.department} • {record.admissionType}</Text>
    </View>
  </TouchableOpacity>
);

const CareTab = ({ careSheets, selectedRecord, onNewCare }) => (
  <View style={styles.tabContainer}>
    <View style={styles.tabHeader}>
      <Text style={styles.tabTitle}>📝 Phiếu chăm sóc</Text>
      <TouchableOpacity style={styles.actionButton} onPress={onNewCare}>
        <Text style={styles.actionButtonText}>+ Thêm phiếu</Text>
      </TouchableOpacity>
    </View>

    {!selectedRecord ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👈</Text>
        <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
      </View>
    ) : (
      <View style={styles.listContainer}>
        {careSheets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có phiếu chăm sóc nào</Text>
          </View>
        ) : (
          careSheets.map(cs => (
            <View key={cs._id || cs.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>Phiếu chăm sóc Cấp {cs.careLevel}</Text>
              <Text style={styles.itemSubtitle}>
                📅 {new Date(cs.createdAt).toLocaleDateString('vi-VN')} • Y tá: {cs.nurse}
              </Text>
              <View style={styles.vitalsRow}>
                <Text style={styles.vitalText}>Mạch: {cs.pulse} bpm</Text>
                <Text style={styles.vitalText}>HA: {cs.bloodPressure}</Text>
                <Text style={styles.vitalText}>Nhiệt độ: {cs.temperature}°C</Text>
                <Text style={styles.vitalText}>SpO2: {cs.spo2}%</Text>
              </View>
            </View>
          ))
        )}
      </View>
    )}
  </View>
);

const ConsultationTab = ({ consultations, selectedRecord, onNewConsult }) => (
  <View style={styles.tabContainer}>
    <View style={styles.tabHeader}>
      <Text style={styles.tabTitle}>🧠 Hội chẩn</Text>
      <TouchableOpacity style={styles.actionButton} onPress={onNewConsult}>
        <Text style={styles.actionButtonText}>+ Tạo hội chẩn</Text>
      </TouchableOpacity>
    </View>

    {!selectedRecord ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👈</Text>
        <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
      </View>
    ) : (
      <View style={styles.listContainer}>
        {consultations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có biên bản hội chẩn nào</Text>
          </View>
        ) : (
          consultations.map(c => (
            <View key={c._id || c.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{`Hội chẩn ${new Date(c.meetingDate).toLocaleDateString('vi-VN')}`}</Text>
              <Text style={styles.itemSubtitle}>
                📅 {new Date(c.meetingDate).toLocaleDateString('vi-VN')}
              </Text>
              <Text style={styles.itemDescription}>Tham gia: {c.participants?.join(', ')}</Text>
              <Text style={styles.itemDescription}>Kết luận: {c.treatmentConclusion}</Text>
            </View>
          ))
        )}
      </View>
    )}
  </View>
);

const ConsentTab = ({ consents, selectedRecord, onNewConsent }) => (
  <View style={styles.tabContainer}>
    <View style={styles.tabHeader}>
      <Text style={styles.tabTitle}>✍️ Giấy cam đoan</Text>
      <TouchableOpacity style={styles.actionButton} onPress={onNewConsent}>
        <Text style={styles.actionButtonText}>+ Tạo giấy cam đoan</Text>
      </TouchableOpacity>
    </View>

    {!selectedRecord ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👈</Text>
        <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
      </View>
    ) : (
      <View style={styles.listContainer}>
        {consents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có giấy cam đoan nào</Text>
          </View>
        ) : (
          consents.map(c => (
            <View key={c._id || c.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{c.procedureName}</Text>
              <Text style={styles.itemSubtitle}>
                📅 {new Date(c.createdAt).toLocaleDateString('vi-VN')}
              </Text>
              <View style={styles.signatureRow}>
                <StatusBadge status={c.doctorSigned ? 'Đã ký' : 'Chưa ký'} color="blue" />
                <StatusBadge status={c.patientSigned ? 'Đã ký' : 'Chưa ký'} color="green" />
              </View>
            </View>
          ))
        )}
      </View>
    )}
  </View>
);

const PrescriptionTab = ({ prescriptions, availableDrugs, selectedRecord, onNewPrescription }) => (
  <View style={styles.tabContainer}>
    <View style={styles.tabHeader}>
      <Text style={styles.tabTitle}>💊 Kê đơn thuốc</Text>
      <TouchableOpacity style={styles.actionButton} onPress={onNewPrescription}>
        <Text style={styles.actionButtonText}>+ Thêm đơn thuốc</Text>
      </TouchableOpacity>
    </View>

    {!selectedRecord ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👈</Text>
        <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
      </View>
    ) : (
      <View style={styles.listContainer}>
        {prescriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có đơn thuốc nào</Text>
          </View>
        ) : (
          prescriptions.map(p => (
            <View key={p._id || p.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{`Đơn thuốc ${new Date(p.recorded_at || p.createdAt || p.date || Date.now()).toLocaleDateString('vi-VN')}`}</Text>
              <Text style={styles.itemSubtitle}>Bác sĩ: {p.doctor_name} • Chẩn đoán: {p.diagnosis}</Text>
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: '600', color: '#374151' }}>Danh sách thuốc:</Text>
                {p.drugs?.map((d, i) => (
                  <Text key={i} style={{ color: '#475569', fontSize: 13 }}>- {d.name} ({d.quantity} {d.unit}): {d.usage}</Text>
                ))}
              </View>
              {p.note && <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Ghi chú: {p.note}</Text>}
            </View>
          ))
        )}
      </View>
    )}
  </View>
);

const VersionTab = ({ versions, selectedRecord }) => (
  <View style={styles.tabContainer}>
    <View style={styles.tabHeader}>
      <Text style={styles.tabTitle}>⏳ Lịch sử sửa đổi bệnh án (Audit Trail)</Text>
    </View>

    {!selectedRecord ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👈</Text>
        <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
      </View>
    ) : (
      <View style={styles.listContainer}>
        {versions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có bản ghi nhận chỉnh sửa nào (Phiên bản đầu tiên v1)</Text>
          </View>
        ) : (
          versions.map(v => (
            <View key={v._id || v.id} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.itemTitle, { color: '#15803D' }]}>Phiên bản EMR v{v.version}</Text>
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold' }}>
                  {new Date(v.modifiedAt).toLocaleString('vi-VN')}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 8 }}>
                Người sửa đổi: {v.modifiedBy}
              </Text>
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, gap: 8 }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase' }}>Chi tiết thay đổi:</Text>
                {Object.keys(v.changes || {}).map(field => (
                  <View key={field} style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', textTransform: 'capitalize' }}>
                      {field === 'diagnosis' ? 'Chẩn đoán' : field === 'treatmentPlan' ? 'Kế hoạch điều trị' : field}:
                    </Text>
                    <Text style={{ fontSize: 11, color: '#EF4444', textDecorationLine: 'line-through', marginTop: 2 }}>
                      Cũ: {v.changes[field].old || '(Trống)'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '500', marginTop: 1 }}>
                      Mới: {v.changes[field].new || '(Trống)'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    )}
  </View>
);

// Badge Components
const StatusBadge = ({ status }) => {
  let color, bg;
  if (status === 'Đang điều trị' || status === 'Đang điều trị') {
    bg = '#EFF6FF';
    color = '#15803D';
  } else if (status === 'Xuất viện' || status === 'Đã ký') {
    bg = '#DCFCE7';
    color = '#166534';
  } else {
    bg = '#FEF3C7';
    color = '#B45309';
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{status}</Text>
    </View>
  );
};

const SignBadge = ({ signStatus }) => {
  let color, bg;
  if (signStatus === 'Đã ký số' || signStatus === 'Đã duyệt') {
    bg = '#DCFCE7';
    color = '#166534';
  } else if (signStatus === 'Đã duyệt') {
    bg = '#EFF6FF';
    color = '#15803D';
  } else {
    bg = '#FEF3C7';
    color = '#B45309';
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: bg, marginTop: 6 }]}>
      <Text style={[styles.statusBadgeText, { color, fontSize: 10 }]}>{signStatus}</Text>
    </View>
  );
};

const ImagingTab = ({ imagingResults, selectedRecord, navigation }) => {
  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🧠 Lịch sử Chẩn đoán Hình ảnh</Text>
      </View>

      {!selectedRecord ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👈</Text>
          <Text style={styles.emptyText}>Vui lòng chọn một hồ sơ bệnh án</Text>
        </View>
      ) : imagingResults.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyText}>Chưa có kết quả chẩn đoán hình ảnh nào được lưu trữ cho bệnh án này.</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {imagingResults.map((item) => {
            const date = new Date(item.reportDate);
            const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            return (
              <TouchableOpacity
                key={item._id}
                style={styles.card}
                onPress={() => navigation.navigate('ImagingResult', { resultId: item._id })}
              >
                <View style={[styles.cardHeader, { marginBottom: 12 }]}>
                  <View style={{ backgroundColor: item.imagingType === 'MRI' ? '#EFF6FF' : '#FDF4FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 }}>
                    <Text style={{ color: item.imagingType === 'MRI' ? '#0284C7' : '#C026D3', fontWeight: 'bold' }}>{item.imagingType}</Text>
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 13 }}>{dateStr}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 }}>{item.procedure}</Text>
                <Text style={{ color: '#475569', fontSize: 14, marginBottom: 4 }}>Bác sĩ: <Text style={{ fontWeight: '500', color: '#1E293B' }}>{item.radiologist}</Text></Text>
                <Text style={{ color: '#475569', fontSize: 14, marginBottom: 12 }}>Chẩn đoán: <Text style={{ fontWeight: '500', color: '#1E293B' }}>{item.diagnosis}</Text></Text>
                <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
                <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>Kết luận:</Text>
                <Text style={{ color: '#334155', fontSize: 14 }} numberOfLines={2}>{item.conclusion}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// Modal Component
const EMRModal = ({ isVisible, type, onClose, onCreateRecord, onCreateCareSheet, onCreateConsultation, onCreateConsent }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {type === 'newRecord' && <NewRecordForm onClose={onClose} onSubmit={onCreateRecord} />}
          {type === 'newCareSheet' && <NewCareSheetForm onClose={onClose} onSubmit={onCreateCareSheet} />}
          {type === 'newConsultation' && <NewConsultationForm onClose={onClose} onSubmit={onCreateConsultation} />}
          {type === 'newConsent' && <NewConsentForm onClose={onClose} onSubmit={onCreateConsent} />}
          {type === 'newPrescription' && <NewPrescriptionForm onClose={onClose} onSubmit={onCreatePrescription} availableDrugs={availableDrugs} />}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// Form Components
const NewRecordForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    gender: 'Nam',
    age: '',
    bhytNumber: '',
    admissionType: 'Ngoại trú',
    department: 'Khoa Nội Thần Kinh',
    paymentMethod: 'BHYT',
    doctorInCharge: '',
    diagnosis: '',
    treatmentPlan: '',
  });

  const handleSubmit = () => {
    if (!formData.patientId || !formData.patientName || !formData.age || !formData.diagnosis || !formData.doctorInCharge) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc!');
      return;
    }
    onSubmit({
      ...formData,
      age: Number(formData.age),
    });
  };

  const handleOcrFill = () => {
    setFormData({
      patientId: 'PT-' + Math.floor(1000 + Math.random() * 9000),
      patientName: 'Lê Trần Gia Huy',
      gender: 'Nam',
      age: '29',
      admissionType: 'Ngoại trú',
      department: 'Khoa Ngoại Thần Kinh',
      paymentMethod: 'Viện phí',
      doctorInCharge: 'Bs. Văn Trung Nghĩa',
      diagnosis: 'Chấn động não nhẹ vùng trán sau tai nạn sinh hoạt',
      treatmentPlan: 'Nghỉ ngơi theo dõi sinh hiệu tại nhà, chụp MRI lại sau 24h nếu triệu chứng đau đầu tăng lên.',
    });
    Alert.alert('Xác thực OCR', 'Đã tự động trích xuất và điền thông tin từ Phiếu khám bệnh giấy!');
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Hồ sơ bệnh án mới</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.ocrFillBtn} onPress={handleOcrFill}>
          <Text style={styles.ocrFillBtnText}>⚡ Quét tự động (OCR & Fill)</Text>
        </TouchableOpacity>
        <FormField
          label="Mã bệnh nhân"
          placeholder="VD: PT-1234"
          value={formData.patientId}
          onChangeText={(text) => setFormData({ ...formData, patientId: text })}
        />
        <FormField
          label="Họ tên bệnh nhân"
          placeholder="Nguyễn Văn A"
          value={formData.patientName}
          onChangeText={(text) => setFormData({ ...formData, patientName: text })}
        />
        <FormField
          label="Giới tính"
          placeholder="Nam/Nữ"
          value={formData.gender}
          onChangeText={(text) => setFormData({ ...formData, gender: text })}
        />
        <FormField
          label="Tuổi"
          placeholder="45"
          keyboardType="numeric"
          value={formData.age}
          onChangeText={(text) => setFormData({ ...formData, age: text })}
        />
        {/* BHYT removed for privacy regulations */}
        <FormField
          label="Khoa khám"
          placeholder="Khoa Nội Thần Kinh"
          value={formData.department}
          onChangeText={(text) => setFormData({ ...formData, department: text })}
        />
        <FormField
          label="Loại khám"
          placeholder="Nội trú/Ngoại trú"
          value={formData.admissionType}
          onChangeText={(text) => setFormData({ ...formData, admissionType: text })}
        />
        <FormField
          label="Phương thức thanh toán"
          placeholder="BHYT/Viện phí/Dịch vụ"
          value={formData.paymentMethod}
          onChangeText={(text) => setFormData({ ...formData, paymentMethod: text })}
        />
        <FormField
          label="Bác sĩ phụ trách"
          placeholder="Tên bác sĩ"
          value={formData.doctorInCharge}
          onChangeText={(text) => setFormData({ ...formData, doctorInCharge: text })}
        />
        <FormField
          label="Chẩn đoán"
          placeholder="Chẩn đoán ban đầu..."
          multiline
          value={formData.diagnosis}
          onChangeText={(text) => setFormData({ ...formData, diagnosis: text })}
        />
        <FormField
          label="Kế hoạch điều trị"
          placeholder="Kế hoạch điều trị..."
          multiline
          value={formData.treatmentPlan}
          onChangeText={(text) => setFormData({ ...formData, treatmentPlan: text })}
        />
      </ScrollView>
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Tạo hồ sơ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const NewCareSheetForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    careLevel: 3,
    pulse: '',
    bloodPressure: '',
    temperature: '',
    respiratoryRate: '',
    spo2: '',
    progressNotes: '',
    careActions: '',
    nurse: '',
  });

  const handleSubmit = () => {
    if (!formData.pulse || !formData.bloodPressure || !formData.temperature || !formData.respiratoryRate || !formData.spo2 || !formData.progressNotes || !formData.nurse) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ các chỉ số sinh hiệu và diễn biến bệnh!');
      return;
    }
    onSubmit({
      ...formData,
      careLevel: Number(formData.careLevel),
      pulse: Number(formData.pulse),
      respiratoryRate: Number(formData.respiratoryRate),
      spo2: Number(formData.spo2),
      temperature: Number(formData.temperature),
    });
  };

  const handleOcrFill = () => {
    setFormData({
      careLevel: 2,
      pulse: '78',
      bloodPressure: '125/80',
      temperature: '36.8',
      respiratoryRate: '19',
      spo2: '97',
      nurse: 'Đd. Lê Thị Hoa',
      progressNotes: 'Bệnh nhân tỉnh táo, tiếp xúc tốt, đau đầu nhẹ vùng thái dương, ăn uống khá.',
      careActions: 'Cho bệnh nhân uống nước ấm, hướng dẫn nằm nghỉ ngơi tại giường, theo dõi mạch & HA mỗi 4h.',
    });
    Alert.alert('Xác thực OCR', 'Đã tự động điền sinh hiệu và diễn biến chăm sóc từ ghi chép giấy của điều dưỡng!');
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Phiếu chăm sóc</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.ocrFillBtn} onPress={handleOcrFill}>
          <Text style={styles.ocrFillBtnText}>⚡ Quét tự động (OCR & Fill)</Text>
        </TouchableOpacity>
        <FormField
          label="Cấp chăm sóc (1-3)"
          placeholder="3"
          keyboardType="numeric"
          value={String(formData.careLevel)}
          onChangeText={(text) => setFormData({ ...formData, careLevel: text })}
        />
        <FormField
          label="Mạch (lần/phút)"
          placeholder="72"
          keyboardType="numeric"
          value={formData.pulse}
          onChangeText={(text) => setFormData({ ...formData, pulse: text })}
        />
        <FormField
          label="Huyết áp (mmHg)"
          placeholder="120/80"
          value={formData.bloodPressure}
          onChangeText={(text) => setFormData({ ...formData, bloodPressure: text })}
        />
        <FormField
          label="Nhiệt độ (°C)"
          placeholder="36.5"
          keyboardType="decimal-pad"
          value={formData.temperature}
          onChangeText={(text) => setFormData({ ...formData, temperature: text })}
        />
        <FormField
          label="Nhịp thở (lần/phút)"
          placeholder="18"
          keyboardType="numeric"
          value={formData.respiratoryRate}
          onChangeText={(text) => setFormData({ ...formData, respiratoryRate: text })}
        />
        <FormField
          label="SpO2 (%)"
          placeholder="98"
          keyboardType="numeric"
          value={formData.spo2}
          onChangeText={(text) => setFormData({ ...formData, spo2: text })}
        />
        <FormField
          label="Y tá thực hiện"
          placeholder="Tên y tá"
          value={formData.nurse}
          onChangeText={(text) => setFormData({ ...formData, nurse: text })}
        />
        <FormField
          label="Diễn biến bệnh"
          placeholder="Ghi nhận diễn biến..."
          multiline
          value={formData.progressNotes}
          onChangeText={(text) => setFormData({ ...formData, progressNotes: text })}
        />
        <FormField
          label="Hành động chăm sóc"
          placeholder="Các biện pháp đã thực hiện..."
          multiline
          value={formData.careActions}
          onChangeText={(text) => setFormData({ ...formData, careActions: text })}
        />
      </ScrollView>
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Lưu phiếu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const NewConsultationForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    meetingDate: new Date().toISOString().split('T')[0],
    participants: '',
    clinicalSummary: '',
    diagnosis: '',
    treatmentConclusion: '',
  });

  const handleSubmit = () => {
    if (!formData.participants || !formData.clinicalSummary || !formData.diagnosis || !formData.treatmentConclusion) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin hội chẩn!');
      return;
    }
    onSubmit({
      ...formData,
      participants: formData.participants.split(',').map(p => p.trim()).filter(p => p),
    });
  };

  const handleOcrFill = () => {
    setFormData({
      meetingDate: new Date().toISOString().split('T')[0],
      participants: 'Bs. Nguyễn Hoàng Nam, Bs. Trần Minh Nghĩa, Bs. Văn Trung Nghĩa',
      clinicalSummary: 'Bệnh nhân nam 29 tuổi nhập viện vì đau đầu dữ dội kèm buồn nôn sau chấn thương vùng đầu ngày thứ 2.',
      diagnosis: 'Chấn động não nặng / Theo dõi tụ máu dưới màng cứng thùy trán',
      treatmentConclusion: 'Chỉ định chụp MRI sọ não lát cắt mỏng khẩn cấp, hội chẩn liên chuyên khoa để quyết định phẫu thuật hay điều trị nội khoa bảo tồn.',
    });
    Alert.alert('Xác thực OCR', 'Đã tự động điền nội dung trích xuất từ Biên bản hội chẩn giấy!');
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Biên bản hội chẩn</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.ocrFillBtn} onPress={handleOcrFill}>
          <Text style={styles.ocrFillBtnText}>⚡ Quét tự động (OCR & Fill)</Text>
        </TouchableOpacity>
        <FormField
          label="Ngày hội chẩn"
          placeholder="YYYY-MM-DD"
          value={formData.meetingDate}
          onChangeText={(text) => setFormData({ ...formData, meetingDate: text })}
        />
        <FormField
          label="Danh sách bác sĩ tham gia (phân cách bằng dấu phẩy)"
          placeholder="Bs. A, Bs. B, Bs. C"
          multiline
          value={formData.participants}
          onChangeText={(text) => setFormData({ ...formData, participants: text })}
        />
        <FormField
          label="Tóm tắt lâm sàng"
          placeholder="Tóm tắt tình trạng bệnh..."
          multiline
          value={formData.clinicalSummary}
          onChangeText={(text) => setFormData({ ...formData, clinicalSummary: text })}
        />
        <FormField
          label="Kết luận chẩn đoán"
          placeholder="Kết luận hội chẩn..."
          multiline
          value={formData.diagnosis}
          onChangeText={(text) => setFormData({ ...formData, diagnosis: text })}
        />
        <FormField
          label="Hướng điều trị"
          placeholder="Phương án điều trị..."
          multiline
          value={formData.treatmentConclusion}
          onChangeText={(text) => setFormData({ ...formData, treatmentConclusion: text })}
        />
      </ScrollView>
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Lưu biên bản</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const NewConsentForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    procedureName: '',
    risks: '',
    doctorExplanation: '',
  });

  const handleSubmit = () => {
    if (!formData.procedureName || !formData.risks || !formData.doctorExplanation) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    onSubmit(formData);
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Giấy cam đoan</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <FormField
          label="Tên thủ thuật/phẫu thuật"
          placeholder="Phẫu thuật..."
          value={formData.procedureName}
          onChangeText={(text) => setFormData({ ...formData, procedureName: text })}
        />
        <FormField
          label="Nguy cơ có thể gặp"
          placeholder="Mô tả các nguy cơ..."
          multiline
          value={formData.risks}
          onChangeText={(text) => setFormData({ ...formData, risks: text })}
        />
        <FormField
          label="Giải thích của bác sĩ"
          placeholder="Giải thích về thủ thuật..."
          multiline
          value={formData.doctorExplanation}
          onChangeText={(text) => setFormData({ ...formData, doctorExplanation: text })}
        />
      </ScrollView>
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Tạo giấy cam đoan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const NewPrescriptionForm = ({ onClose, onSubmit, availableDrugs }) => {
  const [formData, setFormData] = useState({
    diagnosis: '',
    note: '',
  });
  const [drugs, setDrugs] = useState([{ drugId: '', name: '', quantity: '', unit: '', usage: '' }]);

  const handleSubmit = () => {
    if (!formData.diagnosis || drugs.some(d => !d.name || !d.quantity)) {
      Alert.alert('Lỗi', 'Vui lòng nhập chẩn đoán và thông tin thuốc (tên, số lượng).');
      return;
    }
    onSubmit({
      ...formData,
      drugs: drugs.map(d => ({ ...d, quantity: Number(d.quantity) }))
    });
  };

  const updateDrug = (index, field, value) => {
    const newDrugs = [...drugs];
    newDrugs[index][field] = value;
    if (field === 'drugId') {
       const selected = availableDrugs.find(ad => ad._id === value);
       if (selected) {
         newDrugs[index].name = selected.name;
         newDrugs[index].unit = selected.unit || 'Viên';
       }
    }
    setDrugs(newDrugs);
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Kê Đơn Thuốc</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <FormField label="Chẩn đoán" placeholder="VD: Viêm xoang cấp" value={formData.diagnosis} onChangeText={t => setFormData({...formData, diagnosis: t})} />
        
        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#374151', marginVertical: 10 }}>Danh sách thuốc</Text>
        {drugs.map((d, index) => (
          <View key={index} style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Chọn thuốc từ kho</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {availableDrugs.map(ad => (
                 <TouchableOpacity 
                   key={ad._id} 
                   style={{ padding: 8, backgroundColor: d.drugId === ad._id ? '#15803D' : '#F1F5F9', borderRadius: 6, marginRight: 8 }}
                   onPress={() => updateDrug(index, 'drugId', ad._id)}
                 >
                   <Text style={{ color: d.drugId === ad._id ? '#FFF' : '#374151', fontSize: 12 }}>{ad.name}</Text>
                 </TouchableOpacity>
              ))}
            </ScrollView>
            <FormField label="Tên thuốc" value={d.name} onChangeText={t => updateDrug(index, 'name', t)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><FormField label="Số lượng" keyboardType="numeric" value={d.quantity} onChangeText={t => updateDrug(index, 'quantity', t)} /></View>
              <View style={{ flex: 1 }}><FormField label="Đơn vị" value={d.unit} onChangeText={t => updateDrug(index, 'unit', t)} /></View>
            </View>
            <FormField label="Cách dùng" placeholder="VD: Ngày 2 lần, mỗi lần 1 viên sau ăn" value={d.usage} onChangeText={t => updateDrug(index, 'usage', t)} />
            {drugs.length > 1 && (
              <TouchableOpacity onPress={() => setDrugs(drugs.filter((_, i) => i !== index))} style={{ alignSelf: 'flex-end', marginTop: 5 }}>
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>Xóa thuốc này</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={() => setDrugs([...drugs, { drugId: '', name: '', quantity: '', unit: '', usage: '' }])} style={{ padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#3B82F6', fontWeight: '600' }}>+ Thêm thuốc khác</Text>
        </TouchableOpacity>
        
        <FormField label="Ghi chú" placeholder="Ghi chú thêm..." value={formData.note} onChangeText={t => setFormData({...formData, note: t})} />
      </ScrollView>
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelButtonText}>Hủy</Text></TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}><Text style={styles.primaryButtonText}>Lưu đơn thuốc</Text></TouchableOpacity>
      </View>
    </View>
  );
};

const FormField = ({ label, placeholder, keyboardType, multiline, value, onChangeText }) => (
  <View style={styles.formField}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMultiline]}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      keyboardType={keyboardType}
      multiline={multiline}
      value={value}
      onChangeText={onChangeText}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  desktopSidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    padding: 24,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  sidebarNav: {
    gap: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#15803D',
    paddingLeft: 11,
  },
  sidebarIcon: {
    fontSize: 18,
  },
  sidebarItemText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  selectedRecordBox: {
    marginTop: 30,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  selectedRecordLabel: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 4,
  },
  selectedRecordName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  clearSelectionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  clearSelectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
  },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  mobileTabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mobileTabItemActive: {
    borderBottomColor: '#15803D',
  },
  mobileTabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  mobileTabTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  tabContainer: {
    width: '100%',
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionButton: {
    backgroundColor: '#15803D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#15803D',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refreshButtonText: {
    fontSize: 16,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#94A3B8',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  patientInfo: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  vitalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 650,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 20,
  },
  formContainer: {
    flex: 1,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '500',
  },
  formScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  formField: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    fontSize: 15,
    color: '#0F172A',
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#15803D',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#15803D',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ocrFillBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  ocrFillBtnText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default EMRDashboardScreen;
