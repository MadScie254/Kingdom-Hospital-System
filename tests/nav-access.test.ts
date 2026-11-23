import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES, canOpen } from "../lib/access";
import { visibleNav } from "../lib/nav";

// A link in the sidebar that opens "This screen is not part of your access" is a bug the person can see.
test("every link in the sidebar opens for the role that sees it", () => {
  const bad: string[] = [];
  for (const role of ROLES) {
    for (const group of visibleNav(role)) {
      for (const item of group.items) {
        // An entry with children is only a toggle in the sidebar, so it is the links inside it that must open.
        if (!item.children && !canOpen(role, item.href)) bad.push(`${role}: ${item.href}`);
        for (const child of item.children ?? []) if (!canOpen(role, child.href)) bad.push(`${role}: ${child.href}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("a menu entry whose children are all closed to the role is not shown", () => {
  for (const role of ROLES) {
    for (const group of visibleNav(role)) {
      for (const item of group.items) if (item.children) assert.ok(item.children.length > 0, `${role}: ${item.href} has no children left`);
    }
  }
});

test("a nurse keeps the patient list and loses the payments register, which only reception, accounts and administrators open", () => {
  const nurse = visibleNav("nurse").flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]));
  assert.ok(nurse.includes("/patients"));
  assert.ok(!nurse.includes("/patients/payments"));
  const accounts = visibleNav("accounts").flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]));
  assert.ok(accounts.includes("/patients/payments"));
});
