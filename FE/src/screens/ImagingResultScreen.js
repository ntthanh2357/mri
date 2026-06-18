import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { get } from '../services/api.service';
import Config from '../constants/config';
import ResponsiveLayout from '../components/ResponsiveLayout';

const ImagingResultScreen = ({ route, navigation }) => {
  const { resultId } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);

  useEffect(() => {
    if (!resultId) {
      setError('Không tìm thấy thông tin kết quả.');
      setLoading(false);
      return;
    }

    const fetchResultDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await get(`/api/v1/imaging/${resultId}`);
        if (response.success) {
          setResult(response.data);
        } else {
          setError(response.message || 'Không thể tải chi tiết kết quả.');
        }
      } catch (err) {
        console.error('Fetch result details error:', err);
        setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchResultDetails();
  }, [resultId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `${Config.API_URL}${imagePath}`;
  };

  if (loading) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.loadingText}>Đang tải chi tiết kết quả chẩn đoán...</Text>
        </View>
      </ResponsiveLayout>
    );
  }

  if (error || !result) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'Không tìm thấy kết quả.'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveLayout>
    );
  }

  const isMRI = result.imagingType === 'MRI';

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backArrowBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrowText}>← Quay lại lịch sử</Text>
          </TouchableOpacity>
          <View style={[styles.badge, isMRI ? styles.mriBadge : styles.ctBadge]}>
            <Text style={[styles.badgeText, isMRI ? styles.mriBadgeText : styles.ctBadgeText]}>
              PHIM {result.imagingType}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
          
          {/* Medical Record Paper Sheet */}
          <View style={styles.reportSheet}>
            {/* Header Hospital */}
            <View style={styles.hospitalHeader}>
              <View style={styles.hospitalInfo}>
                <Text style={styles.deptText}>SỞ Y TẾ ĐÀ NẴNG</Text>
                <Text style={styles.hospitalName}>BỆNH VIỆN ĐA KHOA ĐÀ NẴNG</Text>
              </View>
              <View style={styles.recordMeta}>
                <Text style={styles.metaLabelText}>Mã y tế: <Text style={styles.metaValText}>{result.medicalId}</Text></Text>
                <Text style={styles.metaLabelText}>Số bệnh án: <Text style={styles.metaValText}>{result.medicalRecordNumber || 'N/A'}</Text></Text>
              </View>
            </View>

            <Text style={styles.sheetTitle}>
              KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH {result.imagingType}
            </Text>

            {/* Patient Info Grid */}
            <View style={styles.patientGrid}>
              <View style={styles.gridRow}>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Họ và tên bệnh nhân:</Text>
                  <Text style={styles.fieldValBold}>{result.patientName}</Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Năm sinh:</Text>
                  <Text style={styles.fieldVal}>{result.birthYear || 'N/A'}</Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Giới tính:</Text>
                  <Text style={styles.fieldVal}>{result.gender}</Text>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.gridCell, { flex: 3 }]}>
                  <Text style={styles.fieldLabel}>Địa chỉ:</Text>
                  <Text style={styles.fieldVal}>{result.address || 'Hòa Xuân, Cẩm Lệ, Đà Nẵng'}</Text>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Bác sĩ chỉ định:</Text>
                  <Text style={styles.fieldVal}>{result.orderingDoctor || 'N/A'}</Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Nơi chỉ định:</Text>
                  <Text style={styles.fieldVal}>{result.orderingDepartment || 'N/A'}</Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Ngày chỉ định:</Text>
                  <Text style={styles.fieldVal}>{formatDate(result.orderDate)}</Text>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.gridCell, { flex: 3 }]}>
                  <Text style={styles.fieldLabel}>Chẩn đoán lâm sàng:</Text>
                  <Text style={styles.fieldVal}>{result.diagnosis || 'U não thái dương'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            {/* Procedure & Technique */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionHeading}>CHỈ ĐỊNH DỊCH VỤ</Text>
              <Text style={styles.headingBodyBold}>{result.procedure}</Text>

              <Text style={[styles.sectionHeading, { marginTop: 16 }]}>KỸ THUẬT THỰC HIỆN</Text>
              <Text style={styles.headingBody}>{result.technique || 'Chụp cộng hưởng từ sọ não dựng hình 3D.'}</Text>
            </View>

            <View style={styles.sectionDivider} />

            {/* Tumor Image Gallery Carousel */}
            {result.images && result.images.length > 0 && (
              <View style={styles.gallerySection}>
                <Text style={styles.sectionHeading}>HÌNH ẢNH PHIM CHỤP ({result.images.length} ẢNH KHỐI U SẮC NÉT KHUYÊN DÙNG)</Text>
                
                <View style={styles.carouselContainer}>
                  <TouchableOpacity 
                    style={styles.mainImageWrapper}
                    onPress={() => setZoomVisible(true)}
                  >
                    <Image
                      source={{ uri: getImageUrl(result.images[activeImageIndex]) }}
                      style={styles.mainImage}
                      resizeMode="contain"
                    />
                    <View style={styles.zoomOverlayIcon}>
                      <Text style={styles.zoomOverlayText}>🔍 Nhấp để phóng to</Text>
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.imageCounter}>
                    Hình ảnh {activeImageIndex + 1} / {result.images.length}
                  </Text>

                  {/* Thumbnail Selector */}
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbnailList}
                  >
                    {result.images.map((img, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.thumbnailWrapper,
                          activeImageIndex === idx && styles.activeThumbnailWrapper
                        ]}
                        onPress={() => setActiveImageIndex(idx)}
                      >
                        <Image
                          source={{ uri: getImageUrl(img) }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            <View style={styles.sectionDivider} />

            {/* Findings & Conclusion */}
            <View style={styles.findingsSection}>
              <Text style={styles.sectionHeading}>MÔ TẢ HÌNH ẢNH Y KHOA</Text>
              <Text style={styles.findingsBody}>{result.findings}</Text>

              <View style={styles.conclusionBox}>
                <Text style={styles.conclusionHeading}>KẾT LUẬN CHẨN ĐOÁN</Text>
                <Text style={styles.conclusionBody}>{result.conclusion}</Text>
              </View>
            </View>

            {/* Doctor Signature */}
            <View style={styles.signatureSection}>
              <Text style={styles.signDate}>Đà Nẵng, {formatDate(result.reportDate)}</Text>
              <Text style={styles.signTitle}>BÁC SĨ CHUYÊN KHOA CĐHA</Text>
              
              {/* Digitally Signed Stamp */}
              <View style={styles.stampBox}>
                <Text style={styles.stampText}>✓ ĐÃ KÝ SỐ</Text>
                <Text style={styles.stampDoctor}>{result.radiologist}</Text>
                <Text style={styles.stampTime}>Thời gian ký: {formatDate(result.reportDate)}</Text>
              </View>

              <Text style={styles.signDoctorName}>{result.radiologist}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Zoom Image Modal */}
        {result.images && result.images.length > 0 && (
          <Modal
            visible={zoomVisible}
            transparent={true}
            onRequestClose={() => setZoomVisible(false)}
          >
            <SafeAreaView style={styles.modalContainer}>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setZoomVisible(false)}>
                <Text style={styles.closeModalBtnText}>✕ ĐÓNG</Text>
              </TouchableOpacity>
              <View style={styles.modalImageWrapper}>
                <Image
                  source={{ uri: getImageUrl(result.images[activeImageIndex]) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.modalCounter}>
                Ảnh {activeImageIndex + 1} trên {result.images.length} - Khối u não sắc nét
              </Text>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
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
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#15803D',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backArrowBtn: {
    paddingVertical: 4,
  },
  backArrowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
  },
  badge: {
    paddingHorizontal: 10,
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
    fontSize: 11,
    fontWeight: 'bold',
  },
  mriBadgeText: {
    color: '#4F46E5',
  },
  ctBadgeText: {
    color: '#EA580C',
  },
  scrollContainer: {
    padding: 16,
  },
  scrollContainerDesktop: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  reportSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hospitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  hospitalInfo: {
    flex: 1,
    minWidth: 240,
  },
  deptText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  hospitalName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  recordMeta: {
    alignItems: 'flex-end',
  },
  metaLabelText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  metaValText: {
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
    marginVertical: 20,
    letterSpacing: 0.5,
  },
  patientGrid: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  gridCell: {
    flex: 1,
    minWidth: 120,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldVal: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  fieldValBold: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  detailSection: {
    paddingVertical: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  headingBodyBold: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 22,
  },
  headingBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  gallerySection: {
    paddingVertical: 4,
  },
  carouselContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  mainImageWrapper: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  zoomOverlayIcon: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  zoomOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  imageCounter: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },
  thumbnailList: {
    paddingVertical: 12,
    gap: 8,
  },
  thumbnailWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnailWrapper: {
    borderColor: '#15803D',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  findingsSection: {
    paddingVertical: 4,
  },
  findingsBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    textAlign: 'justify',
  },
  conclusionBox: {
    marginTop: 20,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#15803D',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  conclusionHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  conclusionBody: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 22,
  },
  signatureSection: {
    alignItems: 'flex-end',
    marginTop: 30,
    paddingRight: 12,
  },
  signDate: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  signTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 10,
  },
  stampBox: {
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 4,
    padding: 8,
    backgroundColor: 'rgba(254, 226, 226, 0.4)',
    alignItems: 'center',
    marginBottom: 10,
    transform: [{ rotate: '-2deg' }],
  },
  stampText: {
    color: '#DC2626',
    fontWeight: '900',
    fontSize: 13,
  },
  stampDoctor: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  stampTime: {
    color: '#991B1B',
    fontSize: 9,
    marginTop: 2,
  },
  signDoctorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalImageWrapper: {
    width: '90%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalCounter: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 20,
    fontWeight: '500',
  },
});

export default ImagingResultScreen;
