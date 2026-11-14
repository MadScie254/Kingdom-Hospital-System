"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRightLeft, BedDouble, ClipboardList, LogOut, Sparkles, Wrench } from "lucide-react";
import clsx from "clsx";
import { db, useDB, useLookup } from "@/lib/store";
import { Drawer, Field, PageHeader, Stat, Tabs, toast } from "@/components/ui";
import { ANCHOR, addDays, daysBetween, fmtDateTime, initials, kes, nowISO } from "@/lib/format";
import { nextInvoiceNo } from "@/lib/billing";
import type { Row } from "@/lib/seed";

const STATUS: Record<string, { tile: string; strip: string; label: string }> = {
  Available: { tile: "bg-white hover:border-ok", strip: "#15803d", label: "Free" },
  Occupied: { tile: "bg-brand-50 border-brand-100 hover:border-brand", strip: "#1b4f9c", label: "" },
  Cleaning: { tile: "bg-warn-50 border-[#f1d8a8] hover:border-warn", strip: "#a35a06", label: "Cleaning" },
  Reserved: { tile: "bg-teal-50 border-[#bfe0db] hover:border-teal", strip: "#0f766e", label: "Reserved" },
  Maintenance: { tile: "bg-[#eef0f4] hover:border-muted", strip: "#8794ab", label: "Repair" },
};

function BedTile({ bed, name, onClick }: { bed: Row; name: string; onClick: () => void }) {
  const s = STATUS[bed.status];
  return (
    <button onClick={onClick} aria-label={`Bed ${bed.code}, ${bed.status}${name ? `, ${name}` : ""}`} className={clsx("group relative flex h-[62px] flex-col items-start justify-center overflow-hidden rounded-lg border border-line pl-4 pr-2 text-left transition-colors", s.tile)}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: s.strip }} />
      <span className="text-[13px] font-semibold tabular-nums">{bed.code}</span>
      <span className="max-w-full truncate text-[11.5px] text-muted">{bed.status === "Occupied" ? name : s.label}</span>
      {bed.status === "Occupied" && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-semibold text-brand ring-1 ring-brand-100">{initials(name)}</span>}
    </button>
  );
}

