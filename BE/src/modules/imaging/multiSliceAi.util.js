import { ImagingResult } from "./models/imagingResult.model.js";
import {
  AI_CLASS_NAMES,
  isValidBoundingBox,
  buildAiReport,
  applyAiResultToImaging,
} from "./aiResult.util.js";

/**
 * Clamp and validate a normalized [0..1] bounding box `{ x, y, width, height }` (also accepts `w`/`h` aliases).
 * Returns canonical `{ x, y, width, height }` compatible with `isValidBoundingBox`, or `null` if invalid.
 */
export const normalizeNormalizedBox = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.width !== undefined ? raw.width : raw.w);
  const h = Number(raw.height !== undefined ? raw.height : raw.h);
  const clampedX = Math.max(0, Math.min(0.9999, x));
  const clampedY = Math.max(0, Math.min(0.9999, y));
  const candidate = {
    x: Number.isFinite(x) ? Number(clampedX.toFixed(4)) : NaN,
    y: Number.isFinite(y) ? Number(clampedY.toFixed(4)) : NaN,
    width: Number.isFinite(w) ? Number(Math.min(1 - clampedX, w).toFixed(4)) : NaN,
    height: Number.isFinite(h) ? Number(Math.min(1 - clampedY, h).toFixed(4)) : NaN,
  };
  if (!isValidBoundingBox(candidate)) return null;
  return candidate;
};

/**
 * Resolve effective overlay for a single slice, giving precedence to Doctor override when present.
 */
export const computeEffectiveSliceOverlay = (sliceEntry) => {
  if (!sliceEntry || typeof sliceEntry !== "object") return null;
  const override = sliceEntry.doctorOverride && typeof sliceEntry.doctorOverride === "object"
    ? sliceEntry.doctorOverride
    : null;
  const effectiveClass = override?.correctedClass || sliceEntry.class_name || "notumor";
  const effectiveBox = effectiveClass === "notumor"
    ? null
    : (override?.correctedBoundingBox || sliceEntry.bounding_box || null);

  return {
    sliceIndex: Number(sliceEntry.sliceIndex ?? 0),
    imageUrl: sliceEntry.imageUrl || null,
    seriesName: sliceEntry.seriesName || "Uploaded_Study",
    sequenceType: sliceEntry.sequenceType || "OTHER",
    plane: sliceEntry.plane || "unknown",
    sliceNumber: sliceEntry.sliceNumber ?? null,
    className: effectiveClass,
    aiClassName: sliceEntry.class_name || "notumor",
    confidence: sliceEntry.confidence ?? 0,
    boundingBox: effectiveBox,
    aiBoundingBox: sliceEntry.class_name === "notumor" ? null : (sliceEntry.bounding_box || null),
    tumorLocation: effectiveClass === "notumor"
      ? null
      : (override?.correctedLocation || sliceEntry.tumor_location || null),
    heatmapStreamUrl: sliceEntry.heatmapStreamUrl || null,
    isDoctorEdited: Boolean(override),
    doctorOverride: override,
    consensusMessage: sliceEntry.consensus_message || null,
  };
};

/**
 * Aggregate per-slice Full Consensus AI predictions into a unified multi-slice `aiReport`.
 * Never fabricates bounding boxes for `notumor` predictions and preserves existing single-slice fields
 * for backward compatibility.
 */
