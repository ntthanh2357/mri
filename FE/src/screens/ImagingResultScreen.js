import React, { useState, useEffect } from 'react';
import {
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
import styles from './ImagingResultScreen.styles';

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

export default ImagingResultScreen;
