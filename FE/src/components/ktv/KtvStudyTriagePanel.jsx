import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  CheckCircle2,
  FileArchive,
  FolderOpen,
  Layers,
  Maximize2,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { imagingApi } from '../../api/endpoints/imaging.api';
import Config from '../../constants/config';

const IMAGE_EXT_REGEX = /\.(jpe?g|png|bmp|webp)$/i;
const IGNORE_FOLDER_TOKENS = [
  'localizer',
  'localiser',
  'scout',
  'screen_save',
  'screensave',
  'scrsave',
  'calib',
  'calibration',
  'survey',
  '__macosx',
];

const PROTOCOL_OPTIONS = [
  { code: 'BRAIN_TUMOR_NON_CONTRAST', label: 'Thường quy (Không thuốc)' },
  { code: 'BRAIN_TUMOR_CORE_CONTRAST', label: 'U não có tiêm thuốc (T1C+)' },
  { code: 'BRAIN_TUMOR_POST_OP', label: 'Theo dõi sau phẫu thuật' },
  { code: 'STROKE_DIFFUSION', label: 'Đột quỵ / Khuếch tán (DWI)' },
];

const CLASS_LABEL_VI = {
  glioma: 'U thần kinh đệm',
  meningioma: 'U màng não',
  pituitary: 'U tuyến yên',
  notumor: 'Không thấy u',
};

const CLASS_BAR_COLOR = {
  glioma: '#DC2626',
  meningioma: '#D97706',
  pituitary: '#7C3AED',
  notumor: '#059669',
};

const getSortedProbEntries = (probabilities, predictedClass, confidence) => {
  if (probabilities && typeof probabilities === 'object') {
    const entries = Object.entries(probabilities)
      .map(([cls, val]) => {
        const key = String(cls).toLowerCase();
        const num = Number(val);
        const pct = Number.isFinite(num) ? (num <= 1 && Math.max(...Object.values(probabilities).map(Number)) <= 1 ? num * 100 : num) : 0;
        return {
          className: key,
          label: CLASS_LABEL_VI[key] || key,
          pct: Math.max(0, Math.min(100, Math.round(pct * 10) / 10)),
          color: CLASS_BAR_COLOR[key] || '#4F46E5',
        };
      })
      .sort((a, b) => b.pct - a.pct);
    if (entries.length > 0) return entries;
  }
  const fallbackCls = String(predictedClass || 'notumor').toLowerCase();
  const fallbackPct = Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(100, Number(confidence))) : 0;
  return [
    {
      className: fallbackCls,
      label: CLASS_LABEL_VI[fallbackCls] || fallbackCls,
      pct: Math.round(fallbackPct * 10) / 10,
      color: CLASS_BAR_COLOR[fallbackCls] || '#4F46E5',
    },
  ];
};

const MAX_SELECTED_SLICES = 15;
const BATCH_SIZE = 40;

const sanitizeClientRelPath = (raw = '') =>
  String(raw || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/');

const isIgnoredFolderPath = (relPath = '') => {
  const lower = String(relPath || '').toLowerCase();
  const lastSlash = lower.lastIndexOf('/');
  const folder = lastSlash >= 0 ? lower.slice(0, lastSlash) : '';
  return IGNORE_FOLDER_TOKENS.some((tok) => folder.includes(tok));
};

// Recursively read files from HTML5 DataTransferItem entries when user drags an entire MRI folder
const readEntryRecursive = async (entry, prefix = '') => {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => {
          const relPath = sanitizeClientRelPath(prefix ? `${prefix}/${file.name}` : file.name);
          resolve([{ file, relativePath: relPath }]);
        },
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const readAllEntries = () =>
      new Promise((resolve) => {
        const all = [];
        const pump = () => {
          reader.readEntries(
            (batch) => {
              if (!batch || batch.length === 0) resolve(all);
              else {
                all.push(...batch);
                pump();
              }
            },
            () => resolve(all)
          );
        };
        pump();
      });

    const children = await readAllEntries();
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const nested = await Promise.all(children.map((ch) => readEntryRecursive(ch, nextPrefix)));
    return nested.flat();
  }
  return [];
};

const extractDropEntries = async (dataTransfer) => {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
    .filter(Boolean);

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((ent) => readEntryRecursive(ent, '')));
    return nested.flat();
  }

  return Array.from(dataTransfer?.files || []).map((file) => ({
    file,
    relativePath: sanitizeClientRelPath(file.webkitRelativePath || file.name),
  }));
};

