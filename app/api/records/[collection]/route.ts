import { audit, auditLast, rowOf, sql, tbl } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";
import { ACTION_ONLY, ADMIN_WRITE, AUTO_NUMBER, cleanData, parseCollection } from "@/lib/server/policy";
import { TABLE } from "@/lib/collections";

type Ctx = { params: Promise<{ collection: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const c = parseCollection((await params).collection);
  const u = await requireUser(req, { write: true, admin: ADMIN_WRITE.has(c) });
  if (ACTION_ONLY.has(c)) throw new HttpError(403, "Use the billing screens to create invoices and payments.");
  const data = cleanData(await readBody(req));
  const auto = AUTO_NUMBER[c];
  const s = sql();
  const [rows] = await s.transaction([
    s.query(`insert into ${tbl(c)} (data) values ($1::jsonb${auto ? ` || jsonb_build_object('${auto.key}', ${auto.sql})` : ""}) returning id, data`, [JSON.stringify(data)]),
    auditLast(s, u.email, "create", c, TABLE[c]),
  ]);
  if (!rows.length) throw new HttpError(500, "The record was not saved.");
  return ok({ row: rowOf(rows[0] as any) }, { status: 201 });
});
void audit;
