import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { Search } from 'lucide-react';
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
  const { width } = useWindowDimensions();
  const columns = width >= 1200 ? 3 : width >= 760 ? 2 : 1;
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
            id: p.profile?.medicalId || `NS-${p._id.substring(18).toUpperCase()}`,
            dbId: p._id,
            name: p.profile?.name || p.email,
            age: calculateAge(p.profile?.dob, p.profile?.birthYear), // [BUG-03 FIX]
            gender: p.profile?.gender || 'N/A',
            phone: p.phone || 'N/A',
            diagnosis: diagnosisStr,
            lastScan: lastVital
              ? `${new Date(lastVital.recorded_at).getDate()}/${new Date(lastVital.recorded_at).getMonth() + 1}`
              : 'Chưa có',
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
    navigation.navigate('PatientDetail', { patientId: patient.dbId, defaultTab: 'lab' });
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
          <View>
            <Text style={styles.headerTitle}>Danh sách bệnh nhân</Text>
            <Text style={styles.headerSubtitle}>Theo dõi hồ sơ và hoạt động khám chữa bệnh</Text>
          </View>
          <View style={styles.patientCount}>
            <Text style={styles.patientCountValue}>{filtered.length}</Text>
            <Text style={styles.patientCountLabel}>bệnh nhân</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, mã bệnh nhân hoặc chẩn đoán..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#15803D" />
              <Text style={{ color: '#64748B', marginTop: 10 }}>Đang tải danh sách bệnh nhân...</Text>
            </View>
          ) : error ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#DC2626' }}>{error}</Text>
              <TouchableOpacity onPress={fetchPatients} style={styles.actionBtnPrimary}>
                <Text style={styles.actionBtnPrimaryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#64748B' }}>Không tìm thấy bệnh nhân nào.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              <View style={styles.grid}>
                {filtered.map(patient => (
                  <View
                    key={patient.id}
                    style={[
                      styles.card,
                      styles.gridCard,
                      columns === 3 ? styles.threeColumnCard : columns === 2 ? styles.twoColumnCard : styles.oneColumnCard,
                    ]}
                  >
                    <TouchableOpacity onPress={() => handlePatientPress(patient)} activeOpacity={0.85} style={styles.thumbnail}>
                      <View style={styles.thumbnailTop}>
                        <Text style={styles.thumbnailLabel}>HỒ SƠ BỆNH ÁN</Text>
                        <View style={[styles.statusBadge, { backgroundColor: patient.badgeColor }]}>
                          <Text style={[styles.statusText, { color: patient.textColor }]}>{patient.status}</Text>
                        </View>
                      </View>
                      <View style={styles.thumbnailAvatar}>
                        <Text style={styles.thumbnailAvatarText}>{patient.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.thumbnailId}>{patient.id}</Text>
                    </TouchableOpacity>
                    <View style={styles.cardContent}>
                      <View style={styles.cardTitleRow}>
                        <TouchableOpacity onPress={() => handlePatientPress(patient)} style={styles.titleHit}>
                          <Text style={styles.patientName} numberOfLines={2}>{patient.name}</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.patientMeta} numberOfLines={1}>
                        {patient.gender} · {patient.age} tuổi · {patient.phone}
                      </Text>
                      <View style={styles.detailsBlock}>
                        <Text style={styles.infoLabel}>HOẠT ĐỘNG GẦN ĐÂY</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>{patient.diagnosis}</Text>
                      </View>
                      <View style={styles.cardFooter}>
                        <Text style={styles.lastScan}>Cập nhật {patient.lastScan}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('PatientDetail', { patientId: patient.dbId, defaultTab: 'lab' })}
                        style={styles.recordButton}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.recordButtonText}>Xem hồ sơ bệnh án</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default DoctorPatientListScreen;
