import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Platform,
  Animated,
} from 'react-native';
import { post } from '../services/api.service';
import Config from '../constants/config';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import AiFilmPicker from '../components/patient/AiFilmPicker';
import AiResultPatientCard from '../components/patient/AiResultPatientCard';
import { useCurrentRole } from '../controllers/useCurrentRole';
import {
  Scan,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Activity,
  ShieldCheck,
  Edit3,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import styles from './AIAnalysisScreen.styles';
import FormattedConsensusMessage, { stripHtml } from '../components/FormattedConsensusMessage';
import InteractiveRoiDrawer from '../components/InteractiveRoiDrawer';

const stripUrlQuery = (raw) => String(raw || '').split(/[?#]/)[0];

const toNormalizedRoiBox = (box) => {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w !== undefined ? box.w : box.width);
  const h = Number(box.h !== undefined ? box.h : box.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 1 || h > 1) return null;
  return { x, y, w, h };
};

const computeContainedRect = (cW, cH, nW, nH) => {
  if (!cW || !cH) return { left: 0, top: 0, width: '100%', height: '100%' };
  const nw = nW > 0 ? nW : 512;
  const nh = nH > 0 ? nH : 512;
  const containerAspect = cW / cH;
  const imageAspect = nw / nh;
  if (containerAspect > imageAspect) {
    const renderW = cH * imageAspect;
    return { left: (cW - renderW) / 2, top: 0, width: renderW, height: cH };
  }
  const renderH = cW / imageAspect;
  return { left: 0, top: (cH - renderH) / 2, width: cW, height: renderH };
};

const findSliceAiEntry = (reportObj, idx, imgUrl) => {
  if (!reportObj) return null;
  const slices = Array.isArray(reportObj.sliceResults) ? reportObj.sliceResults : null;
  if (slices && slices.length > 0) {
    const stripped = stripUrlQuery(imgUrl);
    return (
      (stripped && slices.find((s) => stripUrlQuery(s.imageUrl) === stripped)) ||
      slices.find((s) => s.sliceIndex === idx) ||
      null
    );
  }
  return idx === 0 ? reportObj : null;
};

const CLASS_META = {
  glioma: {
    label: 'GLIOMA',
    color: '#B91C1C',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: AlertTriangle,
    desc: 'Khối u thần kinh đệm — cần hội chẩn chuyên khoa khẩn cấp.',
  },
  meningioma: {
    label: 'MENINGIOMA',
    color: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: AlertCircle,
    desc: 'U màng não — thường lành tính, có thể theo dõi hoặc can thiệp.',
  },
  pituitary: {
    label: 'PITUITARY',
    color: '#0369A1',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    icon: Activity,
    desc: 'U tuyến yên — cần kiểm tra nội tiết và hội chẩn chuyên khoa.',
  },
  notumor: {
    label: 'BÌNH THƯỜNG',
    color: '#047857',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: ShieldCheck,
    desc: 'Không phát hiện khối u não bất thường trên hình ảnh MRI.',
  },
};

const ConfidenceBar = ({ value, color }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [value]);
  return (
    <View style={{ height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 4,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
};

const AIAnalysisScreen = ({ route, navigation }) => {
  const { imageUrl, images: routeImages, sliceIndex: routeSliceIndex, aiReportData: routeAiReportData, visitId, patientInfo, resultId, imagingResultId } = route.params || {};
  const targetResultId = imagingResultId || resultId || route.params?.resultId || route.params?.imagingResultId;
  const targetVisitId = visitId || route.params?.visitId;
  const targetActiveRoute = route.params?.activeRoute || (imageUrl ? 'DoctorWorkQueue_examQueue' : 'AIAnalysis');
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // Bệnh nhân xem bản dễ hiểu; chỉ bác sĩ/admin được duyệt hoặc hiệu chỉnh (khớp quyền ở BE approve-ai/feedback-ai); KTV chỉ xem ảnh chụp và kết quả AI trả về.
  const role = useCurrentRole();
  const isPatient = role === 'patient';
  const isTechnician = role === 'technician';
  const canReview = ['doctor', 'radiologist', 'department_head', 'admin', 'hospital_admin'].includes(role);

  const sliceImages = useMemo(() => {
    if (Array.isArray(routeImages) && routeImages.length > 0) return routeImages;
    if (Array.isArray(routeAiReportData?.sliceResults) && routeAiReportData.sliceResults.length > 0) {
      const urls = routeAiReportData.sliceResults.map((s) => s.imageUrl).filter(Boolean);
      if (urls.length > 0) return urls;
    }
    return imageUrl ? [imageUrl] : [];
  }, [routeImages, routeAiReportData, imageUrl]);

  const [activeSliceIdx, setActiveSliceIdx] = useState(
    typeof routeSliceIndex === 'number' && routeSliceIndex >= 0 ? routeSliceIndex : 0
  );
  const currentSliceUrl = sliceImages[activeSliceIdx] || imageUrl || '';

  const [studyAiReport, setStudyAiReport] = useState(routeAiReportData || null);
  const [phase, setPhase] = useState('analyzing'); // 'analyzing' | 'result'
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Feedback state
  const [selectedCorrectClass, setSelectedCorrectClass] = useState(null);
  const [feedbackRoi, setFeedbackRoi] = useState({ x: 0, y: 0, w: 0, h: 0, normalizedBox: null });
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [origViewerLayout, setOrigViewerLayout] = useState({ width: 0, height: 0 });
  const [origImageNatural, setOrigImageNatural] = useState({ width: 512, height: 512 });
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [approvingAI, setApprovingAI] = useState(false);

  const syncAiDisplayFromEntry = (entry) => {
    setAiResult(entry);
    const ov = entry?.doctorOverride;
    const effClass = ov?.correctedClass || entry?.class_name || 'notumor';
    setSelectedCorrectClass(effClass);
    setFeedbackNote(ov?.note || '');
    setFeedbackError('');
    const effBox = effClass === 'notumor' ? null : (ov?.correctedBoundingBox || entry?.bounding_box || null);
    setFeedbackRoi({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      normalizedBox: toNormalizedRoiBox(effBox),
    });
  };

  // Slide animation for scanning line (translateY)
  const scanAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    );
    if (phase === 'analyzing') loop.start();
    else loop.stop();
    return () => loop.stop();
  }, [phase]);

  // Fade-in animation for results
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'result') {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [phase]);

  const steps = [
    { label: 'Tiền xử lý ảnh y khoa (OpenCV)', desc: 'Chuẩn hóa độ sáng, khử nhiễu ảnh MRI' },
    { label: 'Ensemble 3 mô hình phân loại u não', desc: 'ResNet50 + EfficientNetB0 + DenseNet121' },
    { label: 'YOLOv8 phát hiện và khoanh vùng', desc: 'Định vị tọa độ khối u trên lát cắt' },
    { label: 'Gemini VLM phân xử đa thức', desc: 'Nhận diện ngữ cảnh và kiểm chứng chéo' },
    { label: 'Grad-CAM vẽ Heatmap bất thường', desc: 'Trực quan hóa vùng kích hoạt mô hình' },
  ];

  // Auto-start analysis when screen mounts (or load cached slice result if passed from ImagingResultScreen)
  useEffect(() => {
    if (!currentSliceUrl) return;
    const cached = findSliceAiEntry(studyAiReport, activeSliceIdx, currentSliceUrl);
    if (cached && cached.class_name) {
      syncAiDisplayFromEntry(cached);
      setPhase('result');
      return;
    }
    runAnalysis(currentSliceUrl, activeSliceIdx);
  }, []);

  const runAnalysis = async (sliceUrlOverride = currentSliceUrl, sliceIdxOverride = activeSliceIdx) => {
    const targetUrl = typeof sliceUrlOverride === 'string' && sliceUrlOverride ? sliceUrlOverride : currentSliceUrl;
    const targetIdx = typeof sliceIdxOverride === 'number' ? sliceIdxOverride : activeSliceIdx;
    if (!targetUrl) return;

    setPhase('analyzing');
    setCurrentStep(0);
    setError(null);

    // Simulate step progress while loading
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 4) return prev + 1;
        return prev;
      });
    }, 600);

    try {
      const response = await post('/api/v1/imaging/analyze-ai', {
        imageUrl: targetUrl,
        visitId: targetVisitId,
        imagingResultId: targetResultId,
        sliceIndex: targetIdx,
      });
      clearInterval(stepInterval);
      setCurrentStep(5);

      if (response.success && response.data) {
        syncAiDisplayFromEntry(response.data);
        setStudyAiReport((prev) => {
          const base = prev || {};
          const prevSlices = Array.isArray(base.sliceResults) ? [...base.sliceResults] : [];
          const stripped = stripUrlQuery(targetUrl);
          const existingIdx = prevSlices.findIndex(
            (s) => (stripped && stripUrlQuery(s.imageUrl) === stripped) || s.sliceIndex === targetIdx
          );
          const nextEntry = { ...response.data, sliceIndex: targetIdx, imageUrl: targetUrl };
          if (existingIdx >= 0) prevSlices[existingIdx] = nextEntry;
          else prevSlices.push(nextEntry);
          return { ...base, sliceResults: prevSlices };
        });
        setTimeout(() => {
          setPhase('result');
        }, 300);
      } else {
        setError(response.message || 'Phân tích AI thất bại. Vui lòng thử lại.');
        setPhase('result');
      }
    } catch (err) {
      clearInterval(stepInterval);
      console.error('AI Analysis error:', err);
      setError('Không thể kết nối đến AI server. Đảm bảo FastAPI đã khởi động trên cổng 8000.');
      setPhase('result');
    }
  };

  const handleSelectSlice = (idx) => {
    setActiveSliceIdx(idx);
    const nextUrl = sliceImages[idx] || currentSliceUrl;
    const cached = findSliceAiEntry(studyAiReport, idx, nextUrl);
    if (cached && cached.class_name) {
      syncAiDisplayFromEntry(cached);
      setPhase('result');
    } else {
      runAnalysis(nextUrl, idx);
    }
  };

  const navigateBackWithAi = ({ prefillFindings, prefillConclusion, aiResultData }) => {
    if (targetResultId) {
      navigation.navigate('ImagingResult', {
        resultId: targetResultId,
        imagingResultId: targetResultId,
        visitId: targetVisitId,
        activeRoute: targetActiveRoute,
        prefillFindings,
        prefillConclusion,
        aiResultData,
      });
    } else {
      navigation.navigate('CreateImagingResult', {
        ...route.params,
        visitId: targetVisitId,
        activeRoute: targetActiveRoute,
        prefillFindings,
        prefillConclusion,
        aiResult: aiResultData,
        aiResultData,
      });
    }
  };

  // ── Xác nhận đúng ──────────────────────────────────────────────────────────
  const handleConfirmCorrect = async () => {
    if (!aiResult) return;
    setApprovingAI(true);
    try {
      const filename = currentSliceUrl?.split('?')[0].split('/').pop() || 'scan.jpg';
      await post('/api/v1/imaging/approve-ai', {
        filename,
        predicted_class: aiResult.doctorOverride?.correctedClass || aiResult.class_name,
        confidence: aiResult.confidence ?? 0,
      });
    } catch (_) { }
    setApprovingAI(false);

    const effClass = aiResult.doctorOverride?.correctedClass || aiResult.class_name;
    const meta = CLASS_META[effClass] || CLASS_META.notumor;
    const cleanConsensus = stripHtml(aiResult.consensus_message);
    const conclusionText =
      effClass === 'notumor'
        ? `Không phát hiện bất thường sọ não trên hình ảnh MRI (Độ tự tin AI: ${aiResult.confidence}%). Đồng thuận: ${cleanConsensus || 'Kết quả bình thường.'}`
        : `Hình ảnh gợi ý khối u loại ${meta.label} (Độ tự tin AI: ${aiResult.confidence}%). ${meta.desc} Đề xuất hội chẩn chuyên khoa phẫu thuật thần kinh.`;

    const findingsText =
      effClass === 'notumor'
        ? `Kết quả phân tích AI từ hệ thống Ensemble (ResNet + EfficientNet + DenseNet) + YOLOv8 không ghi nhận tổn thương bất thường. Độ tự tin: ${aiResult.confidence}%. Đồng thuận: ${cleanConsensus || 'Tất cả mô hình nhất quán.'}`
        : (aiResult.clinical_report || `Phát hiện vùng tổn thương gợi ý khối u loại ${meta.label}. Vị trí: ${aiResult.tumor_location?.note || 'Không xác định'}. Kích thước: xấp xỉ ${aiResult.tumor_location?.width}x${aiResult.tumor_location?.height} px. Độ tự tin: ${aiResult.confidence}%.`);

    navigateBackWithAi({
      prefillFindings: findingsText,
      prefillConclusion: conclusionText,
      aiResultData: {
        ...(studyAiReport || {}),
        ...aiResult,
        annotated_image: aiResult.annotated_image || aiResult.heatmapStreamUrl || aiResult.segmentationUrl,
        confirmed: true,
        isWrong: false,
      },
    });
  };

  // ── AI sai → gửi phản hồi rồi quay lại ────────────────────────────────────────────────────
  const handleConfirmWrong = async () => {
    if (!selectedCorrectClass) return;
    setSendingFeedback(true);
    setFeedbackError('');
    let updatedReport = studyAiReport;
    try {
      const fbRes = await post('/api/v1/imaging/feedback-ai', {
        imageUrl: currentSliceUrl,
        imagingResultId: targetResultId,
        sliceIndex: activeSliceIdx,
        correct_class: selectedCorrectClass,
        x: selectedCorrectClass === 'notumor' ? 0 : (feedbackRoi.x || 0),
        y: selectedCorrectClass === 'notumor' ? 0 : (feedbackRoi.y || 0),
        w: selectedCorrectClass === 'notumor' ? 0 : (feedbackRoi.w || 0),
        h: selectedCorrectClass === 'notumor' ? 0 : (feedbackRoi.h || 0),
        normalizedBox: selectedCorrectClass === 'notumor' ? null : (feedbackRoi.normalizedBox || null),
        note: feedbackNote.trim(),
        agreementStatus: 'modified',
      });
      if (fbRes?.success === false) {
        setFeedbackError(fbRes?.message || 'Không thể lưu hiệu chỉnh AI. Vui lòng thử lại.');
        setSendingFeedback(false);
        return;
      }
      if (fbRes?.data?.updatedAiReport) {
        updatedReport = fbRes.data.updatedAiReport;
        setStudyAiReport(updatedReport);
      }
    } catch (err) {
      setFeedbackError(err?.response?.data?.message || err?.message || 'Không thể lưu hiệu chỉnh AI. Vui lòng thử lại.');
      setSendingFeedback(false);
      return;
    }
    setSendingFeedback(false);

    const correctMeta = CLASS_META[selectedCorrectClass] || CLASS_META.notumor;
    const aiMeta = CLASS_META[aiResult?.class_name] || CLASS_META.notumor;

    const warningNote = `⚠️ LƯU Ý: Tại lát #${activeSliceIdx + 1}, AI chẩn đoán ban đầu là "${aiMeta.label}" nhưng bác sĩ đã điều chỉnh thành "${correctMeta.label}".${feedbackNote.trim() ? ` Ghi chú BS: ${feedbackNote.trim()}.` : ''} Kết quả này cần được xem xét kỹ lưỡng bởi chuyên gia. Phản hồi điều chỉnh đã được ghi nhận để cải thiện mô hình AI.`;

    const conclusionText =
      selectedCorrectClass === 'notumor'
        ? `Sau khi bác sĩ xem xét và điều chỉnh kết quả AI: Không phát hiện bất thường sọ não.`
        : `Sau khi bác sĩ xem xét và điều chỉnh kết quả AI: Hình ảnh gợi ý khối u loại ${correctMeta.label}. ${correctMeta.desc}`;

    navigateBackWithAi({
      prefillFindings: warningNote,
      prefillConclusion: conclusionText,
      aiResultData: {
        ...(updatedReport || {}),
        ...aiResult,
        annotated_image: aiResult?.annotated_image || aiResult?.heatmapStreamUrl || aiResult?.segmentationUrl,
        class_name: selectedCorrectClass,
        confirmed: true,
        isWrong: true,
        originalClass: aiResult?.class_name,
        warningNote,
      },
    });
  };

  const effectiveDisplayClass = aiResult?.doctorOverride?.correctedClass || aiResult?.class_name;
  const meta = aiResult ? (CLASS_META[effectiveDisplayClass] || CLASS_META.notumor) : null;
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:image')) return url;
    return `${Config.API_URL}${url}`;
  };
  const imageFullUri = getImageUrl(currentSliceUrl) || '';
  const annotatedUri = getImageUrl(aiResult?.annotated_image || aiResult?.heatmapStreamUrl || aiResult?.segmentationUrl);

  // Translate coordinates mapping box width
  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-190, 190],
  });

  if (!currentSliceUrl) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute={targetActiveRoute}>
        <SafeAreaView style={styles.container}>
          <AiFilmPicker navigation={navigation} isDesktop={isDesktop} />
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute={targetActiveRoute}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => navigation.goBack()}>
            <ArrowLeft size={16} color="#64748B" strokeWidth={2.2} />
            <Text style={styles.backBtnText}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isPatient ? 'Phân tích AI' : isTechnician ? 'Ảnh chụp & Kết quả AI trả về' : 'Chẩn đoán hình ảnh AI'}
          </Text>
          {phase === 'result' ? (
            <TouchableOpacity onPress={() => runAnalysis(currentSliceUrl, activeSliceIdx)} style={[styles.retryBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <RotateCcw size={13} color={Colors.brandNavy} strokeWidth={2.2} />
              <Text style={styles.retryBtnText}>Quét lại</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {sliceImages.length > 1 && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
              LÁT CẮT ĐANG PHÂN TÍCH ({activeSliceIdx + 1}/{sliceImages.length}):
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {sliceImages.map((sUrl, idx) => {
                const sEntry = findSliceAiEntry(studyAiReport, idx, sUrl);
                const sEffCls = sEntry?.doctorOverride?.correctedClass || sEntry?.class_name || null;
                const sHasTumor = Boolean(sEffCls && sEffCls !== 'notumor');
                const sEdited = Boolean(sEntry?.doctorOverride?.correctedClass || sEntry?.doctorOverride?.correctedBoundingBox);
                const isActive = idx === activeSliceIdx;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSelectSlice(idx)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 6,
                      backgroundColor: isActive ? '#1E3A8A' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isActive ? '#1E3A8A' : (sEdited ? '#F59E0B' : (sHasTumor ? '#FCA5A5' : '#CBD5E1')),
                    }}
                  >
                    {(sHasTumor || sEdited) && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sEdited ? '#F59E0B' : '#EF4444' }} />
                    )}
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#FFFFFF' : '#1E293B' }}>
                      Lát #{idx + 1}{sEntry?.seriesName ? ` • ${sEntry.seriesName}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {phase === 'analyzing' ? (
          // ── LOADING / ANALYZING STATE ──
          <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
            <View style={[isDesktop && styles.desktopRow]}>
              {/* Left col: brain scan visualization */}
              <View style={[isDesktop ? styles.leftCol : styles.fullWidth]}>
                <View style={styles.imgCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <Scan size={16} color={Colors.brandGreen} strokeWidth={2.2} />
                    <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600' }}>Phim chụp MRI đang phân tích</Text>
                  </View>
                  <View style={styles.scanPreviewBox}>
                    {currentSliceUrl ? (
                      <Image source={{ uri: imageFullUri }} style={styles.scanPreviewImg} resizeMode="contain" />
                    ) : (
                      <Text style={{ color: '#64748B' }}>Không có ảnh</Text>
                    )}
                    <View style={styles.scanOverlay} pointerEvents="none">
                      <Animated.View
                        style={[
                          styles.scanLine,
                          {
                            transform: [{ translateY }],
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Right col: steps loading status */}
              <View style={[isDesktop ? styles.rightCol : styles.fullWidth]}>
                <View style={styles.actionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <ActivityIndicator size="small" color={Colors.brandGreen} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>
                      Đang xử lý phim chụp...
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 20 }}>
                    {isPatient
                      ? 'AI đang đọc ảnh MRI của bạn, thường mất dưới 1 phút. Vui lòng không đóng trang.'
                      : 'Hệ thống AI tích hợp (Ensemble ResNet + EfficientNet + DenseNet + YOLOv8 + Gemini VLM) đang chạy phân tích song song và sinh bản đồ kích hoạt nhiệt Grad-CAM.'}
                  </Text>

                  <View style={{ gap: 6 }}>
                    {steps.map((step, i) => {
                      const isCompleted = i < currentStep;
                      const isCurrent = i === currentStep;
                      const isPending = i > currentStep;

                      return (
                        <View
                          key={i}
                          style={[
                            styles.stepItem,
                            isCurrent && styles.stepItemActive,
                            isCompleted && styles.stepItemCompleted
                          ]}
                        >
                          <View style={styles.stepStatusIcon}>
                            {isCompleted && <CheckCircle2 size={16} color="#059669" />}
                            {isCurrent && <ActivityIndicator size="small" color={Colors.brandGreen} />}
                            {isPending && <View style={styles.pendingDot} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[
                              styles.stepText,
                              isCurrent && styles.stepTextActive,
                              isCompleted && styles.stepTextCompleted
                            ]}>
                              {step.label}
                            </Text>
                            <Text style={[
                              styles.stepDesc,
                              isCurrent && styles.stepDescActive,
                              isCompleted && styles.stepDescCompleted
                            ]}>
                              {step.desc}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          // ── RESULTS PHASE ──
          <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
            {error ? (
              <View style={styles.errorCard}>
                <AlertTriangle size={36} color="#DC2626" style={{ marginBottom: 8 }} />
                <Text style={styles.errorTitle}>Lỗi kết nối AI</Text>
                <Text style={styles.errorMsg}>{error}</Text>
                <TouchableOpacity style={styles.retryBigBtn} onPress={() => runAnalysis(currentSliceUrl, activeSliceIdx)}>
                  <Text style={styles.retryBigBtnText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={[isDesktop && styles.desktopRow, !isDesktop && isPatient && styles.resultFirst, { opacity: fadeAnim, flex: 1, width: '100%' }]}>
                {/* ── LEFT: Images ─────────────────────────────────────────── */}
                <View style={[isDesktop ? styles.leftCol : styles.fullWidth]}>
                  {/* Original image + ROI/AI bounding box overlay */}
                  <View style={styles.imgCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Scan size={16} color={Colors.brandGreen} strokeWidth={2.2} />
                        <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600' }}>Ảnh gốc MRI (Lát #{activeSliceIdx + 1})</Text>
                      </View>
                      {toNormalizedRoiBox(
                        effectiveDisplayClass !== 'notumor'
                          ? (aiResult?.doctorOverride?.correctedBoundingBox || aiResult?.bounding_box)
                          : null
                      ) && (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: aiResult?.doctorOverride ? '#D97706' : '#0EA5E9' }}>
                          {aiResult?.doctorOverride ? 'Khung BS hiệu chỉnh' : 'Khung ROI AI'}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[styles.imgViewer, { position: 'relative' }]}
                      onLayout={(e) => {
                        const { width: w, height: h } = e.nativeEvent.layout;
                        if (w > 0 && h > 0) setOrigViewerLayout({ width: w, height: h });
                      }}
                    >
                      {currentSliceUrl ? (() => {
                        const origBox = effectiveDisplayClass !== 'notumor'
                          ? toNormalizedRoiBox(aiResult?.doctorOverride?.correctedBoundingBox || aiResult?.bounding_box)
                          : null;
                        const isOverridden = Boolean(aiResult?.doctorOverride?.correctedBoundingBox || aiResult?.doctorOverride?.correctedClass);
                        const boxRect = computeContainedRect(
                          origViewerLayout.width,
                          origViewerLayout.height,
                          origImageNatural.width,
                          origImageNatural.height
                        );
                        return (
                          <View style={{ width: '100%', height: '100%', position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
                            <Image
                              source={{ uri: imageFullUri }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="contain"
                              onLoad={(e) => {
                                const w = e?.nativeEvent?.source?.width;
                                const h = e?.nativeEvent?.source?.height;
                                if (w > 0 && h > 0) setOrigImageNatural({ width: w, height: h });
                              }}
                            />
                            {origBox && (
                              <View pointerEvents="none" style={{ position: 'absolute', ...boxRect }}>
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: `${(origBox.x * 100).toFixed(1)}%`,
                                    top: `${(origBox.y * 100).toFixed(1)}%`,
                                    width: `${(origBox.w * 100).toFixed(1)}%`,
                                    height: `${(origBox.h * 100).toFixed(1)}%`,
                                    borderWidth: 2,
                                    borderColor: isOverridden ? '#F59E0B' : '#38BDF8',
                                    backgroundColor: isOverridden ? 'rgba(245,158,11,0.14)' : 'rgba(56,189,248,0.14)',
                                    borderRadius: 4,
                                  }}
                                >
                                  <View style={{ alignSelf: 'flex-start', backgroundColor: isOverridden ? '#D97706' : '#0284C7', paddingHorizontal: 5, paddingVertical: 1, borderBottomRightRadius: 4 }}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                                      {isOverridden ? 'BS: ' : 'AI: '}{(effectiveDisplayClass || 'TUMOR').toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })() : (
                        <Text style={{ color: '#94A3B8' }}>Không có ảnh</Text>
                      )}
                    </View>
                  </View>

                  {/* Annotated image (Heatmap / GradCAM) */}
                  {annotatedUri && (
                    <View style={styles.imgCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <Layers size={16} color={Colors.brandGreen} strokeWidth={2.2} />
                        <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600' }}>{isPatient ? 'Vùng AI chú ý trên ảnh' : 'Bản đồ nhiệt kích hoạt (Grad-CAM + YOLO)'}</Text>
                      </View>
                      <View style={styles.imgViewer}>
                        <Image source={{ uri: annotatedUri }} style={styles.imgFull} resizeMode="contain" />
                      </View>
                    </View>
                  )}
                </View>

                {/* ── RIGHT: Result + Actions ───────────────────────────────── */}
                <View style={[isDesktop ? styles.rightCol : styles.fullWidth]}>
                  {isPatient && aiResult ? (
                    <AiResultPatientCard result={aiResult} navigation={navigation} />
                  ) : (
                  <>
                  {/* Main result card */}
                  {meta && (() => {
                    const MetaIcon = meta.icon;
                    return (
                      <View style={[styles.resultCard, { borderColor: meta.border, backgroundColor: meta.bg }]}>
                        <View style={styles.resultCardHeader}>
                          <View style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: meta.color + '18',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            <MetaIcon size={24} color={meta.color} strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.resultLabel, { color: meta.color }]}>
                              {meta.label}
                            </Text>
                            <Text style={styles.resultDesc}>{meta.desc}</Text>
                          </View>
                        </View>

                        {/* Confidence gauge */}
                        <View style={styles.confRow}>
                          <Text style={styles.confLabel}>
                            Độ tự tin: <Text style={[styles.confValue, { color: meta.color }]}>{aiResult.confidence}%</Text>
                          </Text>
                        </View>
                        <ConfidenceBar value={aiResult.confidence} color={meta.color} />

                        {/* All probabilities */}
                        {aiResult.all_probabilities && (
                          <View style={styles.allProbBox}>
                            <Text style={styles.allProbTitle}>Phân phối xác suất Ensemble:</Text>
                            {Object.entries(aiResult.all_probabilities).map(([cls, pct]) => {
                              const m = CLASS_META[cls] || CLASS_META.notumor;
                              const ItemIcon = m.icon;
                              return (
                                <View key={cls} style={styles.probRow}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', width: 130, gap: 6 }}>
                                    <ItemIcon size={13} color={m.color} strokeWidth={2.2} />
                                    <Text style={styles.probCls}>{m.label}</Text>
                                  </View>
                                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                                    <ConfidenceBar value={pct} color={m.color} />
                                  </View>
                                  <Text style={[styles.probPct, { color: m.color }]}>{pct}%</Text>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* Consensus message */}
                        {aiResult.consensus_message ? (
                          <View style={styles.consensusBox}>
                            <Text style={styles.consensusTitle}>Đồng thuận mô hình:</Text>
                            <FormattedConsensusMessage message={aiResult.consensus_message} />
                          </View>
                        ) : null}

                        <View style={styles.disclaimer}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={14} color="#D97706" />
                            <Text style={styles.disclaimerText}>
                              Kết quả AI mang tính chất hỗ trợ quyết định lâm sàng, không thay thế chẩn đoán sau cùng của bác sĩ.
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* ── CONFIRM CORRECT ──────────────────────────────────────── */}
                  {canReview && (
                  <View style={styles.actionCard}>
                    <Text style={styles.actionTitle}>Bác sĩ xác nhận kết quả:</Text>

                    <TouchableOpacity
                      style={[styles.confirmBtn, approvingAI && styles.btnDisabled]}
                      onPress={handleConfirmCorrect}
                      disabled={approvingAI}
                    >
                      {approvingAI ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                          }}>
                            <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.confirmBtnTitle}>AI đúng — Xác nhận gợi ý & Điền kết quả</Text>
                            <Text style={styles.confirmBtnSub}>Điền sẵn hình ảnh lát cắt, heatmap và kết luận vào hồ sơ</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.orDivider}>
                      <View style={styles.orLine} />
                      <Text style={styles.orText}>HOẶC</Text>
                      <View style={styles.orLine} />
                    </View>

                    {/* Wrong → feedback */}
                    <Text style={styles.feedbackTitle}>AI sai — Chọn chẩn đoán đúng của Bác sĩ:</Text>
                    <View style={styles.classGrid}>
                      {Object.entries(CLASS_META).map(([cls, m]) => {
                        const ChipIcon = m.icon;
                        const isSelected = selectedCorrectClass === cls;
                        return (
                          <TouchableOpacity
                            key={cls}
                            style={[
                              styles.classChip,
                              isSelected && { backgroundColor: m.color, borderColor: m.color },
                            ]}
                            onPress={() => {
                              setSelectedCorrectClass(cls);
                              setFeedbackError('');
                              if (cls === 'notumor') {
                                setFeedbackRoi({ x: 0, y: 0, w: 0, h: 0, normalizedBox: null });
                              }
                            }}
                          >
                            <ChipIcon size={13} color={isSelected ? '#FFFFFF' : m.color} strokeWidth={2.2} />
                            <Text style={[styles.classChipText, isSelected && { color: '#fff' }]}>
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Interactive ROI Bounding Box Drawer */}
                    {selectedCorrectClass && selectedCorrectClass !== 'notumor' && (
                      <View style={{ marginTop: 12, marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>
                          Khoanh vùng tổn thương u trên lát #{activeSliceIdx + 1} (Kéo thả chuột hoặc bấm "Về AI"):
                        </Text>
                        <InteractiveRoiDrawer
                          imageUrl={imageFullUri}
                          normalizedInitialBox={toNormalizedRoiBox(
                            aiResult?.doctorOverride?.correctedBoundingBox ||
                              (aiResult?.class_name !== 'notumor' ? aiResult?.bounding_box : null)
                          )}
                          aiNormalizedBox={toNormalizedRoiBox(
                            aiResult?.class_name !== 'notumor' ? aiResult?.bounding_box : null
                          )}
                          onBoxChange={(box) => setFeedbackRoi(box)}
                          disabled={selectedCorrectClass === 'notumor'}
                          containerHeight={280}
                        />
                      </View>
                    )}

                    {/* Optional physician note */}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 4 }}>
                      Ghi chú hiệu chỉnh của bác sĩ (tùy chọn):
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 13,
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        marginBottom: 10,
                      }}
                      placeholder="Ví dụ: Tổn thương thực tế ở vùng thái dương trái, AI định vị lệch..."
                      value={feedbackNote}
                      onChangeText={setFeedbackNote}
                      multiline
                    />

                    {Boolean(feedbackError) && (
                      <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '600' }}>{feedbackError}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.wrongBtn, (sendingFeedback || !selectedCorrectClass) && styles.btnDisabled]}
                      onPress={handleConfirmWrong}
                      disabled={sendingFeedback || !selectedCorrectClass}
                    >
                      {sendingFeedback ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                          }}>
                            <Edit3 size={18} color="#FFFFFF" strokeWidth={2.4} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.wrongBtnTitle}>Gửi hiệu chỉnh & Cập nhật chẩn đoán</Text>
                            <Text style={styles.wrongBtnSub}>Lưu ghi chú bác sĩ và gửi phản hồi huấn luyện AI</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  )}

                  {isTechnician && !canReview && (
                    <View style={styles.actionCard}>
                      <Text style={styles.actionTitle}>Chế độ xem của Kỹ thuật viên</Text>
                      <Text style={{ fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 14 }}>
                        Bạn đang xem ảnh chụp và kết quả AI trả về. Việc xác nhận hoặc hiệu chỉnh kết quả thuộc thẩm quyền Bác sĩ.
                      </Text>
                      <TouchableOpacity
                        style={[styles.confirmBtn, { justifyContent: 'center', paddingVertical: 14 }]}
                        onPress={() => navigation.goBack()}
                      >
                        <ArrowLeft size={18} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.confirmBtnTitle}>Hoàn tất xem & Quay lại ca chụp</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  </>
                  )}
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};



export default AIAnalysisScreen;
