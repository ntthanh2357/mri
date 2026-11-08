// Mọi lời gọi tới AI service đều phải kèm khóa nội bộ: AI service từ chối request không có khóa.
export const aiFetch = (url, options = {}) => {
  const key = process.env.INTERNAL_AI_API_KEY;
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(key ? { "X-Internal-Api-Key": key } : {}) },
  });
};
