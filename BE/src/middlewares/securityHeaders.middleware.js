/**
 * NeuroScan AI - OWASP Security Headers Middleware
 * Protects application against Clickjacking, MIME-Sniffing, XSS, and Information Disclosure.
 */

export const securityHeaders = (req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent Clickjacking by restricting framing to same origin
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Enable browser XSS filtering
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Control referrer information sent in HTTP headers
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content-Security-Policy (CSP) - Bảo vệ chống chèn script lạ & XSS
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:; object-src 'none'; frame-ancestors 'self';"
  );

  // Cross-Origin Isolation Policies
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  // Enforce HTTPS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === "production" || req.secure || req.headers?.["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Restrict feature/permissions policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Hide server technology details
  res.removeHeader("X-Powered-By");

  next();
};
