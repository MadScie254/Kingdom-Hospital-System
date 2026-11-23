import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomePage } from "../components/site/home-page";
import { FALLS_CREDIT, NAV, SITE } from "../lib/site";
import { SERVICE_GROUPS } from "../lib/site-content";

// The page as the server sends it: what a visitor sees before any script runs, and what a search engine reads.
const html = renderToStaticMarkup(createElement(HomePage));
const plain = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const text = plain(html);

test("there is one h1 and it says which hospital this is", () => {
  const h1s = html.match(/<h1[\s\S]*?<\/h1>/g) ?? [];
  assert.equal(h1s.length, 1);
  const h1 = plain(h1s[0]);
  assert.ok(h1.startsWith("Eye care"), h1);
  assert.ok(h1.includes("Kingdom Faith Based Hospital"), h1);
});

test("every menu link has a section to land on, and the sections follow the menu order", () => {
  const places = NAV.map((n) => {
    const at = html.search(new RegExp(`<section[^>]*id="${n.id}"`));
    assert.ok(at >= 0, `no <section id="${n.id}">`);
    return at;
  });
  assert.deepEqual([...places].sort((a, b) => a - b), places);
});

test("headings never skip a level", () => {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i]} follows h${levels[i - 1]} (heading ${i + 1})`);
});

test("the seven service groups are native details elements, closed at first, each with a summary", () => {
  const groups = html.match(/<details[^>]*class="svc"[^>]*>/g) ?? [];
  assert.equal(groups.length, 7);
  for (const tag of groups) assert.ok(!/\sopen(=|\s|>)/.test(tag), `starts closed: ${tag}`);
  for (const g of SERVICE_GROUPS) assert.ok(html.includes(`id="service-${g.id}"`), g.id);
  assert.equal((html.match(/<summary[^>]*class="svc-head"/g) ?? []).length, 7);
});

test("every image has a description, a size and a file that exists, and only the lens loads first", () => {
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  assert.ok(imgs.length >= 7, `${imgs.length} images`);
  for (const tag of imgs) {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    assert.ok(src, tag);
    assert.match(tag, /alt="[^"]{3,}"/, `alt text on ${src}`);
    assert.match(tag, /width="\d+"/, `width on ${src}`);
    assert.match(tag, /height="\d+"/, `height on ${src}`);
    assert.ok(existsSync(join(process.cwd(), "public", src)), `${src} is missing from public/`);
    const first = src === "/logo.svg" || tag.includes("lens-photo");
    assert.equal(tag.includes('loading="lazy"'), !first, `${src} lazy loading`);
  }
  const lens = imgs.find((t) => t.includes("lens-photo")) ?? "";
  assert.match(lens, /fetchpriority="high"/i, "the lens photo is fetched first (HTML attribute names are not case sensitive)");
});

test("every link inside the page lands on something, and nothing is empty", () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]*)"/g)) assert.ok(m[1] && ids.has(m[1]), `#${m[1]} has no target`);
  assert.ok(!html.includes('href=""'));
  assert.ok(!/<a [^>]*>\s*<\/a>/.test(html), "an empty link");
  for (const m of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    assert.ok(/aria-label="[^"]+"/.test(m[1]) || plain(m[2]).length > 0, `a button with no name: ${m[0].slice(0, 80)}`);
  }
});

test("links to other sites open safely in a new tab", () => {
  const external = html.match(/<a [^>]*href="https?:\/\/[^"]+"[^>]*>/g) ?? [];
  assert.ok(external.length >= 4, "directions, Facebook, license and photo source");
  for (const tag of external) {
    assert.match(tag, /target="_blank"/, tag);
    assert.match(tag, /rel="noopener noreferrer"/, tag);
  }
});

