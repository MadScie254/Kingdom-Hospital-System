import test from "node:test";
import assert from "node:assert/strict";
import { HieClient } from "../../lib/hie/client";
import { HieError } from "../../lib/hie/errors";
import { bodyOf, harness, json, tokenReply } from "./helpers";

const isToken = (c: { url: URL }) => c.url.pathname.endsWith("/tenants/token");

test("requests a token with client credentials as a form and reuses it", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({ ok: true })));
  await h.client.get("/patients", { identification_number: "1", identification_type: "National ID" });
  await h.client.get("/patients/eligibility", { identification_number: "1", identification_type: "National ID" });
  const tokenCalls = h.calls.filter(isToken);
  assert.equal(tokenCalls.length, 1);
  assert.equal(tokenCalls[0].method, "POST");
  assert.equal(tokenCalls[0].headers.get("content-type"), "application/x-www-form-urlencoded");
  assert.equal(await bodyOf(tokenCalls[0].body), "client_id=id-1&client_secret=secret-1");
  assert.equal(tokenCalls[0].url.href, "https://hie.test/api/v1/tenants/token");
  assert.equal(h.calls[1].headers.get("authorization"), "Bearer tok-1");
});

test("refreshes the token a minute before it expires", async () => {
  let n = 0;
  const h = harness((c) => (isToken(c) ? tokenReply(300, `tok-${++n}`) : json({})));
  await h.client.get("/patients");
  h.advance(200_000); // still valid
  await h.client.get("/patients");
  assert.equal(n, 1);
  h.advance(50_000); // inside the 60 second margin of a 300 second token
  await h.client.get("/patients");
  assert.equal(n, 2);
  assert.equal(h.calls.at(-1)!.headers.get("authorization"), "Bearer tok-2");
});

test("concurrent requests share one token request", async () => {
  const h = harness(async (c) => { if (isToken(c)) { await new Promise((r) => setTimeout(r, 15)); return tokenReply(); } return json({}); });
  await Promise.all([h.client.get("/a"), h.client.get("/b"), h.client.get("/c")]);
  assert.equal(h.calls.filter(isToken).length, 1);
});

test("a 401 drops the token, gets a new one and repeats the call once", async () => {
  let api = 0, tok = 0;
  const h = harness((c) => (isToken(c) ? tokenReply(3600, `tok-${++tok}`) : ++api === 1 ? json({ error: "token expired" }, 401) : json({ ok: true })));
  const out = await h.client.get("/patients");
  assert.deepEqual(out, { ok: true });
  assert.equal(tok, 2);
  assert.equal(h.sleeps.length, 0);
});

test("a second 401 is reported as unauthorized", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({ error: "no" }, 401)));
  await assert.rejects(h.client.get("/patients"), (e: HieError) => e.kind === "unauthorized" && e.status === 401);
});

test("bad client credentials give a clear error", async () => {
  const h = harness(() => json({ error: "invalid_client" }, 401));
  await assert.rejects(h.client.get("/patients"), (e: HieError) => e.kind === "unauthorized" && /client id and secret/.test(e.message));
});

test("a token answer without an access token is invalid", async () => {
  const h = harness(() => json({ expires_in: 10 }));
  await assert.rejects(h.client.get("/patients"), (e: HieError) => e.kind === "invalid_response");
});

test("sends the facility headers on API calls only", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({})), { facilityId: "FID-112007" });
  await h.client.get("/patients");
  const api = h.calls.find((c) => !isToken(c))!;
  assert.equal(api.headers.get("x-facility-id"), "FID-112007");
  assert.equal(api.headers.get("x-facility-id-type"), "fr-code");
  assert.equal(h.calls.find(isToken)!.headers.get("x-facility-id"), null);
});

test("sends no facility headers when none is configured or when asked not to", async () => {
  const none = harness((c) => (isToken(c) ? tokenReply() : json({})));
  await none.client.get("/patients");
  assert.equal(none.calls.at(-1)!.headers.get("x-facility-id"), null);
  const skip = harness((c) => (isToken(c) ? tokenReply() : json({})), { facilityId: "FID-1" });
  await skip.client.get("/patients", {}, { noFacility: true });
  assert.equal(skip.calls.at(-1)!.headers.get("x-facility-id"), null);
});

test("a 429 waits for Retry-After and tries again, even for a POST", async () => {
  let n = 0;
  const h = harness((c) => (isToken(c) ? tokenReply() : ++n === 1 ? json({ error: "slow down" }, 429, { "retry-after": "2" }) : json({ ok: 1 })));
  assert.deepEqual(await h.client.post("/claims/otp", { a: 1 }), { ok: 1 });
  assert.deepEqual(h.sleeps, [2000]);
});

test("waits are capped", async () => {
  let n = 0;
  const h = harness((c) => (isToken(c) ? tokenReply() : ++n === 1 ? json({}, 429, { "retry-after": "120" }) : json({})));
  await h.client.get("/x");
  assert.deepEqual(h.sleeps, [5000]);
});

