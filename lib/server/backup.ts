import { getCloudflareContext } from "@opennextjs/cloudflare";
import { COLLECTIONS, TABLE } from "../collections";
import { sql } from "./db";
import { HttpError } from "./http";

type KV = { put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };
const KEEP_SECONDS = 35 * 86400;
const CHUNK = 4000;

/** Copies every table into Cloudflare KV, one key per table chunk, kept for 35 days. */
export async function runBackup(trigger: "nightly" | "manual") {
  let kv: KV | undefined;
  try { kv = ((getCloudflareContext() as any).env as { BACKUPS?: KV }).BACKUPS; } catch { kv = undefined; }
  if (!kv) throw new HttpError(501, "Backups run on the hosted site only.");
  const s = sql();
  const tables = [...COLLECTIONS.map((c) => TABLE[c]), "app_users", "audit_log"];
  const results = await s.transaction(tables.map((t) => s.query(t === "audit_log" ? `select * from audit_log where at > now() - interval '90 days'` : `select * from "${t}"`)));
  const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  let rows = 0, bytes = 0, parts = 0;
  try {
    for (let i = 0; i < tables.length; i++) {
      const list = results[i] as unknown[];
      rows += list.length;
      for (let n = 0; n === 0 || n * CHUNK < list.length; n++) {
        const body = JSON.stringify(list.slice(n * CHUNK, (n + 1) * CHUNK));
        bytes += body.length; parts++;
        await kv.put(`backup/${day}/${tables[i]}.${n}.json`, body, { expirationTtl: KEEP_SECONDS });
      }
    }
    const manifest = JSON.stringify({ at: new Date().toISOString(), day, trigger, tables, rows, bytes, parts });
    await kv.put(`backup/${day}/manifest.json`, manifest, { expirationTtl: KEEP_SECONDS });
    await kv.put("backup/latest.json", manifest);
    await s.query(`insert into backup_log (ok, trigger, tables, rows, bytes, note) values (true, $1, $2, $3, $4, $5)`, [trigger, tables.length, rows, bytes, `Saved as backup/${day}`]);
    return { day, tables: tables.length, rows, bytes };
  } catch (e: any) {
    await s.query(`insert into backup_log (ok, trigger, note) values (false, $1, $2)`, [trigger, String(e?.message || e).slice(0, 300)]).catch(() => {});
    throw e;
  }
}
