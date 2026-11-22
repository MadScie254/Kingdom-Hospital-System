"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
import { ID_TYPES } from "@/lib/hie/types";
import { useDB } from "@/lib/store";
import { kes } from "@/lib/format";
import { Badge, Empty, Field, toast } from "@/components/ui";
import { ConsentCode, DoctorSelect, ErrorLine, KIND_LABEL, MECHANISM_LABEL, SCENARIO_LABEL, SERVICE_LABEL, useStep } from "./common";

type Scheme = { name: string; memberType: string; status: string; start: string; end: string; message: string; reason: string; fix: string; policy: string; principal: string };
export type Elig = { crId: string; name: string; gender: string; age: number | null; dob: string; alive: boolean; statusCode: string; statusDesc: string; eligible: boolean | null; whitelistedForOtp: boolean; biometricsEnforced: boolean; otpAvailable: boolean; schemes: Scheme[] };
export type Iv = { code: string; name: string; fund: string; mechanism: string; accessPoint: string; tariff: number | null; needsPreauth: boolean; elective: boolean; preauthKind: string | null; scenario: string; serviceType: string | null; dispatch: string; perDiem: boolean; docTypes: string[]; requiredPreauthDocs: string[]; doctorsRequired: number; subBenefit: string };
type Sub = { code: string; name: string; fund: string; accessPoint: string; parent: string; parentCode: string; active: boolean };

const isActive = (s: string) => /^(active|eligible)/i.test(s);
const when = (v: string) => (v ? v.slice(0, 10) : "");

