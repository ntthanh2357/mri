import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import Layout from '../constants/layout';
import { Search } from 'lucide-react';
import styles from './DoctorPatientListScreen.styles';
import Colors from '../constants/colors';
import { initialsOf } from '../utils/initials';


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
  const { width } = useWindowDimensions();
  const wide = width >= Layout.wide;

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

          let status = 'Chưa theo dõi';
          let statusCode = 'NONE';
          let badgeColor = '#F1F5F9';
          let textColor = '#64748B';
          if (lastVital) {
            status = 'Đang theo dõi';
            statusCode = 'TRACKING';
            badgeColor = '#EFF6FF';
            textColor = '#0369A1';
          }
          if (completedOrders > 0) {
            status = 'Có kết quả XN';
            statusCode = 'XN';
            badgeColor = Colors.brandGreenSoft;
            textColor = Colors.brandGreen;
          }

          const age = calculateAge(p.profile?.dob, p.profile?.birthYear);
          const recorded = lastVital ? new Date(lastVital.recorded_at) : null;
          return {
            id: p.profile?.medicalId || `NS-${p._id.substring(18).toUpperCase()}`,
            dbId: p._id,
            name: p.profile?.name || p.email,
            gender: p.profile?.gender || '',
            genderAge: [p.profile?.gender, age !== 'N/A' ? `${age} tuổi` : null].filter(Boolean).join(', '),
            phone: p.phone || '',
            labText: totalOrders > 0 ? `${completedOrders}/${totalOrders} phiếu có kết quả` : 'Chưa có phiếu',
            vitalText: recorded ? `${recorded.getDate()}/${recorded.getMonth() + 1}` : 'Chưa đo',
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

  const filtered = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeFilter === 'XN') return p.statusCode === 'XN';
    if (activeFilter === 'TRACKING') return p.statusCode === 'TRACKING';
    return true;
  });

  const totalCount = patients.length;
  const xnCount = patients.filter(p => p.statusCode === 'XN').length;
  const trackingCount = patients.filter(p => p.statusCode === 'TRACKING').length;

  const openDetail = (patient) => navigation.navigate('PatientDetail', { patientId: patient.dbId, activeRoute: 'DoctorPatientList' });
  const openFilms = (patient) => navigation.navigate('ImagingHistory', { patientMedicalId: patient.id, patientName: patient.name });
  const newFilm = (patient) => navigation.navigate('CreateImagingResult', { patientInfo: { id: patient.id, name: patient.name, gender: patient.gender } });

  return (
    <ResponsiveLayout navigation={navigation} user={user} activeRoute="DoctorPatientList">
      <SafeAreaView style={styles.container}>
        <PageHeader
          bar
          title="Bệnh nhân"
          subtitle="Tình trạng xét nghiệm và sinh hiệu gần nhất của từng bệnh nhân."
          actions={<HeaderAction icon="refresh-cw" label="Làm mới" onPress={fetchPatients} />}
          below={
            <PageTabs
              tabs={[
                { key: 'ALL', label: 'Tất cả', count: totalCount },
                { key: 'XN', label: 'Có kết quả XN', count: xnCount },
                { key: 'TRACKING', label: 'Đang theo dõi', count: trackingCount },
              ]}
              value={activeFilter}
              onChange={setActiveFilter}
            />
          }
        />

        <ScrollView>
          <PageContainer style={styles.page}>
            <View style={styles.searchContainer}>
              <Search size={16} color={Colors.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo tên hoặc mã y tế…"
                placeholderTextColor={Colors.secondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color={Colors.brandGreen} />
                <Text style={styles.stateText}>Đang tải danh sách bệnh nhân…</Text>
              </View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateError}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchPatients} accessibilityRole="button">
                  <Text style={styles.retryBtnText}>Tải lại</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Không tìm thấy bệnh nhân nào</Text>
                <Text style={styles.stateText}>{search ? 'Thử tìm bằng tên khác hoặc mã y tế.' : 'Chưa có bệnh nhân trong nhóm này.'}</Text>
              </View>
            ) : wide ? (
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  <Text style={[styles.th, styles.cName]}>Bệnh nhân</Text>
                  <Text style={[styles.th, styles.cInfo]}>Giới tính, tuổi</Text>
                  <Text style={[styles.th, styles.cPhone]}>Điện thoại</Text>
                  <Text style={[styles.th, styles.cLab]}>Xét nghiệm</Text>
                  <Text style={[styles.th, styles.cVital]}>Sinh hiệu gần nhất</Text>
                  <Text style={[styles.th, styles.cStatus]}>Tình trạng</Text>
                  <Text style={[styles.th, styles.cActions, styles.thRight]}>Thao tác</Text>
                </View>
                {filtered.map(patient => (
                  <Pressable
                    key={patient.id}
                    onPress={() => openDetail(patient)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mở hồ sơ ${patient.name}`}
                    style={({ hovered }) => [styles.tr, styles.trBody, hovered && styles.trHover]}
                  >
                    <View style={[styles.cName, styles.nameCell]}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(patient.name)}</Text></View>
                      <View style={styles.grow}>
                        <Text style={styles.patientName} numberOfLines={2}>{patient.name}</Text>
                        <Text style={styles.cellSub}>{patient.id}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cellText, styles.cInfo]}>{patient.genderAge || '—'}</Text>
                    <Text style={[styles.cellNum, styles.cPhone]}>{patient.phone || '—'}</Text>
                    <Text style={[styles.cellText, styles.cLab]}>{patient.labText}</Text>
                    <Text style={[styles.cellNum, styles.cVital]}>{patient.vitalText}</Text>
                    <View style={styles.cStatus}>
                      <View style={[styles.statusBadge, { backgroundColor: patient.badgeColor }]}>
                        <Text style={[styles.statusText, { color: patient.textColor }]}>{patient.status}</Text>
                      </View>
                    </View>
                    <View style={[styles.cActions, styles.rowActions]}>
                      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => openFilms(patient)} accessibilityRole="button">
                        <Text style={styles.btnSecondaryText}>Phim MRI/CT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => newFilm(patient)} accessibilityRole="button">
                        <Text style={styles.btnGhostText}>Nhập phim</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.list}>
                {filtered.map(patient => (
                  <View key={patient.id} style={styles.card}>
                    <Pressable onPress={() => openDetail(patient)} accessibilityRole="button" style={styles.cardTop}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(patient.name)}</Text></View>
                      <View style={styles.grow}>
                        <Text style={styles.patientName}>{patient.name}</Text>
                        <Text style={styles.cellSub}>{[patient.id, patient.genderAge].filter(Boolean).join(', ')}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: patient.badgeColor }]}>
                        <Text style={[styles.statusText, { color: patient.textColor }]}>{patient.status}</Text>
                      </View>
                    </Pressable>
                    <Text style={styles.cardMeta}>Xét nghiệm: {patient.labText}. Sinh hiệu: {patient.vitalText}.</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => openDetail(patient)} accessibilityRole="button">
                        <Text style={styles.btnPrimaryText}>Mở hồ sơ</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => openFilms(patient)} accessibilityRole="button">
                        <Text style={styles.btnSecondaryText}>Phim MRI/CT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => newFilm(patient)} accessibilityRole="button">
                        <Text style={styles.btnGhostText}>Nhập phim</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </PageContainer>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default DoctorPatientListScreen;
