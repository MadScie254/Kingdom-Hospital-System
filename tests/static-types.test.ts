import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { test } from "node:test";
import { types } from "../scripts/mime-types.mjs";

// The Worker serves every file in public/ itself (scripts/cf-build.mjs embeds them), so it must know each file's type.
// A missing entry was sent as application/octet-stream, which link preview crawlers refuse as an image.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("every file type in public/ has a content type", () => {
  const missing = new Set<string>();
  for (const file of walk(join(process.cwd(), "public"))) if (!types[extname(file)]) missing.add(extname(file) || file);
  assert.deepEqual([...missing], [], "add these extensions to scripts/mime-types.mjs");
});

test("images and fonts are sent with the types browsers and link previews expect", () => {
  assert.equal(types[".webp"], "image/webp");
  assert.equal(types[".jpg"], "image/jpeg");
  assert.equal(types[".jpeg"], "image/jpeg");
  assert.equal(types[".png"], "image/png");
  assert.equal(types[".svg"], "image/svg+xml");
  assert.equal(types[".woff2"], "font/woff2");
});
