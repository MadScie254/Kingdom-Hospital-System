import { guard, sql } from "@/lib/server/db";
import { emails } from "@/lib/server/emails";
import { handle, HttpError, ok, requireUser } from "@/lib/server/http";
import { alertRecipients, sendMail } from "@/lib/server/mail";

/** Sends a test message to every alert address so an administrator can see email is working. */
export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true, admin: true });
  const s = sql();
  await guard(s, u);
  const [recent] = await s.query(`select count(*)::int as n from email_log where kind = 'test' and at > now() - interval '1 hour'`);
  if (recent.n >= 10) throw new HttpError(429, "Too many test emails. Try again in an hour.");
  const to = (await alertRecipients(s)).slice(0, 5);
  if (!to.length) throw new HttpError(400, "Add an alert address first.");
  const results = [];
  for (const addr of to) results.push({ to: addr, ...(await sendMail(s, { to: addr, kind: "test", ...emails.test() })) });
  return ok({ results });
});
