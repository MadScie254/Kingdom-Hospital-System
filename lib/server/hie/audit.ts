import type { Sql } from "../db";
import { emails } from "../emails";
import { alertAdmins, background } from "../mail";

/** What happens when an audit write fails twice. Injected so the behaviour can be tested without a database or a mail relay. */
export type AuditDeps = {
  /** When an alert email was last sent from this Worker, or null if none has been. Alerts are limited to one every half hour. */
  lastAlert: number | null;
  now: () => number;
  log: (line: string) => void;
  notify: (s: Sql, what: string, reason: string) => void;
};

export const ALERT_EVERY_MS = 30 * 60_000;

export const realDeps: AuditDeps = {
  lastAlert: null,
  now: () => Date.now(),
  log: (line) => console.error(line),
  notify: (s, what, reason) => background(alertAdmins(s, "audit_failed", emails.auditFailed({ what, error: reason }))),
};

/**
 * Runs one write to the SHA audit trail. SHA has already acted by the time these writes run, so a failure must not
 * fail the action and invite a second attempt. It is tried twice, and if it still fails it is made loud instead of
 * disappearing: a line in the Worker log, an email to the alert addresses (at most one every 30 minutes) and `false`
 * for the caller, which tells the person who pressed the button.
 */
export async function writeAudit(s: Sql, what: string, run: () => Promise<unknown>, deps: AuditDeps = realDeps): Promise<boolean> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await run(); return true; } catch (e) { last = e; }
  }
  const reason = String((last as { message?: string } | null)?.message || last).slice(0, 200);
  deps.log(`hie audit write failed: ${what}: ${reason}`);
  if (deps.lastAlert === null || deps.now() - deps.lastAlert >= ALERT_EVERY_MS) {
    deps.lastAlert = deps.now();
    deps.notify(s, what, reason);
  }
  return false;
}
