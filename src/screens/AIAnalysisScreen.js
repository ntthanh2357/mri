import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';

const AIAnalysisScreen = ({ navigation }) => {
  const [slice, setSlice] = useState(42);
  const [activeTool, setActiveTool] = useState('hand'); // 'hand', 'zoom', 'expand', 'contrast'
  const totalSlices = 128;

  const handleCreatePdf = () => {
    Alert.alert('Thành công', 'Báo cáo chẩn đoán PDF đã được tạo và lưu vào thư mục bệnh án!');
  };

  const handleRequestReview = () => {
    Alert.alert('Yêu cầu gửi đi', 'Yêu cầu kiểm tra chéo đã được gửi đến Hội đồng chuyên môn.');
  };

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="AIAnalysis"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Phân tích AI</Text>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Breadcrumbs */}
        <View style={styles.breadcrumbRow}>
          <Text style={styles.breadcrumbText}>BỆNH NHÂN  ❯  Mã BN: NS-9942  ❯  MRI_BRAIN_AXIAL_04.DICOM</Text>
        </View>

        <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
          {/* Left Column (flex: 5) - DICOM Viewer */}
          <View style={isDesktop ? styles.viewerColumn : styles.fullWidth}>
            {/* DICOM Brain Viewer Box */}
            <View style={[styles.viewerContainer, isDesktop && styles.viewerContainerDesktop]}>
              {/* Metadata Overlay */}
              <View style={styles.metadataOverlay}>
                <Text style={styles.metaText}>THIẾT BỊ: SIEMENS MAGNETOM SOMATOM</Text>
                <Text style={styles.metaText}>TR: 2500ms | TE: 85ms</Text>
                <Text style={styles.metaText}>ĐỘ PHÂN GIẢI: 512×512px</Text>
                <Text style={styles.metaText}>CỬA SỔ: W:80 L:40</Text>
              </View>

              {/* Left Vertical Toolbar */}
              <View style={styles.toolbarOverlay}>
                <TouchableOpacity
                  style={[styles.toolButton, activeTool === 'hand' && styles.activeToolButton]}
                  onPress={() => setActiveTool('hand')}
                >
                  <Text style={[styles.toolIcon, activeTool === 'hand' && styles.activeToolIcon]}>✋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolButton, activeTool === 'zoom' && styles.activeToolButton]}
                  onPress={() => setActiveTool('zoom')}
                >
                  <Text style={[styles.toolIcon, activeTool === 'zoom' && styles.activeToolIcon]}>🔍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolButton, activeTool === 'expand' && styles.activeToolButton]}
                  onPress={() => setActiveTool('expand')}
                >
                  <Text style={[styles.toolIcon, activeTool === 'expand' && styles.activeToolIcon]}>⛶</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolButton, activeTool === 'contrast' && styles.activeToolButton]}
                  onPress={() => setActiveTool('contrast')}
                >
                  <Text style={[styles.toolIcon, activeTool === 'contrast' && styles.activeToolIcon]}>☀️</Text>
                </TouchableOpacity>
              </View>

              {/* Brain Scan Image Content */}
              <View style={styles.imageWrapper}>
                <Image
                  source={require('../../assets/nero3.png')}
                  style={styles.brainImage}
                  resizeMode="contain"
                />
                {/* AI Bounding Box Detector Overlay */}
                <View style={styles.boundingBox}>
                  <View style={styles.boxTag}>
                    <Text style={styles.boxTagText}>AI_DETECT: 0.982</Text>
                  </View>
                </View>
              </View>

              {/* Slice Selector Controls */}
              <View style={styles.navigatorRow}>
                <TouchableOpacity
                  style={styles.arrowButton}
                  onPress={() => setSlice(s => Math.max(1, s - 1))}
                >
                  <Text style={styles.arrowText}>◀</Text>
                </TouchableOpacity>
                
                {/* Custom Interactive Slider simulation */}
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${(slice / totalSlices) * 100}%` }]} />
                  <View style={[styles.sliderThumb, { left: `${(slice / totalSlices) * 100}%` }]} />
                </View>

                <TouchableOpacity
                  style={styles.arrowButton}
                  onPress={() => setSlice(s => Math.min(totalSlices, s + 1))}
                >
                  <Text style={styles.arrowText}>▶</Text>
                </TouchableOpacity>
                
                <Text style={styles.sliceCounterText}>LỚP CẮT {slice}/{totalSlices}</Text>
              </View>
            </View>
          </View>

          {/* Right Column (flex: 3) - Patient Info & AI Analysis Details */}
          <View style={isDesktop ? styles.infoColumn : styles.fullWidth}>
            {/* Patient Profile Details */}
            <View style={styles.card}>
              <View style={styles.patientHeader}>
                <Image
                  source={require('../../assets/nero4.png')}
                  style={styles.avatarImage}
                />
                <View style={styles.patientInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.patientName}>Nguyễn Văn A</Text>
                    <View style={styles.dangerBadge}>
                      <Text style={styles.dangerBadgeText}>CẤP CỨU</Text>
                    </View>
                  </View>
                  <Text style={styles.patientCode}>Mã BN: NS-9942 • 64 tuổi</Text>
                </View>
              </View>

              <View style={styles.indicationsGrid}>
                <View style={styles.indicationColumn}>
                  <Text style={styles.indicationLabel}>TIỀN SỬ</Text>
                  <Text style={styles.indicationValue}>Huyết áp cao, Đái tháo đường</Text>
                </View>
                <View style={styles.indicationColumn}>
                  <Text style={styles.indicationLabel}>CHỈ ĐỊNH</Text>
                  <Text style={styles.indicationValue}>Đau đầu dữ dội, nôn mửa</Text>
                </View>
              </View>
            </View>

            {/* AI Analysis Prediction Details */}
            <View style={styles.card}>
              <View style={styles.analysisHeader}>
                <Text style={styles.analysisTitle}>Kết quả Phân tích AI</Text>
                <View style={styles.modelBadge}>
                  <Text style={styles.modelBadgeText}>MODEL v4.2</Text>
                </View>
              </View>

              {/* Confidence Slider bar */}
              <View style={styles.confidenceContainer}>
                <View style={styles.confidenceLabelRow}>
                  <Text style={styles.confidenceText}>Độ tự tin</Text>
                  <Text style={styles.confidenceValue}>98%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={styles.progressBarFill} />
                </View>
              </View>

              {/* Prediction Result Block */}
              <View style={styles.predictionBox}>
                <Text style={styles.predictionHeader}>DỰ ĐOÁN</Text>
                <Text style={styles.predictionTitle}>U màng não</Text>
                <Text style={styles.predictionDesc}>
                  Khối u nằm ở vùng thùy trán trái, kích thước xấp xỉ 12×15mm. Đề xuất chụp CT cản quang để xác định tưới máu.
                </Text>
              </View>

              {/* Technical Specifications */}
              <Text style={styles.specsTitle}>CHI TIẾT KỸ THUẬT</Text>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Tọa độ khối (XYZ)</Text>
                <Text style={styles.specValue}>124, 45, 88</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Thể tích ước tính</Text>
                <Text style={styles.specValue}>2.4 cm³</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Phân loại WHO</Text>
                <Text style={styles.specValue}>Độ I (Dự kiến)</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePdf}>
                <Text style={styles.primaryButtonText}>Tạo báo cáo PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRequestReview}>
                <Text style={styles.secondaryButtonText}>Yêu cầu bác sĩ xem xét</Text>
              </TouchableOpacity>
            </View>

            {/* Caution warnings */}
            <View style={styles.warningContainer}>
              <Text style={styles.warningEmoji}>⚠️</Text>
              <Text style={styles.warningText}>
                Kết quả AI chỉ mang tính hỗ trợ. Cần được xác nhận bởi bác sĩ chuyên khoa trước khi đưa ra chẩn đoán lâm sàng cuối cùng.
              </Text>
            </View>
          </View>
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
  breadcrumbRow: {
    marginBottom: 12,
  },
  breadcrumbText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  viewerContainer: {
    height: 380,
    backgroundColor: '#090D16',
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metadataOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },
  metaText: {
    color: '#4ADE80',
    fontSize: 9,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  toolbarOverlay: {
    position: 'absolute',
    left: 12,
    top: '30%',
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  toolButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeToolButton: {
    backgroundColor: '#FFFFFF',
  },
  toolIcon: {
    fontSize: 16,
    color: '#94A3B8',
  },
  activeToolIcon: {
    color: '#0F172A',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brainImage: {
    width: '80%',
    height: '80%',
    opacity: 0.9,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4ADE80',
    width: '42%',
    height: '35%',
    top: '30%',
    left: '29%',
  },
  boxTag: {
    position: 'absolute',
    top: -18,
    left: -2,
    backgroundColor: '#15803D',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  navigatorRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  arrowButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginHorizontal: 12,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  sliderThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    position: 'absolute',
    transform: [{ translateX: -6 }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sliceCounterText: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 10,
    minWidth: 90,
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  patientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  dangerBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dangerBadgeText: {
    fontSize: 9,
    color: '#EF4444',
    fontWeight: '850',
    letterSpacing: 0.5,
  },
  patientCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  indicationsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 16,
  },
  indicationColumn: {
    flex: 1,
  },
  indicationLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 4,
  },
  indicationValue: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modelBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modelBadgeText: {
    fontSize: 9,
    color: '#2563EB',
    fontWeight: '600',
  },
  confidenceContainer: {
    marginBottom: 16,
  },
  confidenceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  confidenceText: {
    fontSize: 13,
    color: '#475569',
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    width: '98%',
    backgroundColor: '#15803D',
    borderRadius: 4,
  },
  predictionBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  predictionHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  predictionDesc: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  specsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  specValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    height: 48,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: 'bold',
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 24,
  },
  warningEmoji: {
    fontSize: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
  },
  mobileColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  viewerColumn: {
    flex: 5,
  },
  infoColumn: {
    flex: 3.2,
  },
  fullWidth: {
    width: '100%',
  },
  viewerContainerDesktop: {
    height: 520,
  },
});

export default AIAnalysisScreen;
