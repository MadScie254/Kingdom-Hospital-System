import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheControl } from "../scripts/static-cache.mjs";

// Every file the Worker serves counts as a request on the free plan, and patients are often on slow phones, so what never changes is kept longer.
test("files with a hash in their name are kept for a year", () => {
  assert.equal(cacheControl("/_next/static/chunks/0c1ad7rcpjghx.js"), "public, max-age=31536000, immutable");
  assert.equal(cacheControl("/_next/static/media/font.15jby9eboz7vb.woff2"), "public, max-age=31536000, immutable");
});

test("the font and the homepage photos are kept for a day, so a repeat visit does not fetch them again", () => {
  assert.equal(cacheControl("/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2"), "public, max-age=86400");
  assert.equal(cacheControl("/images/home/building.webp"), "public, max-age=86400");
});

test("the logo, the service worker and everything else stay at an hour, so a replaced file shows soon", () => {
  for (const path of ["/logo.svg", "/logo.png", "/sw.js", "/og.jpg", "/icons/icon-192.png", "/manifest.webmanifest"]) {
    assert.equal(cacheControl(path), "public, max-age=3600", path);
  }
});
