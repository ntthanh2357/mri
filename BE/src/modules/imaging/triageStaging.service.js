import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getLocalRoot } from "../../services/storage/localAdapter.js";
import { putFileFromPath } from "../../services/storage/storageService.js";
import { aiFetch, aiServiceUrl } from "../../utils/aiClient.util.js";
import { signUploadPath } from "../../middlewares/uploadSignature.middleware.js";
import {
  buildStoredZipBuffer,
  extractImagesFromZipBuffer,
  hasValidImageMagicBytes,
  isIgnoredStudyPath,
  isSupportedStudyImageExt,
  sanitizeStudyRelativePath,
} from "./zipArchive.util.js";

export const TRIAGE_SESSION_TTL_MS = 60 * 60 * 1000;
export const MAX_TRIAGE_FILES_PER_SESSION = 3000;
export const MAX_TRIAGE_SESSIONS_PER_USER = 6;
export const MAX_FINALIZE_SLICES = 15;
export const AI_TRIAGE_TIMEOUT_MS = Number(process.env.AI_TRIAGE_TIMEOUT_MS) || 300000;

const EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/bmp": ".bmp",
  "image/webp": ".webp",
};

export const triageSessions = new Map();

const safeSessionSegment = (value, fallback = "session") =>
  String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_") || fallback;

const getStagingBaseDir = () => path.resolve(getLocalRoot(), "_triage_staging");

const removeDirSafe = async (dirPath) => {
  if (!dirPath) return;
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Best-effort temp cleanup
  }
};

export const purgeExpiredTriageSessions = async (now = Date.now()) => {
  const toDelete = [];
  for (const [id, session] of triageSessions.entries()) {
    if (session.expiresAt <= now) {
      toDelete.push([id, session.stagingDir]);
    }
  }
  for (const [id, dir] of toDelete) {
    triageSessions.delete(id);
    await removeDirSafe(dir);
  }
};

const cleanupTimer = setInterval(() => {
  purgeExpiredTriageSessions().catch(() => {});
}, 10 * 60 * 1000);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

const assertSessionAccess = (session, user) => {
  if (!session) {
    throw Object.assign(new Error("Phiên sàng lọc ảnh không tồn tại hoặc đã hết hạn."), { statusCode: 404 });
  }
  if (session.expiresAt <= Date.now()) {
    triageSessions.delete(session.sessionId);
    removeDirSafe(session.stagingDir).catch(() => {});
    throw Object.assign(new Error("Phiên sàng lọc ảnh đã hết hạn, vui lòng chọn lại thư mục."), { statusCode: 410 });
  }
  const sameHospital = String(session.hospitalId || "") === String(user?.hospitalId || "");
  if (!sameHospital) {
    throw Object.assign(new Error("Không có quyền truy cập phiên sàng lọc của cơ sở khác."), { statusCode: 403 });
  }
  const isOwner = String(session.uploadedBy || "") === String(user?.id || "");
  const isSupervisor = ["admin", "hospital_admin", "department_head"].includes(user?.role);
  if (!isOwner && !isSupervisor) {
    throw Object.assign(new Error("Không có quyền thao tác trên phiên sàng lọc của người khác."), { statusCode: 403 });
  }
};

const touchSession = (session) => {
  session.expiresAt = Date.now() + TRIAGE_SESSION_TTL_MS;
};

/**
 * Initialize a new ephemeral MRI study triage staging session for KTV.
 */