export const buildMultiSliceAiReport = (
  sliceOutcomes = [],
  {
    source = "ktv_batch",
    analyzedBy = null,
    primarySliceIndex = null,
  } = {}
) => {
  const sliceResults = [];
  const analyzedItems = [];

  for (let i = 0; i < sliceOutcomes.length; i += 1) {
    const item = sliceOutcomes[i] || {};
    const sliceIndex = Number.isInteger(item.sliceIndex) ? item.sliceIndex : i;

    if (!item.aiData || item.error) {
      sliceResults.push({
        sliceIndex,
        imageUrl: item.imageUrl || null,
        seriesName: item.seriesName || "Uploaded_Study",
        sequenceType: item.sequenceType || "OTHER",
        plane: item.plane || "unknown",
        sliceNumber: item.sliceNumber ?? null,
        clarityScore: item.clarityScore ?? null,
        class_name: null,
        confidence: null,
        probabilities: null,
        tumor_location: null,
        bounding_box: null,
        heatmapStreamUrl: null,
        clinical_report: null,
        consensus_message: null,
        privacy_guard: null,
        doctorOverride: null,
        error: item.error || "Không phân tích được lát cắt này.",
      });
      continue;
    }

    const single = buildAiReport(item.aiData, {
      dims: item.dims || null,
      source,
      analyzedBy,
    });
    const isNoTumor = single.class_name === "notumor";
    const entry = {
      sliceIndex,
      imageUrl: item.imageUrl || null,
      seriesName: item.seriesName || "Uploaded_Study",
      sequenceType: item.sequenceType || "OTHER",
      plane: item.plane || "unknown",
      sliceNumber: item.sliceNumber ?? null,
      clarityScore: item.clarityScore ?? null,
      class_name: single.class_name,
      confidence: single.confidence,
      probabilities: single.probabilities || null,
      tumor_location: isNoTumor ? null : (single.tumor_location || null),
      bounding_box: isNoTumor ? null : (single.bounding_box || null),
      heatmapStreamUrl: single.heatmapStreamUrl || null,
      clinical_report: single.clinical_report || null,
      consensus_message: single.consensus_message || null,
      privacy_guard: single.privacy_guard || null,
      doctorOverride: null,
      error: null,
    };

    sliceResults.push(entry);
    analyzedItems.push({ entry, single });
  }

  if (analyzedItems.length === 0) {
    return null;
  }

  // Score candidates to choose primary representative slice and Top 5 key slices.
  const ranked = [...analyzedItems].sort((a, b) => {
    const aTumor = a.entry.class_name !== "notumor" ? 1 : 0;
    const bTumor = b.entry.class_name !== "notumor" ? 1 : 0;
    if (aTumor !== bTumor) return bTumor - aTumor;

    const aHasBox = a.entry.bounding_box ? 1 : 0;
    const bHasBox = b.entry.bounding_box ? 1 : 0;
    if (aHasBox !== bHasBox) return bHasBox - aHasBox;

    const aScore = (Number(a.entry.confidence || 0) / 100) * 0.75 + Number(a.entry.clarityScore || 0) * 0.25;
    const bScore = (Number(b.entry.confidence || 0) / 100) * 0.75 + Number(b.entry.clarityScore || 0) * 0.25;
    return bScore - aScore;
  });

  const tumorDetectedCount = analyzedItems.filter((x) => x.entry.class_name !== "notumor").length;
  let primaryItem = ranked[0];

  // Honor KTV explicit primary slice when consistent with tumor findings (or all notumor).
  if (Number.isInteger(primarySliceIndex)) {
    const ktvChoice = analyzedItems.find((x) => x.entry.sliceIndex === primarySliceIndex);
    if (ktvChoice && (tumorDetectedCount === 0 || ktvChoice.entry.class_name !== "notumor")) {
      primaryItem = ktvChoice;
    }
  }

  const classVotes = {};
  for (const { entry } of analyzedItems) {
    if (entry.class_name && entry.class_name !== "notumor") {
      classVotes[entry.class_name] = (classVotes[entry.class_name] || 0) + 1;
    }
  }
  const dominantClass = Object.keys(classVotes).length > 0
    ? Object.entries(classVotes).sort((a, b) => b[1] - a[1])[0][0]
    : primaryItem.entry.class_name;

  const top5SlicesUrls = ranked
    .map((x) => x.entry.imageUrl)
    .filter(Boolean)
    .slice(0, 5);

  const distinctSeries = new Set(sliceResults.map((s) => s.seriesName).filter(Boolean));
  const representativeSliceUrl = primaryItem.entry.imageUrl || null;

  return {
    ...primaryItem.single,
    multiSlice: true,
    representativeSliceIndex: primaryItem.entry.sliceIndex,
    representativeSliceUrl,
    top5SlicesUrls,
    summary: {
      totalSlices: sliceResults.length,
      analyzedSlices: analyzedItems.length,
      failedSlices: sliceResults.length - analyzedItems.length,
      tumorDetectedSlices: tumorDetectedCount,
      dominantClass,
      seriesCount: distinctSeries.size,
    },
    sliceResults,
  };
};

/**
 * Persist multi-slice AI report onto an unsigned ImagingResult while preserving
 * `isSigned === true` immutability invariants.
 */
