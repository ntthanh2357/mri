// Mọi lời gọi tới AI service đều phải kèm khóa nội bộ: AI service từ chối request không có khóa.
// AI treo không được giữ worker vô hạn: mặc định 60 giây, chỉnh bằng AI_FETCH_TIMEOUT_MS
export const AI_FETCH_TIMEOUT_MS = Number(process.env.AI_FETCH_TIMEOUT_MS) || 60000;

export const aiFetch = (url, options = {}) => {
  const key = process.env.INTERNAL_AI_API_KEY;
  const { timeoutMs = AI_FETCH_TIMEOUT_MS, ...rest } = options;
  return fetch(url, {
    ...rest,
    signal: rest.signal || AbortSignal.timeout(timeoutMs),
    headers: { ...(rest.headers || {}), ...(key ? { "X-Internal-Api-Key": key } : {}) },
  });
};
