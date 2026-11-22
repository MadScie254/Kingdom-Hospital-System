"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { db, useDB } from "@/lib/store";
import type { Row } from "@/lib/seed";
import { ANCHOR } from "@/lib/format";
import { Drawer, Field, FormGrid, toast } from "./ui";

export function PrescriptionActions({ row }: { row: Row }) {
  return <Link href={`/prescriptions/${row.id}`} className="btn btn-ghost btn-sm btn-icon" aria-label="Print prescription"><Printer size={15} /></Link>;
}

export function PrescriptionForm({ onClose, initial }: { open: boolean; onClose: () => void; initial: Row | null }) {
  const d = useDB();
  const [patientId, setPatientId] = useState<string>(initial ? String(initial.patientId) : "");
  const [doctorId, setDoctorId] = useState<string>(initial ? String(initial.doctorId) : "");
  const [date, setDate] = useState(initial?.date ?? ANCHOR);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<any[]>(initial?.items ?? [{ medicine: "", dose: "1 tablet", frequency: "Twice daily", days: 5 }]);
  const [err, setErr] = useState("");
  const setItem = (i: number, p: object) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const save = async () => {
    const valid = items.filter((i) => i.medicine);
    if (!patientId || !doctorId || !valid.length) { setErr("Choose a patient, a doctor and at least one medicine."); return; }
    const row = { patientId: Number(patientId), doctorId: Number(doctorId), date, notes, items: valid.map((i) => ({ ...i, days: Number(i.days) })) };
    const saved = initial ? await db.update("prescriptions", initial.id, row) : await db.add("prescriptions", row);
    if (!saved) return;
    toast("Prescription saved");
    onClose();
  };

  return (
    <Drawer open onClose={onClose} title={initial ? "Edit prescription" : "New prescription"} subtitle="Medicines are checked against the pharmacy formulary." width={640}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save prescription</button></>}>
      <FormGrid>
        <Field label="Patient" required><select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Select patient</option>{d.patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></Field>
        <Field label="Prescribing doctor" required><select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">Select doctor</option>{d.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </FormGrid>
      <div className="mb-2 mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold">Medicines</h3><button className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { medicine: "", dose: "1 tablet", frequency: "Twice daily", days: 5 }])}><Plus size={14} />Add medicine</button></div>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Medicine</label><select className="input" value={it.medicine} onChange={(e) => setItem(i, { medicine: e.target.value })}><option value="">Select medicine</option>{d.medicines.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}</select></div>
              <div><label className="label">Dose</label><input className="input" value={it.dose} onChange={(e) => setItem(i, { dose: e.target.value })} /></div>
              <div><label className="label">Frequency</label><select className="input" value={it.frequency} onChange={(e) => setItem(i, { frequency: e.target.value })}>{["Once daily", "Twice daily", "Three times daily", "Every 8 hours", "Once daily at night", "When needed"].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div><label className="label">Days</label><input type="number" min={1} className="input" value={it.days} onChange={(e) => setItem(i, { days: e.target.value })} /></div>
              <div className="flex items-end justify-end">{items.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 size={14} />Remove</button>}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5"><Field label="Notes to patient"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
      {err && <p className="mt-3 text-[13px] text-bad" role="alert">{err}</p>}
    </Drawer>
  );
}
