import { COLLECTIONS } from "@/lib/collections";
import { rowsOf, sql, tbl } from "@/lib/server/db";
import { handle, HttpError, ok, requireUser } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  const s = sql();
  const res = await s.transaction([
    s.query(`select id, email, name, role from app_users where id = $1 and active`, [u.uid]),
    ...COLLECTIONS.map((c) => s.query(`select id, data from ${tbl(c)} order by created_at desc, id desc`)),
  ]);
  if (!res[0].length) throw new HttpError(401, "Your account is no longer active.");
  const data: Record<string, unknown> = {};
  COLLECTIONS.forEach((c, i) => (data[c] = rowsOf(res[i + 1])));
  return ok({ user: res[0][0], data });
});
