import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { FALLBACK_ORIGIN, SITE, jsonLd, siteOrigin } from "../lib/site";
import { META } from "../lib/site-content";
import { jsonLdString, pageMetadata } from "../lib/site-seo";

const ORIGIN = "https://h.example";

test("the site address comes from APP_ORIGIN without a trailing slash, and falls back to the hosted address", () => {
  assert.equal(siteOrigin({ APP_ORIGIN: "https://hospital.example/" }), "https://hospital.example");
  assert.equal(siteOrigin({ APP_ORIGIN: "https://hospital.example" }), "https://hospital.example");
  assert.equal(siteOrigin({}), FALLBACK_ORIGIN);
  assert.equal(siteOrigin({ APP_ORIGIN: "" }), FALLBACK_ORIGIN);
});

test("the fallback address is the one the Worker is configured with, so the search tags cannot drift from it", () => {
  const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  const configured = wrangler.match(/"APP_ORIGIN"\s*:\s*"([^"]+)"/)?.[1];
  assert.ok(configured, "wrangler.jsonc sets APP_ORIGIN");
  assert.equal(FALLBACK_ORIGIN, configured.replace(/\/$/, ""), "change FALLBACK_ORIGIN in lib/site.ts when you change APP_ORIGIN in wrangler.jsonc");
});

test("robots lets search engines read the homepage and keeps them out of the portal and the API", () => {
  process.env.APP_ORIGIN = ORIGIN;
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const all = rules.find((rule) => rule.userAgent === "*");
  assert.ok(all, "a rule for every crawler");
  assert.deepEqual([all.allow].flat(), ["/"]);
  for (const path of ["/api/", "/dashboard", "/settings"]) assert.ok([all.disallow].flat().includes(path), `${path} is disallowed`);
  assert.equal(r.sitemap, `${ORIGIN}/sitemap.xml`);
});

test("the sitemap lists the homepage and nothing else", () => {
  process.env.APP_ORIGIN = ORIGIN;
  const entries = sitemap();
  assert.deepEqual(entries.map((e) => e.url), [`${ORIGIN}/`]);
});

test("the page title and description fit a search result", () => {
  const m = pageMetadata(ORIGIN);
  const title = (m.title as { absolute: string }).absolute;
  assert.equal(title, META.title);
  assert.ok(title.length <= 60, `title is ${title.length} characters`);
  const d = String(m.description).length;
  assert.ok(d >= 140 && d <= 160, `description is ${d} characters`);
});

test("the homepage may be indexed, names its own address and carries a share card", () => {
  const m = pageMetadata(ORIGIN);
  assert.deepEqual(m.robots, { index: true, follow: true }, "overrides the portal's noindex");
  assert.equal(String(m.metadataBase), `${ORIGIN}/`);
  assert.equal(m.alternates?.canonical, "/");
  const og = m.openGraph as { type: string; siteName: string; images: Array<{ url: string; width: number; height: number; alt: string }> };
  assert.equal(og.type, "website");
  assert.equal(og.siteName, SITE.name);
  assert.deepEqual(og.images.map((i) => [i.url, i.width, i.height]), [["/og.jpg", 1200, 630]]);
  assert.ok(og.images[0].alt.length >= 20);
  const tw = m.twitter as { card: string; images: string[] };
  assert.equal(tw.card, "summary_large_image");
  assert.deepEqual(tw.images, ["/og.jpg"]);
  assert.deepEqual(m.formatDetection, { telephone: false, email: false, address: false }, "the phone number is already a real link");
});

test("the structured data is the hospital's JSON-LD and is safe to put inside a script tag", () => {
  const s = jsonLdString(ORIGIN);
  assert.deepEqual(JSON.parse(s), JSON.parse(JSON.stringify(jsonLd(ORIGIN))));
  assert.ok(!s.includes("<"), "a < could close the script tag early");
  assert.equal(JSON.parse(s).url, ORIGIN);
});
