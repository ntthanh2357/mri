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
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import '../tailwind-built.css';

const EMRDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState(''); // 'newRecord', 'newCareSheet', 'newConsultation', 'newConsent'
  const [selectedRecord, setSelectedRecord] = useState(null);

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Mock data for display
  const mockRecords = [
    {
      id: 'HSBA-001',
      patientId: 'PT-8821',
      patientName: 'Nguyễn Văn An',
      age: 46,
      gender: 'Nam',
      admissionType: 'Nội trú',
      department: 'Khoa Nội Thần Kinh',
      doctorInCharge: 'Bs. CKII Lê Mạnh Minh',
      status: 'Đang điều trị',
      signStatus: 'Chưa duyệt',
      createdAt: '2026-06-15',
    },
    {
      id: 'HSBA-002',
      patientId: 'PT-9110',
      patientName: 'Trương Thị Ngọc Bích',
      age: 38,
      gender: 'Nữ',
      admissionType: 'Ngoại trú',
      department: 'Khoa Nội Tuyến Yên',
      doctorInCharge: 'PGS.TS Hoàng Thị Thanh',
      status: 'Xuất viện',
      signStatus: 'Đã ký số',
      createdAt: '2026-06-10',
      dischargeDate: '2026-06-18',
    },
  ];

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
              <View style={{ marginTop: 20, gap: 8 }}>
                <TouchableOpacity
                  style={[styles.sidebarItem, activeTab === 'records' && styles.sidebarItemActive]}
                  onPress={() => setActiveTab('records')}
                >
                  <Text style={[styles.sidebarItemText, activeTab === 'records' && styles.sidebarItemTextActive]}>
                    📋 Hồ sơ bệnh án
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sidebarItem, activeTab === 'care' && styles.sidebarItemActive]}
                  onPress={() => setActiveTab('care')}
                >
                  <Text style={[styles.sidebarItemText, activeTab === 'care' && styles.sidebarItemTextActive]}>
                    📝 Phiếu chăm sóc
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sidebarItem, activeTab === 'consult' && styles.sidebarItemActive]}
                  onPress={() => setActiveTab('consult')}
                >
                  <Text style={[styles.sidebarItemText, activeTab === 'consult' && styles.sidebarItemTextActive]}>
                    🧠 Hội chẩn
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sidebarItem, activeTab === 'consent' && styles.sidebarItemActive]}
                  onPress={() => setActiveTab('consent')}
                >
                  <Text style={[styles.sidebarItemText, activeTab === 'consent' && styles.sidebarItemTextActive]}>
                    ✍️ Giấy cam đoan
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Mobile tab bar */}
            {!isDesktop && (
              <View style={styles.mobileTabBar}>
                <TouchableOpacity
                  style={[styles.mobileTabItem, activeTab === 'records' && styles.mobileTabItemActive]}
                  onPress={() => setActiveTab('records')}
                >
                  <Text style={[styles.mobileTabText, activeTab === 'records' && styles.mobileTabTextActive]}>Hồ sơ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileTabItem, activeTab === 'care' && styles.mobileTabItemActive]}
                  onPress={() => setActiveTab('care')}
                >
                  <Text style={[styles.mobileTabText, activeTab === 'care' && styles.mobileTabTextActive]}>Chăm sóc</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileTabItem, activeTab === 'consult' && styles.mobileTabItemActive]}
                  onPress={() => setActiveTab('consult')}
                >
                  <Text style={[styles.mobileTabText, activeTab === 'consult' && styles.mobileTabTextActive]}>Hội chẩn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mobileTabItem, activeTab === 'consent' && styles.mobileTabItemActive]}
                  onPress={() => setActiveTab('consent')}
                >
                  <Text style={[styles.mobileTabText, activeTab === 'consent' && styles.mobileTabTextActive]}>Cam đoan</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContainer}>
              {/* Content based on active tab */}
              {activeTab === 'records' && (
                <RecordsTab
                  records={mockRecords}
                  searchQuery={searchQuery}
                  onSearch={setSearchQuery}
                  onNewRecord={() => {
                    setModalType('newRecord');
                    setIsModalVisible(true);
                  }}
                  onViewRecord={(record) => {
                    setSelectedRecord(record);
                    Alert.alert('Xem chi tiết', `Hồ sơ ${record.id}`);
                  }}
                />
              )}

              {activeTab === 'care' && (
                <CareTab
                  onNewCare={() => {
                    setModalType('newCareSheet');
                    setIsModalVisible(true);
                  }}
                />
              )}

              {activeTab === 'consult' && (
                <ConsultationTab
                  onNewConsult={() => {
                    setModalType('newConsultation');
                    setIsModalVisible(true);
                  }}
                />
              )}

              {activeTab === 'consent' && (
                <ConsentTab
                  onNewConsent={() => {
                    setModalType('newConsent');
                    setIsModalVisible(true);
                  }}
                />
              )}
            </ScrollView>
          </View>
        </View>

        {/* Modal */}
        <EMRModal
          isVisible={isModalVisible}
          type={modalType}
          onClose={() => setIsModalVisible(false)}
        />
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

// --- Tab Components ---

const RecordsTab = ({ records, searchQuery, onSearch, onNewRecord, onViewRecord }) => {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>📋 Hồ sơ bệnh án</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onNewRecord}>
          <Text style={styles.actionButtonText}>+ Thêm mới</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm theo tên bệnh nhân, mã hồ sơ..."
          value={searchQuery}
          onChangeText={onSearch}
        />
      </View>

      {/* Records list */}
      <View style={{ gap: 12, marginTop: 12 }}>
        {records.map((record) => (
          <RecordCard key={record.id} record={record} onPress={() => onViewRecord(record)} />
        ))}
      </View>
    </View>
  );
};

const RecordCard = ({ record, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.patientName}>{record.patientName}</Text>
          <Text style={styles.patientInfo}>
            {record.gender} • {record.age} tuổi • {record.id}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
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
};

const CareTab = ({ onNewCare }) => {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>📝 Phiếu chăm sóc</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onNewCare}>
          <Text style={styles.actionButtonText}>+ Thêm phiếu</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#64748B', marginTop: 12 }}>
        Danh sách phiếu chăm sóc sẽ hiển thị ở đây theo từng bệnh án.
      </Text>
    </View>
  );
};

const ConsultationTab = ({ onNewConsult }) => {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>🧠 Hội chẩn</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onNewConsult}>
          <Text style={styles.actionButtonText}>+ Tạo hội chẩn</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#64748B', marginTop: 12 }}>
        Danh sách biên bản hội chẩn sẽ hiển thị ở đây.
      </Text>
    </View>
  );
};

const ConsentTab = ({ onNewConsent }) => {
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>✍️ Giấy cam đoan</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onNewConsent}>
          <Text style={styles.actionButtonText}>+ Tạo giấy cam đoan</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#64748B', marginTop: 12 }}>
        Danh sách giấy cam đoan phẫu thuật sẽ hiển thị ở đây.
      </Text>
    </View>
  );
};

// --- Badges ---

