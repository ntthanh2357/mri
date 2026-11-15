import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Brain,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Monitor,
  Star,
  X,
} from 'lucide-react';
import Config from '../../constants/config';
import { stripHtml } from '../FormattedConsensusMessage';

export const TUMOR_LABEL_VI = {
  glioma: 'U thần kinh đệm (Glioma)',
  meningioma: 'U màng não (Meningioma)',
  pituitary: 'U tuyến yên (Pituitary)',
  notumor: 'Không phát hiện khối u',
};

export const TUMOR_SHORT_VI = {
  glioma: 'U thần kinh đệm',
  meningioma: 'U màng não',
  pituitary: 'U tuyến yên',
  notumor: 'Bình thường',
};

const TUMOR_BAR_COLOR = {
  glioma: '#DC2626',
  meningioma: '#D97706',
  pituitary: '#7C3AED',
  notumor: '#059669',
};

const ALL_CLASSES = ['glioma', 'meningioma', 'pituitary', 'notumor'];

const normalizeProbabilityMap = (probabilities) => {
  if (!probabilities || typeof probabilities !== 'object') return null;
  const rawVals = Object.values(probabilities).map(Number).filter(Number.isFinite);
  if (rawVals.length === 0) return null;
  const scaleToPct = Math.max(...rawVals) <= 1 ? 100 : 1;
  const out = {};
  for (const [k, v] of Object.entries(probabilities)) {
    const key = String(k).toLowerCase();
    const num = Number(v);
    if (Number.isFinite(num)) {
      out[key] = Math.max(0, Math.min(100, Math.round(num * scaleToPct * 10) / 10));
    }
  }
  return Object.keys(out).length > 0 ? out : null;
};

const resolveImageUri = (u) => {
  if (!u) return '';
  if (u.startsWith('http') || u.startsWith('data:') || u.startsWith('blob:')) return u;
  return `${Config.API_URL}${u}`;
};

const normalizeBox = (box) => {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w !== undefined ? box.w : box.width);
  const h = Number(box.h !== undefined ? box.h : box.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    w: Math.max(0, Math.min(1 - Math.max(0, x), w)),
    h: Math.max(0, Math.min(1 - Math.max(0, y), h)),
  };
};

const extractSliceMeta = (idx, url, sliceSeriesMeta = [], aiReport = null) => {
  const meta = sliceSeriesMeta[idx] || {};
  const sliceRes = Array.isArray(aiReport?.sliceResults)
    ? (aiReport.sliceResults.find((s) => s?.sliceIndex === idx) || aiReport.sliceResults[idx])
    : null;

  const yoloClass = meta.yoloClass && String(meta.yoloClass).toLowerCase() !== 'notumor'
    ? String(meta.yoloClass).toLowerCase()
    : null;
  const rawClass = (
    sliceRes?.class_name ||
    (meta.yoloDetected && yoloClass ? yoloClass : null) ||
    meta.predictedClass ||
    null
  );
  const cls = rawClass ? String(rawClass).toLowerCase() : null;
  const box = cls === 'notumor' ? null : normalizeBox(sliceRes?.bounding_box || meta.boundingBox || null);
  const conf = sliceRes?.confidence ?? meta.confidence ?? (meta.yoloConf ? Math.round(meta.yoloConf * 1000) / 10 : null);
  const rawHeatmap = sliceRes?.heatmapStreamUrl || meta.heatmapStreamUrl || null;
  const consensusMessage = sliceRes?.consensus_message || meta.consensusMessage || null;
  const clinicalReport = sliceRes?.clinical_report || meta.clinicalReport || null;
  const isThreeTier = Boolean(
    sliceRes?.aiTier === '3-tier' || meta.aiTier === '3-tier' || rawHeatmap || consensusMessage
  );

  const probabilities = normalizeProbabilityMap(sliceRes?.probabilities || meta.probabilities || null);

  return {
    idx,
    url,
    fullUri: resolveImageUri(url),
    heatmapUri: rawHeatmap ? resolveImageUri(rawHeatmap) : null,
    consensusMessage,
    clinicalReport,
    aiTier: isThreeTier ? '3-tier' : 'triage',
    seriesName: sliceRes?.seriesName || meta.seriesName || meta.sequenceType || `Lát #${idx + 1}`,
    sequenceType: sliceRes?.sequenceType || meta.sequenceType || '',
    plane: sliceRes?.plane || meta.plane || '',
    sliceNumber: sliceRes?.sliceNumber ?? meta.sliceNumber ?? null,
    clarityScore: sliceRes?.clarityScore ?? meta.clarityScore ?? null,
    predictedClass: cls,
    yoloDetected: Boolean(meta.yoloDetected || sliceRes?.yoloDetected || box),
    yoloClass,
    confidence: Number.isFinite(Number(conf)) ? Number(conf) : null,
    probabilities,
    boundingBox: box,
  };
};