export const initTriageSession = async ({
  user,
  visitId = null,
  patientId = null,
  protocolCode = null,
  withContrast = false,
  clientIgnoredCount = 0,
}) => {
  await purgeExpiredTriageSessions();

  // Enforce per-user session cap by pruning oldest session if exceeded.
  const userSessions = [...triageSessions.values()]
    .filter((s) => s.uploadedBy === String(user?.id || ""))
    .sort((a, b) => a.createdAt - b.createdAt);
  while (userSessions.length >= MAX_TRIAGE_SESSIONS_PER_USER) {
    const oldest = userSessions.shift();
    if (oldest) {
      triageSessions.delete(oldest.sessionId);
      await removeDirSafe(oldest.stagingDir);
    }
  }

  const sessionId = crypto.randomUUID().replace(/-/g, "");
  const safeId = safeSessionSegment(sessionId, "session");
  const stagingDir = path.resolve(getStagingBaseDir(), safeId);
  await fs.promises.mkdir(stagingDir, { recursive: true });

  const session = {
    sessionId,
    hospitalId: String(user?.hospitalId || ""),
    uploadedBy: String(user?.id || ""),
    visitId: visitId ? String(visitId) : null,
    patientId: patientId ? String(patientId) : null,
    protocolCode: protocolCode ? String(protocolCode).trim().toUpperCase() : null,
    withContrast: Boolean(withContrast),
    stagingDir,
    slices: new Map(),
    lastTriageResult: null,
    clientIgnoredCount: Math.max(0, Number(clientIgnoredCount) || 0),
    serverIgnoredCount: 0,
    nonImageCount: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + TRIAGE_SESSION_TTL_MS,
  };

  triageSessions.set(sessionId, session);
  return {
    sessionId,
    expiresAt: new Date(session.expiresAt).toISOString(),
    maxFiles: MAX_TRIAGE_FILES_PER_SESSION,
  };
};

const addSingleStagingImage = async (session, { relativePath, buffer, mimeType = null }) => {
  const cleanRel = sanitizeStudyRelativePath(relativePath);
  if (!cleanRel) {
    session.nonImageCount += 1;
    return { kept: false, reason: "invalid_path" };
  }
  const origExt = path.extname(cleanRel).toLowerCase();
  const ext = isSupportedStudyImageExt(cleanRel) ? origExt : (MIME_TO_EXT[mimeType] || "");
  if (!ext) {
    session.nonImageCount += 1;
    return { kept: false, reason: "non_image" };
  }

  if (isIgnoredStudyPath(cleanRel)) {
    session.serverIgnoredCount += 1;
    return { kept: false, reason: "ignored_sequence" };
  }

  if (!hasValidImageMagicBytes(buffer, cleanRel)) {
    session.nonImageCount += 1;
    return { kept: false, reason: "invalid_magic_bytes" };
  }

  if (session.slices.size >= MAX_TRIAGE_FILES_PER_SESSION) {
    throw Object.assign(
      new Error(`Phiên sàng lọc vượt giới hạn tối đa ${MAX_TRIAGE_FILES_PER_SESSION} lát cắt.`),
      { statusCode: 400 }
    );
  }

  const sliceKey = `s_${crypto.randomBytes(8).toString("hex")}`;
  const diskPath = path.resolve(session.stagingDir, `${sliceKey}${ext}`);
  if (!diskPath.startsWith(session.stagingDir + path.sep)) {
    throw Object.assign(new Error("Đường dẫn lưu tạm không hợp lệ."), { statusCode: 400 });
  }

  await fs.promises.writeFile(diskPath, buffer);

  const relParts = cleanRel.split("/");
  const filename = relParts[relParts.length - 1] || `${sliceKey}${ext}`;
  const seriesName = relParts.length > 1 ? relParts[relParts.length - 2] : "Uploaded_Study";

  session.slices.set(sliceKey, {
    sliceKey,
    diskPath,
    relativePath: cleanRel,
    filename,
    seriesName,
    mimeType: EXT_TO_MIME[ext] || mimeType || "image/jpeg",
    sizeBytes: buffer.length,
  });

  return { kept: true, sliceKey };
};

/**
 * Append a batch of uploaded images from a folder selection into the triage session.
 */
export const appendBatchToTriageSession = async ({
  sessionId,
  user,
  files = [],
  relativePaths = [],
  clientIgnoredCount = 0,
}) => {
  const session = triageSessions.get(sessionId);
  assertSessionAccess(session, user);
  touchSession(session);

  if (Number(clientIgnoredCount) > 0) {
    session.clientIgnoredCount += Math.max(0, Number(clientIgnoredCount) || 0);
  }

  let keptInBatch = 0;
  let ignoredInBatch = 0;
  let rejectedInBatch = 0;

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const rel = Array.isArray(relativePaths) && relativePaths[i]
      ? relativePaths[i]
      : (f.originalname || `slice_${i}.jpg`);

    const buf = f.buffer || (f.path ? await fs.promises.readFile(f.path) : null);
    if (!buf) {
      rejectedInBatch += 1;
      continue;
    }

    const res = await addSingleStagingImage(session, {
      relativePath: rel,
      buffer: buf,
      mimeType: f.mimetype,
    });
    if (res.kept) keptInBatch += 1;
    else if (res.reason === "ignored_sequence") ignoredInBatch += 1;
    else rejectedInBatch += 1;
  }

  return {
    sessionId,
    keptInBatch,
    ignoredInBatch,
    rejectedInBatch,
    totalKeptSlices: session.slices.size,
    totalIgnoredSequences: session.clientIgnoredCount + session.serverIgnoredCount,
  };
};

