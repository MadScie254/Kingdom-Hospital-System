import { audit, guard, rowOf, sql, tbl } from "@/lib/server/db";
import { canWrite } from "@/lib/access";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";
import { ACTION_ONLY, cleanData, parseCollection, requireFields } from "@/lib/server/policy";

type Ctx = { params: Promise<{ collection: string; id: string }> };
const idOf = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid record.");
  return n;
};

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const p = await params;
  const c = parseCollection(p.collection);
  const u = await requireUser(req, { write: true });
  if (!canWrite(u.role, c)) throw new HttpError(403, "Your role cannot change this kind of record.");
  if (ACTION_ONLY.has(c)) throw new HttpError(403, "Use the billing screens to change invoices and payments.");
  const id = idOf(p.id);
  const data = cleanData(await readBody(req));
  requireFields(c, data, true);
  const s = sql();
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(`update ${tbl(c)} set data = data || $1::jsonb, updated_at = now() where id = $2 returning id, data`, [JSON.stringify(data), id]),
    audit(s, u.email, "update", c, id),
  ]);
  if (!rows.length) throw new HttpError(404, "That record no longer exists.");
  return ok({ row: rowOf(rows[0] as any) });
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const p = await params;
  const c = parseCollection(p.collection);
  const u = await requireUser(req, { write: true, admin: true });
  const id = idOf(p.id);
  const s = sql();
  const [, rows] = await s.transaction([guard(s, u), s.query(`delete from ${tbl(c)} where id = $1 returning id`, [id]), audit(s, u.email, "delete", c, id)]);
  if (!rows.length) throw new HttpError(404, "That record no longer exists.");
  return ok({ id });
});
