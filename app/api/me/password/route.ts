import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true });
  const { current, next } = await readBody<{ current?: string; next?: string }>(req);
  if (!current || !next || next.length < 10) throw new HttpError(400, "Enter your current password and a new one of at least 10 characters.");
  if (next === current) throw new HttpError(400, "Choose a password different from the current one.");
  if (next.toLowerCase().includes(u.email.split("@")[0].slice(0, 8))) throw new HttpError(400, "The password must not contain your email name.");
  const rows = await sql().query(`update app_users set password_hash = crypt($2, gen_salt('bf', 10)), must_change = false where id = $1 and active and status = 'active' and password_hash = crypt($3, password_hash) returning id`, [u.uid, next, current]);
  if (!rows.length) throw new HttpError(400, "Your current password is not correct.");
  return ok({ ok: true });
});
