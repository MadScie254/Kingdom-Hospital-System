import { ROLES } from "@/lib/access";
import { guard, sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

const COLUMNS = `id, email, name, role, active, status, departments, position, phone, licence, requested_role as "requestedRole", requested_at as "requestedAt", last_login_at as "lastLoginAt", must_change as "mustChange"`;

export const PATCH = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const me = await requireUser(req, { write: true, admin: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid user.");
  const b = await readBody<Record<string, any>>(req);
  const role = (ROLES as readonly string[]).includes(b.role) ? b.role : null;
  const status = ["pending", "active", "declined"].includes(b.status) ? b.status : null;
  const departments = Array.isArray(b.departments) ? b.departments.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : null;
  if (id === me.uid && ((role && role !== "admin") || b.active === false || (status && status !== "active"))) throw new HttpError(400, "You cannot switch off or demote your own account.");
  if (b.password !== undefined && String(b.password).length < 10) throw new HttpError(400, "The temporary password must be at least 10 characters.");
  const s = sql();
  const [, rows] = await s.transaction([
    guard(s, me),
    s.query(
      `update app_users set
         name = coalesce($2, name), role = coalesce($3, role), active = coalesce($4, active), status = coalesce($5, status),
         departments = coalesce($6::int[], departments), position = coalesce($7, position), phone = coalesce($8, phone),
         approved_by = case when $5::text = 'active' and status <> 'active' then $9 else approved_by end,
         approved_at = case when $5::text = 'active' and status <> 'active' then now() else approved_at end,
         password_hash = case when $10::text is null then password_hash else crypt($10, gen_salt('bf', 10)) end,
         must_change = case when $10::text is null then must_change else true end
       where id = $1 returning ${COLUMNS}`,
      [id, b.name ? String(b.name).slice(0, 120) : null, role, typeof b.active === "boolean" ? b.active : null, status, departments, b.position ? String(b.position).slice(0, 80) : null, b.phone !== undefined ? String(b.phone).slice(0, 40) : null, me.email, b.password !== undefined ? String(b.password) : null],
    ),
    s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, $2, 'app_users', $3)`, [me.email, status ? `user.${status}` : "user.update", String(id)]),
  ]);
  if (!rows.length) throw new HttpError(404, "User not found.");
  return ok({ user: rows[0] });
});
