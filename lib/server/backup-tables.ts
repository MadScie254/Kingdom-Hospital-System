import { COLLECTIONS, TABLE } from "../collections";

/**
 * SHA tables that are backed up when the database has them. hie_consents is needed to carry on with open claims after a restore.
 * hie_log and hie_events are the record of every call to SHA and every status SHA sent, which DHA can ask to see.
 */
export const HIE_BACKUP_TABLES = ["hie_consents", "hie_events", "hie_log"] as const;

/** The call log is kept for as long as the nightly backups can be asked for evidence, so it is limited by age, not left to grow without end. */
export const HIE_LOG_DAYS = 400;
export const AUDIT_LOG_DAYS = 90;

type Query = (text: string, params?: unknown[]) => Promise<Array<Record<string, any>>>;

/** Every table in a backup, in the order it is written. The SHA tables are added only once the schema has been applied. */
export async function backupTables(query: Query): Promise<string[]> {
  const base = [...COLLECTIONS.map((c) => TABLE[c]), "app_users", "audit_log"];
  const found = await query(`select t.name from unnest($1::text[]) as t(name) where to_regclass('public.' || t.name) is not null`, [[...HIE_BACKUP_TABLES]]);
  const have = new Set(found.map((r) => String(r.name)));
  return [...base, ...HIE_BACKUP_TABLES.filter((t) => have.has(t))];
}

/** The select that reads one table into the backup. The two logs are limited by age. */
export function backupSelect(table: string): string {
  if (table === "audit_log") return `select * from audit_log where at > now() - interval '${AUDIT_LOG_DAYS} days'`;
  if (table === "hie_log") return `select * from hie_log where at > now() - interval '${HIE_LOG_DAYS} days'`;
  return `select * from "${table}"`;
}