/**
 * Unpack a study `.zip` archive safely into the triage session, skipping localizers & non-images.
 */
export const appendZipToTriageSession = async ({
  sessionId,
  user,
  zipBuffer,
  zipFilePath = null,
}) => {
  const session = triageSessions.get(sessionId);
  assertSessionAccess(session, user);
  touchSession(session);

  const buf = zipBuffer || (zipFilePath ? await fs.promises.readFile(zipFilePath) : null);
  if (!buf || buf.length < 22) {
    throw Object.assign(new Error("Tệp ZIP không hợp lệ hoặc bị rỗng."), { statusCode: 400 });
  }

  const { images, stats } = extractImagesFromZipBuffer(buf, { skipIgnoredFolders: true });
  session.serverIgnoredCount += stats.ignoredCount || 0;
  session.nonImageCount += stats.nonImageCount || 0;

  let added = 0;
  for (const img of images) {
    const res = await addSingleStagingImage(session, {
      relativePath: img.relativePath,
      buffer: img.buffer,
    });
    if (res.kept) added += 1;
  }

  return {
    sessionId,
    extractedEntries: stats.totalEntries,
    addedSlices: added,
    ignoredSequencesInZip: stats.ignoredCount,
    nonImageCount: stats.nonImageCount,
    totalKeptSlices: session.slices.size,
  };
};

/**
 * Run fast YOLOv8 + ResNet50 triage via AI Service on all diagnostic slices in session.
 * Returns ranked candidates with signed temporary preview URLs and pre-selected top_k.
 */
