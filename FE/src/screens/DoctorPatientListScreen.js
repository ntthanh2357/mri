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
} from 'react-native';
import { get } from '../services/api.service';

const DoctorPatientListScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([
    { id: 'NS-2401', name: 'Nguyễn Văn A', age: 64, gender: 'Nam', phone: '0901 234 567', diagnosis: 'U màng não', lastScan: '01/06/2026', status: 'Cấp cứu', badgeColor: '#FEE2E2', textColor: '#EF4444' },
    { id: 'NS-2400', name: 'Trần Thị B', age: 45, gender: 'Nữ', phone: '0912 345 678', diagnosis: 'Đột quỵ não', lastScan: '31/05/2026', status: 'Đang điều trị', badgeColor: '#FEF3C7', textColor: '#D97706' },
    { id: 'NS-2399', name: 'Lê Minh C', age: 52, gender: 'Nam', phone: '0923 456 789', diagnosis: 'Parkinson GĐ 2', lastScan: '30/05/2026', status: 'Ổn định', badgeColor: '#DCFCE7', textColor: '#15803D' },
    { id: 'NS-2398', name: 'Phạm Thị D', age: 38, gender: 'Nữ', phone: '0934 567 890', diagnosis: 'Đau đầu mãn tính', lastScan: '29/05/2026', status: 'Theo dõi', badgeColor: '#EFF6FF', textColor: '#2563EB' },
    { id: 'NS-2397', name: 'Hoàng Văn E', age: 71, gender: 'Nam', phone: '0945 678 901', diagnosis: 'Alzheimer nhẹ', lastScan: '28/05/2026', status: 'Ổn định', badgeColor: '#DCFCE7', textColor: '#15803D' },
  ]);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await get('/api/patients');
        if (res && res.data && res.data.length > 0) {
          const dbList = res.data.map(p => {
            const stats = p.stats || {};
            const totalOrders = stats.total_lab_orders || 0;
            const completedOrders = stats.completed_lab_orders || 0;
            const lastVital = stats.last_vital;

            let diagnosisStr = 'Chưa có dữ liệu';
            if (totalOrders > 0 || lastVital) {
              const parts = [];
              if (totalOrders > 0) parts.push(`${completedOrders}/${totalOrders} phiếu XN`);
              if (lastVital) {
                const d = new Date(lastVital.recorded_at);
                parts.push(`Sinh hiệu: ${d.getDate()}/${d.getMonth() + 1}`);
              }
              diagnosisStr = parts.join(' · ');
            }

            let status = 'Chưa theo dõi';
            let badgeColor = '#F1F5F9';
            let textColor = '#94A3B8';
            if (lastVital) {
              status = 'Đang theo dõi';
              badgeColor = '#EFF6FF';
              textColor = '#2563EB';
            }
            if (completedOrders > 0) {
              status = 'Có kết quả XN';
              badgeColor = '#DCFCE7';
              textColor = '#15803D';
            }

            return {
              id: `NS-${p._id.substring(18).toUpperCase()}`,
              dbId: p._id,
              name: p.profile?.name || p.email,
              age: '—',
              gender: p.profile?.bhytNumber?.startsWith('GD') ? 'Nữ' : 'Nam',
              phone: p.phone || 'N/A',
              diagnosis: diagnosisStr,
              lastScan: lastVital
                ? `${new Date(lastVital.recorded_at).getDate()}/${new Date(lastVital.recorded_at).getMonth() + 1}`
                : '—',
              status,
              badgeColor,
              textColor,
            };
          });
          setPatients(prev => {
            const filteredPrev = prev.filter(p => !dbList.some(dbP => dbP.name === p.name));
            return [...dbList, ...filteredPrev];
          });
        }
      } catch (error) {
        console.log('Không thể tải danh sách bệnh nhân từ DB, sử dụng dữ liệu tĩnh:', error);
      }
    };
    fetchPatients();
  }, []);

  const handlePatientPress = (patient) => {
    if (patient.dbId) {
      navigation.navigate('PatientDetail', { patientId: patient.dbId });
    } else {
      Alert.alert(
        'Xem bệnh án',
        `Mở hồ sơ cho bệnh nhân ${patient.name}? (Đây là bệnh nhân demo tĩnh)`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Mở MRI AI', onPress: () => navigation.navigate('AIAnalysis') },
          {
            text: 'Mở LIS & Sinh Hiệu',
            onPress: () => {
              const livePatient = patients.find(p => p.dbId);
              if (livePatient) {
                navigation.navigate('PatientDetail', { patientId: livePatient.dbId });
              } else {
                Alert.alert('Thông báo', 'Không tìm thấy bệnh nhân thực tế từ DB.');
              }
            },
          },
        ]
      );
    }
  };

  const filtered = patients.filter(
    p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Danh sách bệnh nhân</Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên, chẩn đoán, mã NS..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map(patient => (
          <TouchableOpacity key={patient.id} style={styles.card} onPress={() => handlePatientPress(patient)} activeOpacity={0.75}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{patient.name.charAt(0)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientMeta}>{patient.id} · {patient.gender}, {patient.age} tuổi</Text>
                <Text style={styles.patientPhone}>{patient.phone}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: patient.badgeColor }]}>
                <Text style={[styles.statusText, { color: patient.textColor }]}>{patient.status}</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.diagnosisLabel}>Chẩn đoán: </Text>
              <Text style={styles.diagnosisValue} numberOfLines={1}>{patient.diagnosis}</Text>
              <Text style={styles.lastScan}>Lần cuối: {patient.lastScan}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { fontSize: 14, color: '#64748B' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, padding: 14, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  patientMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  patientPhone: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  diagnosisLabel: { fontSize: 12, color: '#94A3B8' },
  diagnosisValue: { fontSize: 12, color: '#334155', fontWeight: '500', flex: 1 },
  lastScan: { fontSize: 11, color: '#94A3B8', marginLeft: 8 },
});

export default DoctorPatientListScreen;
