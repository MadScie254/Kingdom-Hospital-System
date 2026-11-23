import { neon } from "@neondatabase/serverless";
import { TABLE, type CollectionName, type Row } from "../collections";

export const sql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
};
export type Sql = ReturnType<typeof sql>;

/** Quoted table name for a whitelisted collection. */
export const tbl = (c: CollectionName) => `"${TABLE[c]}"`;
export const rowOf = (r: { id: number; data: Record<string, any> }): Row => ({ ...r.data, id: r.id });
export const rowsOf = (list: any): Row[] => (Array.isArray(list) ? list.map(rowOf) : []);

/** Nairobi clock helpers, evaluated by Postgres so every device agrees on today. */
export const NOW_EAT = `to_char(now() at time zone 'Africa/Nairobi', 'YYYY-MM-DD"T"HH24:MI')`;
export const TODAY_EAT = `to_char(now() at time zone 'Africa/Nairobi', 'YYYY-MM-DD')`;

export const audit = (s: Sql, actor: string, action: string, collection: string, recordId: string | number) =>
  s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, $2, $3, $4)`, [actor, action, collection, String(recordId)]);

/** Audit the row that was just inserted into `table` in this same transaction. */
export const auditLast = (s: Sql, actor: string, action: string, collection: string, table: string) =>
  s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, $2, $3, currval(pg_get_serial_sequence($4, 'id'))::text)`, [actor, action, collection, table]);

/** First statement of every write. Fails the whole transaction if the user was switched off, changed role, must reset a password or signed in before the last password change. */
export const guard = (s: Sql, u: { uid: number; role: string; sv?: number }) =>
  s.query(`select 1 / case when exists (select 1 from app_users where id = $1 and active and status = 'active' and role = $2 and not must_change and coalesce(session_version, 0) = $3) then 1 else 0 end as ok`, [u.uid, u.role, u.sv ?? 0]);
