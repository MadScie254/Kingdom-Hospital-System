import { sql } from "@/lib/server/db";
import { emails } from "@/lib/server/emails";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";
import { background, originOf, randomToken, sendMail, sha256 } from "@/lib/server/mail";

/** Public. Emails a one hour reset link. The answer is the same whether or not the account exists. */
export const POST = handle(async (req) => {
  const b = await readBody<{ email?: string; website?: string }>(req);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
  if (b.website) return ok({ ok: true });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const s = sql();
  const [users, global] = await s.transaction([
    s.query(`select u.id, u.name, u.email, (select count(*)::int from password_resets r where r.user_id = u.id and r.created_at > now() - interval '1 hour') as recent from app_users u where lower(u.email) = $1 and u.active and u.status = 'active'`, [email]),
    s.query(`select count(*)::int as n from email_log where kind = 'reset' and at > now() - interval '1 hour'`),
  ]);
  const user = users[0];
  if (user && user.recent < 3 && global[0].n < 20) {
    const token = randomToken();
    await s.query(`insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 hour')`, [user.id, await sha256(token)]);
    background(sendMail(s, { to: user.email, kind: "reset", ...emails.reset({ name: user.name, link: `${originOf(req)}/reset?token=${token}` }) }));
  }
  return ok({ ok: true });
});
