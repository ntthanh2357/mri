import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post, put } from '../services/api.service';

const PatientRecordsScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'care' | 'consult' | 'consent'

  // Document sub-data
  const [careSheets, setCareSheets] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [consents, setConsents] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  // Modals state
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showAddCareModal, setShowAddCareModal] = useState(false);
  const [showAddConsultModal, setShowAddConsultModal] = useState(false);
  const [showAddConsentModal, setShowAddConsentModal] = useState(false);

  // New Record Form State
  const [newRecord, setNewRecord] = useState({
    patientId: '',
    patientName: '',
    gender: 'Nam',
    age: '',
    bhytNumber: '',
    admissionType: 'Ngoại trú',
    department: 'Khoa Nội Thần Kinh',
    paymentMethod: 'Viện phí',
    diagnosis: '',
    treatmentPlan: '',
    doctorInCharge: 'Bs. Gia Huy',
  });

  // New Care Sheet Form State
  const [newCare, setNewCare] = useState({
    careLevel: 3,
    pulse: '',
    bloodPressure: '',
    temperature: '',
    respiratoryRate: '',
    spo2: '',
    progressNotes: '',
    careActions: '',
    nurse: 'Đd. Minh Anh',
  });

  // New Consultation Form State
  const [newConsult, setNewConsult] = useState({
    participants: '',
    clinicalSummary: '',
    diagnosis: '',
    treatmentConclusion: '',
  });

  // New Consent Form State
  const [newConsent, setNewConsent] = useState({
    procedureName: '',
    risks: 'Chảy máu, nhiễm trùng vết mổ, tai biến do gây mê/gây tê, tử vong tỷ lệ thấp.',
    doctorExplanation: 'Phẫu thuật/thủ thuật được chỉ định nhằm điều trị hoặc hỗ trợ chẩn đoán chính xác tình trạng bệnh lý hiện tại.',
  });

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Fetch records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await get(`/emr/records?search=${encodeURIComponent(search)}`);
      if (res.status === 'success') {
        setRecords(res.data);
      }
    } catch (error) {
      console.error('Fetch records error:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách hồ sơ bệnh án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [search]);

  // Fetch sub-documents when record or tab changes
  useEffect(() => {
    if (!selectedRecord) return;
    
    const fetchSubData = async () => {
      setSubLoading(true);
      try {
        if (activeTab === 'care') {
          const res = await get(`/emr/records/${selectedRecord._id}/care-sheets`);
          if (res.status === 'success') setCareSheets(res.data);
        } else if (activeTab === 'consult') {
          const res = await get(`/emr/records/${selectedRecord._id}/consultations`);
          if (res.status === 'success') setConsultations(res.data);
        } else if (activeTab === 'consent') {
          const res = await get(`/emr/records/${selectedRecord._id}/consents`);
          if (res.status === 'success') setConsents(res.data);
        }
      } catch (error) {
        console.error('Fetch sub-data error:', error);
      } finally {
        setSubLoading(false);
      }
    };

    fetchSubData();
  }, [selectedRecord, activeTab]);

  // Handle Create Medical Record
  const handleCreateRecord = async () => {
    if (!newRecord.patientId || !newRecord.patientName || !newRecord.age || !newRecord.diagnosis) {
      Alert.alert('Thông báo', 'Vui lòng điền các thông tin bắt buộc.');
      return;
    }

    try {
      const res = await post('/emr/records', {
        ...newRecord,
        age: parseInt(newRecord.age),
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã tạo hồ sơ bệnh án mới.');
        setShowAddRecordModal(false);
        setNewRecord({
          patientId: '',
          patientName: '',
          gender: 'Nam',
          age: '',
          bhytNumber: '',
          admissionType: 'Ngoại trú',
          department: 'Khoa Nội Thần Kinh',
          paymentMethod: 'Viện phí',
          diagnosis: '',
          treatmentPlan: '',
          doctorInCharge: 'Bs. Gia Huy',
        });
        fetchRecords();
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo bệnh án mới.');
    }
  };

  // Handle Create Care Sheet
  const handleCreateCare = async () => {
    if (!newCare.pulse || !newCare.bloodPressure || !newCare.temperature || !newCare.respiratoryRate || !newCare.spo2 || !newCare.progressNotes) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ các chỉ số sinh hiệu.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/care-sheets`, {
        careLevel: parseInt(newCare.careLevel),
        pulse: parseInt(newCare.pulse),
        bloodPressure: newCare.bloodPressure,
        temperature: parseFloat(newCare.temperature),
        respiratoryRate: parseInt(newCare.respiratoryRate),
        spo2: parseInt(newCare.spo2),
        progressNotes: newCare.progressNotes,
        careActions: newCare.careActions,
        nurse: newCare.nurse,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã lưu phiếu chăm sóc.');
        setShowAddCareModal(false);
        setNewCare({
          careLevel: 3,
          pulse: '',
          bloodPressure: '',
          temperature: '',
          respiratoryRate: '',
          spo2: '',
          progressNotes: '',
          careActions: '',
          nurse: 'Đd. Minh Anh',
        });
        // Reload care sheets list
        const resList = await get(`/emr/records/${selectedRecord._id}/care-sheets`);
        if (resList.status === 'success') setCareSheets(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo phiếu chăm sóc.');
    }
  };

  // Handle Create Consultation
  const handleCreateConsult = async () => {
    if (!newConsult.participants || !newConsult.clinicalSummary || !newConsult.diagnosis || !newConsult.treatmentConclusion) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin hội chẩn.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/consultations`, {
        participants: newConsult.participants.split(',').map(p => p.trim()),
        clinicalSummary: newConsult.clinicalSummary,
        diagnosis: newConsult.diagnosis,
        treatmentConclusion: newConsult.treatmentConclusion,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã lưu biên bản hội chẩn.');
        setShowAddConsultModal(false);
        setNewConsult({
          participants: '',
          clinicalSummary: '',
          diagnosis: '',
          treatmentConclusion: '',
        });
        // Reload list
        const resList = await get(`/emr/records/${selectedRecord._id}/consultations`);
        if (resList.status === 'success') setConsultations(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo biên bản hội chẩn.');
    }
  };

  // Handle Create Consent
  const handleCreateConsent = async () => {
    if (!newConsent.procedureName) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên phẫu thuật/thủ thuật.');
      return;
    }

    try {
      const res = await post(`/emr/records/${selectedRecord._id}/consents`, newConsent);

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã tạo giấy cam đoan phẫu thuật/thủ thuật.');
        setShowAddConsentModal(false);
        setNewConsent({
          procedureName: '',
          risks: 'Chảy máu, nhiễm trùng vết mổ, tai biến do gây mê/gây tê, tử vong tỷ lệ thấp.',
          doctorExplanation: 'Phẫu thuật/thủ thuật được chỉ định nhằm điều trị hoặc hỗ trợ chẩn đoán chính xác tình trạng bệnh lý hiện tại.',
        });
        // Reload list
        const resList = await get(`/emr/records/${selectedRecord._id}/consents`);
        if (resList.status === 'success') setConsents(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo giấy cam đoan.');
    }
  };

  // Handle Sign Consent
  const handleSignConsent = async (consentId, role, signatureName) => {
    try {
      const res = await put(`/emr/consents/${consentId}/sign`, {
        role,
        signature: signatureName,
      });

      if (res.status === 'success') {
        Alert.alert('Thành công', 'Đã thực hiện ký số xác nhận.');
        // Reload consents
        const resList = await get(`/emr/records/${selectedRecord._id}/consents`);
        if (resList.status === 'success') setConsents(resList.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể thực hiện ký duyệt.');
    }
  };

  // Handle Update Record SignStatus / Status
  const handleUpdateRecordStatus = async (updates) => {
    try {
      const res = await put(`/emr/records/${selectedRecord._id}`, updates);
      if (res.status === 'success') {
        setSelectedRecord(res.data);
        Alert.alert('Thành công', 'Đã cập nhật trạng thái hồ sơ bệnh án.');
        fetchRecords();
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ.');
    }
  };

  const getCareBadgeColor = (level) => {
    if (level === 1) return { bg: '#FEE2E2', text: '#EF4444' };
    if (level === 2) return { bg: '#FEF3C7', text: '#D97706' };
    return { bg: '#EFF6FF', text: '#2563EB' };
  };

  const getSignBadgeColor = (status) => {
    if (status === 'Đã ký số') return { bg: '#DCFCE7', text: '#166534' };
    if (status === 'Đã duyệt') return { bg: '#E0F2FE', text: '#0369A1' };
    return { bg: '#F1F5F9', text: '#475569' };
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
              if (selectedRecord) setSelectedRecord(null);
              else navigation.navigate('Home');
            }} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {selectedRecord ? 'Chi tiết Bệnh án' : 'Hồ sơ Bệnh nhân (EMR)'}
            </Text>
          </View>
        )}

        <View style={styles.contentContainer}>
          {/* Main area split into List and Details for Desktop */}
          {(!selectedRecord || isDesktop) && (
            <View style={[styles.leftPane, selectedRecord && styles.desktopBorder]}>
              {/* Header Title with Add Button */}
              <View style={styles.paneHeader}>
                <Text style={styles.paneTitle}>Danh sách bệnh án</Text>
                <TouchableOpacity
                  style={styles.addRecordBtn}
                  onPress={() => setShowAddRecordModal(true)}
                >
                  <Text style={styles.addRecordBtnText}>+ Thêm bệnh án</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm theo tên, CCCD/Mã y tế, chẩn đoán..."
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {loading ? (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color="#15803D" />
                </View>
              ) : (
                <ScrollView style={styles.recordList}>
                  {records.map((r) => {
                    const signColors = getSignBadgeColor(r.signStatus);
                    const isSelected = selectedRecord && selectedRecord._id === r._id;
                    return (
                      <TouchableOpacity
                        key={r._id}
                        style={[styles.recordItem, isSelected && styles.selectedItem]}
                        onPress={() => {
                          setSelectedRecord(r);
                          setActiveTab('info');
                        }}
                      >
                        <View style={styles.recordMain}>
                          <Text style={styles.patientName}>{r.patientName}</Text>
                          <Text style={styles.patientSub}>
                            {r.patientId} • {r.age} tuổi • {r.gender}
                          </Text>
                          <Text style={styles.diagnosisText}>Chẩn đoán: {r.diagnosis}</Text>
                        </View>
                        <View style={styles.recordMeta}>
                          <View style={[styles.statusBadge, { backgroundColor: signColors.bg }]}>
                            <Text style={[styles.statusText, { color: signColors.text }]}>
                              {r.signStatus}
                            </Text>
                          </View>
                          <Text style={styles.departmentText}>{r.admissionType}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {records.length === 0 && (
                    <Text style={styles.emptyText}>Không tìm thấy bệnh án nào.</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Details Pane */}
          {selectedRecord && (
            <View style={styles.rightPane}>
              {/* Patient Name / SBA Banner */}
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailTitle}>{selectedRecord.patientName}</Text>
                  <Text style={styles.detailSub}>
                    Mã y tế: {selectedRecord.patientId} | Khoa: {selectedRecord.department}
                  </Text>
                </View>
                {/* Close detail view on mobile */}
                {!isDesktop && (
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Text style={styles.closeBtnText}>Đóng ✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tabs navigation */}
              <View style={styles.tabBar}>
                {[
                  { id: 'info', label: 'Thông tin chung' },
                  { id: 'care', label: 'Phiếu chăm sóc' },
                  { id: 'consult', label: 'Biên bản hội chẩn' },
                  { id: 'consent', label: 'Cam kết phẫu thuật' },
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tabItem, activeTab === t.id && styles.activeTabItem]}
                    onPress={() => setActiveTab(t.id)}
                  >
                    <Text style={[styles.tabLabel, activeTab === t.id && styles.activeTabLabel]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab Contents */}
              <ScrollView style={styles.tabContent}>
                {activeTab === 'info' && (
                  <View style={styles.infoTab}>
                    <View style={styles.gridInfo}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Họ và tên:</Text>
                        <Text style={styles.infoValue}>{selectedRecord.patientName}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Giới tính / Tuổi:</Text>
                        <Text style={styles.infoValue}>
                          {selectedRecord.gender} / {selectedRecord.age} tuổi
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Số thẻ BHYT:</Text>
                        <Text style={styles.infoValue}>
                          {selectedRecord.bhytNumber || 'Không có BHYT'}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Loại lượt khám:</Text>
                        <Text style={styles.infoValue}>{selectedRecord.admissionType}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Đối tượng thanh toán:</Text>
                        <Text style={styles.infoValue}>{selectedRecord.paymentMethod}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Bác sĩ phụ trách:</Text>
                        <Text style={styles.infoValue}>{selectedRecord.doctorInCharge}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Chẩn đoán chính:</Text>
                        <Text style={[styles.infoValue, { fontWeight: 'bold', color: '#1E293B' }]}>
                          {selectedRecord.diagnosis}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Hướng điều trị:</Text>
                        <Text style={styles.infoValue}>
                          {selectedRecord.treatmentPlan || 'Đang cập nhật...'}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Trạng thái điều trị:</Text>
                        <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>
                          {selectedRecord.status}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Trạng thái duyệt:</Text>
                        <View style={[styles.statusBadge, getSignBadgeColor(selectedRecord.signStatus), { alignSelf: 'flex-start' }]}>
                          <Text style={[styles.statusText, { color: getSignBadgeColor(selectedRecord.signStatus).text }]}>
                            {selectedRecord.signStatus}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions Panel */}
                    <View style={styles.actionsPanel}>
                      <Text style={styles.actionPanelTitle}>Thao tác EMR nội bộ</Text>
                      <View style={styles.actionRowBtns}>
                        {selectedRecord.signStatus === 'Chưa duyệt' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
                            onPress={() => handleUpdateRecordStatus({ signStatus: 'Đã duyệt' })}
                          >
                            <Text style={styles.actionBtnText}>Duyệt Hồ Sơ</Text>
                          </TouchableOpacity>
                        )}
                        {selectedRecord.signStatus === 'Đã duyệt' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#16A34A' }]}
                            onPress={() => handleUpdateRecordStatus({ signStatus: 'Đã ký số' })}
                          >
                            <Text style={styles.actionBtnText}>Ký Số Bệnh Án</Text>
                          </TouchableOpacity>
                        )}
                        {selectedRecord.status === 'Đang điều trị' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#475569' }]}
                            onPress={() => handleUpdateRecordStatus({ status: 'Xuất viện' })}
                          >
                            <Text style={styles.actionBtnText}>Cho Xuất Viện</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {activeTab === 'care' && (
                  <View style={styles.subTabContainer}>
                    <View style={styles.subTabHeader}>
                      <Text style={styles.subTitle}>Theo dõi & Chăm sóc lâm sàng</Text>
                      <TouchableOpacity
                        style={styles.addSubBtn}
                        onPress={() => setShowAddCareModal(true)}
                      >
                        <Text style={styles.addSubBtnText}>+ Thêm phiếu</Text>
                      </TouchableOpacity>
                    </View>

                    {subLoading ? (
                      <ActivityIndicator size="small" color="#15803D" />
                    ) : (
                      careSheets.map(c => {
                        const careBadge = getCareBadgeColor(c.careLevel);
                        return (
                          <View key={c._id} style={styles.careSheetItem}>
                            <View style={styles.careSheetHeader}>
                              <View style={[styles.statusBadge, { backgroundColor: careBadge.bg }]}>
                                <Text style={[styles.statusText, { color: careBadge.text }]}>
                                  Chăm sóc Cấp {c.careLevel}
                                </Text>
                              </View>
                              <Text style={styles.nurseText}>ĐD thực hiện: {c.nurse}</Text>
                            </View>
                            
                            {/* Vital Signs Grid */}
                            <View style={styles.vitalsGrid}>
                              <View style={styles.vitalBox}>
                                <Text style={styles.vitalLabel}>Mạch</Text>
                                <Text style={styles.vitalVal}>{c.pulse} bpm</Text>
                              </View>
                              <View style={styles.vitalBox}>
                                <Text style={styles.vitalLabel}>Huyết áp</Text>
                                <Text style={styles.vitalVal}>{c.bloodPressure} mmHg</Text>
                              </View>
                              <View style={styles.vitalBox}>
                                <Text style={styles.vitalLabel}>Nhiệt độ</Text>
                                <Text style={styles.vitalVal}>{c.temperature} °C</Text>
                              </View>
                              <View style={styles.vitalBox}>
                                <Text style={styles.vitalLabel}>Nhịp thở</Text>
                                <Text style={styles.vitalVal}>{c.respiratoryRate}/phút</Text>
                              </View>
                              <View style={styles.vitalBox}>
                                <Text style={styles.vitalLabel}>SpO2</Text>
                                <Text style={styles.vitalVal}>{c.spo2}%</Text>
                              </View>
                            </View>

                            <Text style={styles.careNotes}>
                              <Text style={{ fontWeight: 'bold' }}>Diễn biến: </Text>{c.progressNotes}
                            </Text>
                            {c.careActions && (
                              <Text style={styles.careNotes}>
                                <Text style={{ fontWeight: 'bold' }}>Chăm sóc: </Text>{c.careActions}
                              </Text>
                            )}
                          </View>
                        );
                      })
                    )}
                    {careSheets.length === 0 && !subLoading && (
                      <Text style={styles.emptyText}>Chưa có phiếu chăm sóc nào cho bệnh án này.</Text>
                    )}
                  </View>
                )}

                {activeTab === 'consult' && (
                  <View style={styles.subTabContainer}>
                    <View style={styles.subTabHeader}>
                      <Text style={styles.subTitle}>Biên bản hội chẩn chuyên khoa</Text>
                      <TouchableOpacity
                        style={styles.addSubBtn}
                        onPress={() => setShowAddConsultModal(true)}
                      >
                        <Text style={styles.addSubBtnText}>+ Lập biên bản</Text>
                      </TouchableOpacity>
                    </View>

                    {subLoading ? (
                      <ActivityIndicator size="small" color="#15803D" />
                    ) : (
                      consultations.map(c => (
                        <View key={c._id} style={styles.consultItem}>
                          <View style={styles.consultHeader}>
                            <Text style={styles.consultDate}>
                              Họp lúc: {new Date(c.meetingDate).toLocaleString('vi-VN')}
                            </Text>
                          </View>
                          <Text style={styles.consultText}>
                            <Text style={{ fontWeight: 'bold' }}>Hội đồng: </Text>
                            {c.participants.join(', ')}
                          </Text>
                          <Text style={styles.consultText}>
                            <Text style={{ fontWeight: 'bold' }}>Tóm tắt bệnh lý: </Text>
                            {c.clinicalSummary}
                          </Text>
                          <Text style={styles.consultText}>
                            <Text style={{ fontWeight: 'bold' }}>Chẩn đoán hội chẩn: </Text>
                            {c.diagnosis}
                          </Text>
                          <Text style={styles.consultConclusion}>
                            <Text style={{ fontWeight: 'bold' }}>Kết luận & Hướng điều trị: </Text>
                            {c.treatmentConclusion}
                          </Text>
                        </View>
                      ))
                    )}
                    {consultations.length === 0 && !subLoading && (
                      <Text style={styles.emptyText}>Không có biên bản hội chẩn nào cho bệnh án này.</Text>
                    )}
                  </View>
                )}

                {activeTab === 'consent' && (
                  <View style={styles.subTabContainer}>
                    <View style={styles.subTabHeader}>
                      <Text style={styles.subTitle}>Giấy cam đoan chấp thuận phẫu thuật/thủ thuật</Text>
                      <TouchableOpacity
                        style={styles.addSubBtn}
                        onPress={() => setShowAddConsentModal(true)}
                      >
                        <Text style={styles.addSubBtnText}>+ Tạo cam kết</Text>
                      </TouchableOpacity>
                    </View>

                    {subLoading ? (
                      <ActivityIndicator size="small" color="#15803D" />
                    ) : (
                      consents.map(c => (
                        <View key={c._id} style={styles.consentItem}>
                          <Text style={styles.consentProcedure}>Thủ thuật: {c.procedureName}</Text>
                          <Text style={styles.consentBodyText}>
                            <Text style={{ fontWeight: 'bold' }}>Giải thích của bác sĩ: </Text>
                            {c.doctorExplanation}
                          </Text>
                          <Text style={styles.consentBodyText}>
                            <Text style={{ fontWeight: 'bold' }}>Các nguy cơ tai biến: </Text>
                            {c.risks}
                          </Text>

                          {/* Signatures Row */}
                          <View style={styles.signaturesRow}>
                            <View style={styles.signatureBox}>
                              <Text style={styles.sigLabel}>Chữ ký Bác sĩ giải thích</Text>
                              {c.doctorSigned ? (
                                <View style={styles.signedArea}>
                                  <Text style={styles.signedText}>✓ ĐÃ KÝ SỐ</Text>
                                  <Text style={styles.signedName}>{c.doctorSignature}</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.signActionBtn}
                                  onPress={() => handleSignConsent(c._id, 'doctor', 'Bs. Gia Huy')}
                                >
                                  <Text style={styles.signActionBtnText}>Ký số Bác sĩ</Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={styles.signatureBox}>
                              <Text style={styles.sigLabel}>Người bệnh / Đại diện cam đoan</Text>
                              {c.patientSigned ? (
                                <View style={styles.signedArea}>
                                  <Text style={styles.signedText}>✓ ĐÃ KÝ XÁC NHẬN</Text>
                                  <Text style={styles.signedName}>{c.patientSignature}</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.signActionBtn, { backgroundColor: '#0369A1' }]}
                                  onPress={() => handleSignConsent(c._id, 'patient', selectedRecord.patientName)}
                                >
                                  <Text style={styles.signActionBtnText}>Ký xác nhận BN</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                    {consents.length === 0 && !subLoading && (
                      <Text style={styles.emptyText}>Chưa tạo giấy cam đoan phẫu thuật nào.</Text>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ─── MODALS ─── */}

        {/* Add Record Modal */}
        <Modal visible={showAddRecordModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tạo Hồ Sơ Bệnh Án Mới</Text>
              <ScrollView style={styles.modalForm}>
                <Text style={styles.inputLabel}>Mã định danh bệnh nhân (CCCD/Mã y tế) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nhập số CCCD hoặc Mã y tế"
                  placeholderTextColor="#94A3B8"
                  value={newRecord.patientId}
                  onChangeText={(t) => setNewRecord({ ...newRecord, patientId: t })}
                />

                <Text style={styles.inputLabel}>Họ và tên bệnh nhân *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nhập họ tên đầy đủ"
                  placeholderTextColor="#94A3B8"
                  value={newRecord.patientName}
                  onChangeText={(t) => setNewRecord({ ...newRecord, patientName: t })}
                />

                <View style={styles.modalFormRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Tuổi *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Tuổi"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      value={newRecord.age}
                      onChangeText={(t) => setNewRecord({ ...newRecord, age: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Giới tính</Text>
                    <View style={styles.genderSelect}>
                      {['Nam', 'Nữ'].map(g => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.genderBtn, newRecord.gender === g && styles.genderBtnActive]}
                          onPress={() => setNewRecord({ ...newRecord, gender: g })}
                        >
                          <Text style={[styles.genderBtnText, newRecord.gender === g && styles.genderBtnTextActive]}>
                            {g}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Số thẻ BHYT (nếu có)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nhập mã số thẻ BHYT"
                  placeholderTextColor="#94A3B8"
                  value={newRecord.bhytNumber}
                  onChangeText={(t) => setNewRecord({ ...newRecord, bhytNumber: t })}
                />

                <Text style={styles.inputLabel}>Đối tượng thanh toán</Text>
                <View style={styles.admissionTypeSelect}>
                  {['Viện phí', 'BHYT', 'Dịch vụ'].map(pm => (
                    <TouchableOpacity
                      key={pm}
                      style={[styles.selectBtn, newRecord.paymentMethod === pm && styles.selectBtnActive]}
                      onPress={() => setNewRecord({ ...newRecord, paymentMethod: pm })}
                    >
                      <Text style={[styles.selectBtnText, newRecord.paymentMethod === pm && styles.selectBtnTextActive]}>
                        {pm}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Phân hệ / Lượt điều trị</Text>
                <View style={styles.admissionTypeSelect}>
                  {['Ngoại trú', 'Nội trú', 'Cấp cứu'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.selectBtn, newRecord.admissionType === type && styles.selectBtnActive]}
                      onPress={() => setNewRecord({ ...newRecord, admissionType: type })}
                    >
                      <Text style={[styles.selectBtnText, newRecord.admissionType === type && styles.selectBtnTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Chẩn đoán lâm sàng *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Chẩn đoán bệnh lý ban đầu"
                  placeholderTextColor="#94A3B8"
                  value={newRecord.diagnosis}
                  onChangeText={(t) => setNewRecord({ ...newRecord, diagnosis: t })}
                />

                <Text style={styles.inputLabel}>Phác đồ điều trị ban đầu</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  placeholder="Chi tiết phác đồ y lệnh điều trị"
                  placeholderTextColor="#94A3B8"
                  value={newRecord.treatmentPlan}
                  onChangeText={(t) => setNewRecord({ ...newRecord, treatmentPlan: t })}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn]}
                  onPress={() => setShowAddRecordModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn]}
                  onPress={handleCreateRecord}
                >
                  <Text style={styles.modalSaveBtnText}>Lưu bệnh án</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Care Modal */}
        <Modal visible={showAddCareModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tạo Phiếu Chăm Sóc</Text>
              <ScrollView style={styles.modalForm}>
                <Text style={styles.inputLabel}>Phân cấp chăm sóc</Text>
                <View style={styles.admissionTypeSelect}>
                  {[1, 2, 3].map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.selectBtn, newCare.careLevel === level && styles.selectBtnActive]}
                      onPress={() => setNewCare({ ...newCare, careLevel: level })}
                    >
                      <Text style={[styles.selectBtnText, newCare.careLevel === level && styles.selectBtnTextActive]}>
                        Cấp {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalFormRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Mạch (bpm) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="numeric"
                      placeholder="e.g. 75"
                      placeholderTextColor="#94A3B8"
                      value={newCare.pulse}
                      onChangeText={(t) => setNewCare({ ...newCare, pulse: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Huyết áp (mmHg) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. 120/80"
                      placeholderTextColor="#94A3B8"
                      value={newCare.bloodPressure}
                      onChangeText={(t) => setNewCare({ ...newCare, bloodPressure: t })}
                    />
                  </View>
                </View>

                <View style={styles.modalFormRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Nhiệt độ (°C) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="numeric"
                      placeholder="e.g. 37.0"
                      placeholderTextColor="#94A3B8"
                      value={newCare.temperature}
                      onChangeText={(t) => setNewCare({ ...newCare, temperature: t })}
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Nhịp thở / phút *</Text>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="numeric"
                      placeholder="e.g. 18"
                      placeholderTextColor="#94A3B8"
                      value={newCare.respiratoryRate}
                      onChangeText={(t) => setNewCare({ ...newCare, respiratoryRate: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>SpO2 (%) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="numeric"
                      placeholder="e.g. 98"
                      placeholderTextColor="#94A3B8"
                      value={newCare.spo2}
                      onChangeText={(t) => setNewCare({ ...newCare, spo2: t })}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Diễn biến bệnh lý lâm sàng *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  placeholder="Ghi nhận diễn biến sức khỏe, triệu chứng cụ thể..."
                  placeholderTextColor="#94A3B8"
                  value={newCare.progressNotes}
                  onChangeText={(t) => setNewCare({ ...newCare, progressNotes: t })}
                />

                <Text style={styles.inputLabel}>Chế độ chăm sóc & Thực hiện y lệnh</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  placeholder="Chăm sóc dinh dưỡng, thực hiện thuốc theo y lệnh..."
                  placeholderTextColor="#94A3B8"
                  value={newCare.careActions}
                  onChangeText={(t) => setNewCare({ ...newCare, careActions: t })}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn]}
                  onPress={() => setShowAddCareModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn]}
                  onPress={handleCreateCare}
                >
                  <Text style={styles.modalSaveBtnText}>Lưu Phiếu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Consult Modal */}
        <Modal visible={showAddConsultModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Lập Biên Bản Hội Chẩn</Text>
              <ScrollView style={styles.modalForm}>
                <Text style={styles.inputLabel}>Thành viên hội đồng (cách nhau bằng dấu phẩy) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Bs. Nguyễn Văn A, Bs. Lê Văn B"
                  placeholderTextColor="#94A3B8"
                  value={newConsult.participants}
                  onChangeText={(t) => setNewConsult({ ...newConsult, participants: t })}
                />

                <Text style={styles.inputLabel}>Tóm tắt diễn biến lâm sàng *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 65 }]}
                  multiline
                  placeholder="Quá trình nhập viện, diễn biến điều trị chuyên khoa..."
                  placeholderTextColor="#94A3B8"
                  value={newConsult.clinicalSummary}
                  onChangeText={(t) => setNewConsult({ ...newConsult, clinicalSummary: t })}
                />

                <Text style={styles.inputLabel}>Chẩn đoán xác định hội chẩn *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Kết luận chẩn đoán chung của hội đồng"
                  placeholderTextColor="#94A3B8"
                  value={newConsult.diagnosis}
                  onChangeText={(t) => setNewConsult({ ...newConsult, diagnosis: t })}
                />

                <Text style={styles.inputLabel}>Ý kiến thống nhất & Hướng điều trị tiếp theo *</Text>
                <TextInput
                  style={[styles.modalInput, { height: 75 }]}
                  multiline
                  placeholder="Kết luận phác đồ điều trị, phẫu thuật, chuyển tuyến..."
                  placeholderTextColor="#94A3B8"
                  value={newConsult.treatmentConclusion}
                  onChangeText={(t) => setNewConsult({ ...newConsult, treatmentConclusion: t })}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn]}
                  onPress={() => setShowAddConsultModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn]}
                  onPress={handleCreateConsult}
                >
                  <Text style={styles.modalSaveBtnText}>Lưu biên bản</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Consent Modal */}
        <Modal visible={showAddConsentModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tạo Giấy Cam Đoan Phẫu Thuật</Text>
              <ScrollView style={styles.modalForm}>
                <Text style={styles.inputLabel}>Tên Phẫu thuật / Thủ thuật chỉ định *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Phẫu thuật lấy u màng não"
                  placeholderTextColor="#94A3B8"
                  value={newConsent.procedureName}
                  onChangeText={(t) => setNewConsent({ ...newConsent, procedureName: t })}
                />

                <Text style={styles.inputLabel}>Giải thích chuyên môn của Bác sĩ</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  placeholder="Lý do phẫu thuật, tiên lượng..."
                  placeholderTextColor="#94A3B8"
                  value={newConsent.doctorExplanation}
                  onChangeText={(t) => setNewConsent({ ...newConsent, doctorExplanation: t })}
                />

                <Text style={styles.inputLabel}>Các nguy cơ tai biến y khoa có thể xảy ra</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  placeholder="Mô tả cụ thể các nguy cơ rủi ro biến chứng"
                  placeholderTextColor="#94A3B8"
                  value={newConsent.risks}
                  onChangeText={(t) => setNewConsent({ ...newConsent, risks: t })}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn]}
                  onPress={() => setShowAddConsentModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn]}
                  onPress={handleCreateConsent}
                >
                  <Text style={styles.modalSaveBtnText}>Tạo Cam Kết</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  leftPane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  desktopBorder: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    maxWidth: 400,
  },
  rightPane: {
    flex: 2,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
  },
  paneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  addRecordBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addRecordBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordList: {
    flex: 1,
  },
  recordItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedItem: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#15803D',
  },
  recordMain: {
    flex: 1,
    marginRight: 8,
  },
  patientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  patientSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  diagnosisText: {
    fontSize: 12,
    color: '#475569',
  },
  recordMeta: {
    alignItems: 'flex-end',
  },
  departmentText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontSize: 14,
  },
  detailHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  detailSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#15803D',
  },
  tabLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  infoTab: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1.2,
  },
  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  actionsPanel: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  actionPanelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
  },
  actionRowBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subTabContainer: {
    flex: 1,
  },
  subTabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  addSubBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addSubBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  careSheetItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  careSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nurseText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  vitalBox: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vitalLabel: {
    fontSize: 9,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  vitalVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  careNotes: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginTop: 4,
  },
  consultItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  consultHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 8,
  },
  consultDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: 'bold',
  },
  consultText: {
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 18,
  },
  consultConclusion: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
    marginTop: 4,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
  },
  consentItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  consentProcedure: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  consentBodyText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  signaturesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  signatureBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  signedArea: {
    alignItems: 'center',
  },
  signedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  signedName: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#334155',
    marginTop: 2,
    fontWeight: 'bold',
  },
  signActionBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  signActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 550,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  modalForm: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  modalFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderSelect: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  genderBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#15803D',
  },
  genderBtnText: {
    fontSize: 13,
    color: '#64748B',
  },
  genderBtnTextActive: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  admissionTypeSelect: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  selectBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  selectBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  selectBtnText: {
    fontSize: 12,
    color: '#64748B',
  },
  selectBtnTextActive: {
    color: '#0284C7',
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#15803D',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});

export default PatientRecordsScreen;
