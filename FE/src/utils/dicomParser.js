/**
 * Pure-JS DICOM Part 10 (.dcm) Parser & Local Study Series Builder (Web + Testable)
 * - Hỗ trợ Explicit VR Little Endian & Implicit VR Little Endian
 * - Trích xuất metadata chuẩn (Patient, Modality, Series, Window Center/Width, PixelSpacing, SliceThickness)
 * - Giải mã PixelData uncompressed 8/16-bit grayscale hoặc RGB, và frame JPEG baseline đóng gói trong PixelData
 */

const EXPLICIT_LONG_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN']);

const SERIES_PATTERNS = [
  ['T1C+', /t1c|t1\+c|t1_ce|t1 ce|contrast|gad|\+c/i],
  ['T1_FLAIR', /t1_flair|t1 flair|sag_t1_flair|ax_t1_flair/i],
  ['T2_FLAIR', /t2_flair|t2 flair|flair/i],
  ['DWI', /dwi|b1000|diffusion|trace/i],
  ['ADC', /\badc\b|apparent diffusion/i],
  ['TOF_MRA', /tof|mra|spgr|time of flight/i],
  ['SWI', /swi|susceptibility/i],
  ['T2_CORONAL', /cor_t2|t2_cor|coronal/i],
  ['T2W', /t2w|\bt2\b|t2_fse|t2_fgre/i],
  ['T1W', /t1w|\bt1\b/i],
];

export const classifySeriesFromText = (text = '') => {
  const s = String(text || '').trim();
  for (const [label, re] of SERIES_PATTERNS) {
    if (re.test(s)) return label;
  }
  return 'OTHER';
};

const readAscii = (bytes, start, length) => {
  let out = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) {
    const c = bytes[i];
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
};

const parseNumericList = (str) =>
  String(str || '')
    .split('\\')
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite);

const formatDicomDate = (raw = '') => {
  const clean = String(raw || '').trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return clean;
};

const extractJpegFromEncapsulated = (bytes, startOffset) => {
  let soi = -1;
  for (let i = startOffset; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
      soi = i;
      break;
    }
  }
  if (soi < 0) return null;
  let eoi = bytes.length;
  for (let i = bytes.length - 2; i > soi + 2; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      eoi = i + 2;
      break;
    }
  }
  return bytes.subarray(soi, eoi);
};

