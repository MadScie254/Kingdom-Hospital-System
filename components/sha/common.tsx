"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Paperclip, Search, X } from "lucide-react";
import { canWrite } from "@/lib/access";
import { isIcd11, normalizeIcd11 } from "@/lib/hie/icd";
import { DOCUMENT_TYPES } from "@/lib/hie/types";
import { db, useDB, useUser } from "@/lib/store";
import { Badge } from "@/components/ui";

/** Runs one SHA step at a time and keeps the busy flag and the error beside the form, so a refusal from SHA is read where it happened. */
export function useStep() {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (key: string, name: string, body: Record<string, any> = {}) => {
    setBusy(key); setError("");
    const r = await db.hie(name, body, true);
    setBusy("");
    if (!r) return null; // signed out, already shown
    if (typeof r.error === "string") { setError(r.error); return null; }
    return r;
  };
  return { busy, error, setError, run };
}

export const ErrorLine = ({ text }: { text: string }) => (text ? <p className="rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{text}</p> : null);

export function Section({ title, hint, actions, children, id }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      <div className="card-head flex-wrap">
        <div><h2 className="card-title">{title}</h2>{hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="card-pad space-y-4">{children}</div>
    </section>
  );
}

export const SERVICE_LABEL: Record<string, string> = { CAPITATION: "Capitation, primary care", OUTPATIENT: "Outpatient", INPATIENT: "Inpatient", EMERGENCY: "Emergency" };
export const SCENARIO_LABEL: Record<string, string> = {
  capitation: "Capitation visit, paid per registered member",
  ip_per_diem: "Inpatient stay paid per day",
  ip_ffs: "Inpatient stay paid per service",
  ip_ffs_normal_preauth: "Inpatient stay paid per service, needs preauthorisation",
  ip_ffs_elective_preauth: "Planned inpatient stay, needs preauthorisation before the visit",
  op_ffs: "Outpatient visit paid per service",
  op_ffs_normal_preauth: "Outpatient visit paid per service, needs preauthorisation",
  op_ffs_elective_preauth: "Planned outpatient service, needs preauthorisation before the visit",
  emergency: "Emergency visit",
};
export const KIND_LABEL: Record<string, string> = { normal: "General", surgical: "Surgical", oncology: "Oncology", renal: "Renal dialysis", imaging: "Imaging", optical: "Optical" };
export const MECHANISM_LABEL: Record<string, string> = { CAPITATION: "Capitation", PER_DIEM: "Per day", FEE_FOR_SERVICE: "Per service", CASE_BASED: "Per case", OTHER: "Other" };
export const docLabel = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Time left before an emergency claim must reach SHA. */
export function timeLeft(deadline: string, now = Date.now()): { text: string; tone: "ok" | "warn" | "bad" } {
  const ms = new Date(deadline).getTime() - now;
  if (!Number.isFinite(ms)) return { text: "", tone: "ok" };
  if (ms <= 0) return { text: "The 24 hours are over", tone: "bad" };
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return { text: `${h} hours ${m} minutes left`, tone: h < 6 ? "bad" : h < 12 ? "warn" : "ok" };
}

// ---- connection state, read once per session

export type Conn = { configured: boolean; host: string; facility: { frCode: string; mflCode: string; kephLevel: number | null; headers: boolean }; icd11Search: boolean; callbacks: boolean };
let connPromise: Promise<Conn | null> | null = null;
export function useHieStatus(): Conn | null {
  const [s, set] = useState<Conn | null>(null);
  useEffect(() => {
    let live = true;
    connPromise ||= db.hie("status", {}, true).then((r) => (r && typeof r.error !== "string" ? (r as Conn) : null));
    connPromise.then((r) => { if (!r) connPromise = null; if (live) set(r); });
    return () => { live = false; };
  }, []);
  return s;
}

// ---- files

export type Attach = { filename: string; type: string; content: string; contentType: string; size: number };

const readBase64 = (f: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => no(new Error("read")); r.readAsDataURL(f); });

