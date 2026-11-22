/* Database tasks for Neon. Usage: DATABASE_URL=... npx tsx scripts/db.ts <apply|seed|admin|clear> */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { COLLECTIONS, TABLE } from "../lib/collections";
import { buildSeed } from "../lib/seed";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL first."); process.exit(1); }
const sql = neon(url);
const [cmd = "", ...flags] = process.argv.slice(2);

function split(text: string): string[] {
  const out: string[] = [];
  let cur = "", inDollar = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("--")) continue;
    cur += line + "\n";
    if (((line.match(/\$\$/g) || []).length) % 2 === 1) inDollar = !inDollar;
    if (!inDollar && line.trimEnd().endsWith(";")) { out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function apply() {
  const statements = split(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  for (const s of statements) await sql.query(s);
  console.log(`Applied ${statements.length} schema statements.`);
}

async function wipe() {
  await sql.query(`truncate ${COLLECTIONS.map((c) => `"${TABLE[c]}"`).join(", ")}, audit_log, login_attempts restart identity`);
  await sql.query(`alter sequence patient_mrn_seq restart with 100300`);
  await sql.query(`alter sequence invoice_no_seq restart with 1271`);
  await sql.query(`alter sequence sha_claim_seq restart with 314`);
}

async function seed() {
  const [{ n }] = await sql.query(`select count(*)::int as n from settings`);
  if (n > 0 && !flags.includes("--force")) { console.log("The database already has data. Add --force to wipe it and load the sample data again."); return; }
  if (n > 0) await wipe();
  const data = buildSeed();
  const queries = [
    ...COLLECTIONS.map((c) => sql.query(
      `insert into "${TABLE[c]}" (id, data, created_at) select (r->>'id')::int, r - 'id', now() - make_interval(secs => ord::int) from jsonb_array_elements($1::jsonb) with ordinality as t(r, ord)`,
      [JSON.stringify(data[c])],
    )),
    ...COLLECTIONS.map((c) => sql.query(`select setval(pg_get_serial_sequence('"${TABLE[c]}"', 'id'), greatest((select coalesce(max(id), 0) from "${TABLE[c]}"), 1))`)),
  ];
  await sql.transaction(queries);
  console.log("Loaded sample data: " + COLLECTIONS.map((c) => `${c} ${data[c].length}`).join(", "));
}

async function admin() {
  const email = flags.find((f) => !f.startsWith("--")) || "kingdomfaithbasedhospital@gmail.com";
  const name = (flags.find((f) => f.startsWith("--name=")) || "--name=Hospital Administrator").slice(7);
  const password = randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 14);
  const rows = flags.includes("--reset")
    ? await sql.query(`update app_users set password_hash = crypt($2, gen_salt('bf', 10)), active = true, status = 'active', must_change = true where lower(email) = lower($1) returning id`, [email, password])
    : await sql.query(`insert into app_users (email, name, role, password_hash, must_change) values ($1, $3, 'admin', crypt($2, gen_salt('bf', 10)), true) on conflict (lower(email)) do nothing returning id`, [email, password, name]);
  console.log(rows.length ? `Administrator ${email} temporary password: ${password}` : `${email} already exists. Add --reset to set a new temporary password.`);
}

async function clear() {
  if (!flags.includes("--yes")) { console.log("This deletes every patient, visit, invoice and other record, and keeps staff logins. Run again with --yes to confirm."); return; }
  await wipe();
  console.log("Cleared all records. Staff logins were kept. Re-enter your hospital settings and catalogues.");
}

const tasks: Record<string, () => Promise<void>> = { apply, seed, admin, clear };
if (!tasks[cmd]) { console.error("Use one of: apply, seed, admin, clear"); process.exit(1); }
tasks[cmd]().catch((e) => { console.error(e?.message || e); process.exit(1); });
