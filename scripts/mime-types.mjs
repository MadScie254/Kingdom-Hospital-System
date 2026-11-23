/* The content type the Worker sends for each kind of static file (see cf-build.mjs). A type that is missing here is sent as
   application/octet-stream, which link preview crawlers and some browsers refuse as an image. tests/static-types.test.ts checks every file in public/. */
export const types = {
  ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json", ".html": "text/html; charset=utf-8", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
};
