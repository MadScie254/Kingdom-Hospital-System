import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";
import { sha256 } from "@/lib/server/mail";

/** Public. Sets a new password from an emailed link. A link works once. */
export const POST = handle(async (req) => {
  const { token, password } = await readBody<{ token?: string; password?: string }>(req);
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) throw new HttpError(400, "This link is not valid. Ask for a new one.");
  if (typeof password !== "string" || password.length < 10) throw new HttpError(400, "Choose a password of at least 10 characters.");
  const hash = await sha256(token);
  const s = sql();
  const [found] = await s.query(`select u.email from password_resets r join app_users u on u.id = r.user_id where r.token_hash = $1 and r.used_at is null and r.expires_at > now() and u.active and u.status = 'active'`, [hash]);
  if (!found) throw new HttpError(400, "This link has expired or was already used. Ask for a new one.");
  if (password.toLowerCase().includes(String(found.email).split("@")[0].slice(0, 8))) throw new HttpError(400, "The password must not contain your email name.");
  const rows = await s.query(
    `with t as (
       update password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id
     ), u as (
       update app_users set password_hash = crypt($2, gen_salt('bf', 10)), must_change = false, session_version = coalesce(session_version, 0) + 1
       where id in (select user_id from t) and active and status = 'active' returning id, email
     ), o as (
       update password_resets set used_at = now() where user_id in (select id from u) and used_at is null and token_hash <> $1
     ), c as (
       delete from login_attempts where lower(email) in (select lower(email) from u)
     ), a as (
       insert into audit_log (actor, action, collection, record_id) select email, 'user.reset_by_email', 'app_users', id::text from u
     )
     select id from u`,
    [hash, password],
  );
  if (!rows.length) throw new HttpError(400, "This link has expired or was already used. Ask for a new one.");
  return ok({ ok: true });
});