export function FilePicker({ value, onChange, types, max = 6, label = "Attach files" }: { value: Attach[]; onChange: (v: Attach[]) => void; types?: string[]; max?: number; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const options = types && types.length ? types : [...DOCUMENT_TYPES];
  const add = async (files: FileList | null) => {
    setErr("");
    if (!files) return;
    const next = [...value];
    for (const f of Array.from(files)) {
      if (next.length >= max) { setErr(`Attach at most ${max} files at a time.`); break; }
      if (f.size > 2_000_000) { setErr(`${f.name} is larger than 2 MB. Send a smaller copy.`); continue; }
      try { next.push({ filename: f.name, type: options[0] || "OTHER", content: await readBase64(f), contentType: f.type || "application/octet-stream", size: f.size }); }
      catch { setErr(`${f.name} could not be read.`); }
    }
    onChange(next);
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" multiple className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => add(e.target.files)} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()}><Paperclip size={14} />{label}</button>
      {err && <p className="text-xs text-bad" role="alert">{err}</p>}
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((f, i) => (
            <li key={`${f.filename}-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{f.filename} <span className="text-xs text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span></span>
              <select className="input !h-8 !w-auto max-w-[220px]" aria-label={`What ${f.filename} is`} value={f.type} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, type: e.target.value } : x)))}>
                {options.map((t) => <option key={t} value={t}>{docLabel(t)}</option>)}
              </select>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove ${f.filename}`} onClick={() => onChange(value.filter((_, k) => k !== i))}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- diagnoses

type Hit = { code: string; name: string };

/** ICD-11 codes for a claim. Staff type a code or search SHA's terminology service. Codes are never worked out from ICD-10 here. */
export function IcdInput({ value, onChange, max = 12, required }: { value: string[]; onChange: (v: string[]) => void; max?: number; required?: boolean }) {
  const st = useHieStatus();
  const d = useDB();
  const user = useUser();
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const names = new Map(d.diagnoses.filter((x) => x.icd11).map((x) => [normalizeIcd11(x.icd11), x.name as string]));

  const add = (raw: string, name?: string) => {
    const code = normalizeIcd11(raw);
    setErr("");
    if (!code) return;
    if (!isIcd11(code)) { setErr(`${raw.trim()} does not look like an ICD-11 code. Codes look like ca07.0 or 1a00.`); return; }
    if (value.includes(code)) { setText(""); return; }
    if (value.length >= max) { setErr(`Add at most ${max} diagnoses.`); return; }
    onChange([...value, code]);
    setText(""); setHits(null);
    // Remember a pick on the hospital's own diagnosis list when the names match exactly. Nothing is guessed.
    const match = name && d.diagnoses.find((x) => !x.icd11 && String(x.name).toLowerCase() === name.toLowerCase());
    if (match && canWrite(user?.role, "diagnoses")) db.update("diagnoses", match.id, { icd11: code });
  };
  const search = async () => {
    setErr(""); setHits(null);
    if (text.trim().length < 3) { setErr("Type at least 3 letters to search."); return; }
    setBusy(true);
    const r = await db.hie("terminology.search", { kind: "icd11", search: text.trim() }, true);
    setBusy(false);
    if (!r) return;
    if (typeof r.error === "string") { setErr(r.error); return; }
    setHits(r.results || []);
    if (!(r.results || []).length) setErr(r.note || "Nothing found. Try another word, or type the code.");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand">
            <span className="font-mono">{c}</span>{names.get(c) && <span className="text-muted">{names.get(c)}</span>}
            <button type="button" className="grid h-5 w-5 place-items-center rounded-full hover:bg-white" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}><X size={12} /></button>
          </span>
        ))}
        {value.length === 0 && <span className="text-xs text-muted">{required ? "No diagnosis added yet. At least one is needed." : "No diagnosis added."}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input min-w-[180px] flex-1" value={text} list="icd11-local" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(text); } }}
          placeholder={st?.icd11Search ? "Code such as ca07.0, or a word to search" : "ICD-11 code such as ca07.0"} aria-label="ICD-11 diagnosis" autoComplete="off" spellCheck={false} />
        <datalist id="icd11-local">{[...names].map(([c, n]) => <option key={c} value={c}>{n}</option>)}</datalist>
        <button type="button" className="btn btn-secondary btn-sm !h-9" onClick={() => add(text)}>Add code</button>
        {st?.icd11Search && <button type="button" className="btn btn-secondary btn-sm !h-9" onClick={search} disabled={busy}><Search size={14} />{busy ? "Searching" : "Search names"}</button>}
      </div>
      {err && <p className="text-xs text-bad" role="alert">{err}</p>}
      {hits && hits.length > 0 && (
        <ul className="scroll-thin max-h-48 divide-y divide-line-2 overflow-y-auto rounded-md border border-line">
          {hits.map((h) => (
            <li key={h.code}><button type="button" className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-[13px] hover:bg-surface" onClick={() => add(h.code, h.name)}><span className="font-mono text-xs text-brand">{h.code}</span><span>{h.name}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- doctors

export function DoctorSelect({ value, onChange, label = "Attending doctor", optional }: { value: string; onChange: (v: string) => void; label?: string; optional?: boolean }) {
  const d = useDB();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{optional ? "No doctor named" : "Choose the doctor"}</option>
      {d.doctors.filter((x) => x.status !== "Inactive").map((x) => <option key={x.id} value={x.id} disabled={!x.licence}>{x.name}{x.licence ? ` (${x.licence})` : ", no registration number"}</option>)}
    </select>
  );
}

// ---- consent by one time code

type Contact = { id: number; value: string; type: string; confirmed: boolean };

/** Sends the one time code to the patient's phone through SHA and takes the code the patient reads out. The code is never stored. */
export function ConsentCode({ crId, codes, otp, setOtp, hint }: { crId: string; codes: string[]; otp: string; setOtp: (v: string) => void; hint?: string }) {
  const { busy, error, run } = useStep();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactId, setContactId] = useState("");
  const [sentTo, setSentTo] = useState("");
  const key = `${crId}|${codes.join(",")}`;
  useEffect(() => { setSentTo(""); setOtp(""); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    let list = contacts;
    if (!list) {
      const r = await run("contacts", "consent.contacts", { crId });
      if (!r) return;
      list = (r.contacts || []) as Contact[];
      setContacts(list);
      if (!list.length) return;
      if (list.length > 1 && !contactId) { setContactId(String(list[0].id)); return; } // let staff pick which number first
    }
    const chosen = list.find((c) => String(c.id) === contactId) || list[0];
    if (!chosen) return;
    const r = await run("otp", "consent.sendOtp", { crId, interventionCodes: codes, contactId: chosen.id });
    if (r) setSentTo(chosen.value);
  };

  return (
    <div className="space-y-3">
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      {contacts && contacts.length === 0 && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">SHA has no phone number on record for this member. The member can update it on the SHA portal or at a SHA office, then try again.</p>}
      {contacts && contacts.length > 1 && !sentTo && (
        <label className="block max-w-sm"><span className="label">Send the code to</span>
          <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>{contacts.map((c) => <option key={c.id} value={c.id}>{c.value} ({c.type || "phone"})</option>)}</select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={send} disabled={!!busy || !codes.length}>{busy ? "Sending" : sentTo ? "Send a new code" : contacts && contacts.length > 1 ? "Send code to this number" : "Send code to the patient"}</button>
        {sentTo && <Badge tone="ok">Code sent to {sentTo}</Badge>}
      </div>
      <label className="block max-w-xs"><span className="label">One time code from the patient</span>
        <input className="input font-mono tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
      </label>
      <ErrorLine text={error} />
    </div>
  );
}
