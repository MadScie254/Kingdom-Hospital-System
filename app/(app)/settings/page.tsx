"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { db, useDB, useUser } from "@/lib/store";
import { Field, PageHeader, toast } from "@/components/ui";
import { StaffAccounts } from "@/components/users";
import { download } from "@/lib/format";

const GROUPS: { title: string; hint: string; fields: [string, string, string?][] }[] = [
  { title: "Hospital profile", hint: "Shown on invoices, lab reports and prescriptions.", fields: [["name", "Hospital name"], ["tagline", "Tagline"], ["address", "Address"], ["phone", "Phone"], ["email", "Hospital email", "email"], ["registration", "Registration and licence"]] },
  { title: "Tax and facility", hint: "Used on invoices and SHA claims. Left blank until you enter them.", fields: [["kra", "KRA PIN"], ["facilityCode", "Facility code"], ["vat", "Default VAT (%)", "number"], ["discount", "Default discount (%)", "number"]] },
  { title: "Payment instructions", hint: "Printed under How to pay on every invoice once filled in.", fields: [["mpesaPaybill", "M Pesa Paybill number"], ["mpesaAccount", "M Pesa account label"], ["bank", "Bank account details"], ["footer", "Document footer message"]] },
];

export default function Settings() {
  const d = useDB();
  const user = useUser();
  const admin = user?.role === "admin";
  const [v, setV] = useState<Record<string, any>>(d.settings[0] || {});
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwErr, setPwErr] = useState("");

  const save = async () => {
    if (!(await db.update("settings", d.settings[0].id, { ...v, vat: Number(v.vat) || 0, discount: Number(v.discount) || 0 }))) return;
    toast("Settings saved");
  };
  const changePassword = async () => {
    setPwErr("");
    if (pw.next !== pw.again) { setPwErr("The new passwords do not match."); return; }
    try { await api("/api/me/password", { method: "POST", body: { current: pw.current, next: pw.next } }); toast("Password changed"); setPw({ current: "", next: "", again: "" }); }
    catch (e) { setPwErr(e instanceof ApiError ? e.message : "Could not reach the server."); }
  };

  return (
    <div>
      <PageHeader title="Settings" description={admin ? "Hospital details, payment instructions, staff accounts and data tools." : "Your account. Hospital settings can only be changed by an administrator."}
        actions={admin && <button className="btn btn-primary" onClick={save}>Save settings</button>} />
      <div className="space-y-5">
        {admin && GROUPS.map((g) => (
          <section key={g.title} className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
            <div><h2 className="card-title">{g.title}</h2><p className="mt-1 text-[13px] text-muted">{g.hint}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">{g.fields.map(([k, l, t]) => <Field key={k} label={l}><input className="input" type={t || "text"} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}</div>
          </section>
        ))}
        {admin && user && <StaffAccounts selfId={user.id} />}
        <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
          <div><h2 className="card-title">Change my password</h2><p className="mt-1 text-[13px] text-muted">Use at least 10 characters. Do not share it.</p></div>
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Field label="Current password" span={2}><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Repeat new password"><input className="input" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
            {pwErr && <p className="text-[13px] text-bad sm:col-span-2" role="alert">{pwErr}</p>}
            <div className="sm:col-span-2"><button className="btn btn-primary" onClick={changePassword}>Change password</button></div>
          </div>
        </section>
        {admin && (
          <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
            <div><h2 className="card-title">Data</h2><p className="mt-1 text-[13px] text-muted">Records are stored in the hospital database. Download a copy at any time.</p></div>
            <div><button className="btn btn-secondary" onClick={() => download("kingdom_hospital_backup.json", JSON.stringify(db.get(), null, 2), "application/json")}><Download size={15} />Export all data</button></div>
          </section>
        )}
      </div>
    </div>
  );
}
