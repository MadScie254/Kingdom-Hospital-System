import { canRead, settingsFor, type Role } from "@/lib/access";
import { COLLECTIONS } from "@/lib/collections";
import { rowsOf, sql, tbl } from "@/lib/server/db";
import { handle, HttpError, ok, requireUser } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  const s = sql();
  const cols = COLLECTIONS.filter((c) => canRead(u.role as Role, c));
  const admin = u.role === "admin";
  const res = await s.transaction([
    s.query(`select id, email, name, role, departments, position, must_change as "mustChange" from app_users where id = $1 and active and status = 'active' and role = $2 and coalesce(session_version, 0) = $3`, [u.uid, u.role, u.sv]),
    s.query(admin ? `select count(*)::int as n from app_users where status = 'pending'` : `select 0 as n`),
    ...cols.map((c) => s.query(`select id, data from ${tbl(c)} order by created_at desc, id desc`)),
  ]);
  const user = res[0][0];
  if (!user) throw new HttpError(401, "Your account has changed. Sign in again.");
  const data: Record<string, unknown> = {};
  if (!user.mustChange) cols.forEach((c, i) => (data[c] = c === "settings" ? rowsOf(res[i + 2]).map((r) => settingsFor(u.role as Role, r)) : rowsOf(res[i + 2])));
  return ok({ user, data, pending: Number(res[1][0].n) || 0 });
});
