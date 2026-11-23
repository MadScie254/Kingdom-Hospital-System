import assert from "node:assert/strict";
import { test } from "node:test";
import { CSP_REPORT_PATH, SECURITY_HEADERS, describeReport, withSecurityHeaders } from "../lib/security-headers";

test("every response gets the security headers", () => {
  const res = withSecurityHeaders(new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }));
  for (const name of Object.keys(SECURITY_HEADERS)) assert.ok(res.headers.get(name), `${name} is missing`);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.match(res.headers.get("strict-transport-security")!, /^max-age=\d{8,}$/);
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(res.headers.get("permissions-policy")!, /camera=\(\)/);
});

test("status, body and the headers the app set are kept", async () => {
  const src = new Response(JSON.stringify({ a: 1 }), { status: 401, statusText: "Unauthorized", headers: { "content-type": "application/json", "cache-control": "no-store" } });
  src.headers.append("set-cookie", "a=1; Path=/; HttpOnly");
  src.headers.append("set-cookie", "b=2; Path=/; HttpOnly");
  const res = withSecurityHeaders(src);
  assert.equal(res.status, 401);
  assert.equal(res.statusText, "Unauthorized");
  assert.deepEqual(await res.json(), { a: 1 });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(res.headers.getSetCookie(), ["a=1; Path=/; HttpOnly", "b=2; Path=/; HttpOnly"]);
});

test("a header the app already chose is not overwritten", () => {
  const res = withSecurityHeaders(new Response(null, { status: 204, headers: { "x-frame-options": "SAMEORIGIN" } }));
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.status, 204);
});

test("the enforced policy only has directives that cannot break the app", () => {
  const csp = SECURITY_HEADERS["content-security-policy"];
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /script-src|default-src/);
});

test("the report only policy limits where anything can come from or go to", () => {
  const csp = SECURITY_HEADERS["content-security-policy-report-only"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, new RegExp(`report-uri ${CSP_REPORT_PATH}`));
  assert.doesNotMatch(csp, /unsafe-eval|https?:|\*/);
});

test("violation reports become one short line without query strings", () => {
  const legacy = { "csp-report": { "document-uri": "https://h.example/patients/3?name=Jane%20Doe&id=123", "violated-directive": "script-src-elem", "blocked-uri": "https://evil.example/x.js?token=abc" } };
  assert.equal(describeReport(legacy), "csp-report directive=script-src-elem blocked=https://evil.example page=/patients/3");
  const modern = [{ type: "csp-violation", body: { documentURL: "https://h.example/sha?patient=9", effectiveDirective: "connect-src", blockedURL: "inline" } }];
  assert.equal(describeReport(modern), "csp-report directive=connect-src blocked=inline page=/sha");
});

test("things that are not reports are ignored", () => {
  assert.equal(describeReport(null), null);
  assert.equal(describeReport("text"), null);
  assert.equal(describeReport({}), null);
  assert.equal(describeReport([1, 2]), null);
});
