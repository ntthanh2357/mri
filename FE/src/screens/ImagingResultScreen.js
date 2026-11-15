import { PAPER_BLANK, SHORT_BLANK } from '../utils/paperFields';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
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
  Linking,
} from 'react-native';
import { get, post, put } from '../services/api.service';
import Config from '../constants/config';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { CheckCircle2, Edit3, X, Activity, Scan, ArrowLeft, Download, ShieldCheck, QrCode, FileText, ZoomIn, Save, AlertTriangle, Brain } from 'lucide-react';
import DigitalSignatureBadge from '../components/DigitalSignatureBadge';
import ClinicalDisclaimerBanner from '../components/ClinicalDisclaimerBanner';
import FormattedConsensusMessage from '../components/FormattedConsensusMessage';
import InteractiveRoiDrawer from '../components/InteractiveRoiDrawer';
import AiResultPatientCard from '../components/patient/AiResultPatientCard';
import DicomWebViewer from '../components/DicomWebViewer';
import styles from './ImagingResultScreen.styles';
import PressableScale from '../components/PressableScale';
import FadeIn from '../components/FadeIn';
import SimpleMarkdownText from '../components/SimpleMarkdownText';
import Colors from '../constants/colors';
import { useLoop } from '../controllers/useMotion';

const stripUrlQuery = (u) => String(u || '').split(/[?#]/)[0];

const toNormalizedRoiBox = (box) => {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w !== undefined ? box.w : box.width);
  const h = Number(box.h !== undefined ? box.h : box.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 1 || h > 1) return null;
  return { x, y, w, h };
};

const ImagingResultScreen = ({ route, navigation }) => {
  const resultId = route.params?.resultId || route.params?.imagingResultId;
  const visitId = route.params?.visitId;
  const activeRoute = route.params?.activeRoute || 'ImagingHistory';
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const dots = useLoop(1200);

  // Doctor / Radiologist Report Editing States
  const [localUser, setLocalUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const isTechnician = localUser?.role === 'technician';
  const canReviewAI = ['doctor', 'radiologist', 'department_head', 'admin'].includes(localUser?.role);
  const canViewStaffAi = canReviewAI || isTechnician;
  // Máy chủ quyết định ai được ký: Bác sĩ CĐHA, Trưởng khoa đã được cấp quyền, hoặc bác sĩ chỉ định khi viện không có Bác sĩ CĐHA
  const [signPermission, setSignPermission] = useState(null);
  const [actingReason, setActingReason] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [peerReviewReason, setPeerReviewReason] = useState('');
  const [requestingPeerReview, setRequestingPeerReview] = useState(false);
  const canSignReport = signPermission?.canSign === true;
  const isPhysician = ['doctor', 'radiologist', 'department_head'].includes(localUser?.role);
  const canAcknowledgeReport = ['doctor', 'department_head'].includes(localUser?.role);
  const [findingsText, setFindingsText] = useState('');
  const [conclusionText, setConclusionText] = useState('');
  const [completingVisit, setCompletingVisit] = useState(false);

  // Structured Brain Tumor Report + RANO + Critical Finding + Addendum States
  const [structuredReport, setStructuredReport] = useState({
    hemisphere: 'right',
    lobe: 'frontal',
    axialLocation: 'intra_axial',
    measurements: { d1Mm: 32, d2Mm: 26, d3Mm: 24, crossProductMm2: 832, sliceIndex: 1, seriesType: 'T1C+' },
    enhancement: 'ring_enhancing',
    peritumoralEdema: 'moderate',
    necrosis: false,
    hemorrhage: false,
    midlineShiftMm: 0,
    herniation: 'none',
    hydrocephalus: false,
    rano: { priorCrossProductMm2: null, changePercent: null, category: 'N/A', isPseudoprogressionSuspected: false }
  });
  const [aiAgreementStatus, setAiAgreementStatus] = useState('agreed');
  const [isCriticalFlag, setIsCriticalFlag] = useState(false);
  const [criticalReason, setCriticalReason] = useState('');
  const [acknowledgingCritical, setAcknowledgingCritical] = useState(false);
  const [addendumContent, setAddendumContent] = useState('');
  const [addendumReason, setAddendumReason] = useState('');
  const [submittingAddendum, setSubmittingAddendum] = useState(false);

  // AI Analysis States
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [correctClass, setCorrectClass] = useState('notumor');
  const [coordX, setCoordX] = useState('0');
  const [coordY, setCoordY] = useState('0');
  const [coordW, setCoordW] = useState('0');
  const [coordH, setCoordH] = useState('0');
  const [normalizedRoiBox, setNormalizedRoiBox] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [activeSliceIndex, setActiveSliceIndex] = useState(0);
  const [activeSliceMeta, setActiveSliceMeta] = useState({ sliceIndex: 0, imageUrl: '', seriesName: '', overlay: null });
  const [manifestRefreshKey, setManifestRefreshKey] = useState(0);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [approvingAI, setApprovingAI] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const feedbackSectionRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Extra images (e.g. heatmap from AI analysis)
  const [extraImages, setExtraImages] = useState([]);
  const activeAiReport = aiResult || result?.aiReport;

  const displayGalleryImages = useMemo(
    () => Array.from(new Set([...(result?.images || []), ...extraImages].filter(Boolean))),
    [result?.images, extraImages]
  );

  const activeSliceImageUrl = useMemo(() => {
    if (activeSliceMeta?.imageUrl) return activeSliceMeta.imageUrl;
    if (Array.isArray(result?.images) && result.images.length > 0) {
      return result.images[Math.min(activeSliceIndex, result.images.length - 1)] || result.images[0];
    }
    if (displayGalleryImages.length > 0) {
      return displayGalleryImages[Math.min(activeSliceIndex, displayGalleryImages.length - 1)] || displayGalleryImages[0];
    }
    return '';
  }, [activeSliceMeta?.imageUrl, result?.images, displayGalleryImages, activeSliceIndex]);

  const activeSliceReport = useMemo(() => {
    const slices = activeAiReport?.sliceResults;
    const targetStripped = stripUrlQuery(activeSliceImageUrl);
    let matched = null;
    if (Array.isArray(slices) && slices.length > 0) {
      matched =
        (targetStripped && slices.find((s) => stripUrlQuery(s.imageUrl) === targetStripped)) ||
        slices.find((s) => s.sliceIndex === activeSliceIndex) ||
        null;
    }
    if (matched) {
      const ov = matched.doctorOverride;
      const effectiveClass = ov?.correctedClass || matched.class_name || 'notumor';
      const effectiveBox =
        effectiveClass === 'notumor'
          ? null
          : ov?.correctedBoundingBox || (ov?.correctedClass ? null : matched.bounding_box) || null;
      return {
        ...matched,
        effectiveClass,
        effectiveBox,
        aiOriginalBox: matched.class_name === 'notumor' ? null : matched.bounding_box || null,
        isDoctorEdited: Boolean(ov?.correctedClass || ov?.correctedBoundingBox),
      };
    }
    if (activeSliceMeta?.overlay) {
      const o = activeSliceMeta.overlay;
      return {
        sliceIndex: o.sliceIndex ?? activeSliceIndex,
        imageUrl: o.imageUrl,
        seriesName: o.seriesName,
        class_name: o.aiClassName || o.className || 'notumor',
        confidence: o.confidence ?? 0,
        bounding_box: o.aiBoundingBox || o.boundingBox || null,
        tumor_location: o.tumorLocation || null,
        heatmapStreamUrl: o.heatmapStreamUrl || null,
        consensus_message: o.consensusMessage || null,
        doctorOverride: o.doctorOverride || null,
        effectiveClass: o.className || 'notumor',
        effectiveBox: o.className === 'notumor' ? null : o.boundingBox || null,
        aiOriginalBox: o.aiClassName === 'notumor' ? null : o.aiBoundingBox || null,
        isDoctorEdited: Boolean(o.isDoctorEdited),
      };
    }
    if (activeAiReport && activeSliceIndex === 0) {
      const ov = activeAiReport.sliceResults?.[0]?.doctorOverride || null;
      const effCls = ov?.correctedClass || activeAiReport.class_name || 'notumor';
      const effBox =
        effCls === 'notumor'
          ? null
          : ov?.correctedBoundingBox || activeAiReport.bounding_box || null;
      return {
        ...activeAiReport,
        effectiveClass: effCls,
        effectiveBox: effBox,
        aiOriginalBox: activeAiReport.class_name === 'notumor' ? null : activeAiReport.bounding_box || null,
        isDoctorEdited: Boolean(ov?.correctedClass || ov?.correctedBoundingBox),
        doctorOverride: ov,
      };
    }
    return null;
  }, [activeAiReport, activeSliceImageUrl, activeSliceIndex, activeSliceMeta?.overlay]);

  const syncFeedbackDraftFromSlice = (sliceReport) => {
    const cls = sliceReport?.effectiveClass || sliceReport?.class_name || 'notumor';
    setCorrectClass(cls);
    const normBox = cls === 'notumor' ? null : toNormalizedRoiBox(sliceReport?.effectiveBox || sliceReport?.bounding_box);
    setNormalizedRoiBox(normBox);
    setFeedbackNote(sliceReport?.doctorOverride?.note || '');
    if (cls === 'notumor') {
      setCoordX('0');
      setCoordY('0');
      setCoordW('0');
      setCoordH('0');
    } else if (sliceReport?.tumor_location && Number(sliceReport.tumor_location.width || sliceReport.tumor_location.w) > 0) {
      setCoordX(String(Math.round(sliceReport.tumor_location.x || 0)));
      setCoordY(String(Math.round(sliceReport.tumor_location.y || 0)));
      setCoordW(String(Math.round(sliceReport.tumor_location.width || sliceReport.tumor_location.w || 0)));
      setCoordH(String(Math.round(sliceReport.tumor_location.height || sliceReport.tumor_location.h || 0)));
    } else {
      setCoordX('0');
      setCoordY('0');
      setCoordW('0');
      setCoordH('0');
    }
  };

  // Patient B2C PDF state
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!resultId) return;
    setDownloadingPdf(true);
    try {
      const res = await get(`/api/v1/patient-b2c/imaging/${resultId}/report-pdf`);
      // BE trả link ngắn hạn (pdfPath) hoặc file đã lưu sẵn (pdfUrl)
      const url = res?.data?.pdfUrl || (res?.data?.pdfPath ? `${Config.API_URL}${res.data.pdfPath}` : null);
      if (!res?.success || !url) {
        Alert.alert('Chưa tải được báo cáo', res?.message || 'Chưa thể xuất báo cáo PDF lúc này.');
        return;
      }
      if (Platform.OS === 'web') window.open(url, '_blank');
      else await Linking.openURL(url);
    } catch (err) {
      console.error('Lỗi tải PDF:', err);
      Alert.alert('Chưa tải được báo cáo', err?.message || 'Chưa thể xuất báo cáo PDF lúc này. Vui lòng thử lại sau.');
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
      .catch(err => console.log('Error fetching me:', err))
      .finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    // [FIX] Prevent AI re-running: clear visitStatus param after auto-navigate
    if (result && localUser && ['doctor', 'radiologist', 'department_head'].includes(localUser.role) && route.params?.visitStatus === 'chờ kết quả AI' && !hasAutoNavigated.current) {
      if (result.images && result.images.length > 0) {
        hasAutoNavigated.current = true;
        const firstImage = result.images[0];
        const imageUrl = firstImage.startsWith('http') ? firstImage : `${Config.API_URL}${firstImage}`;
        // [FIX] Clear visitStatus param so AI doesn't re-run if screen remounts
        navigation.setParams({ visitStatus: undefined });
        navigation.navigate('AIAnalysis', {
          imageUrl,
          images: result.images,
          sliceIndex: 0,
          aiReportData: result.aiReport || null,
          visitId,
          resultId,
          imagingResultId: resultId,
          activeRoute,
        });
      }
    }
  }, [result, localUser, route.params?.visitStatus]);

  useEffect(() => {
    if (!resultId || !isPhysician) return;
    get(`/api/v1/imaging/${resultId}/sign-permission`)
      .then((res) => setSignPermission(res?.data || null))
      .catch(() => setSignPermission(null));
  }, [resultId, isPhysician]);

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
          if (response.data.structuredReport) {
            setStructuredReport(prev => ({
              ...prev,
              ...response.data.structuredReport,
              measurements: {
                ...prev.measurements,
                ...(response.data.structuredReport.measurements || {})
              },
              rano: {
                ...prev.rano,
                ...(response.data.structuredReport.rano || {})
              }
            }));
          }
          if (response.data.aiAgreement?.status) {
            setAiAgreementStatus(response.data.aiAgreement.status);
          }
          if (response.data.criticalFinding?.isCritical) {
            setIsCriticalFlag(true);
            setCriticalReason(response.data.criticalFinding.reason || '');
          }

          // [FIX] Nạp kết quả AI và ảnh Heatmap / Grad-CAM vào state để bác sĩ xem được ngay
          if (response.data.aiReport) {
            setAiResult(response.data.aiReport);
            setCorrectClass(response.data.aiReport.class_name || 'notumor');
            if (response.data.aiAgreement?.status === 'agreed') {
              setApproveSuccess(true);
            }
          }

          const extra = [];
          const aiHeatmap = response.data.aiReport?.annotated_image || response.data.aiReport?.heatmapStreamUrl || response.data.segmentationUrl;
          if (aiHeatmap && !extra.includes(aiHeatmap)) {
            extra.push(aiHeatmap);
          }
          if (response.data.representativeSliceUrl && !extra.includes(response.data.representativeSliceUrl)) {
            if (!response.data.images?.includes(response.data.representativeSliceUrl)) {
              extra.push(response.data.representativeSliceUrl);
            }
          }
          if (extra.length > 0) {
            setExtraImages(extra);
          }
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
    const targetImg = activeSliceImageUrl || result?.images?.[0];
    if (!targetImg) {
      if (Platform.OS === 'web') alert('Yêu cầu: Không có ảnh phim chụp để phân tích.');
      else Alert.alert('Yêu cầu', 'Không có ảnh phim chụp để phân tích.');
      return;
    }
    if (result?.isSigned) {
      if (Platform.OS === 'web') alert('Báo cáo đã ký số — không thể chạy ghi đè kết quả AI.');
      else Alert.alert('Đã ký số', 'Báo cáo đã ký số — không thể chạy ghi đè kết quả AI.');
      return;
    }

    setAnalyzing(true);
    try {
      const payload = {
        imageUrl: targetImg,
        visitId,
        imagingResultId: resultId || result?._id,
        sliceIndex: activeSliceIndex,
        seriesName: activeSliceMeta?.seriesName || undefined,
      };
      const response = await post('/api/v1/imaging/analyze-ai', payload);

      if (response.success && response.data) {
        try {
          const fresh = await get(`/api/v1/imaging/${resultId}`);
          if (fresh?.success && fresh?.data) {
            setResult(fresh.data);
            if (fresh.data.aiReport) setAiResult(fresh.data.aiReport);
          } else {
            setAiResult((prev) => ({ ...(prev || {}), ...response.data }));
          }
        } catch (_) {
          setAiResult((prev) => ({ ...(prev || {}), ...response.data }));
        }
        setCorrectClass(response.data.class_name || 'notumor');
        setNormalizedRoiBox(toNormalizedRoiBox(response.data.bounding_box));
        setManifestRefreshKey((k) => k + 1);
        const heatmap = response.data.annotated_image || response.data.heatmapStreamUrl || response.data.segmentationUrl;
        if (heatmap) {
          setExtraImages((prev) => Array.from(new Set([...prev, heatmap])));
        }
        if (Platform.OS === 'web') alert(`Phân tích AI lát #${activeSliceIndex + 1} hoàn tất: ${(response.data.class_name?.toUpperCase() || '')}`);
        else Alert.alert('Phân tích AI hoàn tất', `Lát #${activeSliceIndex + 1}: ${(response.data.class_name?.toUpperCase() || '')}`);
      } else {
        if (Platform.OS === 'web') alert('Lỗi phân tích AI: ' + (response.message || 'Không phân tích được ảnh.'));
        else Alert.alert('Lỗi phân tích AI', response.message || 'Không phân tích được ảnh chụp.');
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
    if (result?.isSigned) {
      if (Platform.OS === 'web') alert('Báo cáo đã ký số — không thể chỉnh sửa kết quả AI.');
      else Alert.alert('Đã ký số', 'Báo cáo đã ký số — không thể chỉnh sửa kết quả AI.');
      return;
    }
    const targetImg = activeSliceImageUrl || result?.images?.[0] || '';
    if (!targetImg) return;

    setSendingFeedback(true);
    try {
      const payload = {
        imageUrl: targetImg,
        imagingResultId: resultId || result?._id,
        sliceIndex: activeSliceIndex,
        correct_class: correctClass,
        x: correctClass === 'notumor' ? 0 : (parseInt(coordX, 10) || 0),
        y: correctClass === 'notumor' ? 0 : (parseInt(coordY, 10) || 0),
        w: correctClass === 'notumor' ? 0 : (parseInt(coordW, 10) || 0),
        h: correctClass === 'notumor' ? 0 : (parseInt(coordH, 10) || 0),
        normalizedBox: correctClass === 'notumor' ? null : normalizedRoiBox,
        note: feedbackNote.trim() || undefined,
        agreementStatus: 'modified',
      };

      const response = await post('/api/v1/imaging/feedback-ai', payload);
      if (response.success) {
        const nextStatus = response.data?.aiAgreement?.status || 'modified';
        setAiAgreementStatus(nextStatus);
        setApproveSuccess(false);
        if (response.data?.updatedAiReport) {
          setResult((prev) => (prev ? { ...prev, aiReport: response.data.updatedAiReport, aiAgreement: response.data.aiAgreement || prev.aiAgreement } : prev));
          setAiResult(response.data.updatedAiReport);
        }
        setManifestRefreshKey((k) => k + 1);
        if (Platform.OS === 'web') alert(`Đã lưu hiệu chỉnh AI cho lát #${activeSliceIndex + 1}.`);
        else Alert.alert('Đóng góp thành công', `Đã lưu hiệu chỉnh AI cho lát #${activeSliceIndex + 1}.`);
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
    const report = activeSliceReport || activeAiReport;
    if (!report) return;
    setApprovingAI(true);
    setApproveSuccess(false);
    try {
      const imageUrl = activeSliceImageUrl || result?.images?.[0] || '';
      const filename = imageUrl.split('?')[0].split('/').pop() || 'scan.jpg';
      const payload = {
        filename,
        predicted_class: report.effectiveClass || report.class_name,
        confidence: report.confidence ?? 0,
      };
      const response = await post('/api/v1/imaging/approve-ai', payload);
      if (response.success) {
        setApproveSuccess(true);
        setAiAgreementStatus('agreed');
        if (Platform.OS === 'web') alert(`Đã ghi nhận kết quả AI (${(payload.predicted_class || '').toUpperCase()}) là ĐÚNG.`);
        else Alert.alert('Xác nhận thành công', `Đã ghi nhận kết quả AI (${(payload.predicted_class || '').toUpperCase()}) là ĐÚNG.`);
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
    if (signPermission?.requiresReason && actingReason.trim().length < 10) {
      const msg = 'Trưởng khoa ký thay Bác sĩ CĐHA phải ghi rõ lý do, tối thiểu 10 ký tự.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Thông báo', msg);
      return;
    }

    setCompletingVisit(true);
    try {
      const docName = localUser?.profile?.fullName || localUser?.profile?.name || localUser?.email || 'Bác sĩ chuyên khoa';
      const updatedImages = Array.from(new Set([...result.images, ...extraImages]));
      const updateRes = await put(`/api/v1/imaging/${resultId}`, {
        findings: findingsText.trim(),
        conclusion: conclusionText.trim(),
        actingRadiologistReason: signPermission?.requiresReason ? actingReason.trim() : undefined,
        radiologist: docName,
        images: updatedImages,
        structuredReport,
        aiAgreement: { status: aiAgreementStatus },
        criticalFinding: {
          isCritical: isCriticalFlag || Number(structuredReport.midlineShiftMm) >= 5 || structuredReport.herniation !== 'none',
          reason: criticalReason
        }
      });
      if (updateRes?.data) {
        setResult(updateRes.data);
      }

      if (visitId) {
        const isPdOrCritical = updateRes?.data?.structuredReport?.rano?.category === 'PD' || updateRes?.data?.criticalFinding?.isCritical || route.params?.visitStatus === 'chờ hội chẩn';
        const nextVisitStatus = isPdOrCritical ? 'chờ hội chẩn' : 'chờ bác sĩ đọc';
        try { await put(`/api/v1/visits/${visitId}/status`, { status: nextVisitStatus }); } catch (_) {}
      }

      if (Platform.OS === 'web') {
        alert('Đã ký số báo cáo CĐHA có cấu trúc (kèm RANO) và hoàn tất ca đọc phim.');
        navigation.navigate('DoctorWorkQueue', { refresh: Date.now() });
      } else {
        Alert.alert('Thành công', 'Đã ký số báo cáo CĐHA có cấu trúc và hoàn tất ca khám.', [
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

  const handleAcknowledgeCritical = async () => {
    if (!resultId) return;
    setAcknowledgingCritical(true);
    try {
      const res = await post(`/api/v1/imaging/${resultId}/acknowledge-critical`, {});
      if (res?.success && res?.data) {
        setResult(res.data);
        if (Platform.OS === 'web') alert('Đã xác nhận tiếp nhận Cảnh báo Đỏ CĐHA (Critical Finding).');
      }
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi xác nhận cảnh báo: ' + (err.message || ''));
    } finally {
      setAcknowledgingCritical(false);
    }
  };

  const handleAcknowledgeReport = async () => {
    setAcknowledging(true);
    try {
      const res = await post(`/api/v1/imaging/${resultId}/acknowledge`, {});
      if (res?.data) setResult(res.data);
      if (Platform.OS === 'web') alert('Đã xác nhận đã đọc báo cáo CĐHA.');
      else Alert.alert('Thành công', 'Đã xác nhận đã đọc báo cáo CĐHA.');
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi xác nhận: ' + (err.message || ''));
      else Alert.alert('Lỗi', err.message || 'Không xác nhận được.');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleRequestPeerReview = async () => {
    setRequestingPeerReview(true);
    try {
      const res = await post('/api/v1/peer-reviews', {
        imagingResultId: resultId,
        visitId: visitId || result?.visitId,
        requestType: 'manual',
        conflictReason: peerReviewReason.trim() || 'Bác sĩ yêu cầu đọc lần 2',
      });
      setPeerReviewReason('');
      const msg = res?.data?.warning || 'Đã gửi yêu cầu bình duyệt lần 2.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Thành công', msg);
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi: ' + (err.message || ''));
      else Alert.alert('Lỗi', err.message || 'Không gửi được yêu cầu.');
    } finally {
      setRequestingPeerReview(false);
    }
  };

  const handleCreateAddendum = async () => {
    if (!addendumContent.trim()) {
      if (Platform.OS === 'web') alert('Vui lòng nhập nội dung bản bổ sung / đính chính (Addendum).');
      return;
    }
    setSubmittingAddendum(true);
    try {
      const addendumPath = localUser?.role === 'radiologist' ? 'addendum' : 'clinical-addendum';
      const res = await post(`/api/v1/imaging/${resultId}/${addendumPath}`, {
        content: addendumContent.trim(),
        reason: addendumReason.trim() || 'Bổ sung nhận định chuyên môn sau hội chẩn'
      });
      if (res?.success && res?.data) {
        setResult(res.data);
        setAddendumContent('');
        setAddendumReason('');
        if (Platform.OS === 'web') alert('Đã phát hành bản bổ sung (Addendum) thành công.');
      }
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi tạo Addendum: ' + (err.message || ''));
    } finally {
      setSubmittingAddendum(false);
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

  if (loading || userLoading) {
    return (
      <ResponsiveLayout navigation={navigation} activeRoute={activeRoute}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.loadingText}>Đang tải chi tiết kết quả...</Text>
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
          <PressableScale style={styles.backArrowBtn} hoverStyle={styles.backArrowBtnHover} onPress={() => navigation.goBack()} accessibilityLabel="Quay lại">
            <ArrowLeft size={16} color={Colors.brandNavy} />
            <Text style={styles.backArrowText}>Quay lại</Text>
          </PressableScale>
          <View style={[styles.badge, isMRI ? styles.mriBadge : styles.ctBadge]}>
            <Text style={[styles.badgeText, isMRI ? styles.mriBadgeText : styles.ctBadgeText]}>
              PHIM {result.imagingType}
            </Text>
          </View>
        </View>

        <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
          <FadeIn style={styles.reportSheet}>
            {isTechnician ? (
              <View>
                <Text style={[styles.sheetTitle, { marginTop: 4, marginBottom: 16 }]}>
                  {`ẢNH CHỤP ${result.imagingType} & KẾT QUẢ AI TRẢ VỀ`}
                </Text>

                <View style={styles.patientGrid}>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.fieldLabel}>Họ và tên bệnh nhân:</Text>
                      <Text style={styles.fieldValBold}>{result.patientName}</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.fieldLabel}>Mã y tế:</Text>
                      <Text style={styles.fieldValBold}>{result.medicalId}</Text>
                    </View>
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.fieldLabel}>Dịch vụ / Kỹ thuật:</Text>
                      <Text style={styles.fieldValBold}>{result.procedure || result.imagingType}</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.fieldLabel}>Thời gian:</Text>
                      <Text style={styles.fieldVal}>{formatDate(result.orderDate || result.reportDate)}</Text>
                    </View>
                  </View>

                  {Boolean(result.technique) && (
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Kỹ thuật thực hiện:</Text>
                        <Text style={styles.fieldVal}>{result.technique}</Text>
                      </View>
                    </View>
                  )}

                  {Boolean(result.dicomZipUrl) && (
                    <View style={{ marginTop: 4, alignItems: 'flex-start' }}>
                      <PressableScale
                        style={styles.actionSecondary}
                        hoverStyle={styles.actionSecondaryHover}
                        onPress={() => {
                          const fullUrl = getImageUrl(result.dicomZipUrl);
                          if (Platform.OS === 'web') {
                            window.open(fullUrl, '_blank');
                          } else {
                            Alert.alert('Tải phim DICOM', `Mở liên kết tải: ${fullUrl}`);
                          }
                        }}
                      >
                        <Download size={15} color={Colors.brandGreen} />
                        <Text style={styles.actionSecondaryText}>
                          Tải trọn bộ phim DICOM (.zip){result.dicomZipSize ? ` (${(result.dicomZipSize / (1024 * 1024)).toFixed(1)} MB)` : ''}
                        </Text>
                      </PressableScale>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <>
                {!result.isSigned ? (
                  <Text style={styles.actionHint}>Báo cáo PDF sẽ tải được sau khi bác sĩ ký kết quả.</Text>
                ) : null}
                <View style={styles.actionBar}>
                  <PressableScale style={[styles.actionPrimary, !result.isSigned && styles.actionDisabled]} hoverStyle={styles.actionPrimaryHover} onPress={handleDownloadPdf} disabled={downloadingPdf || !result.isSigned} accessibilityHint={result.isSigned ? undefined : 'Báo cáo PDF có sau khi bác sĩ ký kết quả'}>
                    {downloadingPdf ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <FileText size={15} color="#FFFFFF" />
                        <Text style={styles.actionPrimaryText}>Tải báo cáo PDF</Text>
                      </>
                    )}
                  </PressableScale>

                  {/* UC-PAT-09: chia sẻ cả bệnh án (kèm phim) qua mã QR 5 phút */}
                  {localUser?.role === 'patient' && (
                    <PressableScale style={styles.actionSecondary} hoverStyle={styles.actionSecondaryHover} onPress={() => navigation.navigate('RecordShare')}>
                      <QrCode size={15} color={Colors.brandGreen} />
                      <Text style={styles.actionSecondaryText}>Chia sẻ bệnh án qua QR</Text>
                    </PressableScale>
                  )}

                  {Boolean(result.dicomZipUrl) && (
                    <PressableScale
                      style={styles.actionSecondary}
                      hoverStyle={styles.actionSecondaryHover}
                      onPress={() => {
                        const fullUrl = getImageUrl(result.dicomZipUrl);
                        if (Platform.OS === 'web') {
                          window.open(fullUrl, '_blank');
                        } else {
                          Alert.alert('Tải phim DICOM', `Mở liên kết tải: ${fullUrl}`);
                        }
                      }}
                    >
                      <Download size={15} color={Colors.brandGreen} />
                      <Text style={styles.actionSecondaryText}>
                        Tải trọn bộ phim DICOM (.zip){result.dicomZipSize ? ` (${(result.dicomZipSize / (1024 * 1024)).toFixed(1)} MB)` : ''}
                      </Text>
                    </PressableScale>
                  )}
                </View>

                <View style={styles.hospitalHeader}>
                  <View style={styles.hospitalInfo}>
                    <Text style={styles.deptText}>SỞ Y TẾ: {SHORT_BLANK}</Text>
                    <Text style={styles.hospitalName}>CƠ SỞ KCB: {PAPER_BLANK}</Text>
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
                      <Text style={[styles.fieldValBold, { color: result.isSigned ? Colors.brandGreen : '#B45309' }]}>
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
              </>
            )}

            <View style={styles.sectionDivider} />

            {/* 🚨 Cảnh báo Đỏ CĐHA (Critical Finding Banner - ACR Standard) */}
            {!isTechnician && Boolean(result.criticalFinding?.isCritical) && (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 2, borderColor: '#DC2626', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <AlertTriangle size={20} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#991B1B', fontWeight: '800', fontSize: 14 }}>
                        🚨 CẢNH BÁO ĐỎ CĐHA (CRITICAL IMAGING FINDING): {result.criticalFinding.reason}
                      </Text>
                      <Text style={{ color: '#7F1D1D', fontSize: 12, marginTop: 2 }}>
                        {result.criticalFinding.acknowledgedAt
                          ? `Đã xác nhận tiếp nhận bởi ${result.criticalFinding.acknowledgedByName} lúc ${formatDate(result.criticalFinding.acknowledgedAt)}`
                          : 'Chưa được bác sĩ lâm sàng xác nhận! Yêu cầu xử trí chống phù não / hội chẩn Ngoại Thần kinh khẩn cấp.'}
                      </Text>
                    </View>
                  </View>
                  {!result.criticalFinding.acknowledgedAt && isPhysician && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#DC2626', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 }}
                      onPress={handleAcknowledgeCritical}
                      disabled={acknowledgingCritical}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                        {acknowledgingCritical ? 'Đang xác nhận...' : '✓ Xác nhận đã đọc Cảnh báo Đỏ'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* 🖥️ Trình xem Web Mini-PACS DICOM tích hợp (Series Switcher, WW/WL, 2D Caliper RANO, Dual-Viewport) */}
            {Boolean(displayGalleryImages.length > 0 || result.studyId) && (
              <DicomWebViewer
                imagingResultId={result._id || resultId}
                studyId={result.studyId}
                images={result.images && result.images.length > 0 ? result.images : displayGalleryImages}
                extraImages={extraImages}
                aiResult={aiResult || result.aiReport}
                initialMeasurements={structuredReport.measurements}
                canMeasure={canSignReport && !result.isSigned}
                canEditAiRoi={canReviewAI && !result.isSigned}
                manifestRefreshKey={manifestRefreshKey}
                externalSliceIndex={activeSliceIndex}
                onActiveSliceChange={(info) => {
                  const sIdx = info.sliceIndex ?? 0;
                  setActiveSliceIndex(sIdx);
                  setActiveSliceMeta(info);
                  if (sIdx >= 0 && sIdx < displayGalleryImages.length) {
                    setActiveImageIndex(sIdx);
                  }
                }}
                onEditSliceRoi={(info) => {
                  const idx = info?.sliceIndex ?? 0;
                  setActiveSliceIndex(idx);
                  setActiveSliceMeta(info);
                  if (idx >= 0 && idx < displayGalleryImages.length) {
                    setActiveImageIndex(idx);
                  }
                  const slices = activeAiReport?.sliceResults;
                  const targetImg = stripUrlQuery(info?.imageUrl);
                  const found = Array.isArray(slices)
                    ? slices.find((s) => (targetImg && stripUrlQuery(s.imageUrl) === targetImg) || s.sliceIndex === idx)
                    : null;
                  if (found) {
                    const ov = found.doctorOverride;
                    const effCls = ov?.correctedClass || found.class_name || 'notumor';
                    syncFeedbackDraftFromSlice({
                      ...found,
                      effectiveClass: effCls,
                      effectiveBox: effCls === 'notumor' ? null : (ov?.correctedBoundingBox || found.bounding_box || null),
                    });
                  } else if (info?.overlay) {
                    syncFeedbackDraftFromSlice({
                      effectiveClass: info.overlay.className || 'notumor',
                      effectiveBox: info.overlay.className === 'notumor' ? null : info.overlay.boundingBox,
                      tumor_location: info.overlay.tumorLocation,
                      doctorOverride: info.overlay.doctorOverride,
                    });
                  }
                  setShowFeedbackForm(true);
                  setTimeout(() => {
                    if (feedbackSectionRef.current) {
                      if (Platform.OS === 'web' && typeof feedbackSectionRef.current.scrollIntoView === 'function') {
                        feedbackSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      } else if (scrollViewRef.current && typeof feedbackSectionRef.current.measureLayout === 'function') {
                        feedbackSectionRef.current.measureLayout(
                          scrollViewRef.current,
                          (_x, y) => scrollViewRef.current?.scrollTo?.({ y: Math.max(0, y - 16), animated: true }),
                          () => {}
                        );
                      }
                    }
                  }, 80);
                }}
                onApplyMeasurement={(m) => {
                  setStructuredReport((prev) => ({
                    ...prev,
                    measurements: {
                      d1Mm: m.d1Mm,
                      d2Mm: m.d2Mm,
                      d3Mm: m.d3Mm,
                      crossProductMm2: m.crossProductMm2,
                      sliceIndex: m.sliceIndex,
                      seriesType: m.seriesType,
                    },
                    rano: {
                      ...prev.rano,
                      priorCrossProductMm2: m.priorCrossProductMm2,
                      changePercent: m.changePercent,
                      category: m.category,
                      isPseudoprogressionSuspected: m.isPseudoprogressionSuspected,
                    },
                  }));
                  const ranoLine = `[Đo lường Mini-PACS RANO trên chuỗi ${m.seriesType} - Lát #${m.sliceIndex}]: Kích thước hai đường kính vuông góc lớn nhất d₁ × d₂ = ${m.d1Mm} × ${m.d2Mm} mm (Tích diện tích = ${m.crossProductMm2} mm²). Phân류 đáp ứng RANO: ${m.category}${m.changePercent !== null ? ` (${m.changePercent > 0 ? '+' : ''}${m.changePercent}%)` : ''}.`;
                  if (!findingsText.includes('[Đo lường Mini-PACS RANO')) {
                    setFindingsText((prev) => (prev ? `${prev}\n${ranoLine}` : ranoLine));
                  }
                }}
              />
            )}

            {displayGalleryImages.length === 0 && !result.studyId && (
              <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 18, marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                  Chưa có ảnh phim chụp được đính kèm
                </Text>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: isTechnician ? 14 : 0 }}>
                  {isTechnician
                    ? 'Ca chụp này hiện chưa có lát cắt MRI/CT nào được tải lên (đây là bản ghi mẫu chưa nạp ảnh hoặc ảnh chưa đồng bộ). Vui lòng tải phim MRI lên cho bệnh nhân hoặc quay lại danh sách để xem ca đã có ảnh.'
                    : 'Kỹ thuật viên chưa tải ảnh phim chụp lên cho bản ghi này.'}
                </Text>
                {isTechnician && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {!result.isSigned && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#0F766E', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
                        onPress={() => navigation.navigate('CreateImagingResult', {
                          patientInfo: {
                            id: result.medicalId,
                            name: result.patientName,
                            birthYear: result.birthYear,
                            gender: result.gender,
                            address: result.address,
                          },
                          visit: visitId ? {
                            _id: visitId,
                            patientId: {
                              profile: {
                                medicalId: result.medicalId,
                                name: result.patientName,
                                birthYear: result.birthYear,
                                gender: result.gender,
                                address: result.address,
                              },
                            },
                            mriOrder: { region: result.procedure },
                          } : undefined,
                        })}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                          Tải phim MRI / Chọn lọc ảnh (AI)
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
                      onPress={() => navigation.goBack()}
                    >
                      <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>
                        Quay lại hàng đợi
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {displayGalleryImages.length > 0 && (
              <View style={styles.gallerySection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>
                    HÌNH ẢNH PHIM CHỤP ({displayGalleryImages.length} ẢNH)
                  </Text>
                  {['doctor', 'radiologist', 'department_head', 'technician'].includes(localUser?.role) && (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {!result.isSigned && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#0F766E', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, opacity: analyzing ? 0.7 : 1 }}
                          onPress={handleAiAnalysis}
                          disabled={analyzing}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Scan size={14} color="#CCFBF1" />
                            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                              {analyzing ? 'Đang quét...' : `Quét AI lát #${activeSliceIndex + 1}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={{ backgroundColor: '#1E1B4B', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }}
                        onPress={() => navigation.navigate('AIAnalysis', {
                          imageUrl: getImageUrl(activeSliceImageUrl || displayGalleryImages[0]),
                          images: displayGalleryImages,
                          sliceIndex: activeSliceIndex,
                          aiReportData: result.aiReport || aiResult || null,
                          visitId,
                          resultId,
                          imagingResultId: resultId,
                          activeRoute,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Brain size={14} color="#818CF8" />
                          <Text style={{ color: '#818CF8', fontWeight: 'bold', fontSize: 13 }}>
                            {isTechnician ? 'Xem chi tiết AI & Grad-CAM' : 'Phân tích Khối u bằng AI'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {activeAiReport && localUser?.role === 'patient' && (
                  <View style={{ marginBottom: 16 }}>
                    <AiResultPatientCard result={activeAiReport} navigation={navigation} />
                  </View>
                )}

                {activeAiReport && canViewStaffAi && (() => {
                  const sliceDisplay = activeSliceReport || activeAiReport;
                  const sliceClass = sliceDisplay.effectiveClass || sliceDisplay.class_name || 'notumor';
                  const sliceOrigClass = sliceDisplay.class_name || sliceClass;
                  const sliceEdited = Boolean(sliceDisplay.isDoctorEdited);
                  const tumorSliceCount = Array.isArray(activeAiReport.sliceResults)
                    ? activeAiReport.sliceResults.filter((s) => (s.doctorOverride?.correctedClass || s.class_name) !== 'notumor').length
                    : (sliceClass !== 'notumor' ? 1 : 0);

                  return (
                  <View ref={feedbackSectionRef} style={{ backgroundColor: '#EEF2F6', borderLeftWidth: 4, borderLeftColor: sliceEdited ? '#D97706' : '#3B82F6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <ClinicalDisclaimerBanner isDoctor={localUser?.role === 'doctor'} compact={true} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Brain size={16} color="#1E3A8A" />
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1E3A8A' }}>
                          Kết quả AI • Lát cắt #{activeSliceIndex + 1}/{displayGalleryImages.length || 1}
                          {sliceDisplay.seriesName ? ` (${sliceDisplay.seriesName})` : ''}
                        </Text>
                      </View>
                      {sliceEdited && (
                        <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '700' }}>
                            BS đã hiệu chỉnh{sliceOrigClass !== sliceClass ? ` (AI gốc: ${sliceOrigClass.toUpperCase()})` : ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {displayGalleryImages.length > 1 && (
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>
                          Chọn nhanh lát cắt ({tumorSliceCount}/{displayGalleryImages.length} lát có dấu hiệu bất thường):
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {displayGalleryImages.map((imgUrl, idx) => {
                            const sItem = Array.isArray(activeAiReport.sliceResults)
                              ? (activeAiReport.sliceResults.find((s) => stripUrlQuery(s.imageUrl) === stripUrlQuery(imgUrl)) || activeAiReport.sliceResults[idx])
                              : (idx === 0 ? activeAiReport : null);
                            const sEffClass = sItem?.doctorOverride?.correctedClass || sItem?.class_name || null;
                            const sHasTumor = Boolean(sEffClass && sEffClass !== 'notumor');
                            const sEdited = Boolean(sItem?.doctorOverride?.correctedClass || sItem?.doctorOverride?.correctedBoundingBox);
                            const isActive = idx === activeSliceIndex;
                            return (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                  setActiveSliceIndex(idx);
                                  setActiveImageIndex(idx);
                                  setActiveSliceMeta({
                                    sliceIndex: idx,
                                    imageUrl: imgUrl,
                                    seriesName: sItem?.seriesName || '',
                                    overlay: null,
                                  });
                                  if (showFeedbackForm && sItem) {
                                    const ov = sItem.doctorOverride;
                                    const ec = ov?.correctedClass || sItem.class_name || 'notumor';
                                    syncFeedbackDraftFromSlice({
                                      ...sItem,
                                      effectiveClass: ec,
                                      effectiveBox: ec === 'notumor' ? null : (ov?.correctedBoundingBox || sItem.bounding_box),
                                    });
                                  }
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  paddingVertical: 4,
                                  paddingHorizontal: 9,
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
                                  Lát #{idx + 1}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                      - Phân loại {sliceEdited ? 'hiệu chỉnh (BS)' : 'khối u'}:{' '}
                      <Text style={{ fontWeight: 'bold', color: sliceClass === 'notumor' ? '#047857' : '#B91C1C' }}>
                        {sliceClass.toUpperCase()}
                      </Text>
                      {sliceEdited && sliceOrigClass ? ` • AI ban đầu: ${sliceOrigClass.toUpperCase()}` : ''}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 8 }}>
                      - Độ tự tin AI: <Text style={{ fontWeight: 'bold' }}>{sliceDisplay.confidence ?? 0}%</Text>
                    </Text>
                    {sliceDisplay.tumor_location && (
                      <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 8 }}>
                        - Tọa độ tổn thương AI: <Text style={{ fontWeight: '600' }}>X: {sliceDisplay.tumor_location.x}, Y: {sliceDisplay.tumor_location.y}, W: {sliceDisplay.tumor_location.width || sliceDisplay.tumor_location.w}, H: {sliceDisplay.tumor_location.height || sliceDisplay.tumor_location.h} px</Text>
                      </Text>
                    )}
                    {sliceDisplay.consensus_message ? (
                      <FormattedConsensusMessage
                        message={sliceDisplay.consensus_message}
                        style={{ marginBottom: 10 }}
                      />
                    ) : null}

                    {canReviewAI && (
                      <>
                        {result.isSigned ? (
                          <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FEF3C7', borderRadius: 6, borderWidth: 1, borderColor: '#FCD34D' }}>
                            <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '600' }}>
                              Báo cáo đã ký số — kết quả AI và vùng khoanh ROI đã bị khóa để bảo toàn hồ sơ pháp lý.
                            </Text>
                          </View>
                        ) : (
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
                            onPress={() => {
                              if (!showFeedbackForm) {
                                syncFeedbackDraftFromSlice(sliceDisplay);
                                setShowFeedbackForm(true);
                              } else {
                                setShowFeedbackForm(false);
                              }
                            }}
                          >
                            {showFeedbackForm ? (
                              <>
                                <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Đóng Hiệu chỉnh</Text>
                              </>
                            ) : (
                              <>
                                <Edit3 size={14} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                                  AI sai — Hiệu chỉnh lát #{activeSliceIndex + 1}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                        )}

                        {showFeedbackForm && !result.isSigned && (
                          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#475569', marginBottom: 8 }}>
                              ĐIỀU CHỈNH KẾT QUẢ AI SAI (LÁT #{activeSliceIndex + 1}):
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Loại khối u thực tế (Phân loại):</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                              {['glioma', 'meningioma', 'pituitary', 'notumor'].map((cls) => (
                                <TouchableOpacity
                                  key={cls}
                                  style={{ paddingVertical: 5, paddingHorizontal: 10, backgroundColor: correctClass === cls ? '#B91C1C' : '#F1F5F9', borderRadius: 4 }}
                                  onPress={() => {
                                    setCorrectClass(cls);
                                    if (cls === 'notumor') {
                                      setCoordX('0');
                                      setCoordY('0');
                                      setCoordW('0');
                                      setCoordH('0');
                                      setNormalizedRoiBox(null);
                                    }
                                  }}
                                >
                                  <Text style={{ color: correctClass === cls ? '#FFFFFF' : '#334155', fontSize: 11, fontWeight: 'bold' }}>{cls.toUpperCase()}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Interactive ROI Bounding Box Drawer */}
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>
                              Khoanh vùng khối u trực tiếp trên ảnh lát #{activeSliceIndex + 1} (Kéo thả chuột hoặc bấm "Về AI"):
                            </Text>
                            <InteractiveRoiDrawer
                              imageUrl={activeSliceImageUrl ? getImageUrl(activeSliceImageUrl) : ''}
                              normalizedInitialBox={toNormalizedRoiBox(sliceDisplay.effectiveBox)}
                              aiNormalizedBox={toNormalizedRoiBox(sliceDisplay.aiOriginalBox || sliceDisplay.bounding_box)}
                              initialBox={
                                !toNormalizedRoiBox(sliceDisplay.effectiveBox) && Number(coordW) > 0 && Number(coordH) > 0
                                  ? {
                                      x: parseInt(coordX, 10) || 0,
                                      y: parseInt(coordY, 10) || 0,
                                      w: parseInt(coordW, 10) || 0,
                                      h: parseInt(coordH, 10) || 0,
                                    }
                                  : undefined
                              }
                              onBoxChange={({ x, y, w, h, normalizedBox }) => {
                                setCoordX(String(x));
                                setCoordY(String(y));
                                setCoordW(String(w));
                                setCoordH(String(h));
                                setNormalizedRoiBox(normalizedBox || null);
                              }}
                              disabled={correctClass === 'notumor'}
                              containerHeight={320}
                            />

                            {/* Tóm tắt tọa độ sẽ gửi lên server */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Tọa độ gửi AI (lát #{activeSliceIndex + 1}):</Text>
                              <Text style={{ fontSize: 11, color: '#0F172A', fontWeight: 'bold' }}>
                                {correctClass === 'notumor' ? 'X: 0 | Y: 0 | W: 0 | H: 0 (Không u)' : `X: ${coordX} | Y: ${coordY} | W: ${coordW} | H: ${coordH} (px)`}
                              </Text>
                            </View>

                            <TextInput
                              value={feedbackNote}
                              onChangeText={setFeedbackNote}
                              placeholder="Ghi chú ngắn của bác sĩ về vùng tổn thương (không bắt buộc)..."
                              placeholderTextColor="#94A3B8"
                              style={{
                                borderWidth: 1,
                                borderColor: '#CBD5E1',
                                borderRadius: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                fontSize: 12,
                                color: '#0F172A',
                                marginBottom: 10,
                                backgroundColor: '#F8FAFC',
                              }}
                            />

                            <TouchableOpacity
                              style={{ paddingVertical: 8, backgroundColor: '#059669', borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: sendingFeedback ? 0.7 : 1 }}
                              onPress={handleSubmitFeedback} disabled={sendingFeedback}
                            >
                              <CheckCircle2 size={14} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                                {sendingFeedback ? 'Đang lưu hiệu chỉnh...' : `Lưu hiệu chỉnh lát #${activeSliceIndex + 1} & Gửi AI học lại`}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  );
                })()}
                
                <View style={styles.carouselContainer}>
                  {(() => {
                    const allImgs = displayGalleryImages;
                    const safeIdx = Math.min(activeImageIndex, allImgs.length - 1);
                    const currentImg = allImgs[safeIdx];
                    const isHeatmap = safeIdx >= (result.images?.length || 0) ||
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
                                onPress={() => {
                                  setActiveImageIndex(idx);
                                  if (idx < (result.images?.length || 0)) {
                                    setActiveSliceIndex(idx);
                                  }
                                }}
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

            {!isTechnician && (
              <>
                <View style={styles.sectionDivider} />

                <View style={styles.findingsSection}>
              {/* 🧠 Biểu mẫu Báo cáo CĐHA U não có cấu trúc (Structured Brain Tumor Report + RANO) */}
              <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <Text style={[styles.sectionHeading, { marginBottom: 10, color: '#0F172A' }]}>
                  BẢNG THÔNG SỐ ĐỊNH LƯỢNG U NÃO & TIÊU CHUẨN RANO (NEURO-ONCOLOGY STRUCTURED REPORT)
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Bán cầu não:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {[
                        { k: 'right', l: 'Bán cầu Phải' },
                        { k: 'left', l: 'Bán cầu Trái' },
                        { k: 'bilateral', l: 'Hai bên' },
                        { k: 'midline', l: 'Đường giữa' }
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.k}
                          disabled={!canSignReport || result.isSigned}
                          onPress={() => setStructuredReport(p => ({ ...p, hemisphere: opt.k }))}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 5,
                            backgroundColor: structuredReport.hemisphere === opt.k ? '#0284C7' : '#E2E8F0'
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: structuredReport.hemisphere === opt.k ? '#FFF' : '#334155' }}>{opt.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Thùy não / Vị trí giải phẫu:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {[
                        { k: 'frontal', l: 'Thùy Trán' },
                        { k: 'temporal', l: 'Thùy Thái dương' },
                        { k: 'parietal', l: 'Thùy Đỉnh' },
                        { k: 'occipital', l: 'Thùy Chẩm' },
                        { k: 'sellar_pituitary', l: 'Hố yên / Tuyến yên' },
                        { k: 'cerebellar', l: 'Tiểu não / Hố sau' }
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.k}
                          disabled={!canSignReport || result.isSigned}
                          onPress={() => setStructuredReport(p => ({ ...p, lobe: opt.k }))}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 5,
                            backgroundColor: structuredReport.lobe === opt.k ? '#0F766E' : '#E2E8F0'
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: structuredReport.lobe === opt.k ? '#FFF' : '#334155' }}>{opt.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 4 }}>
                  <View style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', minWidth: 150 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>Kích thước u (d₁ × d₂):</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                      {structuredReport.measurements?.d1Mm || 0} × {structuredReport.measurements?.d2Mm || 0} mm ({structuredReport.measurements?.crossProductMm2 || 0} mm²)
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', minWidth: 140 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>Đáp ứng điều trị RANO:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0284C7' }}>
                      {structuredReport.rano?.category || 'N/A'}
                      {structuredReport.rano?.changePercent !== null && structuredReport.rano?.changePercent !== undefined
                        ? ` (${structuredReport.rano.changePercent > 0 ? '+' : ''}${structuredReport.rano.changePercent}%)`
                        : ''}
                    </Text>
                  </View>

                  <View style={{ minWidth: 150 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 2 }}>Đẩy lệch đường giữa (mm):</Text>
                    {canSignReport && !result.isSigned ? (
                      <TextInput
                        style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '700' }}
                        keyboardType="numeric"
                        value={String(structuredReport.midlineShiftMm ?? 0)}
                        onChangeText={(v) => {
                          const num = Number(v) || 0;
                          setStructuredReport(p => ({ ...p, midlineShiftMm: num }));
                          if (num >= 5) setIsCriticalFlag(true);
                        }}
                      />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '800', color: Number(structuredReport.midlineShiftMm) >= 5 ? '#DC2626' : '#0F172A' }}>
                        {structuredReport.midlineShiftMm || 0} mm {Number(structuredReport.midlineShiftMm) >= 5 ? '(NGUY KỊCH ≥ 5mm)' : ''}
                      </Text>
                    )}
                  </View>

                  {canSignReport && !result.isSigned && (
                    <TouchableOpacity
                      onPress={() => setIsCriticalFlag(!isCriticalFlag)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 6,
                        backgroundColor: isCriticalFlag ? '#DC2626' : '#FEE2E2',
                        borderWidth: 1,
                        borderColor: '#DC2626'
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isCriticalFlag ? '#FFFFFF' : '#991B1B' }}>
                        {isCriticalFlag ? '🚨 ĐÃ BẬT CẢNH BÁO ĐỎ (CRITICAL ALERT)' : '⚠️ Gắn cờ Cảnh báo Đỏ (Critical Finding)'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.sectionHeading}>MÔ TẢ HÌNH ẢNH Y KHOA</Text>
              {canSignReport && !result.isSigned ? (
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

              <View style={canSignReport && !result.isSigned ? null : styles.conclusionBox}>
                <Text style={canSignReport && !result.isSigned ? styles.sectionHeading : styles.conclusionHeading}>KẾT LUẬN CHẨN ĐOÁN</Text>
                {canSignReport && !result.isSigned ? (
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

              {canSignReport && !result.isSigned && signPermission?.requiresReason && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.sectionHeading}>LÝ DO TRƯỞNG KHOA KÝ THAY BÁC SĨ CĐHA</Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 42 }]}
                    placeholder="Ví dụ: Bác sĩ CĐHA trực đang xử trí cấp cứu..."
                    value={actingReason}
                    onChangeText={setActingReason}
                  />
                </View>
              )}

              {!canSignReport && !result.isSigned && isPhysician && (
                <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                  Báo cáo đang chờ Bác sĩ CĐHA ký. Bạn sẽ xác nhận đã đọc sau khi báo cáo được ký.
                </Text>
              )}

              {result.isSigned && canAcknowledgeReport && (
                <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#14532D', marginBottom: 8 }}>
                    {result.attendingAcknowledgment?.acknowledgedAt
                      ? `Đã được ${result.attendingAcknowledgment.acknowledgedByName} xác nhận đọc lúc ${formatDate(result.attendingAcknowledgment.acknowledgedAt)}.`
                      : 'Báo cáo đã ký. Vui lòng xác nhận sau khi đọc.'}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start' }}
                    onPress={handleAcknowledgeReport}
                    disabled={acknowledging}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                      {acknowledging ? 'Đang xác nhận...' : 'Xác nhận đã đọc báo cáo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {canSignReport && !result.isSigned && (
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
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Ký số Báo cáo CĐHA (kèm RANO) & Hoàn tất</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* 📝 Danh sách Bản bổ sung / Đính chính sau ký số (Addenda - TT 13/2025/TT-BYT) */}
              {Boolean(result.addenda && result.addenda.length > 0) && (
                <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, padding: 12, marginTop: 12, marginBottom: 16 }}>
                  <Text style={{ fontWeight: '800', fontSize: 13, color: '#92400E', marginBottom: 8 }}>
                    📌 PHỤ LỤC ĐÍNH CHÍNH / BỔ SUNG SAU KÝ SỐ (ADDENDUM):
                  </Text>
                  {result.addenda.map((ad, i) => (
                    <View key={i} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#FDE68A', paddingTop: i > 0 ? 8 : 0, marginTop: i > 0 ? 8 : 0 }}>
                      <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '600' }}>{ad.content}</Text>
                      <Text style={{ fontSize: 11, color: '#78350F', marginTop: 2 }}>
                        Lý do: {ad.reason || 'Bổ sung chuyên môn'} • Bác sĩ: {ad.addedByName} • {formatDate(ad.addedAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {isPhysician && Boolean(result.medicalId) && (
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 12 }}
                  onPress={() => navigation.navigate('TumorProgress', { medicalId: result.medicalId, patientName: result.patientName })}
                >
                  <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12 }}>Xem diễn tiến khối u (RANO)</Text>
                </TouchableOpacity>
              )}

              {result.isSigned && isPhysician && (
                <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>Yêu cầu bình duyệt lần 2</Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 42, marginBottom: 8 }]}
                    placeholder="Lý do cần bác sĩ khác đọc lại..."
                    value={peerReviewReason}
                    onChangeText={setPeerReviewReason}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#0284C7', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start' }}
                    onPress={handleRequestPeerReview}
                    disabled={requestingPeerReview}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                      {requestingPeerReview ? 'Đang gửi...' : 'Gửi yêu cầu bình duyệt'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {result.isSigned && isPhysician && (
                <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                    + Thêm Bản đính chính / Bổ sung sau ký số (Addendum — giữ nguyên bản gốc):
                  </Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 42, marginBottom: 8 }]}
                    placeholder="Nhập nội dung bổ sung / đính chính kết quả đọc phim..."
                    value={addendumContent}
                    onChangeText={setAddendumContent}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#0284C7', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start' }}
                    onPress={handleCreateAddendum}
                    disabled={submittingAddendum}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                      {submittingAddendum ? 'Đang ký Addendum...' : 'Phát hành Bản bổ sung (Addendum)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {localUser?.role === 'patient' && (
              <View style={styles.explainCard}>
                <View style={styles.explainHeader}>
                  <View style={styles.explainIcon}>
                    <Brain size={18} color={Colors.brandMint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.explainTitle}>Giải thích dễ hiểu bằng AI</Text>
                    <Text style={styles.explainSub}>Chuyển báo cáo y khoa sang ngôn ngữ đời thường.</Text>
                  </View>
                </View>

                {explanation ? (
                  <FadeIn>
                    <SimpleMarkdownText text={explanation} tone="dark" style={styles.explainBody} />
                    <Text style={styles.explainNote}>Bản giải thích do AI tạo, chỉ để tham khảo — hãy trao đổi với bác sĩ điều trị trước khi quyết định.</Text>
                  </FadeIn>
                ) : explaining ? (
                  <View style={styles.explainLoading} accessibilityLiveRegion="polite">
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={[styles.explainDot, {
                          opacity: dots.value.interpolate({
                            inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1],
                            outputRange: [0.3, 1, 0.3, 0.3],
                            extrapolate: 'clamp',
                          }),
                        }]}
                      />
                    ))}
                    <Text style={styles.explainLoadingText}>AI đang đọc báo cáo của bạn…</Text>
                  </View>
                ) : (
                  <PressableScale style={styles.explainBtn} hoverStyle={styles.explainBtnHover} onPress={handleExplainAI}>
                    <Brain size={16} color={Colors.brandNavy} />
                    <Text style={styles.explainBtnText}>Giải thích kết quả</Text>
                  </PressableScale>
                )}
              </View>
              )}
            </View>

            {/* Doctor Signature */}
            <View style={styles.signatureSection}>
              <Text style={styles.signDate}>Đà Nẵng, {formatDate(result.reportDate)}</Text>
              <Text style={styles.signTitle}>BÁC SĨ ĐIỀU TRỊ & CHẨN ĐOÁN HÌNH ẢNH</Text>
              
              {/* Digitally Signed Stamp Component */}
              <DigitalSignatureBadge
                isSigned={result.isSigned}
                radiologist={result.radiologist}
                signedAt={result.signedAt || result.reportDate}
                doctorCchn={result.radiologistCchn || '004128/BYT-CCHN'}
                digitalSignatureMetadata={result.digitalSignatureMetadata}
              />

              <Text style={styles.signDoctorName}>{result.radiologist}</Text>
            </View>
              </>
            )}
          </FadeIn>
        </ScrollView>

        {/* Zoom Image Modal */}
        {(() => {
          const allImgs = Array.from(new Set([...(result?.images || []), ...extraImages]));
          if (allImgs.length === 0) return null;
          const safeIdx = Math.min(activeImageIndex, allImgs.length - 1);
          const currentImg = allImgs[safeIdx];
          const isHeatmap = safeIdx >= (result?.images?.length || 0) || 
                            (currentImg && (currentImg.includes('heatmap') || currentImg.startsWith('data:')));
          return (
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
                    source={{ uri: currentImg?.startsWith('data:') ? currentImg : getImageUrl(currentImg) }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                  {isHeatmap && (
                    <View style={{ position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(124,58,237,0.85)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Activity size={14} color="#FFFFFF" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Heatmap Grad-CAM</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalCounter}>
                  Ảnh {safeIdx + 1} / {allImgs.length} {isHeatmap ? ' (Heatmap AI)' : ''}
                </Text>
              </SafeAreaView>
            </Modal>
          );
        })()}
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default ImagingResultScreen;