test("a visitor can reach the hospital: call, email, address, hours and directions", () => {
  assert.ok(html.includes(`href="tel:${SITE.phoneTel}"`));
  assert.ok(html.includes(`href="mailto:${SITE.email}"`));
  assert.ok(html.includes(`href="${SITE.mapsUrl.replace(/&/g, "&amp;")}"`), "directions link");
  assert.ok(html.includes(`href="${SITE.facebook}"`), "Facebook link");
  assert.ok(text.includes(SITE.address.line), "address");
  assert.ok(text.includes(SITE.address.locality) && text.includes(SITE.address.region));
  assert.ok(text.includes(SITE.hours));
  assert.ok(text.includes(SITE.phoneDisplay));
  assert.ok(!/postal|P\.?O\.? ?Box/i.test(text), "no postal address");
});

test("the Webuye Falls photo is credited with its author, license, links and the change", () => {
  assert.ok(text.includes(FALLS_CREDIT.author));
  assert.ok(text.includes(FALLS_CREDIT.license));
  assert.ok(text.includes("Wikimedia Commons"));
  assert.ok(text.includes(FALLS_CREDIT.change));
  assert.ok(html.includes(`href="${FALLS_CREDIT.licenseUrl}"`));
  assert.ok(html.includes(`href="${FALLS_CREDIT.sourceUrl}"`));
});

test("both sign in doors are on the page, and so is a way for new staff to ask for access", () => {
  assert.ok((html.match(/href="\/login\?as=staff"/g) ?? []).length >= 2, "staff door in the header and at the foot");
  assert.ok((html.match(/href="\/login\?as=admin"/g) ?? []).length >= 2, "administrator door in the header and at the foot");
  assert.ok(html.includes('href="/signup"'));
});

test("the 24 hour marker is drawn, and the acuity labels are hidden from screen readers", () => {
  assert.ok((html.match(/class="mark-24"/g) ?? []).length >= 2, "marker in the chart and in the visit hours");
  const labels = html.match(/<span class="chart-acuity"[^>]*>/g) ?? [];
  assert.equal(labels.length, 7);
  for (const tag of labels) assert.ok(tag.includes('aria-hidden="true"'), tag);
});

test("the visible text has no dashes, no emojis and no phone number but the hospital's", () => {
  assert.ok(!text.includes("—") && !text.includes("–"), "em or en dash");
  assert.ok(!text.includes(" - "), "spaced hyphen");
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text), "emoji");
  // Phone shaped only: the acuity labels sit next to numbers, so a loose digits pattern would swallow them.
  for (const m of text.match(/\b0\d{3} ?\d{3} ?\d{3}\b|\+254 ?\d{9}/g) ?? []) assert.equal(m, SITE.phoneDisplay);
});

test("nothing is hidden or marked as revealed in the server HTML", () => {
  assert.ok(!/\sis-in[\s"]/.test(html), "is-in is added by the browser only");
  assert.ok(!/\shidden(=|\s|>)/.test(html), "no hidden attribute");
  assert.ok(!/display:\s*none|opacity:\s*0\b/.test(html), "no inline hiding");
});

test("the main landmark can take focus from the skip link, which is the first link", () => {
  assert.match(html, /<main[^>]*id="main"[^>]*tabindex="-1"|<main[^>]*tabindex="-1"[^>]*id="main"/);
  const firstLink = html.match(/<a [^>]*href="([^"]+)"/)?.[1];
  assert.equal(firstLink, "#main");
});

test("the cataract slider is on the page, over the photo of the building", () => {
  assert.equal((html.match(/type="range"/g) ?? []).length, 1);
  assert.ok(/class="site-slider-photo"[^>]*src="\/images\/home\/building\.webp"|src="\/images\/home\/building\.webp"[^>]*class="site-slider-photo"/.test(html));
});

test("the hospital's number in running text never breaks across two lines", () => {
  const kept = html.match(/<span class="nowrap">0742 007 277<\/span>/g) ?? [];
  assert.ok(kept.length >= 3, `only ${kept.length} protected numbers: the open 24 hours fact, the eye emergency line and the visit emergency note`);
});
