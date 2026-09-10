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

  // Enforce HTTPS (HTTP Strict Transport Security) in production
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Restrict feature/permissions policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Hide server technology details
  res.removeHeader("X-Powered-By");

  next();
};
