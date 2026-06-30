import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './DoctorPatientListScreen.styles';

// [BUG-03 FIX] Tính tuổi thật từ ngày sinh hoặc năm sinh
const calculateAge = (dob, birthYear) => {
  if (dob) {
    const birth = new Date(dob);
    if (!isNaN(birth.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age > 0 ? String(age) : 'N/A';
    }
  }
  if (birthYear) {
    const age = new Date().getFullYear() - Number(birthYear);
    return age > 0 ? String(age) : 'N/A';
  }
  return 'N/A';
};

const DoctorPatientListScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    get('/auth/me').then(r => setUser(r.user)).catch(() => {});
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await get('/api/patients');
      if (res && res.success && res.data) {
        const dbList = res.data.map(p => {
          const stats = p.stats || {};
          const totalOrders = stats.total_lab_orders || 0;
          const completedOrders = stats.completed_lab_orders || 0;
          const lastVital = stats.last_vital;

          let diagnosisStr = 'U não thái dương';
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
            id: p.profile?.medicalId || `NS-${p._id.substring(18).toUpperCase()}`,
            dbId: p._id,
            name: p.profile?.name || p.email,
            age: calculateAge(p.profile?.dob, p.profile?.birthYear), // [BUG-03 FIX]
            gender: p.profile?.gender || 'Nam',
            phone: p.phone || 'N/A',
            diagnosis: diagnosisStr,
            lastScan: lastVital
              ? `${new Date(lastVital.recorded_at).getDate()}/${new Date(lastVital.recorded_at).getMonth() + 1}`
              : '10/06/2026',
            status,
            badgeColor,
            textColor,
          };
        });
        setPatients(dbList);
      } else {
        setError(res?.message || 'Không thể tải danh sách bệnh nhân.');
      }
    } catch (err) {
      console.error('Fetch patients error:', err);
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handlePatientPress = (patient) => {
    Alert.alert(
      'Tùy chọn Bệnh án',
      `Chọn tác vụ cho bệnh nhân ${patient.name}:`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xem Lịch sử Phim MRI/CT', 
          onPress: () => navigation.navigate('ImagingHistory', { 
            patientMedicalId: patient.id, 
            patientName: patient.name 
          }) 
        },
        { 
          text: 'Nhập phim MRI/CT mới', 
          onPress: () => navigation.navigate('CreateImagingResult', { 
            patientInfo: { id: patient.id, name: patient.name, gender: patient.gender } 
          }) 
        },
        { 
          text: 'Xem EMR & Xét nghiệm LIS', 
          onPress: () => navigation.navigate('PatientDetail', { 
            patientId: patient.dbId 
          }) 
        },
      ]
    );
  };

  const filtered = patients.filter(
    p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ResponsiveLayout navigation={navigation} user={user} activeRoute="DoctorPatientList">
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

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={{ marginTop: 12, color: '#64748B' }}>Đang tải danh sách bệnh nhân...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#15803D', borderRadius: 8 }} onPress={fetchPatients}>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#64748B' }}>Không tìm thấy bệnh nhân nào.</Text>
        </View>
      ) : (
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
                  <Text style={styles.patientPhone}>SĐT: {patient.phone}</Text>
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
              <TouchableOpacity 
                onPress={() => navigation.navigate('PatientDetail', { patientId: patient.dbId, defaultTab: 'lab' })} 
                style={{marginTop: 8, padding: 8, backgroundColor: '#16A34A', borderRadius: 4}}
              >
                <Text style={{color: 'white', textAlign: 'center', fontWeight: 'bold'}}>Xem hồ sơ bệnh án</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default DoctorPatientListScreen;
