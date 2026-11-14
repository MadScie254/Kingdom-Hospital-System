/* Restore the database from a nightly backup kept in Cloudflare KV.
   Needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, KV_NAMESPACE_ID and DATABASE_URL.
   Usage: npx tsx scripts/restore.ts 2026-11-15         shows what the backup holds
          npx tsx scripts/restore.ts 2026-11-15 --yes   replaces the database with it */
import { neon } from "@neondatabase/serverless";

const [day, flag] = process.argv.slice(2);
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, KV_NAMESPACE_ID: ns, DATABASE_URL: url } = process.env;
if (!day || !token || !account || !ns || !url) { console.error("Give a date like 2026-11-15 and set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, KV_NAMESPACE_ID and DATABASE_URL."); process.exit(1); }
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${ns}`;
const headers = { authorization: `Bearer ${token}` };

async function listKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "";
  do {
    const r = await (await fetch(`${base}/keys?prefix=${encodeURIComponent(`backup/${day}/`)}&limit=1000${cursor ? `&cursor=${cursor}` : ""}`, { headers })).json();
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    keys.push(...r.result.map((k: { name: string }) => k.name));
    cursor = r.result_info?.cursor || "";
  } while (cursor);
  return keys;
}

async function main() {
  const keys = (await listKeys()).filter((k) => !k.endsWith("manifest.json"));
  if (!keys.length) { console.error(`No backup found for ${day}.`); process.exit(1); }
    const tables = new Map<string, unknown[]>();
  for (const key of keys) {
    const table = key.split("/")[2].split(".")[0];
    const rows = await (await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers })).json();
    tables.set(table, [...(tables.get(table) || []), ...rows]);
  }
  console.log(`Backup ${day}: ` + [...tables].map(([t, r]) => `${t} ${r.length}`).join(", "));
  if (flag !== "--yes") { console.log("Nothing changed. Add --yes to replace the database with this backup."); process.exit(0); }

  const sql = neon(url);
  const names = [...tables.keys()];
  await sql.transaction([
    sql.query(`truncate ${names.map((n) => `"${n}"`).join(", ")} restart identity`),
    ...names.map((n) => sql.query(`insert into "${n}" select * from jsonb_populate_recordset(null::"${n}", $1::jsonb)`, [JSON.stringify(tables.get(n))])),
    ...names.map((n) => sql.query(`select setval(pg_get_serial_sequence('"${n}"', 'id'), greatest((select coalesce(max(id), 0) from "${n}"), 1))`)),
  ]);
  console.log("Restored.");
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });
