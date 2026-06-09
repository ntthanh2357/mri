import React, { useState } from 'react';
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
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';

const PatientRecordsScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');

  const patients = [
    { id: 'NS-2401', name: 'Nguyễn Văn A', age: 64, gender: 'Nam', phone: '0901 234 567', diagnosis: 'U màng não', lastScan: '01/06/2026', status: 'Cấp cứu', badgeColor: '#FEE2E2', textColor: '#EF4444' },
    { id: 'NS-2400', name: 'Trần Thị B', age: 45, gender: 'Nữ', phone: '0912 345 678', diagnosis: 'Đột quỵ não', lastScan: '31/05/2026', status: 'Đang điều trị', badgeColor: '#FEF3C7', textColor: '#D97706' },
    { id: 'NS-2399', name: 'Lê Minh C', age: 52, gender: 'Nam', phone: '0923 456 789', diagnosis: 'Parkinson GĐ 2', lastScan: '30/05/2026', status: 'Ổn định', badgeColor: '#DCFCE7', textColor: '#15803D' },
    { id: 'NS-2398', name: 'Phạm Thị D', age: 38, gender: 'Nữ', phone: '0934 567 890', diagnosis: 'Đau đầu mãn tính', lastScan: '29/05/2026', status: 'Theo dõi', badgeColor: '#EFF6FF', textColor: '#2563EB' },
    { id: 'NS-2397', name: 'Hoàng Văn E', age: 71, gender: 'Nam', phone: '0945 678 901', diagnosis: 'Alzheimer nhẹ', lastScan: '28/05/2026', status: 'Ổn định', badgeColor: '#DCFCE7', textColor: '#15803D' },
  ];

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.diagnosis.toLowerCase().includes(search.toLowerCase())
  );

  const handlePatientPress = (patient) => {
    if (patient.id === 'NS-2401') {
      Alert.alert(
        'Xem bệnh án',
        `Mở hồ sơ chẩn đoán hình ảnh cho bệnh nhân ${patient.name}?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Phân tích MRI', onPress: () => navigation.navigate('AIAnalysis') },
        ]
      );
    } else {
      Alert.alert('Hồ sơ bệnh nhân', `Mã BN: ${patient.id}\nHọ tên: ${patient.name}\nChẩn đoán: ${patient.diagnosis}\nSĐT: ${patient.phone}`);
    }
  };

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="PatientRecords"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hồ sơ Bệnh nhân</Text>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Quick Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tổng số BN</Text>
            <Text style={styles.statValue}>1,284</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Đang điều trị</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>342</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Cấp cứu</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>18</Text>
          </View>
        </View>

        {/* Search & Filter bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, mã BN, chẩn đoán..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => Alert.alert('Bộ lọc', 'Sắp xếp danh sách bệnh nhân...')}>
            <Text style={styles.filterBtnText}>🎛️ Lọc</Text>
          </TouchableOpacity>
        </View>

        {/* Patient List */}
        <Text style={styles.sectionTitle}>Danh sách bệnh án ({filtered.length})</Text>
        
        <View style={styles.listContainer}>
          {filtered.map((p, index) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.patientRow, index === filtered.length - 1 && styles.lastPatientRow]}
              onPress={() => handlePatientPress(p)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{p.name.charAt(0)}</Text>
                </View>
                <View style={styles.metaInfo}>
                  <Text style={styles.patientName}>{p.name}</Text>
                  <Text style={styles.patientDetails}>
                    {p.id} • {p.age} tuổi • {p.gender}
                  </Text>
                  <Text style={styles.patientDiagnosis}>
                    Chẩn đoán: <Text style={styles.diagnosisText}>{p.diagnosis}</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.rowRight}>
                <View style={[styles.statusBadge, { backgroundColor: p.badgeColor }]}>
                  <Text style={[styles.statusText, { color: p.textColor }]}>{p.status}</Text>
                </View>
                <Text style={styles.scanDate}>Quét: {p.lastScan}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pagination helper */}
        <View style={styles.paginationContainer}>
          <Text style={styles.paginationInfo}>Hiển thị {filtered.length} / {patients.length} bệnh nhân</Text>
        </View>
      </ScrollView>
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
    color: '#64748B',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterBtn: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  filterBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastPatientRow: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1.2,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#15803D',
    fontWeight: 'bold',
    fontSize: 15,
  },
  metaInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  patientDetails: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  patientDiagnosis: {
    fontSize: 11,
    color: '#94A3B8',
  },
  diagnosisText: {
    color: '#334155',
    fontWeight: '500',
  },
  rowRight: {
    alignItems: 'flex-end',
    flex: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  scanDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  paginationContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  paginationInfo: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default PatientRecordsScreen;
