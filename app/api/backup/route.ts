import { guard, sql } from "@/lib/server/db";
import { handle, HttpError, ok, requireUser } from "@/lib/server/http";
import { runBackup } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const me = await requireUser(req, { admin: true });
  const s = sql();
  const [, backups] = await s.transaction([guard(s, me), s.query(`select id, at, ok, trigger, tables, rows, bytes, note from backup_log order by id desc limit 10`)]);
  return ok({ backups });
});

/** Called by the nightly schedule with the cron secret, or by an administrator pressing Back up now. */
export const POST = handle(async (req) => {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret") || "";
  const cron = !!secret && secret.length >= 32 && supplied.length === secret.length && [...supplied].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ secret.charCodeAt(i)), 0) === 0;
  if (!cron) { const me = await requireUser(req, { write: true, admin: true }); await guard(sql(), me); }
  const r = await runBackup(cron ? "nightly" : "manual");
  return ok(r);
});
void HttpError;