/** What SHA says about a member: who they are, each scheme, whether it is active and, if not, why and how to fix it. */
export function EligibilityCard({ e }: { e: Elig }) {
  return (
    <div className="space-y-3 rounded-lg border border-line p-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{e.name || "Name not returned"}</div>
          <div className="mt-0.5 text-[13px] text-muted">{[e.gender, e.age != null ? `${e.age} years` : "", e.dob ? `born ${when(e.dob)}` : ""].filter(Boolean).join(", ")}</div>
          <div className="mt-1 font-mono text-xs text-muted">{e.crId}</div>
        </div>
        <Badge tone={!e.alive ? "bad" : e.eligible === true ? "ok" : e.eligible === false ? "bad" : "warn"}>{!e.alive ? "Recorded as deceased" : e.eligible === true ? "Eligible for cover" : e.eligible === false ? "Not eligible" : "Status unclear"}</Badge>
      </div>
      {e.statusDesc && <p className="text-[13px] text-muted">{e.statusDesc}</p>}
      {e.schemes.length === 0 && <p className="text-[13px] text-muted">SHA returned no scheme for this member.</p>}
      <ul className="space-y-3">
        {e.schemes.map((s, i) => (
          <li key={`${s.name}-${i}`} className="rounded-md bg-surface p-3 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{s.name || "Scheme"}{s.memberType && <span className="font-normal text-muted">, {s.memberType}</span>}</span>
              <Badge tone={isActive(s.status) ? "ok" : "bad"}>{s.status || "No status"}</Badge>
            </div>
            {(s.start || s.end) && <div className="mt-1 text-xs text-muted">{s.start && `From ${when(s.start)}`}{s.start && s.end && " "}{s.end && `to ${when(s.end)}`}</div>}
            {s.message && <p className="mt-2">{s.message}</p>}
            {s.reason && <p className="mt-1 text-muted">Reason: {s.reason}</p>}
            {s.fix && <p className="mt-1 font-medium text-warn">What to do: {s.fix}</p>}
            {s.principal && <p className="mt-1 text-xs text-muted">Principal contributor: {s.principal}</p>}
          </li>
        ))}
      </ul>
      {e.biometricsEnforced && !e.otpAvailable && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">This facility must confirm consent by fingerprint for this member. Fingerprint capture is not part of this system yet, so the visit cannot be started here.</p>}
    </div>
  );
}

export const guessId = (p: Record<string, any>): [string, string] => {
  if (p.crId) return ["ClientRegistry ID", p.crId];
  if (/^CR\d/i.test(p.shaNumber || "")) return ["ClientRegistry ID", p.shaNumber];
  if (p.nationalId) return ["National ID", String(p.nationalId)];
  if (p.shaNumber) return ["ClientRegistry ID", p.shaNumber];
  return ["National ID", ""];
};

const steps = ["Find the member", "Choose the service", "Patient consent"];

/** Eligibility, service choice and consent, ending in an open SHA visit (or a recorded consent for planned services). */
export function VisitWizard({ initialPatientId }: { initialPatientId?: number }) {
  const d = useDB();
  const router = useRouter();
  const { busy, error, setError, run } = useStep();
  const [step, setStep] = useState(0);
  const [pid, setPid] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [idType, setIdType] = useState("National ID");
  const [idNo, setIdNo] = useState("");
  const [elig, setElig] = useState<Elig | null>(null);
  const [access, setAccess] = useState<"OP" | "IP">("OP");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [sub, setSub] = useState("");
  const [search, setSearch] = useState("");
  const [ivs, setIvs] = useState<Iv[] | null>(null);
  const [pg, setPg] = useState({ n: 1, total: 1, count: 0 });
  const [picked, setPicked] = useState<Iv[]>([]);
  const [otp, setOtp] = useState("");
  const [doctor, setDoctor] = useState("");

  const choose = (p: Record<string, any>) => { setPid(p.id); const [t, n] = guessId(p); setIdType(t); setIdNo(n); setQ(""); setElig(null); setError(""); };
  useEffect(() => { const p = initialPatientId ? d.patients.find((x) => x.id === initialPatientId) : null; if (p && pid === null) choose(p); }, [initialPatientId, d.patients.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const patient = pid ? d.patients.find((p) => p.id === pid) : null;
  const text = q.trim().toLowerCase();
  const matches = text.length >= 2 ? d.patients.filter((p) => [p.name, p.mrn, p.nationalId, p.shaNumber, p.crId, p.phone].some((v) => String(v || "").toLowerCase().includes(text))).slice(0, 6) : [];

  const check = async () => {
    setElig(null);
    if (!idNo.trim()) { setError("Enter the identification number."); return; }
    const r = await run("elig", "eligibility.check", { identificationType: idType, identificationNumber: idNo.trim(), patientId: pid ?? undefined });
    if (!r) return;
    setElig(r.eligibility as Elig);
    if (pid === null && r.localPatientId) setPid(r.localPatientId);
  };

  // Only the newest list request may fill the table, so a slow earlier answer never replaces a newer one.
  const latest = useRef(0);
  const loadIvs = async (code: string, mode: "OP" | "IP", subCode: string, term: string, page = 1) => {
    const mine = ++latest.current;
    setIvs(null);
    const r = await run("ivs", "eligibility.interventions", { crId: code, accessPoint: mode, subBenefitCode: subCode || undefined, search: term || undefined, page });
    if (!r || mine !== latest.current) return;
    setIvs(r.interventions as Iv[]);
    setPg({ n: r.page || 1, total: r.totalPages || 1, count: r.count || 0 });
  };
  const toService = async () => {
    if (!elig) return;
    setStep(1); setPicked([]); setIvs(null); setSub(""); setSearch("");
    await Promise.all([
      run("subs", "eligibility.subBenefits", { crId: elig.crId }).then((s) => { if (s) setSubs((s.subBenefits as Sub[]).filter((x) => x.active)); }),
      loadIvs(elig.crId, access, "", ""),
    ]);
  };

  const toggle = (i: Iv) => setPicked((cur) => (cur.some((x) => x.code === i.code) ? cur.filter((x) => x.code !== i.code) : [...cur, i]));
  const kinds = [...new Set(picked.map((i) => i.serviceType).filter(Boolean))] as string[];
  const mixed = kinds.length > 1;
  const elective = picked.some((i) => i.elective);
  const serviceType = kinds[0] || "";
  const canStart = !!patient && !!picked.length && !mixed && !!serviceType && otp.length >= 4 && !busy;

  const go = async () => {
    if (!elig || !patient) return;
    const body = { patientId: patient.id, crId: elig.crId, serviceType, otp, interventionCodes: picked.map((i) => i.code), doctorId: doctor || undefined };
    const r = elective ? await run("go", "consent.authorize", body) : await run("go", "visit.start", body);
    if (!r) return;
    toast(elective ? "Consent recorded. Request the preauthorisation next." : "Visit started");
    router.push(`/sha/${r.claimId}`);
  };

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-[13px]" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${i === step ? "border-brand bg-brand-50 font-medium text-brand" : i < step ? "border-line text-muted" : "border-line text-faint"}`} aria-current={i === step ? "step" : undefined}>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] tabular-nums">{i < step ? <Check size={12} /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="card card-pad space-y-5">
          <div>
            <h2 className="card-title">Find the member and check cover</h2>
            <p className="mt-1 text-[13px] text-muted">SHA answers from its own register, so the result is always current. Pick a registered patient, or type an identification number.</p>
          </div>
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-[13px]">
              <div><div className="font-medium">{patient.name}</div><div className="text-xs text-muted">{patient.mrn}{patient.phone ? `, ${patient.phone}` : ""}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPid(null); setElig(null); setIdNo(""); }}>Change patient</button>
            </div>
          ) : (
            <div className="space-y-2">
              <Field label="Registered patient" hint="Search by name, patient number, ID number or phone."><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing" autoComplete="off" /></Field>
              {matches.length > 0 && (
                <ul className="divide-y divide-line-2 rounded-md border border-line">
                  {matches.map((p) => <li key={p.id}><button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-surface" onClick={() => choose(p)}><span className="font-medium">{p.name}</span><span className="text-xs text-muted">{p.mrn}</span></button></li>)}
                </ul>
              )}
              {text.length >= 2 && matches.length === 0 && <p className="text-xs text-muted">No registered patient matches. <Link href="/patients/new" className="text-brand hover:underline">Register the patient</Link> before starting a visit. You can still check cover below.</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Identified by"><select className="input" value={idType} onChange={(e) => { setIdType(e.target.value); setElig(null); }}>{ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
            <Field label="Number"><input className="input" value={idNo} onChange={(e) => { setIdNo(e.target.value); setElig(null); }} onKeyDown={(e) => e.key === "Enter" && check()} autoComplete="off" /></Field>
            <button className="btn btn-primary" onClick={check} disabled={!!busy}><Search size={15} />{busy === "elig" ? "Checking" : "Check eligibility"}</button>
          </div>
          <ErrorLine text={error} />
          {elig && <EligibilityCard e={elig} />}
          {elig && elig.eligible !== false && elig.alive && !patient && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">This member is not matched to a registered patient. <Link href="/patients/new" className="font-medium underline">Register the patient</Link>, then check again.</p>}
          {elig && elig.eligible !== false && elig.alive && elig.otpAvailable && patient && (
            <div className="flex justify-end"><button className="btn btn-primary" onClick={toService} disabled={!!busy}>Choose the service<ArrowRight size={15} /></button></div>
          )}
        </section>
      )}

      {step === 1 && elig && (
        <section className="card card-pad space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="card-title">Choose the service for {elig.name}</h2><p className="mt-1 text-[13px] text-muted">Only services this member is covered for are listed, with the SHA tariff for this hospital&apos;s level.</p></div>
            <div role="group" aria-label="Where the service is given" className="inline-flex overflow-hidden rounded-md border border-line text-[13px]">
              {(["OP", "IP"] as const).map((m) => <button key={m} className={`px-4 py-1.5 font-medium ${access === m ? "bg-brand text-white" : "bg-white text-muted hover:text-text"}`} aria-pressed={access === m} onClick={() => { setAccess(m); setPicked([]); loadIvs(elig.crId, m, sub, search); }}>{m === "OP" ? "Outpatient" : "Inpatient"}</button>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Benefit"><select className="input" value={sub} onChange={(e) => { setSub(e.target.value); loadIvs(elig.crId, access, e.target.value, search); }}><option value="">All benefits</option>{subs.map((s) => <option key={s.code} value={s.code}>{s.name}{s.fund ? `, ${s.fund}` : ""}</option>)}</select></Field>
            <Field label="Search by name or code"><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadIvs(elig.crId, access, sub, search)} autoComplete="off" /></Field>
            <button className="btn btn-secondary" onClick={() => loadIvs(elig.crId, access, sub, search)} disabled={!!busy}><Search size={15} />Search</button>
          </div>
          <ErrorLine text={error} />
          <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
            <table className="tbl">
              <thead><tr><th className="w-10"><span className="sr-only">Choose</span></th><th>Service</th><th>Fund</th><th>Paid</th><th className="text-right">SHA tariff</th><th>Needs</th></tr></thead>
              <tbody>
                {(ivs || []).map((i) => {
                  const on = picked.some((x) => x.code === i.code);
                  return (
                    <tr key={i.code} className={on ? "bg-brand-50/50" : ""}>
                      <td><input type="checkbox" className="h-4 w-4 accent-[var(--color-brand,#0b7a6e)]" checked={on} onChange={() => toggle(i)} aria-label={`Choose ${i.name}`} /></td>
                      <td><div className="font-medium">{i.name}</div><div className="font-mono text-xs text-muted">{i.code}</div></td>
                      <td>{i.fund || ""}</td>
                      <td>{MECHANISM_LABEL[i.mechanism] || i.mechanism}</td>
                      <td className="text-right tabular-nums">{i.tariff ? kes(i.tariff, 2) : "Not set"}</td>
                      <td className="space-x-1">{i.needsPreauth ? <Badge tone="warn">{KIND_LABEL[i.preauthKind || "normal"]} preauthorisation</Badge> : <Badge tone="mute">None</Badge>}{i.elective && <Badge tone="info">Planned</Badge>}</td>
                    </tr>
                  );
                })}
                {ivs && ivs.length === 0 && <tr><td colSpan={6}><Empty title="No services found" hint="Try another benefit, or search with part of the name." /></td></tr>}
                {!ivs && <tr><td colSpan={6} className="py-8 text-center text-muted">{busy === "ivs" || busy === "subs" ? "Loading the member's services" : ""}</td></tr>}
              </tbody>
            </table>
          </div>
          {pg.total > 1 && (
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>Page {pg.n} of {pg.total}, {pg.count} services</span>
              <span className="flex gap-2">
                <button className="btn btn-secondary btn-sm" disabled={pg.n <= 1 || !!busy} onClick={() => loadIvs(elig.crId, access, sub, search, pg.n - 1)}>Previous</button>
                <button className="btn btn-secondary btn-sm" disabled={pg.n >= pg.total || !!busy} onClick={() => loadIvs(elig.crId, access, sub, search, pg.n + 1)}>Next</button>
              </span>
            </div>
          )}
          {picked.length > 0 && (
            <div className="rounded-lg bg-surface p-4 text-[13px]">
              <div className="font-medium">{picked.length} chosen: {picked.map((i) => i.code).join(", ")}</div>
              {mixed ? <p className="mt-1 text-bad">These services are different kinds of visit ({kinds.map((k) => SERVICE_LABEL[k] || k).join(" and ")}). Choose services of one kind.</p>
                : <p className="mt-1 text-muted">{SERVICE_LABEL[serviceType] || "Visit"}. {SCENARIO_LABEL[picked[0].scenario] || ""}{elective ? ". The patient consents first, then you request the preauthorisation, then the visit starts on the day." : ""}</p>}
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(0)}><ArrowLeft size={15} />Back</button>
            <button className="btn btn-primary" disabled={!picked.length || mixed || !serviceType} onClick={() => { setStep(2); setOtp(""); setError(""); }}>Ask for consent<ArrowRight size={15} /></button>
          </div>
        </section>
      )}

      {step === 2 && elig && patient && (
        <section className="card card-pad space-y-5">
          <div>
            <h2 className="card-title">Patient consent</h2>
            <p className="mt-1 text-[13px] text-muted">{elective ? "SHA sends a one time code to the member's phone. The member reads it out to record consent for the planned service." : "SHA sends a one time code to the member's phone. The member reads it out to open the visit."}</p>
          </div>
          <div className="rounded-lg bg-surface p-3 text-[13px]"><span className="font-medium">{patient.name}</span>, {SERVICE_LABEL[serviceType]}: {picked.map((i) => i.name).join(", ")}</div>
          <ConsentCode crId={elig.crId} codes={picked.map((i) => i.code)} otp={otp} setOtp={setOtp} />
          <Field label="Attending doctor" hint="Sent to SHA with the visit. Needed for preauthorisation requests."><DoctorSelect value={doctor} onChange={setDoctor} optional /></Field>
          <ErrorLine text={error} />
          <div className="flex flex-wrap justify-between gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={15} />Back</button>
            <button className="btn btn-primary" disabled={!canStart} onClick={go}>{busy === "go" ? "Working" : elective ? "Record consent" : "Start visit"}</button>
          </div>
        </section>
      )}
    </div>
  );
}
