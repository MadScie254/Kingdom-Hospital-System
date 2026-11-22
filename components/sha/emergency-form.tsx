"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Siren } from "lucide-react";
import { BROUGHT_BY, ID_TYPES, MODES_OF_ARRIVAL } from "@/lib/hie/types";
import { useDB } from "@/lib/store";
import { nowISO } from "@/lib/format";
import { Badge, Field, toast } from "@/components/ui";
import { ConsentCode, DoctorSelect, ErrorLine, useStep } from "./common";

const ARRIVAL: Record<string, string> = { AMBULANCE: "Ambulance", "WALK-IN": "Walked in", OTHER: "Other" };
const BROUGHT: Record<string, string> = { RELATIVE: "A relative", UNKNOWN: "Not known", SAMARITAN: "A good samaritan", PARAMEDICS: "Paramedics" };
const newRef = () => `EMG-${nowISO().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;

/** Opens an emergency (ECCIF) claim. The patient may be identified at the door with a one time code, or identified later within the 24 hour window. */
export function EmergencyForm() {
  const d = useDB();
  const router = useRouter();
  const { busy, error, setError, run } = useStep();
  const [identified, setIdentified] = useState(true);
  const [pid, setPid] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [idType, setIdType] = useState("National ID");
  const [idNo, setIdNo] = useState("");
  const [member, setMember] = useState<{ crId: string; name: string } | null>(null);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ code: string; name: string }[] | null>(null);
  const [mode, setMode] = useState("AMBULANCE");
  const [by, setBy] = useState("RELATIVE");
  const [ref, setRef] = useState(newRef);
  const [notes, setNotes] = useState("");
  const [doctor, setDoctor] = useState("");
  const [otp, setOtp] = useState("");

  const patient = pid ? d.patients.find((p) => p.id === pid) : null;
  const text = q.trim().toLowerCase();
  const matches = text.length >= 2 ? d.patients.filter((p) => [p.name, p.mrn, p.nationalId, p.crId, p.phone].some((v) => String(v || "").toLowerCase().includes(text))).slice(0, 6) : [];
  const choose = (p: Record<string, any>) => { setPid(p.id); setQ(""); setMember(null); if (p.crId) { setIdType("ClientRegistry ID"); setIdNo(p.crId); } else if (p.nationalId) { setIdType("National ID"); setIdNo(String(p.nationalId)); } };

  const lookup = async () => {
    setMember(null);
    if (!idNo.trim()) { setError("Enter the identification number."); return; }
    const r = await run("find", "patient.search", { identificationType: idType, identificationNumber: idNo.trim(), patientId: pid ?? undefined });
    if (!r) return;
    const p = r.patient as { crId: string; name: string; deceased: boolean };
    if (p.deceased) { setError("SHA records this person as deceased."); return; }
    setMember({ crId: p.crId, name: p.name });
    if (pid === null && r.localPatientId) setPid(r.localPatientId);
  };
  const findServices = async () => {
    const r = await run("svc", "terminology.search", { kind: "intervention", search: "SHA-01" });
    if (r) setFound(((r.results || []) as { code: string; name: string }[]).filter((x) => /^SHA-01-/i.test(x.code)));
  };

  const ready = /^SHA-01-/i.test(code.trim()) && ref.trim() && (!identified || (!!member && !!patient && otp.length >= 4));
  const open = async () => {
    const r = await run("go", "emergency.create", {
      interventionCode: code.trim().toUpperCase(), modeOfArrival: mode, broughtBy: by, referenceNumber: ref.trim(), notes: notes.trim() || undefined, doctorId: doctor || undefined,
      ...(identified ? { patientId: patient?.id, crId: member?.crId, otp } : {}),
    });
    if (!r) return;
    toast("Emergency claim opened. It must reach SHA within 24 hours.");
    router.push(`/sha/${r.claimId}`);
  };

  return (
    <section className="card card-pad space-y-5">
      <div>
        <h2 className="card-title">Emergency claim</h2>
        <p className="mt-1 text-[13px] text-muted">Emergency, critical illness and chronic care (ECCIF) claims must reach SHA within 24 hours of the patient arriving. Treat first. Identify the patient when it is safe to.</p>
      </div>

      <div role="group" aria-label="Is the patient identified" className="inline-flex overflow-hidden rounded-md border border-line text-[13px]">
        <button className={`px-4 py-1.5 font-medium ${identified ? "bg-brand text-white" : "bg-white text-muted hover:text-text"}`} aria-pressed={identified} onClick={() => setIdentified(true)}>Patient identified</button>
        <button className={`px-4 py-1.5 font-medium ${!identified ? "bg-brand text-white" : "bg-white text-muted hover:text-text"}`} aria-pressed={!identified} onClick={() => setIdentified(false)}>Not identified yet</button>
      </div>

      {identified && (
        <div className="space-y-4">
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-[13px]">
              <div><div className="font-medium">{patient.name}</div><div className="text-xs text-muted">{patient.mrn}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPid(null); setMember(null); setIdNo(""); }}>Change patient</button>
            </div>
          ) : (
            <div className="space-y-2">
              <Field label="Registered patient" hint="Search by name, patient number, ID number or phone."><input className="input" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></Field>
              {matches.length > 0 && <ul className="divide-y divide-line-2 rounded-md border border-line">{matches.map((p) => <li key={p.id}><button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-surface" onClick={() => choose(p)}><span className="font-medium">{p.name}</span><span className="text-xs text-muted">{p.mrn}</span></button></li>)}</ul>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Identified by"><select className="input" value={idType} onChange={(e) => { setIdType(e.target.value); setMember(null); }}>{ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
            <Field label="Number"><input className="input" value={idNo} onChange={(e) => { setIdNo(e.target.value); setMember(null); }} autoComplete="off" /></Field>
            <button className="btn btn-secondary" onClick={lookup} disabled={!!busy}><Search size={15} />{busy === "find" ? "Finding" : "Find on SHA register"}</button>
          </div>
          {member && <div className="flex flex-wrap items-center gap-2 text-[13px]"><Badge tone="ok">Found</Badge><span className="font-medium">{member.name}</span><span className="font-mono text-xs text-muted">{member.crId}</span></div>}
          {member && !patient && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">This person is not a registered patient yet. Register them first, or open the claim as not identified and identify them later.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Emergency service code" required hint="Emergency services start with SHA-01.">
          <div className="flex gap-2"><input className="input flex-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SHA-01-005" autoComplete="off" /><button type="button" className="btn btn-secondary" onClick={findServices} disabled={!!busy}>{busy === "svc" ? "Looking" : "Find"}</button></div>
        </Field>
        <Field label="Hospital reference number" required hint="Your own emergency record number. SHA keeps it with the claim."><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} /></Field>
        {found && (
          <div className="sm:col-span-2">
            {found.length === 0 ? <p className="text-xs text-muted">No emergency services were returned. Type the code.</p> : (
              <ul className="scroll-thin max-h-44 divide-y divide-line-2 overflow-y-auto rounded-md border border-line">
                {found.map((f) => <li key={f.code}><button className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-[13px] hover:bg-surface" onClick={() => setCode(f.code)}><span className="font-mono text-xs text-brand">{f.code}</span><span>{f.name}</span></button></li>)}
              </ul>
            )}
          </div>
        )}
        <Field label="How did the patient arrive"><select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>{MODES_OF_ARRIVAL.map((m) => <option key={m} value={m}>{ARRIVAL[m]}</option>)}</select></Field>
        <Field label="Who brought the patient"><select className="input" value={by} onChange={(e) => setBy(e.target.value)}>{BROUGHT_BY.map((m) => <option key={m} value={m}>{BROUGHT[m]}</option>)}</select></Field>
        <Field label="Attending doctor" hint="Sent to SHA, which asks the doctor to confirm."><DoctorSelect value={doctor} onChange={setDoctor} optional /></Field>
        <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
      </div>

      {identified && member && patient && /^SHA-01-/i.test(code.trim()) && (
        <div className="rounded-lg border border-line p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Consent from the patient or the person with them</h3>
          <ConsentCode crId={member.crId} codes={[code.trim().toUpperCase()]} otp={otp} setOtp={setOtp} />
        </div>
      )}
      <ErrorLine text={error} />
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={!ready || !!busy} onClick={open}><Siren size={15} />{busy === "go" ? "Opening" : "Open emergency claim"}</button>
      </div>
    </section>
  );
}
