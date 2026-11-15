import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  Layers,
  Sliders,
  Ruler,
  Columns,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Edit3,
} from 'lucide-react';
import { get } from '../services/api.service';
import Config from '../constants/config';

const DEFAULT_PRESETS = [
  { id: 'brain_standard', label: 'Não chuẩn (W:80 L:40)', ww: 80, wl: 40, brightness: 100, contrast: 105 },
  { id: 'tumor_flair', label: 'U não / Phù FLAIR (W:140 L:50)', ww: 140, wl: 50, brightness: 106, contrast: 128 },
  { id: 't1_contrast', label: 'T1C+ Ngấm thuốc (W:120 L:60)', ww: 120, wl: 60, brightness: 96, contrast: 142 },
  { id: 'stroke_dwi', label: 'DWI Khuếch tán (W:60 L:30)', ww: 60, wl: 30, brightness: 112, contrast: 155 },
];

const resolveUrl = (raw) => {
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  return `${Config.API_URL}${raw}`;
};

const stripUrlQuery = (raw) => String(raw || '').split(/[?#]/)[0];

const normalizeOverlayBox = (box) => {
  if (!box || typeof box !== 'object') return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width !== undefined ? box.width : box.w);
  const height = Number(box.height !== undefined ? box.height : box.h);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0, Math.min(1 - Math.max(0, x), width)),
    height: Math.max(0, Math.min(1 - Math.max(0, y), height)),
  };
};

export const calculateRanoCategory = (d1Mm, d2Mm, priorCrossProductMm2, radiotherapyEndDate = null) => {
  const d1 = Math.max(0, Number(d1Mm) || 0);
  const d2 = Math.max(0, Number(d2Mm) || 0);
  const crossProductMm2 = Math.round(d1 * d2 * 100) / 100;

  if (!priorCrossProductMm2 || Number(priorCrossProductMm2) <= 0) {
    return { crossProductMm2, changePercent: null, category: 'N/A', isPseudoprogressionSuspected: false };
  }

  const prior = Number(priorCrossProductMm2);
  let changePercent = 0;
  let category = 'SD';

  if (crossProductMm2 === 0) {
    changePercent = -100;
    category = 'CR';
  } else {
    changePercent = Math.round(((crossProductMm2 - prior) / prior) * 1000) / 10;
    if (changePercent <= -50) category = 'PR';
    else if (changePercent >= 25) category = 'PD';
    else category = 'SD';
  }

  let isPseudoprogressionSuspected = false;
  if (category === 'PD' && radiotherapyEndDate) {
    const rt = new Date(radiotherapyEndDate);
    if (!isNaN(rt.getTime())) {
      const days = (Date.now() - rt.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= 84) isPseudoprogressionSuspected = true;
    }
  }

  return { crossProductMm2, changePercent, category, isPseudoprogressionSuspected };
};

const RANO_BADGE_COLORS = {
  CR: { bg: '#065F46', text: '#D1FAE5', label: 'CR — Đáp ứng hoàn toàn (-100%)' },
  PR: { bg: '#1E40AF', text: '#DBEAFE', label: 'PR — Đáp ứng một phần (Giảm ≥ 50%)' },
  SD: { bg: '#374151', text: '#F3F4F6', label: 'SD — Bệnh ổn định (-50% đến +25%)' },
  PD: { bg: '#991B1B', text: '#FEE2E2', label: 'PD — Tiến triển (Tăng ≥ 25%)' },
  'N/A': { bg: '#1E293B', text: '#94A3B8', label: 'Baseline — Lần đo cơ sở' },
};

