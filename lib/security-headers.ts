/**
 * Headers every response from the Worker carries. This file has no imports so the Worker wrapper
 * (scripts/cf-build.mjs) and the tests can use it as it is.
 */

/** Browsers post here when the report only policy would have blocked something. */
export const CSP_REPORT_PATH = "/api/csp-report";

/** Directives that are safe to enforce today. They stop framing, base tag tricks, form posts to other sites and plugins. */
const ENFORCED_CSP = ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");

/**
 * The full policy. It is only reported for now. Next.js writes small inline scripts and styles, so 'unsafe-inline' stays
 * until nonces are in place. Even so, nothing can load a script from, or send data to, another site.
 * Move it to the enforcing header once the log from /api/csp-report has stayed quiet through a normal week of use.
 */
const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `report-uri ${CSP_REPORT_PATH}`,
].join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // Browsers keep to HTTPS for a year after the first visit. includeSubDomains is left out on purpose: the same domain may host other things later.
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  // The app uses none of these browser features.
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "content-security-policy": ENFORCED_CSP,
  "content-security-policy-report-only": REPORT_ONLY_CSP,
};

/** Copies the response and adds every security header it does not already carry. Bodies stream through untouched. */
export function withSecurityHeaders(res: Response): Response {
  if (res.status === 101 || (res as unknown as { webSocket?: unknown }).webSocket) return res;
  const headers = new Headers(res.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (!headers.has(name)) headers.set(name, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// ---- violation reports

const pathOf = (u: unknown) => { try { return new URL(String(u)).pathname.slice(0, 120); } catch { return ""; } };
const sourceOf = (u: unknown) => {
  const s = String(u ?? "");
  if (!s) return "none";
  if (/^(inline|eval|data|blob|about|self)$/i.test(s)) return s.toLowerCase();
  try { return new URL(s).origin.slice(0, 120); } catch { return s.slice(0, 20); }
};

/**
 * One short log line for a CSP violation report, or null when the body is not one. Only the page path, the directive
 * and the origin that was blocked are kept. Query strings and anything else a page URL may carry are dropped.
 */
export function describeReport(body: unknown): string | null {
  const list = Array.isArray(body) ? body : [body];
  const first = list.find((x) => x && typeof x === "object") as Record<string, any> | undefined;
  if (!first) return null;
  const r = (first["csp-report"] ?? first.body ?? first) as Record<string, any>;
  const directive = String(r["effective-directive"] ?? r["violated-directive"] ?? r.effectiveDirective ?? r.violatedDirective ?? "").slice(0, 60);
  if (!directive) return null;
  return `csp-report directive=${directive} blocked=${sourceOf(r["blocked-uri"] ?? r.blockedURL ?? r.blockedURI)} page=${pathOf(r["document-uri"] ?? r.documentURL ?? r.documentURI) || "unknown"}`;
}
