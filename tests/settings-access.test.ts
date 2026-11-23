import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES, SETTINGS_DESK_ROLES, settingsFor } from "../lib/access";

const row = {
  id: 1, name: "Kingdom Faith Based Hospital", tagline: "Faith based hospital", address: "P.O Box 2", phone: "+254 700 000 000", email: "hospital@example.test",
  registration: "Licence 123", footer: "Thank you.", currency: "KES", timeFormat: "24 hour",
  kra: "A000000000X", vat: 16, discount: 5, mpesaPaybill: "123456", mpesaAccount: "KFBH", bank: "Bank 000 111 222",
  mflCode: "112007", frCode: "FID-112007", kephLevel: "Level 4", facilityCode: "old value",
};
const PUBLIC = ["id", "name", "tagline", "address", "phone", "email", "registration", "footer", "currency", "timeFormat"];
const DESK = ["kra", "vat", "discount", "mpesaPaybill", "mpesaAccount", "bank", "mflCode", "frCode", "kephLevel"];

test("the administrator gets the whole record", () => {
  assert.deepEqual(settingsFor("admin", row), row);
});

test("accounts and the front desk get the public details and the finance and SHA fields", () => {
  for (const role of ["accounts", "reception"] as const) {
    const out = settingsFor(role, row);
    assert.deepEqual(Object.keys(out).sort(), [...PUBLIC, ...DESK].sort(), role);
    assert.equal((out as any).facilityCode, undefined, "unlisted fields are not sent");
  }
});

test("every other role gets only what prints on documents", () => {
  for (const role of ROLES.filter((r) => r !== "admin" && !SETTINGS_DESK_ROLES.includes(r))) {
    const out = settingsFor(role, row);
    assert.deepEqual(Object.keys(out).sort(), [...PUBLIC].sort(), role);
    for (const k of DESK) assert.equal((out as any)[k], undefined, `${role} must not get ${k}`);
  }
});

test("someone with no role gets the public details only", () => {
  assert.deepEqual(Object.keys(settingsFor(undefined, row)).sort(), [...PUBLIC].sort());
});

test("the record is copied, not changed", () => {
  const copy = { ...row };
  settingsFor("lab", copy);
  assert.deepEqual(copy, row);
});
