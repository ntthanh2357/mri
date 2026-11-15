import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Brain,
  CheckCircle2,
  Eye,
  FileSearch,
  FolderOpen,
  HardDrive,
  Layers,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  AlertTriangle,
} from 'lucide-react';
import ResponsiveLayout from '../components/ResponsiveLayout';
import DicomWebViewer from '../components/DicomWebViewer';
import { get, post } from '../services/api.service';
import { groupLocalFilesIntoSeries, parseLocalDicomOrImageFile } from '../utils/dicomParser';

const safeArray = (val) => (Array.isArray(val) ? val : []);

const formatDateShort = (val) => {
  if (!val) return 'Chưa rõ ngày';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TUMOR_LABEL_VI = {
  glioma: 'U thần kinh đệm (Glioma)',
  meningioma: 'U màng não (Meningioma)',
  pituitary: 'U tuyến yên (Pituitary)',
  notumor: 'Không phát hiện khối u',
};

const STUDY_STATUS_VI = {
  uploading: 'Đang tải PACS',
  upload_complete: 'Đã đủ DICOM',
  validated: 'Đạt chuẩn DICOM',
  ai_queued: 'Đang chờ AI',
  ai_complete: 'Đã có kết quả AI',
  error: 'Thiếu / Lỗi DICOM',
};

const buildMergedPacsCatalog = (imagingList = [], studyList = []) => {
  const byStudyId = new Map();
  const byResultId = new Map();
  const items = [];

  for (const r of safeArray(imagingList)) {
    if (!r || !r._id) continue;
    const rid = String(r._id);
    const sid = r.studyId ? String(r.studyId) : null;
    const imgs = safeArray(r.images).length ? safeArray(r.images) : safeArray(r.top5SlicesUrls);
    const entry = {
      key: `ir:${rid}`,
      imagingResultId: rid,
      studyId: sid,
      visitId: r.visitId ? String(r.visitId) : null,
      patientName: r.patientName || 'Bệnh nhân',
      medicalId: r.medicalId || 'N/A',
      procedure: r.procedure || 'Chụp MRI Sọ não',
      studyDate: r.reportDate || r.orderDate || r.createdAt,
      images: imgs,
      sliceCount: imgs.length,
      aiReport: r.aiReport || null,
      aiClassName: r.aiReport?.class_name || null,
      aiConfidence: r.aiReport?.confidence ?? null,
      isSigned: Boolean(r.isSigned),
      status: r.aiReport ? 'ai_complete' : imgs.length > 0 ? 'upload_complete' : 'uploading',
      studyUID: r.dicomMetadata?.studyInstanceUID || '',
      hasImages: imgs.length > 0 || Boolean(sid),
    };
    byResultId.set(rid, entry);
    if (sid) byStudyId.set(sid, entry);
    items.push(entry);
  }

  for (const s of safeArray(studyList)) {
    if (!s || !s._id) continue;
    const sid = String(s._id);
    const linkedResultId = s.imagingResultId ? String(s.imagingResultId) : null;
    if (byStudyId.has(sid) || (linkedResultId && byResultId.has(linkedResultId))) {
      const target = byStudyId.get(sid) || byResultId.get(linkedResultId);
      target.studyId = sid;
      target.studyUID = target.studyUID || s.studyUID || '';
      if (s.totalSlices && s.totalSlices > target.sliceCount) target.sliceCount = s.totalSlices;
      if (s.status) target.studyStatus = s.status;
      if (Array.isArray(s.validationErrors)) target.validationErrors = s.validationErrors;
      continue;
    }

    const pName =
      s.patientId?.profile?.fullName ||
      s.patientId?.profile?.name ||
      s.patientId?.email ||
      'Ca DICOM trên PACS';
    items.push({
      key: `st:${sid}`,
      imagingResultId: linkedResultId,
      studyId: sid,
      visitId: s.visitId ? String(s.visitId) : null,
      patientName: pName,
      medicalId: s.accessionNumber || s.studyUID?.slice(-8) || 'PACS',
      procedure: s.imagingType || s.modality || 'MRI Study',
      studyDate: s.studyDate || s.createdAt,
      images: [],
      sliceCount: s.totalSlices || 0,
      aiReport: null,
      aiClassName: null,
      aiConfidence: null,
      isSigned: false,
      status: s.status || 'uploading',
      studyStatus: s.status || 'uploading',
      studyUID: s.studyUID || '',
      validationErrors: Array.isArray(s.validationErrors) ? s.validationErrors : [],
      hasImages: (s.totalSlices || 0) > 0,
    });
  }

  return items.sort((a, b) => new Date(b.studyDate || 0) - new Date(a.studyDate || 0));
};

const DicomViewerScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const paramStudyId = route?.params?.studyId || null;
  const paramResultId = route?.params?.imagingResultId || route?.params?.resultId || null;
  const draftImagesParam = safeArray(route?.params?.draftImages);
  const draftMetaParam = safeArray(route?.params?.sliceSeriesMeta);
  const draftAiParam = route?.params?.aiReportData || null;
  const draftPatientName = route?.params?.patientName || 'Ca đang thao tác';
  const draftMedicalId = route?.params?.medicalId || 'CHƯA LƯU';
  const draftProcedure = route?.params?.procedure || 'Phim MRI vừa chọn';

  const draftCatalogEntry = useMemo(() => {
    if (!draftImagesParam.length) return null;
    const groupedMap = new Map();
    draftImagesParam.forEach((url, idx) => {
      const m = draftMetaParam[idx] || {};
      const seriesKey = m.seriesName || m.sequenceType || 'Chuỗi lát cắt đã chọn';
      if (!groupedMap.has(seriesKey)) {
        groupedMap.set(seriesKey, {
          seriesId: `draft-series-${groupedMap.size + 1}`,
          seriesType: m.sequenceType || 'T2_FLAIR',
          seriesDescription: `${seriesKey}${m.plane && m.plane !== 'unknown' ? ` (${m.plane})` : ''}`,
          sliceCount: 0,
          pixelSpacing: [0.5, 0.5],
          sliceThickness: 3.0,
          slices: [],
        });
      }
      const bucket = groupedMap.get(seriesKey);
      bucket.slices.push({
        sliceIndex: m.sliceNumber ?? (bucket.slices.length + 1),
        globalSliceIndex: idx,
        imageUrl: url,
        seriesName: seriesKey,
        sequenceType: m.sequenceType || '',
        plane: m.plane || '',
      });
      bucket.sliceCount = bucket.slices.length;
    });
    return {
      key: 'draft:current',
      imagingResultId: null,
      studyId: null,
      visitId: route?.params?.visitId || null,
      patientName: `${draftPatientName} (Đang tạo)`,
      medicalId: draftMedicalId,
      procedure: draftProcedure,
      studyDate: new Date().toISOString(),
      images: draftImagesParam,
      sliceCount: draftImagesParam.length,
      aiReport: draftAiParam,
      aiClassName: draftAiParam?.class_name || null,
      aiConfidence: draftAiParam?.confidence ?? null,
      isSigned: false,
      status: draftAiParam ? 'ai_complete' : 'upload_complete',
      studyUID: '',
      hasImages: true,
      isDraft: true,
      externalManifest: {
        modality: 'MR',
        patientName: draftPatientName,
        series: Array.from(groupedMap.values()),
      },
    };
  }, [draftImagesParam, draftMetaParam, draftAiParam, draftPatientName, draftMedicalId, draftProcedure, route?.params?.visitId]);

  const [user, setUser] = useState(null);
  const [sourceMode, setSourceMode] = useState('pacs'); // 'pacs' | 'local'
  const [loading, setLoading] = useState(true);
  const [pacsError, setPacsError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChip, setFilterChip] = useState('all'); // 'all' | 'hasImages' | 'hasAi'

  // Validation QA state (KTV kiểm chuẩn DICOM trên Study)
  const [validating, setValidating] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState(null);

  // Local .dcm / image state
  const [localLoading, setLocalLoading] = useState(false);
  const [localProgress, setLocalProgress] = useState('');
  const [localError, setLocalError] = useState('');
  const [localManifest, setLocalManifest] = useState(null);
  const [localStats, setLocalStats] = useState(null);
  const [localSessionId, setLocalSessionId] = useState(0);

  // Active slice metadata & DICOM Tag Inspector
  const [activeSliceInfo, setActiveSliceInfo] = useState(null);
  const objectUrlsRef = useRef([]);

  const revokeLocalObjectUrls = useCallback(() => {
    for (const u of objectUrlsRef.current) {
      try {
        if (typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => () => revokeLocalObjectUrls(), [revokeLocalObjectUrls]);

  const loadPacsData = useCallback(async () => {
    setLoading(true);
    setPacsError('');
    try {
      const [meRes, imgRes, stRes] = await Promise.allSettled([
        get('/auth/me'),
        get('/api/v1/imaging'),
        get('/api/v1/dicom/studies?limit=40'),
      ]);
      if (meRes.status === 'fulfilled' && meRes.value?.user) {
        setUser(meRes.value.user);
      }
      const imagingRows = imgRes.status === 'fulfilled' ? safeArray(imgRes.value?.data) : [];
      const studyRows = stRes.status === 'fulfilled' ? safeArray(stRes.value?.data?.studies) : [];

      if (imgRes.status === 'rejected' && stRes.status === 'rejected') {
        setPacsError('Không thể tải danh sách phim từ máy chủ PACS.');
      }

      const merged = buildMergedPacsCatalog(imagingRows, studyRows);
      const finalCatalog = draftCatalogEntry ? [draftCatalogEntry, ...merged] : merged;
      setCatalog(finalCatalog);

      setSelectedKey((prev) => {
        if (draftCatalogEntry) {
          return draftCatalogEntry.key;
        }
        if (paramResultId) {
          const match = finalCatalog.find((i) => i.imagingResultId === String(paramResultId));
          if (match) return match.key;
        }
        if (paramStudyId) {
          const match = finalCatalog.find((i) => i.studyId === String(paramStudyId));
          if (match) return match.key;
        }
        if (prev && finalCatalog.some((i) => i.key === prev)) return prev;
        const withImgs = finalCatalog.find((i) => i.images.length > 0 || i.studyId);
        return withImgs?.key || finalCatalog[0]?.key || null;
      });
    } catch (err) {
      if (draftCatalogEntry) {
        setCatalog([draftCatalogEntry]);
        setSelectedKey(draftCatalogEntry.key);
      }
      setPacsError(err?.message || 'Lỗi kết nối PACS.');
    } finally {
      setLoading(false);
    }
  }, [paramResultId, paramStudyId, draftCatalogEntry]);

  useEffect(() => {
    loadPacsData();
  }, [loadPacsData]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (filterChip === 'hasImages' && !item.hasImages) return false;
      if (filterChip === 'hasAi' && !item.aiReport) return false;
      if (!q) return true;
      return (
        item.patientName.toLowerCase().includes(q) ||
        item.medicalId.toLowerCase().includes(q) ||
        item.procedure.toLowerCase().includes(q) ||
        item.studyUID.toLowerCase().includes(q)
      );
    });
  }, [catalog, searchQuery, filterChip]);

  const selectedPacsItem = useMemo(
    () => catalog.find((i) => i.key === selectedKey) || null,
    [catalog, selectedKey]
  );

  useEffect(() => {
    setValidationFeedback(null);
    setActiveSliceInfo(null);
  }, [selectedKey, sourceMode]);

  const handleValidateStudy = async () => {
    if (!selectedPacsItem?.studyId) return;
    setValidating(true);
    setValidationFeedback(null);
    try {
      const res = await post(`/api/v1/dicom/studies/${selectedPacsItem.studyId}/validate`, {});
      const data = res?.data || {};
      setValidationFeedback({
        isValid: Boolean(data.isValid),
        errors: safeArray(data.errors),
        warnings: safeArray(data.warnings),
        message: res?.message || (data.isValid ? 'Đạt chuẩn DICOM.' : 'Cần kiểm tra lại chuỗi xung.'),
      });
      await loadPacsData();
    } catch (err) {
      setValidationFeedback({
        isValid: false,
        errors: [err?.message || 'Không thể kiểm chuẩn DICOM Study.'],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleOpenLocalFiles = ({ directory = false } = {}) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setLocalError('Trình mở tệp .dcm cục bộ hiện chỉ hỗ trợ trên trình duyệt Web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (directory) {
      input.webkitdirectory = true;
    } else {
      input.accept = '.dcm,.dicom,.ima,image/*';
    }
    input.onchange = async (e) => {
      const rawFiles = Array.from(e.target.files || []);
      if (!rawFiles.length) return;

      const candidateFiles = rawFiles
        .filter((f) => {
          const n = (f.name || '').toLowerCase();
          const rel = (f.webkitRelativePath || '').toLowerCase();
          if (rel.includes('localizer')) return false;
          return /\.(dcm|dicom|ima|png|jpe?g|webp|bmp)$/i.test(n) || !n.includes('.');
        })
        .slice(0, 300);

      if (!candidateFiles.length) {
        setLocalError('Không tìm thấy tệp .dcm hoặc ảnh MRI (.jpg/.png) hợp lệ trong lựa chọn.');
        return;
      }

      revokeLocalObjectUrls();
      setLocalLoading(true);
      setLocalError('');
      setLocalProgress(`Đang đọc 0 / ${candidateFiles.length} tệp DICOM...`);
      setSourceMode('local');

      try {
        const parsedItems = [];
        for (let i = 0; i < candidateFiles.length; i++) {
          const item = await parseLocalDicomOrImageFile(candidateFiles[i]);
          if (item?.imageUrl && String(item.imageUrl).startsWith('blob:')) {
            objectUrlsRef.current.push(item.imageUrl);
          }
          if (item?.isDicom || item?.imageUrl) {
            parsedItems.push(item);
          }
          if ((i + 1) % 15 === 0 || i === candidateFiles.length - 1) {
            setLocalProgress(`Đã giải mã ${i + 1} / ${candidateFiles.length} lát cắt...`);
          }
        }

        if (!parsedItems.length) {
          setLocalError('Không giải mã được tệp DICOM/ảnh nào từ lựa chọn.');
          return;
        }

        const manifest = groupLocalFilesIntoSeries(parsedItems);
        const dicomCount = parsedItems.filter((p) => p.isDicom).length;
        const readableCount = parsedItems.filter((p) => Boolean(p.imageUrl)).length;

        setLocalManifest(manifest);
        setLocalStats({
          totalFiles: parsedItems.length,
          dicomCount,
          readableCount,
          seriesCount: manifest.series?.length || 0,
        });
        setLocalSessionId((s) => s + 1);
      } catch (err) {
        setLocalError(err?.message || 'Lỗi khi giải mã tệp DICOM cục bộ.');
      } finally {
        setLocalLoading(false);
        setLocalProgress('');
      }
    };
    input.click();
  };

  const activeDicomTags = activeSliceInfo?.sliceMeta || localManifest?.series?.[0]?.slices?.[0]?.metadata || null;

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="DicomViewer" user={user}>
      <ScrollView contentContainerStyle={styles.pageWrap}>
        {/* Header Trạm DICOM */}
        <View style={styles.heroCard}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.heroBadge}>
              <Monitor size={13} color="#A5F3FC" />
              <Text style={styles.heroBadgeText}>MINI-PACS WORKSTATION • KỸ THUẬT VIÊN CĐHA</Text>
            </View>
            <Text style={styles.heroTitle}>Trạm Xem Ảnh DICOM & Kiểm Chuẩn Phim MRI</Text>
            <Text style={styles.heroSub}>
              Kiểm tra chất lượng lát cắt theo chuỗi xung (WW/WL, Zoom, Âm bản, So sánh đa cửa sổ), kiểm chuẩn DICOM trên PACS hoặc mở trực tiếp tệp .dcm từ máy chụp.
            </Text>
          </View>

          <View style={styles.modeSwitchRow}>
            <TouchableOpacity
              onPress={() => setSourceMode('pacs')}
              style={[styles.modeBtn, sourceMode === 'pacs' && styles.modeBtnActive]}
            >
              <HardDrive size={15} color={sourceMode === 'pacs' ? '#0F172A' : '#CBD5E1'} />
              <Text style={[styles.modeBtnText, sourceMode === 'pacs' && styles.modeBtnTextActive]}>
                PACS Bệnh viện ({catalog.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSourceMode('local')}
              style={[styles.modeBtn, sourceMode === 'local' && styles.modeBtnActive]}
            >
              <FolderOpen size={15} color={sourceMode === 'local' ? '#0F172A' : '#CBD5E1'} />
              <Text style={[styles.modeBtnText, sourceMode === 'local' && styles.modeBtnTextActive]}>
                Mở tệp .dcm từ máy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {sourceMode === 'local' ? (
          <View style={styles.localSection}>
            <View style={styles.localToolbar}>
              <View style={{ flex: 1, minWidth: 240 }}>
                <Text style={styles.localTitle}>Mở trực tiếp tệp DICOM (.dcm) hoặc Thư mục từ máy chụp MRI</Text>
                <Text style={styles.localHint}>
                  Hỗ trợ giải mã header DICOM Part 10 (Uncompressed 8/16-bit & Encapsulated JPEG), tự gom nhóm chuỗi xung (T1, T2-FLAIR, DWI, T1C+...) mà chưa cần tải lên server.
                </Text>
              </View>
              <View style={styles.localBtnRow}>
                <TouchableOpacity onPress={() => handleOpenLocalFiles({ directory: false })} style={styles.btnPrimary}>
                  <FileSearch size={15} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Chọn tệp .dcm / ảnh MRI</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenLocalFiles({ directory: true })} style={styles.btnDark}>
                  <FolderOpen size={15} color="#22D3EE" />
                  <Text style={styles.btnDarkText}>Mở cả thư mục ca chụp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('CreateImagingResult')}
                  style={styles.btnOutline}
                >
                  <UploadCloud size={15} color="#1E293B" />
                  <Text style={styles.btnOutlineText}>Đẩy sang Sàng lọc AI & Gửi Bác sĩ</Text>
                </TouchableOpacity>
              </View>
            </View>

            {localLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color="#0284C7" />
                <Text style={styles.stateText}>{localProgress || 'Đang giải mã dữ liệu DICOM...'}</Text>
              </View>
            ) : localError ? (
              <View style={styles.errorBanner}>
                <AlertTriangle size={16} color="#B91C1C" />
                <Text style={styles.errorBannerText}>{localError}</Text>
              </View>
            ) : null}

            {localManifest ? (
              <>
                {localStats && (
                  <View style={styles.localStatsRow}>
                    <View style={styles.statPill}>
                      <Layers size={14} color="#0369A1" />
                      <Text style={styles.statPillText}>{localStats.seriesCount} chuỗi xung</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Monitor size={14} color="#0369A1" />
                      <Text style={styles.statPillText}>
                        {localStats.totalFiles} lát ({localStats.dicomCount} tệp DICOM .dcm)
                      </Text>
                    </View>
                    <View style={styles.statPill}>
                      <CheckCircle2 size={14} color="#059669" />
                      <Text style={styles.statPillText}>Hiển thị: {localStats.readableCount}/{localStats.totalFiles}</Text>
                    </View>
                  </View>
                )}

                <DicomWebViewer
                  key={`local-${localSessionId}`}
                  externalManifest={localManifest}
                  canMeasure={false}
                  canEditAiRoi={false}
                  onActiveSliceChange={(info) => setActiveSliceInfo(info)}
                />

                {activeDicomTags && (
                  <View style={styles.tagPanel}>
                    <Text style={styles.tagPanelTitle}>
                      Thông số thẻ DICOM lát cắt hiện tại ({activeSliceInfo?.fileName || activeDicomTags.fileName || 'Slice'})
                    </Text>
                    <View style={styles.tagGrid}>
                      {[
                        ['Bệnh nhân (0010,0010)', activeDicomTags.patientName],
                        ['Mã BN (0010,0020)', activeDicomTags.patientId],
                        ['Modality (0008,0060)', activeDicomTags.modality],
                        ['Ngày chụp (0008,0020)', activeDicomTags.studyDate || 'N/A'],
                        ['Chuỗi (0008,103E)', activeDicomTags.seriesDescription],
                        ['Lát # (0020,0013)', activeDicomTags.instanceNumber ?? 'N/A'],
                        ['Ma trận (Rows×Cols)', activeDicomTags.rows && activeDicomTags.columns ? `${activeDicomTags.rows} × ${activeDicomTags.columns}` : 'N/A'],
                        ['Bits Stored', activeDicomTags.bitsStored ? `${activeDicomTags.bitsStored}-bit` : 'N/A'],
                        ['Pixel Spacing', Array.isArray(activeDicomTags.pixelSpacing) ? activeDicomTags.pixelSpacing.join(' × ') + ' mm' : 'N/A'],
                        ['Slice Thickness', activeDicomTags.sliceThickness ? `${activeDicomTags.sliceThickness} mm` : 'N/A'],
                        ['Window C / W', activeDicomTags.windowCenter != null ? `${activeDicomTags.windowCenter} / ${activeDicomTags.windowWidth}` : 'Auto'],
                        ['Transfer Syntax', activeDicomTags.transferSyntaxUID || 'Standard Image'],
                      ].map(([k, v]) => (
                        <View key={k} style={styles.tagCell}>
                          <Text style={styles.tagKey}>{k}</Text>
                          <Text style={styles.tagVal} numberOfLines={1}>{String(v || 'N/A')}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : !localLoading ? (
              <View style={styles.emptyDropBox}>
                <FolderOpen size={36} color="#0284C7" />
                <Text style={styles.emptyDropTitle}>Chưa có tệp DICOM cục bộ nào được mở</Text>
                <Text style={styles.emptyDropSub}>
                  Bấm "Chọn tệp .dcm / ảnh MRI" hoặc "Mở cả thư mục ca chụp" ở trên để kiểm tra ảnh lát cắt ngay trên trình duyệt.
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.pacsGrid, isDesktop && styles.pacsGridDesktop]}>
            {/* Cột trái: Danh sách Study / Phim trên PACS */}
            <View style={[styles.studyListCard, isDesktop && styles.studyListDesktop]}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.listHeaderTitle}>Danh sách Ca DICOM / MRI</Text>
                <TouchableOpacity onPress={loadPacsData} style={styles.refreshBtn}>
                  <RefreshCw size={14} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBox}>
                <Search size={14} color="#64748B" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tìm tên BN, mã y tế, chuỗi xung..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.filterRow}>
                {[
                  ['all', 'Tất cả'],
                  ['hasImages', 'Có ảnh'],
                  ['hasAi', 'Có AI'],
                ].map(([id, label]) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setFilterChip(id)}
                    style={[styles.filterPill, filterChip === id && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, filterChip === id && styles.filterPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator color="#0284C7" />
                  <Text style={styles.stateText}>Đang đồng bộ PACS...</Text>
                </View>
              ) : pacsError ? (
                <View style={styles.errorBanner}>
                  <AlertTriangle size={14} color="#B91C1C" />
                  <Text style={styles.errorBannerText}>{pacsError}</Text>
                </View>
              ) : filteredCatalog.length === 0 ? (
                <View style={styles.stateBox}>
                  <Text style={styles.stateText}>Không có ca chụp phù hợp.</Text>
                </View>
              ) : (
                <ScrollView style={isDesktop ? { maxHeight: 680 } : { maxHeight: 260 }} nestedScrollEnabled>
                  {filteredCatalog.map((item) => {
                    const active = item.key === selectedKey;
                    const aiCls = item.aiClassName;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => setSelectedKey(item.key)}
                        style={[styles.studyItem, active && styles.studyItemActive]}
                      >
                        <View style={styles.studyItemTop}>
                          <Text style={[styles.studyPatient, active && { color: '#0F172A' }]} numberOfLines={1}>
                            {item.patientName}
                          </Text>
                          <View style={styles.sliceChip}>
                            <Text style={styles.sliceChipText}>{item.sliceCount} lát</Text>
                          </View>
                        </View>
                        <Text style={styles.studyMeta} numberOfLines={1}>
                          {item.medicalId} • {formatDateShort(item.studyDate)}
                        </Text>
                        <Text style={styles.studyProc} numberOfLines={1}>
                          {item.procedure}
                        </Text>
                        <View style={styles.studyBadgesRow}>
                          {aiCls ? (
                            <View
                              style={[
                                styles.aiMiniBadge,
                                { backgroundColor: aiCls === 'notumor' ? '#DCFCE7' : '#FEF3C7' },
                              ]}
                            >
                              <Brain size={11} color={aiCls === 'notumor' ? '#166534' : '#92400E'} />
                              <Text
                                style={[
                                  styles.aiMiniText,
                                  { color: aiCls === 'notumor' ? '#166534' : '#92400E' },
                                ]}
                              >
                                AI: {aiCls.toUpperCase()}
                                {item.aiConfidence ? ` (${Math.round(item.aiConfidence)}%)` : ''}
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.aiMiniBadge, { backgroundColor: '#F1F5F9' }]}>
                              <Text style={[styles.aiMiniText, { color: '#475569' }]}>
                                {STUDY_STATUS_VI[item.studyStatus || item.status] || 'PACS'}
                              </Text>
                            </View>
                          )}
                          {item.studyId && (
                            <View style={[styles.aiMiniBadge, { backgroundColor: '#E0F2FE' }]}>
                              <Text style={[styles.aiMiniText, { color: '#0369A1' }]}>DICOM Study</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Cột phải: Trình xem DicomWebViewer & Thanh công cụ QA KTV */}
            <View style={{ flex: 1, minWidth: 0 }}>
              {selectedPacsItem ? (
                <>
                  <View style={styles.qaBar}>
                    <View style={{ flex: 1, minWidth: 220 }}>
                      <Text style={styles.qaPatient}>
                        {selectedPacsItem.patientName} ({selectedPacsItem.medicalId})
                      </Text>
                      <Text style={styles.qaSub}>
                        {selectedPacsItem.procedure} • {selectedPacsItem.sliceCount} lát cắt
                        {selectedPacsItem.aiClassName
                          ? ` • AI: ${TUMOR_LABEL_VI[selectedPacsItem.aiClassName] || selectedPacsItem.aiClassName.toUpperCase()}`
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.qaActions}>
                      {selectedPacsItem.studyId && (
                        <TouchableOpacity
                          onPress={handleValidateStudy}
                          disabled={validating}
                          style={styles.btnDark}
                        >
                          <ShieldCheck size={14} color="#22D3EE" />
                          <Text style={styles.btnDarkText}>
                            {validating ? 'Đang kiểm chuẩn...' : 'Kiểm chuẩn DICOM'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {selectedPacsItem.imagingResultId && (
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('ImagingResult', {
                              imagingResultId: selectedPacsItem.imagingResultId,
                              activeRoute: 'DicomViewer',
                            })
                          }
                          style={styles.btnPrimary}
                        >
                          <Eye size={14} color="#fff" />
                          <Text style={styles.btnPrimaryText}>Xem chi tiết & AI</Text>
                        </TouchableOpacity>
                      )}
                      {!selectedPacsItem.hasImages && (
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('CreateImagingResult', {
                              visitId: selectedPacsItem.visitId || undefined,
                              patientName: selectedPacsItem.patientName,
                              medicalId: selectedPacsItem.medicalId,
                            })
                          }
                          style={styles.btnOutline}
                        >
                          <UploadCloud size={14} color="#1E293B" />
                          <Text style={styles.btnOutlineText}>Tải phim MRI</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {validationFeedback && (
                    <View
                      style={[
                        styles.validationBox,
                        validationFeedback.isValid ? styles.validationOk : styles.validationWarn,
                      ]}
                    >
                      <Text style={styles.validationTitle}>
                        {validationFeedback.isValid ? '✓ Đạt chuẩn DICOM' : '⚠ Kết quả kiểm chuẩn DICOM'} —{' '}
                        {validationFeedback.message}
                      </Text>
                      {validationFeedback.errors.map((err, idx) => (
                        <Text key={`e-${idx}`} style={styles.validationLineErr}>• Lỗi: {err}</Text>
                      ))}
                      {validationFeedback.warnings.map((w, idx) => (
                        <Text key={`w-${idx}`} style={styles.validationLineWarn}>• Lưu ý: {w}</Text>
                      ))}
                    </View>
                  )}

                  {selectedPacsItem.hasImages ? (
                    <DicomWebViewer
                      key={selectedPacsItem.key}
                      imagingResultId={selectedPacsItem.imagingResultId}
                      studyId={selectedPacsItem.studyId}
                      images={selectedPacsItem.images}
                      externalManifest={selectedPacsItem.externalManifest || null}
                      aiResult={selectedPacsItem.aiReport}
                      canMeasure={false}
                      canEditAiRoi={false}
                      onActiveSliceChange={(info) => setActiveSliceInfo(info)}
                    />
                  ) : (
                    <View style={styles.emptyDropBox}>
                      <Monitor size={36} color="#64748B" />
                      <Text style={styles.emptyDropTitle}>Ca chụp chưa có ảnh lát cắt trên PACS</Text>
                      <Text style={styles.emptyDropSub}>
                        Kỹ thuật viên có thể tải thư mục/tệp phim MRI lên ca chụp này hoặc chuyển sang tab "Mở tệp .dcm từ máy" để xem trước cục bộ.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyDropBox}>
                  <Monitor size={36} color="#64748B" />
                  <Text style={styles.emptyDropTitle}>Chọn một ca chụp từ danh sách PACS bên trái</Text>
                  <Text style={styles.emptyDropSub}>
                    Hoặc chuyển sang chế độ "Mở tệp .dcm từ máy" để xem trực tiếp file DICOM trên máy trạm.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  pageWrap: { padding: 16, gap: 14, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#0B1220',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  heroBadgeText: { color: '#A5F3FC', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  heroTitle: { color: '#F8FAFC', fontSize: 21, fontWeight: '800' },
  heroSub: { color: '#94A3B8', fontSize: 13, marginTop: 4, lineHeight: 19, maxWidth: 760 },
  modeSwitchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeBtnActive: { backgroundColor: '#22D3EE', borderColor: '#22D3EE' },
  modeBtnText: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  modeBtnTextActive: { color: '#0F172A' },

  pacsGrid: { gap: 14 },
  pacsGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  studyListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  studyListDesktop: { width: 320, flexShrink: 0 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', padding: 0 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterPillText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF' },

  studyItem: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    gap: 3,
  },
  studyItemActive: { borderColor: '#0284C7', backgroundColor: '#F0F9FF' },
  studyItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  studyPatient: { flex: 1, fontSize: 13.5, fontWeight: '800', color: '#1E293B' },
  sliceChip: { backgroundColor: '#E0F2FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sliceChipText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },
  studyMeta: { fontSize: 11.5, color: '#64748B', fontWeight: '600' },
  studyProc: { fontSize: 12, color: '#334155' },
  studyBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  aiMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiMiniText: { fontSize: 10.5, fontWeight: '700' },

  qaBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  qaPatient: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  qaSub: { fontSize: 12.5, color: '#475569', marginTop: 2 },
  qaActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  btnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnDarkText: { color: '#E2E8F0', fontSize: 12.5, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnOutlineText: { color: '#1E293B', fontSize: 12.5, fontWeight: '700' },

  validationBox: { borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, gap: 4 },
  validationOk: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  validationWarn: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  validationTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  validationLineErr: { fontSize: 12, color: '#B91C1C' },
  validationLineWarn: { fontSize: 12, color: '#92400E' },

  localSection: { gap: 12 },
  localToolbar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  localTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  localHint: { fontSize: 12.5, color: '#475569', marginTop: 3, maxWidth: 640 },
  localBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  localStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statPillText: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },

  tagPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  tagPanelTitle: { color: '#A5F3FC', fontSize: 13.5, fontWeight: '800' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagCell: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 180,
    flexGrow: 1,
  },
  tagKey: { color: '#94A3B8', fontSize: 10.5, fontWeight: '700' },
  tagVal: { color: '#F8FAFC', fontSize: 12.5, fontWeight: '700', marginTop: 2 },

  emptyDropBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyDropTitle: { fontSize: 15.5, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  emptyDropSub: { fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 520 },
  stateBox: { padding: 24, alignItems: 'center', gap: 8 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
  },
  errorBannerText: { color: '#B91C1C', fontSize: 12.5, fontWeight: '600', flex: 1 },
});

export default DicomViewerScreen;

