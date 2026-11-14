"use client";
import { useState } from "react";
import { Database, Download, RotateCcw } from "lucide-react";
import { db, useDB } from "@/lib/store";
import { Dialog, Field, PageHeader, toast } from "@/components/ui";
import { download } from "@/lib/format";

const GROUPS: { title: string; hint: string; fields: [string, string, string?][] }[] = [
  { title: "Hospital profile", hint: "Shown on invoices, lab reports and prescriptions.", fields: [["name", "Hospital name"], ["tagline", "Tagline"], ["address", "Address"], ["phone", "Phone"], ["email", "Hospital email", "email"], ["registration", "Registration and licence"]] },
  { title: "Tax and facility", hint: "Used on invoices and SHA claims.", fields: [["kra", "KRA PIN"], ["facilityCode", "Facility code"], ["vat", "Default VAT (%)", "number"], ["discount", "Default discount (%)", "number"]] },
  { title: "Payment instructions", hint: "Printed under How to pay on every invoice.", fields: [["mpesaPaybill", "M Pesa Paybill number"], ["mpesaAccount", "M Pesa account label"], ["bank", "Bank account details"], ["footer", "Document footer message"]] },
];

export default function Settings() {
  const d = useDB();
  const [v, setV] = useState<Record<string, any>>(d.settings[0]);
  const [reset, setReset] = useState(false);
  const save = () => { db.update("settings", 1, { ...v, vat: Number(v.vat), discount: Number(v.discount) }); toast("Settings saved"); };
  return (
    <div>
      <PageHeader title="Settings" description="Hospital details, payment instructions and data tools." actions={<button className="btn btn-primary" onClick={save}>Save settings</button>} />
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <section key={g.title} className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
            <div><h2 className="card-title">{g.title}</h2><p className="mt-1 text-[13px] text-muted">{g.hint}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">{g.fields.map(([k, l, t]) => <Field key={k} label={l}><input className="input" type={t || "text"} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}</div>
          </section>
        ))}
        <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
          <div><h2 className="card-title">Data</h2><p className="mt-1 text-[13px] text-muted">This demonstration keeps records in the browser. Export a copy before clearing anything.</p></div>
          <div className="flex flex-wrap gap-3"><button className="btn btn-secondary" onClick={() => download("kingdom_hospital_backup.json", JSON.stringify(db.get(), null, 2), "application/json")}><Download size={15} />Export all data</button><button className="btn btn-danger" onClick={() => setReset(true)}><RotateCcw size={15} />Reset to sample data</button><span className="flex items-center gap-2 text-xs text-muted"><Database size={14} />{Object.values(d).reduce((a, l) => a + l.length, 0)} records stored</span></div>
        </section>
      </div>
      <Dialog open={reset} onClose={() => setReset(false)} title="Reset to sample data?" footer={<><button className="btn btn-secondary" onClick={() => setReset(false)}>Keep my data</button><button className="btn btn-primary !border-bad !bg-bad" onClick={() => { db.reset(); setReset(false); toast("Sample data restored"); }}>Reset data</button></>}>Every record you added or changed in this browser is replaced by the sample hospital data. Export first if you need a copy.</Dialog>
    </div>
  );
}
