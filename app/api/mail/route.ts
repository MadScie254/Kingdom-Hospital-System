import { guard, sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";
import { alertRecipients, relayAllowed } from "@/lib/server/mail";

const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

/** Email settings for administrators. The access code is never sent back. */
export const GET = handle(async (req) => {
  const me = await requireUser(req, { admin: true });
  const s = sql();
  const [, cfg, log] = await s.transaction([
    guard(s, me),
    s.query(`select key, value from app_config where key in ('mail_relay_url', 'mail_relay_token', 'alert_emails')`),
    s.query(`select id, at, to_email as "to", kind, subject, ok, error from email_log order by id desc limit 15`),
  ]);
  const m = Object.fromEntries(cfg.map((r: any) => [r.key, r.value])) as Record<string, string>;
  return ok({
    configured: !!(m.mail_relay_url && m.mail_relay_token),
    hasUrl: !!m.mail_relay_url,
    hasToken: !!m.mail_relay_token,
    hint: m.mail_relay_url ? m.mail_relay_url.replace(/\/exec$/, "").slice(-4) : "",
    alerts: (m.alert_emails || "").split(",").filter(Boolean),
    sendingTo: await alertRecipients(s),
    log,
  });
});

export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true, admin: true });
  const b = await readBody<{ url?: unknown; token?: unknown; alerts?: unknown }>(req);
  const s = sql();
  const writes: any[] = [];
  const put = (key: string, value: string) => writes.push(s.query(`insert into app_config (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, value]));
  const del = (...keys: string[]) => writes.push(s.query(`delete from app_config where key = any($1::text[])`, [keys]));
  if (b.url !== undefined) {
    const url = String(b.url).trim();
    if (!url) del("mail_relay_url", "mail_relay_token");
    else if (!relayAllowed(url)) throw new HttpError(400, "Paste the Web app address from Google. It starts with https://script.google.com/macros/s/ and ends with /exec.");
    else put("mail_relay_url", url);
  }
  if (b.token !== undefined && String(b.token).trim()) {
    const token = String(b.token).trim();
    if (token.length < 16 || token.length > 200 || /\s/.test(token)) throw new HttpError(400, "The access code must be 16 to 200 characters with no spaces.");
    put("mail_relay_token", token);
  }
  if (b.alerts !== undefined) {
    const list = [...new Set(String(b.alerts).split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
    if (list.length > 5 || list.some((x) => !EMAIL.test(x))) throw new HttpError(400, "Enter up to 5 valid email addresses, separated by commas.");
    if (list.length) put("alert_emails", list.join(",")); else del("alert_emails");
  }
  if (!writes.length) throw new HttpError(400, "Nothing to save.");
  await s.transaction([guard(s, u), ...writes, s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'mail.config', 'app_config', 'mail')`, [u.email])]);
  return ok({ ok: true });
});
