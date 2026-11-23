import { createSession, sessionCookie } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true });
  const { current, next } = await readBody<{ current?: string; next?: string }>(req);
  if (!current || !next || next.length < 10) throw new HttpError(400, "Enter your current password and a new one of at least 10 characters.");
  if (next === current) throw new HttpError(400, "Choose a password different from the current one.");
  if (next.toLowerCase().includes(u.email.split("@")[0].slice(0, 8))) throw new HttpError(400, "The password must not contain your email name.");
  // The new session version ends every other sign in of this account. This browser gets a fresh cookie and stays signed in.
  const rows = await sql().query(`update app_users set password_hash = crypt($2, gen_salt('bf', 10)), must_change = false, session_version = coalesce(session_version, 0) + 1 where id = $1 and active and status = 'active' and coalesce(session_version, 0) = $4 and password_hash = crypt($3, password_hash) returning id, coalesce(session_version, 0) as sv`, [u.uid, next, current, u.sv]);
  if (!rows.length) throw new HttpError(400, "Your current password is not correct.");
  const res = ok({ ok: true });
  res.headers.append("set-cookie", sessionCookie(await createSession({ id: u.uid, email: u.email, name: u.name, role: u.role, sv: rows[0].sv })));
  return res;
});
