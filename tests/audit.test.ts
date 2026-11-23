import assert from "node:assert/strict";
import { test } from "node:test";
import { ALERT_EVERY_MS, writeAudit, type AuditDeps } from "../lib/server/hie/audit";

const fakeSql = {} as any;

function deps(start = 1_000_000) {
  const state = { clock: start, logs: [] as string[], alerts: [] as Array<{ what: string; reason: string }> };
  const d: AuditDeps = {
    lastAlert: null,
    now: () => state.clock,
    log: (line) => state.logs.push(line),
    notify: (_s, what, reason) => state.alerts.push({ what, reason }),
  };
  return { d, state };
}

test("a write that works says so and stays quiet", async () => {
  const { d, state } = deps();
  let calls = 0;
  assert.equal(await writeAudit(fakeSql, "audit_log hie.visit.start", async () => { calls++; }, d), true);
  assert.equal(calls, 1);
  assert.deepEqual(state.logs, []);
  assert.deepEqual(state.alerts, []);
});

test("a write that fails once is tried again and nobody is bothered", async () => {
  const { d, state } = deps();
  let calls = 0;
  const ok = await writeAudit(fakeSql, "hie_log", async () => { if (++calls === 1) throw new Error("connection reset"); }, d);
  assert.equal(ok, true);
  assert.equal(calls, 2);
  assert.deepEqual(state.alerts, []);
});

test("a write that fails twice is made loud: false, a log line and an alert", async () => {
  const { d, state } = deps();
  const ok = await writeAudit(fakeSql, "audit_log hie.authorize", async () => { throw new Error("relation audit_log does not exist"); }, d);
  assert.equal(ok, false);
  assert.equal(state.logs.length, 1);
  assert.match(state.logs[0], /hie audit write failed: audit_log hie\.authorize: relation audit_log does not exist/);
  assert.deepEqual(state.alerts, [{ what: "audit_log hie.authorize", reason: "relation audit_log does not exist" }]);
});

test("it never throws, so the SHA step that already happened is not reported as failed", async () => {
  const { d } = deps();
  await assert.doesNotReject(writeAudit(fakeSql, "hie_log", async () => { throw "not even an Error"; }, d));
});

test("alerts are limited to one every half hour but every failure is still logged", async () => {
  const { d, state } = deps();
  const fail = async () => { throw new Error("down"); };
  await writeAudit(fakeSql, "hie_log", fail, d);
  state.clock += 60_000;
  await writeAudit(fakeSql, "hie_log", fail, d);
  assert.equal(state.logs.length, 2);
  assert.equal(state.alerts.length, 1);
  state.clock += ALERT_EVERY_MS;
  await writeAudit(fakeSql, "hie_log", fail, d);
  assert.equal(state.logs.length, 3);
  assert.equal(state.alerts.length, 2);
});

test("the reason in the alert is short", async () => {
  const { d, state } = deps();
  await writeAudit(fakeSql, "hie_log", async () => { throw new Error("x".repeat(5000)); }, d);
  assert.ok(state.alerts[0].reason.length <= 200);
});
