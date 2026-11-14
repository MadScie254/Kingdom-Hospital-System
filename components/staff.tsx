"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Mail, Pencil, Plus, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { loadAll, useDB } from "@/lib/store";
import { Avatar, Badge, Dialog, Drawer, Empty, Field, FormGrid, toast } from "./ui";
import { ROLES, ROLE_HINT, ROLE_LABEL, type Role } from "@/lib/access";
import { fmtDateTime } from "@/lib/format";

type U = { id: number; email: string; name: string; role: Role; active: boolean; status: "pending" | "active" | "declined"; departments: number[]; position: string | null; phone: string | null; licence: string | null; requestedRole: Role | null; requestedAt: string; lastLoginAt: string | null; mustChange: boolean };
const eat = (t: string | null) => (t ? fmtDateTime(new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 16)) : "Never");
const message = (e: unknown) => (e instanceof ApiError ? e.message : "Could not reach the server.");
type Sent = { user: U; emailed?: boolean; emailError?: string; tempPassword?: string };
type Report = (u: { name: string; email: string }, r: Sent, what: "approved" | "declined" | "reset" | "added") => void;

function Departments({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { departments } = useDB();
  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((d) => {
        const on = value.includes(d.id);
        return <button type="button" key={d.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== d.id) : [...value, d.id])} className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-brand bg-brand text-white" : "border-line bg-white text-text hover:border-[#c7ced6]")}>{d.name}</button>;
      })}
    </div>
  );
}

function Chips({ ids }: { ids: number[] }) {
  const { departments } = useDB();
  const names = ids.map((i) => departments.find((d) => d.id === i)?.name).filter(Boolean) as string[];
  if (!names.length) return <span className="text-xs text-muted">None yet</span>;
  return <div className="flex flex-wrap gap-1">{names.slice(0, 3).map((n) => <Badge key={n} tone="mute" plain>{n}</Badge>)}{names.length > 3 && <Badge tone="mute" plain>+{names.length - 3}</Badge>}</div>;
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <p className="mt-1 text-xs text-muted">{ROLE_HINT[value]}</p>
    </div>
  );
}

function RequestCard({ u, report }: { u: U; report: Report }) {
  const [role, setRole] = useState<Role>(u.requestedRole || "staff");
  const [deps, setDeps] = useState<number[]>(u.departments);
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, what: "approved" | "declined") => {
    setBusy(true);
    try { report(u, await api<Sent>(`/api/users/${u.id}`, { method: "PATCH", body }), what); } catch (e) { toast(message(e)); }
    setBusy(false);
  };
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={u.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{u.name}</div>
          <div className="text-[13px] text-muted [overflow-wrap:anywhere]">{u.email}{u.phone ? `, ${u.phone}` : ""}</div>
          <div className="mt-1 text-[13px]">{u.position}{u.licence ? `, licence ${u.licence}` : ""}</div>
          <div className="text-xs text-muted">Asked {eat(u.requestedAt)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Role"><RoleSelect value={role} onChange={setRole} /></Field>
        <div><span className="label">Departments</span><Departments value={deps} onChange={setDeps} /></div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-danger" disabled={busy} onClick={() => act({ status: "declined" }, "declined")}><X size={15} />Decline</button>
        <button className="btn btn-primary" disabled={busy || !deps.length} onClick={() => act({ status: "active", role, departments: deps }, "approved")}><Check size={15} />Approve</button>
      </div>
      <p className="mt-3 text-right text-xs text-muted">Approving emails {u.email} a temporary password. They choose their own when they first sign in.</p>
    </article>
  );
}

