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
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'XN' | 'TRACKING'
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    get('/auth/me').then(r => setUser(r.user)).catch(() => { });
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
          let statusCode = 'NONE';
          let badgeColor = '#F1F5F9';
          let textColor = '#64748B';
          if (lastVital) {
            status = 'Đang theo dõi';
            statusCode = 'TRACKING';
            badgeColor = '#EFF6FF';
            textColor = '#2563EB';
          }
          if (completedOrders > 0) {
            status = 'Có kết quả XN';
            statusCode = 'XN';
            badgeColor = '#DCFCE7';
            textColor = '#15803D';
          }

          return {
            id: p.profile?.medicalId || `NS-${p._id.substring(18).toUpperCase()}`,
            dbId: p._id,
            name: p.profile?.name || p.email,
            age: calculateAge(p.profile?.dob, p.profile?.birthYear),
            gender: p.profile?.gender || 'N/A',
            phone: p.phone || 'N/A',
            diagnosis: diagnosisStr,
            lastScan: lastVital
              ? `${new Date(lastVital.recorded_at).getDate()}/${new Date(lastVital.recorded_at).getMonth() + 1}`
              : 'Chưa có',
            status,
            statusCode,
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
            patientId: patient.dbId,
            activeRoute: 'DoctorPatientList',
          }) 
        },
      ]
    );
  };

  const filtered = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeFilter === 'XN') return p.statusCode === 'XN';
    if (activeFilter === 'TRACKING') return p.statusCode === 'TRACKING';
    return true;
  });

  const totalCount = patients.length;
  const xnCount = patients.filter(p => p.statusCode === 'XN').length;
  const trackingCount = patients.filter(p => p.statusCode === 'TRACKING').length;

  return (
    <ResponsiveLayout navigation={navigation} user={user} activeRoute="DoctorPatientList">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Danh sách bệnh nhân</Text>
        </View>

        {/* Stats Summary Bar */}
        <View style={styles.statsSummaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryVal}>{totalCount}</Text>
            <Text style={styles.summaryLbl}>Tổng bệnh nhân</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: '#15803D' }]}>{xnCount}</Text>
            <Text style={styles.summaryLbl}>Có kết quả XN</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: '#2563EB' }]}>{trackingCount}</Text>
            <Text style={styles.summaryLbl}>Đang theo dõi</Text>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, chẩn đoán, mã y tế..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { key: 'ALL', label: `Tất cả (${totalCount})` },
              { key: 'XN', label: `Có kết quả XN (${xnCount})` },
              { key: 'TRACKING', label: `Đang theo dõi (${trackingCount})` },
            ].map(f => {
              const active = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📋</Text>
            <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 14 }}>Không tìm thấy bệnh nhân nào.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map(patient => (
              <View key={patient.id} style={styles.card}>
                <TouchableOpacity onPress={() => handlePatientPress(patient)} activeOpacity={0.8} style={styles.cardTop}>
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
                </TouchableOpacity>

                <View style={styles.cardBottom}>
                  <Text style={styles.diagnosisLabel}>Chẩn đoán: </Text>
                  <Text style={styles.diagnosisValue} numberOfLines={1}>{patient.diagnosis}</Text>
                  <Text style={styles.lastScan}>Lần cuối: {patient.lastScan}</Text>
                </View>

                {/* Quick Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('PatientDetail', { patientId: patient.dbId, defaultTab: 'emr', activeRoute: 'DoctorPatientList' })} 
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                  >
                    <Text style={styles.actionBtnPrimaryText}>📋 Bệnh án EMR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => navigation.navigate('ImagingHistory', { patientMedicalId: patient.id, patientName: patient.name })} 
                    style={[styles.actionBtn, styles.actionBtnSecondary]}
                  >
                    <Text style={styles.actionBtnSecondaryText}>🧠 Phim MRI/CT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default DoctorPatientListScreen;
