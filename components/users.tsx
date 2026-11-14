"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge, Dialog, Drawer, Field, FormGrid, toast } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

type U = { id: number; email: string; name: string; role: "admin" | "staff"; active: boolean; last_login_at: string | null };
const when = (t: string | null) => (t ? fmtDateTime(new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 16)) : "Never");
const message = (e: unknown) => (e instanceof ApiError ? e.message : "Could not reach the server.");

export function StaffAccounts({ selfId }: { selfId: number }) {
  const [users, setUsers] = useState<U[]>([]);
  const [add, setAdd] = useState(false);
  const [reset, setReset] = useState<U | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "" });
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => { try { setUsers((await api<{ users: U[] }>("/api/users")).users); } catch (e) { toast(message(e)); } }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (u: U, body: Record<string, unknown>, done: string) => {
    try { await api(`/api/users/${u.id}`, { method: "PATCH", body }); toast(done); load(); } catch (e) { toast(message(e)); }
  };
  const create = async () => {
    setErr("");
    try { await api("/api/users", { method: "POST", body: form }); toast(`${form.name} can now sign in`); setAdd(false); setForm({ name: "", email: "", role: "staff", password: "" }); load(); }
    catch (e) { setErr(message(e)); }
  };

  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="card-title">Staff accounts</h2>
        <p className="mt-1 text-[13px] text-muted">Everyone signs in with their own account so every change is logged against a name. Administrators can manage settings, catalogues, staff and deletions.</p>
        <button className="btn btn-primary mt-4" onClick={() => setAdd(true)}><Plus size={15} />Add account</button>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Last sign in</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td>
                <td><select className="input h-8 w-auto" value={u.role} disabled={u.id === selfId} aria-label={`Role for ${u.name}`} onChange={(e) => patch(u, { role: e.target.value }, "Role updated")}><option value="staff">Staff</option><option value="admin">Administrator</option></select></td>
                <td className="whitespace-nowrap text-muted">{when(u.last_login_at)}</td>
                <td><Badge tone={u.active ? "ok" : "mute"}>{u.active ? "Active" : "Inactive"}</Badge></td>
                <td className="whitespace-nowrap text-right">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setReset(u); setPw(""); setErr(""); }}><KeyRound size={14} />Reset password</button>
                  {u.id !== selfId && <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { active: !u.active }, u.active ? "Account deactivated" : "Account reactivated")}>{u.active ? "Deactivate" : "Reactivate"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={add} onClose={() => setAdd(false)} title="Add staff account" subtitle="Share the password privately. They can change it after signing in."
        footer={<><button className="btn btn-secondary" onClick={() => setAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Create account</button></>}>
        <FormGrid>
          <Field label="Full name" required span={2}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required span={2}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Administrator</option></select></Field>
          <Field label="Starting password" required hint="At least 10 characters"><input className="input" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </FormGrid>
        {err && <p className="mt-4 text-[13px] text-bad" role="alert">{err}</p>}
      </Drawer>

      <Dialog open={!!reset} onClose={() => setReset(null)} title={`Reset password for ${reset?.name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setReset(null)}>Cancel</button><button className="btn btn-primary" onClick={async () => { if (reset) { await patch(reset, { password: pw }, "Password reset"); if (pw.length >= 10) setReset(null); } }}>Save password</button></>}>
        <div className="mt-3 text-text"><Field label="New password" hint="At least 10 characters"><input className="input" type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></Field></div>
      </Dialog>
    </section>
  );
}