const StatusBadge = ({ status }) => {
  let color, bg;
  if (status === 'Đang điều trị') {
    bg = '#EFF6FF';
    color = '#1D4ED8';
  } else if (status === 'Xuất viện') {
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
  if (signStatus === 'Đã ký số') {
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
    <View style={[styles.statusBadge, { backgroundColor: bg, marginTop: 4 }]}>
      <Text style={[styles.statusBadgeText, { color, fontSize: 10 }]}>{signStatus}</Text>
    </View>
  );
};

// --- Modal Component ---

const EMRModal = ({ isVisible, type, onClose }) => {
  const isWeb = Platform.OS === 'web';
  const ModalComponent = isWeb ? View : Modal;

  const modalContent = () => {
    switch (type) {
      case 'newRecord':
        return <NewRecordForm onClose={onClose} />;
      case 'newCareSheet':
        return <NewCareSheetForm onClose={onClose} />;
      case 'newConsultation':
        return <NewConsultationForm onClose={onClose} />;
      case 'newConsent':
        return <NewConsentForm onClose={onClose} />;
      default:
        return null;
    }
  };

  return (
    <ModalComponent
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {modalContent()}
        </KeyboardAvoidingView>
      </View>
    </ModalComponent>
  );
};

// --- Form Components ---

const NewRecordForm = ({ onClose }) => {
  const handleSubmit = () => {
    Alert.alert('Thành công', 'Hồ sơ bệnh án mới đã được tạo!');
    onClose();
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Hồ sơ bệnh án mới</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 20, color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <FormField label="Mã bệnh nhân" placeholder="VD: PT-1234" />
        <FormField label="Họ tên bệnh nhân" placeholder="Nguyễn Văn A" />
        <FormField label="Tuổi" placeholder="45" keyboardType="numeric" />
        <FormField label="Giới tính" placeholder="Nam/Nữ" />
        <FormField label="Khoa khám" placeholder="Khoa Nội Thần Kinh" />
        <FormField label="Loại khám" placeholder="Nội trú/Ngoại trú" />
        <FormField label="Bác sĩ phụ trách" placeholder="Tên bác sĩ" />
        <FormField label="Chẩn đoán" placeholder="Chẩn đoán ban đầu..." multiline />
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

const NewCareSheetForm = ({ onClose }) => {
  const handleSubmit = () => {
    Alert.alert('Thành công', 'Phiếu chăm sóc đã được tạo!');
    onClose();
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Phiếu chăm sóc</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 20, color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <FormField label="Mạch (lần/phút)" placeholder="72" keyboardType="numeric" />
        <FormField label="Huyết áp (mmHg)" placeholder="120/80" />
        <FormField label="Nhiệt độ (°C)" placeholder="36.5" keyboardType="decimal-pad" />
        <FormField label="Nhịp thở (lần/phút)" placeholder="18" keyboardType="numeric" />
        <FormField label="SpO2 (%)" placeholder="98" keyboardType="numeric" />
        <FormField label="Diễn biến bệnh" placeholder="Ghi nhận diễn biến..." multiline />
        <FormField label="Hành động chăm sóc" placeholder="Các biện pháp đã thực hiện..." multiline />
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

const NewConsultationForm = ({ onClose }) => {
  const handleSubmit = () => {
    Alert.alert('Thành công', 'Biên bản hội chẩn đã được tạo!');
    onClose();
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Biên bản hội chẩn</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 20, color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <FormField label="Danh sách bác sĩ tham gia" placeholder="Ngăn cách bằng dấu phẩy" multiline />
        <FormField label="Tóm tắt lâm sàng" placeholder="Tóm tắt tình trạng bệnh..." multiline />
        <FormField label="Kết luận chẩn đoán" placeholder="Kết luận hội chẩn..." multiline />
        <FormField label="Hướng điều trị" placeholder="Phương án điều trị..." multiline />
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

const NewConsentForm = ({ onClose }) => {
  const handleSubmit = () => {
    Alert.alert('Thành công', 'Giấy cam đoan đã được tạo!');
    onClose();
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Tạo Giấy cam đoan</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 20, color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <FormField label="Tên thủ thuật/phẫu thuật" placeholder="Phẫu thuật..." />
        <FormField label="Nguy cơ có thể gặp" placeholder="Mô tả các nguy cơ..." multiline />
        <FormField label="Giải thích của bác sĩ" placeholder="Giải thích về thủ thuật..." multiline />
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

const FormField = ({ label, placeholder, keyboardType, multiline }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.textInput, multiline && { height: 100, textAlignVertical: 'top' }]}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      keyboardType={keyboardType}
      multiline={multiline}
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
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    padding: 20,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  sidebarItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sidebarItemActive: {
    backgroundColor: '#EFF6FF',
  },
  sidebarItemText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mobileTabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
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
    fontWeight: 'bold',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  actionButton: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  patientInfo: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
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
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '90%',
  },
  formContainer: {
    flex: 1,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
});

export default EMRDashboardScreen;