export const applyMultiSliceAiResultToImaging = async ({
  imagingResultId,
  hospitalId,
  multiReport,
  fillDraft = null,
}) => {
  if (!multiReport) return { matched: false, updated: false };

  const baseApplied = await applyAiResultToImaging({
    imagingResultId,
    hospitalId,
    aiReport: multiReport,
    fillDraft,
    representativeSliceUrl: multiReport.representativeSliceUrl || null,
  });

  if (baseApplied.updated && Array.isArray(multiReport.top5SlicesUrls) && multiReport.top5SlicesUrls.length > 0) {
    await ImagingResult.updateOne(
      { _id: imagingResultId, hospitalId, isSigned: { $ne: true } },
      { $set: { top5SlicesUrls: multiReport.top5SlicesUrls } }
    ).setOptions({ bypassTenancy: true });
  }

  return baseApplied;
};

/**
 * Apply Doctor per-slice ROI / tumor class override to an existing `aiReport`
 * without mutating other slices. Returns `{ updatedReport, matchedSliceIndex, doctorOverride }`.
 */
export const applyDoctorSliceOverride = ({
  existingReport,
  sliceIndex = null,
  imageUrl = null,
  correctClass,
  correctedBox = null,
  note = "",
  userId = null,
  now = new Date(),
}) => {
  if (!AI_CLASS_NAMES.includes(String(correctClass || "").trim())) {
    throw new Error("correct_class không hợp lệ.");
  }
  const cleanClass = String(correctClass).trim();
  const normalizedBox = cleanClass === "notumor" ? null : normalizeNormalizedBox(correctedBox);

  const report = existingReport && typeof existingReport === "object"
    ? JSON.parse(JSON.stringify(existingReport))
    : {};

  if (!Array.isArray(report.sliceResults) || report.sliceResults.length === 0) {
    report.sliceResults = [
      {
        sliceIndex: 0,
        imageUrl: imageUrl || report.representativeSliceUrl || null,
        seriesName: "Uploaded_Study",
        sequenceType: "OTHER",
        plane: "unknown",
        sliceNumber: null,
        class_name: report.class_name || "notumor",
        confidence: report.confidence ?? null,
        probabilities: report.probabilities || null,
        tumor_location: report.tumor_location || null,
        bounding_box: report.bounding_box || null,
        heatmapStreamUrl: report.heatmapStreamUrl || null,
        clinical_report: report.clinical_report || null,
        consensus_message: report.consensus_message || null,
        doctorOverride: null,
        error: null,
      },
    ];
  }

  let matchedIdx = -1;
  if (imageUrl) {
    matchedIdx = report.sliceResults.findIndex((s) => s?.imageUrl === imageUrl);
  }
  if (matchedIdx < 0 && Number.isInteger(Number(sliceIndex)) && Number(sliceIndex) >= 0) {
    matchedIdx = report.sliceResults.findIndex((s, idx) => Number(s?.sliceIndex ?? idx) === Number(sliceIndex));
    if (matchedIdx < 0 && Number(sliceIndex) < report.sliceResults.length) {
      matchedIdx = Number(sliceIndex);
    }
  }
  if (matchedIdx < 0) matchedIdx = 0;

  const targetSlice = report.sliceResults[matchedIdx];
  const doctorOverride = {
    correctedClass: cleanClass,
    correctedBoundingBox: normalizedBox,
    correctedLocation: normalizedBox
      ? {
          normalized: true,
          x: normalizedBox.x,
          y: normalizedBox.y,
          width: normalizedBox.width,
          height: normalizedBox.height,
          w: normalizedBox.width,
          h: normalizedBox.height,
        }
      : null,
    note: String(note || "").trim().slice(0, 1000),
    by: String(userId || ""),
    at: now,
  };

  targetSlice.doctorOverride = doctorOverride;

  const isRepresentative =
    Number(targetSlice.sliceIndex ?? matchedIdx) === Number(report.representativeSliceIndex ?? 0) ||
    (report.representativeSliceUrl && targetSlice.imageUrl === report.representativeSliceUrl) ||
    matchedIdx === 0;

  if (isRepresentative) {
    report.doctorCorrection = {
      correctClass: cleanClass,
      bounding_box: normalizedBox,
      tumor_location: doctorOverride.correctedLocation,
      sliceIndex: Number(targetSlice.sliceIndex ?? matchedIdx),
      imageUrl: targetSlice.imageUrl || imageUrl || null,
      note: doctorOverride.note,
      by: String(userId || ""),
      at: now,
    };
  }

  return {
    updatedReport: report,
    matchedSliceIndex: Number(targetSlice.sliceIndex ?? matchedIdx),
    matchedImageUrl: targetSlice.imageUrl || imageUrl || null,
    doctorOverride,
  };
};
