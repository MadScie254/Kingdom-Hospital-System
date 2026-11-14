"use client";
import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { useDB, useLookup } from "@/lib/store";
import { Empty, Field, PageHeader } from "@/components/ui";
import { DocFooter, DocHeader } from "@/components/documents";
import { FlagBadge } from "@/components/lab";
import { invoiceTotals } from "@/lib/billing";
import { rangeText } from "@/lib/lab";
import { age, fmtDate, kes } from "@/lib/format";

export default function Summary() {
  const d = useDB();
  const L = useLookup();
  const [pid, setPid] = useState("");
  const p = d.patients.find((x) => x.id === Number(pid));
  const visits = p ? d.visits.filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const labs = p ? d.labOrders.filter((o) => o.patientId === p.id && o.status === "Released").sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)) : [];
  const abnormal = labs.filter((o) => o.flag && o.flag !== "Normal").slice(0, 6);
  const rx = p ? d.prescriptions.filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const adm = p ? d.admissions.filter((a) => a.patientId === p.id) : [];
  const bal = p ? d.invoices.filter((i) => i.patientId === p.id && i.status !== "Draft").reduce((a, i) => a + invoiceTotals(i).total - i.paid, 0) : 0;
  const problems = [...new Set(visits.map((v) => v.diagnosis))].slice(0, 6);
  const last = visits[0];

  return (
    <div>
      <PageHeader title="Patient summary" crumbs={[{ label: "Clinical tools" }, { label: "Patient summary" }]} description="A one page clinical handover compiled from the patient record: problems, medication, abnormal results and admissions."
        actions={p && <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print summary</button>} />
      <div className="no-print mb-5 max-w-md"><Field label="Patient"><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Choose a patient</option>{d.patients.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.mrn})</option>)}</select></Field></div>
      {!p ? <section className="card"><Empty title="Choose a patient to build the summary" hint="The summary reads straight from visits, laboratory, prescriptions and admissions, so it is always current." /></section> : (
        <article className="print-sheet mx-auto max-w-[900px] rounded-[10px] border border-line bg-white p-10 shadow-[0_2px_18px_rgba(12,31,58,0.07)]">
          <DocHeader title="Patient summary" lines={[{ k: "Prepared", v: fmtDate("2026-11-14") }, { k: "Record number", v: p.mrn }]} />
          <section className="mt-6 grid grid-cols-2 gap-8 text-[13px]">
            <div><div className="text-xl font-semibold">{p.name}</div><div className="mt-1 text-muted">{age(p.dob)} years, {p.gender}, {p.bloodGroup || "blood group unknown"}</div><div className="text-muted">{p.phone}, {p.address}</div></div>
            <div className="space-y-1.5"><div><span className="text-muted">Cover: </span>{p.shaNumber ? `SHA ${p.shaNumber}` : p.insurer}</div><div><span className="text-muted">Next of kin: </span>{p.nextOfKin}, {p.nextOfKinPhone}</div><div><span className="text-muted">Outstanding balance: </span>{kes(bal, 0)}</div></div>
          </section>
          {p.allergies && p.allergies !== "None known" && <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#f2c6c2] bg-bad-50 px-4 py-2.5 text-[13px] text-bad"><AlertTriangle size={16} /><strong>Allergy:</strong> {p.allergies}</div>}
          <div className="mt-6 grid gap-7 md:grid-cols-2">
            <section><h2 className="mb-2 text-sm font-semibold text-ink">Problems on record</h2>{problems.length ? <ul className="list-disc space-y-1 pl-5 text-[13px]">{problems.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-[13px] text-muted">No diagnoses recorded.</p>}</section>
            <section><h2 className="mb-2 text-sm font-semibold text-ink">Latest vitals</h2>{last ? <p className="text-[13px] leading-relaxed">Blood pressure {last.bp}, temperature {last.temp} C, pulse {last.pulse}, oxygen saturation {last.spo2}%, weight {last.weight} kg. Recorded {fmtDate(last.date)}.</p> : <p className="text-[13px] text-muted">No vitals recorded.</p>}</section>
            <section><h2 className="mb-2 text-sm font-semibold text-ink">Current medication</h2>{rx ? <ul className="space-y-1 text-[13px]">{rx.items.map((i: any, k: number) => <li key={k}>{i.medicine}: {i.dose}, {i.frequency.toLowerCase()}, {i.days} days</li>)}<li className="text-xs text-muted">Prescribed {fmtDate(rx.date)} by {L.doctorName(rx.doctorId)}</li></ul> : <p className="text-[13px] text-muted">No prescriptions on record.</p>}</section>
            <section><h2 className="mb-2 text-sm font-semibold text-ink">Admissions</h2>{adm.length ? <ul className="space-y-1 text-[13px]">{adm.map((a) => <li key={a.id}>{a.diagnosis}, {fmtDate(a.admittedAt)}{a.dischargedAt ? ` to ${fmtDate(a.dischargedAt)}` : ", currently admitted"}</li>)}</ul> : <p className="text-[13px] text-muted">No admissions.</p>}</section>
          </div>
          <section className="mt-7"><h2 className="mb-2 text-sm font-semibold text-ink">Results outside the reference range</h2>
            {abnormal.length ? <table className="w-full text-[13px]"><tbody>{abnormal.map((o) => { const t = d.labCatalog.find((x) => x.id === o.testId)!; return <tr key={o.id} className="border-b border-line-2"><td className="py-2 font-medium">{t.name}</td><td className="py-2 tabular-nums">{String(o.result)} {t.unit}</td><td className="py-2"><FlagBadge flag={o.flag} /></td><td className="py-2 text-muted">{rangeText(t)}</td><td className="py-2 text-right text-muted">{fmtDate(o.orderedAt)}</td></tr>; })}</tbody></table> : <p className="text-[13px] text-muted">No abnormal results on record.</p>}
          </section>
          <section className="mt-7"><h2 className="mb-2 text-sm font-semibold text-ink">Recent consultations</h2><ul className="space-y-2 text-[13px]">{visits.slice(0, 4).map((v) => <li key={v.id}><span className="font-medium">{fmtDate(v.date)}, {v.diagnosis}.</span> <span className="text-muted">{v.complaint}. {v.treatment}. {L.doctorName(v.doctorId)}.</span></li>)}</ul></section>
          <DocFooter>Compiled from the hospital record. Review against the full chart before clinical decisions.</DocFooter>
        </article>
      )}
    </div>
  );
}
