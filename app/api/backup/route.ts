import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, requireUser } from "@/lib/server/http";
import { runBackup } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireUser(req, { admin: true });
  return ok({ backups: await sql().query(`select id, at, ok, trigger, tables, rows, bytes, note from backup_log order by id desc limit 10`) });
});

/** Called by the nightly schedule with the cron secret, or by an administrator pressing Back up now. */
export const POST = handle(async (req) => {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret") || "";
  const cron = !!secret && secret.length >= 32 && supplied.length === secret.length && [...supplied].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ secret.charCodeAt(i)), 0) === 0;
  if (!cron) await requireUser(req, { write: true, admin: true });
  const r = await runBackup(cron ? "nightly" : "manual");
  return ok(r);
});
void HttpError;