export const runTriageSessionAnalysis = async ({
  sessionId,
  user,
  protocolCode = null,
  withContrast = null,
  topK = 10,
  candidateLimit = 120,
  geminiConflictLimit = 5,
}) => {
  const session = triageSessions.get(sessionId);
  assertSessionAccess(session, user);
  touchSession(session);

  if (session.slices.size === 0) {
    throw Object.assign(
      new Error("Không còn lát cắt hợp lệ nào sau khi lọc chuỗi định vị/tệp không phải ảnh."),
      { statusCode: 400 }
    );
  }

  const effectiveProtocol = protocolCode
    ? String(protocolCode).trim().toUpperCase()
    : session.protocolCode;
  const effectiveContrast = withContrast !== null && withContrast !== undefined
    ? Boolean(withContrast)
    : session.withContrast;

  const entries = [];
  const metaList = [];
  const seenRelPaths = new Set();

  for (const s of session.slices.values()) {
    // Disambiguate rare duplicate relative paths inside merged batches using sliceKey folder prefix
    let zipRel = s.relativePath;
    if (seenRelPaths.has(zipRel)) {
      const dir = path.posix.dirname(zipRel);
      const base = path.posix.basename(zipRel);
      zipRel = dir && dir !== "." ? `${dir}/${s.sliceKey}_${base}` : `${s.sliceKey}_${base}`;
    }
    seenRelPaths.add(zipRel);

    const buffer = await fs.promises.readFile(s.diskPath);
    entries.push({ relativePath: zipRel, buffer });
    metaList.push({ sliceKey: s.sliceKey, relativePath: zipRel });
  }

  const packedZip = buildStoredZipBuffer(entries);
  const form = new FormData();
  form.append("archive", new Blob([packedZip], { type: "application/zip" }), "triage_study.zip");
  form.append("relative_paths", JSON.stringify(metaList));
  if (effectiveProtocol) form.append("protocol_code", effectiveProtocol);
  form.append("with_contrast", String(effectiveContrast));
  form.append("top_k", String(Math.max(1, Math.min(Number(topK) || 10, 15))));
  form.append("candidate_limit", String(Math.max(10, Math.min(Number(candidateLimit) || 120, 300))));
  form.append("gemini_conflict_limit", String(Math.max(0, Math.min(Number(geminiConflictLimit ?? 5), 10))));

  let response;
  try {
    response = await aiFetch(aiServiceUrl("/triage-study"), {
      method: "POST",
      body: form,
      timeoutMs: AI_TRIAGE_TIMEOUT_MS,
    });
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw Object.assign(
      new Error(
        isTimeout
          ? "AI Engine (:8000) xử lý sàng lọc quá thời gian cho phép. Vui lòng thử lại hoặc giảm số lượng ảnh."
          : "AI Engine (:8000) chưa sẵn sàng hoặc đang nạp mô hình TensorFlow/YOLO. Vui lòng đợi 15–30 giây rồi bấm chạy lại."
      ),
      { statusCode: isTimeout ? 504 : 503 }
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw Object.assign(
      new Error(`AI Service triage trả lỗi (${response.status}): ${errText.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }

  const aiReport = await response.json();
  const baseIgnored = session.clientIgnoredCount + session.serverIgnoredCount;
  const summary = {
    ...(aiReport.summary || {}),
    totalUploadedRaw: (aiReport.summary?.totalFiles || 0) + baseIgnored + session.nonImageCount,
    ignoredSequenceCount: baseIgnored + (aiReport.summary?.ignoredSequenceCount || 0),
    nonImageCount: session.nonImageCount + (aiReport.summary?.nonImageCount || 0),
  };

  const candidates = (aiReport.candidates || []).map((cand) => {
    const sliceMeta = session.slices.get(cand.sliceKey);
    const previewPath = `/api/v1/imaging/triage/${sessionId}/preview/${cand.sliceKey}`;
    return {
      ...cand,
      originalRelativePath: sliceMeta?.relativePath || cand.relativePath,
      seriesName: sliceMeta?.seriesName || cand.seriesName,
      previewPath,
      previewUrl: signUploadPath(previewPath),
    };
  });

  const enriched = {
    sessionId,
    protocolCode: aiReport.protocolCode || effectiveProtocol,
    withContrast: effectiveContrast,
    summary,
    studyDiagnosisSummary: aiReport.studyDiagnosisSummary || summary.studyDiagnosisSummary || null,
    seriesSummary: aiReport.seriesSummary || [],
    candidates,
  };

  session.lastTriageResult = enriched;
  return enriched;
};

/**
 * Retrieve disk path and MIME metadata for a preview image inside a triage session.
 */
export const getTriagePreviewFile = async ({ sessionId, sliceKey, user = null, bypassOwnership = false }) => {
  const session = triageSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    throw Object.assign(new Error("Ảnh xem trước không tồn tại hoặc phiên đã hết hạn."), { statusCode: 404 });
  }
  if (!bypassOwnership) {
    assertSessionAccess(session, user);
  }
  const slice = session.slices.get(String(sliceKey || ""));
  if (!slice || !fs.existsSync(slice.diskPath)) {
    throw Object.assign(new Error("Không tìm thấy lát cắt xem trước."), { statusCode: 404 });
  }
  return {
    diskPath: slice.diskPath,
    mimeType: slice.mimeType || "image/jpeg",
    filename: slice.filename,
  };
};

/**
 * Promote ONLY KTV-confirmed slices (~10) from triage staging to encrypted AES-256-GCM PACS storage,
 * then immediately wipe temporary triage files.
 */
export const finalizeTriageSession = async ({
  sessionId,
  user,
  selectedSliceKeys = [],
  primarySliceKey = null,
}) => {
  const session = triageSessions.get(sessionId);
  assertSessionAccess(session, user);

  if (!Array.isArray(selectedSliceKeys) || selectedSliceKeys.length === 0) {
    throw Object.assign(new Error("Vui lòng chọn ít nhất 1 lát cắt MRI để lưu và chuyển bác sĩ."), { statusCode: 400 });
  }

  const dedupKeys = [];
  const seen = new Set();
  for (const rawKey of selectedSliceKeys) {
    const key = String(typeof rawKey === "object" ? rawKey?.sliceKey : rawKey || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedupKeys.push(key);
  }

  if (dedupKeys.length === 0 || dedupKeys.length > MAX_FINALIZE_SLICES) {
    throw Object.assign(
      new Error(`Số lượng lát cắt xác nhận phải từ 1 đến ${MAX_FINALIZE_SLICES} ảnh.`),
      { statusCode: 400 }
    );
  }

  const candidateByKey = new Map(
    (session.lastTriageResult?.candidates || []).map((c) => [String(c.sliceKey), c])
  );

  const promotedFiles = [];
  const sliceSeriesMeta = [];

  for (let i = 0; i < dedupKeys.length; i += 1) {
    const key = dedupKeys[i];
    const slice = session.slices.get(key);
    if (!slice || !fs.existsSync(slice.diskPath)) {
      throw Object.assign(new Error(`Lát cắt "${key}" không còn tồn tại trong phiên tạm.`), { statusCode: 404 });
    }

    const cand = candidateByKey.get(key);
    const stored = await putFileFromPath({
      category: "pacs",
      studyId: session.visitId || sessionId,
      sequenceName: slice.seriesName || "Uploaded_Study",
      fileName: slice.filename,
      sourceFilePath: slice.diskPath,
      moveFile: false,
      mimeType: slice.mimeType,
      patientId: session.patientId || null,
      uploadedBy: user?.id || null,
      hospitalId: user?.hospitalId || null,
      syncToDrive: true,
    });

    const imageUrl = `/api/v1/storage/files/${stored.fileId}`;
    const signedUrl = signUploadPath(imageUrl);
    const hasYoloTumor = Boolean(
      cand?.yoloDetected && cand?.yoloClass && String(cand.yoloClass).toLowerCase() !== "notumor"
    );
    const candPred = cand?.predictedClass ? String(cand.predictedClass).toLowerCase() : null;
    const effectiveClass =
      candPred && candPred !== "notumor"
        ? candPred
        : hasYoloTumor
        ? String(cand.yoloClass).toLowerCase()
        : (candPred || "notumor");
    const effectiveConf =
      candPred && candPred !== "notumor" && Number.isFinite(Number(cand?.confidence))
        ? Number(cand.confidence)
        : hasYoloTumor && Number(cand?.yoloConf) > 0
        ? Math.round(Number(cand.yoloConf) * 1000) / 10
        : (Number.isFinite(Number(cand?.confidence)) ? Number(cand.confidence) : 0);

    promotedFiles.push({
      sliceIndex: i,
      sliceKey: key,
      fileId: stored.fileId,
      imageUrl,
      signedUrl,
      filename: slice.filename,
      seriesName: cand?.seriesName || slice.seriesName || "Uploaded_Study",
      sequenceType: cand?.sequenceType || "OTHER",
      plane: cand?.plane || "unknown",
      sliceNumber: cand?.sliceNumber ?? null,
      lesionClarityScore: cand?.lesionClarityScore ?? null,
      predictedClass: effectiveClass,
      confidence: effectiveConf,
      probabilities: cand?.probabilities || null,
      consensusMessage: cand?.consensusMessage || null,
      aiTier: cand?.aiTier || "ensemble+yolo",
      yoloDetected: hasYoloTumor,
      yoloClass: hasYoloTumor ? String(cand.yoloClass).toLowerCase() : null,
      yoloConf: hasYoloTumor ? Number(cand.yoloConf) : 0,
      boundingBox: hasYoloTumor ? (cand?.boundingBox || null) : null,
      isPrimary: primarySliceKey ? key === String(primarySliceKey) : i === 0,
    });

    sliceSeriesMeta.push({
      sliceIndex: i,
      imageUrl,
      signedUrl,
      seriesName: cand?.seriesName || slice.seriesName || "Uploaded_Study",
      sequenceType: cand?.sequenceType || "OTHER",
      plane: cand?.plane || "unknown",
      sliceNumber: cand?.sliceNumber ?? null,
      clarityScore: cand?.lesionClarityScore ?? null,
      predictedClass: effectiveClass,
      confidence: effectiveConf,
      probabilities: cand?.probabilities || null,
      consensusMessage: cand?.consensusMessage || null,
      aiTier: cand?.aiTier || "ensemble+yolo",
      yoloDetected: hasYoloTumor,
      yoloClass: hasYoloTumor ? String(cand.yoloClass).toLowerCase() : null,
      yoloConf: hasYoloTumor ? Number(cand.yoloConf) : 0,
      boundingBox: hasYoloTumor ? (cand?.boundingBox || null) : null,
    });
  }

  let resolvedPrimaryIdx = promotedFiles.findIndex((f) => f.isPrimary);
  if (resolvedPrimaryIdx < 0) resolvedPrimaryIdx = 0;

  // Tổng hợp AI chi tiết cho KTV xem ngay từng lát + loại u + vùng khoanh + thống kê toàn thư mục
  const studyDiag =
    session.lastTriageResult?.studyDiagnosisSummary ||
    session.lastTriageResult?.summary?.studyDiagnosisSummary ||
    null;
  const sliceResults = sliceSeriesMeta.map((m) => ({
    sliceIndex: m.sliceIndex,
    imageUrl: m.imageUrl,
    seriesName: m.seriesName,
    sequenceType: m.sequenceType,
    plane: m.plane,
    sliceNumber: m.sliceNumber,
    class_name: m.predictedClass || "notumor",
    confidence: m.confidence || 0,
    probabilities: m.probabilities || null,
    consensus_message: m.consensusMessage || null,
    aiTier: m.aiTier || "ensemble+yolo",
    bounding_box: m.boundingBox || null,
    clarityScore: m.clarityScore ?? null,
    yoloDetected: Boolean(m.yoloDetected),
  }));
  const tumorSlices = sliceResults.filter((s) => s.class_name && s.class_name !== "notumor");
  const folderDomCls =
    studyDiag?.dominantClass && studyDiag.dominantClass !== "notumor" ? studyDiag.dominantClass : null;
  const dominantMatchingSlices = folderDomCls
    ? tumorSlices.filter((s) => s.class_name === folderDomCls)
    : [];
  const primarySlice = sliceResults[resolvedPrimaryIdx] || tumorSlices[0] || sliceResults[0] || null;
  const bestTumorSlice = (dominantMatchingSlices.length > 0 ? dominantMatchingSlices : tumorSlices).reduce(
    (best, cur) => (!best || (cur.confidence || 0) > (best.confidence || 0) ? cur : best),
    null
  );
  const dominantSlice =
    (primarySlice && (!folderDomCls || primarySlice.class_name === folderDomCls) && primarySlice.class_name !== "notumor"
      ? primarySlice
      : null) ||
    bestTumorSlice ||
    primarySlice;

  const triageAiPreview = sliceResults.length > 0
    ? {
        fromTriage: true,
        model_info: "Full Study AI (3-CNN Ensemble + BayTTA + YOLOv8 + Bounded Gemini VLM)",
        class_name: folderDomCls || dominantSlice?.class_name || "notumor",
        confidence: dominantSlice?.confidence ?? studyDiag?.dominantAvgConfidence ?? 0,
        probabilities: dominantSlice?.probabilities || null,
        bounding_box: dominantSlice?.bounding_box || null,
        consensus_message: dominantSlice?.consensus_message || null,
        representativeSliceUrl:
          dominantSlice?.imageUrl || promotedFiles[resolvedPrimaryIdx]?.imageUrl || promotedFiles[0]?.imageUrl || null,
        tumorSliceCount: tumorSlices.length,
        totalSlices: sliceResults.length,
        studyDiagnosisSummary: studyDiag,
        totalAnalyzedInFolder: studyDiag?.totalAnalyzed || null,
        sliceResults,
      }
    : null;

  // Clean up ephemeral staging folder & session immediately after PACS promotion
  const dirToClean = session.stagingDir;
  triageSessions.delete(sessionId);
  await removeDirSafe(dirToClean);

  return {
    sessionId,
    promotedCount: promotedFiles.length,
    primarySliceIndex: resolvedPrimaryIdx,
    images: promotedFiles.map((f) => f.signedUrl),
    rawImageUrls: promotedFiles.map((f) => f.imageUrl),
    files: promotedFiles,
    sliceSeriesMeta,
    triageAiPreview,
  };
};

/**
 * Cancel an active triage session and wipe all staging files.
 */
export const cancelTriageSession = async ({ sessionId, user }) => {
  const session = triageSessions.get(sessionId);
  if (!session) return { cleared: false };
  assertSessionAccess(session, user);
  triageSessions.delete(sessionId);
  await removeDirSafe(session.stagingDir);
  return { cleared: true };
};
