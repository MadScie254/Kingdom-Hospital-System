import assert from "node:assert/strict";
import { test } from "node:test";
import { SHA_CLAIM_NO_SQL, shaClaimNo } from "../lib/claim-number";

test("claim numbers are SHA, the year, then the sequence padded to four digits", () => {
  assert.equal(shaClaimNo(2026, 315), "SHA20260315");
  assert.equal(shaClaimNo(2027, 7), "SHA20270007");
  assert.equal(shaClaimNo(2030, 12345), "SHA203012345");
});

test("the year comes from the clock in Nairobi, never from a fixed value", () => {
  assert.match(SHA_CLAIM_NO_SQL, /to_char\(now\(\) at time zone 'Africa\/Nairobi', 'YYYY'\)/);
  assert.doesNotMatch(SHA_CLAIM_NO_SQL, /20\d\d/);
});

test("the sequence is the one that already numbers SHA claims", () => {
  assert.match(SHA_CLAIM_NO_SQL, /nextval\('sha_claim_seq'\)/);
});
