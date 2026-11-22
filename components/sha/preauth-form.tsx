"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CARCINOMA_STAGES, RENAL_FREQUENCIES, RENAL_INDICATIONS, SURGICAL_ANAESTHESIA, TREATMENT_SETTINGS } from "@/lib/hie/types";
import { useDB } from "@/lib/store";
import { nowISO } from "@/lib/format";
import { Drawer, Field, toast } from "@/components/ui";
import { DoctorSelect, ErrorLine, FilePicker, IcdInput, KIND_LABEL, docLabel, useStep, type Attach } from "./common";

type Json = Record<string, any>;
type Item = { name: string; unitPrice: string; quantity: string };

const plusHours = (iso: string, h: number) => { const t = new Date(`${iso}:00Z`).getTime() + h * 3600e3; return new Date(t).toISOString().slice(0, 16); };
const area = (props: { v: Json; set: (k: string, x: any) => void; k: string; label: string; required?: boolean; hint?: string; rows?: number }) => (
  <Field label={props.label} required={props.required} hint={props.hint} span={2}><textarea className="input" rows={props.rows || 2} value={props.v[props.k] ?? ""} onChange={(e) => props.set(props.k, e.target.value)} /></Field>
);

/** Asks SHA for approval before a service that needs it. The form that is shown depends on the service, as SHA defines. */
export function PreauthDrawer({ claim, iv, open, onClose }: { claim: Json; iv: Json; open: boolean; onClose: () => void }) {
  const d = useDB();
  const { busy, error, setError, run } = useStep();
  const kind: string = iv.preauthKind || "normal";
  const start0 = nowISO();
  const [v, setV] = useState<Json>({
    serviceStart: start0, serviceEnd: plusHours(start0, 4), providerEmail: d.settings[0]?.email || "", surgeryDate: start0.slice(0, 10), startDate: start0.slice(0, 10),
    typeOfAnaesthesia: SURGICAL_ANAESTHESIA[0], carcinomaStaging: CARCINOMA_STAGES[0], treatmentSetting: TREATMENT_SETTINGS[0], frequency: RENAL_FREQUENCIES[0], clinicalIndications: kind === "renal" ? RENAL_INDICATIONS[0] : "",
    sessionsRequired: "", numberOfSessions: "", costPerSession: "", relatedToEmployment: false, relatedToAccident: false, isCoInsured: false,
  });
  const [items, setItems] = useState<Item[]>([{ name: iv.name || "", unitPrice: iv.tariff ? String(iv.tariff) : "", quantity: "1" }]);
  const [dx, setDx] = useState<string[]>((claim.diagnoses || []).map((x: Json) => x.code).filter(Boolean));
  const [doctors, setDoctors] = useState<string[]>([""]);
  const [files, setFiles] = useState<Attach[]>([]);
  const set = (k: string, x: any) => setV((cur) => ({ ...cur, [k]: x }));
  const text = (k: string, label: string, extra: { required?: boolean; type?: string; hint?: string } = {}) => (
    <Field label={label} required={extra.required} hint={extra.hint}><input className="input" type={extra.type || "text"} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
  );
  const pick = (k: string, label: string, options: readonly string[]) => (
    <Field label={label} required><select className="input" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></Field>
  );

  const submit = async () => {
    setError("");
    const body: Json = {
      claimId: claim.id, interventionCode: iv.code, kind, serviceStart: v.serviceStart, serviceEnd: v.serviceEnd, providerEmail: v.providerEmail,
      items: items.filter((i) => i.unitPrice).map((i) => ({ name: i.name || undefined, unitPrice: Number(i.unitPrice), quantity: Number(i.quantity) || 1 })),
      diagnoses: dx, doctorIds: doctors.filter(Boolean).map(Number), attachments: files.map(({ filename, type, content, contentType }) => ({ filename, type, content, contentType })),
    };
    for (const k of ["surgeryDate", "chiefComplaint", "vitalSigns", "historyOfPresentIllness", "physicalExamination", "investigationReportDetails", "typeOfAnaesthesia", "coInsuranceDetails", "carcinomaStaging", "comorbidity", "metastases", "progressReport", "treatmentSetting", "startDate", "numberOfSessions", "costPerSession", "sessionsRequired", "frequency", "clinicalIndications", "necessityOfService", "newOrReplacement", "lensPrescription", "eyeExaminationAmount", "frameAmount", "lensAmount"]) if (v[k] !== undefined && v[k] !== "") body[k] = v[k];
    for (const k of ["relatedToEmployment", "relatedToAccident", "isCoInsured"]) body[k] = !!v[k];
    const r = await run("go", "preauth.create", body);
    if (!r) return;
    toast("Preauthorisation sent to SHA");
    onClose();
  };

  const over = items.some((i) => iv.tariff && Number(i.unitPrice) > Number(iv.tariff));

  return (
    <Drawer open={open} onClose={onClose} width={680} title={`${KIND_LABEL[kind] || "General"} preauthorisation`} subtitle={`${iv.code} ${iv.name || ""}`.trim()}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={!!busy}>{busy ? "Sending" : "Send to SHA"}</button></>}>
      <div className="space-y-6">
        <p className="text-[13px] text-muted">SHA asks each doctor named here to confirm by message. Billing opens once SHA approves. The status on the claim comes from SHA.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {text("serviceStart", "Service starts", { type: "datetime-local", required: true })}
          {text("serviceEnd", "Service ends", { type: "datetime-local", required: true })}
          <Field label="Email for SHA to reach the hospital" required span={2} hint="SHA writes to this address about the preauthorisation."><input className="input" type="email" value={v.providerEmail} onChange={(e) => set("providerEmail", e.target.value)} /></Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-semibold">Items and prices</legend>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_72px_auto] items-end gap-2">
              <Field label={i === 0 ? "Item" : ""}><input className="input" aria-label={`Item ${i + 1} name`} value={it.name} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} /></Field>
              <Field label={i === 0 ? "Price" : ""}><input className="input" aria-label={`Item ${i + 1} price`} inputMode="decimal" value={it.unitPrice} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, unitPrice: e.target.value.replace(/[^\d.]/g, "") } : x)))} /></Field>
              <Field label={i === 0 ? "Qty" : ""}><input className="input" aria-label={`Item ${i + 1} quantity`} inputMode="decimal" value={it.quantity} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, quantity: e.target.value.replace(/[^\d.]/g, "") } : x)))} /></Field>
              <button type="button" className="btn btn-ghost btn-icon mb-0.5" aria-label={`Remove item ${i + 1}`} disabled={items.length === 1} onClick={() => setItems(items.filter((_, k) => k !== i))}><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { name: "", unitPrice: "", quantity: "1" }])}><Plus size={14} />Add item</button>
          {over && <p className="text-xs text-warn">A price is above the SHA tariff of {iv.tariff}. SHA may reduce or reject it.</p>}
        </fieldset>

        <div className="space-y-2"><div className="text-[13px] font-semibold">Diagnoses (ICD-11)</div><IcdInput value={dx} onChange={setDx} required /></div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-semibold">Doctors who consent{iv.doctorsRequired ? `, ${iv.doctorsRequired} needed` : ""}</legend>
          {doctors.map((x, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1"><DoctorSelect value={x} onChange={(val) => setDoctors(doctors.map((y, k) => (k === i ? val : y)))} label={i === 0 ? "Primary doctor" : `Doctor ${i + 1}`} /></div>
              {doctors.length > 1 && <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove doctor ${i + 1}`} onClick={() => setDoctors(doctors.filter((_, k) => k !== i))}><X size={15} /></button>}
            </div>
          ))}
          {doctors.length < 4 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDoctors([...doctors, ""])}><Plus size={14} />Add another doctor</button>}
        </fieldset>

        {kind === "surgical" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {text("surgeryDate", "Date of surgery", { type: "date", required: true })}
            {pick("typeOfAnaesthesia", "Type of anaesthesia", SURGICAL_ANAESTHESIA)}
            {area({ v, set, k: "chiefComplaint", label: "Chief complaint", required: true })}
            {area({ v, set, k: "vitalSigns", label: "Vital signs", required: true, hint: "For example BP 120/80, pulse 78, temperature 36.8." })}
            {area({ v, set, k: "historyOfPresentIllness", label: "History of the present illness", required: true, rows: 3 })}
            {area({ v, set, k: "physicalExamination", label: "Physical examination", required: true, rows: 3 })}
            {area({ v, set, k: "investigationReportDetails", label: "Investigations and results", required: true, rows: 3 })}
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4" checked={!!v.relatedToEmployment} onChange={(e) => set("relatedToEmployment", e.target.checked)} />The condition is related to employment</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4" checked={!!v.relatedToAccident} onChange={(e) => set("relatedToAccident", e.target.checked)} />The condition is related to an accident</label>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={!!v.isCoInsured} onChange={(e) => set("isCoInsured", e.target.checked)} />The patient has another insurer as well</label>
            {v.isCoInsured && <Field label="Other insurer details" span={2}><input className="input" value={v.coInsuranceDetails ?? ""} onChange={(e) => set("coInsuranceDetails", e.target.value)} /></Field>}
          </div>
        )}
        {kind === "oncology" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {pick("carcinomaStaging", "Carcinoma stage", CARCINOMA_STAGES)}
            {pick("treatmentSetting", "Treatment setting", TREATMENT_SETTINGS)}
            {text("comorbidity", "Comorbidity", { required: true, hint: "Write None if there is none." })}
            {text("metastases", "Metastases", { required: true })}
            {text("startDate", "Treatment starts", { type: "date", required: true })}
            {text("numberOfSessions", "Number of sessions", { required: true })}
            {text("costPerSession", "Cost per session (KES)", { required: true })}
            {area({ v, set, k: "progressReport", label: "Progress report", rows: 3 })}
          </div>
        )}
        {kind === "renal" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {text("startDate", "First session", { type: "date", required: true })}
            {text("sessionsRequired", "Sessions required", { required: true })}
            {pick("frequency", "How often", RENAL_FREQUENCIES)}
            {pick("clinicalIndications", "Clinical indication", RENAL_INDICATIONS)}
          </div>
        )}
        {kind === "imaging" && <div className="grid gap-4">{area({ v, set, k: "clinicalIndications", label: "Clinical indications", required: true, rows: 3 })}</div>}
        {kind === "optical" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {area({ v, set, k: "clinicalIndications", label: "Clinical indications", required: true, rows: 3 })}
            {area({ v, set, k: "necessityOfService", label: "Why the service is needed", required: true, rows: 3 })}
            <Field label="New or replacement"><select className="input" value={v.newOrReplacement ?? ""} onChange={(e) => set("newOrReplacement", e.target.value)}><option value="">Not stated</option><option>New</option><option>Replacement</option></select></Field>
            <Field label="Lens prescription"><select className="input" value={v.lensPrescription ?? ""} onChange={(e) => set("lensPrescription", e.target.value)}><option value="">Not stated</option><option>Framed</option><option>Contact</option></select></Field>
            {text("eyeExaminationAmount", "Eye examination amount")}
            {text("frameAmount", "Frame amount")}
            {text("lensAmount", "Lens amount")}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[13px] font-semibold">Documents</div>
          {(iv.docTypes || []).length > 0 && <p className="text-xs text-muted">SHA accepts: {(iv.docTypes as string[]).map(docLabel).join(", ")}.</p>}
          <FilePicker value={files} onChange={setFiles} types={iv.docTypes} />
        </div>
        <ErrorLine text={error} />
      </div>
    </Drawer>
  );
}
