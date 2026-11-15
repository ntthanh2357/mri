import { buildMultiSliceAiReport } from "./multiSliceAi.util.js";

/**
 * Execute Option A full-consensus AI prediction across all KTV-selected MRI slices (~1-15 slices)
 * with bounded concurrency (default 2) so CPU/GPU memory remains stable.
 */
export const analyzeMultipleSlicesInternal = async ({
  imageUrls = [],
  user,
  visitId = null,
  sliceSeriesMeta = [],
  primarySliceIndex = null,
  source = "ktv_batch",
  concurrency = 2,
  executeSingleFn,
}) => {
  if (typeof executeSingleFn !== "function") {
    throw new Error("executeSingleFn is required for multi-slice AI analysis.");
  }

  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 15) : [];
  if (urls.length === 0) return null;

  const metaList = Array.isArray(sliceSeriesMeta) ? sliceSeriesMeta : [];
  const metaByUrl = new Map();
  for (const m of metaList) {
    if (m && typeof m === "object" && m.imageUrl) {
      metaByUrl.set(String(m.imageUrl).split(/[?#]/)[0], m);
    }
  }

  const outcomes = new Array(urls.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, urls.length));

  const runWorker = async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= urls.length) break;

      const imageUrl = urls[idx];
      const basePath = String(imageUrl).split(/[?#]/)[0];
      const meta = metaByUrl.get(basePath) || (metaList[idx] && typeof metaList[idx] === "object" ? metaList[idx] : {});
      const seriesHint = meta.seriesName || null;

      try {
        const aiData = await executeSingleFn(imageUrl, user, visitId, {
          seriesName: seriesHint,
          skipVisitTransition: true,
        });
        outcomes[idx] = {
          sliceIndex: idx,
          imageUrl: basePath,
          seriesName: meta.seriesName || "Uploaded_Study",
          sequenceType: meta.sequenceType || "OTHER",
          plane: meta.plane || "unknown",
          sliceNumber: meta.sliceNumber ?? null,
          clarityScore: meta.clarityScore ?? null,
          aiData,
          dims: aiData?.image_dimensions || null,
          error: null,
        };
      } catch (err) {
        console.warn(`⚠️ [MultiSlice AI] Lát cắt #${idx + 1} (${basePath}) phân tích lỗi: ${err.message}`);
        outcomes[idx] = {
          sliceIndex: idx,
          imageUrl: basePath,
          seriesName: meta.seriesName || "Uploaded_Study",
          sequenceType: meta.sequenceType || "OTHER",
          plane: meta.plane || "unknown",
          sliceNumber: meta.sliceNumber ?? null,
          clarityScore: meta.clarityScore ?? null,
          aiData: null,
          dims: null,
          error: err.message || "Lỗi phân tích AI trên lát cắt này.",
        };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  const multiReport = buildMultiSliceAiReport(outcomes, {
    source,
    analyzedBy: user?.id || null,
    primarySliceIndex: Number.isInteger(Number(primarySliceIndex)) ? Number(primarySliceIndex) : null,
  });

  return multiReport;
};

