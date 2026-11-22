import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Sql } from "./db";

export type MailConfig = { url: string; token: string; alerts: string[] };
type Message = { to: string; kind: string; subject: string; html: string; text: string };

/** Only Google Apps Script web apps are accepted as the sender, so a saved address can never point at an internal service. */
export const relayAllowed = (url: string) => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || process.env.MAIL_RELAY_ALLOW_ANY === "1";

export async function getMailConfig(s: Sql): Promise<MailConfig | null> {
  const rows = await s.query(`select key, value from app_config where key in ('mail_relay_url', 'mail_relay_token', 'alert_emails')`);
  const m = Object.fromEntries(rows.map((r: any) => [r.key, r.value])) as Record<string, string>;
  if (!m.mail_relay_url || !m.mail_relay_token) return null;
  return { url: m.mail_relay_url, token: m.mail_relay_token, alerts: (m.alert_emails || "").split(",").map((x) => x.trim()).filter(Boolean) };
}

/** Who gets alerts: the saved alert emails, otherwise every active administrator. */
export async function alertRecipients(s: Sql): Promise<string[]> {
  const [cfg] = await s.query(`select value from app_config where key = 'alert_emails'`);
  const saved = String(cfg?.value || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (saved.length) return saved;
  return (await s.query(`select email from app_users where role = 'admin' and active and status = 'active'`)).map((r: any) => r.email);
}

/** Sends one email through the relay and records the outcome. The log keeps no message text, so temporary passwords are never stored. */
export async function sendMail(s: Sql, m: Message): Promise<{ ok: boolean; error?: string }> {
  let ok = false, error = "";
  try {
    const cfg = await getMailConfig(s);
    if (!cfg) error = "Email is not set up yet.";
    else if (!relayAllowed(cfg.url)) error = "The saved relay address is not allowed.";
    else {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(cfg.url, { method: "POST", redirect: "follow", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ token: cfg.token, to: m.to, subject: m.subject, html: m.html, text: m.text, fromName: "Kingdom Faith Based Hospital" }) });
      clearTimeout(timer);
      const body: any = await res.json().catch(() => null);
      ok = res.ok && body?.ok === true;
      if (!ok) error = String(body?.error || (res.ok ? "The relay answered, but not in the expected form. Check that it is deployed as a Web app open to Anyone." : `The relay answered ${res.status}.`)).slice(0, 200);
    }
  } catch (e: any) {
    error = String(e?.name === "AbortError" ? "The email relay did not answer in time." : e?.message || e).slice(0, 200);
  }
  await s.query(`insert into email_log (to_email, kind, subject, ok, error) values ($1, $2, $3, $4, $5)`, [m.to, m.kind, m.subject, ok, error || null]).catch(() => {});
  return { ok, error: ok ? undefined : error };
}

/** Email every alert recipient. Stops at 20 messages an hour so a flood of signups cannot flood an inbox. */
export async function alertAdmins(s: Sql, kind: string, tpl: { subject: string; html: string; text: string }) {
  const [recent] = await s.query(`select count(*)::int as n from email_log where kind = $1 and at > now() - interval '1 hour'`, [kind]);
  if (recent.n >= 20) return;
  for (const to of (await alertRecipients(s)).slice(0, 5)) await sendMail(s, { to, kind, ...tpl });
}

/** Run slow work after the response is sent. Falls back to a plain promise outside Cloudflare. */
export function background(p: Promise<unknown>) {
  const safe = p.catch(() => {});
  try { (getCloudflareContext() as any).ctx.waitUntil(safe); } catch { /* running locally, the promise just finishes */ }
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeTempPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]).join("");
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The public address people click in emails. Set APP_ORIGIN to pin it, otherwise the address of this request is used. */
export const originOf = (req: Request) => (process.env.APP_ORIGIN || new URL(req.url).origin).replace(/\/$/, "");
