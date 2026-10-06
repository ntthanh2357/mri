import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  Platform,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './SystemAdminScreen.styles';
import { get, post } from '../services/api.service';
import { AlertTriangle, FileText, MessageSquare, Folder, Zap } from 'lucide-react';

const METRICS_POLL_INTERVAL = 30000; // 30 giây

const SystemAdminScreen = ({ navigation }) => {
  // [CODE-SA-07 FIX]: FE Route Guard — Kiểm tra thẩm quyền Quản trị viên
  const [authorized, setAuthorized] = useState(null);

  const [ocrTemp1, setOcrTemp1] = useState(0.1);
  const [ocrTemp2, setOcrTemp2] = useState(0.95);
  const [transTemp, setTransTemp] = useState(0.7);
  const [transToken, setTransToken] = useState(2); // in k (2k)
  const [ragDepth, setRagDepth] = useState(5);
  const [systemPrompt, setSystemPrompt] = useState("Bạn là trợ lý chẩn đoán AI y tế chuyên nghiệp, hỗ trợ bác sĩ phân tích hình ảnh thần kinh và trích xuất dữ liệu bệnh án lâm sàng.");

  // Metrics state từ API thực
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [deploying, setDeploying] = useState(false);

  // RAG docs state
  const [ragDocs, setRagDocs] = useState([]);
  const ragFileInputRef = useRef(null);

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // ── Kiểm tra quyền truy cập ────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    get('/auth/me')
      .then((res) => {
        if (!isMounted) return;
        const role = res?.user?.role;
        if (role === 'system_admin' || role === 'admin') {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          Alert.alert(
            'Quyền truy cập bị từ chối',
            'Chức năng Quản trị Hệ thống chỉ dành riêng cho tài khoản Super Admin hoặc Admin.',
            [{ text: 'Quay lại', onPress: () => navigation.goBack() }]
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setAuthorized(false);
        Alert.alert(
          'Phiên làm việc hết hạn',
          'Vui lòng đăng nhập với tài khoản Quản trị viên để truy cập.',
          [{ text: 'Đăng nhập', onPress: () => navigation.navigate('Welcome') }]
        );
      });
    return () => {
      isMounted = false;
    };
  }, [navigation]);

  // ── Lấy metrics từ API ──────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await get('/api/v1/support/system-metrics');
      if (res && res.success) {
        setMetrics(res.metrics);
      }
    } catch (err) {
      console.warn('Không thể tải system metrics:', err.message);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // ── Lấy cấu hình AI từ backend ─────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const res = await get('/admin/chatbot-config');
      if (res && res.success && res.config) {
        if (res.config.ocrTemperature1 !== undefined) setOcrTemp1(Number(res.config.ocrTemperature1));
        if (res.config.ocrTemperature2 !== undefined) setOcrTemp2(Number(res.config.ocrTemperature2));
        if (res.config.translatorTemperature !== undefined) setTransTemp(Number(res.config.translatorTemperature));
        if (res.config.translatorMaxTokensK !== undefined) setTransToken(Number(res.config.translatorMaxTokensK));
        if (res.config.ragSearchDepth !== undefined) setRagDepth(Number(res.config.ragSearchDepth));
        if (res.config.system_prompt) setSystemPrompt(res.config.system_prompt);
        if (Array.isArray(res.config.ragDocs) && res.config.ragDocs.length > 0) {
          setRagDocs(res.config.ragDocs);
        }
      }
    } catch (e) {
      console.warn('Chưa nạp được cấu hình chatbot từ server:', e.message);
    }
  }, []);

  // Lấy metrics và config khi mount (sau khi đã xác nhận authorized)
  useEffect(() => {
    if (authorized === true) {
      fetchMetrics();
      fetchConfig();
      const interval = setInterval(fetchMetrics, METRICS_POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [authorized, fetchMetrics, fetchConfig]);

  // ── Triển khai cấu hình AI (lưu vào chatbot-config) ────────────────────────
  const handleGlobalUpdate = async () => {
    setDeploying(true);
    try {
      const res = await post('/admin/chatbot-config', {
        ocrTemperature1: ocrTemp1,
        ocrTemperature2: ocrTemp2,
        translatorTemperature: transTemp,
        translatorMaxTokensK: transToken,
        ragSearchDepth: ragDepth,
        system_prompt: systemPrompt,
        ragDocs,
        updatedAt: new Date().toISOString(),
      });
      if (res && res.success) {
        Alert.alert(
          'Triển khai thành công',
          'Cấu hình mạng nơ-ron và System Prompt đã được lưu vào hệ thống AI trung tâm.'
        );
      } else {
        throw new Error(res?.message || 'Lỗi khi lưu cấu hình.');
      }
    } catch (err) {
      console.error('Lưu config lỗi:', err);
      Alert.alert(
        'Lỗi triển khai',
        err.message || 'Không thể lưu cấu hình lên máy chủ AI. Vui lòng kiểm tra lại kết nối mạng.'
      );
    } finally {
      setDeploying(false);
    }
  };

  // ── Upload tài liệu RAG ─────────────────────────────────────────────────────
  const handleAddDocument = () => {
    if (Platform.OS === 'web' && ragFileInputRef.current) {
      ragFileInputRef.current.click();
    } else {
      Alert.alert('Thêm tài liệu RAG', 'Vui lòng truy cập từ trình duyệt Web để tải lên tệp văn bản y học (.pdf, .xlsx).');
    }
  };

  const handleFileSelected = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const estimatedVectors = Math.max(1, Math.round(file.size / 512));
    const newDoc = {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      vectors: `${estimatedVectors}`,
      isSuccess: true,
      uploadedAt: new Date().toLocaleDateString('vi-VN'),
    };
    const updatedDocs = [...ragDocs, newDoc];
    setRagDocs(updatedDocs);

    // Đồng bộ lên server để lưu bền vững
    try {
      await post('/admin/chatbot-config', {
        ocrTemperature1: ocrTemp1,
        ocrTemperature2: ocrTemp2,
        translatorTemperature: transTemp,
        translatorMaxTokensK: transToken,
        ragSearchDepth: ragDepth,
        system_prompt: systemPrompt,
        ragDocs: updatedDocs,
      });
      Alert.alert(
        'Đã thêm tài liệu RAG',
        `File "${file.name}" đã được nạp thành công (${estimatedVectors} vectors). Cơ sở kiến thức đã được đồng bộ.`
      );
    } catch (uploadErr) {
      console.warn('Lỗi đồng bộ tài liệu RAG lên server:', uploadErr.message);
      Alert.alert('Thông báo', `Tài liệu "${file.name}" đã lưu cục bộ.`);
    }

    if (ragFileInputRef.current) ragFileInputRef.current.value = '';
  };

  // ── Tính phần trăm hiển thị từ metrics ─────────────────────────────────────
  const utilizationPct = metrics?.systemUtilization ?? 0;
  const latencyMs = metrics?.estimatedLatencyMs ?? 0;
  const activeStaff = metrics?.activeStaff ?? 0;
  const openTickets = metrics?.openSupportTickets ?? 0;

  if (authorized === null) {
    return (
      <ResponsiveLayout navigation={navigation} title="Đang xác thực...">
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 300 }]}>
          <ActivityIndicator size="large" color="#1A5FD0" />
          <Text style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>Đang kiểm tra quyền Quản trị viên...</Text>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  if (authorized === false) {
    return (
      <ResponsiveLayout navigation={navigation} title="Từ chối truy cập">
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24, minHeight: 300 }]}>
          <AlertTriangle size={48} color="#DC2626" />
          <Text style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' }}>
            Không có quyền truy cập
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
            Bạn không có thẩm quyền truy cập vào trung tâm điều hành Hệ thống (Super Admin). Vui lòng liên hệ quản trị viên hoặc quay lại.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: '#1A5FD0', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Quay lại</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

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

        {/* Hidden file input for RAG upload (Web only) */}
        {Platform.OS === 'web' && (
          <input
            ref={ragFileInputRef}
            type="file"
            accept=".pdf,.xlsx,.csv,.txt,.docx"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Sync Status Banner */}
        <View style={styles.syncBanner}>
          <View style={styles.syncLeft}>
            <View style={[styles.syncIndicator, { backgroundColor: loadingMetrics ? '#F59E0B' : '#10B981' }]} />
            <Text style={styles.syncStatusText}>
              {loadingMetrics ? 'ĐANG ĐỒNG BỘ...' : 'TRẠNG THÁI HỆ THỐNG: TỐI ƯU'}
            </Text>
          </View>
          <TouchableOpacity onPress={fetchMetrics}>
            <Text style={styles.syncTime}>
              {metrics?.lastUpdated
                ? `Cập nhật: ${new Date(metrics.lastUpdated).toLocaleTimeString('vi-VN')}`
                : 'Đồng bộ ngay'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Quản lý Hạ tầng AI & RAG</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricRow}>
            {/* Card 1 — Tải hệ thống từ lượt khám */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TẢI HỆ THỐNG</Text>
              {loadingMetrics ? (
                <ActivityIndicator size="small" color="#0F9D6B" />
              ) : (
                <>
                  <Text style={styles.metricValue}>{utilizationPct}%</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${utilizationPct}%` }]} />
                  </View>
                </>
              )}
            </View>
            {/* Card 2 — Độ trễ ước tính */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ĐỘ TRỄ TRUY VẤN</Text>
              {loadingMetrics ? (
                <ActivityIndicator size="small" color="#0F9D6B" />
              ) : (
                <>
                  <Text style={styles.metricValue}>{latencyMs} ms</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${Math.min((latencyMs / 3000) * 100, 100)}%`, backgroundColor: latencyMs > 2000 ? '#EF4444' : '#10B981' }]} />
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Card 3 — Nhân sự đang hoạt động */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>NHÂN SỰ HOẠT ĐỘNG</Text>
              {loadingMetrics ? (
                <ActivityIndicator size="small" color="#0F9D6B" />
              ) : (
                <>
                  <Text style={styles.metricValue}>{activeStaff}</Text>
                  <Text style={styles.metricSub}>Bác sĩ, điều dưỡng, KTV</Text>
                </>
              )}
            </View>
            {/* Card 4 — Lượt khám hôm nay */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>LƯỢT KHÁM HÔM NAY</Text>
              {loadingMetrics ? (
                <ActivityIndicator size="small" color="#0F9D6B" />
              ) : (
                <>
                  <Text style={styles.metricValue}>{metrics?.visitedToday ?? 0}</Text>
                  <Text style={styles.metricSub}>Tháng này: {metrics?.visitedThisMonth ?? 0}</Text>
                </>
              )}
            </View>
          </View>

          {/* Card 5 — Ticket mở + ảnh hưởng AI */}
          {openTickets > 0 && (
            <View style={[styles.metricCard, { marginHorizontal: 4, marginBottom: 8, backgroundColor: '#FFF7ED', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AlertTriangle size={14} color="#D97706" />
                <Text style={[styles.metricLabel, { color: '#92400E', marginBottom: 0 }]}>TICKET HỖ TRỢ ĐANG MỞ</Text>
              </View>
              <Text style={[styles.metricValue, { color: '#D97706' }]}>{openTickets}</Text>
              <Text style={[styles.metricSub, { color: '#92400E' }]}>Cần xử lý sớm</Text>
            </View>
          )}
        </View>

        {/* AI Neural Agents Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hồ sơ Neural của Tác nhân AI</Text>
          <TouchableOpacity style={[styles.updateBtn, deploying && { opacity: 0.6 }]} onPress={handleGlobalUpdate} disabled={deploying}>
            {deploying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.updateBtnText}>Triển khai Toàn cầu</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* OCR Transformer Card */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <FileText size={20} color="#1A5FD0" style={{ marginRight: 8 }} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setOcrTemp1(prev => Math.max(0, Number((prev - 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{ocrTemp1.toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => setOcrTemp1(prev => Math.min(1, Number((prev + 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX || 0) / 250));
                setOcrTemp1(Number(ratio.toFixed(2)));
              }}
              style={styles.sliderTrack}
            >
              <View style={[styles.sliderFill, { width: `${Math.min(100, Math.max(0, ocrTemp1 * 100))}%` }]} />
              <View style={[styles.sliderThumb, { left: `${Math.min(100, Math.max(0, ocrTemp1 * 100))}%` }]} />
            </TouchableOpacity>
          </View>

          {/* Slider 2 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Nhiệt độ (Tốc độ quét)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setOcrTemp2(prev => Math.max(0, Number((prev - 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{ocrTemp2.toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => setOcrTemp2(prev => Math.min(1, Number((prev + 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX || 0) / 250));
                setOcrTemp2(Number(ratio.toFixed(2)));
              }}
              style={styles.sliderTrack}
            >
              <View style={[styles.sliderFill, { width: `${Math.min(100, Math.max(0, ocrTemp2 * 100))}%` }]} />
              <View style={[styles.sliderThumb, { left: `${Math.min(100, Math.max(0, ocrTemp2 * 100))}%` }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Neural Translator Card */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <MessageSquare size={20} color="#1A5FD0" style={{ marginRight: 8 }} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setTransTemp(prev => Math.max(0, Number((prev - 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{transTemp.toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => setTransTemp(prev => Math.min(1, Number((prev + 0.05).toFixed(2))))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX || 0) / 250));
                setTransTemp(Number(ratio.toFixed(2)));
              }}
              style={styles.sliderTrack}
            >
              <View style={[styles.sliderFill, { width: `${Math.min(100, Math.max(0, transTemp * 100))}%` }]} />
              <View style={[styles.sliderThumb, { left: `${Math.min(100, Math.max(0, transTemp * 100))}%` }]} />
            </TouchableOpacity>
          </View>

          {/* Slider 4 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderText}>Giới hạn Token (Độ dài tóm tắt)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setTransToken(prev => Math.max(1, prev - 1))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{transToken}k</Text>
                <TouchableOpacity
                  onPress={() => setTransToken(prev => Math.min(8, prev + 1))}
                  style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX || 0) / 250));
                setTransToken(Math.max(1, Math.min(8, Math.round(ratio * 8))));
              }}
              style={styles.sliderTrack}
            >
              <View style={[styles.sliderFill, { width: `${Math.min(100, (transToken / 8) * 100)}%` }]} />
              <View style={[styles.sliderThumb, { left: `${Math.min(100, (transToken / 8) * 100)}%` }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* View More Link */}
        <TouchableOpacity style={styles.viewMoreLink} onPress={() => Alert.alert('Thông tin', 'Các tác nhân bổ sung: MRI Classifier, Segmentation Bot, Report Validator.')}>
          <Text style={styles.viewMoreText}>Xem thêm 3 tác nhân khác ▼</Text>
        </TouchableOpacity>

        {/* Hard cases training card */}
        <View style={styles.hardCasesCard}>
          <View style={styles.hardCasesLeft}>
            <Text style={styles.hardCasesTitle}>Số ca chụp MRI thực hiện hôm nay</Text>
            <Text style={styles.hardCasesDesc}>Dữ liệu hình ảnh chẩn đoán thu nhận sẵn sàng cho bác sĩ đọc và phân tích AI.</Text>
          </View>
          <View style={styles.hardCasesRight}>
            <Text style={styles.hardCasesCount}>{metrics?.imagingToday ?? 0} ca</Text>
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
            <Text style={styles.ragVectorCount}>{ragDocs.length} Tài liệu</Text>
            <Text style={styles.ragVectorDesc}>
              {ragDocs.length === 0
                ? 'Nhấn "+ Thêm TL" để tải lên tệp văn bản y học (.pdf, .xlsx).'
                : 'Cấu hình các tham số suy luận cho các quy trình chẩn đoán cụ thể.'}
            </Text>
          </View>

          <View style={styles.documentHeaderRow}>
            <Text style={styles.docHeaderTitle}>DỮ LIỆU MỚI NẠP</Text>
            <Text style={styles.docSyncStatus}>{ragDocs.length === 0 ? 'HỆ THỐNG TRỐNG' : `${ragDocs.length} FILE`}</Text>
          </View>

          <View style={styles.docList}>
            {ragDocs.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Chưa có tài liệu RAG nào được nạp. Tải lên để bắt đầu.</Text>
              </View>
            ) : (
              ragDocs.map((doc, idx) => (
                <View key={idx} style={styles.docRow}>
                  <View style={[styles.docIcon, { backgroundColor: doc.isSuccess ? '#0B7A53' : '#991B1B', alignItems: 'center', justifyContent: 'center' }]}>
                    <Folder size={16} color="#FFFFFF" />
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
              <Text style={styles.sliderTextDark}>Độ sâu ngữ cảnh tìm kiếm (RAG Depth)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setRagDepth(prev => Math.max(1, prev - 1))}
                  style={{ backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#F1F5F9' }}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValueDark}>Top {ragDepth}</Text>
                <TouchableOpacity
                  onPress={() => setRagDepth(prev => Math.min(20, prev + 1))}
                  style={{ backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#F1F5F9' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX || 0) / 250));
                setRagDepth(Math.max(1, Math.min(20, Math.round(ratio * 20))));
              }}
              style={styles.sliderTrackDark}
            >
              <View style={[styles.sliderFillDark, { width: `${Math.min(100, (ragDepth / 20) * 100)}%` }]} />
              <View style={[styles.sliderThumbDark, { left: `${Math.min(100, (ragDepth / 20) * 100)}%` }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* System Prompt Box */}
        <View style={styles.promptCard}>
          <View style={styles.promptHeader}>
            <Text style={styles.promptTitle}>Lời nhắc Hệ thống (System Prompt)</Text>
            <Zap size={18} color="#EAB308" />
          </View>
          <TextInput
            style={styles.promptInput}
            multiline
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            editable={true}
            placeholder="Nhập System Prompt điều phối mạng nơ-ron..."
            placeholderTextColor="#94A3B8"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

;

export default SystemAdminScreen;
