/* Run after `opennextjs-cloudflare build`. Embeds the static files into the worker bundle so it deploys
   without the separate assets upload, then writes the entry file that serves them. */
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = ".open-next";
const assets = join(root, "assets");
const out = join(root, "embedded");
const types = {
  ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json", ".html": "text/html; charset=utf-8", ".webmanifest": "application/manifest+json",
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(assets);

let imports = "", map = "";
files.forEach((f, i) => {
  const url = "/" + relative(assets, f).split("\\").join("/");
  copyFileSync(f, join(out, String(i)));
  imports += `import d${i} from "./embedded/${i}";\n`;
  map += `  ${JSON.stringify(url)}: [d${i}, ${JSON.stringify(types[extname(f)] || "application/octet-stream")}, ${url.startsWith("/_next/static/")}],\n`;
});
writeFileSync(join(root, "embedded-assets.mjs"), `${imports}export const ASSETS = {\n${map}};\n`);
writeFileSync(join(root, "embedded-worker.mjs"), `import worker from "./worker.js";
import { ASSETS } from "./embedded-assets.mjs";
export * from "./worker.js";
export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET" || request.method === "HEAD") {
      const hit = ASSETS[new URL(request.url).pathname];
      if (hit) {
        return new Response(request.method === "HEAD" ? null : hit[0], {
          headers: { "content-type": hit[1], "cache-control": hit[2] ? "public, max-age=31536000, immutable" : "public, max-age=3600" },
        });
      }
    }
    return worker.fetch(request, env, ctx);
  },
  // Nightly at 21:00 UTC, which is midnight in Nairobi. Calls the backup route with the cron secret and
  // leaves a note in KV (cron/last-run, cron/last-result, cron/last-error) so a silent failure can be found.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await env.BACKUPS.put("cron/last-run", new Date().toISOString());
        const res = await worker.fetch(new Request("https://kingdom-hospital.internal/api/backup", { method: "POST", headers: { "content-type": "application/json", "x-cron-secret": env.CRON_SECRET || "" }, body: "{}" }), env, ctx);
        await env.BACKUPS.put("cron/last-result", res.status + " " + (await res.text()).slice(0, 500));
      } catch (e) {
        await env.BACKUPS.put("cron/last-error", String((e && e.stack) || e).slice(0, 1500));
      }
    })());
  },
};
`);
console.log(`Embedded ${files.length} static files.`);
