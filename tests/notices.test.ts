import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES, canOpen, type Role } from "../lib/access";
import { noticesFor } from "../lib/notices";

const some = { pending: 2, critical: 1, lowStock: 3 };
const keys = (role: Role, counts = some) => noticesFor(role, counts).map((n) => n.key);

test("an administrator sees staff requests, then critical results, then low stock", () => {
  assert.deepEqual(keys("admin"), ["requests", "critical", "stock"]);
  const [requests, critical, stock] = noticesFor("admin", some);
  assert.deepEqual([requests.count, critical.count, stock.count], [2, 1, 3]);
  assert.deepEqual([requests.href, critical.href, stock.href], ["/staff", "/lab", "/medicines"]);
});

test("each role is told only what it can act on", () => {
  assert.deepEqual(keys("lab"), ["critical"]);
  assert.deepEqual(keys("doctor"), ["critical"]);
  assert.deepEqual(keys("nurse"), ["critical"]);
  assert.deepEqual(keys("pharmacy"), ["stock"]);
  for (const role of ["reception", "accounts", "staff"] as Role[]) assert.deepEqual(keys(role), [], role);
  assert.deepEqual(noticesFor(undefined, some), [], "nobody signed in, nothing to say");
});

test("every notice opens a page that role is allowed to open", () => {
  for (const role of ROLES) {
    for (const n of noticesFor(role, some)) assert.ok(canOpen(role, n.href), `${role} cannot open ${n.href}`);
  }
});

test("nothing to report gives no notices, and a zero count is never listed", () => {
  for (const role of ROLES) assert.deepEqual(noticesFor(role, { pending: 0, critical: 0, lowStock: 0 }), [], role);
  assert.deepEqual(keys("admin", { pending: 0, critical: 2, lowStock: 0 }), ["critical"]);
});

test("the words agree with the number and read as plain sentences", () => {
  const one = noticesFor("admin", { pending: 1, critical: 1, lowStock: 1 }).map((n) => n.text);
  assert.deepEqual(one, ["1 staff request is waiting for approval", "1 critical lab result is not released yet", "1 medicine is at or below reorder level"]);
  const many = noticesFor("admin", { pending: 4, critical: 2, lowStock: 7 }).map((n) => n.text);
  assert.deepEqual(many, ["4 staff requests are waiting for approval", "2 critical lab results are not released yet", "7 medicines are at or below reorder level"]);
  for (const text of [...one, ...many]) assert.ok(!/[–—]| - /.test(text), text);
});