test("GET retries 503 with growing waits then gives up", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({ error: "down" }, 503)));
  await assert.rejects(h.client.get("/patients"), (e: HieError) => e.kind === "server" && e.status === 503);
  assert.equal(h.calls.filter((c) => !isToken(c)).length, 3);
  assert.deepEqual(h.sleeps, [300, 600]);
});

test("a POST that is not idempotent is not repeated after a server error or a lost connection", async () => {
  const down = harness((c) => (isToken(c) ? tokenReply() : json({ error: "bad gateway" }, 502)));
  await assert.rejects(down.client.post("/claims/submit", { a: 1 }), (e: HieError) => e.status === 502);
  assert.equal(down.calls.filter((c) => !isToken(c)).length, 1);
  const lost = harness((c) => { if (isToken(c)) return tokenReply(); throw new Error("socket closed"); });
  await assert.rejects(lost.client.post("/claims/visit", { a: 1 }), (e: HieError) => e.kind === "network");
  assert.equal(lost.calls.filter((c) => !isToken(c)).length, 1);
});

test("an idempotent POST is repeated after a lost connection", async () => {
  let n = 0;
  const h = harness((c) => { if (isToken(c)) return tokenReply(); if (++n === 1) throw new Error("reset"); return json({ sent: true }); });
  assert.deepEqual(await h.client.post("/claims/otp", {}, { idempotent: true }), { sent: true });
});

test("a rejection is not retried and keeps SHA's own words", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({ error: "Patient is not eligible for this intervention" }, 400)));
  await assert.rejects(h.client.post("/claims/visit", {}), (e: HieError) => e.kind === "validation" && e.message === "Patient is not eligible for this intervention" && !e.retryable);
  assert.equal(h.calls.filter((c) => !isToken(c)).length, 1);
});

test("an OperationOutcome becomes structured issues", async () => {
  const outcome = { resourceType: "OperationOutcome", issue: [{ severity: "warning", code: "informational", details: { text: "minor" } }, { severity: "error", code: "required", details: { text: "Claim.diagnosis is required" }, expression: ["Claim.diagnosis"] }] };
  const h = harness((c) => (isToken(c) ? tokenReply() : json(outcome, 422)));
  await assert.rejects(h.client.post("/fhir/Bundle", {}), (e: HieError) => {
    assert.equal(e.message, "Claim.diagnosis is required");
    assert.equal(e.issues.length, 2);
    assert.deepEqual(e.issues[1].expression, ["Claim.diagnosis"]);
    return e.kind === "validation";
  });
});

test("an HTML error page does not leak into the message", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : new Response("<html><body>Bad gateway</body></html>", { status: 502 })), { maxRetries: 0 });
  await assert.rejects(h.client.get("/patients"), (e: HieError) => e.message === "HTTP 502");
});

test("a timeout is reported and a GET is tried again", async () => {
  let n = 0;
  const h = harness((c) => (isToken(c) ? tokenReply() : ++n === 1 ? new Promise<Response>(() => {}) : json({ ok: 1 })), { timeoutMs: 20 });
  assert.deepEqual(await h.client.get("/patients"), { ok: 1 });
  const slow = harness((c) => (isToken(c) ? tokenReply() : new Promise<Response>(() => {})), { timeoutMs: 20, maxRetries: 0 });
  await assert.rejects(slow.client.get("/patients"), (e: HieError) => e.kind === "timeout");
});

test("logs method, path and query keys but never query values, bodies or secrets", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({})));
  await h.client.get("/patients", { identification_number: "12345678", identification_type: "National ID" });
  const entry = h.logs.find((l) => l.path === "/patients")!;
  assert.deepEqual(entry.queryKeys, ["identification_number", "identification_type"]);
  const flat = JSON.stringify(h.logs);
  for (const secret of ["12345678", "secret-1", "tok-1"]) assert.ok(!flat.includes(secret), `${secret} leaked into the log`);
  assert.equal(entry.ok, true);
});

test("a failing log hook does not break the request", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({ ok: 1 })));
  const c2 = new HieClient({ baseUrl: "https://hie.test/api/v1", clientId: "a", clientSecret: "b" }, { fetch: (async (i: any, init?: RequestInit) => (String(i).endsWith("/tenants/token") ? tokenReply() : json({ ok: 1 }))) as any, onLog: () => { throw new Error("db down"); }, tokens: undefined });
  assert.deepEqual(await c2.get("/x"), { ok: 1 });
  void h;
});

test("refuses to start without credentials", () => {
  assert.throws(() => new HieClient({ baseUrl: "", clientId: "", clientSecret: "" }), (e: HieError) => e.kind === "not_configured");
});

test("empty and non JSON success bodies are tolerated", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : c.url.pathname.endsWith("/empty") ? new Response(null, { status: 204 }) : new Response("plain ok", { status: 200 })));
  assert.equal(await h.client.get("/empty"), null);
  assert.equal(await h.client.get("/text"), "plain ok");
});

test("drops empty query values and sends the rest", async () => {
  const h = harness((c) => (isToken(c) ? tokenReply() : json({})));
  await h.client.get("/patients/benefits/interventions", { patient_id: "CR1", search: "", code: undefined, page: 2 });
  assert.equal(h.calls.at(-1)!.url.search, "?patient_id=CR1&page=2");
});
