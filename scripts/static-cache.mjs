/* How long browsers may keep each kind of static file the Worker serves (see cf-build.mjs).
   Every file is a request on the free plan and patients are often on slow phones, so what never changes is kept longer.
   The logo, the service worker and the share image stay short, so a replaced file shows soon. tests/static-cache.test.ts pins these. */
export function cacheControl(pathname) {
  if (pathname.startsWith("/_next/static/")) return "public, max-age=31536000, immutable"; // the name holds a hash of the content
  if (pathname.startsWith("/fonts/") || pathname.startsWith("/images/")) return "public, max-age=86400";
  return "public, max-age=3600";
}
