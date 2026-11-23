import { ROLES, ROLE_LABEL, type Role } from "@/lib/access";
import { guard, sql } from "@/lib/server/db";
import { emails } from "@/lib/server/emails";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";
import { makeTempPassword, originOf, sendMail } from "@/lib/server/mail";

const COLUMNS = `id, email, name, role, active, status, departments, position, phone, licence, requested_role as "requestedRole", requested_at as "requestedAt", last_login_at as "lastLoginAt", must_change as "mustChange"`;

export const PATCH = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const me = await requireUser(req, { write: true, admin: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid user.");
  const b = await readBody<Record<string, any>>(req);
  const role = (ROLES as readonly string[]).includes(b.role) ? b.role : null;
  const status = ["pending", "active", "declined"].includes(b.status) ? b.status : null;
  const departments = Array.isArray(b.departments) ? b.departments.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : null;
  const reset = b.resetPassword === true;
  if (id === me.uid && ((role && role !== "admin") || b.active === false || (status && status !== "active"))) throw new HttpError(400, "You cannot switch off or demote your own account.");
  const s = sql();
  const [before] = await s.query(`select status from app_users where id = $1`, [id]);
  if (!before) throw new HttpError(404, "User not found.");
  const approving = status === "active" && before.status !== "active";
  const declining = status === "declined" && before.status === "pending";
  if (reset && before.status !== "active" && !approving) throw new HttpError(400, "Approve this person before sending a password.");
  const temp = approving || reset ? makeTempPassword() : null;
  const action = approving ? "user.approve" : declining ? "user.decline" : reset ? "user.reset_password" : status ? `user.${status}` : "user.update";
  const [, rows] = await s.transaction([
    guard(s, me),
    s.query(
      `update app_users set
         name = coalesce($2, name), role = coalesce($3, role), active = coalesce($4, active), status = coalesce($5, status),
         departments = coalesce($6::int[], departments), position = coalesce($7, position), phone = coalesce($8, phone),
         approved_by = case when $5::text = 'active' and status <> 'active' then $9 else approved_by end,
         approved_at = case when $5::text = 'active' and status <> 'active' then now() else approved_at end,
         password_hash = case when $10::text is null then password_hash else crypt($10, gen_salt('bf', 10)) end,
         must_change = case when $10::text is null then must_change else true end,
         session_version = coalesce(session_version, 0) + case when $10::text is not null or ($3::text is not null and $3::text <> role) or $4::boolean is false or ($5::text is not null and $5::text <> status) then 1 else 0 end
       where id = $1 returning ${COLUMNS}`,
      [id, b.name ? String(b.name).slice(0, 120) : null, role, typeof b.active === "boolean" ? b.active : null, status, departments, b.position ? String(b.position).slice(0, 80) : null, b.phone !== undefined ? String(b.phone).slice(0, 40) : null, me.email, temp],
    ),
    s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, $2, 'app_users', $3)`, [me.email, action, String(id)]),
  ]);
  const user = rows[0];
  if (!user) throw new HttpError(404, "User not found.");
  if (temp) {
    const names = await s.query(`select data->>'name' as name from departments where id = any($1::int[]) order by id`, [user.departments || []]);
    const sent = await sendMail(s, { to: user.email, kind: "credentials", ...emails.credentials({ reason: approving ? "approved" : "reset", name: user.name, roleLabel: ROLE_LABEL[user.role as Role], departments: names.map((d: any) => d.name), tempPassword: temp, origin: originOf(req) }) });
    return ok({ user, emailed: sent.ok, emailError: sent.error, tempPassword: sent.ok ? undefined : temp });
  }
  if (declining) {
    const [hospital] = await s.query(`select data->>'email' as email, data->>'phone' as phone from settings order by id limit 1`);
    const contact = [hospital?.email, hospital?.phone].filter(Boolean).join(" or ");
    const sent = await sendMail(s, { to: user.email, kind: "declined", ...emails.declined({ name: user.name, contact }) });
    return ok({ user, emailed: sent.ok, emailError: sent.error });
  }
  return ok({ user });
});
