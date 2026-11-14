"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { db, useDB } from "@/lib/store";
import { Field, PageHeader, toast } from "@/components/ui";
import { ANCHOR } from "@/lib/format";

const COND: Record<string, { fill: string; stroke: string; text: string }> = {
  Healthy: { fill: "#ffffff", stroke: "#b8c0c9", text: "#18222b" },
  Caries: { fill: "#f6c9c5", stroke: "#b42318", text: "#7a1a12" },
  Filled: { fill: "#cfe0f2", stroke: "#2a6fae", text: "#1f5384" },
  Crown: { fill: "#f1dfae", stroke: "#b58a2b", text: "#6b5014" },
  "Root canal": { fill: "#cfe9e6", stroke: "#0f766e", text: "#0b4f49" },
  Impacted: { fill: "#fbe3bd", stroke: "#a35a06", text: "#6d3c04" },
  Missing: { fill: "#eef0f2", stroke: "#a5aeb8", text: "#68737d" },
  Extracted: { fill: "#d9dde2", stroke: "#59646e", text: "#3f4a55" },
};
const UR = [18, 17, 16, 15, 14, 13, 12, 11], UL = [21, 22, 23, 24, 25, 26, 27, 28], LR = [48, 47, 46, 45, 44, 43, 42, 41], LL = [31, 32, 33, 34, 35, 36, 37, 38];

function Tooth({ n, cond, sel, onClick }: { n: number; cond: string; sel: boolean; onClick: () => void }) {
  const c = COND[cond || "Healthy"];
  const molar = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(n);
  return (
    <button type="button" onClick={onClick} aria-pressed={sel} aria-label={`Tooth ${n}, ${cond || "Healthy"}`} className="group flex flex-col items-center gap-1">
      <svg width={molar ? 34 : 28} height="38" viewBox="0 0 34 38" className={clsx("transition-transform group-hover:-translate-y-0.5", sel && "drop-shadow")}>
        <path d="M5 8c0-4 4-6 12-6s12 2 12 6c0 6-1 9-2 15-1 6-2 13-5 13-2 0-2-6-5-6s-3 6-5 6c-3 0-4-7-5-13-1-6-2-9-2-15Z" fill={c.fill} stroke={sel ? "#18222b" : c.stroke} strokeWidth={sel ? 2.4 : 1.4} strokeDasharray={cond === "Missing" ? "3 2" : undefined} />
        {cond === "Extracted" && <path d="M9 10l16 16M25 10 9 26" stroke="#59646e" strokeWidth="2" />}
      </svg>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: sel ? "#2a6fae" : c.text }}>{n}</span>
    </button>
  );
}

