import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

export const PATCH = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const me = await requireUser(req, { write: true, admin: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid user.");
  const b = await readBody<{ name?: string; role?: string; active?: boolean; password?: string }>(req);
  if (id === me.uid && (b.active === false || (b.role && b.role !== "admin"))) throw new HttpError(400, "You cannot deactivate or demote your own account.");
  if (b.password !== undefined && String(b.password).length < 10) throw new HttpError(400, "The password must be at least 10 characters.");
  const s = sql();
  const [rows] = await s.transaction([
    s.query(
      `update app_users set
         name = coalesce($2, name), role = coalesce($3, role), active = coalesce($4, active),
         password_hash = case when $5::text is null then password_hash else crypt($5, gen_salt('bf', 10)) end
       where id = $1 returning id, email, name, role, active, last_login_at`,
      [id, b.name ? String(b.name).slice(0, 120) : null, b.role === "admin" || b.role === "staff" ? b.role : null, typeof b.active === "boolean" ? b.active : null, b.password !== undefined ? String(b.password) : null],
    ),
    s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'user.update', 'app_users', $2)`, [me.email, String(id)]),
  ]);
  if (!rows.length) throw new HttpError(404, "User not found.");
  return ok({ user: rows[0] });
});