const FinalizedSliceGallery = ({
  images = [],
  sliceSeriesMeta = [],
  primarySliceIndex = 0,
  aiResult = null,
  onSelectPrimary,
  onRemoveSlice,
  onOpenDicomViewer,
  emptyHint = null,
}) => {
  const [inspectIdx, setInspectIdx] = useState(null);
  const [showAiBox, setShowAiBox] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const items = useMemo(
    () => images.map((url, idx) => extractSliceMeta(idx, url, sliceSeriesMeta, aiResult)),
    [images, sliceSeriesMeta, aiResult]
  );

  const summary = useMemo(() => {
    const withAi = items.filter((it) => Boolean(it.predictedClass));
    if (withAi.length === 0 && !aiResult?.class_name) return null;
    const withTumor = items.filter((it) => it.predictedClass && it.predictedClass !== 'notumor');
    const withBox = items.filter((it) => Boolean(it.boundingBox));
    const primaryItem = items[primarySliceIndex] || items[0];
    const bestTumor = withTumor.reduce(
      (b, c) => (!b || (c.confidence || 0) > (b.confidence || 0) ? c : b),
      null
    );
    const domClass =
      aiResult?.class_name && aiResult.class_name !== 'notumor'
        ? String(aiResult.class_name).toLowerCase()
        : (primaryItem?.predictedClass && primaryItem.predictedClass !== 'notumor'
            ? primaryItem.predictedClass
            : bestTumor?.predictedClass || aiResult?.class_name || withAi[0]?.predictedClass || 'notumor');
    const domConf =
      aiResult?.confidence ??
      (domClass === bestTumor?.predictedClass ? bestTumor?.confidence : primaryItem?.confidence) ??
      null;

    // Aggregate per-class slice counts, full-folder stats, and mean probability for differential suspicions
    const sliceVotes = {};
    const yoloVotes = {};
    const probSums = {};
    let probSliceCount = 0;

    for (const it of items) {
      if (it.predictedClass) {
        sliceVotes[it.predictedClass] = (sliceVotes[it.predictedClass] || 0) + 1;
      }
      if (it.yoloClass && it.yoloClass !== it.predictedClass) {
        yoloVotes[it.yoloClass] = (yoloVotes[it.yoloClass] || 0) + 1;
      }
      if (it.probabilities) {
        probSliceCount += 1;
        for (const cls of ALL_CLASSES) {
          probSums[cls] = (probSums[cls] || 0) + (Number(it.probabilities[cls]) || 0);
        }
      }
    }

    const fallbackMainProbs = normalizeProbabilityMap(aiResult?.probabilities);
    const folderClassMap = {};
    for (const cs of aiResult?.studyDiagnosisSummary?.classStats || []) {
      if (cs?.className) folderClassMap[String(cs.className).toLowerCase()] = cs;
    }

    const classBreakdown = ALL_CLASSES.map((cls) => {
      const avgProb =
        probSliceCount > 0
          ? Math.round((probSums[cls] / probSliceCount) * 10) / 10
          : (fallbackMainProbs ? Number(fallbackMainProbs[cls] || 0) : null);
      const sliceCount = sliceVotes[cls] || 0;
      const yoloConflictCount = yoloVotes[cls] || 0;
      const folderStat = folderClassMap[cls] || null;
      return {
        className: cls,
        label: TUMOR_LABEL_VI[cls] || cls,
        shortLabel: TUMOR_SHORT_VI[cls] || cls,
        color: TUMOR_BAR_COLOR[cls] || '#4F46E5',
        sliceCount,
        yoloConflictCount,
        folderCount: folderStat?.count ?? 0,
        folderPct: folderStat?.percentage ?? 0,
        avgProb,
      };
    });

    const otherSuspicions = classBreakdown
      .filter(
        (c) =>
          c.className !== domClass &&
          (c.sliceCount > 0 || c.yoloConflictCount > 0 || c.folderCount > 0 || (c.avgProb != null && c.avgProb >= 0.5))
      )
      .sort((a, b) => {
        const aIsTumor = a.className !== 'notumor' ? 1 : 0;
        const bIsTumor = b.className !== 'notumor' ? 1 : 0;
        if (aIsTumor !== bIsTumor) return bIsTumor - aIsTumor;
        return (
          b.sliceCount - a.sliceCount ||
          b.folderCount - a.folderCount ||
          (b.avgProb ?? -1) - (a.avgProb ?? -1)
        );
      });

    return {
      domClass,
      domConf,
      tumorCount: withTumor.length,
      boxCount: withBox.length,
      total: items.length,
      classBreakdown,
      otherSuspicions,
    };
  }, [items, aiResult, primarySliceIndex]);

  const hasDeepAi = useMemo(
    () => Boolean(aiResult?.deepAiCompleted || items.some((it) => it.aiTier === '3-tier')),
    [aiResult, items]
  );

  if (!images || images.length === 0) {
    return emptyHint;
  }

  const safeInspectIdx =
    inspectIdx !== null && inspectIdx >= 0 && inspectIdx < items.length ? inspectIdx : null;
  const activeItem = safeInspectIdx !== null ? items[safeInspectIdx] : null;
  const activeHasTumor = Boolean(activeItem?.predictedClass && activeItem.predictedClass !== 'notumor');
  const activeDisplayUri = showHeatmap && activeItem?.heatmapUri ? activeItem.heatmapUri : activeItem?.fullUri;

  return (
    <View style={styles.wrap}>
      {summary ? (
        <View
          style={[
            styles.summaryBanner,
            summary.domClass !== 'notumor' ? styles.summaryBannerAlert : styles.summaryBannerNormal,
          ]}
        >
          <View style={styles.summaryTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              <View
                style={[
                  styles.summaryHeroTag,
                  summary.domClass !== 'notumor' ? styles.summaryHeroTagAlert : styles.summaryHeroTagNormal,
                ]}
              >
                <Text style={styles.summaryHeroTagText}>KẾT QUẢ CHẨN ĐOÁN AI CHÍNH</Text>
              </View>
              <View style={[styles.tierBadge, hasDeepAi ? styles.tierBadgeDeep : styles.tierBadgeTriage]}>
                <Text style={[styles.tierBadgeText, hasDeepAi ? { color: '#3730A3' } : { color: '#475569' }]}>
                  {hasDeepAi
                    ? 'AI 3 tầng: CNN Ensemble + YOLOv8 + Gemini VLM'
                    : 'AI chi tiết: 3-CNN Ensemble + YOLOv8 (+ Gemini giới hạn)'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setInspectIdx(Math.min(Math.max(0, primarySliceIndex), items.length - 1))}
                style={styles.inspectAllBtn}
              >
                <Maximize2 size={14} color="#fff" />
                <Text style={styles.inspectAllBtnText}>Xem chi tiết & Vùng u từng ảnh</Text>
              </TouchableOpacity>
              {typeof onOpenDicomViewer === 'function' && (
                <TouchableOpacity
                  onPress={() => onOpenDicomViewer(Math.min(Math.max(0, primarySliceIndex), items.length - 1))}
                  style={styles.dicomViewerBtn}
                >
                  <Monitor size={14} color="#0F172A" />
                  <Text style={styles.dicomViewerBtnText}>Mở Xem DICOM từng lát</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.summaryMainVerdictRow}>
            <View
              style={[
                styles.summaryIconCircle,
                { backgroundColor: summary.domClass !== 'notumor' ? '#FEE2E2' : '#D1FAE5' },
              ]}
            >
              <Brain size={24} color={summary.domClass !== 'notumor' ? '#B91C1C' : '#047857'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                Phân loại AI:{' '}
                <Text style={{ color: summary.domClass !== 'notumor' ? '#B91C1C' : '#047857' }}>
                  {TUMOR_LABEL_VI[summary.domClass] || summary.domClass?.toUpperCase()}
                </Text>
                {summary.domConf != null ? ` (${Math.round(summary.domConf)}%)` : ''}
              </Text>
              <Text style={styles.summarySub}>
                • Phát hiện bất thường trên <Text style={{ fontWeight: '800', color: '#0F172A' }}>{summary.tumorCount}/{summary.total}</Text> lát
                {' '}• Đã khoanh vùng khối u (YOLO) trên <Text style={{ fontWeight: '800', color: '#0F172A' }}>{summary.boxCount}/{summary.total}</Text> lát
                {aiResult?.studyDiagnosisSummary?.totalAnalyzed
                  ? ` • Toàn thư mục (${aiResult.studyDiagnosisSummary.totalAnalyzed} lát): ${
                      TUMOR_LABEL_VI[aiResult.studyDiagnosisSummary.dominantClass] ||
                      aiResult.studyDiagnosisSummary.dominantClass
                    } (${aiResult.studyDiagnosisSummary.dominantCount}/${aiResult.studyDiagnosisSummary.totalAnalyzed}, ${
                      aiResult.studyDiagnosisSummary.dominantPctOfTotal
                    }%)`
                  : ''}
                {' '}• Bấm trực tiếp vào bất kỳ ảnh nào bên dưới để phóng to kiểm tra.
              </Text>
            </View>
          </View>

          <View style={styles.diffBox}>
            <Text style={styles.diffTitle}>
              Nghi ngờ loại khác (Chẩn đoán phân biệt & phân bố đa lát):
            </Text>
            {summary.otherSuspicions.length > 0 ? (
              <View style={styles.diffList}>
                {summary.otherSuspicions.map((item) => {
                  const pctDisplay = item.avgProb != null ? `${item.avgProb}%` : (item.folderPct > 0 ? `${item.folderPct}%` : null);
                  const barWidth = Math.max(
                    3,
                    Math.min(
                      100,
                      item.avgProb != null
                        ? item.avgProb
                        : item.folderPct > 0
                        ? item.folderPct
                        : Math.round(((item.sliceCount + item.yoloConflictCount) / Math.max(1, summary.total)) * 100)
                    )
                  );
                  const detailParts = [];
                  if (item.avgProb != null) detailParts.push(`Xác suất AI: ${item.avgProb}%`);
                  if (item.sliceCount > 0) detailParts.push(`${item.sliceCount}/${summary.total} lát`);
                  if (item.yoloConflictCount > 0) detailParts.push(`YOLO nghi: ${item.yoloConflictCount} lát`);
                  if (item.folderCount > 0 && aiResult?.studyDiagnosisSummary?.totalAnalyzed) {
                    detailParts.push(`Toàn thư mục: ${item.folderCount}/${aiResult.studyDiagnosisSummary.totalAnalyzed} (${item.folderPct}%)`);
                  }
                  return (
                    <View key={item.className} style={styles.diffRow}>
                      <View style={styles.diffRowHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.diffDot, { backgroundColor: item.color }]} />
                          <Text style={styles.diffClsLabel}>{item.label}</Text>
                        </View>
                        <Text style={[styles.diffMetaText, { color: item.className !== 'notumor' ? '#B45309' : '#047857' }]}>
                          {detailParts.join(' • ') || (pctDisplay ? pctDisplay : 'Ít nghi ngờ')}
                        </Text>
                      </View>
                      <View style={styles.diffBarTrack}>
                        <View style={[styles.diffBarFill, { width: `${barWidth}%`, backgroundColor: item.color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.diffEmptyText}>
                Chưa phát hiện dấu hiệu nghi ngờ đáng kể ở các loại u khác trên bộ ảnh này.
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.summaryBanner, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryTitle}>Đã nạp {items.length} lát cắt phim chụp — Bấm vào từng ảnh để phóng to xem</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setInspectIdx(Math.min(Math.max(0, primarySliceIndex), items.length - 1))}
                style={styles.inspectAllBtn}
              >
                <Maximize2 size={13} color="#fff" />
                <Text style={styles.inspectAllBtnText}>Xem từng ảnh ({items.length})</Text>
              </TouchableOpacity>
              {typeof onOpenDicomViewer === 'function' && (
                <TouchableOpacity
                  onPress={() => onOpenDicomViewer(Math.min(Math.max(0, primarySliceIndex), items.length - 1))}
                  style={styles.dicomViewerBtn}
                >
                  <Monitor size={13} color="#0F172A" />
                  <Text style={styles.dicomViewerBtnText}>Mở Xem DICOM từng lát</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.grid}>
        {items.map((item) => {
          const isPrimary = item.idx === primarySliceIndex;
          const hasTumor = Boolean(item.predictedClass && item.predictedClass !== 'notumor');
          const clsText = item.predictedClass
            ? `${TUMOR_SHORT_VI[item.predictedClass] || item.predictedClass}${item.confidence != null ? ` · ${Math.round(item.confidence)}%` : ''}`
            : (item.clarityScore != null ? `Độ rõ: ${Math.round(item.clarityScore * 100)}đ` : 'Ảnh phim chụp');
          const runnerUpEntry = item.probabilities
            ? Object.entries(item.probabilities)
                .filter(([cls]) => cls !== item.predictedClass && cls !== 'notumor')
                .map(([cls, pct]) => ({ cls, pct: Number(pct) || 0 }))
                .sort((a, b) => b.pct - a.pct)[0] || null
            : null;
          const secondaryHint =
            runnerUpEntry && runnerUpEntry.pct >= 3
              ? `Nghi khác: ${TUMOR_SHORT_VI[runnerUpEntry.cls] || runnerUpEntry.cls} ${runnerUpEntry.pct}%`
              : item.yoloClass && item.yoloClass !== item.predictedClass
              ? `YOLO nghi: ${TUMOR_SHORT_VI[item.yoloClass] || item.yoloClass}`
              : null;

          return (
            <View
              key={`${item.idx}-${item.url}`}
              style={[styles.card, isPrimary && styles.cardPrimary]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setInspectIdx(item.idx)}
                accessibilityLabel={`Xem chi tiết lát cắt ${item.idx + 1}`}
                style={styles.imgStage}
              >
                <Image source={{ uri: item.fullUri }} style={styles.img} resizeMode="contain" />

                {item.boundingBox && (
                  <View
                    style={{
                      position: 'absolute',
                      left: `${item.boundingBox.x * 100}%`,
                      top: `${item.boundingBox.y * 100}%`,
                      width: `${item.boundingBox.w * 100}%`,
                      height: `${item.boundingBox.h * 100}%`,
                      borderWidth: 2,
                      borderColor: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.16)',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                <View style={styles.zoomHintBadge}>
                  <Maximize2 size={11} color="#fff" />
                </View>
              </TouchableOpacity>

              {typeof onSelectPrimary === 'function' && (
                <TouchableOpacity
                  accessibilityLabel="Đặt làm ảnh đại diện"
                  onPress={() => onSelectPrimary(item.idx)}
                  style={[styles.starBtn, isPrimary && styles.starBtnActive]}
                >
                  <Star size={11} color="#FFFFFF" fill={isPrimary ? '#FFFFFF' : 'none'} />
                  {isPrimary && <Text style={styles.starBtnText}>Chính</Text>}
                </TouchableOpacity>
              )}

              {typeof onRemoveSlice === 'function' && (
                <TouchableOpacity
                  accessibilityLabel={`Xóa lát cắt ${item.idx + 1}`}
                  onPress={() => onRemoveSlice(item.idx)}
                  style={styles.removeBtn}
                >
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setInspectIdx(item.idx)}
                style={styles.metaFooter}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.clsBadgeText,
                    hasTumor ? { color: '#DC2626' } : item.predictedClass ? { color: '#059669' } : { color: '#334155' },
                  ]}
                >
                  {clsText}
                  {item.boundingBox ? ' [Có khoanh u]' : ''}
                </Text>
                {secondaryHint && (
                  <Text numberOfLines={1} style={styles.secondaryCardHint}>
                    {secondaryHint}
                  </Text>
                )}
                <Text numberOfLines={1} style={styles.seriesText}>
                  #{item.idx + 1} · {item.seriesName}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Modal phóng to từng lát cắt + phân loại khối u + khung khoanh vùng AI */}
      <Modal
        visible={Boolean(activeItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectIdx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Lát cắt #{(activeItem?.idx ?? 0) + 1} / {items.length} •{' '}
                  {activeItem?.predictedClass
                    ? (TUMOR_LABEL_VI[activeItem.predictedClass] || activeItem.predictedClass.toUpperCase())
                    : 'Ảnh MRI'}
                </Text>
                <Text style={styles.modalSub}>
                  Chuỗi: {activeItem?.seriesName}
                  {activeItem?.sequenceType ? ` (${activeItem.sequenceType})` : ''}
                  {activeItem?.plane && activeItem.plane !== 'unknown' ? ` • ${activeItem.plane}` : ''}
                  {activeItem?.sliceNumber != null ? ` • Slice #${activeItem.sliceNumber}` : ''}
                  {activeItem?.clarityScore != null ? ` • Độ rõ u: ${Math.round(activeItem.clarityScore * 100)}đ` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInspectIdx(null)} style={styles.modalCloseBtn}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Thanh thông tin phân loại & khoanh vùng AI */}
            <View style={styles.aiInfoBar}>
              <View style={[styles.aiPill, activeHasTumor ? styles.aiPillTumor : styles.aiPillNormal]}>
                <Brain size={14} color={activeHasTumor ? '#991B1B' : '#065F46'} />
                <Text style={[styles.aiPillText, { color: activeHasTumor ? '#991B1B' : '#065F46' }]}>
                  Phân loại AI:{' '}
                  {activeItem?.predictedClass
                    ? (TUMOR_LABEL_VI[activeItem.predictedClass] || activeItem.predictedClass)
                    : 'Chưa chạy AI chi tiết'}
                  {activeItem?.confidence != null ? ` (${Math.round(activeItem.confidence)}%)` : ''}
                </Text>
              </View>
              <View style={styles.aiPillNeutral}>
                <Text style={styles.aiPillNeutralText}>
                  Khoanh vùng YOLO:{' '}
                  {activeItem?.boundingBox
                    ? `Đã khoanh u (${Math.round(activeItem.boundingBox.w * 100)}% × ${Math.round(activeItem.boundingBox.h * 100)}%)`
                    : 'Không có box khối u'}
                </Text>
              </View>
            </View>

            {activeItem?.probabilities && (
              <View style={styles.modalProbStrip}>
                <Text style={styles.modalProbStripLbl}>Xác suất AI trên lát này:</Text>
                {ALL_CLASSES.map((cls) => ({
                  cls,
                  pct: Number(activeItem.probabilities[cls]) || 0,
                }))
                  .sort((a, b) => b.pct - a.pct)
                  .map((p) => (
                    <View
                      key={p.cls}
                      style={[
                        styles.modalProbChip,
                        p.cls === activeItem.predictedClass && styles.modalProbChipPrimary,
                      ]}
                    >
                      <View style={[styles.diffDot, { backgroundColor: TUMOR_BAR_COLOR[p.cls] || '#4F46E5' }]} />
                      <Text
                        style={[
                          styles.modalProbChipText,
                          p.cls === activeItem.predictedClass && { fontWeight: '800', color: '#0F172A' },
                        ]}
                      >
                        {TUMOR_SHORT_VI[p.cls] || p.cls}: {p.pct}%
                      </Text>
                    </View>
                  ))}
              </View>
            )}

            {/* Khung ảnh vuông 1:1 kèm bounding box + nút chuyển lát trước/sau */}
            <View style={styles.modalStageWrap}>
              <TouchableOpacity
                disabled={safeInspectIdx === 0}
                onPress={() => setInspectIdx((p) => Math.max(0, (p ?? 0) - 1))}
                style={[styles.navArrowBtn, safeInspectIdx === 0 && { opacity: 0.3 }]}
              >
                <ChevronLeft size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.modalStage}>
                {activeDisplayUri ? (
                  <View style={styles.modalImgFrame}>
                    <Image source={{ uri: activeDisplayUri }} style={styles.modalImg} resizeMode="contain" />
                    {!showHeatmap && showAiBox && activeItem.boundingBox && (
                      <View
                        style={{
                          position: 'absolute',
                          left: `${activeItem.boundingBox.x * 100}%`,
                          top: `${activeItem.boundingBox.y * 100}%`,
                          width: `${activeItem.boundingBox.w * 100}%`,
                          height: `${activeItem.boundingBox.h * 100}%`,
                          borderWidth: 2.5,
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.16)',
                          pointerEvents: 'none',
                        }}
                      >
                        <View style={styles.boxFloatingTag}>
                          <Text style={styles.boxFloatingTagText}>
                            AI: {(TUMOR_SHORT_VI[activeItem.predictedClass] || activeItem.predictedClass || 'U').toUpperCase()}
                            {activeItem.confidence != null ? ` (${Math.round(activeItem.confidence)}%)` : ''}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                disabled={safeInspectIdx === items.length - 1}
                onPress={() => setInspectIdx((p) => Math.min(items.length - 1, (p ?? 0) + 1))}
                style={[styles.navArrowBtn, safeInspectIdx === items.length - 1 && { opacity: 0.3 }]}
              >
                <ChevronRight size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {activeItem?.consensusMessage ? (
              <View style={styles.consensusNote}>
                <Activity size={14} color="#4F46E5" />
                <Text style={styles.consensusNoteText} numberOfLines={3}>
                  {stripHtml(activeItem.consensusMessage)}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalFooter}>
              {activeItem?.heatmapUri && (
                <TouchableOpacity
                  onPress={() => setShowHeatmap((v) => !v)}
                  style={[styles.footerBtnDefault, showHeatmap && { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}
                >
                  <Activity size={14} color={showHeatmap ? '#DC2626' : '#1E293B'} />
                  <Text style={[styles.footerBtnText, showHeatmap && { color: '#DC2626' }]}>
                    {showHeatmap ? 'Đang xem Heatmap Grad-CAM' : 'Xem Heatmap Grad-CAM'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setShowAiBox((v) => !v)} style={styles.footerBtnDefault}>
                {showAiBox ? <Eye size={14} color="#1E293B" /> : <EyeOff size={14} color="#1E293B" />}
                <Text style={styles.footerBtnText}>
                  {showAiBox ? 'Đang hiện vùng khoanh AI' : 'Đang ẩn vùng khoanh AI'}
                </Text>
              </TouchableOpacity>

              {typeof onOpenDicomViewer === 'function' && activeItem && (
                <TouchableOpacity
                  onPress={() => {
                    const targetIdx = activeItem.idx;
                    setInspectIdx(null);
                    onOpenDicomViewer(targetIdx);
                  }}
                  style={[styles.footerBtnDefault, { backgroundColor: '#ECFEFF', borderColor: '#22D3EE' }]}
                >
                  <Monitor size={14} color="#0E7490" />
                  <Text style={[styles.footerBtnText, { color: '#0E7490' }]}>Mở trình xem DICOM</Text>
                </TouchableOpacity>
              )}

              {typeof onSelectPrimary === 'function' && activeItem && (
                <TouchableOpacity
                  onPress={() => onSelectPrimary(activeItem.idx)}
                  style={[
                    styles.footerBtnDefault,
                    activeItem.idx === primarySliceIndex && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                  ]}
                >
                  <Star
                    size={14}
                    color={activeItem.idx === primarySliceIndex ? '#FFFFFF' : '#D97706'}
                    fill={activeItem.idx === primarySliceIndex ? '#FFFFFF' : 'none'}
                  />
                  <Text
                    style={[
                      styles.footerBtnText,
                      activeItem.idx === primarySliceIndex && { color: '#FFFFFF' },
                    ]}
                  >
                    {activeItem.idx === primarySliceIndex ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setInspectIdx(null)} style={styles.footerBtnClose}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 14 },
  summaryBanner: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderLeftWidth: 5,
    gap: 12,
  },
  summaryBannerAlert: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderLeftColor: '#DC2626' },
  summaryBannerNormal: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', borderLeftColor: '#059669' },
  summaryTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  summaryHeroTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  summaryHeroTagAlert: { backgroundColor: '#B91C1C' },
  summaryHeroTagNormal: { backgroundColor: '#047857' },
  summaryHeroTagText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', letterSpacing: 0.5 },
  summaryMainVerdictRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontSize: 21, fontWeight: '900', color: '#0F172A', lineHeight: 28 },
  summarySub: { fontSize: 13.5, color: '#334155', lineHeight: 20, marginTop: 4 },
  diffBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  diffTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  diffList: { gap: 8 },
  diffRow: { gap: 4 },
  diffRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffClsLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  diffMetaText: { fontSize: 12.5, fontWeight: '700' },
  diffBarTrack: { width: '100%', height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  diffBarFill: { height: '100%', borderRadius: 999 },
  diffEmptyText: { fontSize: 12.5, color: '#64748B', fontStyle: 'italic' },
  secondaryCardHint: { fontSize: 10.5, fontWeight: '700', color: '#B45309' },
  modalProbStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalProbStripLbl: { fontSize: 12, fontWeight: '700', color: '#334155', marginRight: 4 },
  modalProbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalProbChipPrimary: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  modalProbChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  inspectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inspectAllBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dicomViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#A5F3FC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  dicomViewerBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierBadgeDeep: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  tierBadgeTriage: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  tierBadgeText: { fontSize: 11, fontWeight: '800' },
  consensusNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  consensusNoteText: { flex: 1, fontSize: 12.5, color: '#1E1B4B', lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: 162,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cardPrimary: { borderWidth: 2, borderColor: '#F59E0B' },
  imgStage: {
    width: '100%',
    height: 156,
    backgroundColor: '#020617',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 10,
    paddingHorizontal: 6,
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starBtnActive: { backgroundColor: '#F59E0B' },
  starBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaFooter: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
    backgroundColor: '#FFFFFF',
  },
  clsBadgeText: { fontSize: 11.5, fontWeight: '800' },
  seriesText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalBox: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12.5, color: '#475569', marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInfoBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiPillTumor: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  aiPillNormal: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  aiPillText: { fontSize: 12.5, fontWeight: '800' },
  aiPillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  aiPillNeutralText: { fontSize: 12.5, fontWeight: '700', color: '#334155' },

  modalStageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navArrowBtn: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStage: {
    flex: 1,
    height: 460,
    backgroundColor: '#020617',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImgFrame: {
    height: '100%',
    maxWidth: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  modalImg: { width: '100%', height: '100%' },
  boxFloatingTag: {
    position: 'absolute',
    top: -22,
    left: -2,
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  boxFloatingTagText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },

  modalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  footerBtnDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  footerBtnText: { fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  footerBtnClose: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
  },
});

export default FinalizedSliceGallery;

