import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { get } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';

const ImagingHistoryScreen = ({ route, navigation }) => {
  const { patientMedicalId, patientName } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = patientMedicalId 
        ? `/api/v1/imaging/patient/${patientMedicalId}`
        : '/api/v1/imaging/my-results';

      const response = await get(endpoint);
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.message || 'Không thể tải lịch sử chẩn đoán hình ảnh.');
      }
    } catch (err) {
      console.error('Fetch imaging history error:', err);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientMedicalId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }) => {
    const isMRI = item.imagingType === 'MRI';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ImagingResult', { resultId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isMRI ? styles.mriBadge : styles.ctBadge]}>
            <Text style={[styles.badgeText, isMRI ? styles.mriBadgeText : styles.ctBadgeText]}>
              {item.imagingType}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.reportDate)}</Text>
        </View>

        <Text style={styles.procedureTitle}>{item.procedure}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bác sĩ chuyên khoa:</Text>
          <Text style={styles.infoValue}>{item.radiologist}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Chẩn đoán lâm sàng:</Text>
          <Text style={styles.infoValue}>{item.diagnosis || 'Chưa cập nhật'}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.conclusionLabel}>Kết luận:</Text>
        <Text style={styles.conclusionText} numberOfLines={2}>
          {item.conclusion}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.footerLink}>Xem chi tiết bệnh án & phim →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            {patientMedicalId && (
              <TouchableOpacity style={styles.backArrowBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backArrowText}>←</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              {patientName ? `Lịch sử phim: ${patientName}` : 'Lịch sử Chẩn đoán Hình ảnh'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchHistory}>
            <Text style={styles.refreshBtnText}>🔄 Làm mới</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#15803D" />
            <Text style={styles.loadingText}>Đang tải lịch sử phim chụp...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>Chưa có kết quả chẩn đoán hình ảnh nào được lưu trữ cho bệnh án này.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContainer,
              isDesktop && styles.listContainerDesktop
            ]}
          />
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backArrowBtn: {
    marginRight: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  backArrowText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 13,
    color: '#64748B',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#15803D',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  listContainer: {
    padding: 20,
  },
  listContainerDesktop: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  mriBadge: {
    backgroundColor: '#EEF2FF',
  },
  ctBadge: {
    backgroundColor: '#FFF7ED',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  mriBadgeText: {
    color: '#4F46E5',
  },
  ctBadgeText: {
    color: '#EA580C',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  procedureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 150,
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  conclusionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  conclusionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  cardFooter: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
});

export default ImagingHistoryScreen;