const renderUncompressedPixelsToDataUrl = (bytes, offset, length, meta) => {
  if (typeof document === 'undefined') return null;
  const rows = Number(meta.rows) || 0;
  const cols = Number(meta.columns) || 0;
  if (rows <= 0 || cols <= 0) return null;

  const bitsAllocated = Number(meta.bitsAllocated) || 16;
  const samplesPerPixel = Number(meta.samplesPerPixel) || 1;
  const isSigned = Number(meta.pixelRepresentation) === 1;
  const slope = Number.isFinite(meta.rescaleSlope) ? meta.rescaleSlope : 1;
  const intercept = Number.isFinite(meta.rescaleIntercept) ? meta.rescaleIntercept : 0;

  const totalPixels = rows * cols;
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.createImageData(cols, rows);
  const rgba = imgData.data;

  if (samplesPerPixel === 3 && bitsAllocated === 8) {
    const maxCount = Math.min(totalPixels, Math.floor(length / 3));
    for (let i = 0; i < maxCount; i++) {
      const p = offset + i * 3;
      const o = i * 4;
      rgba[o] = bytes[p];
      rgba[o + 1] = bytes[p + 1];
      rgba[o + 2] = bytes[p + 2];
      rgba[o + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const values = new Float32Array(totalPixels);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let minVal = Infinity;
  let maxVal = -Infinity;

  if (bitsAllocated === 8) {
    const count = Math.min(totalPixels, length);
    for (let i = 0; i < count; i++) {
      const raw = isSigned ? view.getInt8(offset + i) : view.getUint8(offset + i);
      const val = raw * slope + intercept;
      values[i] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  } else {
    const count = Math.min(totalPixels, Math.floor(length / 2));
    for (let i = 0; i < count; i++) {
      const pos = offset + i * 2;
      const raw = isSigned ? view.getInt16(pos, true) : view.getUint16(pos, true);
      const val = raw * slope + intercept;
      values[i] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }

  let wc = Number.isFinite(meta.windowCenter) ? meta.windowCenter : null;
  let ww = Number.isFinite(meta.windowWidth) && meta.windowWidth > 0 ? meta.windowWidth : null;
  if (wc === null || ww === null) {
    const range = maxVal - minVal;
    ww = range > 0 ? range : 1;
    wc = minVal + ww / 2;
  }

  const low = wc - ww / 2;
  const invW = ww > 0 ? 255 / ww : 1;

  for (let i = 0; i < totalPixels; i++) {
    let g = (values[i] - low) * invW;
    if (g < 0) g = 0;
    else if (g > 255) g = 255;
    const u8 = g | 0;
    const o = i * 4;
    rgba[o] = u8;
    rgba[o + 1] = u8;
    rgba[o + 2] = u8;
    rgba[o + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Parse ArrayBuffer của tệp DICOM Part 10 (.dcm)
 * Trả về { isDicom, metadata, imageUrl, pixelStats, unreadPixelReason }
 */
export const parseDicomBuffer = (arrayBuffer, fileName = '') => {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 136) {
    return { isDicom: false, error: 'Tệp quá nhỏ, không phải DICOM Part 10.' };
  }
  const magic = readAscii(bytes, 128, 4);
  if (magic !== 'DICM') {
    return { isDicom: false, error: 'Thiếu header DICM chuẩn Part 10 tại byte 128.' };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 132;
  let implicitMode = false;
  const tags = {};
  let pixelDataOffset = -1;
  let pixelDataLength = 0;

  while (pos + 8 <= bytes.length) {
    const group = view.getUint16(pos, true);
    const elem = view.getUint16(pos + 2, true);
    const key = `${group.toString(16).padStart(4, '0')},${elem.toString(16).padStart(4, '0')}`.toUpperCase();

    // Sau Meta Group (0002,xxxx), nếu Transfer Syntax là Implicit VR Little Endian
    if (group > 0x0002 && tags['0002,0010'] === '1.2.840.10008.1.2') {
      implicitMode = true;
    }

    let vr = '';
    let valLen = 0;
    let headerLen = 8;

    const vrCandidate = readAscii(bytes, pos + 4, 2);
    const looksLikeExplicit = !implicitMode && /^[A-Z]{2}$/.test(vrCandidate);

    if (looksLikeExplicit) {
      vr = vrCandidate;
      if (EXPLICIT_LONG_VRS.has(vr)) {
        if (pos + 12 > bytes.length) break;
        valLen = view.getUint32(pos + 8, true);
        headerLen = 12;
      } else {
        valLen = view.getUint16(pos + 6, true);
        headerLen = 8;
      }
    } else {
      valLen = view.getUint32(pos + 4, true);
      headerLen = 8;
    }

    const valStart = pos + headerLen;

    if (key === '7FE0,0010') {
      pixelDataOffset = valStart;
      pixelDataLength = valLen === 0xffffffff ? bytes.length - valStart : Math.min(valLen, bytes.length - valStart);
      break;
    }

    // Bỏ qua Sequence có chiều dài không xác định (SQ undefined length) bằng cách tìm Item Delimitation
    if (valLen === 0xffffffff) {
      let scan = valStart;
      let foundDelim = false;
      while (scan + 8 <= bytes.length) {
        const g2 = view.getUint16(scan, true);
        const e2 = view.getUint16(scan + 2, true);
        if (g2 === 0xfffe && e2 === 0xe0dd) {
          pos = scan + 8;
          foundDelim = true;
          break;
        }
        scan += 2;
      }
      if (!foundDelim) break;
      continue;
    }

    if (valStart + valLen > bytes.length) break;

    if (['0028,0010', '0028,0011', '0028,0100', '0028,0101', '0028,0103', '0028,0002'].includes(key) && valLen >= 2) {
      tags[key] = view.getUint16(valStart, true);
    } else if (valLen <= 256) {
      tags[key] = readAscii(bytes, valStart, valLen);
    }

    pos = valStart + valLen;
  }

  const wcList = parseNumericList(tags['0028,1050']);
  const wwList = parseNumericList(tags['0028,1051']);
  const spacingList = parseNumericList(tags['0028,0030']);
  const sliceThickness = Number(tags['0018,0050']);
  const rescaleSlope = Number(tags['0028,1053']);
  const rescaleIntercept = Number(tags['0028,1052']);
  const seriesNum = Number(tags['0020,0011']);
  const instanceNum = Number(tags['0020,0013']);

  const metadata = {
    fileName,
    transferSyntaxUID: tags['0002,0010'] || '1.2.840.10008.1.2.1',
    patientName: (tags['0010,0010'] || '').replace(/\^+/g, ' ').trim() || 'Bệnh nhân (DICOM local)',
    patientId: tags['0010,0020'] || 'N/A',
    modality: tags['0008,0060'] || 'MR',
    studyDate: formatDicomDate(tags['0008,0020'] || ''),
    studyDescription: tags['0008,1030'] || '',
    seriesDescription: tags['0008,103E'] || tags['0008,1030'] || 'Chuỗi DICOM',
    seriesInstanceUID: tags['0020,000E'] || '',
    bodyPartExamined: tags['0018,0015'] || 'BRAIN',
    seriesNumber: Number.isFinite(seriesNum) ? seriesNum : 1,
    instanceNumber: Number.isFinite(instanceNum) ? instanceNum : null,
    rows: Number(tags['0028,0010']) || 0,
    columns: Number(tags['0028,0011']) || 0,
    bitsAllocated: Number(tags['0028,0100']) || 16,
    bitsStored: Number(tags['0028,0101']) || Number(tags['0028,0100']) || 16,
    pixelRepresentation: Number(tags['0028,0103']) || 0,
    samplesPerPixel: Number(tags['0028,0002']) || 1,
    pixelSpacing: spacingList.length >= 2 ? [spacingList[0], spacingList[1]] : [0.5, 0.5],
    sliceThickness: Number.isFinite(sliceThickness) && sliceThickness > 0 ? sliceThickness : 3.0,
    windowCenter: wcList.length ? wcList[0] : null,
    windowWidth: wwList.length ? wwList[0] : null,
    rescaleSlope: Number.isFinite(rescaleSlope) && rescaleSlope !== 0 ? rescaleSlope : 1,
    rescaleIntercept: Number.isFinite(rescaleIntercept) ? rescaleIntercept : 0,
    seriesType: classifySeriesFromText(tags['0008,103E'] || fileName),
  };

  let imageUrl = null;
  let unreadPixelReason = null;

  if (pixelDataOffset >= 0 && pixelDataLength > 0) {
    const isUncompressedSyntax = [
      '1.2.840.10008.1.2',
      '1.2.840.10008.1.2.1',
      '1.2.840.10008.1.2.2',
    ].includes(metadata.transferSyntaxUID);

    if (metadata.transferSyntaxUID === '1.2.840.10008.1.2.2') {
      unreadPixelReason = 'Transfer Syntax Big Endian chưa hỗ trợ hiển thị trực tiếp trên trình duyệt.';
    } else if (isUncompressedSyntax) {
      imageUrl = renderUncompressedPixelsToDataUrl(bytes, pixelDataOffset, pixelDataLength, metadata);
      if (!imageUrl && typeof document !== 'undefined') {
        unreadPixelReason = 'Thiếu kích thước Rows/Columns hợp lệ trong PixelData.';
      }
    } else {
      const jpegSlice = extractJpegFromEncapsulated(bytes, pixelDataOffset);
      if (jpegSlice && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
        imageUrl = URL.createObjectURL(blob);
      } else {
        unreadPixelReason = `Chuẩn nén DICOM (${metadata.transferSyntaxUID}) chưa hỗ trợ giải mã trực tiếp ở trình duyệt — vẫn hiển thị đầy đủ thẻ DICOM.`;
      }
    }
  } else {
    unreadPixelReason = 'Tệp DICOM không có tag PixelData (7FE0,0010).';
  }

  return {
    isDicom: true,
    metadata,
    imageUrl,
    pixelDataLength,
    unreadPixelReason,
  };
};

/**
 * Đọc danh sách File (từ <input type="file">) gồm cả .dcm và .jpg/.jpeg/.png
 */
export const parseLocalDicomOrImageFile = async (file) => {
  const name = file?.name || 'slice';
  const rel = file?.webkitRelativePath || name;
  const lower = name.toLowerCase();

  if (/\.(png|jpe?g|webp|bmp)$/i.test(lower)) {
    const uri = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
    const folder = rel.includes('/') ? rel.split('/').slice(-2, -1)[0] : 'Ảnh MRI cục bộ';
    return {
      isDicom: false,
      relativePath: rel,
      imageUrl: uri,
      metadata: {
        fileName: name,
        patientName: 'Xem cục bộ (Workstation)',
        patientId: 'LOCAL',
        modality: 'MR',
        studyDate: new Date().toISOString().slice(0, 10),
        seriesDescription: folder,
        seriesType: classifySeriesFromText(`${folder} ${name}`),
        seriesNumber: 1,
        instanceNumber: null,
        pixelSpacing: [0.5, 0.5],
        sliceThickness: 3.0,
        rows: null,
        columns: null,
      },
      unreadPixelReason: null,
    };
  }

  const buf = await file.arrayBuffer();
  const parsed = parseDicomBuffer(buf, name);
  return {
    ...parsed,
    relativePath: rel,
  };
};

const extractTrailingNumber = (str = '') => {
  const m = String(str).match(/(\d+)(?=\.[^.]*$|$)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/**
 * Gom nhóm danh sách lát cắt cục bộ thành manifest tương thích DicomWebViewer
 */
export const groupLocalFilesIntoSeries = (items = []) => {
  const groups = new Map();

  for (const item of items) {
    if (!item) continue;
    const meta = item.metadata || {};
    const folder = item.relativePath && item.relativePath.includes('/')
      ? item.relativePath.split('/').slice(-2, -1)[0]
      : '';
    const desc = meta.seriesDescription && meta.seriesDescription !== 'Chuỗi DICOM'
      ? meta.seriesDescription
      : (folder || meta.seriesDescription || 'Chuỗi DICOM');
    const sType = meta.seriesType && meta.seriesType !== 'OTHER'
      ? meta.seriesType
      : classifySeriesFromText(`${desc} ${item.relativePath || ''}`);
    const key = meta.seriesInstanceUID || `${meta.seriesNumber || 1}::${desc}`;

    if (!groups.has(key)) {
      groups.set(key, {
        seriesId: `local-${groups.size + 1}`,
        seriesNumber: meta.seriesNumber || groups.size + 1,
        seriesType: sType || 'T2_FLAIR',
        seriesDescription: desc,
        pixelSpacing: meta.pixelSpacing || [0.5, 0.5],
        sliceThickness: meta.sliceThickness || 3.0,
        slices: [],
      });
    }

    groups.get(key).slices.push({
      sliceIndex: groups.get(key).slices.length + 1,
      instanceNumber: meta.instanceNumber,
      fileName: meta.fileName || item.relativePath,
      imageUrl: item.imageUrl || '',
      metadata: meta,
      unreadPixelReason: item.unreadPixelReason || null,
    });
  }

  const series = Array.from(groups.values())
    .sort((a, b) => (a.seriesNumber || 0) - (b.seriesNumber || 0))
    .map((grp) => {
      grp.slices.sort((a, b) => {
        const ai = Number.isFinite(a.instanceNumber) ? a.instanceNumber : extractTrailingNumber(a.fileName);
        const bi = Number.isFinite(b.instanceNumber) ? b.instanceNumber : extractTrailingNumber(b.fileName);
        if (ai !== bi) return ai - bi;
        return String(a.fileName || '').localeCompare(String(b.fileName || ''));
      });
      grp.slices = grp.slices.map((s, idx) => ({ ...s, sliceIndex: idx + 1, globalSliceIndex: idx }));
      grp.sliceCount = grp.slices.length;
      return grp;
    });

  const firstMeta = series[0]?.slices?.[0]?.metadata || {};
  const presetList = [
    ...(Number.isFinite(firstMeta.windowWidth) && Number.isFinite(firstMeta.windowCenter)
      ? [{
          id: 'dicom_header',
          label: `Theo DICOM (W:${Math.round(firstMeta.windowWidth)} L:${Math.round(firstMeta.windowCenter)})`,
          ww: Math.round(firstMeta.windowWidth),
          wl: Math.round(firstMeta.windowCenter),
          brightness: 100,
          contrast: 105,
        }]
      : []),
    { id: 'brain_standard', label: 'Não chuẩn (W:80 L:40)', ww: 80, wl: 40, brightness: 100, contrast: 105 },
    { id: 'tumor_flair', label: 'U não / Phù FLAIR (W:140 L:50)', ww: 140, wl: 50, brightness: 106, contrast: 128 },
    { id: 't1_contrast', label: 'T1C+ Ngấm thuốc (W:120 L:60)', ww: 120, wl: 60, brightness: 96, contrast: 142 },
    { id: 'stroke_dwi', label: 'DWI Khuếch tán (W:60 L:30)', ww: 60, wl: 30, brightness: 112, contrast: 155 },
  ];

  return {
    patientName: firstMeta.patientName || 'Bệnh nhân (DICOM local)',
    medicalId: firstMeta.patientId || 'LOCAL',
    studyDate: firstMeta.studyDate || new Date().toISOString().slice(0, 10),
    modality: firstMeta.modality || 'MR',
    windowPresets: presetList,
    series,
    aiOverlay: { available: false, sliceOverlays: [] },
    priorStudy: null,
  };
};

