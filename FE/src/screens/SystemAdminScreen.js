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
import styles from './SystemAdminScreen.styles';

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

  const ragDocs = [];

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
              <Text style={styles.metricLabel}>TẢI GPU AI</Text>
              <Text style={styles.metricValue}>0.0%</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '0%' }]} />
              </View>
            </View>
            {/* Card 2 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TẢI BỘ NHỚ RAM</Text>
              <Text style={styles.metricValue}>0.0%</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '0%' }]} />
              </View>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Card 3 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ĐỘ TRỄ TRUY VẤN AI</Text>
              <Text style={styles.metricValue}>0 ms</Text>
              <Text style={styles.metricSub}>↘ Chờ truy vấn thực tế</Text>
            </View>
            {/* Card 4 */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TÁC NHÂN ĐANG CHẠY</Text>
              <Text style={styles.metricValue}>0</Text>
              <Text style={styles.metricSub}>👥 Chưa có phiên làm việc</Text>
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
            <Text style={styles.hardCasesCount}>0 ca</Text>
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
            <Text style={styles.ragVectorCount}>0 Vector</Text>
            <Text style={styles.ragVectorDesc}>
              Cấu hình các tham số suy luận cho các quy trình chẩn đoán cụ thể.
            </Text>
          </View>

          <View style={styles.documentHeaderRow}>
            <Text style={styles.docHeaderTitle}>DỮ LIỆU MỚI NẠP</Text>
            <Text style={styles.docSyncStatus}>HỆ THỐNG TRỐNG</Text>
          </View>

          <View style={styles.docList}>
            {ragDocs.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có tài liệu RAG thực tế được nạp.</Text>
              </View>
            ) : (
              ragDocs.map((doc, idx) => (
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
              ))
            )}
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

;

export default SystemAdminScreen;
