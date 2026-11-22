import test from "node:test";
import assert from "node:assert/strict";
import { HieError, friendlyMessage, kindForStatus, parseErrorBody } from "../../lib/hie/errors";

test("kinds follow the status", () => {
  assert.deepEqual([401, 403, 404, 409, 429, 500, 503, 400, 422].map(kindForStatus), ["unauthorized", "forbidden", "not_found", "conflict", "rate_limited", "server", "server", "validation", "validation"]);
});

test("reads the HIE error shape", () => {
  assert.equal(parseErrorBody(400, '{"error":"invalid OTP"}').message, "invalid OTP");
  assert.equal(parseErrorBody(400, '{"message":"claim not found"}').message, "claim not found");
  assert.equal(parseErrorBody(400, '{"detail":"Not found."}').message, "Not found.");
});

test("reads field style errors", () => {
  const r = parseErrorBody(400, '{"unit_price":["must not exceed the tariff"],"quantity":["required"]}');
  assert.match(r.message, /unit_price: must not exceed the tariff/);
  assert.match(r.message, /quantity: required/);
});

test("reads an OperationOutcome and prefers the first error", () => {
  const r = parseErrorBody(422, JSON.stringify({ resourceType: "OperationOutcome", issue: [{ severity: "information", code: "informational", diagnostics: "note" }, { severity: "fatal", code: "invalid", diagnostics: "Bundle is not valid", location: ["Bundle.entry[0]"] }] }));
  assert.equal(r.message, "Bundle is not valid");
  assert.equal(r.issues.length, 2);
  assert.deepEqual(r.issues[1].expression, ["Bundle.entry[0]"]);
});

test("empty, html and plain text bodies", () => {
  assert.equal(parseErrorBody(500, "").message, "HTTP 500");
  assert.equal(parseErrorBody(502, "<html>x</html>").message, "HTTP 502");
  assert.equal(parseErrorBody(400, "Bad request").message, "Bad request");
  assert.equal(parseErrorBody(400, "{}").message, "HTTP 400");
});

test("long messages are clipped", () => {
  assert.ok(parseErrorBody(400, JSON.stringify({ error: "x".repeat(900) })).message.length <= 300);
});

test("friendly messages keep SHA's words for rejections and hide server noise", () => {
  assert.equal(friendlyMessage(new HieError({ kind: "validation", status: 400, message: "Visit already exists for this patient" })), "Visit already exists for this patient");
  assert.match(friendlyMessage(new HieError({ kind: "server", status: 503, message: "upstream" })), /problem on its side/);
  assert.match(friendlyMessage(new HieError({ kind: "not_configured", message: "" })), /not set up/);
  assert.match(friendlyMessage(new Error("boom")), /Something went wrong/);
});

test("which errors are worth repeating", () => {
  assert.equal(new HieError({ kind: "network", message: "" }).retryable, true);
  assert.equal(new HieError({ kind: "validation", message: "" }).retryable, false);
});
