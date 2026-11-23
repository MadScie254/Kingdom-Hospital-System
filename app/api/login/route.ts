import { createSession, sessionCookie } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";

export const POST = handle(async (req) => {
  const { email, password } = await readBody<{ email?: string; password?: string }>(req);
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) throw new HttpError(400, "Enter your email and password.");
  const s = sql();
  const [attempts, found] = await s.transaction([
    s.query(`select count(*)::int as n from login_attempts where lower(email) = lower($1) and ok = false and at > now() - interval '15 minutes'`, [email]),
    s.query(`select id, email, name, role, status, active, coalesce(session_version, 0) as sv from app_users where lower(email) = lower($1) and password_hash = crypt($2, password_hash)`, [email, password]),
  ]);
  if (attempts[0].n >= 5) throw new HttpError(429, "Too many failed attempts. Wait 15 minutes and try again.");
  const user = found[0];
  const allowed = !!user && user.active && user.status === "active";
  await s.transaction([
    s.query(`insert into login_attempts (email, ok) values ($1, $2)`, [email.slice(0, 200), !!user]),
    ...(allowed ? [s.query(`update app_users set last_login_at = now() where id = $1`, [user.id])] : []),
  ]);
  if (!user) throw new HttpError(401, "Email or password is incorrect.");
  if (user.status === "pending") throw new HttpError(403, "Your request is waiting for the administrator to approve it. You can sign in once it is approved.");
  if (user.status === "declined") throw new HttpError(403, "Your request was not approved. Contact the hospital administrator.");
  if (!user.active) throw new HttpError(403, "This account is switched off. Contact the hospital administrator.");
  const res = ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  res.headers.append("set-cookie", sessionCookie(await createSession(user as any)));
  return res;
});