export default function NewDental() {
  const d = useDB();
  const router = useRouter();
  const [editId, setEditId] = useState<number | null>(null);
  const [v, setV] = useState<Record<string, any>>({ patientId: "", doctorId: "", date: `${ANCHOR}T09:00`, complaint: "", history: "", dentalHistory: "", status: "Draft", nextAppointment: "", plan: "" });
  const [teeth, setTeeth] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<number[]>([]);
  const [multi, setMulti] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }));

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    const r = id && db.get().dental.find((x) => x.id === id);
    if (r) { setEditId(r.id); setV({ ...r, patientId: String(r.patientId), doctorId: String(r.doctorId) }); setTeeth(r.teeth || {}); }
  }, []);

  const toggle = (n: number) => setSel((s) => (multi ? (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]) : s.includes(n) && s.length === 1 ? [] : [n]));
  const apply = (c: string) => { if (!sel.length) return; setTeeth((t) => { const o = { ...t }; sel.forEach((n) => { if (c === "Healthy") delete o[n]; else o[n] = c; }); return o; }); };
  const save = async () => {
    if (!v.patientId || !v.doctorId || !v.complaint) { setErr("Choose a patient and dentist, and enter the chief complaint."); return; }
    const row = { ...v, patientId: Number(v.patientId), doctorId: Number(v.doctorId), teeth };
    const saved = editId ? await db.update("dental", editId, row) : await db.add("dental", row);
    if (!saved) return;
    toast(editId ? "Examination updated" : "Examination saved");
    router.push("/dental");
  };
  const charted = Object.entries(teeth);
  const row = (list: number[]) => <div className="flex justify-center gap-1.5">{list.map((n) => <Tooth key={n} n={n} cond={teeth[n]} sel={sel.includes(n)} onClick={() => toggle(n)} />)}</div>;

  return (
    <div>
      <PageHeader title={editId ? "Dental examination" : "New dental examination"} crumbs={[{ label: "Dental", href: "/dental" }, { label: editId ? "Examination" : "New examination" }]} description="Chart each tooth on the odontogram using FDI numbering. Select teeth, then choose a condition." />
      <div className="grid items-start gap-5 xl:grid-cols-[400px_1fr]">
        <div className="min-w-0 space-y-5">
          <section className="card card-pad space-y-4">
            <h2 className="card-title">Patient and dentist</h2>
            <Field label="Patient" required><select className="input" value={v.patientId} onChange={(e) => set("patientId", e.target.value)}><option value="">Select patient</option>{d.patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></Field>
            <Field label="Dentist" required><select className="input" value={v.doctorId} onChange={(e) => set("doctorId", e.target.value)}><option value="">Select dentist</option>{d.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Examination time"><input className="input" type="datetime-local" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
          </section>
          <section className="card card-pad space-y-4">
            <h2 className="card-title">Clinical information</h2>
            <Field label="Chief complaint" required><textarea className="input" rows={2} value={v.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="Reason for the visit" /></Field>
            <Field label="Medical history"><textarea className="input" rows={2} value={v.history} onChange={(e) => set("history", e.target.value)} placeholder="Conditions, medication, allergies" /></Field>
            <Field label="Dental history"><textarea className="input" rows={2} value={v.dentalHistory || ""} onChange={(e) => set("dentalHistory", e.target.value)} placeholder="Previous treatment, oral hygiene habits" /></Field>
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <section className="card">
            <div className="card-head"><h2 className="card-title">Odontogram</h2><div className="flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#2a6fae]" checked={multi} onChange={(e) => { setMulti(e.target.checked); if (!e.target.checked) setSel(sel.slice(0, 1)); }} />Select several teeth</label><button className="btn btn-secondary btn-sm" onClick={() => { setTeeth({}); setSel([]); }}>Reset chart</button></div></div>
            <div className="scroll-thin overflow-x-auto p-5">
              <div className="mx-auto min-w-[620px] max-w-[720px]">
                <div className="mb-1 grid grid-cols-2 text-center text-xs text-muted"><span>Upper right</span><span>Upper left</span></div>
                <div className="grid grid-cols-2 gap-6 border-b border-dashed border-line pb-4">{row(UR)}{row(UL)}</div>
                <div className="grid grid-cols-2 gap-6 pt-4">{row(LR)}{row(LL)}</div>
                <div className="mt-1 grid grid-cols-2 text-center text-xs text-muted"><span>Lower right</span><span>Lower left</span></div>
              </div>
            </div>
            <div className="border-t border-line-2 p-4">
              <div className="mb-2 text-xs text-muted">{sel.length ? `Apply to ${sel.length === 1 ? `tooth ${sel[0]}` : `${sel.length} teeth`}` : "Select a tooth to set its condition"}</div>
              <div className="flex flex-wrap gap-2">{Object.keys(COND).map((c) => <button key={c} type="button" disabled={!sel.length} onClick={() => apply(c)} className="btn btn-secondary btn-sm gap-2"><span className="h-3 w-3 rounded-sm border" style={{ background: COND[c].fill, borderColor: COND[c].stroke }} />{c}</button>)}</div>
            </div>
          </section>
          <section className="card card-pad">
            <h2 className="card-title mb-3">Charted findings</h2>
            {charted.length === 0 ? <p className="text-[13px] text-muted">No abnormal teeth charted yet. Teeth without an entry are recorded as healthy.</p> : <ul className="grid gap-2 sm:grid-cols-2">{charted.sort().map(([n, c]) => <li key={n} className="flex items-center justify-between rounded-md border border-line-2 px-3 py-2 text-[13px]"><span>Tooth {n}</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COND[c].stroke }} />{c}</span></li>)}</ul>}
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <Field label="Treatment plan" span={2}><textarea className="input" rows={2} value={v.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Planned procedures" /></Field>
            <Field label="Status"><select className="input" value={v.status} onChange={(e) => set("status", e.target.value)}>{["Draft", "Follow up required", "Completed"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Next appointment"><input className="input" type="datetime-local" value={v.nextAppointment} onChange={(e) => set("nextAppointment", e.target.value)} /></Field>
          </section>
          {err && <p className="text-[13px] text-bad" role="alert">{err}</p>}
          <div className="flex justify-end gap-2.5"><button className="btn btn-secondary h-10" onClick={() => router.back()}>Cancel</button><button className="btn btn-primary h-10 px-6" onClick={save}>{editId ? "Save changes" : "Save examination"}</button></div>
        </div>
      </div>
    </div>
  );
}
