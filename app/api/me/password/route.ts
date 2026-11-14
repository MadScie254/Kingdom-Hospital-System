import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true });
  const { current, next } = await readBody<{ current?: string; next?: string }>(req);
  if (!current || !next || next.length < 10) throw new HttpError(400, "Enter your current password and a new one of at least 10 characters.");
  const rows = await sql().query(`update app_users set password_hash = crypt($2, gen_salt('bf', 10)) where id = $1 and active and password_hash = crypt($3, password_hash) returning id`, [u.uid, next, current]);
  if (!rows.length) throw new HttpError(400, "Your current password is not correct.");
  return ok({ ok: true });
});
