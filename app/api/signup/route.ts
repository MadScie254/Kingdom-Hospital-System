import { POSITIONS } from "@/lib/access";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";

/** Public. Creates a pending account. Nobody can sign in until an administrator approves it. */
export const POST = handle(async (req) => {
  const b = await readBody<Record<string, any>>(req);
  if (b.website) return ok({ ok: true }); // honeypot, real people never fill this in
  const name = String(b.name || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
  const phone = String(b.phone || "").trim().slice(0, 40);
  const licence = String(b.licence || "").trim().slice(0, 60);
  const password = String(b.password || "");
  const position = POSITIONS.find((p) => p.label === b.position);
  const departments = (Array.isArray(b.departments) ? b.departments : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 8);
  if (name.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter your full name and a valid email address.");
  if (!position) throw new HttpError(400, "Choose your position.");
  if (!departments.length) throw new HttpError(400, "Choose at least one department.");
  if (password.length < 10) throw new HttpError(400, "Choose a password of at least 10 characters.");
  if (password.toLowerCase().includes(email.split("@")[0].slice(0, 8))) throw new HttpError(400, "The password must not contain your email name.");
  const ip = (req.headers.get("cf-connecting-ip") || "unknown").slice(0, 64);
  const s = sql();
  const [recent, pending, taken, valid] = await s.transaction([
    s.query(`select count(*)::int as n from app_users where signup_ip = $1 and requested_at > now() - interval '1 hour'`, [ip]),
    s.query(`select count(*)::int as n from app_users where status = 'pending'`),
    s.query(`select 1 from app_users where lower(email) = lower($1)`, [email]),
    s.query(`select id from departments where id = any($1::int[])`, [departments]),
  ]);
  if (recent[0].n >= 5) throw new HttpError(429, "Too many requests from this connection. Try again in an hour.");
  if (pending[0].n >= 200) throw new HttpError(429, "The administrator has many requests waiting. Try again later.");
  if (taken.length) throw new HttpError(409, "An account or request already exists for that email. Sign in, or ask the administrator.");
  if (valid.length !== new Set(departments).size) throw new HttpError(400, "One of the departments is not valid.");
  await s.transaction([
    s.query(
      `insert into app_users (email, name, role, password_hash, status, phone, position, licence, departments, requested_role, signup_ip)
       values ($1, $2, 'staff', crypt($3, gen_salt('bf', 10)), 'pending', $4, $5, $6, $7::int[], $8, $9)`,
      [email, name, password, phone, position.label, licence, departments, position.role, ip],
    ),
    s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'signup.request', 'app_users', $2)`, [email, email]),
  ]);
  return ok({ ok: true }, { status: 201 });
});
