"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { CLOSE_REASONS, ID_TYPES, INPATIENT_REASONS, OUTPATIENT_REASONS } from "@/lib/hie/types";
import { preauthApproved } from "@/lib/hie/rules";
import { useDB } from "@/lib/store";
import { kes, nowISO } from "@/lib/format";
import { Badge, Dialog, Field, toast } from "@/components/ui";
import { ConsentCode, DoctorSelect, ErrorLine, Section, docLabel, useStep } from "./common";
import { activeServices, claimEditable } from "./claim-parts";

type Json = Record<string, any>;

const REASON: Record<string, string> = { RECOVERED: "Recovered", REFERRED: "Referred to another facility", DECEASED: "Deceased", ABSCONDED: "Left without notice", OTHER: "Other" };

/** Planned services: consent was recorded earlier. On the day of the visit the patient confirms again and the visit opens on the same claim. */
export function StartVisitCard({ claim }: { claim: Json }) {
  const { busy, error, run } = useStep();
  const [otp, setOtp] = useState("");
  const [doctor, setDoctor] = useState("");
  const codes = activeServices(claim).map((i) => i.code);
  const unapproved = activeServices(claim).filter((i) => i.needsPreauth && !(claim.preauths || []).some((p: Json) => p.interventionCode === i.code && preauthApproved(p.status)));
  const go = async () => {
    const r = await run("go", "visit.start", { claimId: claim.id, patientId: claim.patientId, crId: claim.crId, serviceType: claim.serviceType, interventionCodes: codes, otp, doctorId: doctor || undefined });
    if (r) toast("Visit started");
  };
  return (
    <Section title="Start the visit" hint="The patient has arrived for the planned service.">
      {unapproved.length > 0 && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">SHA has not approved the preauthorisation for {unapproved.map((i) => i.name || i.code).join(", ")} yet. You can start the visit, but billing stays closed until SHA approves.</p>}
      <ConsentCode crId={claim.crId} codes={codes} otp={otp} setOtp={setOtp} hint="SHA sends a new one time code. The patient reads it out to confirm they are here for the visit." />
      <Field label="Attending doctor"><DoctorSelect value={doctor} onChange={setDoctor} optional /></Field>
      <ErrorLine text={error} />
      <div className="flex justify-end"><button className="btn btn-primary" onClick={go} disabled={!!busy || otp.length < 4}>{busy ? "Starting" : "Start the visit"}</button></div>
    </Section>
  );
}

/** Names an emergency patient once they can be identified. Needs the patient's consent code, like any other visit. */
export function IdentifyCard({ claim }: { claim: Json }) {
  const d = useDB();
  const { busy, error, setError, run } = useStep();
  const [q, setQ] = useState("");
  const [pid, setPid] = useState<number | null>(null);
  const [idType, setIdType] = useState("National ID");
  const [idNo, setIdNo] = useState("");
  const [member, setMember] = useState<{ crId: string; name: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [doctor, setDoctor] = useState("");
  const text = q.trim().toLowerCase();
  const matches = text.length >= 2 ? d.patients.filter((p) => [p.name, p.mrn, p.nationalId, p.crId, p.phone].some((v) => String(v || "").toLowerCase().includes(text))).slice(0, 6) : [];
  const patient = pid ? d.patients.find((p) => p.id === pid) : null;
  const code = activeServices(claim)[0]?.code || "";
  const lookup = async () => {
    setMember(null);
    const r = await run("find", "patient.search", { identificationType: idType, identificationNumber: idNo.trim(), patientId: pid ?? undefined });
    if (r) setMember({ crId: r.patient.crId, name: r.patient.name });
  };
  const go = async () => {
    if (!patient || !member) { setError("Choose the registered patient and find them on the SHA register first."); return; }
    const r = await run("go", "emergency.identify", { claimId: claim.id, patientId: patient.id, crId: member.crId, otp, doctorId: doctor || undefined });
    if (r) toast("Patient identified on the claim");
  };
  return (
    <Section title="Identify the patient" hint="This claim was opened without knowing who the patient is. Identify them before the 24 hours end, or say why they could not be identified when you submit.">
      {patient ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-[13px]"><span className="font-medium">{patient.name}</span><button className="btn btn-ghost btn-sm" onClick={() => { setPid(null); setMember(null); }}>Change</button></div>
      ) : (
        <div className="space-y-2">
          <Field label="Registered patient"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></Field>
          {matches.length > 0 && <ul className="divide-y divide-line-2 rounded-md border border-line">{matches.map((p) => <li key={p.id}><button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-surface" onClick={() => { setPid(p.id); setQ(""); if (p.nationalId) { setIdType("National ID"); setIdNo(String(p.nationalId)); } }}><span className="font-medium">{p.name}</span><span className="text-xs text-muted">{p.mrn}</span></button></li>)}</ul>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Identified by"><select className="input" value={idType} onChange={(e) => setIdType(e.target.value)}>{ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
        <Field label="Number"><input className="input" value={idNo} onChange={(e) => { setIdNo(e.target.value); setMember(null); }} autoComplete="off" /></Field>
        <button className="btn btn-secondary" onClick={lookup} disabled={!!busy || !idNo.trim()}>{busy === "find" ? "Finding" : "Find on SHA register"}</button>
      </div>
      {member && <div className="flex flex-wrap items-center gap-2 text-[13px]"><Badge tone="ok">Found</Badge><span className="font-medium">{member.name}</span><span className="font-mono text-xs text-muted">{member.crId}</span></div>}
      {member && <ConsentCode crId={member.crId} codes={[code]} otp={otp} setOtp={setOtp} />}
      <Field label="Attending doctor"><DoctorSelect value={doctor} onChange={setDoctor} optional /></Field>
      <ErrorLine text={error} />
      <div className="flex justify-end"><button className="btn btn-primary" onClick={go} disabled={!!busy || !member || !patient || otp.length < 4}>{busy === "go" ? "Working" : "Identify the patient"}</button></div>
    </Section>
  );
}

/** Ends the visit and sends the claim. Outpatient, capitation and emergency claims are submitted. Inpatient claims are sent by discharging the patient. */
export function SubmitCard({ claim }: { claim: Json }) {
  const d = useDB();
  const { busy, error, setError, run } = useStep();
  const inpatient = claim.serviceType === "INPATIENT";
  const emergency = claim.serviceType === "EMERGENCY";
  const unknown = emergency && !claim.emergency?.identified;
  const [invoice, setInvoice] = useState(claim.invoiceNo || "");
  const [reason, setReason] = useState("RECOVERED");
  const [when, setWhen] = useState(nowISO());
  const [notes, setNotes] = useState("");
  const [why, setWhy] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const invoices = d.invoices.filter((i) => i.patientId === claim.patientId && !d.shaClaims.some((c) => c.id !== claim.id && c.invoiceNo === i.no && c.source === "hie"));
  const lines = (claim.lines || []).filter((l: Json) => l.active !== false);
  const blockers = [
    !lines.length && "Nothing is billed yet.",
    !(claim.diagnoses || []).length && "No diagnosis is on the claim.",
    activeServices(claim).some((i) => i.needsPreauth && !(claim.preauths || []).some((p: Json) => p.interventionCode === i.code && preauthApproved(p.status))) && "A preauthorisation has not been approved by SHA.",
  ].filter(Boolean) as string[];

  const sendCode = async () => { const r = await run("otp", "claim.dischargeOtp", { claimId: claim.id }); if (r) { setSent(true); toast("Code sent to the patient"); } };
  const send = async () => {
    setConfirm(false); setError("");
    const body = inpatient ? { claimId: claim.id, invoiceNo: invoice.trim(), reason, dischargeDate: when, otp } : { claimId: claim.id, invoiceNo: invoice.trim(), reason, otp: emergency ? undefined : otp, notes: notes || undefined, reasonForUnknownPatient: unknown ? why : undefined };
    const r = await run("go", inpatient ? "claim.discharge" : "claim.submit", body);
    if (r) toast(inpatient ? "Patient discharged and claim sent to SHA" : "Claim sent to SHA");
  };
  const ready = !!invoice.trim() && (emergency || otp.length >= 4) && (!unknown || why.trim().length > 3);

  return (
    <Section title={inpatient ? "Discharge and send the claim" : "Send the claim to SHA"} hint={inpatient ? "Discharging the patient also sends the claim. SHA confirms with the patient by one time code." : emergency ? "Emergency claims do not need a code from the patient. They must reach SHA within 24 hours." : "The patient confirms the visit is over with a one time code from SHA."}>
      {blockers.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-md bg-warn-50 px-8 py-2 text-[13px] text-warn">{blockers.map((b) => <li key={b}>{b}</li>)}<li className="list-none text-xs text-muted">SHA may still send the claim back. Fix these first if you can.</li></ul>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice number" required hint="The hospital invoice this claim is for.">
          <input className="input" list="sha-invoices" value={invoice} onChange={(e) => setInvoice(e.target.value)} autoComplete="off" />
          <datalist id="sha-invoices">{invoices.map((i) => <option key={i.no} value={i.no}>{kes(i.items?.reduce?.((a: number, x: Json) => a + x.qty * x.price, 0) || 0, 0)}</option>)}</datalist>
        </Field>
        <Field label={inpatient ? "Why the patient left" : "Why the visit ended"} required>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{(inpatient ? INPATIENT_REASONS : OUTPATIENT_REASONS).map((r) => <option key={r} value={r}>{REASON[r]}</option>)}</select>
        </Field>
        {inpatient && <Field label="Date and time of discharge" required><input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>}
        {!inpatient && <Field label="Notes for SHA"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>}
        {unknown && <Field label="Why the patient could not be identified" required span={2}><textarea className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} /></Field>}
      </div>
      {!emergency && (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={sendCode} disabled={!!busy}>{busy === "otp" ? "Sending" : sent ? "Send a new code" : "Send code to the patient"}</button>
            {sent && <Badge tone="ok">Code sent</Badge>}
          </div>
          <label className="block max-w-xs"><span className="label">One time code from the patient</span><input className="input font-mono tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></label>
        </div>
      )}
      <ErrorLine text={error} />
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setConfirm(true)} disabled={!!busy || !ready}><Send size={15} />{busy === "go" ? "Sending" : inpatient ? "Discharge and send" : "Send claim to SHA"}</button></div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={inpatient ? "Discharge this patient and send the claim?" : "Send this claim to SHA?"}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirm(false)}>Not yet</button><button className="btn btn-primary" onClick={send}>{inpatient ? "Discharge and send" : "Send claim"}</button></>}>
        {kes(Number(claim.amount) || 0, 2)} for invoice {invoice}. After this the claim cannot be changed here. SHA decides the outcome and this screen shows what SHA reports.
      </Dialog>
    </Section>
  );
}

/** Ends a claim that will not be billed, for example a patient who left before being seen. */
export function CloseCard({ claim }: { claim: Json }) {
  const { busy, error, run } = useStep();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(CLOSE_REASONS[1]);
  const [text, setText] = useState("");
  if (!claimEditable(claim) && claim.status !== "Awaiting visit") return null;
  const close = async () => { const r = await run("close", "claim.close", { claimId: claim.id, reasonType: type, reasonText: text }); if (r) { toast("Claim closed"); setOpen(false); } };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3 text-[13px]">
      <span className="text-muted">Visit did not go ahead, or it was opened by mistake?</span>
      <button className="btn btn-ghost btn-sm hover:!text-bad" onClick={() => setOpen(true)}>Close this claim without billing</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close this claim?" footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Keep it open</button><button className="btn btn-primary !border-bad !bg-bad" onClick={close} disabled={!!busy || text.trim().length < 3}>{busy ? "Closing" : "Close claim"}</button></>}>
        <div className="space-y-3">
          <p>SHA closes the visit and nothing is billed. This cannot be undone.</p>
          <Field label="Reason"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{CLOSE_REASONS.map((r) => <option key={r} value={r}>{docLabel(r)}</option>)}</select></Field>
          <Field label="Explain in a few words" required><input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} /></Field>
          <ErrorLine text={error} />
        </div>
      </Dialog>
    </div>
  );
}
