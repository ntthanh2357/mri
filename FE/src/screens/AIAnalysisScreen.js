import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Animated,
} from 'react-native';
import { post } from '../services/api.service';
import Config from '../constants/config';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './AIAnalysisScreen.styles';

const CLASS_META = {
  glioma: {
    label: 'GLIOMA',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: '🔴',
    desc: 'Khối u thần kinh đệm — cần hội chẩn chuyên khoa ngay.',
  },
  meningioma: {
    label: 'MENINGIOMA',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: '🟡',
    desc: 'U màng não — thường lành tính, có thể theo dõi hoặc phẫu thuật.',
  },
  pituitary: {
    label: 'PITUITARY',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    icon: '🟣',
    desc: 'U tuyến yên — cần kiểm tra nội tiết và hội chẩn chuyên khoa.',
  },
  notumor: {
    label: 'BÌNH THƯỜNG',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: '🟢',
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
  const { imageUrl, visitId, patientInfo } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [phase, setPhase] = useState('analyzing'); // 'analyzing' | 'result'
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Feedback state
  const [selectedCorrectClass, setSelectedCorrectClass] = useState(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [approvingAI, setApprovingAI] = useState(false);

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
    { label: '🔬 Tiền xử lý ảnh y khoa (OpenCV)', desc: 'Chuẩn hóa độ sáng, khử nhiễu ảnh MRI' },
    { label: '🤖 Ensemble 3 mô hình phân loại u não', desc: 'ResNet50 + EfficientNetB0 + DenseNet121' },
    { label: '📦 YOLOv8 phát hiện và khoanh vùng', desc: 'Định vị tọa độ khối u trên lát cắt' },
    { label: '🧠 Gemini VLM phân xử đa thức', desc: 'Nhận diện ngữ cảnh và kiểm chứng chéo' },
    { label: '🗺️ Grad-CAM vẽ Heatmap bất thường', desc: 'Trực quan hóa vùng kích hoạt mô hình' },
  ];

  // Auto-start analysis when screen mounts
  useEffect(() => {
    if (!imageUrl) {
      setError('Không có ảnh MRI để phân tích.');
      setPhase('result');
      return;
    }
    runAnalysis();
  }, []);

  const runAnalysis = async () => {
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
      const response = await post('/api/v1/imaging/analyze-ai', { imageUrl, visitId });
      clearInterval(stepInterval);
      setCurrentStep(5);

      if (response.success && response.data) {
        setAiResult(response.data);
        setSelectedCorrectClass(response.data.class_name);
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

  // ── Xác nhận đúng ──────────────────────────────────────────────────────────
  const handleConfirmCorrect = async () => {
    if (!aiResult) return;
    setApprovingAI(true);
    try {
      const filename = imageUrl?.split('/').pop() || 'scan.jpg';
      await post('/api/v1/imaging/approve-ai', {
        filename,
        predicted_class: aiResult.class_name,
        confidence: aiResult.confidence ?? 0,
      });
    } catch (_) { }
    setApprovingAI(false);

    const meta = CLASS_META[aiResult.class_name] || CLASS_META.notumor;
    const conclusionText =
      aiResult.class_name === 'notumor'
        ? `Không phát hiện bất thường sọ não trên hình ảnh MRI (Độ tự tin AI: ${aiResult.confidence}%). Đồng thuận: ${aiResult.consensus_message || 'Kết quả bình thường.'}`
        : `Hình ảnh gợi ý khối u loại ${meta.label} (Độ tự tin AI: ${aiResult.confidence}%). ${meta.desc} Đề xuất hội chẩn chuyên khoa phẫu thuật thần kinh.`;

    const findingsText =
      aiResult.class_name === 'notumor'
        ? `Kết quả phân tích AI từ hệ thống Ensemble (ResNet + EfficientNet + DenseNet) + YOLOv8 không ghi nhận tổn thương bất thường. Độ tự tin: ${aiResult.confidence}%. Đồng thuận: ${aiResult.consensus_message || 'Tất cả mô hình nhất quán.'}`
        : `Phát hiện vùng tổn thương gợi ý khối u loại ${meta.label}. Độ tự tin Ensemble: ${aiResult.confidence}%. ${aiResult.consensus_message || ''}`;

    navigation.navigate('CreateImagingResult', {
      ...(route.params || {}),
      aiResult: {
        ...aiResult,
        annotated_image: aiResult.annotated_image,
        confirmed: true,
        isWrong: false,
      },
      prefillFindings: findingsText,
      prefillConclusion: conclusionText,
    });
  };

  // ── AI sai → gửi phản hồi rồi quay lại ────────────────────────────────────
  const handleConfirmWrong = async () => {
    if (!selectedCorrectClass) return;
    setSendingFeedback(true);
    try {
      const filename = imageUrl?.split('/').pop() || 'scan.jpg';
      await post('/api/v1/imaging/feedback-ai', {
        imageUrl,
        correct_class: selectedCorrectClass,
        x: 120, y: 120, w: 100, h: 100,
      });
    } catch (_) { }
    setSendingFeedback(false);

    const correctMeta = CLASS_META[selectedCorrectClass] || CLASS_META.notumor;
    const aiMeta = CLASS_META[aiResult?.class_name] || CLASS_META.notumor;

    const warningNote = `⚠️ LƯU Ý: AI chẩn đoán ban đầu là "${aiMeta.label}" nhưng bác sĩ đã điều chỉnh thành "${correctMeta.label}". Kết quả này cần được xem xét kỹ lưỡng bởi chuyên gia. Phản hồi điều chỉnh đã được ghi nhận để cải thiện mô hình AI.`;

    const conclusionText =
      selectedCorrectClass === 'notumor'
        ? `Sau khi bác sĩ xem xét và điều chỉnh kết quả AI: Không phát hiện bất thường sọ não.`
        : `Sau khi bác sĩ xem xét và điều chỉnh kết quả AI: Hình ảnh gợi ý khối u loại ${correctMeta.label}. ${correctMeta.desc}`;

    navigation.navigate('CreateImagingResult', {
      ...(route.params || {}),
      aiResult: {
        ...aiResult,
        class_name: selectedCorrectClass,
        confirmed: true,
        isWrong: true,
        originalClass: aiResult?.class_name,
        warningNote,
      },
      prefillFindings: warningNote,
      prefillConclusion: conclusionText,
    });
  };

  const meta = aiResult ? (CLASS_META[aiResult.class_name] || CLASS_META.notumor) : null;
  const imageFullUri = imageUrl?.startsWith('http') ? imageUrl : `${Config.API_URL}${imageUrl}`;
  const annotatedUri = aiResult?.annotated_image || null;

  // Translate coordinates mapping box width
  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="CreateImagingResult">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chẩn Đoán Hình Ảnh AI</Text>
          {phase === 'result' ? (
            <TouchableOpacity onPress={runAnalysis} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>🔄 Quét lại</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {phase === 'analyzing' ? (
          // ── LOADING / ANALYZING STATE ──
          <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
            <View style={[isDesktop && styles.desktopRow]}>
              {/* Left col: brain scan visualization */}
              <View style={[isDesktop ? styles.leftCol : styles.fullWidth]}>
                <View style={styles.imgCard}>
                  <Text style={styles.imgCardLabel}>📷 Phim chụp MRI đang phân tích</Text>
                  <View style={styles.scanPreviewBox}>
                    {imageUrl ? (
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
                    <ActivityIndicator size="small" color="#15803D" />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>
                      Đang xử lý phim chụp...
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 20 }}>
                    Hệ thống AI tích hợp (Ensemble ResNet + EfficientNet + DenseNet + YOLOv8 + Gemini VLM) đang chạy phân tích song song và sinh bản đồ kích hoạt nhiệt Grad-CAM.
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
                            {isCompleted && <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 13 }}>✓</Text>}
                            {isCurrent && <ActivityIndicator size="small" color="#3B82F6" />}
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
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Lỗi kết nối AI</Text>
                <Text style={styles.errorMsg}>{error}</Text>
                <TouchableOpacity style={styles.retryBigBtn} onPress={runAnalysis}>
                  <Text style={styles.retryBigBtnText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={[isDesktop && styles.desktopRow, { opacity: fadeAnim, flex: 1, width: '100%' }]}>
                {/* ── LEFT: Images ─────────────────────────────────────────── */}
                <View style={[isDesktop ? styles.leftCol : styles.fullWidth]}>
                  {/* Original image */}
                  <View style={styles.imgCard}>
                    <Text style={styles.imgCardLabel}>📷 Ảnh gốc MRI</Text>
                    <View style={styles.imgViewer}>
                      {imageUrl ? (
                        <Image source={{ uri: imageFullUri }} style={styles.imgFull} resizeMode="contain" />
                      ) : (
                        <Text style={{ color: '#94A3B8' }}>Không có ảnh</Text>
                      )}
                    </View>
                  </View>

                  {/* Annotated image (Heatmap / GradCAM) */}
                  {annotatedUri && (
                    <View style={styles.imgCard}>
                      <Text style={styles.imgCardLabel}>🗺️ Heatmap phân tích (Grad-CAM + YOLO)</Text>
                      <View style={styles.imgViewer}>
                        <Image source={{ uri: annotatedUri }} style={styles.imgFull} resizeMode="contain" />
                      </View>
                    </View>
                  )}
                </View>

                {/* ── RIGHT: Result + Actions ───────────────────────────────── */}
                <View style={[isDesktop ? styles.rightCol : styles.fullWidth]}>
                  {/* Main result card */}
                  {meta && (
                    <View style={[styles.resultCard, { borderColor: meta.border, backgroundColor: meta.bg }]}>
                      <View style={styles.resultCardHeader}>
                        <Text style={styles.resultCardIcon}>{meta.icon}</Text>
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
                            return (
                              <View key={cls} style={styles.probRow}>
                                <Text style={styles.probCls}>{m.icon} {m.label}</Text>
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
                          <Text style={styles.consensusText}>{aiResult.consensus_message}</Text>
                        </View>
                      ) : null}

                      <View style={styles.disclaimer}>
                        <Text style={styles.disclaimerText}>
                          ⚠️ Kết quả AI chỉ mang tính chất hỗ trợ tham khảo, không thay thế kết luận của bác sĩ chuyên khoa.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ── CONFIRM CORRECT ──────────────────────────────────────── */}
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
                          <Text style={styles.confirmBtnIcon}>✅</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.confirmBtnTitle}>AI đúng — Xác nhận & Điền kết quả</Text>
                            <Text style={styles.confirmBtnSub}>Trả về form với ảnh gốc + ảnh heatmap + kết quả AI đã điền sẵn</Text>
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
                    <Text style={styles.feedbackTitle}>AI sai — Chọn kết quả đúng:</Text>
                    <View style={styles.classGrid}>
                      {Object.entries(CLASS_META).map(([cls, m]) => (
                        <TouchableOpacity
                          key={cls}
                          style={[
                            styles.classChip,
                            selectedCorrectClass === cls && { backgroundColor: m.color, borderColor: m.color },
                          ]}
                          onPress={() => setSelectedCorrectClass(cls)}
                        >
                          <Text style={[styles.classChipText, selectedCorrectClass === cls && { color: '#fff' }]}>
                            {m.icon} {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.wrongBtn, sendingFeedback && styles.btnDisabled]}
                      onPress={handleConfirmWrong}
                      disabled={sendingFeedback || !selectedCorrectClass}
                    >
                      {sendingFeedback ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.wrongBtnIcon}>✍️</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.wrongBtnTitle}>AI sai — Gửi hiệu chỉnh & Trở về</Text>
                            <Text style={styles.wrongBtnSub}>Điền kết quả đúng + ghi lưu ý cảnh báo vào form</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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
