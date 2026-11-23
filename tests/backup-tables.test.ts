import assert from "node:assert/strict";
import { test } from "node:test";
import { COLLECTIONS, TABLE } from "../lib/collections";
import { HIE_BACKUP_TABLES, HIE_LOG_DAYS, backupSelect, backupTables } from "../lib/server/backup-tables";

/** A stand in for the database that says which of the asked for tables exist. */
const dbWith = (present: string[]) => async (_text: string, params?: unknown[]) => ((params?.[0] as string[]) || []).filter((n) => present.includes(n)).map((name) => ({ name }));

test("the SHA evidence tables are in the backup once the schema has them", async () => {
  const tables = await backupTables(dbWith([...HIE_BACKUP_TABLES]));
  for (const t of ["hie_consents", "hie_events", "hie_log"]) assert.ok(tables.includes(t), `${t} is missing`);
});

test("a database that has not had the SHA schema applied is still backed up, as before", async () => {
  const tables = await backupTables(dbWith([]));
  assert.ok(!tables.some((t) => t.startsWith("hie_")));
  assert.ok(tables.includes("app_users") && tables.includes("audit_log"));
});

test("only the tables that exist are added", async () => {
  const tables = await backupTables(dbWith(["hie_log"]));
  assert.deepEqual(tables.filter((t) => t.startsWith("hie_")), ["hie_log"]);
});

test("every record table is still backed up and nothing is listed twice", async () => {
  const tables = await backupTables(dbWith([...HIE_BACKUP_TABLES]));
  for (const c of COLLECTIONS) assert.ok(tables.includes(TABLE[c]), TABLE[c]);
  assert.equal(new Set(tables).size, tables.length);
});

test("the call log and the audit log are limited by age, the rest are read whole", () => {
  assert.match(backupSelect("hie_log"), new RegExp(`interval '${HIE_LOG_DAYS} days'`));
  assert.match(backupSelect("audit_log"), /interval '90 days'/);
  assert.equal(backupSelect("hie_events"), 'select * from "hie_events"');
  assert.equal(backupSelect("patients"), 'select * from "patients"');
});
