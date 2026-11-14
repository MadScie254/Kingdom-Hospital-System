import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

export const GET = handle(async (req) => {
  await requireUser(req, { admin: true });
  return ok({ users: await sql().query(`select id, email, name, role, active, last_login_at from app_users order by id`) });
});

export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true, admin: true });
  const b = await readBody<{ email?: string; name?: string; role?: string; password?: string }>(req);
  const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim(), role = b.role === "admin" ? "admin" : "staff", password = String(b.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw new HttpError(400, "Enter a name and a valid email address.");
  if (password.length < 10) throw new HttpError(400, "The password must be at least 10 characters.");
  const s = sql();
  try {
    const [rows] = await s.transaction([
      s.query(`insert into app_users (email, name, role, password_hash) values ($1, $2, $3, crypt($4, gen_salt('bf', 10))) returning id, email, name, role, active, last_login_at`, [email, name.slice(0, 120), role, password]),
      s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'user.create', 'app_users', $2)`, [u.email, email]),
    ]);
    return ok({ user: rows[0] }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "23505") throw new HttpError(409, "A user with that email already exists.");
    throw e;
  }
});