const DicomWebViewer = ({
  imagingResultId,
  studyId,
  images = [],
  extraImages = [],
  aiResult = null,
  externalManifest = null,
  initialMeasurements = null,
  priorStudyProp = null,
  canMeasure = false,
  onApplyMeasurement = null,
  canEditAiRoi = false,
  manifestRefreshKey = 0,
  externalSliceIndex = null,
  onActiveSliceChange = null,
  onEditSliceRoi = null,
}) => {
  const [manifest, setManifest] = useState(null);
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0);
  const [activeSliceIdx, setActiveSliceIdx] = useState(0);
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [sliceNaturalSize, setSliceNaturalSize] = useState({ width: 512, height: 512 });
  const prevExternalSliceRef = useRef(externalSliceIndex);
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESETS[0]);
  const [invertColors, setInvertColors] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [dualViewport, setDualViewport] = useState(false);
  const [caliperMode, setCaliperMode] = useState(false);

  // Caliper measurements in mm (d1 x d2 perpendicular diameters)
  const [d1Mm, setD1Mm] = useState(
    initialMeasurements?.d1Mm ? String(initialMeasurements.d1Mm) : ''
  );
  const [d2Mm, setD2Mm] = useState(
    initialMeasurements?.d2Mm ? String(initialMeasurements.d2Mm) : ''
  );
  const [d3Mm, setD3Mm] = useState(
    initialMeasurements?.d3Mm ? String(initialMeasurements.d3Mm) : ''
  );
  const [priorCrossProduct, setPriorCrossProduct] = useState(
    initialMeasurements?.priorCrossProductMm2
      ? String(initialMeasurements.priorCrossProductMm2)
      : ''
  );

  // Caliper endpoints (% of viewport box) for visual interactive crosshair lines
  const [line1, setLine1] = useState({ x1: 48, y1: 34, x2: 72, y2: 52 });
  const [line2, setLine2] = useState({ x1: 50, y1: 52, x2: 68, y2: 34 });

  useEffect(() => {
    if (externalManifest) {
      setManifest(externalManifest);
      setActiveSeriesIdx(0);
      setActiveSliceIdx(0);
      if (externalManifest.windowPresets?.[0]) {
        setSelectedPreset(externalManifest.windowPresets[0]);
      }
      return undefined;
    }
    const targetId = studyId || imagingResultId;
    if (!targetId) {
      setManifest(null);
      return undefined;
    }
    let mounted = true;
    get(`/api/v1/dicom/studies/${targetId}/viewer-manifest`)
      .then((res) => {
        if (mounted && res?.success && res?.data) {
          setManifest(res.data);
          if (res.data.priorStudy?.measurements?.crossProductMm2 && !priorCrossProduct) {
            setPriorCrossProduct(String(res.data.priorStudy.measurements.crossProductMm2));
          }
          if (res.data.structuredReport?.measurements?.d1Mm > 0) {
            setD1Mm(String(res.data.structuredReport.measurements.d1Mm));
            setD2Mm(String(res.data.structuredReport.measurements.d2Mm));
            setD3Mm(String(res.data.structuredReport.measurements.d3Mm || 0));
          }
        }
      })
      .catch(() => {
        // Fallback smoothly to local images prop if manifest endpoint not reachable
      });
    return () => {
      mounted = false;
    };
  }, [studyId, imagingResultId, manifestRefreshKey, externalManifest]);

  const seriesList = useMemo(() => {
    if (manifest?.series?.length > 0) return manifest.series;
    const allUrls = Array.from(new Set([...(images || []), ...(extraImages || [])]));
    if (allUrls.length > 0) {
      return [
        {
          seriesId: 'local-series-1',
          seriesType: 'T2_FLAIR',
          seriesDescription: 'Ảnh MRI đã tải lên',
          sliceCount: allUrls.length,
          pixelSpacing: [0.5, 0.5],
          sliceThickness: 3.0,
          slices: allUrls.map((u, idx) => ({ sliceIndex: idx + 1, imageUrl: u })),
        },
      ];
    }
    return [];
  }, [manifest, images, extraImages]);

  const activeSeries = seriesList[activeSeriesIdx] || seriesList[0];
  const slices = activeSeries?.slices?.length
    ? activeSeries.slices
    : (images || []).map((u, idx) => ({ sliceIndex: idx + 1, globalSliceIndex: idx, imageUrl: u }));
  const safeSliceIdx = Math.min(Math.max(0, activeSliceIdx), Math.max(0, slices.length - 1));
  const currentSlice = slices[safeSliceIdx] || { sliceIndex: 1, globalSliceIndex: 0, imageUrl: images?.[0] || '' };

  // Global slice index inside ImagingResult.images (0-based)
  const currentGlobalSliceIdx = useMemo(() => {
    if (typeof currentSlice?.globalSliceIndex === 'number' && currentSlice.globalSliceIndex >= 0) {
      return currentSlice.globalSliceIndex;
    }
    const strippedCurrent = stripUrlQuery(currentSlice?.imageUrl);
    if (strippedCurrent && Array.isArray(images)) {
      const idx = images.findIndex((u) => stripUrlQuery(u) === strippedCurrent);
      if (idx >= 0) return idx;
    }
    if (seriesList.length <= 1) return safeSliceIdx;
    return safeSliceIdx;
  }, [currentSlice, images, seriesList.length, safeSliceIdx]);

  // Normalized per-slice overlays from manifest.aiOverlay.sliceOverlays or fallback aiResult.sliceResults
  const allSliceOverlays = useMemo(() => {
    if (Array.isArray(manifest?.aiOverlay?.sliceOverlays) && manifest.aiOverlay.sliceOverlays.length > 0) {
      return manifest.aiOverlay.sliceOverlays;
    }
    if (Array.isArray(aiResult?.sliceResults) && aiResult.sliceResults.length > 0) {
      return aiResult.sliceResults.map((sr, i) => {
        const idx = typeof sr.sliceIndex === 'number' ? sr.sliceIndex : i;
        const ov = sr.doctorOverride;
        const hasDoctorClass = Boolean(ov && ov.correctedClass);
        const hasDoctorBox = Boolean(ov && ov.correctedBoundingBox);
        const effClass = hasDoctorClass ? ov.correctedClass : (sr.class_name || null);
        const effBox = effClass === 'notumor'
          ? null
          : (hasDoctorBox ? ov.correctedBoundingBox : (hasDoctorClass ? null : (sr.bounding_box || null)));
        return {
          sliceIndex: idx,
          imageUrl: sr.imageUrl || images?.[idx] || '',
          seriesName: sr.seriesName || null,
          sequenceType: sr.sequenceType || null,
          plane: sr.plane || null,
          sliceNumber: sr.sliceNumber ?? null,
          className: effClass,
          aiClassName: sr.class_name || null,
          confidence: sr.confidence ?? null,
          boundingBox: effBox,
          aiBoundingBox: sr.class_name === 'notumor' ? null : (sr.bounding_box || null),
          tumorLocation: sr.tumor_location || null,
          heatmapStreamUrl: sr.heatmapStreamUrl || sr.annotated_image || null,
          isDoctorEdited: Boolean(hasDoctorClass || hasDoctorBox),
          doctorOverride: ov || null,
          consensusMessage: sr.consensus_message || null,
        };
      });
    }
    return [];
  }, [manifest, aiResult, images]);

  const resolveOverlayForSlice = (sl, fallbackIdx) => {
    if (!sl && fallbackIdx === undefined) return null;
    const stripped = stripUrlQuery(sl?.imageUrl);
    const isExtraHeatmap = extraImages?.some((ex) => stripUrlQuery(ex) && stripUrlQuery(ex) === stripped);
    if (isExtraHeatmap) return null;

    if (allSliceOverlays.length > 0) {
      const byUrl = stripped
        ? allSliceOverlays.find((ov) => stripUrlQuery(ov.imageUrl) === stripped)
        : null;
      if (byUrl) return byUrl;
      const gIdx = typeof sl?.globalSliceIndex === 'number' ? sl.globalSliceIndex : fallbackIdx;
      const byIdx = allSliceOverlays.find((ov) => ov.sliceIndex === gIdx);
      if (byIdx) return byIdx;
      return null;
    }

    // Legacy single-image study without sliceResults/sliceOverlays
    const isPrimaryFallback = (typeof sl?.globalSliceIndex === 'number' ? sl.globalSliceIndex : fallbackIdx) === 0;
    if (!isPrimaryFallback) return null;
    const legacyClass = aiResult?.class_name || manifest?.aiOverlay?.className || null;
    const legacyBox = legacyClass === 'notumor'
      ? null
      : (aiResult?.bounding_box || manifest?.aiOverlay?.boundingBox || null);
    if (!legacyClass && !legacyBox && !manifest?.aiOverlay?.available) return null;
    return {
      sliceIndex: 0,
      imageUrl: sl?.imageUrl || images?.[0] || '',
      className: legacyClass,
      aiClassName: legacyClass,
      confidence: aiResult?.confidence ?? manifest?.aiOverlay?.confidence ?? null,
      boundingBox: legacyBox,
      aiBoundingBox: legacyBox,
      heatmapStreamUrl: aiResult?.annotated_image || aiResult?.heatmapStreamUrl || null,
      isDoctorEdited: Boolean(manifest?.aiOverlay?.doctorCorrection?.correctedClass || manifest?.aiOverlay?.doctorCorrection?.correctedBoundingBox),
      doctorOverride: manifest?.aiOverlay?.doctorCorrection || null,
    };
  };

  const activeOverlay = useMemo(
    () => resolveOverlayForSlice(currentSlice, currentGlobalSliceIdx),
    [currentSlice, currentGlobalSliceIdx, allSliceOverlays, aiResult, manifest, extraImages]
  );

  useEffect(() => {
    if (externalSliceIndex === null || externalSliceIndex === undefined) return;
    if (prevExternalSliceRef.current === externalSliceIndex) return;
    prevExternalSliceRef.current = externalSliceIndex;
    if (externalSliceIndex === currentGlobalSliceIdx) return;
    const targetUrl = stripUrlQuery(images?.[externalSliceIndex]);
    for (let sIdx = 0; sIdx < seriesList.length; sIdx++) {
      const sls = seriesList[sIdx]?.slices || [];
      const foundIdx = sls.findIndex(
        (sl, lIdx) =>
          (typeof sl.globalSliceIndex === 'number' && sl.globalSliceIndex === externalSliceIndex) ||
          (targetUrl && stripUrlQuery(sl.imageUrl) === targetUrl) ||
          (seriesList.length === 1 && lIdx === externalSliceIndex)
      );
      if (foundIdx >= 0) {
        setActiveSeriesIdx(sIdx);
        setActiveSliceIdx(foundIdx);
        return;
      }
    }
  }, [externalSliceIndex, seriesList, images, currentGlobalSliceIdx]);

  useEffect(() => {
    if (typeof onActiveSliceChange === 'function') {
      onActiveSliceChange({
        sliceIndex: currentGlobalSliceIdx,
        seriesSliceIndex: safeSliceIdx,
        totalSlices: images?.length || slices.length || 1,
        imageUrl: currentSlice?.imageUrl || '',
        seriesName: activeOverlay?.seriesName || currentSlice?.seriesName || activeSeries?.seriesDescription || activeSeries?.seriesType || '',
        sequenceType: activeOverlay?.sequenceType || activeSeries?.seriesType || '',
        sliceMeta: currentSlice?.metadata || null,
        fileName: currentSlice?.fileName || null,
        overlay: activeOverlay,
      });
    }
  }, [currentGlobalSliceIdx, safeSliceIdx, currentSlice?.imageUrl, activeSeries?.seriesType, activeOverlay]);

  // Windowed Slice Prefetching: Chỉ tải trước các lát cắt lân cận [safeSliceIdx - 2 ... safeSliceIdx + 5]
  // để lăn chuột mượt mà mà không làm nghẽn băng thông mạng nội bộ bệnh viện
  useEffect(() => {
    if (!slices || slices.length <= 1) return;
    const startIdx = Math.max(0, safeSliceIdx - 2);
    const endIdx = Math.min(slices.length - 1, safeSliceIdx + 5);
    for (let i = startIdx; i <= endIdx; i++) {
      if (i === safeSliceIdx) continue;
      const url = resolveUrl(slices[i]?.imageUrl);
      if (url && typeof Image?.prefetch === 'function') {
        Image.prefetch(url).catch(() => {});
      }
    }
  }, [safeSliceIdx, activeSeriesIdx, slices]);

  const priorStudy = manifest?.priorStudy || priorStudyProp || null;
  const effectivePriorCross =
    priorCrossProduct !== ''
      ? Number(priorCrossProduct)
      : priorStudy?.measurements?.crossProductMm2 || null;

  const ranoEval = useMemo(
    () =>
      calculateRanoCategory(
        d1Mm,
        d2Mm,
        effectivePriorCross,
        manifest?.structuredReport?.rano?.radiotherapyEndDate || null
      ),
    [d1Mm, d2Mm, effectivePriorCross, manifest]
  );

  const webFilterOnlyStyle =
    Platform.OS === 'web'
      ? {
          filter: `brightness(${selectedPreset.brightness}%) contrast(${selectedPreset.contrast}%) ${
            invertColors ? 'invert(100%)' : ''
          }`,
        }
      : {};

  const webFilterStyle =
    Platform.OS === 'web'
      ? {
          ...webFilterOnlyStyle,
          transform: [{ scale: zoomLevel }],
        }
      : {
          transform: [{ scale: zoomLevel }],
        };

  const handleWheelScroll = (e) => {
    if (Platform.OS !== 'web' || slices.length <= 1) return;
    if (e?.nativeEvent?.deltaY > 0) {
      setActiveSliceIdx((prev) => Math.min(slices.length - 1, prev + 1));
    } else if (e?.nativeEvent?.deltaY < 0) {
      setActiveSliceIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const handlePushMeasurement = () => {
    if (!onApplyMeasurement) return;
    const numD1 = Number(d1Mm) || 0;
    const numD2 = Number(d2Mm) || 0;
    if (numD1 <= 0 || numD2 <= 0) return;
    onApplyMeasurement({
      d1Mm: numD1,
      d2Mm: numD2,
      d3Mm: Number(d3Mm) || 0,
      crossProductMm2: ranoEval.crossProductMm2,
      priorCrossProductMm2: effectivePriorCross,
      changePercent: ranoEval.changePercent,
      category: ranoEval.category,
      isPseudoprogressionSuspected: ranoEval.isPseudoprogressionSuspected,
      sliceIndex: safeSliceIdx + 1,
      seriesType: activeSeries?.seriesType || 'T1C+',
    });
  };

  const aiClassName = activeOverlay?.className || null;
  const aiRawClassName = activeOverlay?.aiClassName || aiClassName;
  const aiConfidence = activeOverlay?.confidence ?? null;
  const isDoctorEdited = Boolean(activeOverlay?.isDoctorEdited);
  const aiBox = aiClassName === 'notumor' ? null : normalizeOverlayBox(activeOverlay?.boundingBox);
  const aiGhostBox =
    isDoctorEdited && aiRawClassName && aiRawClassName !== 'notumor'
      ? normalizeOverlayBox(activeOverlay?.aiBoundingBox)
      : null;
  const effectiveHeatmapUrl = activeOverlay?.heatmapStreamUrl || null;
  const hasAiData = Boolean(aiClassName && aiClassName !== 'notumor');
  const displayedSliceUri = currentSlice?.imageUrl
    ? resolveUrl(showHeatmap && effectiveHeatmapUrl ? effectiveHeatmapUrl : currentSlice.imageUrl)
    : null;

  useEffect(() => {
    if (!displayedSliceUri || typeof Image?.getSize !== 'function') return;
    let active = true;
    Image.getSize(
      displayedSliceUri,
      (width, height) => {
        if (active && width > 0 && height > 0) {
          setSliceNaturalSize({ width, height });
        }
      },
      () => {}
    );
    return () => {
      active = false;
    };
  }, [displayedSliceUri]);

  const overlayRenderRect = useMemo(() => {
    const cW = canvasLayout.width;
    const cH = canvasLayout.height;
    const nW = sliceNaturalSize.width > 0 ? sliceNaturalSize.width : 512;
    const nH = sliceNaturalSize.height > 0 ? sliceNaturalSize.height : 512;
    if (!cW || !cH) {
      return { left: 0, top: 0, width: '100%', height: '100%' };
    }
    const containerAspect = cW / cH;
    const imageAspect = nW / nH;
    let renderW = cW;
    let renderH = cH;
    let offsetX = 0;
    let offsetY = 0;
    if (containerAspect > imageAspect) {
      renderH = cH;
      renderW = cH * imageAspect;
      offsetX = (cW - renderW) / 2;
    } else {
      renderW = cW;
      renderH = cW / imageAspect;
      offsetY = (cH - renderH) / 2;
    }
    return { left: offsetX, top: offsetY, width: renderW, height: renderH };
  }, [canvasLayout.width, canvasLayout.height, sliceNaturalSize.width, sliceNaturalSize.height]);

  const ranoBadge = RANO_BADGE_COLORS[ranoEval.category] || RANO_BADGE_COLORS['N/A'];

  return (
    <View style={styles.viewerContainer}>
      {/* Top PACS Workstation Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.pacsBadge}>
            <Layers size={14} color="#38BDF8" />
            <Text style={styles.pacsBadgeText}>NEUROSCAN MINI-PACS WEB VIEWER</Text>
          </View>
          <Text style={styles.metaSubText}>
            Chuỗi xung: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{activeSeries?.seriesType}</Text> •{' '}
            PixelSpacing: {(activeSeries?.pixelSpacing || [0.5, 0.5]).join('×')} mm • Độ dày lát:{' '}
            {activeSeries?.sliceThickness || 3.0} mm
          </Text>
        </View>

        {/* Toolbar Actions */}
        <View style={styles.toolbarRow}>
          <TouchableOpacity
            style={[styles.toolBtn, showAiOverlay && styles.toolBtnActivePurple]}
            onPress={() => setShowAiOverlay(!showAiOverlay)}
          >
            {showAiOverlay ? <Eye size={13} color="#E9D5FF" /> : <EyeOff size={13} color="#94A3B8" />}
            <Text style={[styles.toolBtnText, showAiOverlay && { color: '#E9D5FF' }]}>
              AI Overlay {showAiOverlay ? 'BẬT' : 'TẮT'}
            </Text>
          </TouchableOpacity>

          {effectiveHeatmapUrl && (
            <TouchableOpacity
              style={[styles.toolBtn, showHeatmap && styles.toolBtnActiveHeatmap]}
              onPress={() => setShowHeatmap(!showHeatmap)}
            >
              <Activity size={13} color={showHeatmap ? '#FFFFFF' : '#F472B6'} />
              <Text style={[styles.toolBtnText, showHeatmap && { color: '#FFFFFF', fontWeight: '800' }]}>
                {showHeatmap ? 'Đang bật Heatmap' : 'Xem Heatmap'}
              </Text>
            </TouchableOpacity>
          )}

          {canEditAiRoi && typeof onEditSliceRoi === 'function' && (
            <TouchableOpacity
              style={[styles.toolBtn, styles.toolBtnActiveEdit]}
              onPress={() =>
                onEditSliceRoi({
                  sliceIndex: currentGlobalSliceIdx,
                  seriesSliceIndex: safeSliceIdx,
                  imageUrl: currentSlice?.imageUrl || '',
                  seriesName: activeOverlay?.seriesName || currentSlice?.seriesName || activeSeries?.seriesType || '',
                  overlay: activeOverlay,
                })
              }
            >
              <Edit3 size={13} color="#FDE68A" />
              <Text style={[styles.toolBtnText, { color: '#FEF3C7', fontWeight: '800' }]}>
                Hiệu chỉnh ROI lát này
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.toolBtn, caliperMode && styles.toolBtnActiveCyan]}
            onPress={() => setCaliperMode(!caliperMode)}
          >
            <Ruler size={13} color={caliperMode ? '#0F172A' : '#38BDF8'} />
            <Text style={[styles.toolBtnText, caliperMode && { color: '#0F172A', fontWeight: '800' }]}>
              Thước đo RANO (2D Caliper)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, dualViewport && styles.toolBtnActiveAmber]}
            onPress={() => setDualViewport(!dualViewport)}
          >
            <Columns size={13} color={dualViewport ? '#0F172A' : '#FBBF24'} />
            <Text style={[styles.toolBtnText, dualViewport && { color: '#0F172A', fontWeight: '800' }]}>
              So sánh phim cũ (Dual-View)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, invertColors && styles.toolBtnActive]}
            onPress={() => setInvertColors(!invertColors)}
          >
            <Sliders size={13} color="#CBD5E1" />
            <Text style={styles.toolBtnText}>Âm bản</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setZoomLevel((z) => Math.min(2.4, Math.round((z + 0.2) * 10) / 10))}
          >
            <ZoomIn size={14} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setZoomLevel((z) => Math.max(0.8, Math.round((z - 0.2) * 10) / 10))}
          >
            <ZoomOut size={14} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setZoomLevel(1.0);
              setInvertColors(false);
              setSelectedPreset(DEFAULT_PRESETS[0]);
            }}
          >
            <RotateCcw size={14} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Series Selector + Window/Level Presets Row */}
      <View style={styles.subToolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesTabs}>
          {seriesList.map((s, idx) => {
            const isSelected = idx === activeSeriesIdx;
            return (
              <TouchableOpacity
                key={s.seriesId || idx}
                style={[styles.seriesTab, isSelected && styles.seriesTabActive]}
                onPress={() => {
                  setActiveSeriesIdx(idx);
                  setActiveSliceIdx(0);
                }}
              >
                <Text style={[styles.seriesTabTitle, isSelected && styles.seriesTabTitleActive]}>
                  {s.seriesType}
                </Text>
                <Text style={styles.seriesTabSub}>{s.sliceCount || 1} lát cắt</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetTabs}>
          {(manifest?.windowPresets || DEFAULT_PRESETS).map((preset) => {
            const active = selectedPreset.id === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => setSelectedPreset(preset)}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Viewport Area (Single or Dual Side-by-Side Comparison) */}
      <View style={[styles.viewportGrid, dualViewport && styles.viewportGridDual]}>
        {/* Primary Viewport: Current Study */}
        <View
          style={[styles.viewportBox, dualViewport && styles.viewportHalf]}
          {...(Platform.OS === 'web' ? { onWheel: handleWheelScroll } : {})}
        >
          {/* Corner HUD Overlays (Standard PACS DICOM Tag Overlay) */}
          <View style={styles.hudTopLeft}>
            <Text style={styles.hudTextBold}>{manifest?.patientName || 'BỆNH NHÂN KHOA U NÃO'}</Text>
            <Text style={styles.hudText}>ID: {manifest?.medicalId || 'N/A'}</Text>
            <Text style={styles.hudText}>{activeSeries?.seriesDescription || activeSeries?.seriesType}</Text>
          </View>

          <View style={styles.hudTopRight}>
            <Text style={styles.hudText}>KỲ HIỆN TẠI (CURRENT)</Text>
            <Text style={styles.hudText}>
              WW: {selectedPreset.ww} / WL: {selectedPreset.wl}
            </Text>
            <Text style={styles.hudText}>Zoom: {Math.round(zoomLevel * 100)}%</Text>
          </View>

          {/* Slice Image */}
          <View
            style={styles.canvasCenter}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setCanvasLayout({ width, height });
              }
            }}
          >
            {displayedSliceUri ? (
              <View style={[styles.canvasZoomWrap, { transform: [{ scale: zoomLevel }] }]}>
                <Image
                  source={{ uri: displayedSliceUri }}
                  style={[styles.dicomImage, webFilterOnlyStyle]}
                  resizeMode="contain"
                  onLoad={(e) => {
                    const w = e?.nativeEvent?.source?.width;
                    const h = e?.nativeEvent?.source?.height;
                    if (w > 0 && h > 0) {
                      setSliceNaturalSize({ width: w, height: h });
                    }
                  }}
                />
                <View pointerEvents="none" style={[styles.overlayRenderBox, overlayRenderRect]}>
                  {/* Original AI Ghost Box when Doctor has overridden the box */}
                  {showAiOverlay && isDoctorEdited && aiGhostBox && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.aiGhostBoundingBox,
                        {
                          left: `${(aiGhostBox.x * 100).toFixed(1)}%`,
                          top: `${(aiGhostBox.y * 100).toFixed(1)}%`,
                          width: `${(aiGhostBox.width * 100).toFixed(1)}%`,
                          height: `${(aiGhostBox.height * 100).toFixed(1)}%`,
                        },
                      ]}
                    >
                      <View style={styles.aiGhostTag}>
                        <Text style={styles.aiGhostTagText}>
                          AI gốc: {(aiRawClassName || 'TUMOR').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Effective Tumor Bounding Box Overlay (Doctor-corrected or AI) */}
                  {showAiOverlay && hasAiData && aiBox && (
                    <View
                      pointerEvents="none"
                      style={[
                        isDoctorEdited ? styles.doctorBoundingBox : styles.aiBoundingBox,
                        {
                          left: `${(aiBox.x * 100).toFixed(1)}%`,
                          top: `${(aiBox.y * 100).toFixed(1)}%`,
                          width: `${(aiBox.width * 100).toFixed(1)}%`,
                          height: `${(aiBox.height * 100).toFixed(1)}%`,
                        },
                      ]}
                    >
                      <View style={isDoctorEdited ? styles.doctorBoxTag : styles.aiBoxTag}>
                        {isDoctorEdited ? (
                          <Edit3 size={10} color="#FFFFFF" />
                        ) : (
                          <Activity size={10} color="#FFFFFF" />
                        )}
                        <Text style={styles.aiBoxTagText}>
                          {isDoctorEdited ? 'BS HIỆU CHỈNH: ' : 'AI: '}
                          {(aiClassName || 'TUMOR').toUpperCase()}
                          {!isDoctorEdited && aiConfidence ? ` (${aiConfidence}%)` : ''}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
                {currentSlice?.unreadPixelReason || 'Chưa có ảnh lát cắt'}
              </Text>
            )}

            {/* Status badge when active slice AI is notumor or no box */}
            {showAiOverlay && activeOverlay?.className === 'notumor' && (
              <View
                pointerEvents="none"
                style={[
                  styles.sliceStatusPill,
                  isDoctorEdited && { borderColor: '#F59E0B', backgroundColor: 'rgba(120, 53, 15, 0.85)' },
                ]}
              >
                <CheckCircle2 size={11} color={isDoctorEdited ? '#FDE68A' : '#6EE7B7'} />
                <Text style={styles.sliceStatusPillText}>
                  {isDoctorEdited
                    ? `BS hiệu chỉnh: KHÔNG THẤY U${aiRawClassName && aiRawClassName !== 'notumor' ? ` (AI cũ: ${aiRawClassName.toUpperCase()})` : ''}`
                    : `AI lát #${currentGlobalSliceIdx + 1}: Bình thường${aiConfidence ? ` (${aiConfidence}%)` : ''}`}
                </Text>
              </View>
            )}

            {/* 2D RANO Caliper Perpendicular Crosshair Overlay */}
            {caliperMode && Boolean(Number(d1Mm) && Number(d2Mm)) && (
              <View pointerEvents="none" style={styles.caliperOverlay}>
                <View style={styles.caliperTargetBox}>
                  <View style={styles.caliperLineHorizontal} />
                  <View style={styles.caliperLineVertical} />
                  <View style={styles.caliperLabelBadge}>
                    <Text style={styles.caliperLabelText}>
                      d₁={d1Mm}mm × d₂={d2Mm}mm ({ranoEval.crossProductMm2} mm²)
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.hudBottomLeft}>
            <Text style={styles.hudSliceBadge}>
              Lát cắt (Slice): {safeSliceIdx + 1} / {slices.length}
              {seriesList.length > 1 ? ` (Tổng #${currentGlobalSliceIdx + 1})` : ''}
              {activeOverlay?.seriesName ? ` • ${activeOverlay.seriesName}` : ''}
            </Text>
          </View>

          <View style={styles.hudBottomRight}>
            <Text style={styles.hudOrientationText}>R — L | A — P</Text>
          </View>
        </View>

        {/* Secondary Viewport: Prior Study (Longitudinal RANO Comparison) */}
        {dualViewport && (
          <View style={[styles.viewportBox, styles.viewportHalf, { borderLeftWidth: 2, borderLeftColor: '#334155' }]}>
            <View style={styles.hudTopLeft}>
              <Text style={[styles.hudTextBold, { color: '#FBBF24' }]}>
                PHIM KỲ TRƯỚC (PRIOR BASELINE)
              </Text>
              <Text style={styles.hudText}>
                Ngày chụp:{' '}
                {priorStudy?.reportDate
                  ? new Date(priorStudy.reportDate).toLocaleDateString('vi-VN')
                  : 'Cơ sở đối chiếu'}
              </Text>
              <Text style={styles.hudText}>
                Kích thước cũ:{' '}
                {effectivePriorCross ? `${effectivePriorCross} mm²` : 'Chưa có số đo kỳ trước'}
              </Text>
            </View>

            <View style={styles.hudTopRight}>
              <View style={[styles.ranoMiniPill, { backgroundColor: ranoBadge.bg }]}>
                <Text style={[styles.ranoMiniPillText, { color: ranoBadge.text }]}>
                  RANO: {ranoEval.category}
                  {ranoEval.changePercent !== null
                    ? ` (${ranoEval.changePercent > 0 ? '+' : ''}${ranoEval.changePercent}%)`
                    : ''}
                </Text>
              </View>
            </View>

            <View style={styles.canvasCenter}>
              {priorStudy?.representativeSliceUrl || priorStudy?.images?.[0] || currentSlice?.imageUrl ? (
                <Image
                  source={{
                    uri: resolveUrl(
                      priorStudy?.representativeSliceUrl ||
                        priorStudy?.images?.[0] ||
                        currentSlice?.imageUrl
                    ),
                  }}
                  style={[styles.dicomImage, webFilterStyle]}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#64748B', fontSize: 12 }}>Chưa có ảnh phim kỳ trước</Text>
              )}
            </View>

            <View style={styles.hudBottomLeft}>
              <Text style={styles.hudText}>
                {priorStudy?.conclusion
                  ? `Kết luận cũ: ${priorStudy.conclusion}`
                  : 'So sánh đồng bộ lát cắt T1C+ / FLAIR'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Slice Stack Scrubber Bar */}
      <View style={styles.scrubberBar}>
        <TouchableOpacity
          style={styles.sliceStepBtn}
          onPress={() => setActiveSliceIdx((prev) => Math.max(0, prev - 1))}
          disabled={safeSliceIdx <= 0}
        >
          <ChevronLeft size={16} color="#E2E8F0" />
          <Text style={styles.sliceStepText}>Lát trước</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sliceDotsRow}>
          {slices.map((sl, idx) => {
            const active = idx === safeSliceIdx;
            const slOverlay = resolveOverlayForSlice(sl, idx);
            const hasTumor = Boolean(slOverlay?.className && slOverlay.className !== 'notumor');
            const edited = Boolean(slOverlay?.isDoctorEdited);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.slicePill, active && styles.slicePillActive]}
                onPress={() => setActiveSliceIdx(idx)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {(hasTumor || edited) && (
                    <View
                      style={[
                        styles.sliceTumorDot,
                        { backgroundColor: edited ? '#F59E0B' : '#EF4444' },
                      ]}
                    />
                  )}
                  <Text style={[styles.slicePillText, active && styles.slicePillTextActive]}>
                    #{idx + 1}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.sliceStepBtn}
          onPress={() => setActiveSliceIdx((prev) => Math.min(slices.length - 1, prev + 1))}
          disabled={safeSliceIdx >= slices.length - 1}
        >
          <Text style={styles.sliceStepText}>Lát tiếp</Text>
          <ChevronRight size={16} color="#E2E8F0" />
        </TouchableOpacity>
      </View>

      {/* Interactive 2D Caliper & RANO Calculator Panel */}
      {(caliperMode || dualViewport) && (
        <View style={styles.caliperPanel}>
          <View style={styles.caliperHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ruler size={16} color="#38BDF8" />
              <Text style={styles.caliperPanelTitle}>
                THƯỚC ĐO HAI ĐƯỜNG KÍNH VUÔNG GÓC (d₁ × d₂) & ĐÁNH GIÁ ĐÁP ỨNG RANO
              </Text>
            </View>
            <View style={[styles.ranoStatusChip, { backgroundColor: ranoBadge.bg }]}>
              <Text style={[styles.ranoStatusChipText, { color: ranoBadge.text }]}>
                {ranoBadge.label}
              </Text>
            </View>
          </View>

          <View style={styles.caliperInputsRow}>
            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Đường kính dài nhất d₁ (mm)</Text>
              <TextInput
                style={styles.caliperInput}
                keyboardType="numeric"
                value={d1Mm}
                onChangeText={setD1Mm}
                placeholder="VD: 34"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Đường kính vuông góc d₂ (mm)</Text>
              <TextInput
                style={styles.caliperInput}
                keyboardType="numeric"
                value={d2Mm}
                onChangeText={setD2Mm}
                placeholder="VD: 28"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Trục dọc Coronal d₃ (mm)</Text>
              <TextInput
                style={styles.caliperInput}
                keyboardType="numeric"
                value={d3Mm}
                onChangeText={setD3Mm}
                placeholder="VD: 25"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Tích d₁×d₂ kỳ hiện tại</Text>
              <View style={styles.caliperComputedBox}>
                <Text style={styles.caliperComputedVal}>{ranoEval.crossProductMm2} mm²</Text>
              </View>
            </View>

            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Tích d₁×d₂ kỳ trước (mm²)</Text>
              <TextInput
                style={styles.caliperInput}
                keyboardType="numeric"
                value={priorCrossProduct}
                onChangeText={setPriorCrossProduct}
                placeholder="Tự động / Nhập tay"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.caliperInputGroup}>
              <Text style={styles.caliperInputLabel}>Biến thiên RANO (Δ%)</Text>
              <View style={styles.caliperComputedBox}>
                <Text
                  style={[
                    styles.caliperComputedVal,
                    ranoEval.changePercent !== null && {
                      color:
                        ranoEval.changePercent >= 25
                          ? '#FCA5A5'
                          : ranoEval.changePercent <= -50
                          ? '#6EE7B7'
                          : '#E2E8F0',
                    },
                  ]}
                >
                  {ranoEval.changePercent !== null
                    ? `${ranoEval.changePercent > 0 ? '+' : ''}${ranoEval.changePercent}% (${ranoEval.category})`
                    : 'Baseline'}
                </Text>
              </View>
            </View>
          </View>

          {ranoEval.isPseudoprogressionSuspected && (
            <View style={styles.pseudoWarningBanner}>
              <AlertTriangle size={15} color="#FDE047" />
              <Text style={styles.pseudoWarningText}>
                CẢNH BÁO RANO (Pseudoprogression): Khối u tăng kích thước ≥ 25% nhưng bệnh nhân đang trong vòng 12 tuần sau kết thúc xạ trị (Temozolomide + RT). Cần phân biệt Giả tiến triển do hoại tử bức xạ trước khi kết luận thất bại phác đồ!
              </Text>
            </View>
          )}

          {canMeasure && onApplyMeasurement && Boolean(Number(d1Mm) && Number(d2Mm)) && (
            <TouchableOpacity style={styles.pushReportBtn} onPress={handlePushMeasurement}>
              <CheckCircle2 size={15} color="#0F172A" />
              <Text style={styles.pushReportBtnText}>
                📥 Đẩy số đo ({d1Mm}×{d2Mm} mm = {ranoEval.crossProductMm2} mm² • RANO: {ranoEval.category}) vào Báo cáo CĐHA
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  viewerContainer: {
    backgroundColor: '#0B1120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    marginBottom: 18,
  },
  topHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 2,
  },
  pacsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pacsBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metaSubText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toolBtnActive: {
    backgroundColor: '#334155',
    borderColor: '#94A3B8',
  },
  toolBtnActivePurple: {
    backgroundColor: '#4C1D95',
    borderColor: '#8B5CF6',
  },
  toolBtnActiveHeatmap: {
    backgroundColor: '#9D174D',
    borderColor: '#F472B6',
  },
  toolBtnActiveEdit: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  toolBtnActiveCyan: {
    backgroundColor: '#38BDF8',
    borderColor: '#7DD3FC',
  },
  toolBtnActiveAmber: {
    backgroundColor: '#FBBF24',
    borderColor: '#FDE68A',
  },
  toolBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  subToolbar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  seriesTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  seriesTab: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  seriesTabActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  seriesTabTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  seriesTabTitleActive: {
    color: '#FFFFFF',
  },
  seriesTabSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  presetTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#2DD4BF',
  },
  presetChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#F0FDFA',
  },
  viewportGrid: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    minHeight: 390,
  },
  viewportGridDual: {
    minHeight: 390,
  },
  viewportBox: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 390,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  viewportHalf: {
    flex: 1,
  },
  canvasCenter: {
    width: '100%',
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  canvasZoomWrap: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  overlayRenderBox: {
    position: 'absolute',
  },
  dicomImage: {
    width: '100%',
    height: '100%',
  },
  hudTopLeft: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 10,
  },
  hudTopRight: {
    position: 'absolute',
    top: 10,
    right: 12,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  hudBottomLeft: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    zIndex: 10,
  },
  hudBottomRight: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    zIndex: 10,
  },
  hudTextBold: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  hudText: {
    color: '#CBD5E1',
    fontSize: 10,
    marginTop: 1,
  },
  hudSliceBadge: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  hudOrientationText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  aiBoundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderRadius: 4,
  },
  doctorBoundingBox: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderRadius: 4,
  },
  aiGhostBoundingBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(239, 68, 68, 0.75)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 4,
  },
  aiGhostTag: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    backgroundColor: 'rgba(127, 29, 29, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  aiGhostTagText: {
    color: '#FECACA',
    fontSize: 8,
    fontWeight: '700',
  },
  doctorBoxTag: {
    position: 'absolute',
    top: -20,
    left: 0,
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sliceStatusPill: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sliceStatusPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  aiBoxTag: {
    position: 'absolute',
    top: -20,
    left: 0,
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiBoxTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  caliperOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caliperTargetBox: {
    width: 140,
    height: 115,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  caliperLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#22D3EE',
  },
  caliperLineVertical: {
    position: 'absolute',
    height: '100%',
    width: 2,
    backgroundColor: '#FACC15',
  },
  caliperLabelBadge: {
    position: 'absolute',
    bottom: -24,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  caliperLabelText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  ranoMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ranoMiniPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrubberBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 8,
  },
  sliceStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  sliceStepText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sliceDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slicePill: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  sliceTumorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  slicePillActive: {
    backgroundColor: '#38BDF8',
  },
  slicePillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  slicePillTextActive: {
    color: '#0F172A',
  },
  caliperPanel: {
    padding: 14,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  caliperHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  caliperPanelTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  ranoStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ranoStatusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  caliperInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  caliperInputGroup: {
    flex: 1,
    minWidth: 135,
  },
  caliperInputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  caliperInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  caliperComputedBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  caliperComputedVal: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  pseudoWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#CA8A04',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  pseudoWarningText: {
    color: '#FEF08A',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  pushReportBtn: {
    backgroundColor: '#38BDF8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pushReportBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default DicomWebViewer;
