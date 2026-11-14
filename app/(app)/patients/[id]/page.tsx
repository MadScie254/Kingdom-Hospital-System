"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { BedDouble, CalendarPlus, FlaskConical, Pencil, Receipt, AlertTriangle, Phone, Mail, MapPin, IdCard, UserRound } from "lucide-react";
import { ResourcePage } from "@/components/resource";
import { RESOURCES } from "@/lib/registry";
import { ACTION_ROLES, canRead, canWrite } from "@/lib/access";
import type { CollectionName } from "@/lib/collections";
import { useDB, useLookup, useUser } from "@/lib/store";
import { Avatar, Badge, Status, Tabs, Empty } from "@/components/ui";
import { FlagBadge } from "@/components/lab";
import { invoiceTotals } from "@/lib/billing";
import { rangeText } from "@/lib/lab";
import type { Row } from "@/lib/seed";
import { age, ANCHOR, fmtDate, fmtDateTime, fmtTime, kes } from "@/lib/format";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const key = `patients/${id}`;
  if (RESOURCES[key]) return <ResourcePage k={key} />;
  return <Profile id={Number(id)} />;
}

const Vital = ({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) => (
  <div className="rounded-lg border border-line-2 p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}{unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}</div></div>
);

function Profile({ id }: { id: number }) {
  const d = useDB();
  const L = useLookup();
  const [tab, setTab] = useState("overview");
  const role = useUser()?.role;
  const can = (c: CollectionName) => canRead(role, c);
  const p = d.patients.find((x) => x.id === id);
  if (!p) { if (d.patients.length) notFound(); return null; }

  const visits = d.visits.filter((v) => v.patientId === id).sort((a, b) => b.date.localeCompare(a.date));
  const labs = d.labOrders.filter((o) => o.patientId === id).sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  const rx = d.prescriptions.filter((x) => x.patientId === id);
  const invs = d.invoices.filter((i) => i.patientId === id).map((i) => ({ ...i, total: invoiceTotals(i).total }) as Row);
  const balance = invs.filter((i) => i.status !== "Draft").reduce((a, i) => a + i.total - i.paid, 0);
  const docs = d.documents.filter((x) => x.patientId === id);
  const claims = d.shaClaims.filter((c) => c.patientId === id);
  const adm = d.admissions.find((a) => a.patientId === id && a.status === "Admitted");
  const bed = adm && d.beds.find((b) => b.id === adm.bedId);
  const next = d.appointments.filter((a) => a.patientId === id && a.date >= ANCHOR && a.status !== "Cancelled").sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = visits[0];
  const bmi = p.heightCm && p.weightKg ? (p.weightKg / (p.heightCm / 100) ** 2).toFixed(1) : "";
  const hasAllergy = p.allergies && p.allergies !== "None known";

  const stats: [string, React.ReactNode][] = [];
  if (can("invoices")) stats.push(["Outstanding balance", <span key="b" className={balance > 0 ? "text-bad" : "text-ok"}>{kes(balance, 0)}</span>]);
  if (can("visits")) stats.push(["Last visit", last ? fmtDate(last.date) : "No visits yet"]);
  if (can("appointments")) stats.push(["Next appointment", next ? `${fmtDate(next.date)} ${fmtTime(next.date)}` : "None booked"]);
  if (can("visits")) stats.push(["Total visits", visits.length]);
  const tabs = [
    { value: "overview", label: "Overview" },
    ...(can("visits") ? [{ value: "visits", label: "Visits", count: visits.length }] : []),
    ...(can("labOrders") ? [{ value: "lab", label: "Laboratory", count: labs.length }] : []),
    ...(can("prescriptions") ? [{ value: "meds", label: "Medication", count: rx.length }] : []),
    ...(can("invoices") ? [{ value: "billing", label: "Billing", count: invs.length }] : []),
    ...(can("documents") || can("shaClaims") ? [{ value: "docs", label: "Documents and claims", count: docs.length + claims.length }] : []),
  ];

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-muted"><Link href="/patients" className="hover:text-brand hover:underline">Patients</Link> / {p.name}</nav>
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Avatar name={p.name} size={64} />
            <div>
              <h1 className="text-2xl font-semibold leading-tight">{p.name}</h1>
              <div className="mt-1 text-[13px] text-muted">{p.mrn}, {age(p.dob)} years, {p.gender}, born {fmtDate(p.dob)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="info" plain>{p.bloodGroup || "Blood group unknown"}</Badge>
                {(p.shaNumber || p.insurer) && <Badge tone={p.shaNumber ? "ok" : "mute"} plain>{p.shaNumber ? `SHA ${p.shaNumber}` : p.insurer}</Badge>}
                {adm && <Badge tone="info">Admitted, {bed?.code}</Badge>}
                {hasAllergy && <Badge tone="bad"><AlertTriangle size={11} />Allergy: {p.allergies}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite(role, "patients") && <Link href={`/patients/new?edit=${p.id}`} className="btn btn-secondary"><Pencil size={15} />Edit</Link>}
            {canWrite(role, "appointments") && <Link href="/appointments" className="btn btn-secondary"><CalendarPlus size={15} />Book</Link>}
            {canWrite(role, "labOrders") && <Link href="/lab" className="btn btn-secondary"><FlaskConical size={15} />Order lab</Link>}
            {!adm && !!role && ACTION_ROLES["admission.admit"].includes(role) && <Link href="/admissions" className="btn btn-secondary"><BedDouble size={15} />Admit</Link>}
            {!!role && ACTION_ROLES["invoice.create"].includes(role) && <Link href="/billing/new" className="btn btn-primary"><Receipt size={15} />New invoice</Link>}
          </div>
        </div>
        {stats.length > 0 && (
          <dl className={`mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 ${stats.length === 4 ? "md:grid-cols-4" : stats.length === 3 ? "md:grid-cols-3" : ""}`}>
            {stats.map(([k, v], i) => (
              <div key={i} className="bg-white px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        )}
      </section>

      <div className="mt-5"><Tabs value={tab} onChange={setTab} tabs={tabs} /></div>

      <div className="mt-5">
        {tab === "overview" && (
          <div className={`grid gap-5 ${can("visits") ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
            {can("visits") && <div className="space-y-5 xl:col-span-2">
              <section className="card">
                <div className="card-head"><h2 className="card-title">Latest vitals</h2><span className="text-xs text-muted">{last ? fmtDateTime(last.date) : ""}</span></div>
                {last ? <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5"><Vital label="Blood pressure" value={last.bp} unit="mmHg" /><Vital label="Temperature" value={last.temp} unit="C" /><Vital label="Pulse" value={last.pulse} unit="bpm" /><Vital label="Oxygen saturation" value={last.spo2} unit="%" /><Vital label="Weight" value={last.weight} unit="kg" /></div> : <Empty title="No vitals recorded" hint="Vitals appear after the first consultation." />}
                {bmi && <p className="border-t border-line-2 px-5 py-3 text-xs text-muted">Height {p.heightCm} cm, body mass index {bmi}.</p>}
              </section>
              <section className="card">
                <div className="card-head"><h2 className="card-title">Recent consultations</h2></div>
                <ul className="divide-y divide-line-2">
                  {visits.slice(0, 4).map((v) => (
                    <li key={v.id} className="px-5 py-3.5 text-[13px]"><div className="flex items-center justify-between"><span className="font-medium">{v.diagnosis}</span><span className="text-xs text-muted">{fmtDate(v.date)}</span></div><div className="mt-0.5 text-muted">{v.complaint}. {L.doctorName(v.doctorId)}. {v.treatment}.</div></li>
                  ))}
                  {visits.length === 0 && <li><Empty title="No consultations yet" /></li>}
                </ul>
              </section>
            </div>}
            <div className="space-y-5">
              {adm && bed && (
                <section className="card border-[#c9dcef] bg-info-50 p-5"><h2 className="card-title text-info">Currently admitted</h2><p className="mt-1 text-[13px]">{bed.ward}, bed {bed.code}. Since {fmtDateTime(adm.admittedAt)} for {adm.diagnosis.toLowerCase()}, under {L.doctorName(adm.doctorId)}.</p></section>
              )}
              <section className="card p-5">
                <h2 className="card-title mb-3">Contact</h2>
                <ul className="space-y-3 text-[13px]">
                  <li className="flex gap-2.5"><Phone size={15} className="mt-0.5 text-faint" />{p.phone}</li>
                  <li className="flex gap-2.5"><Mail size={15} className="mt-0.5 text-faint" />{p.email || "No email"}</li>
                  <li className="flex gap-2.5"><MapPin size={15} className="mt-0.5 text-faint" />{p.address}</li>
                  <li className="flex gap-2.5"><IdCard size={15} className="mt-0.5 text-faint" />ID {p.nationalId}</li>
                  <li className="flex gap-2.5"><UserRound size={15} className="mt-0.5 text-faint" /><span>Next of kin: {p.nextOfKin}<br /><span className="text-muted">{p.nextOfKinPhone}</span></span></li>
                </ul>
              </section>
            </div>
          </div>
        )}
        {tab === "visits" && (
          <section className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Date</th><th>Doctor</th><th>Complaint</th><th>Diagnosis</th><th>Treatment</th><th>BP</th><th>Status</th></tr></thead><tbody>{visits.map((v) => <tr key={v.id}><td>{fmtDate(v.date)}</td><td>{L.doctorName(v.doctorId)}</td><td>{v.complaint}</td><td>{v.diagnosis}</td><td>{v.treatment}</td><td className="tabular-nums">{v.bp}</td><td><Status value={v.status} /></td></tr>)}</tbody></table>{visits.length === 0 && <Empty title="No visits on record" />}</section>
        )}
        {tab === "lab" && (
          <section className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Ordered</th><th>Test</th><th>Result</th><th>Flag</th><th>Reference</th><th>Status</th><th /></tr></thead><tbody>{labs.map((o) => { const t = d.labCatalog.find((x) => x.id === o.testId)!; return <tr key={o.id}><td>{fmtDate(o.orderedAt)}</td><td className="font-medium">{t.name}</td><td className="tabular-nums">{o.result === null ? "Pending" : `${o.result} ${t.unit}`}</td><td><FlagBadge flag={o.flag} /></td><td className="text-muted">{rangeText(t)}</td><td><Status value={o.status} /></td><td>{o.status === "Released" && <Link className="btn btn-ghost btn-sm" href={`/lab/report/${o.id}`}>Report</Link>}</td></tr>; })}</tbody></table>{labs.length === 0 && <Empty title="No laboratory requests" />}</section>
        )}
        {tab === "meds" && (
          <div className="space-y-3">{rx.map((r) => <section key={r.id} className="card p-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">RX{String(r.id).padStart(4, "0")}, {fmtDate(r.date)}</h3><Link className="btn btn-ghost btn-sm" href={`/prescriptions/${r.id}`}>Print</Link></div><div className="mb-2 text-xs text-muted">Prescribed by {L.doctorName(r.doctorId)}</div><ul className="space-y-1 text-[13px]">{r.items.map((i: any, k: number) => <li key={k}>{i.medicine}: {i.dose}, {i.frequency.toLowerCase()}, {i.days} days</li>)}</ul></section>)}{rx.length === 0 && <section className="card"><Empty title="No prescriptions" /></section>}</div>
        )}
        {tab === "billing" && (
          <section className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Invoice</th><th>Date</th><th>Source</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead><tbody>{invs.map((i) => <tr key={i.id}><td><Link href={`/billing/${i.no}`} className="font-semibold text-brand hover:underline">{i.no}</Link></td><td>{fmtDate(i.date)}</td><td>{i.source}</td><td className="num">{kes(i.total)}</td><td className="num">{kes(i.paid)}</td><td className="num font-medium">{kes(i.total - i.paid)}</td><td><Status value={i.status} /></td></tr>)}</tbody></table>{invs.length === 0 && <Empty title="No invoices" />}</section>
        )}
        {tab === "docs" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card"><div className="card-head"><h2 className="card-title">Documents</h2></div><ul className="divide-y divide-line-2">{docs.map((x) => <li key={x.id} className="flex justify-between px-5 py-3 text-[13px]"><span>{x.title}</span><span className="text-muted">{x.type}, {fmtDate(x.uploaded)}</span></li>)}{docs.length === 0 && <li><Empty title="No documents" /></li>}</ul></section>
            <section className="card"><div className="card-head"><h2 className="card-title">SHA claims</h2></div><ul className="divide-y divide-line-2">{claims.map((c) => <li key={c.id} className="flex items-center justify-between px-5 py-3 text-[13px]"><span>{c.claimNo}<span className="block text-xs text-muted">{c.intervention}</span></span><span className="flex items-center gap-3"><span className="tabular-nums">{kes(c.amount, 0)}</span><Status value={c.status} /></span></li>)}{claims.length === 0 && <li><Empty title="No claims" /></li>}</ul></section>
          </div>
        )}
      </div>
    </div>
  );
}