function BedPanel({ bed, onClose }: { bed: Row; onClose: () => void }) {
  const d = useDB();
  const L = useLookup();
  const adm = d.admissions.find((a) => a.bedId === bed.id && a.status === "Admitted");
  const [patientId, setP] = useState(""), [doctorId, setD] = useState(""), [dx, setDx] = useState("");
  const [moveTo, setMove] = useState("");
  const admittedIds = new Set(d.admissions.filter((a) => a.status === "Admitted").map((a) => a.patientId));
  const free = d.beds.filter((b) => b.status === "Available" && b.id !== bed.id);
  const days = adm ? Math.max(1, daysBetween(adm.admittedAt, ANCHOR)) : 0;

  const admit = () => {
    if (!patientId || !doctorId) return;
    db.add("admissions", { bedId: bed.id, patientId: Number(patientId), doctorId: Number(doctorId), admittedAt: nowISO(), dischargedAt: "", diagnosis: dx || "Under assessment", status: "Admitted", due: 0 });
    db.update("beds", bed.id, { status: "Occupied", patientId: Number(patientId) });
    toast(`${L.patientName(Number(patientId))} admitted to ${bed.code}`); onClose();
  };
  const discharge = () => {
    if (!adm) return;
    const no = nextInvoiceNo(d.invoices);
    db.add("invoices", { no, patientId: adm.patientId, doctorId: adm.doctorId, date: ANCHOR, dueDate: addDays(ANCHOR, 14), items: [{ description: `Bed charges, ${bed.ward}, ${days} ${days === 1 ? "day" : "days"}`, qty: days, price: bed.price }], discountPct: 0, vatPct: 0, paid: 0, status: "Due", source: "Inpatient", method: "SHA", note: `Admission ${adm.diagnosis}` });
    db.update("admissions", adm.id, { status: "Discharged", dischargedAt: nowISO() });
    db.update("beds", bed.id, { status: "Cleaning", patientId: null });
    toast(`Discharged. Invoice ${no} created for ${kes(days * bed.price, 0)}`); onClose();
  };
  const transfer = () => {
    if (!adm || !moveTo) return;
    db.update("admissions", adm.id, { bedId: Number(moveTo) });
    db.update("beds", Number(moveTo), { status: "Occupied", patientId: adm.patientId });
    db.update("beds", bed.id, { status: "Cleaning", patientId: null });
    toast("Patient transferred"); onClose();
  };
  const setStatus = (status: string) => { db.update("beds", bed.id, { status }); toast(`Bed ${bed.code} marked ${status.toLowerCase()}`); onClose(); };

  return (
    <Drawer open onClose={onClose} title={`Bed ${bed.code}`} subtitle={`${bed.ward}, ${bed.floor}, ${kes(bed.price, 0)} per day`}
      footer={adm ? <><button className="btn btn-secondary" onClick={transfer} disabled={!moveTo}><ArrowRightLeft size={15} />Transfer</button><button className="btn btn-primary" onClick={discharge}><LogOut size={15} />Discharge and bill</button></> : bed.status === "Available" ? <><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={admit} disabled={!patientId || !doctorId}>Admit patient</button></> : <button className="btn btn-primary" onClick={() => setStatus("Available")}>Mark as available</button>}>
      {adm ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-brand-50 p-4"><Link href={`/patients/${adm.patientId}`} className="text-base font-semibold text-brand hover:underline">{L.patientName(adm.patientId)}</Link><div className="mt-0.5 text-[13px] text-muted">{L.patient(adm.patientId)?.mrn}</div></div>
          <dl className="kv"><dt>Diagnosis</dt><dd>{adm.diagnosis}</dd><dt>Doctor</dt><dd>{L.doctorName(adm.doctorId)}</dd><dt>Admitted</dt><dd>{fmtDateTime(adm.admittedAt)}</dd><dt>Length of stay</dt><dd>{days} {days === 1 ? "day" : "days"}</dd><dt>Bed charges so far</dt><dd className="font-semibold">{kes(days * bed.price, 0)}</dd></dl>
          <Field label="Transfer to another bed"><select className="input" value={moveTo} onChange={(e) => setMove(e.target.value)}><option value="">Select an available bed</option>{free.map((b) => <option key={b.id} value={b.id}>{b.code}, {b.ward}, {kes(b.price, 0)} per day</option>)}</select></Field>
          <p className="text-xs text-muted">Discharging creates an inpatient invoice for the bed charges and sends the bed to cleaning.</p>
        </div>
      ) : bed.status === "Available" ? (
        <div className="space-y-4">
          <Field label="Patient" required><select className="input" value={patientId} onChange={(e) => setP(e.target.value)}><option value="">Select patient</option>{d.patients.filter((p) => !admittedIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></Field>
          <Field label="Admitting doctor" required><select className="input" value={doctorId} onChange={(e) => setD(e.target.value)}><option value="">Select doctor</option>{d.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Reason for admission"><textarea className="input" rows={3} value={dx} onChange={(e) => setDx(e.target.value)} placeholder="Working diagnosis" /></Field>
        </div>
      ) : (
        <div className="space-y-3 text-[13px]"><p>This bed is {bed.status.toLowerCase()} and cannot take a patient until it is marked available.</p><div className="flex gap-2">{["Cleaning", "Reserved", "Maintenance"].filter((s) => s !== bed.status).map((s) => <button key={s} className="btn btn-secondary btn-sm" onClick={() => setStatus(s)}>Mark as {s.toLowerCase()}</button>)}</div></div>
      )}
    </Drawer>
  );
}

export default function BedBoard() {
  const d = useDB();
  const L = useLookup();
  const [floor, setFloor] = useState("All floors");
  const [sel, setSel] = useState<Row | null>(null);
  const floors = ["Ground floor", "First floor", "Second floor"];
  const wardsOn = (f: string) => [...new Set(d.beds.filter((b) => b.floor === f).map((b) => b.ward))];
  const occ = d.beds.filter((b) => b.status === "Occupied").length;
  const count = (s: string) => d.beds.filter((b) => b.status === s).length;

  return (
    <div>
      <PageHeader title="Bed board" description="Live floor plan of every ward. Select a bed to admit, transfer or discharge a patient."
        actions={<Link href="/admissions/register" className="btn btn-secondary"><ClipboardList size={16} />Admission register</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Occupancy" value={`${Math.round((occ / d.beds.length) * 100)}%`} hint={`${occ} of ${d.beds.length} beds`} icon={BedDouble} tone="brand" />
        <Stat label="Available now" value={count("Available")} hint="Ready for admission" icon={BedDouble} tone="ok" />
        <Stat label="Cleaning or reserved" value={count("Cleaning") + count("Reserved")} icon={Sparkles} tone="warn" />
        <Stat label="Under repair" value={count("Maintenance")} icon={Wrench} tone="mute" />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={floor} onChange={setFloor} tabs={["All floors", ...floors].map((f) => ({ value: f, label: f }))} />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">{Object.entries(STATUS).map(([k, v]) => <li key={k} className="flex items-center gap-1.5"><span className="h-3 w-1.5 rounded-sm" style={{ background: v.strip }} />{k}</li>)}</ul>
      </div>
      <div className="space-y-5">
        {floors.filter((f) => floor === "All floors" || floor === f).map((f) => (
          <section key={f} className="card overflow-hidden">
            <div className="card-head bg-[#f7f9fc]"><h2 className="card-title">{f}</h2><span className="text-xs text-muted">{d.beds.filter((b) => b.floor === f && b.status === "Occupied").length} of {d.beds.filter((b) => b.floor === f).length} beds occupied</span></div>
            <div className="grid gap-px bg-line-2 lg:grid-cols-2">
              {wardsOn(f).map((w) => {
                const beds = d.beds.filter((b) => b.ward === w);
                return (
                  <div key={w} className="bg-white p-5">
                    <div className="mb-3 flex items-baseline justify-between"><h3 className="text-sm font-semibold">{w}</h3><span className="text-xs text-muted">{beds.filter((b) => b.status === "Occupied").length} of {beds.length} occupied, {kes(beds[0].price, 0)} per day</span></div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">{beds.map((b) => <BedTile key={b.id} bed={b} name={b.patientId ? L.patientName(b.patientId) : ""} onClick={() => setSel(b)} />)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {sel && <BedPanel key={sel.id + sel.status} bed={d.beds.find((b) => b.id === sel.id) || sel} onClose={() => setSel(null)} />}
    </div>
  );
}