export function StaffManager({ selfId }: { selfId: number }) {
  const [users, setUsers] = useState<U[] | null>(null);
  const [edit, setEdit] = useState<U | null>(null);
  const [add, setAdd] = useState(false);
  const [reset, setReset] = useState<U | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" as Role, departments: [] as number[] });
  const [err, setErr] = useState("");
  const [mail, setMail] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [handover, setHandover] = useState<{ name: string; email: string; password: string; error?: string } | null>(null);

  const load = useCallback(async () => {
    try { setUsers((await api<{ users: U[] }>("/api/users")).users); } catch (e) { toast(message(e)); }
    api<{ configured: boolean }>("/api/mail").then((m) => setMail(m.configured)).catch(() => {});
    loadAll();
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (u: U, body: Record<string, unknown>, done: string) => {
    try { await api(`/api/users/${u.id}`, { method: "PATCH", body }); toast(done); load(); return true; } catch (e) { toast(message(e)); return false; }
  };
  const report: Report = (u, r, what) => {
    if (r.tempPassword) setHandover({ name: u.name, email: u.email, password: r.tempPassword, error: r.emailError });
    else {
      const base = what === "declined" ? `${u.name} was declined` : what === "reset" ? `New password set for ${u.name}` : what === "added" ? `${u.name} was added` : `${u.name} was approved`;
      toast(r.emailed === undefined ? base : r.emailed ? `${base}. Email sent to ${u.email}.` : `${base}. The email could not be sent.`);
    }
    load();
  };
  const create = async () => {
    setErr("");
    try {
      const r = await api<Sent>("/api/users", { method: "POST", body: form });
      setAdd(false);
      report({ name: form.name.trim(), email: form.email.trim().toLowerCase() }, r, "added");
      setForm({ name: "", email: "", role: "staff", departments: [] });
    } catch (e) { setErr(message(e)); }
  };
  const sendReset = async () => {
    if (!reset) return;
    setSending(true);
    try { report(reset, await api<Sent>(`/api/users/${reset.id}`, { method: "PATCH", body: { resetPassword: true } }), "reset"); setReset(null); } catch (e) { toast(message(e)); }
    setSending(false);
  };

  const pending = (users || []).filter((u) => u.status === "pending");
  const people = (users || []).filter((u) => u.status !== "pending");

  return (
    <div className="space-y-6">
      {mail === false && (
        <div className="flex items-start gap-3 rounded-lg border border-[#f1d8a8] bg-warn-50 px-4 py-3 text-[13px] leading-relaxed" role="status">
          <Mail size={16} className="mt-0.5 shrink-0 text-warn" />
          <div><strong className="font-semibold">Email is not set up yet.</strong> People you approve will not be told. You will be shown their temporary password so you can pass it on yourself. <Link href="/settings" className="font-medium text-brand hover:underline">Set up email in Settings</Link></div>
        </div>
      )}
      <section className="card">
        <div className="card-head"><div><h2 className="card-title">Access requests</h2><p className="text-xs text-muted">People who asked to join. Confirm their role and departments, then approve.</p></div>{pending.length > 0 && <Badge tone="bad" plain>{pending.length} waiting</Badge>}</div>
        <div className="space-y-3 p-4">
          {users === null && <p className="px-2 py-6 text-center text-[13px] text-muted">Loading</p>}
          {pending.map((u) => <RequestCard key={u.id} u={u} report={report} />)}
          {users !== null && pending.length === 0 && <Empty title="No requests waiting" hint="When someone asks for access from the sign in page, they appear here and the bell shows a number." />}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2 className="card-title">Accounts</h2><p className="text-xs text-muted">Everyone who can sign in, with their role and departments.</p></div><button className="btn btn-primary" onClick={() => { setForm({ name: "", email: "", role: "staff", departments: [] }); setErr(""); setAdd(true); }}><Plus size={15} />Add account</button></div>
        <div className="scroll-thin overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Person</th><th>Role</th><th>Departments</th><th>Last sign in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={u.name} size={30} /><div className="leading-tight"><div className="font-medium">{u.name}</div><div className="text-xs text-muted [overflow-wrap:anywhere]">{u.email}</div></div></div></td>
                  <td className="whitespace-nowrap">{ROLE_LABEL[u.role]}</td>
                  <td><Chips ids={u.departments} /></td>
                  <td className="whitespace-nowrap text-muted">{eat(u.lastLoginAt)}</td>
                  <td>{u.status === "declined" ? <Badge tone="bad">Declined</Badge> : !u.active ? <Badge tone="mute">Switched off</Badge> : u.mustChange ? <Badge tone="warn">New password due</Badge> : <Badge tone="ok">Active</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Edit ${u.name}`} onClick={() => setEdit({ ...u })}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Reset password for ${u.name}`} onClick={() => setReset(u)}><KeyRound size={14} /></button>
                    {u.id !== selfId && (u.status === "declined"
                      ? <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { status: "pending" }, "Moved back to requests")}>Reconsider</button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { active: !u.active }, u.active ? "Account switched off" : "Account switched on")}>{u.active ? "Switch off" : "Switch on"}</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.name ?? ""}`} subtitle="Changes apply the next time they open the app."
        footer={<><button className="btn btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={async () => { if (edit && await patch(edit, { name: edit.name, position: edit.position, phone: edit.phone, role: edit.id === selfId ? undefined : edit.role, departments: edit.departments }, "Account updated")) setEdit(null); }}>Save changes</button></>}>
        {edit && (
          <FormGrid>
            <Field label="Full name" span={2}><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Position"><input className="input" value={edit.position ?? ""} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Role" span={2}>{edit.id === selfId ? <p className="text-[13px] text-muted">Your own role cannot be changed here.</p> : <RoleSelect value={edit.role} onChange={(role) => setEdit({ ...edit, role })} />}</Field>
            <div className="sm:col-span-2"><span className="label">Departments</span><Departments value={edit.departments} onChange={(departments) => setEdit({ ...edit, departments })} /></div>
          </FormGrid>
        )}
      </Drawer>

      <Drawer open={add} onClose={() => setAdd(false)} title="Add an account" subtitle="A temporary password is emailed to them. They choose their own when they first sign in."
        footer={<><button className="btn btn-secondary" onClick={() => setAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Create account</button></>}>
        <FormGrid>
          <Field label="Full name" required span={2}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required span={2}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role" span={2}><RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} /></Field>
          <div className="sm:col-span-2"><span className="label">Departments</span><Departments value={form.departments} onChange={(departments) => setForm({ ...form, departments })} /></div>
        </FormGrid>
        {err && <p className="mt-4 text-[13px] text-bad" role="alert">{err}</p>}
      </Drawer>

      <Dialog open={!!reset} onClose={() => setReset(null)} title={`Reset password for ${reset?.name ?? ""}`}
        footer={<><button className="btn btn-secondary" onClick={() => setReset(null)}>Cancel</button><button className="btn btn-primary" disabled={sending} onClick={sendReset}>{sending ? "Sending" : "Email a new password"}</button></>}>
        <p className="mt-3 text-[13px] text-text">A new temporary password is emailed to {reset?.email}. The old password stops working now, and they choose their own at next sign in.</p>
      </Dialog>

      <Dialog open={!!handover} onClose={() => setHandover(null)} title="Give this password to the person"
        footer={<button className="btn btn-primary" onClick={() => setHandover(null)}>Done</button>}>
        {handover && (
          <div className="mt-3 space-y-3 text-text">
            <p className="text-[13px] leading-relaxed">{handover.error === "Email is not set up yet." ? "Email is not set up yet, so nothing was sent." : `The email to ${handover.email} could not be sent.`} Pass this temporary password to {handover.name} yourself. They choose their own when they sign in. It is shown only once.</p>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3">
              <code className="text-lg tracking-wide [overflow-wrap:anywhere]">{handover.password}</code>
              <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(handover.password); toast("Copied"); } catch { toast("Could not copy. Select it and copy by hand."); } }}><Copy size={14} />Copy</button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
