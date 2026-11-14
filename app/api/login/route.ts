import { createSession, sessionCookie } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";

export const POST = handle(async (req) => {
  const { email, password } = await readBody<{ email?: string; password?: string }>(req);
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) throw new HttpError(400, "Enter your email and password.");
  const s = sql();
  const [attempts, found] = await s.transaction([
    s.query(`select count(*)::int as n from login_attempts where lower(email) = lower($1) and ok = false and at > now() - interval '15 minutes'`, [email]),
    s.query(`select id, email, name, role from app_users where lower(email) = lower($1) and active and password_hash = crypt($2, password_hash)`, [email, password]),
  ]);
  if (attempts[0].n >= 5) throw new HttpError(429, "Too many failed attempts. Wait 15 minutes and try again.");
  const user = found[0];
  await s.transaction([
    s.query(`insert into login_attempts (email, ok) values ($1, $2)`, [email.slice(0, 200), !!user]),
    ...(user ? [s.query(`update app_users set last_login_at = now() where id = $1`, [user.id])] : []),
  ]);
  if (!user) throw new HttpError(401, "Email or password is incorrect.");
  const res = ok({ user });
  res.headers.append("set-cookie", sessionCookie(await createSession(user as any)));
  return res;
});
