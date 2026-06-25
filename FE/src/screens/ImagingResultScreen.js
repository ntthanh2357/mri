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

  useEffect(() => {
    get('/auth/me')
      .then(res => setLocalUser(res.user))
      .catch(err => console.log('Error fetching me:', err));
  }, []);

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
      await put(`/api/v1/imaging/${resultId}`, {
        findings: findingsText.trim(),
        conclusion: conclusionText.trim(),
        radiologist: docName
      });

      if (visitId) {
        await put(`/api/v1/visits/${visitId}/status`, { status: 'hoàn tất' });
      }

      if (Platform.OS === 'web') {
        alert('Đã lưu chẩn đoán và hoàn tất ca khám.');
      } else {
        Alert.alert('Thành công', 'Đã lưu chẩn đoán và hoàn tất ca khám.');
      }
      navigation.goBack();
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
    <ResponsiveLayout navigation={navigation} activeRoute={activeRoute}>
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

            {localUser?.role !== 'patient' && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#1E3A8A',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignSelf: 'flex-start',
                  marginTop: 14,
                  marginBottom: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#3B82F6'
                }}
                onPress={async () => {
                  try {
                    const patientsRes = await get('/api/patients');
                    if (patientsRes && patientsRes.success && Array.isArray(patientsRes.data)) {
                      const target = patientsRes.data.find(p => {
                        const dbMedId = p.profile?.medicalId;
                        const mId = result.medicalId;
                        if (!mId) return false;
                        if (dbMedId === mId) return true;
                        
                        const cleanDbMedId = String(dbMedId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        const cleanMId = String(mId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        if (cleanDbMedId && cleanDbMedId === cleanMId) return true;
                        
                        const nsSuffix = p._id?.substring(18).toLowerCase();
                        if (nsSuffix && cleanMId.includes(nsSuffix)) return true;
                        
                        return false;
                      });
                      if (target) {
                        navigation.navigate('PatientDetail', { patientId: target._id });
                        return;
                      }
                    }
                    Alert.alert('Thông báo', 'Không tìm thấy bệnh án chi tiết MongoDB tương ứng cho Mã y tế này.');
                  } catch (err) {
                    console.warn('Lỗi tìm bệnh án bệnh nhân:', err);
                    Alert.alert('Lỗi', 'Không thể kết nối máy chủ để tìm bệnh án.');
                  }
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>📂 Xem Hồ sơ EMR & Xét nghiệm LIS →</Text>
              </TouchableOpacity>
            )}

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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>HÌNH ẢNH PHIM CHỤP ({result.images.length} ẢNH)</Text>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#1E1B4B', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, opacity: analyzing ? 0.7 : 1 }}
                    onPress={handleAiAnalysis}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <ActivityIndicator size="small" color="#818CF8" />
                    ) : (
                      <Text style={{ color: '#818CF8', fontWeight: 'bold', fontSize: 13 }}>
                        🤖 Phân tích Khối u bằng AI
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {aiResult && (
                  <View style={{ backgroundColor: '#EEF2F6', borderLeftWidth: 4, borderLeftColor: '#3B82F6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1E3A8A', marginBottom: 4 }}>🤖 Dự đoán của AI (Dành cho Bác sĩ đánh giá)</Text>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                      - Phân loại khối u: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{aiResult.class_name?.toUpperCase()}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 8 }}>
                      - Độ tự tin: <Text style={{ fontWeight: 'bold' }}>{aiResult.confidence}%</Text>
                    </Text>
                    {aiResult.consensus_message ? (
                      <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 10 }}>
                        {aiResult.consensus_message}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {!approveSuccess ? (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14,
                            backgroundColor: approvingAI ? '#D1FAE5' : '#10B981', borderRadius: 6, opacity: approvingAI ? 0.7 : 1,
                          }}
                          onPress={handleApproveAI} disabled={approvingAI}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                            {approvingAI ? '⏳ Đang ghi nhận...' : '✅ AI đúng — Xác nhận'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#D1FAE5', borderRadius: 6, borderWidth: 1, borderColor: '#6EE7B7' }}>
                          <Text style={{ color: '#065F46', fontSize: 12, fontWeight: 'bold' }}>✅ Đã xác nhận AI đúng</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={{ alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#3B82F6', borderRadius: 6 }}
                        onPress={() => setShowFeedbackForm(!showFeedbackForm)}
                        disabled={approveSuccess}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', opacity: approveSuccess ? 0.5 : 1 }}>
                          {showFeedbackForm ? '✕ Đóng Hiệu chỉnh' : '✍️ AI sai — Hiệu chỉnh lại'}
                        </Text>
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
                          style={{ paddingVertical: 8, backgroundColor: '#10B981', borderRadius: 6, alignItems: 'center', opacity: sendingFeedback ? 0.7 : 1 }}
                          onPress={handleSubmitFeedback} disabled={sendingFeedback}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                            {sendingFeedback ? 'Đang gửi phản hồi...' : '✓ Xác nhận & Gửi phản hồi AI học lại'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                
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
                    backgroundColor: '#15803D',
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 10,
                    marginBottom: 20
                  }}
                  onPress={handleSaveAndComplete}
                  disabled={completingVisit}
                >
                  {completingVisit ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>💾 Lưu Kết Quả & Hoàn Tất Khám</Text>
                  )}
                </TouchableOpacity>
              )}

              {explanation ? (
                <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', padding: 16, borderRadius: 10, marginTop: 16 }}>
                  <Text style={{ fontWeight: 'bold', color: '#166534', fontSize: 13, marginBottom: 6 }}>🧠 GIẢI THÍCH KẾT QUẢ BỞI AI (Dễ hiểu & Y đức):</Text>
                  <Text style={{ color: '#14532D', fontSize: 13, lineHeight: 20 }}>{explanation}</Text>
                </View>
              ) : explaining ? (
                <View style={{ marginTop: 16, alignItems: 'center', padding: 12 }}>
                  <ActivityIndicator size="small" color="#15803D" />
                  <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Bác sĩ AI đang dịch báo cáo y khoa sang ngôn ngữ đời thường cho bạn...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{ backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 16, alignItems: 'center' }}
                  onPress={handleExplainAI}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>🤖 GIẢI THÍCH KẾT QUẢ BẰNG AI (Dễ hiểu & Y đức)</Text>
                </TouchableOpacity>
              )}
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
