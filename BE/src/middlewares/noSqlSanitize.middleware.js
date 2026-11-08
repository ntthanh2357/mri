/**
 * NeuroScan AI - NoSQL Injection Sanitization Middleware
 * Recursively cleans req.body, req.query, and req.params by removing any keys
 * that start with '$' or contain '.' which are reserved MongoDB query operators.
 */

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block any key starting with '$' (e.g. $ne, $gt, $where) or containing '.' (dot-notation injection)
    if (key.startsWith("$") || key.includes(".")) {
      console.warn(`[SECURITY ALERT] NoSQL Injection attempt detected and neutralized: blocked key "${key}"`);
      continue; // Strip key completely
    }

    if (value && typeof value === "object") {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
};

export const sanitizeNoSql = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
    // `?status[$ne]=x` sau khi lọc còn `status: {}` → Mongoose CastError (500). Bỏ hẳn tham số rỗng đó.
    for (const [key, value] of Object.entries(req.query)) {
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
        delete req.query[key];
      }
    }
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  next();
};
