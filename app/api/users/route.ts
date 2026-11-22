import { ROLES, ROLE_LABEL, type Role } from "@/lib/access";
import { guard, sql } from "@/lib/server/db";
import { emails } from "@/lib/server/emails";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";
import { makeTempPassword, originOf, sendMail } from "@/lib/server/mail";

const COLUMNS = `id, email, name, role, active, status, departments, position, phone, licence, requested_role as "requestedRole", requested_at as "requestedAt", last_login_at as "lastLoginAt", must_change as "mustChange"`;

export const GET = handle(async (req) => {
  await requireUser(req, { admin: true });
  return ok({ users: await sql().query(`select ${COLUMNS} from app_users order by (status = 'pending') desc, id`) });
});

/** Administrator creates an account. The server makes a temporary password and emails it. It is shown to the administrator only if the email could not be sent. */
export const POST = handle(async (req) => {
  const u = await requireUser(req, { write: true, admin: true });
  const b = await readBody<Record<string, any>>(req);
  const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim();
  const role = (ROLES as readonly string[]).includes(b.role) ? (b.role as Role) : "staff";
  const departments = (Array.isArray(b.departments) ? b.departments : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw new HttpError(400, "Enter a name and a valid email address.");
  const temp = makeTempPassword();
  const s = sql();
  let user: any, names: any[];
  try {
    const [, rows, , deps] = await s.transaction([
      guard(s, u),
      s.query(`insert into app_users (email, name, role, password_hash, status, departments, position, must_change, approved_by, approved_at) values ($1, $2, $3, crypt($4, gen_salt('bf', 10)), 'active', $5::int[], $6, true, $7, now()) returning ${COLUMNS}`, [email, name.slice(0, 120), role, temp, departments, String(b.position || "").slice(0, 80), u.email]),
      s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'user.create', 'app_users', $2)`, [u.email, email]),
      s.query(`select data->>'name' as name from departments where id = any($1::int[]) order by id`, [departments]),
    ]);
    user = rows[0]; names = deps;
  } catch (e: any) {
    if (e?.code === "23505") throw new HttpError(409, "A user with that email already exists.");
    throw e;
  }
  const sent = await sendMail(s, { to: email, kind: "credentials", ...emails.credentials({ reason: "created", name, roleLabel: ROLE_LABEL[role], departments: names.map((d: any) => d.name), tempPassword: temp, origin: originOf(req) }) });
  return ok({ user, emailed: sent.ok, emailError: sent.error, tempPassword: sent.ok ? undefined : temp }, { status: 201 });
});
