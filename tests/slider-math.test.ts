import assert from "node:assert/strict";
import { test } from "node:test";
import { clarity } from "../components/site/cataract-slider";

test("fully clear vision applies no filter at all", () => {
  assert.deepEqual(clarity(100), { blur: 0, sepia: 0, contrast: 1, brightness: 1 });
});

test("fully clouded vision blurs, yellows, dims and flattens the photo", () => {
  const c = clarity(0);
  assert.ok(c.blur >= 6, `blur ${c.blur}`);
  assert.ok(c.sepia >= 0.4, `sepia ${c.sepia}`);
  assert.ok(c.contrast < 0.8, `contrast ${c.contrast}`);
  assert.ok(c.brightness < 1, `brightness ${c.brightness}`);
});

test("each step toward clear lowers blur and tint and raises contrast and brightness", () => {
  let before = clarity(0);
  for (let v = 1; v <= 100; v++) {
    const now = clarity(v);
    assert.ok(now.blur <= before.blur, `blur at ${v}`);
    assert.ok(now.sepia <= before.sepia, `sepia at ${v}`);
    assert.ok(now.contrast >= before.contrast, `contrast at ${v}`);
    assert.ok(now.brightness >= before.brightness, `brightness at ${v}`);
    before = now;
  }
});

test("out of range input is clamped, and a broken value shows the photo clear", () => {
  assert.deepEqual(clarity(-40), clarity(0));
  assert.deepEqual(clarity(250), clarity(100));
  for (const broken of [NaN, Infinity, -Infinity]) assert.deepEqual(clarity(broken), clarity(100), String(broken));
});

test("the values are short decimals that are safe to write into a CSS filter", () => {
  for (let v = 0; v <= 100; v += 3) {
    for (const n of Object.values(clarity(v))) assert.equal(Number(n.toFixed(2)), n, `${n} at ${v}`);
  }
});
