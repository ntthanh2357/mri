// Mọi lời gọi tới AI service đều phải kèm khóa nội bộ: AI service từ chối request không có khóa.
// AI treo không được giữ worker vô hạn: mặc định 60 giây, chỉnh bằng AI_FETCH_TIMEOUT_MS
export const AI_FETCH_TIMEOUT_MS = Number(process.env.AI_FETCH_TIMEOUT_MS) || 60000;

/**
 * URL tới một endpoint của AI service. AI_SERVER_URL có thể là gốc ("http://ai:8000") hoặc kèm "/predict"
 * (docker-compose). Trước đây vài chỗ ghép bằng .replace("/predict", "/feedback"): với dạng gốc thì gọi nhầm vào "/".
 */
export const aiServiceUrl = (pathname) => {
  const base = String(process.env.AI_SERVER_URL || "http://localhost:8000").trim().replace(/\/+$/, "").replace(/\/predict$/, "");
  return `${base}/${String(pathname || "").replace(/^\/+/, "")}`;
};

export const aiFetch = (url, options = {}) => {
  const key = process.env.INTERNAL_AI_API_KEY;
  const { timeoutMs = AI_FETCH_TIMEOUT_MS, ...rest } = options;
  return fetch(url, {
    ...rest,
    signal: rest.signal || AbortSignal.timeout(timeoutMs),
    headers: { ...(rest.headers || {}), ...(key ? { "X-Internal-Api-Key": key } : {}) },
  });
};
