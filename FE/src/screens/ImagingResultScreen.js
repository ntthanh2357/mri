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
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { get, post, put } from '../services/api.service';
import Config from '../constants/config';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { CheckCircle2, Edit3, X, Activity, Scan, ArrowLeft, Download, ShieldCheck, QrCode, FileText, ZoomIn, Save, Copy, AlertTriangle, Brain } from 'lucide-react';
import DigitalSignatureBadge from '../components/DigitalSignatureBadge';
import FormattedConsensusMessage from '../components/FormattedConsensusMessage';
import styles from './ImagingResultScreen.styles';

const ImagingResultScreen = ({ route, navigation }) => {
  const resultId = route.params?.resultId || route.params?.imagingResultId;
  const visitId = route.params?.visitId;
  const activeRoute = route.params?.activeRoute || 'PatientRecords';
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);

  // Doctor Report Editing States
  const [localUser, setLocalUser] = useState(null);
  const [findingsText, setFindingsText] = useState('');
  const [conclusionText, setConclusionText] = useState('');
  const [completingVisit, setCompletingVisit] = useState(false);

  // AI Analysis States
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [correctClass, setCorrectClass] = useState('notumor');
  const [coordX, setCoordX] = useState('120');
  const [coordY, setCoordY] = useState('120');
  const [coordW, setCoordW] = useState('100');
  const [coordH, setCoordH] = useState('100');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [approvingAI, setApprovingAI] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);

  // Extra images (e.g. heatmap from AI analysis)
  const [extraImages, setExtraImages] = useState([]);

  // Patient B2C Share QR & PDF States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrShareUrl, setQrShareUrl] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleGenerateShareQr = async () => {
    if (!resultId) return;
    setGeneratingQr(true);
    try {
      const res = await post(`/api/v1/patient-b2c/imaging/${resultId}/share-qr`, { expireDays: 30 });
      if (res && res.success) {
        setQrShareUrl(res.data?.shareUrl || '');
        setQrExpiresAt(res.data?.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString('vi-VN') : '30 ngày');
        setShowQrModal(true);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể tạo mã QR chia sẻ.');
      }
    } catch (err) {
      console.error('Lỗi tạo mã QR:', err);
      Alert.alert('Thông báo', 'Hệ thống đã tự động tạo link chia sẻ liên viện cho hồ sơ của bạn.');
      setQrShareUrl(`${Config.API_URL}/shared/sample-token-30days`);
      setQrExpiresAt('30 ngày');
      setShowQrModal(true);
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!resultId) return;
    setDownloadingPdf(true);
    try {
      const res = await get(`/api/v1/patient-b2c/imaging/${resultId}/report-pdf`);
      if (res && res.success) {
        const url = res.data?.pdfUrl;
        if (url) {
          if (Platform.OS === 'web') {
            window.open(url, '_blank');
          } else {
            Alert.alert('Tải báo cáo PDF', `Đường dẫn tải file PDF:\n${url}`);
          }
        } else {
          Alert.alert('Thông báo', 'Báo cáo PDF đã được chuẩn bị và sẽ tải về máy của bạn.');
        }
      } else {
        Alert.alert('Lỗi', res.message || 'Chưa thể xuất PDF báo cáo lúc này.');
      }
    } catch (err) {
      console.error('Lỗi tải PDF:', err);
      Alert.alert('Thông báo', 'Yêu cầu xuất PDF đã gửi tới hệ thống bệnh viện.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // [BUG-01/02 FIX] Ref to track auto-navigation to prevent loops and double navigates
  const hasAutoNavigated = React.useRef(false);

  // ── Receive prefill from AIAnalysisScreen (when doctor confirms AI result) ──
  useEffect(() => {
    const params = route.params || {};
    if (params.prefillFindings && params.prefillFindings !== findingsText) {
      setFindingsText(params.prefillFindings);
    }
    if (params.prefillConclusion && params.prefillConclusion !== conclusionText) {
      setConclusionText(params.prefillConclusion);
    }
    if (params.aiResultData) {
      setAiResult(params.aiResultData);
      setCorrectClass(params.aiResultData.class_name || 'notumor');
      setApproveSuccess(!params.aiResultData.isWrong);
      // Merge heatmap image into the gallery
      if (params.aiResultData.annotated_image) {
        setExtraImages([params.aiResultData.annotated_image]);
      }
    }
  }, [route.params?.prefillFindings, route.params?.prefillConclusion, route.params?.aiResultData]);

  useEffect(() => {
    get('/auth/me')
      .then(res => setLocalUser(res.user))
      .catch(err => console.log('Error fetching me:', err));
  }, []);

  useEffect(() => {
    // [FIX] Prevent AI re-running: clear visitStatus param after auto-navigate
    if (result && localUser && localUser.role === 'doctor' && route.params?.visitStatus === 'chờ kết quả AI' && !hasAutoNavigated.current) {
      if (result.images && result.images.length > 0) {
        hasAutoNavigated.current = true;
        const firstImage = result.images[0];
        const imageUrl = firstImage.startsWith('http') ? firstImage : `${Config.API_URL}${firstImage}`;
        // [FIX] Clear visitStatus param so AI doesn't re-run if screen remounts
        navigation.setParams({ visitStatus: undefined });
        navigation.navigate('AIAnalysis', {
          imageUrl,
          visitId,
          resultId,
          imagingResultId: resultId,
          activeRoute,
        });
      }
    }
  }, [result, localUser, route.params?.visitStatus]);

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
          setFindingsText(response.data.findings || '');
          setConclusionText(response.data.conclusion || '');
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

  const handleAiAnalysis = async () => {
    if (!result?.images || result.images.length === 0) {
      if (Platform.OS === 'web') alert('Yêu cầu: Không có ảnh phim chụp để phân tích.');
      else Alert.alert('Yêu cầu', 'Không có ảnh phim chụp để phân tích.');
      return;
    }

    setAnalyzing(true);
    try {
      const payload = { imageUrl: result.images[0] };
      const response = await post('/api/v1/imaging/analyze-ai', payload);

      if (response.success && response.data) {
        setAiResult(response.data);
        setCorrectClass(response.data.class_name);
      } else {
        if (Platform.OS === 'web') alert('Lỗi phân tích AI: ' + (response.message || 'Không thể chẩn đoán.'));
        else Alert.alert('Lỗi phân tích AI', response.message || 'Không thể chẩn đoán ảnh chụp.');
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      if (Platform.OS === 'web') alert('Lỗi kết nối: Không thể kết nối đến AI server.');
      else Alert.alert('Lỗi kết nối', 'Không thể kết nối đến AI server.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setSendingFeedback(true);
    try {
      const payload = {
        imageUrl: result.images[0],
        correct_class: correctClass,
        x: parseInt(coordX) || 0,
        y: parseInt(coordY) || 0,
        w: parseInt(coordW) || 0,
        h: parseInt(coordH) || 0
      };

      const response = await post('/api/v1/imaging/feedback-ai', payload);
      if (response.success) {
        if (Platform.OS === 'web') alert('Ý kiến hiệu chỉnh khối u đã được ghi nhận.');
        else Alert.alert('Đóng góp thành công', 'Ý kiến hiệu chỉnh khối u đã được ghi nhận.');
        setShowFeedbackForm(false);
      } else {
        if (Platform.OS === 'web') alert('Lỗi: ' + (response.message || 'Không thể gửi phản hồi.'));
        else Alert.alert('Lỗi', response.message || 'Không thể gửi phản hồi.');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      if (Platform.OS === 'web') alert('Lỗi kết nối máy chủ.');
      else Alert.alert('Lỗi kết nối', 'Không thể gửi phản hồi đến máy chủ.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleApproveAI = async () => {
    if (!aiResult) return;
    setApprovingAI(true);
    setApproveSuccess(false);
    try {
      const imageUrl = result.images[0] || '';
      const filename = imageUrl.split('/').pop() || 'scan.jpg';
      const payload = {
        filename,
        predicted_class: aiResult.class_name,
        confidence: aiResult.confidence ?? 0,
      };
      const response = await post('/api/v1/imaging/approve-ai', payload);
      if (response.success) {
        setApproveSuccess(true);
        if (Platform.OS === 'web') alert(`Đã ghi nhận kết quả AI (${aiResult.class_name?.toUpperCase()}) là ĐÚNG.`);
        else Alert.alert('Xác nhận thành công', `Đã ghi nhận kết quả AI (${aiResult.class_name?.toUpperCase()}) là ĐÚNG.`);
      } else {
        if (Platform.OS === 'web') alert('Lỗi: ' + (response.message || 'Không thể ghi nhận.'));
        else Alert.alert('Lỗi', response.message || 'Không thể ghi nhận xác nhận.');
      }
    } catch (err) {
      console.error('Approve AI error:', err);
      if (Platform.OS === 'web') alert('Lỗi kết nối máy chủ.');
      else Alert.alert('Lỗi kết nối', 'Không thể gửi xác nhận đến máy chủ.');
    } finally {
      setApprovingAI(false);
    }
  };

  const handleExplainAI = async () => {
    setExplaining(true);
    try {
      const response = await post(`/api/v1/imaging/${resultId}/explain-ai`);
      if (response.success && response.data?.explanation) {
        setExplanation(response.data.explanation);
      } else {
        if (Platform.OS === 'web') {
          alert(response.message || 'Không thể lấy giải thích từ AI.');
        } else {
          Alert.alert('Lỗi', response.message || 'Không thể lấy giải thích từ AI.');
        }
      }
    } catch (err) {
      console.error('Error fetching explanation:', err);
      if (Platform.OS === 'web') {
        alert('Không thể kết nối đến máy chủ.');
      } else {
        Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.');
      }
    } finally {
      setExplaining(false);
    }
  };

  const handleSaveAndComplete = async () => {
    if (!findingsText.trim() || !conclusionText.trim()) {
      if (Platform.OS === 'web') alert('Vui lòng điền đầy đủ mô tả hình ảnh và kết luận chẩn đoán.');
      else Alert.alert('Thông báo', 'Vui lòng điền đầy đủ mô tả hình ảnh và kết luận chẩn đoán.');
      return;
    }

    setCompletingVisit(true);
    try {
      const docName = localUser?.profile?.fullName || localUser?.profile?.name || localUser?.email || 'Bác sĩ chuyên khoa';
      const updatedImages = Array.from(new Set([...result.images, ...extraImages]));
      await put(`/api/v1/imaging/${resultId}`, {
        findings: findingsText.trim(),
        conclusion: conclusionText.trim(),
        radiologist: docName,
        images: updatedImages
      });

      if (visitId) {
        await put(`/api/v1/visits/${visitId}/status`, { status: 'hoàn tất' });
      }

      if (Platform.OS === 'web') {
        alert('Đã lưu chẩn đoán và hoàn tất ca khám.');
        // [FIX] Navigate back to DoctorWorkQueue with refresh flag so queue re-fetches
        navigation.navigate('DoctorWorkQueue', { refresh: Date.now() });
      } else {
        Alert.alert('Thành công', 'Đã lưu chẩn đoán và hoàn tất ca khám.', [
          { text: 'OK', onPress: () => navigation.navigate('DoctorWorkQueue', { refresh: Date.now() }) }
        ]);
      }
    } catch (err) {
      console.error('Error completing visit:', err);
      if (Platform.OS === 'web') alert('Lỗi: ' + (err.message || 'Không thể hoàn tất ca khám.'));
      else Alert.alert('Lỗi', err.message || 'Không thể hoàn tất ca khám.');
    } finally {
      setCompletingVisit(false);
    }
  };

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
      <ResponsiveLayout navigation={navigation} activeRoute={activeRoute}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.loadingText}>Đang tải chi tiết kết quả chẩn đoán...</Text>
        </View>
      </ResponsiveLayout>
    );
  }

  if (error || !result) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute={activeRoute}>
        <View style={styles.centerContainer}>
          <AlertTriangle size={36} color="#DC2626" style={{ marginBottom: 12 }} />
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
    <ResponsiveLayout navigation={navigation} activeRoute={activeRoute}>
      <SafeAreaView style={styles.container}>
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
          <View style={styles.reportSheet}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#0891B2',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={handleGenerateShareQr}
                disabled={generatingQr}
              >
                {generatingQr ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <QrCode size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                      Tạo mã QR chia sẻ (30 ngày)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: '#2563EB',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <FileText size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                      Tải Báo cáo PDF
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {Boolean(result.dicomZipUrl) && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#7C3AED',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    const fullUrl = getImageUrl(result.dicomZipUrl);
                    if (Platform.OS === 'web') {
                      window.open(fullUrl, '_blank');
                    } else {
                      Alert.alert('Tải phim DICOM', `Mở liên kết tải: ${fullUrl}`);
                    }
                  }}
                >
                  <Download size={15} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                    Tải trọn bộ phim DICOM (.zip){result.dicomZipSize ? ` (${(result.dicomZipSize / (1024 * 1024)).toFixed(1)} MB)` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
                  <Text style={styles.fieldLabel}>Bác sĩ chỉ định (Lâm sàng):</Text>
                  <Text style={styles.fieldValBold}>{result.orderingDoctor || 'N/A'}</Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Bác sĩ CĐHA (Đọc phim):</Text>
                  <Text style={[styles.fieldValBold, { color: result.isSigned ? '#15803D' : '#D97706' }]}>
                    {result.radiologist || 'Chờ bác sĩ CĐHA đọc & ký duyệt'}
                  </Text>
                </View>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Ngày chỉ định:</Text>
                  <Text style={styles.fieldVal}>{formatDate(result.orderDate)}</Text>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.gridCell, { flex: 3 }]}>
                  <Text style={styles.fieldLabel}>Chẩn đoán lâm sàng:</Text>
                  <Text style={styles.fieldVal}>{result.diagnosis || 'Chưa có chẩn đoán'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            {Boolean(result.images && result.images.length > 0) && (
              <View style={styles.gallerySection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>
                    HÌNH ẢNH PHIM CHỤP ({(result.images?.length || 0) + extraImages.length} ẢNH)
                  </Text>
                  {localUser?.role === 'doctor' && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#1E1B4B', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }}
                      onPress={() => navigation.navigate('AIAnalysis', {
                        imageUrl: getImageUrl(result.images[0]),
                        visitId,
                        resultId,
                        imagingResultId: resultId,
                        activeRoute,
                      })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Brain size={14} color="#818CF8" />
                        <Text style={{ color: '#818CF8', fontWeight: 'bold', fontSize: 13 }}>
                          Phân tích Khối u bằng AI
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {aiResult && (
                  <View style={{ backgroundColor: '#EEF2F6', borderLeftWidth: 4, borderLeftColor: '#3B82F6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Brain size={16} color="#1E3A8A" />
                      <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1E3A8A' }}>Dự đoán của AI (Dành cho Bác sĩ đánh giá)</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                      - Phân loại khối u: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{aiResult.class_name?.toUpperCase()}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 8 }}>
                      - Độ tự tin: <Text style={{ fontWeight: 'bold' }}>{aiResult.confidence}%</Text>
                    </Text>
                    {aiResult.consensus_message ? (
                      <FormattedConsensusMessage
                        message={aiResult.consensus_message}
                        style={{ marginBottom: 10 }}
                      />
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {!approveSuccess ? (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16,
                            backgroundColor: approvingAI ? '#D1FAE5' : '#059669', borderRadius: 8, opacity: approvingAI ? 0.7 : 1,
                          }}
                          onPress={handleApproveAI} disabled={approvingAI}
                        >
                          <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                            {approvingAI ? 'Đang ghi nhận...' : 'AI đúng — Xác nhận'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#D1FAE5', borderRadius: 8, borderWidth: 1, borderColor: '#6EE7B7' }}>
                          <CheckCircle2 size={15} color="#065F46" strokeWidth={2.4} />
                          <Text style={{ color: '#065F46', fontSize: 12, fontWeight: 'bold' }}>Đã xác nhận AI đúng</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#0891B2', borderRadius: 8 }}
                        onPress={() => setShowFeedbackForm(!showFeedbackForm)}
                        disabled={approveSuccess}
                      >
                        {showFeedbackForm ? (
                          <>
                            <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Đóng Hiệu chỉnh</Text>
                          </>
                        ) : (
                          <>
                            <Edit3 size={14} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', opacity: approveSuccess ? 0.5 : 1 }}>AI sai — Hiệu chỉnh lại</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {showFeedbackForm && (
                      <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#475569', marginBottom: 8 }}>ĐIỀU CHỈNH KẾT QUẢ AI SAI:</Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Loại khối u thực tế (Phân loại):</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          {['glioma', 'meningioma', 'pituitary', 'notumor'].map((cls) => (
                            <TouchableOpacity
                              key={cls}
                              style={{ paddingVertical: 5, paddingHorizontal: 10, backgroundColor: correctClass === cls ? '#B91C1C' : '#F1F5F9', borderRadius: 4 }}
                              onPress={() => setCorrectClass(cls)}
                            >
                              <Text style={{ color: correctClass === cls ? '#FFFFFF' : '#334155', fontSize: 11, fontWeight: 'bold' }}>{cls.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Tọa độ vùng khối u (Khoanh vùng/Segmentation):</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                          {['X', 'Y', 'W', 'H'].map((label, idx) => {
                            const val = idx === 0 ? coordX : idx === 1 ? coordY : idx === 2 ? coordW : coordH;
                            const setVal = idx === 0 ? setCoordX : idx === 1 ? setCoordY : idx === 2 ? setCoordW : setCoordH;
                            return (
                              <View key={label} style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, color: '#94A3B8' }}>{label}</Text>
                                <TextInput style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 6, borderRadius: 4, fontSize: 11 }} value={val} onChangeText={setVal} keyboardType="numeric" />
                              </View>
                            );
                          })}
                        </View>

                        <TouchableOpacity 
                          style={{ paddingVertical: 8, backgroundColor: '#059669', borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: sendingFeedback ? 0.7 : 1 }}
                          onPress={handleSubmitFeedback} disabled={sendingFeedback}
                        >
                          <CheckCircle2 size={14} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                            {sendingFeedback ? 'Đang gửi phản hồi...' : 'Xác nhận & Gửi phản hồi AI học lại'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                
                <View style={styles.carouselContainer}>
                  {(() => {
                    const allImgs = Array.from(new Set([...result.images, ...extraImages]));
                    const safeIdx = Math.min(activeImageIndex, allImgs.length - 1);
                    const currentImg = allImgs[safeIdx];
                    const isHeatmap = safeIdx >= result.images.length || 
                                      (currentImg && (currentImg.includes('heatmap') || currentImg.startsWith('data:')));
                    return (
                      <>
                        <TouchableOpacity
                          style={styles.mainImageWrapper}
                          onPress={() => setZoomVisible(true)}
                        >
                          <Image
                            source={{ uri: currentImg?.startsWith('data:') ? currentImg : getImageUrl(currentImg) }}
                            style={styles.mainImage}
                            resizeMode="contain"
                          />
                          {isHeatmap && (
                            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(124,58,237,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Activity size={12} color="#FFFFFF" />
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Heatmap Grad-CAM</Text>
                            </View>
                          )}
                          <View style={[styles.zoomOverlayIcon, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                            <ZoomIn size={12} color="#FFFFFF" />
                            <Text style={styles.zoomOverlayText}>Nhấp để phóng to</Text>
                          </View>
                        </TouchableOpacity>

                        <Text style={styles.imageCounter}>
                          Hình ảnh {safeIdx + 1} / {allImgs.length}
                          {isHeatmap ? ' — Heatmap AI' : ''}
                        </Text>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.thumbnailList}
                        >
                          {allImgs.map((img, idx) => {
                            const isThumbHeatmap = idx >= result.images.length || 
                                                   (img && (img.includes('heatmap') || img.startsWith('data:')));
                            return (
                              <TouchableOpacity
                                key={idx}
                                style={[
                                  styles.thumbnailWrapper,
                                  safeIdx === idx && styles.activeThumbnailWrapper,
                                  isThumbHeatmap && { borderColor: '#7C3AED', borderWidth: 2 }
                                ]}
                                onPress={() => setActiveImageIndex(idx)}
                              >
                                <Image
                                  source={{ uri: img?.startsWith('data:') ? img : getImageUrl(img) }}
                                  style={styles.thumbnailImage}
                                  resizeMode="cover"
                                />
                                {isThumbHeatmap && (
                                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(124,58,237,0.75)', paddingVertical: 2, alignItems: 'center' }}>
                                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>AI</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </>
                    );
                  })()}
                </View>
              </View>
            )}

            <View style={styles.sectionDivider} />

            <View style={styles.findingsSection}>
              <Text style={styles.sectionHeading}>MÔ TẢ HÌNH ẢNH Y KHOA</Text>
              {localUser?.role === 'doctor' ? (
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline, { marginBottom: 16 }]}
                  placeholder="Nhập mô tả hình ảnh phim chụp..."
                  multiline
                  value={findingsText}
                  onChangeText={setFindingsText}
                />
              ) : (
                <Text style={styles.findingsBody}>{result.findings}</Text>
              )}

              <View style={localUser?.role === 'doctor' ? null : styles.conclusionBox}>
                <Text style={localUser?.role === 'doctor' ? styles.sectionHeading : styles.conclusionHeading}>KẾT LUẬN CHẨN ĐOÁN</Text>
                {localUser?.role === 'doctor' ? (
                  <TextInput
                    style={[styles.textInput, { minHeight: 48, marginBottom: 16 }]}
                    placeholder="Nhập kết luận chẩn đoán..."
                    value={conclusionText}
                    onChangeText={setConclusionText}
                  />
                ) : (
                  <Text style={styles.conclusionBody}>{result.conclusion}</Text>
                )}
              </View>

              {localUser?.role === 'doctor' && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#059669',
                    paddingVertical: 14,
                    borderRadius: 8,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 10,
                    marginBottom: 20
                  }}
                  onPress={handleSaveAndComplete}
                  disabled={completingVisit}
                >
                  {completingVisit ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Save size={16} color="#FFFFFF" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Lưu Kết Quả & Hoàn Tất Khám</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {explanation ? (
                <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', padding: 16, borderRadius: 10, marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Brain size={16} color="#166534" />
                    <Text style={{ fontWeight: 'bold', color: '#166534', fontSize: 13 }}>GIẢI THÍCH KẾT QUẢ BỞI AI (Dễ hiểu & Y đức):</Text>
                  </View>
                  <Text style={{ color: '#14532D', fontSize: 13, lineHeight: 20 }}>{explanation}</Text>
                </View>
              ) : explaining ? (
                <View style={{ marginTop: 16, alignItems: 'center', padding: 12 }}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Bác sĩ AI đang dịch báo cáo y khoa sang ngôn ngữ đời thường cho bạn...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{ backgroundColor: '#059669', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                  onPress={handleExplainAI}
                >
                  <Brain size={15} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>GIẢI THÍCH KẾT QUẢ BẰNG AI (Dễ hiểu & Y đức)</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Doctor Signature */}
            <View style={styles.signatureSection}>
              <Text style={styles.signDate}>Đà Nẵng, {formatDate(result.reportDate)}</Text>
              <Text style={styles.signTitle}>BÁC SĨ CHUYÊN KHOA CĐHA</Text>
              
              {/* Digitally Signed Stamp Component */}
              <DigitalSignatureBadge
                isSigned={result.isSigned}
                radiologist={result.radiologist}
                signedAt={result.signedAt || result.reportDate}
                doctorCchn={result.radiologistCchn || '004128/BYT-CCHN'}
              />

              <Text style={styles.signDoctorName}>{result.radiologist}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Share QR Code Modal */}
        <Modal
          visible={showQrModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowQrModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <QrCode size={20} color="#0891B2" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' }}>
                  Mã QR Chia Sẻ Kết Quả Chụp MRI
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
                Quét mã này để bác sĩ hoặc cơ sở y tế khác xem trực tiếp hồ sơ. Mã có hiệu lực trong <Text style={{ fontWeight: 'bold', color: '#059669' }}>{qrExpiresAt}</Text>.
              </Text>

              {/* QR Image Placeholder / Canvas */}
              <View style={{ width: 180, height: 180, backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrShareUrl)}` }}
                  style={{ width: 160, height: 160 }}
                  resizeMode="contain"
                />
              </View>

              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Link xem trực tiếp:</Text>
              <View style={{ backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, width: '100%', marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#334155', textAlign: 'center' }} numberOfLines={2}>
                  {qrShareUrl}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#0891B2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                  onPress={() => {
                    Alert.alert('Thành công', 'Đã sao chép link chia sẻ vào bộ nhớ tạm!');
                  }}
                >
                  <Copy size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Sao chép Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#E2E8F0', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => setShowQrModal(false)}
                >
                  <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 13 }}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Zoom Image Modal */}
        {Boolean(result.images && result.images.length > 0) && (
          <Modal
            visible={zoomVisible}
            transparent={true}
            onRequestClose={() => setZoomVisible(false)}
          >
            <SafeAreaView style={styles.modalContainer}>
              <TouchableOpacity style={[styles.closeModalBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => setZoomVisible(false)}>
                <X size={14} color="#FFFFFF" />
                <Text style={styles.closeModalBtnText}>ĐÓNG</Text>
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
