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

const EMRDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  // Data states
  const [records, setRecords] = useState([]);
  const [careSheets, setCareSheets] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [consents, setConsents] = useState([]);
  
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
      const [careData, consultData, consentData] = await Promise.all([
        apiRequest(`/emr/records/${recordId}/care-sheets`),
        apiRequest(`/emr/records/${recordId}/consultations`),
        apiRequest(`/emr/records/${recordId}/consents`),
      ]);
      setCareSheets(careData.data || []);
      setConsultations(consultData.data || []);
      setConsents(consentData.data || []);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải chi tiết bệnh án.');
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
              </View>
              {selectedRecord && (
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
            </View>
          )}

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Mobile tab bar */}
            {!isDesktop && (
              <View style={styles.mobileTabBar}>
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
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0D9488" />
                <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.scrollContainer}>
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
                      setSelectedRecord(record);
                      fetchRecordDetails(record._id);
                      Alert.alert('Thông báo', `Đã chọn hồ sơ của ${record.patientName}`);
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
              </ScrollView>
            )}
          </View>
        </View>

        {/* Modal */}
        <EMRModal
          isVisible={isModalVisible}
          type={modalType}
          onClose={() => setIsModalVisible(false)}
          onCreateRecord={handleCreateRecord}
          onCreateCareSheet={handleCreateCareSheet}
          onCreateConsultation={handleCreateConsultation}
          onCreateConsent={handleCreateConsent}
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

// Badge Components
const StatusBadge = ({ status }) => {
  let color, bg;
  if (status === 'Đang điều trị' || status === 'Đang điều trị') {
    bg = '#EFF6FF';
    color = '#1D4ED8';
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
    color = '#1D4ED8';
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

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Hồ sơ bệnh án mới</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
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

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Phiếu chăm sóc</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
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

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Biên bản hội chẩn</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
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
    borderLeftColor: '#1D4ED8',
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
    color: '#1D4ED8',
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
    borderBottomColor: '#1D4ED8',
  },
  mobileTabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  mobileTabTextActive: {
    color: '#1D4ED8',
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
    backgroundColor: '#0D9488',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#0D9488',
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
    backgroundColor: '#0D9488',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#0D9488',
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
});

export default EMRDashboardScreen;
