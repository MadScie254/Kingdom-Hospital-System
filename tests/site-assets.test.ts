import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const dir = join(process.cwd(), "public", "images", "home");
const kb = (p: string) => statSync(p).size / 1024;
// Five are the hospital's own photos from the old site. webuye-falls is the landmark photo by Galkey, CC BY-SA 4.0, credited on the page.
const PHOTOS = ["building", "eye-clinic", "eye-surgery", "ward", "laboratory", "webuye-falls"];

test("the six photos exist as WebP and each is light enough for a phone", () => {
  for (const name of PHOTOS) {
    const file = join(dir, `${name}.webp`);
    assert.ok(existsSync(file), `${name}.webp is missing`);
    assert.ok(kb(file) < 120, `${name}.webp is ${Math.round(kb(file))} KB, over 120 KB`);
  }
});

test("nothing else is hiding in the photo folder", () => {
  const extra = existsSync(dir) ? readdirSync(dir).filter((f) => !PHOTOS.includes(f.replace(/\.webp$/, "")) || !f.endsWith(".webp")) : [];
  assert.deepEqual(extra, []);
});

test("the share image is under 150 KB and the photos together are under 520 KB", () => {
  const og = join(process.cwd(), "public", "og.jpg");
  assert.ok(existsSync(og), "og.jpg is missing");
  assert.ok(kb(og) < 150, `og.jpg is ${Math.round(kb(og))} KB`);
  const total = PHOTOS.reduce((sum, name) => sum + (existsSync(join(dir, `${name}.webp`)) ? kb(join(dir, `${name}.webp`)) : 0), 0);
  assert.ok(total < 520, `the photos weigh ${Math.round(total)} KB together`);
});

test("the typeface is self hosted as one latin file with its license beside it", () => {
  const fonts = join(process.cwd(), "public", "fonts");
  const file = join(fonts, "atkinson-hyperlegible-next-latin-wght-normal.woff2");
  assert.ok(existsSync(file), "the font file is missing");
  assert.ok(kb(file) < 60, `the font is ${Math.round(kb(file))} KB`);
  assert.ok(existsSync(join(fonts, "OFL.txt")), "the font license is missing");
  assert.deepEqual(readdirSync(fonts).filter((f) => f.endsWith(".woff2")), ["atkinson-hyperlegible-next-latin-wght-normal.woff2"], "one font file only, so the Worker bundle stays small");
});