export default function KtvStudyTriagePanel({ visit, onComplete }) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const cardWidth = winWidth >= 960 ? 206 : winWidth >= 640 ? 182 : 156;
  const listMaxHeight = Math.max(460, Math.min(720, Math.round(winHeight * 0.62)));

  const initialContrast = Boolean(visit?.mriOrder?.withContrast);
  const initialProtocol =
    visit?.mriOrder?.protocolCode ||
    (initialContrast ? 'BRAIN_TUMOR_CORE_CONTRAST' : 'BRAIN_TUMOR_NON_CONTRAST');

  const [protocolCode, setProtocolCode] = useState(initialProtocol);
  const [withContrast, setWithContrast] = useState(initialContrast);
  const [stage, setStage] = useState('idle'); // 'idle' | 'uploading' | 'screening' | 'review' | 'finalizing'
  const [statusMessage, setStatusMessage] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const [sessionId, setSessionId] = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [seriesFilter, setSeriesFilter] = useState('all'); // 'all' | 'tumor_only' | <seriesName>
  const [dragOver, setDragOver] = useState(false);
  const [zoomCandidate, setZoomCandidate] = useState(null);
  const [deepAiProgress, setDeepAiProgress] = useState({ done: 0, total: 0 });

  const dropRef = useRef(null);
  const activeSessionRef = useRef(null);

  useEffect(() => {
    const nextContrast = Boolean(visit?.mriOrder?.withContrast);
    const nextProtocol =
      visit?.mriOrder?.protocolCode ||
      (nextContrast ? 'BRAIN_TUMOR_CORE_CONTRAST' : 'BRAIN_TUMOR_NON_CONTRAST');
    setWithContrast(nextContrast);
    setProtocolCode(nextProtocol);
  }, [visit?._id]);

  // Clean up unfinalized staging session on unmount
  useEffect(() => {
    return () => {
      const sid = activeSessionRef.current;
      if (sid) {
        imagingApi.cancelTriage(sid).catch(() => {});
        activeSessionRef.current = null;
      }
    };
  }, []);

  const notifyError = (msg) => {
    setErrorMsg(msg);
    if (Platform.OS !== 'web') {
      Alert.alert('Lỗi sàng lọc ảnh MRI', msg);
    }
  };

  const applyTriageResponse = (data, sid) => {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const preselected = candidates.filter((c) => c.preselected).map((c) => c.sliceKey);
    const defaultKeys = preselected.length > 0 ? preselected : candidates.slice(0, 10).map((c) => c.sliceKey);

    setSessionId(sid);
    activeSessionRef.current = sid;
    setTriageResult(data);
    setSelectedKeys(defaultKeys);
    setPrimaryKey(defaultKeys[0] || candidates[0]?.sliceKey || null);
    setSeriesFilter('all');
    setStage('review');
    setProgressPct(100);
    setStatusMessage('');
  };

  /** Runs detailed 3-CNN Ensemble + YOLOv8 + bounded Gemini VLM across all valid slices in the session. */
  const executeDetailedStudyAi = async (sid, pct, loadingMsg, fallbackErr) => {
    setStage('screening');
    setProgressPct(pct);
    setStatusMessage(loadingMsg);

    const runRes = await imagingApi.runTriage(sid, {
      protocolCode,
      withContrast,
      topK: 10,
      candidateLimit: 120,
      geminiConflictLimit: 5,
    });

    if (!runRes?.success || !runRes?.data) {
      throw new Error(runRes?.message || fallbackErr);
    }

    applyTriageResponse(runRes.data, sid);
  };

  const runFolderEntriesIngestion = async (rawEntries) => {
    setErrorMsg('');
    if (!rawEntries || rawEntries.length === 0) return;

    // If user dropped a single .zip file via drag-and-drop, route straight to ZIP ingestion
    if (rawEntries.length === 1 && /\.zip$/i.test(rawEntries[0].file?.name || '')) {
      await runZipIngestion(rawEntries[0].file);
      return;
    }

    const validEntries = [];
    let clientIgnoredCount = 0;
    let nonImageCount = 0;

    for (const item of rawEntries) {
      const rel = sanitizeClientRelPath(item.relativePath || item.file?.webkitRelativePath || item.file?.name);
      if (!IMAGE_EXT_REGEX.test(rel)) {
        nonImageCount += 1;
        continue;
      }
      if (isIgnoredFolderPath(rel)) {
        clientIgnoredCount += 1;
        continue;
      }
      validEntries.push({ file: item.file, relativePath: rel });
    }

    if (validEntries.length === 0) {
      notifyError(
        `Không còn ảnh chẩn đoán hợp lệ sau khi lọc (${clientIgnoredCount} ảnh định vị/localizer, ${nonImageCount} tệp khác).`
      );
      return;
    }

    // Cancel prior unfinalized session if user re-imports
    if (activeSessionRef.current) {
      imagingApi.cancelTriage(activeSessionRef.current).catch(() => {});
      activeSessionRef.current = null;
    }

    setStage('uploading');
    setProgressPct(4);
    setStatusMessage(
      `Tìm thấy ${rawEntries.length} tệp • Đã loại nhanh ${clientIgnoredCount} ảnh Localizer/ScreenSave • Chuẩn bị nạp ${validEntries.length} lát cắt...`
    );

    let createdSid = null;
    try {
      const patientId =
        visit?.patientId?._id || (typeof visit?.patientId === 'string' ? visit.patientId : null);

      const initRes = await imagingApi.initTriage({
        visitId: visit?._id || null,
        patientId,
        protocolCode,
        withContrast,
        clientIgnoredCount,
      });

      const sid = initRes?.data?.sessionId;
      if (!sid) throw new Error(initRes?.message || 'Không khởi tạo được phiên sàng lọc.');
      createdSid = sid;
      activeSessionRef.current = sid;

      const total = validEntries.length;
      for (let start = 0; start < total; start += BATCH_SIZE) {
        const chunk = validEntries.slice(start, start + BATCH_SIZE);
        const fd = new FormData();
        const rels = [];
        for (const entry of chunk) {
          fd.append('files', entry.file, entry.file.name || 'slice.jpg');
          rels.push(entry.relativePath);
        }
        fd.append('relativePaths', JSON.stringify(rels));

        const batchRes = await imagingApi.uploadTriageBatch(sid, fd);
        if (!batchRes?.success) {
          throw new Error(batchRes?.message || 'Lỗi tải lô ảnh lên máy chủ.');
        }

        const sent = Math.min(total, start + chunk.length);
        setProgressPct(Math.round((sent / total) * 65));
        setStatusMessage(`Đang nạp & kiểm tra chất lượng lát cắt: ${sent}/${total} ảnh...`);
      }

      await executeDetailedStudyAi(
        sid,
        78,
        `AI chi tiết (3-CNN Ensemble + YOLOv8 + Gemini VLM giới hạn) đang phân tích toàn bộ ${total} lát cắt theo protocol ${protocolCode}...`,
        'AI không trả về danh sách lát cắt ứng viên.'
      );
    } catch (err) {
      if (createdSid) {
        imagingApi.cancelTriage(createdSid).catch(() => {});
        activeSessionRef.current = null;
      }
      setStage('idle');
      setProgressPct(0);
      setStatusMessage('');
      notifyError(err?.message || 'Không thể sàng lọc thư mục ảnh MRI.');
    }
  };

  const runZipIngestion = async (file) => {
    setErrorMsg('');
    if (!file) return;
    if (!/\.zip$/i.test(file.name || '')) {
      notifyError('Vui lòng chọn tệp nén định dạng .zip để giải nén và sàng lọc tự động.');
      return;
    }
    if (file.size > 600 * 1024 * 1024) {
      notifyError('Tệp .zip vượt quá giới hạn tối đa 600MB.');
      return;
    }

    if (activeSessionRef.current) {
      imagingApi.cancelTriage(activeSessionRef.current).catch(() => {});
      activeSessionRef.current = null;
    }

    setStage('uploading');
    setProgressPct(20);
    setStatusMessage(`Đang tải tệp nén ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB) lên bộ lọc...`);

    let createdSid = null;
    try {
      const patientId =
        visit?.patientId?._id || (typeof visit?.patientId === 'string' ? visit.patientId : null);

      const initRes = await imagingApi.initTriage({
        visitId: visit?._id || null,
        patientId,
        protocolCode,
        withContrast,
      });

      const sid = initRes?.data?.sessionId;
      if (!sid) throw new Error('Không khởi tạo được phiên sàng lọc ZIP.');
      createdSid = sid;
      activeSessionRef.current = sid;

      const fd = new FormData();
      fd.append('archive', file);
      const upRes = await imagingApi.uploadTriageZip(sid, fd);
      if (!upRes?.success) {
        throw new Error(upRes?.message || 'Không thể giải nén tệp ZIP.');
      }

      const added = upRes?.data?.addedSlices || 0;
      const ignored = upRes?.data?.ignoredSequencesInZip || 0;
      await executeDetailedStudyAi(
        sid,
        75,
        `Đã giải nén ${added} lát chẩn đoán (bỏ ${ignored} ảnh định vị). AI chi tiết đang phân tích toàn bộ lát cắt...`,
        'AI phân tích ZIP thất bại.'
      );
    } catch (err) {
      if (createdSid) {
        imagingApi.cancelTriage(createdSid).catch(() => {});
        activeSessionRef.current = null;
      }
      setStage('idle');
      setProgressPct(0);
      setStatusMessage('');
      notifyError(err?.message || 'Lỗi xử lý tệp ZIP.');
    }
  };

  // Attach native HTML5 folder drag-and-drop listeners on Web
  const runFolderRef = useRef(runFolderEntriesIngestion);
  runFolderRef.current = runFolderEntriesIngestion;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = dropRef.current;
    if (!node || typeof node.addEventListener !== 'function') return undefined;

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const entries = await extractDropEntries(e.dataTransfer);
      if (entries.length > 0) {
        runFolderRef.current(entries);
      }
    };

    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);
    return () => {
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    };
  }, [stage]);

  const handlePickFolderWeb = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.directory = true;
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const entries = files.map((file) => ({
        file,
        relativePath: sanitizeClientRelPath(file.webkitRelativePath || file.name),
      }));
      await runFolderEntriesIngestion(entries);
    };
    input.click();
  };

  const handlePickZip = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) await runZipIngestion(file);
      };
      input.click();
    } else {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      await runZipIngestion({
        uri: asset.uri,
        name: asset.name || 'study.zip',
        type: asset.mimeType || 'application/zip',
        size: asset.size || 0,
      });
    }
  };

  const toggleSelectCandidate = (key) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key);
        if (primaryKey === key) setPrimaryKey(next[0] || null);
        return next;
      }
      if (prev.length >= MAX_SELECTED_SLICES) {
        const msg = `Tối đa ${MAX_SELECTED_SLICES} lát cắt được chuyển cho bác sĩ (khuyến nghị ~10 lát).`;
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Giới hạn chọn lát cắt', msg);
        return prev;
      }
      if (!primaryKey) setPrimaryKey(key);
      return [...prev, key];
    });
  };

  const handleResetTop10 = () => {
    const candidates = triageResult?.candidates || [];
    const pre = candidates.filter((c) => c.preselected).map((c) => c.sliceKey);
    const next = pre.length > 0 ? pre : candidates.slice(0, 10).map((c) => c.sliceKey);
    setSelectedKeys(next);
    setPrimaryKey(next[0] || null);
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
    setPrimaryKey(null);
  };

  const handleCancelReview = async () => {
    if (sessionId) {
      await imagingApi.cancelTriage(sessionId).catch(() => {});
      activeSessionRef.current = null;
    }
    setSessionId(null);
    setTriageResult(null);
    setSelectedKeys([]);
    setPrimaryKey(null);
    setStage('idle');
    setErrorMsg('');
  };

  const handleFinalize = async () => {
    if (!sessionId || selectedKeys.length === 0) return;
    setErrorMsg('');
    setStage('finalizing');
    try {
      const orderedKeys = [...selectedKeys];
      // Put primaryKey first if KTV promoted a non-first slice as representative
      if (primaryKey && orderedKeys.includes(primaryKey) && orderedKeys[0] !== primaryKey) {
        const idx = orderedKeys.indexOf(primaryKey);
        orderedKeys.splice(idx, 1);
        orderedKeys.unshift(primaryKey);
      }

      const res = await imagingApi.finalizeTriage(sessionId, {
        selectedSliceKeys: orderedKeys,
        primarySliceKey: orderedKeys[0],
      });

      if (!res?.success || !res?.data?.images?.length) {
        throw new Error(res?.message || 'Không lưu được các lát cắt đã chọn.');
      }

      const snapshotSummary = triageResult?.summary || null;
      const promotedImages = Array.isArray(res.data.images) ? res.data.images : [];
      const baseMeta = Array.isArray(res.data.sliceSeriesMeta) ? res.data.sliceSeriesMeta : [];
      const basePreviewSlices = Array.isArray(res.data.triageAiPreview?.sliceResults)
        ? res.data.triageAiPreview.sliceResults
        : [];
      const primaryIdx = Number.isInteger(res.data.primarySliceIndex) ? res.data.primarySliceIndex : 0;

      // Bước 2: Chạy AI 3 tầng thật (CNN Ensemble 3 mô hình + YOLOv8 + Gemini VLM + Grad-CAM) cho từng lát đã chốt
      setStage('deep_ai');
      setDeepAiProgress({ done: 0, total: promotedImages.length });

      const perSliceOutcomes = new Array(promotedImages.length);
      let cursor = 0;
      const workerCount = Math.max(1, Math.min(2, promotedImages.length));
      const runDeepWorker = async () => {
        while (true) {
          const i = cursor;
          cursor += 1;
          if (i >= promotedImages.length) break;
          const imgUrl = promotedImages[i];
          const meta = baseMeta[i] || {};
          const fallbackSlice = basePreviewSlices[i] || {};
          try {
            const aiRes = await imagingApi.analyzeAI({
              imageUrl: imgUrl,
              visitId: visit?._id || undefined,
              sliceIndex: i,
              seriesName: meta.seriesName || undefined,
            });
            if (aiRes?.success && aiRes?.data?.class_name) {
              const d = aiRes.data;
              const cls = String(d.class_name).toLowerCase();
              const box = cls === 'notumor' ? null : (d.bounding_box || null);
              perSliceOutcomes[i] = {
                ok: true,
                sliceResult: {
                  sliceIndex: i,
                  imageUrl: imgUrl,
                  seriesName: meta.seriesName || '',
                  sequenceType: meta.sequenceType || 'OTHER',
                  plane: meta.plane || 'unknown',
                  sliceNumber: meta.sliceNumber ?? null,
                  clarityScore: meta.clarityScore ?? null,
                  class_name: cls,
                  confidence: Number.isFinite(Number(d.confidence)) ? Number(d.confidence) : 0,
                  probabilities: d.probabilities || null,
                  bounding_box: box,
                  heatmapStreamUrl: d.heatmapStreamUrl || d.annotated_image || null,
                  consensus_message: d.consensus_message || null,
                  clinical_report: d.clinical_report || null,
                  privacy_guard: d.privacy_guard || null,
                  yoloDetected: Boolean(box || cls !== 'notumor'),
                  aiTier: '3-tier',
                },
              };
            } else {
              throw new Error(aiRes?.message || 'AI 3 tầng không trả về phân loại');
            }
          } catch {
            const fbCls = String(fallbackSlice.class_name || meta.predictedClass || 'notumor').toLowerCase();
            const fbBox = fbCls === 'notumor' ? null : (fallbackSlice.bounding_box || meta.boundingBox || null);
            perSliceOutcomes[i] = {
              ok: false,
              sliceResult: {
                sliceIndex: i,
                imageUrl: imgUrl,
                seriesName: meta.seriesName || '',
                sequenceType: meta.sequenceType || 'OTHER',
                plane: meta.plane || 'unknown',
                sliceNumber: meta.sliceNumber ?? null,
                clarityScore: meta.clarityScore ?? null,
                class_name: fbCls,
                confidence: fallbackSlice.confidence ?? meta.confidence ?? 0,
                probabilities: fallbackSlice.probabilities || meta.probabilities || null,
                bounding_box: fbBox,
                yoloDetected: Boolean(fallbackSlice.yoloDetected || meta.yoloDetected),
                aiTier: 'triage',
              },
            };
          } finally {
            setDeepAiProgress((prev) => ({ done: Math.min(prev.total, prev.done + 1), total: prev.total }));
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => runDeepWorker()));

      const finalSliceResults = perSliceOutcomes.map((o) => o?.sliceResult).filter(Boolean);
      const deepSuccessCount = perSliceOutcomes.filter((o) => o?.ok).length;
      const enrichedMeta = baseMeta.map((m, idx) => {
        const sr = finalSliceResults[idx];
        if (!sr) return m;
        return {
          ...m,
          predictedClass: sr.class_name,
          confidence: sr.confidence,
          probabilities: sr.probabilities || m.probabilities || null,
          boundingBox: sr.bounding_box || null,
          yoloDetected: Boolean(sr.yoloDetected || sr.bounding_box),
          heatmapStreamUrl: sr.heatmapStreamUrl || null,
          consensusMessage: sr.consensus_message || null,
          clinicalReport: sr.clinical_report || null,
          aiTier: sr.aiTier || 'triage',
        };
      });

      const studyDiag =
        triageResult?.studyDiagnosisSummary ||
        res.data?.triageAiPreview?.studyDiagnosisSummary ||
        null;
      const folderDomCls =
        studyDiag?.dominantClass && studyDiag.dominantClass !== 'notumor'
          ? String(studyDiag.dominantClass).toLowerCase()
          : null;
      const tumorSlices = finalSliceResults.filter((s) => s.class_name && s.class_name !== 'notumor');
      const primaryS = finalSliceResults[primaryIdx] || tumorSlices[0] || finalSliceResults[0] || null;
      const bestFolderDomSlice = folderDomCls
        ? tumorSlices.reduce(
            (b, c) =>
              c.class_name === folderDomCls && (!b || (c.confidence || 0) > (b.confidence || 0)) ? c : b,
            null
          )
        : null;
      const bestTumor = tumorSlices.reduce(
        (b, c) => (!b || (c.confidence || 0) > (b.confidence || 0) ? c : b),
        null
      );
      const domSlice =
        (primaryS && primaryS.class_name !== 'notumor' && (!folderDomCls || primaryS.class_name === folderDomCls)
          ? primaryS
          : null) ||
        bestFolderDomSlice ||
        (primaryS && primaryS.class_name !== 'notumor' ? primaryS : null) ||
        bestTumor ||
        primaryS;
      const finalAiPreview = domSlice
        ? {
            fromTriage: deepSuccessCount === 0,
            deepAiCompleted: deepSuccessCount > 0,
            deepAiCount: deepSuccessCount,
            model_info:
              deepSuccessCount > 0
                ? '3-Tier Consensus AI (CNN Ensemble + YOLOv8 + Gemini VLM)'
                : '3-CNN Ensemble + YOLOv8 + Bounded Gemini VLM',
            class_name: domSlice.class_name,
            confidence: domSlice.confidence,
            probabilities: domSlice.probabilities || null,
            bounding_box: domSlice.bounding_box || null,
            heatmapStreamUrl: domSlice.heatmapStreamUrl || null,
            consensus_message: domSlice.consensus_message || null,
            clinical_report: domSlice.clinical_report || null,
            representativeSliceUrl: domSlice.imageUrl || promotedImages[primaryIdx] || promotedImages[0],
            tumorSliceCount: tumorSlices.length,
            totalSlices: finalSliceResults.length,
            totalAnalyzedInFolder: studyDiag?.totalAnalyzed || snapshotSummary?.analyzedCount || null,
            studyDiagnosisSummary: studyDiag,
            sliceResults: finalSliceResults,
          }
        : (res.data.triageAiPreview || null);

      activeSessionRef.current = null;
      setSessionId(null);
      setStage('idle');
      setDeepAiProgress({ done: 0, total: 0 });
      setTriageResult(null);

      if (typeof onComplete === 'function') {
        onComplete({
          images: promotedImages,
          sliceSeriesMeta: enrichedMeta,
          primarySliceIndex: primaryIdx,
          triageSummary: snapshotSummary,
          triageAiPreview: finalAiPreview,
        });
      }
    } catch (err) {
      setStage('review');
      setDeepAiProgress({ done: 0, total: 0 });
      notifyError(err?.message || 'Lỗi xác nhận và lưu PACS.');
    }
  };

  const visibleCandidates = useMemo(() => {
    const list = triageResult?.candidates || [];
    if (seriesFilter === 'all') return list;
    if (seriesFilter === 'tumor_only') {
      return list.filter((c) => c.yoloDetected || (c.predictedClass && c.predictedClass !== 'notumor'));
    }
    if (seriesFilter.startsWith('class:')) {
      const targetCls = seriesFilter.slice(6);
      return list.filter((c) => (c.predictedClass || 'notumor') === targetCls);
    }
    return list.filter((c) => c.seriesName === seriesFilter);
  }, [triageResult, seriesFilter]);

  const studyDiag = triageResult?.studyDiagnosisSummary || null;

  const busy = stage === 'uploading' || stage === 'screening' || stage === 'finalizing' || stage === 'deep_ai';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Sparkles size={16} color="#4F46E5" />
          <Text style={styles.headerTitle}>Phân tích AI chi tiết toàn thư mục (3-CNN Ensemble + YOLOv8 + Gemini VLM giới hạn) → Thống kê đa số & Chọn ~10 lát rõ nhất</Text>
        </View>
        {stage === 'review' && (
          <TouchableOpacity onPress={handleCancelReview} style={styles.resetIconBtn}>
            <RotateCcw size={13} color="#64748B" />
            <Text style={styles.resetIconText}>Chọn thư mục khác</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chọn protocol lọc ảnh */}
      <View style={styles.protocolRow}>
        <Text style={styles.protocolLabel}>Protocol ưu tiên chuỗi xung:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {PROTOCOL_OPTIONS.map((opt) => {
            const active = protocolCode === opt.code;
            return (
              <TouchableOpacity
                key={opt.code}
                disabled={busy}
                onPress={() => {
                  setProtocolCode(opt.code);
                  if (opt.code === 'BRAIN_TUMOR_CORE_CONTRAST' || opt.code === 'BRAIN_TUMOR_POST_OP') {
                    setWithContrast(true);
                  } else if (opt.code === 'BRAIN_TUMOR_NON_CONTRAST') {
                    setWithContrast(false);
                  }
                }}
                style={[styles.protoChip, active && styles.protoChipActive]}
              >
                <Text style={[styles.protoChipText, active && styles.protoChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Giai đoạn nạp thư mục / ZIP hoặc đang chạy sàng lọc */}
      {stage !== 'review' && stage !== 'finalizing' && stage !== 'deep_ai' ? (
        <View
          ref={dropRef}
          style={[styles.dropZone, dragOver && styles.dropZoneActive, busy && styles.dropZoneBusy]}
        >
          {busy ? (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.progressTitle}>
                {stage === 'uploading'
                  ? 'Bước 1/2: Lọc bỏ Localizer & Nạp lát chẩn đoán'
                  : 'Bước 2/2: Đang chạy AI chi tiết toàn thư mục (3-CNN Ensemble + YOLOv8 + Gemini VLM giới hạn)'}
              </Text>
              <Text style={styles.progressSub}>{statusMessage}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, progressPct))}%` }]} />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.dropHint}>
                {Platform.OS === 'web'
                  ? 'Kéo thả nguyên thư mục ca chụp (vd: Chup_Cong_Huong_Tu...) vào đây hoặc bấm nút bên dưới. Tự động bỏ Localizers / ảnh đen ngoài sọ.'
                  : 'Chọn tệp nén .ZIP chứa toàn bộ thư mục ca chụp để tự động lọc ảnh rõ khối u nhất.'}
              </Text>
              <View style={styles.actionBtnsRow}>
                {Platform.OS === 'web' && (
                  <TouchableOpacity style={styles.btnPrimary} onPress={handlePickFolderWeb}>
                    <FolderOpen size={15} color="#fff" />
                    <Text style={styles.btnPrimaryText}>Chọn Cả Thư Mục MRI (~1,000 ảnh)</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btnSecondary} onPress={handlePickZip}>
                  <FileArchive size={15} color="#4F46E5" />
                  <Text style={styles.btnSecondaryText}>Chọn Tệp Nén .ZIP (≤ 600MB)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : null}

      {/* Giai đoạn KTV rà soát, chọn / đổi trong Top ứng viên và chốt ~10 lát */}
      {(stage === 'review' || stage === 'finalizing' || stage === 'deep_ai') && triageResult ? (
        <View style={styles.reviewBox}>
          {/* Thống kê lọc 3 bước */}
          <View style={styles.funnelRow}>
            <View style={styles.funnelStat}>
              <Text style={styles.funnelVal}>{triageResult.summary?.totalUploadedRaw || 0}</Text>
              <Text style={styles.funnelLbl}>Tổng ảnh nạp</Text>
            </View>
            <View style={styles.funnelStat}>
              <Text style={[styles.funnelVal, { color: '#94A3B8' }]}>
                -{(triageResult.summary?.ignoredSequenceCount || 0) + (triageResult.summary?.invalidSliceCount || 0)}
              </Text>
              <Text style={styles.funnelLbl}>Bỏ định vị/rỗng</Text>
            </View>
            <View style={styles.funnelStat}>
              <Text style={[styles.funnelVal, { color: '#2563EB' }]}>{triageResult.summary?.analyzedCount || 0}</Text>
              <Text style={styles.funnelLbl}>Đã quét AI</Text>
            </View>
            <View style={styles.funnelStat}>
              <Text style={[styles.funnelVal, { color: '#DC2626' }]}>{triageResult.summary?.detectedTumorSlicesCount || 0}</Text>
              <Text style={styles.funnelLbl}>Nghi có khối u</Text>
            </View>
          </View>

          {studyDiag && studyDiag.totalAnalyzed > 0 && (
            <View
              style={[
                styles.studyDiagBanner,
                studyDiag.dominantClass && studyDiag.dominantClass !== 'notumor'
                  ? styles.studyDiagBannerAlert
                  : styles.studyDiagBannerNormal,
              ]}
            >
              <Text style={styles.studyDiagHeader}>
                Kết quả AI chi tiết toàn thư mục ({studyDiag.totalAnalyzed} lát hợp lệ)
              </Text>
              <Text
                style={[
                  styles.studyDiagMain,
                  {
                    color:
                      studyDiag.dominantClass && studyDiag.dominantClass !== 'notumor'
                        ? '#991B1B'
                        : '#065F46',
                  },
                ]}
              >
                {studyDiag.dominantClass && studyDiag.dominantClass !== 'notumor'
                  ? `Đa số toàn thư mục: ${
                      CLASS_LABEL_VI[studyDiag.dominantClass] || studyDiag.dominantClass
                    } (${String(studyDiag.dominantClass).toUpperCase()}) — ${studyDiag.dominantCount}/${
                      studyDiag.totalAnalyzed
                    } ảnh (${studyDiag.dominantPctOfTotal}%)`
                  : `Đa số toàn thư mục: Không thấy khối u (${studyDiag.dominantCount}/${studyDiag.totalAnalyzed} ảnh, ${studyDiag.dominantPctOfTotal}%)`}
              </Text>
              <Text style={styles.studyDiagSub}>
                Độ tin cậy TB: {studyDiag.dominantAvgConfidence ?? 0}% (cao nhất {studyDiag.dominantMaxConfidence ?? 0}%) • Tổng lát có dấu hiệu u: {studyDiag.detectedTumorSlicesCount ?? 0}/{studyDiag.totalAnalyzed} ({studyDiag.tumorRatePct ?? 0}%)
                {studyDiag.conflictSlicesCount > 0
                  ? ` • ${studyDiag.geminiArbitratedCount ?? 0}/${studyDiag.conflictSlicesCount} lát bất đồng (axial) đã trọng tài Gemini VLM`
                  : ''}
              </Text>
              {Array.isArray(studyDiag.classStats) && studyDiag.classStats.length > 0 && (
                <View style={styles.folderChartBox}>
                  <Text style={styles.folderChartTitle}>
                    Biểu đồ phân bố loại khối u toàn thư mục (bấm vào từng hàng để lọc lát cắt bên dưới):
                  </Text>
                  {studyDiag.classStats.map((cs) => {
                    const filterKey = `class:${cs.className}`;
                    const isActive = seriesFilter === filterKey;
                    const barColor = CLASS_BAR_COLOR[cs.className] || '#4F46E5';
                    const barPct = Math.max(cs.count > 0 ? 3 : 0, Math.min(100, Number(cs.percentage) || 0));
                    return (
                      <TouchableOpacity
                        key={cs.className}
                        disabled={cs.count === 0}
                        onPress={() => setSeriesFilter(isActive ? 'all' : filterKey)}
                        style={[
                          styles.folderChartRow,
                          isActive && styles.folderChartRowActive,
                          cs.count === 0 && { opacity: 0.48 },
                        ]}
                      >
                        <View style={styles.folderChartRowTop}>
                          <Text style={[styles.folderChartLabel, isActive && { color: '#1E1B4B' }]}>
                            {CLASS_LABEL_VI[cs.className] || cs.className} ({String(cs.className).toUpperCase()})
                          </Text>
                          <Text style={styles.folderChartMeta}>
                            {cs.count}/{studyDiag.totalAnalyzed} ảnh ({cs.percentage}%)
                            {cs.count > 0 ? ` • TB ${cs.avgConfidence}%` : ''}
                          </Text>
                        </View>
                        <View style={styles.folderChartTrack}>
                          <View style={[styles.folderChartFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Bộ lọc chuỗi xung */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              onPress={() => setSeriesFilter('all')}
              style={[styles.filterPill, seriesFilter === 'all' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, seriesFilter === 'all' && styles.filterPillTextActive]}>
                Top ứng viên ({triageResult.candidates?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSeriesFilter('tumor_only')}
              style={[styles.filterPill, seriesFilter === 'tumor_only' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, seriesFilter === 'tumor_only' && styles.filterPillTextActive]}>
                Có dấu hiệu u
              </Text>
            </TouchableOpacity>
            {(triageResult.seriesSummary || []).map((s) => (
              <TouchableOpacity
                key={s.seriesName}
                disabled={s.ignored}
                onPress={() => setSeriesFilter(s.seriesName)}
                style={[
                  styles.filterPill,
                  seriesFilter === s.seriesName && styles.filterPillActive,
                  s.ignored && { opacity: 0.45, backgroundColor: '#F1F5F9' },
                ]}
              >
                <Text style={[styles.filterPillText, seriesFilter === s.seriesName && styles.filterPillTextActive]}>
                  {s.seriesName} ({s.ignored ? 'Đã bỏ' : `${s.sequenceType} • ${s.validFiles}`})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Thanh công cụ chọn nhanh */}
          <View style={styles.toolbarRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Layers size={14} color="#4F46E5" />
              <Text style={styles.selectedCounter}>
                Đã chọn <Text style={{ color: '#4F46E5', fontWeight: '800' }}>{selectedKeys.length}</Text> / {MAX_SELECTED_SLICES} lát (khuyến nghị 10)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={handleResetTop10} style={styles.miniBtn}>
                <Text style={styles.miniBtnText}>Chọn lại Top 10 AI</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearAll} style={[styles.miniBtn, { borderColor: '#FCA5A5' }]}>
                <Trash2 size={12} color="#DC2626" />
                <Text style={[styles.miniBtnText, { color: '#DC2626' }]}>Bỏ chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.starHintText}>
            Bấm vào ảnh để chọn/bỏ chọn lát cắt • Bấm biểu tượng ★ góc phải ảnh đã chọn để đặt làm ảnh đại diện • Bấm nút phóng to góc dưới để xem ảnh lớn.
          </Text>

          {/* Lưới ảnh ứng viên kèm preview bbox YOLO */}
          <ScrollView style={[styles.candidatesScroll, { maxHeight: listMaxHeight }]} nestedScrollEnabled>
            <View style={styles.candidatesGrid}>
              {visibleCandidates.map((cand) => {
                const isSelected = selectedKeys.includes(cand.sliceKey);
                const isPrimary = primaryKey === cand.sliceKey;
                const effectiveCls = String(cand.predictedClass || cand.yoloClass || 'notumor').toLowerCase();
                const hasTumor = effectiveCls !== 'notumor' || Boolean(cand.yoloDetected);
                const clsLabel = CLASS_LABEL_VI[effectiveCls] || effectiveCls;
                const box = cand.boundingBox;
                const probEntries = getSortedProbEntries(cand.probabilities, effectiveCls, cand.confidence).slice(0, 3);

                return (
                  <View
                    key={cand.sliceKey}
                    style={[
                      styles.candCard,
                      { width: cardWidth },
                      isSelected && styles.candCardSelected,
                      isPrimary && styles.candCardPrimary,
                    ]}
                  >
                    <View style={styles.candImgOuter}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => toggleSelectCandidate(cand.sliceKey)}
                        style={styles.candImgWrap}
                      >
                      <Image
                        source={{ uri: `${Config.API_URL}${cand.previewUrl}` }}
                        style={styles.candImg}
                        resizeMode="contain"
                      />
                      {/* Khung định vị khối u sơ bộ từ YOLO */}
                      {box && (
                        <View
                          style={{
                            position: 'absolute',
                            left: `${box.x * 100}%`,
                            top: `${box.y * 100}%`,
                            width: `${box.w * 100}%`,
                            height: `${box.h * 100}%`,
                            borderWidth: 2,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.14)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      <View style={[styles.rankBadge, isSelected && { backgroundColor: '#4F46E5' }]}>
                        <Text style={styles.rankText}>#{cand.rank}</Text>
                      </View>
                      </TouchableOpacity>
                      {isSelected && (
                        <TouchableOpacity
                          onPress={() => setPrimaryKey(cand.sliceKey)}
                          accessibilityLabel="Chọn ảnh đại diện"
                          style={[styles.starBtn, isPrimary && styles.starBtnActive]}
                        >
                          <Star size={13} color={isPrimary ? '#fff' : '#F59E0B'} fill={isPrimary ? '#fff' : 'none'} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => setZoomCandidate(cand)}
                        accessibilityLabel="Phóng to xem lát cắt"
                        style={styles.zoomBtn}
                      >
                        <Maximize2 size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => toggleSelectCandidate(cand.sliceKey)}
                      style={styles.candMeta}
                    >
                      <Text numberOfLines={2} style={[styles.candClass, hasTumor ? { color: '#DC2626' } : { color: '#059669' }]}>
                        {clsLabel} • {cand.confidence != null ? `${Math.round(cand.confidence)}%` : `${Math.round((cand.lesionClarityScore || 0) * 100)}đ`}
                        {cand.geminiArbitrated ? ' • VLM' : ''}
                      </Text>
                      <View style={styles.miniProbBox}>
                        {probEntries.map((pe) => (
                          <View key={pe.className} style={styles.miniProbRow}>
                            <View style={styles.miniProbHead}>
                              <Text numberOfLines={1} style={styles.miniProbLbl}>{pe.label}</Text>
                              <Text style={styles.miniProbPct}>{pe.pct}%</Text>
                            </View>
                            <View style={styles.miniProbTrack}>
                              <View
                                style={[
                                  styles.miniProbFill,
                                  { width: `${Math.max(pe.pct > 0 ? 4 : 0, Math.min(100, pe.pct))}%`, backgroundColor: pe.color },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                      <Text numberOfLines={1} style={styles.candSeries}>
                        {cand.seriesName}
                      </Text>
                      <Text numberOfLines={1} style={styles.candSub}>
                        {cand.sequenceType} {cand.plane !== 'unknown' ? `• ${cand.plane}` : ''} {cand.sliceNumber != null ? `#${cand.sliceNumber}` : ''}
                        {cand.yoloDetected && cand.yoloClass ? ` • YOLO: ${cand.yoloClass}` : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            disabled={selectedKeys.length === 0 || stage === 'finalizing' || stage === 'deep_ai'}
            onPress={handleFinalize}
            style={[
              styles.finalizeBtn,
              (selectedKeys.length === 0 || stage === 'finalizing' || stage === 'deep_ai') && { opacity: 0.72 },
            ]}
          >
            {stage === 'finalizing' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.finalizeBtnText}>Bước 1/2: Đang mã hóa PACS & đẩy {selectedKeys.length} lát...</Text>
              </View>
            ) : stage === 'deep_ai' ? (
              <View style={{ alignItems: 'center', gap: 6, width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.finalizeBtnText}>
                    Bước 2/2: Đang chạy AI 3 tầng (3 CNN + YOLOv8 + Gemini VLM + Grad-CAM): {deepAiProgress.done}/{deepAiProgress.total} lát...
                  </Text>
                </View>
                <View style={{ width: '80%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: '#A7F3D0',
                      width: `${deepAiProgress.total > 0 ? Math.max(8, Math.round((deepAiProgress.done / deepAiProgress.total) * 100)) : 10}%`,
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#fff" />
                <Text style={styles.finalizeBtnText}>
                  Chốt {selectedKeys.length} lát cắt & Chuẩn bị gửi Bác sĩ + Chạy AI 3 tầng chi tiết
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Modal phóng to kiểm tra lát cắt ứng viên & khung YOLO */}
      <Modal
        visible={Boolean(zoomCandidate)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomCandidate(null)}
      >
        <View style={styles.zoomOverlay}>
          <View style={[styles.zoomBox, { maxHeight: '92%' }]}>
            <View style={styles.zoomHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.zoomTitle}>
                  Ứng viên #{zoomCandidate?.rank} • {CLASS_LABEL_VI[zoomCandidate?.predictedClass || zoomCandidate?.yoloClass] || zoomCandidate?.predictedClass}
                  {zoomCandidate?.confidence != null ? ` (${Math.round(zoomCandidate.confidence)}%)` : ''}
                </Text>
                <Text style={styles.zoomSub}>
                  {zoomCandidate?.seriesName} ({zoomCandidate?.sequenceType}{zoomCandidate?.plane && zoomCandidate.plane !== 'unknown' ? ` • ${zoomCandidate.plane}` : ''}{zoomCandidate?.sliceNumber != null ? ` • Lát #${zoomCandidate.sliceNumber}` : ''}) • Độ rõ u: {Math.round((zoomCandidate?.lesionClarityScore || 0) * 100)}đ
                </Text>
              </View>
              <TouchableOpacity onPress={() => setZoomCandidate(null)} style={styles.zoomCloseBtn}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
              <View style={styles.zoomStage}>
                {zoomCandidate?.previewUrl ? (
                  <View style={styles.zoomImgFrame}>
                    <Image
                      source={{ uri: `${Config.API_URL}${zoomCandidate.previewUrl}` }}
                      style={styles.zoomImg}
                      resizeMode="contain"
                    />
                    {zoomCandidate?.boundingBox ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: `${zoomCandidate.boundingBox.x * 100}%`,
                          top: `${zoomCandidate.boundingBox.y * 100}%`,
                          width: `${zoomCandidate.boundingBox.w * 100}%`,
                          height: `${zoomCandidate.boundingBox.h * 100}%`,
                          borderWidth: 2.5,
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.14)',
                          pointerEvents: 'none',
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
              {zoomCandidate ? (
                <View style={styles.zoomProbCard}>
                  <Text style={styles.zoomProbTitle}>Biểu đồ xác suất phân loại AI cho lát cắt này</Text>
                  {getSortedProbEntries(
                    zoomCandidate.probabilities,
                    zoomCandidate.predictedClass || zoomCandidate.yoloClass,
                    zoomCandidate.confidence
                  ).map((pe) => (
                    <View key={pe.className} style={styles.folderChartRow}>
                      <View style={styles.folderChartRowTop}>
                        <Text style={styles.folderChartLabel}>
                          {pe.label} ({pe.className.toUpperCase()})
                        </Text>
                        <Text style={[styles.folderChartMeta, { color: pe.color, fontWeight: '800' }]}>
                          {pe.pct}%
                        </Text>
                      </View>
                      <View style={styles.folderChartTrack}>
                        <View
                          style={[
                            styles.folderChartFill,
                            { width: `${Math.max(pe.pct > 0 ? 3 : 0, Math.min(100, pe.pct))}%`, backgroundColor: pe.color },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                  <Text style={styles.zoomProbFoot}>
                    CNN Ensemble: {CLASS_LABEL_VI[zoomCandidate.cnnClass] || zoomCandidate.cnnClass || 'N/A'}
                    {zoomCandidate.yoloDetected
                      ? ` • YOLOv8 khoanh vùng: ${CLASS_LABEL_VI[zoomCandidate.yoloClass] || zoomCandidate.yoloClass} (${Math.round((zoomCandidate.yoloConf || 0) * 100)}%)`
                      : ' • YOLOv8: Không phát hiện hộp giới hạn'}
                    {zoomCandidate.consensusMessage ? `\n${zoomCandidate.consensusMessage}` : ''}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.zoomActions}>
              <TouchableOpacity
                onPress={() => {
                  if (zoomCandidate) toggleSelectCandidate(zoomCandidate.sliceKey);
                }}
                style={[
                  styles.zoomActionBtn,
                  selectedKeys.includes(zoomCandidate?.sliceKey) ? styles.zoomActionActive : styles.zoomActionDefault,
                ]}
              >
                <Text style={[styles.zoomActionText, selectedKeys.includes(zoomCandidate?.sliceKey) && { color: '#fff' }]}>
                  {selectedKeys.includes(zoomCandidate?.sliceKey) ? '✓ Đang chọn lát này (Bấm để bỏ)' : '+ Chọn lát này'}
                </Text>
              </TouchableOpacity>
              {selectedKeys.includes(zoomCandidate?.sliceKey) && (
                <TouchableOpacity
                  onPress={() => setPrimaryKey(zoomCandidate.sliceKey)}
                  style={[
                    styles.zoomActionBtn,
                    primaryKey === zoomCandidate?.sliceKey ? { backgroundColor: '#F59E0B', borderColor: '#F59E0B' } : styles.zoomActionDefault,
                  ]}
                >
                  <Star size={14} color={primaryKey === zoomCandidate?.sliceKey ? '#fff' : '#D97706'} fill={primaryKey === zoomCandidate?.sliceKey ? '#fff' : 'none'} />
                  <Text style={[styles.zoomActionText, primaryKey === zoomCandidate?.sliceKey && { color: '#fff' }]}>
                    {primaryKey === zoomCandidate?.sliceKey ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setZoomCandidate(null)} style={[styles.zoomActionBtn, styles.zoomActionDone]}>
                <Text style={[styles.zoomActionText, { color: '#fff' }]}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#312E81',
    flex: 1,
  },
  resetIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetIconText: { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  protocolRow: { marginBottom: 14 },
  protocolLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  protoChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  protoChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  protoChipText: { fontSize: 12.5, fontWeight: '600', color: '#334155' },
  protoChipTextActive: { color: '#fff' },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600' },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#818CF8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 22,
  },
  dropZoneActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  dropZoneBusy: { backgroundColor: '#FAFAFF' },
  dropHint: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionBtnsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#A5B4FC',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnSecondaryText: { color: '#4338CA', fontSize: 13.5, fontWeight: '700' },
  progressTitle: { marginTop: 12, fontSize: 14.5, fontWeight: '800', color: '#312E81', textAlign: 'center' },
  progressSub: { marginTop: 6, fontSize: 12.5, color: '#475569', textAlign: 'center' },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', backgroundColor: '#4F46E5', borderRadius: 999 },
  reviewBox: { marginTop: 4 },
  funnelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  funnelStat: { alignItems: 'center', flex: 1 },
  funnelVal: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  funnelLbl: { fontSize: 12, color: '#64748B', marginTop: 2 },
  studyDiagBanner: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  studyDiagBannerAlert: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  studyDiagBannerNormal: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  studyDiagHeader: { fontSize: 11.5, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 },
  studyDiagMain: { fontSize: 15, fontWeight: '800' },
  studyDiagSub: { fontSize: 12, color: '#475569', lineHeight: 18 },
  folderChartBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  folderChartTitle: { fontSize: 12, fontWeight: '700', color: '#334155' },
  folderChartRow: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  folderChartRowActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1', borderWidth: 1.5 },
  folderChartRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  folderChartLabel: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  folderChartMeta: { fontSize: 12, fontWeight: '600', color: '#475569' },
  folderChartTrack: { width: '100%', height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  folderChartFill: { height: '100%', borderRadius: 999 },
  miniProbBox: { marginTop: 6, marginBottom: 4, gap: 4 },
  miniProbRow: { gap: 2 },
  miniProbHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  miniProbLbl: { fontSize: 10.5, fontWeight: '600', color: '#475569', flex: 1 },
  miniProbPct: { fontSize: 10.5, fontWeight: '700', color: '#0F172A' },
  miniProbTrack: { width: '100%', height: 4.5, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  miniProbFill: { height: '100%', borderRadius: 999 },
  zoomProbCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  zoomProbTitle: { fontSize: 13.5, fontWeight: '800', color: '#1E293B' },
  zoomProbFoot: { fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 2 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterPillActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterPillTextActive: { color: '#fff' },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  selectedCounter: { fontSize: 14, color: '#334155', fontWeight: '600' },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniBtnText: { fontSize: 12.5, fontWeight: '600', color: '#334155' },
  candidatesScroll: { maxHeight: 540 },
  candidatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  candCard: {
    width: 206,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  candCardSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  candCardPrimary: { borderColor: '#F59E0B', borderWidth: 2.5 },
  candImgOuter: { width: '100%', position: 'relative' },
  candImgWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#020617', position: 'relative' },
  starHintText: { fontSize: 12.5, color: '#64748B', marginBottom: 10, lineHeight: 18 },
  candImg: { width: '100%', height: '100%' },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  starBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: { backgroundColor: '#F59E0B' },
  zoomBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candMeta: { padding: 10 },
  candClass: { fontSize: 13, fontWeight: '800' },
  candSeries: { fontSize: 12, color: '#334155', fontWeight: '600', marginTop: 2 },
  candSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  finalizeBtn: {
    marginTop: 14,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizeBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  zoomBox: {
    width: '100%',
    maxWidth: 780,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  zoomHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  zoomTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  zoomSub: { fontSize: 13, color: '#475569', marginTop: 3 },
  zoomCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomStage: {
    width: '100%',
    height: 340,
    backgroundColor: '#020617',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImgFrame: {
    height: '100%',
    maxWidth: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  zoomImg: { width: '100%', height: '100%' },
  zoomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  zoomActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  zoomActionDefault: { backgroundColor: '#F8FAFC' },
  zoomActionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  zoomActionDone: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  zoomActionText: { fontSize: 13.5, fontWeight: '700', color: '#1E293B' },
});

