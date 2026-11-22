"use client";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { preauthApproved, preauthStatus } from "@/lib/hie/rules";
import { kes } from "@/lib/format";
import { Badge, Drawer, Field, toast } from "@/components/ui";
import { DoctorSelect, ErrorLine, FilePicker, IcdInput, KIND_LABEL, MECHANISM_LABEL, Section, docLabel, useStep, type Attach } from "./common";
import { PreauthDrawer } from "./preauth-form";
import type { Iv } from "./visit-wizard";

type Json = Record<string, any>;

/** True while the hospital can still change what is sent to SHA. Once SHA has the claim it is read only. */
export const claimEditable = (c: Json) => c.source === "hie" && ["Visit open", "Draft", "Ready to submit"].includes(c.status);
export const activeServices = (c: Json): Json[] => (c.interventions || []).filter((i: Json) => i.active !== false);
const files = (list: Attach[]) => list.map(({ filename, type, content, contentType }) => ({ filename, type, content, contentType }));

// ---------------------------------------------------------------- services

function ServicePicker({ claim, mode, onClose }: { claim: Json; mode: { op: "add" } | { op: "switch"; from: string } | null; onClose: () => void }) {
  const { busy, error, run } = useStep();
  const [search, setSearch] = useState("");
  const [list, setList] = useState<Iv[] | null>(null);
  const [keep, setKeep] = useState(true);
  const find = async () => {
    const r = await run("find", "eligibility.interventions", { crId: claim.crId, accessPoint: claim.serviceType === "INPATIENT" ? "IP" : "OP", search: search || undefined });
    if (r) setList(r.interventions as Iv[]);
  };
  useEffect(() => { if (mode) { setList(null); setSearch(""); find(); } }, [mode?.op]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (i: Iv) => {
    if (!mode) return;
    const r = await run("go", "claim.intervention", mode.op === "add" ? { claimId: claim.id, op: "add", code: i.code } : { claimId: claim.id, op: "switch", code: mode.from, to: i.code, retainBillItems: keep });
    if (r) { toast(mode.op === "add" ? "Service added" : "Service switched"); onClose(); }
  };
  return (
    <Drawer open={!!mode} onClose={onClose} width={600} title={mode?.op === "switch" ? `Switch ${mode.from} to another service` : "Add a service"} subtitle="Services this member is covered for.">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className="input flex-1" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="Name or code" aria-label="Search services" />
          <button className="btn btn-secondary" onClick={find} disabled={!!busy}><Search size={15} />Search</button>
        </div>
        {mode?.op === "switch" && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Keep the bill items already added</label>}
        <ErrorLine text={error} />
        <ul className="divide-y divide-line-2 rounded-lg border border-line">
          {(list || []).map((i) => (
            <li key={i.code} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
              <div className="min-w-0"><div className="font-medium">{i.name}</div><div className="font-mono text-xs text-muted">{i.code}{i.tariff ? `, tariff ${kes(i.tariff, 2)}` : ""}{i.needsPreauth ? ", needs preauthorisation" : ""}</div></div>
              <button className="btn btn-secondary btn-sm" onClick={() => choose(i)} disabled={!!busy || activeServices(claim).some((x) => x.code === i.code)}>{activeServices(claim).some((x) => x.code === i.code) ? "On the claim" : "Choose"}</button>
            </li>
          ))}
          {list && list.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No services found.</li>}
          {!list && <li className="px-3 py-6 text-center text-[13px] text-muted">{busy ? "Loading" : ""}</li>}
        </ul>
      </div>
    </Drawer>
  );
}

export function ServicesCard({ claim }: { claim: Json }) {
  const { busy, error, run } = useStep();
  const [picker, setPicker] = useState<{ op: "add" } | { op: "switch"; from: string } | null>(null);
  const editable = claimEditable(claim) && claim.serviceType !== "EMERGENCY";
  const list: Json[] = claim.interventions || [];
  const act = async (op: "retire" | "restore", code: string) => { const r = await run(op + code, "claim.intervention", { claimId: claim.id, op, code }); if (r) toast(op === "retire" ? "Service retired" : "Service restored"); };
  return (
    <Section title="Services" hint="What this visit is for. Each service has its own SHA tariff." actions={editable && <button className="btn btn-secondary btn-sm" onClick={() => setPicker({ op: "add" })}><Plus size={14} />Add a service</button>}>
      <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
        <table className="tbl">
          <thead><tr><th>Service</th><th>Paid</th><th className="text-right">SHA tariff</th><th>Preauthorisation</th><th>State</th>{editable && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>
            {list.map((i) => {
              const p = (claim.preauths || []).find((x: Json) => x.interventionCode === i.code);
              const st = preauthStatus(p?.status);
              return (
                <tr key={i.code} className={i.active === false ? "opacity-60" : ""}>
                  <td><div className="font-medium">{i.name}</div><div className="font-mono text-xs text-muted">{i.code}</div></td>
                  <td>{MECHANISM_LABEL[i.mechanism] || i.mechanism || ""}{i.perDiemDays ? <div className="text-xs text-muted">{i.perDiemDays} days so far</div> : null}</td>
                  <td className="text-right tabular-nums">{i.tariff ? kes(i.tariff, 2) : "Not set"}</td>
                  <td>{i.needsPreauth ? <span className="flex flex-wrap items-center gap-1.5"><Badge tone="warn">{KIND_LABEL[i.preauthKind || "normal"]}</Badge>{p ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone="mute">Not requested</Badge>}</span> : <span className="text-muted">Not needed</span>}</td>
                  <td>{i.active === false ? <Badge tone="mute">Retired</Badge> : <Badge tone="ok">Active</Badge>}</td>
                  {editable && (
                    <td className="whitespace-nowrap text-right">
                      {i.active === false ? <button className="btn btn-ghost btn-sm" onClick={() => act("restore", i.code)} disabled={!!busy}>Restore</button> : (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setPicker({ op: "switch", from: i.code })} disabled={!!busy}>Switch</button>
                          {activeServices(claim).length > 1 && <button className="btn btn-ghost btn-sm hover:!text-bad" onClick={() => act("retire", i.code)} disabled={!!busy}>Retire</button>}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No services on this claim.</td></tr>}
          </tbody>
        </table>
      </div>
      <ErrorLine text={error} />
      <ServicePicker claim={claim} mode={picker} onClose={() => setPicker(null)} />
    </Section>
  );
}

// ---------------------------------------------------------------- preauthorisation

export function PreauthCard({ claim }: { claim: Json }) {
  const { busy, error, run } = useStep();
  const [open, setOpen] = useState<Json | null>(null);
  const [doctor, setDoctor] = useState("");
  const needs = activeServices(claim).filter((i) => i.needsPreauth || (claim.preauths || []).some((p: Json) => p.interventionCode === i.code));
  if (!needs.length) return null;
  const editable = claim.source === "hie" && !["Submitted", "Under review", "Needs action", "Approved", "Sent for payment", "Paid", "Rejected", "Closed", "Time barred"].includes(claim.status);
  const refresh = async () => { const r = await run("refresh", "claim.refresh", { claimId: claim.id }); if (r) toast("Status read from SHA"); };
  return (
    <Section title="Preauthorisation" hint="SHA must approve these services before they can be billed. The status is SHA's answer." actions={<button className="btn btn-secondary btn-sm" onClick={refresh} disabled={!!busy}><RefreshCw size={14} />{busy === "refresh" ? "Checking" : "Check with SHA"}</button>}>
      <ul className="space-y-3">
        {needs.map((i) => {
          const p = (claim.preauths || []).find((x: Json) => x.interventionCode === i.code);
          const st = preauthStatus(p?.status);
          const waiting = /DOCTOR|ACTIVE|CLARIFICATION|PENDING/i.test(p?.status || "") && !/CANCEL|REJECT/i.test(p?.status || "");
          const canRequest = editable && (!p || /CANCEL|REJECT|FAILED|DRAFT/i.test(p.status || ""));
          return (
            <li key={i.code} className="rounded-lg border border-line p-4 text-[13px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="font-medium">{i.name}</div><div className="font-mono text-xs text-muted">{i.code}, {KIND_LABEL[i.preauthKind || p?.kind || "normal"]} preauthorisation{i.elective ? ", planned service" : ""}</div></div>
                <Badge tone={p ? st.tone : "mute"}>{p ? st.label : "Not requested"}</Badge>
              </div>
              {p && (
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  {p.requested != null && <div><dt className="text-muted">Requested</dt><dd className="tabular-nums">{kes(Number(p.requested), 2)}</dd></div>}
                  {p.approved != null && preauthApproved(p.status) && <div><dt className="text-muted">Approved by SHA</dt><dd className="tabular-nums">{kes(Number(p.approved), 2)}</dd></div>}
                  {p.doctorStatus && <div><dt className="text-muted">Doctor consent</dt><dd>{docLabel(String(p.doctorStatus))}</dd></div>}
                </dl>
              )}
              {p?.notes?.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted">{p.notes.map((n: string, k: number) => <li key={k}>SHA note: {n}</li>)}</ul>}
              {editable && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {canRequest && <button className="btn btn-primary btn-sm" onClick={() => setOpen(i)}>{p ? "Request again" : "Request preauthorisation"}</button>}
                  {p && waiting && (
                    <>
                      <div className="w-56"><DoctorSelect value={doctor} onChange={setDoctor} label="Doctor to remind" /></div>
                      <button className="btn btn-secondary btn-sm" disabled={!doctor || !!busy} onClick={async () => { const r = await run("resend", "preauth.resendDoctor", { claimId: claim.id, interventionCode: i.code, doctorId: doctor }); if (r) toast(`Reminder sent to ${r.to}`); }}>Resend doctor request</button>
                      <button className="btn btn-ghost btn-sm hover:!text-bad" disabled={!!busy} onClick={async () => { const r = await run("cancel", "preauth.cancel", { claimId: claim.id, interventionCode: i.code }); if (r) toast("Preauthorisation cancelled"); }}>Cancel preauthorisation</button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ErrorLine text={error} />
      {open && <PreauthDrawer key={open.code} claim={claim} iv={open} open onClose={() => setOpen(null)} />}
    </Section>
  );
}

// ---------------------------------------------------------------- billing

function Lines({ claim, editable }: { claim: Json; editable: boolean }) {
  const { busy, error, run } = useStep();
  const lines: Json[] = (claim.lines || []).filter((l: Json) => l.active !== false);
  return (
    <div className="space-y-2">
      <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
        <table className="tbl">
          <thead><tr><th>Item</th><th>Service</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Total</th>{editable && <th><span className="sr-only">Remove</span></th>}</tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="font-medium">{l.name || "Bill item"}</td><td className="font-mono text-xs">{l.code}</td>
                <td className="text-right tabular-nums">{l.quantity}</td><td className="text-right tabular-nums">{kes(l.unitPrice, 2)}</td><td className="text-right tabular-nums">{kes(l.total, 2)}</td>
                {editable && <td className="text-right"><button className="btn btn-ghost btn-sm btn-icon hover:!text-bad" aria-label={`Remove ${l.name || "bill item"}`} disabled={!!busy} onClick={() => run("rm" + l.id, "claim.removeLine", { claimId: claim.id, lineId: l.id })}><Trash2 size={14} /></button></td>}
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">Nothing billed yet.</td></tr>}
          </tbody>
          {lines.length > 0 && <tfoot><tr><td colSpan={4} className="px-4 py-2.5 text-right font-medium">Claim total</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{kes(Number(claim.amount) || lines.reduce((a, l) => a + l.total, 0), 2)}</td>{editable && <td />}</tr></tfoot>}
        </table>
      </div>
      {claim.netAmount != null && Number(claim.netAmount) !== Number(claim.amount) && <p className="text-xs text-muted">SHA works out {kes(Number(claim.netAmount), 2)} after its own rules.</p>}
      <ErrorLine text={error} />
    </div>
  );
}

function AddLine({ claim }: { claim: Json }) {
  const { busy, error, setError, run } = useStep();
  const svc = activeServices(claim);
  const [code, setCode] = useState(svc[0]?.code || "");
  const iv = svc.find((i) => i.code === code) || svc[0];
  const [name, setName] = useState("");
  const [price, setPrice] = useState(iv?.tariff ? String(iv.tariff) : "");
  const [qty, setQty] = useState("1");
  const [dx, setDx] = useState<string[]>((claim.diagnoses || []).map((x: Json) => x.code).filter(Boolean));
  const [docs, setDocs] = useState<Attach[]>([]);
  const [doctor, setDoctor] = useState("");
  const waiting = iv?.needsPreauth && !(claim.preauths || []).some((p: Json) => p.interventionCode === iv.code && /FINALISED/i.test(p.status || ""));
  const over = iv?.tariff && Number(price) > Number(iv.tariff);
  const add = async () => {
    setError("");
    const r = await run("add", "claim.addLine", { claimId: claim.id, interventionCode: iv?.code, serviceName: name || iv?.name, unitPrice: Number(price), quantity: Number(qty) || 1, diagnoses: dx, attachments: files(docs), doctorId: doctor || undefined });
    if (r) { toast("Added to the bill"); setName(""); setDocs([]); setQty("1"); }
  };
  return (
    <div className="space-y-4 rounded-lg border border-line p-4">
      <h3 className="text-[13px] font-semibold">Add to the bill</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" required><select className="input" value={iv?.code || ""} onChange={(e) => { setCode(e.target.value); const n = svc.find((i) => i.code === e.target.value); setPrice(n?.tariff ? String(n.tariff) : ""); }}>{svc.map((i) => <option key={i.code} value={i.code}>{i.code} {i.name}</option>)}</select></Field>
        <Field label="What was given" hint="Shown on the bill, for example Consultation."><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={iv?.name || ""} maxLength={120} /></Field>
        <Field label={iv?.mechanism === "PER_DIEM" ? "Price per day (KES)" : "Unit price (KES)"} required hint={iv?.tariff ? `SHA tariff ${kes(iv.tariff, 2)}. A higher price makes SHA reject the bill.` : undefined}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
        <Field label={iv?.mechanism === "PER_DIEM" ? "Days" : "Quantity"} required><input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
      </div>
      {over && <p className="text-xs text-bad">This price is above the SHA tariff. It cannot be added.</p>}
      {waiting && <p className="rounded-md bg-warn-50 px-3 py-2 text-[13px] text-warn">This service needs a preauthorisation that SHA has not approved yet. Billing opens once SHA approves it.</p>}
      <div className="space-y-2"><div className="text-[13px] font-medium">Diagnoses for this item (ICD-11)</div><IcdInput value={dx} onChange={setDx} required /></div>
      <div className="space-y-2"><div className="text-[13px] font-medium">Documents for this item</div><FilePicker value={docs} onChange={setDocs} types={iv?.docTypes} /></div>
      <Field label="Doctor who gave the service"><DoctorSelect value={doctor} onChange={setDoctor} optional label="Doctor who gave the service" /></Field>
      <ErrorLine text={error} />
      <div className="flex justify-end"><button className="btn btn-primary" onClick={add} disabled={!!busy || !iv || !Number(price) || !!over}>{busy ? "Adding" : "Add to the bill"}</button></div>
    </div>
  );
}

function ClaimDiagnoses({ claim, editable }: { claim: Json; editable: boolean }) {
  const { busy, error, run } = useStep();
  const svc = activeServices(claim);
  const [code, setCode] = useState(svc[0]?.code || "");
  const [pending, setPending] = useState<string[]>([]);
  const list: Json[] = claim.diagnoses || [];
  const addAll = async () => { for (const icd of pending) { const r = await run("dx", "claim.addDiagnosis", { claimId: claim.id, interventionCode: code || svc[0]?.code, icd }); if (!r) return; } setPending([]); toast("Diagnosis added"); };
  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold">Diagnoses on the claim</h3>
      <div className="flex flex-wrap gap-1.5">
        {list.map((x) => (
          <span key={`${x.code}-${x.intervention}`} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand">
            <span className="font-mono">{x.code}</span>{x.name && <span className="text-muted">{x.name}</span>}
            {editable && <button className="grid h-5 w-5 place-items-center rounded-full hover:bg-white" aria-label={`Remove ${x.code}`} disabled={!!busy} onClick={() => run("rmdx", "claim.removeDiagnosis", { claimId: claim.id, interventionCode: x.intervention || svc[0]?.code, icd: x.code })}><Trash2 size={11} /></button>}
          </span>
        ))}
        {list.length === 0 && <span className="text-xs text-muted">No diagnosis on the claim yet. SHA needs at least one.</span>}
      </div>
      {editable && (
        <div className="space-y-2">
          {svc.length > 1 && <label className="block max-w-sm"><span className="label">For service</span><select className="input" value={code} onChange={(e) => setCode(e.target.value)}>{svc.map((i) => <option key={i.code} value={i.code}>{i.code} {i.name}</option>)}</select></label>}
          <IcdInput value={pending} onChange={setPending} />
          {pending.length > 0 && <button className="btn btn-secondary btn-sm" onClick={addAll} disabled={!!busy}>{busy === "dx" ? "Adding" : "Add to the claim"}</button>}
        </div>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

function ClaimDocuments({ claim, editable }: { claim: Json; editable: boolean }) {
  const { busy, error, run } = useStep();
  const svc = activeServices(claim);
  const [code, setCode] = useState(svc[0]?.code || "");
  const [docs, setDocs] = useState<Attach[]>([]);
  const list: Json[] = claim.attachments || [];
  const send = async () => { for (const f of files(docs)) { const r = await run("doc", "claim.addAttachment", { claimId: claim.id, interventionCode: code || svc[0]?.code, file: f }); if (!r) return; } setDocs([]); toast("Document sent to SHA"); };
  const types = (svc.find((i) => i.code === code) || svc[0])?.docTypes;
  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold">Documents on the claim</h3>
      <ul className="space-y-1 text-[13px]">
        {list.map((a) => <li key={a.id || a.title}>{a.title}{a.type && <span className="text-xs text-muted">, {docLabel(a.type)}</span>}</li>)}
        {list.length === 0 && <li className="text-xs text-muted">No documents yet.</li>}
      </ul>
      {editable && (
        <div className="space-y-2">
          {svc.length > 1 && <label className="block max-w-sm"><span className="label">For service</span><select className="input" value={code} onChange={(e) => setCode(e.target.value)}>{svc.map((i) => <option key={i.code} value={i.code}>{i.code} {i.name}</option>)}</select></label>}
          <FilePicker value={docs} onChange={setDocs} types={types} label="Choose documents" />
          {docs.length > 0 && <button className="btn btn-secondary btn-sm" onClick={send} disabled={!!busy}>{busy ? "Sending" : "Send to SHA"}</button>}
        </div>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

export function BillingCard({ claim }: { claim: Json }) {
  const editable = claimEditable(claim);
  if (claim.serviceType === "EMERGENCY") return <EmergencyBilling claim={claim} editable={editable} />;
  if (claim.status === "Awaiting visit") return null;
  return (
    <Section title="Billing" hint="What is billed to SHA. Prices cannot be above the SHA tariff.">
      <Lines claim={claim} editable={editable} />
      {editable && <AddLine key={(claim.interventions || []).length} claim={claim} />}
      <div className="grid gap-6 lg:grid-cols-2"><ClaimDiagnoses claim={claim} editable={editable} /><ClaimDocuments claim={claim} editable={editable} /></div>
    </Section>
  );
}

// ---------------------------------------------------------------- emergency billing

type Protocol = { code: string; name: string; tariff: number | null };

function EmergencyBilling({ claim, editable }: { claim: Json; editable: boolean }) {
  const { busy, error, setError, run } = useStep();
  const code: string = activeServices(claim)[0]?.code || "";
  const [protocols, setProtocols] = useState<Protocol[] | null>(null);
  const [pc, setPc] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [dx, setDx] = useState<string[]>((claim.diagnoses || []).map((x: Json) => x.code).filter(Boolean));
  const [docs, setDocs] = useState<Attach[]>([]);
  const [doctor, setDoctor] = useState("");
  useEffect(() => { if (editable && code) run("proto", "emergency.protocols", { interventionCode: code }).then((r) => r && setProtocols(r.protocols as Protocol[])); }, [code, editable]); // eslint-disable-line react-hooks/exhaustive-deps
  const proto = protocols?.find((p) => p.code === pc);
  const add = async () => {
    setError("");
    const r = await run("add", "emergency.addProtocol", { claimId: claim.id, interventionCode: code, protocolCode: pc, unitPrice: Number(price), quantity: Number(qty) || 1, tariff: proto?.tariff || undefined, diagnoses: dx, attachments: files(docs) });
    if (r) { toast("Protocol added to the bill"); setDocs([]); setQty("1"); }
  };
  const doctorOp = async (op: "add" | "remove" | "resend") => { const r = await run("doc" + op, "emergency.doctor", { claimId: claim.id, op, doctorId: doctor || undefined, interventionCode: code }); if (r) toast(op === "remove" ? "Doctor removed" : op === "add" ? "Doctor added. SHA asks them to confirm." : "Request sent again"); };
  return (
    <Section title="Billing and treating doctor" hint="Emergency claims are billed with the approved emergency protocols. SHA pays the protocol tariff.">
      <Lines claim={claim} editable={editable} />
      {editable && (
        <div className="space-y-4 rounded-lg border border-line p-4">
          <h3 className="text-[13px] font-semibold">Add a protocol</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Approved protocol" required span={2}>
              <select className="input" value={pc} onChange={(e) => { setPc(e.target.value); const p = protocols?.find((x) => x.code === e.target.value); setPrice(p?.tariff ? String(p.tariff) : ""); }}>
                <option value="">{protocols ? "Choose a protocol" : "Loading protocols"}</option>
                {(protocols || []).map((p) => <option key={p.code} value={p.code}>{p.code} {p.name}{p.tariff ? `, ${kes(p.tariff, 0)}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Price (KES)" required hint={proto?.tariff ? `Approved tariff ${kes(proto.tariff, 2)}.` : undefined}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
            <Field label="Quantity" required><input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
          </div>
          <div className="space-y-2"><div className="text-[13px] font-medium">Diagnoses (ICD-11)</div><IcdInput value={dx} onChange={setDx} /></div>
          <div className="space-y-2"><div className="text-[13px] font-medium">Documents</div><FilePicker value={docs} onChange={setDocs} types={activeServices(claim)[0]?.docTypes} /></div>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={add} disabled={!!busy || !pc || !Number(price) || (!!proto?.tariff && Number(price) > proto.tariff)}>{busy === "add" ? "Adding" : "Add to the bill"}</button></div>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold">Treating doctor</h3>
        <ul className="space-y-1 text-[13px]">{(claim.doctors || []).map((x: Json) => <li key={x.number}>{x.name || "Doctor"} <span className="text-xs text-muted">{x.number}{x.body ? `, ${x.body}` : ""}</span></li>)}{(claim.doctors || []).length === 0 && <li className="text-xs text-muted">No doctor on the claim yet. SHA asks the doctor to confirm.</li>}</ul>
        {editable && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-64"><DoctorSelect value={doctor} onChange={setDoctor} label="Doctor" /></div>
            <button className="btn btn-secondary btn-sm" disabled={!doctor || !!busy} onClick={() => doctorOp("add")}>Add doctor</button>
            <button className="btn btn-secondary btn-sm" disabled={!doctor || !!busy} onClick={() => doctorOp("resend")}>Resend request</button>
            {(claim.doctors || []).length > 0 && <button className="btn btn-ghost btn-sm hover:!text-bad" disabled={!!busy} onClick={() => doctorOp("remove")}>Remove doctor</button>}
          </div>
        )}
      </div>
      <ErrorLine text={error} />
    </Section>
  );
}
