import assert from "node:assert/strict";
import { test } from "node:test";
import * as content from "../lib/site-content";
import { SITE } from "../lib/site";

/** Every string the public page can show, with the path it came from so a failure says where to look. */
function strings(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

const all = strings({ ...content }, "content");

const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;

test("the copy module exports a real amount of text", () => {
  assert.ok(all.length >= 60, `only ${all.length} strings`);
});

test("no string has a dash, an emoji, a double space or stray spaces at its ends", () => {
  for (const [path, s] of all) {
    assert.ok(!s.includes("—"), `em dash in ${path}`);
    assert.ok(!s.includes("–"), `en dash in ${path}`);
    assert.ok(!s.includes(" - "), `spaced hyphen in ${path}`);
    assert.ok(!EMOJI.test(s), `emoji in ${path}`);
    assert.ok(!s.includes("  "), `double space in ${path}`);
    assert.equal(s, s.trim(), `spaces around ${path}`);
    assert.ok(s.length > 0, `empty string at ${path}`);
  }
});

test("nothing claims what cannot be checked: no NHIF, guarantees, superlatives, percentages or postal codes", () => {
  const banned: Array<[RegExp, string]> = [
    [/NHIF/i, "NHIF"],
    [/guarantee/i, "guarantee"],
    [/\bbest\b/i, "best"],
    [/\bmiracle\b/i, "miracle"],
    [/\bleading\b/i, "leading"],
    [/\d\s?%/, "a percentage"],
    [/\b\d{5}\b/, "a five digit number that could be a postal code"],
  ];
  for (const [path, s] of all) {
    for (const [pattern, name] of banned) assert.ok(!pattern.test(s), `${name} in ${path}: ${s}`);
  }
});

test("any phone number or email in the copy is the one in the site facts", () => {
  for (const [path, s] of all) {
    for (const m of s.match(/\+?\d[\d ]{8,}\d/g) ?? []) {
      assert.ok(([SITE.phoneDisplay, SITE.phoneTel] as string[]).includes(m), `unexpected number ${m} in ${path}`);
    }
    for (const m of s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) {
      assert.equal(m, SITE.email, `unexpected email ${m} in ${path}`);
    }
  }
});

test("there are exactly seven service groups with the planned ids, each explained", () => {
  const groups = content.SERVICE_GROUPS;
  assert.deepEqual(groups.map((g) => g.id), ["eye", "theatre", "dental", "hospital", "mother-child", "testing", "lab-pharmacy"]);
  for (const g of groups) {
    assert.ok(g.title.length > 0, `${g.id} title`);
    assert.ok(g.summary.length > 0, `${g.id} summary`);
    assert.ok(g.items.length >= 2, `${g.id} needs at least two items`);
    assert.ok(g.detail.length >= 80, `${g.id} detail is ${g.detail.length} characters`);
    assert.equal(new Set(g.items).size, g.items.length, `${g.id} repeats an item`);
  }
});

test("the cataract guide has what it is, the signs, the steps in order and a note", () => {
  const c = content.CATARACT;
  assert.ok(c.what.length >= 120);
  assert.ok(c.signs.length >= 4 && c.signs.length <= 7);
  assert.ok(c.steps.length >= 4 && c.steps.length <= 6);
  assert.ok(c.note.length >= 40);
  assert.ok(content.EYE_URGENT.includes(SITE.phoneDisplay), "the urgent line gives the number");
});

test("the story, the insurance text and the visit text are all there", () => {
  assert.ok(content.ABOUT.length >= 3);
  assert.ok(content.SHA_COPY.length >= 2);
  assert.ok(content.SHA_COPY.some((s) => /SHA/.test(s)), "insurance copy says SHA");
  assert.ok(content.VISIT.how.length >= 2);
  assert.ok(content.VISIT.note.includes(SITE.phoneDisplay), "the emergency note gives the number");
  assert.equal(content.VISIT_FLOW.length, 4, "reception, triage, doctor, laboratory and pharmacy");
});

test("the hero chart shrinks row by row and ends on the phone number at 20/20", () => {
  const rows = content.HERO.rows;
  assert.equal(rows[0].text, "Eye care");
  const last = rows[rows.length - 1];
  assert.equal(last.text, SITE.phoneDisplay);
  assert.equal(last.acuity, "20/20");
  assert.equal(last.href, `tel:${SITE.phoneTel}`);
  const denominators = rows.map((r) => Number(r.acuity.replace(/^20\//, "")));
  assert.ok(denominators.every((n) => Number.isInteger(n) && n >= 20), "acuity labels look like 20/200");
  for (let i = 1; i < denominators.length; i++) assert.ok(denominators[i] < denominators[i - 1], `row ${i + 1} is smaller than row ${i}`);
  assert.equal(rows.filter((r) => r.marker === "24h").length, 1, "one row carries the 24 hour marker");
  assert.ok(rows.find((r) => r.marker === "24h")?.text.includes("24 hours"));
  assert.equal(content.HERO.lead, "Cataract surgery, dental, theatre, inpatient and outpatient care, open 24 hours.");
});

test("the page title and description suit a search result", () => {
  assert.ok(content.META.title.length <= 60, `title is ${content.META.title.length} characters`);
  assert.ok(content.META.title.includes("Kingdom Faith Based Hospital"));
  const d = content.META.description.length;
  assert.ok(d >= 120 && d <= 160, `description is ${d} characters`);
  assert.ok(content.META.description.includes(SITE.phoneDisplay));
});

test("every photo has a description that says what it shows", () => {
  const entries = Object.entries(content.PHOTOS);
  assert.deepEqual(entries.map(([k]) => k).sort(), ["building", "eye-surgery", "grounds", "laboratory", "ward"]);
  for (const [name, p] of entries) {
    assert.equal(p.src, `/images/home/${name}.webp`);
    assert.ok(p.alt.length >= 30, `${name} alt text is too short`);
    assert.ok(!/^(image|photo|picture)\b/i.test(p.alt), `${name} alt text should not start with "image of"`);
    assert.ok(p.width > 0 && p.height > 0);
  }
});
