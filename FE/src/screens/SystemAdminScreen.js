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

const SystemAdminScreen = ({ navigation }) => {
  const [ocrTemp1, setOcrTemp1] = useState(0.1);
  const [ocrTemp2, setOcrTemp2] = useState(0.95);
  const [transTemp, setTransTemp] = useState(0.7);
  const [transToken, setTransToken] = useState(2); // in k (2k)
  const [ragDepth, setRagDepth] = useState(5);

  const handleGlobalUpdate = () => {
    Alert.alert('Triển khai', 'Đang cập nhật cấu hình mạng neuron toàn hệ thống. Quá trình đồng bộ mất khoảng 15 giây...');
  };

  const handleAddDocument = () => {
    Alert.alert('Thêm tài liệu RAG', 'Vui lòng tải lên tệp văn bản y học (.pdf, .xlsx) để tiến hành vector hóa...');
  };

  const ragDocs = [
    { name: 'Neurology_Standard.pdf', size: '2.4 MB', vectors: 420, isSuccess: true },
    { name: 'Clinical_Guideline.pdf', size: '15.8 MB', vectors: 1200, isSuccess: true },
    { name: 'Patient_Feedback.xlsx', size: '1.2 MB', vectors: 85, isSuccess: false },
  ];

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="SystemAdmin"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hệ thống Quản trị</Text>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Sync Status Banner */}
        <View style={styles.syncBanner}>
          <View style={styles.syncLeft}>
            <View style={styles.syncIndicator} />
            <Text style={styles.syncStatusText}>TRẠNG THÁI HỆ THỐNG: TỐI ƯU</Text>
          </View>
          <Text style={styles.syncTime}>Đồng bộ: 2 phút trước</Text>
        </View>

        {/* Dashboard Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Quản lý Hạ tầng AI & RAG</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricRow}>
            {/* Card 1 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HÀNG ĐỢI: 128 MỤC</Text>
              <Text style={styles.metricValue}>41.0%</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '41%' }]} />
              </View>
            </View>
            {/* Card 2 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HÀNG ĐỢI: 128 MỤC</Text>
              <Text style={styles.metricValue}>88.2%</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '88%' }]} />
              </View>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Card 3 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HÀNG ĐỢI: 128 MỤC</Text>
              <Text style={styles.metricValue}>124 ms</Text>
              <Text style={styles.metricSub}>↘ Phản hồi nhanh</Text>
            </View>
            {/* Card 4 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HÀNG ĐỢI: 128 MỤC</Text>
              <Text style={styles.metricValue}>1,042</Text>
              <Text style={styles.metricSub}>👥 +39 Đang hoạt động</Text>
            </View>
          </View>
        </View>

        {/* AI Neural Agents Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hồ sơ Neural của Tác nhân AI</Text>
          <TouchableOpacity style={styles.updateBtn} onPress={handleGlobalUpdate}>
            <Text style={styles.updateBtnText}>Triển khai Toàn cầu</Text>
          </TouchableOpacity>
        </View>

        {/* OCR Transformer Card */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <Text style={styles.agentEmoji}>📄</Text>
              <Text style={styles.agentName}>OCR Transformer</Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>HOẠT ĐỘNG</Text>
            </View>
          </View>
          <Text style={styles.agentDesc}>
            Trích xuất văn bản lâm sàng từ biểu mẫu nhập viện viết tay của bệnh nhân.
          </Text>

          {/* Slider 1 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Nhiệt độ (Độ tương phản)</Text>
              <Text style={styles.sliderValue}>{ocrTemp1.toFixed(2)}</Text>
            </View>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${ocrTemp1 * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${ocrTemp1 * 100}%` }]} />
            </View>
          </View>

          {/* Slider 2 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Nhiệt độ (Tốc độ quét)</Text>
              <Text style={styles.sliderValue}>{ocrTemp2.toFixed(2)}</Text>
            </View>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${ocrTemp2 * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${ocrTemp2 * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Neural Translator Card */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <Text style={styles.agentEmoji}>💬</Text>
              <Text style={styles.agentName}>Thông dịch viên Thần kinh</Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.agentDesc}>
            Chuyển đổi các phát hiện MRI kỹ thuật thành tóm tắt dễ hiểu cho bệnh nhân.
          </Text>

          {/* Slider 3 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Nhiệt độ (Sáng tạo)</Text>
              <Text style={styles.sliderValue}>{transTemp.toFixed(2)}</Text>
            </View>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${transTemp * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${transTemp * 100}%` }]} />
            </View>
          </View>

          {/* Slider 4 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Giới hạn Token (Độ dài tóm tắt)</Text>
              <Text style={styles.sliderValue}>{transToken}k</Text>
            </View>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${(transToken / 4) * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${(transToken / 4) * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* View More Link */}
        <TouchableOpacity style={styles.viewMoreLink} onPress={() => Alert.alert('Thông tin', 'Các tác nhân bổ sung: MRI Classifier, Segmentation Bot, Report Validator.')}>
          <Text style={styles.viewMoreText}>Xem thêm 3 tác nhân khác ▼</Text>
        </TouchableOpacity>

        {/* Hard cases training card */}
        <View style={styles.hardCasesCard}>
          <View style={styles.hardCasesLeft}>
            <Text style={styles.hardCasesTitle}>Đánh giá khai thác trường hợp khó</Text>
            <Text style={styles.hardCasesDesc}>Các ca biên được bác sĩ chỉnh sửa đang chờ huấn luyện lại model.</Text>
          </View>
          <View style={styles.hardCasesRight}>
            <Text style={styles.hardCasesCount}>128 ca</Text>
            <TouchableOpacity style={styles.deployBtnMini} onPress={handleGlobalUpdate}>
              <Text style={styles.deployBtnTextMini}>Triển khai</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RAG Knowledge Vector Database Box (Dark Themed) */}
        <View style={styles.ragContainer}>
          <View style={styles.ragHeader}>
            <View>
              <Text style={styles.ragTitle}>Công cụ RAG</Text>
              <Text style={styles.ragSubtitle}>Kho Vector Cơ sở Kiến thức</Text>
            </View>
            <TouchableOpacity style={styles.addDocBtn} onPress={handleAddDocument}>
              <Text style={styles.addDocText}>+ Thêm TL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ragStatusCard}>
            <Text style={styles.ragVectorCount}>64,281 Vector</Text>
            <Text style={styles.ragVectorDesc}>
              Cấu hình các tham số suy luận cho các quy trình chẩn đoán cụ thể.
            </Text>
          </View>

          <View style={styles.documentHeaderRow}>
            <Text style={styles.docHeaderTitle}>DỮ LIỆU MỚI NẠP</Text>
            <Text style={styles.docSyncStatus}>ĐANG ĐỒNG BỘ...</Text>
          </View>

          <View style={styles.docList}>
            {ragDocs.map((doc, idx) => (
              <View key={idx} style={styles.docRow}>
                <View style={[styles.docIcon, { backgroundColor: doc.isSuccess ? '#166534' : '#991B1B' }]}>
                  <Text style={styles.docIconText}>📁</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docMeta}>{doc.size} • {doc.vectors} Vectors</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('Tùy chọn tài liệu', 'Bạn có thể xóa hoặc nạp lại vector cho tài liệu: ' + doc.name)}>
                  <Text style={styles.moreIcon}>⋮</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Context search depth */}
          <View style={styles.sliderContainerDark}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderTextDark}>Độ sâu ngữ cảnh tìm kiếm</Text>
              <Text style={styles.sliderValueDark}>Top {ragDepth}</Text>
            </View>
            <View style={styles.sliderTrackDark}>
              <View style={[styles.sliderFillDark, { width: `${(ragDepth / 10) * 100}%` }]} />
              <View style={[styles.sliderThumbDark, { left: `${(ragDepth / 10) * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* System Prompt Box */}
        <View style={styles.promptCard}>
          <View style={styles.promptHeader}>
            <Text style={styles.promptTitle}>Lời nhắc Hệ thống (System Prompt)</Text>
            <Text style={styles.promptIcon}>⚡</Text>
          </View>
          <TextInput
            style={styles.promptInput}
            multiline
            value="Bạn là trợ lý chẩn đoán AI y tế chuyên nghiệp, hỗ trợ bác sĩ phân tích hình ảnh thần kinh và trích xuất dữ liệu bệnh án lâm sàng..."
            editable={false}
          />
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
  syncBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  syncStatusText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: 'bold',
  },
  syncTime: {
    color: '#047857',
    fontSize: 10,
  },
  titleContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  metricsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  barBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  updateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  updateBtnText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '600',
  },
  agentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentEmoji: {
    fontSize: 16,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  activeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeTagText: {
    color: '#166534',
    fontSize: 9,
    fontWeight: 'bold',
  },
  agentDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderText: {
    fontSize: 12,
    color: '#475569',
  },
  sliderValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 2,
  },
  sliderThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#15803D',
    position: 'absolute',
    transform: [{ translateX: -5 }],
  },
  viewMoreLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  viewMoreText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
  },
  hardCasesCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  hardCasesLeft: {
    flex: 1.5,
    paddingRight: 10,
  },
  hardCasesTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  hardCasesDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  hardCasesRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hardCasesCount: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  deployBtnMini: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#15803D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deployBtnTextMini: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: 'bold',
  },
  ragContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  ragHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 12,
  },
  ragTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  ragSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  addDocBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addDocText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  ragStatusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  ragVectorCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ragVectorDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  documentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  docHeaderTitle: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  docSyncStatus: {
    color: '#4ADE80',
    fontSize: 9,
    fontWeight: 'bold',
  },
  docList: {
    gap: 8,
    marginBottom: 20,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  docIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docIconText: {
    fontSize: 14,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  docMeta: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  moreIcon: {
    color: '#94A3B8',
    fontSize: 16,
    paddingHorizontal: 6,
  },
  sliderContainerDark: {
    marginTop: 8,
  },
  sliderLabelRowDark: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderTextDark: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sliderValueDark: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sliderTrackDark: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFillDark: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  sliderThumbDark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    position: 'absolute',
    transform: [{ translateX: -5 }],
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  promptIcon: {
    fontSize: 12,
  },
  promptInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlignVertical: 'top',
  },
});

export default SystemAdminScreen;
