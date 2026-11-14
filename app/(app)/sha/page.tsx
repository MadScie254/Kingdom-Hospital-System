"use client";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Banknote, FileClock, ShieldAlert, ShieldCheck, Search } from "lucide-react";
import { PageHeader, Status, Tabs, toast } from "@/components/ui";
import { ResourcePage } from "@/components/resource";
import { db, useDB } from "@/lib/store";
import { fmtDate, kes } from "@/lib/format";
import type { ResourceDef } from "@/lib/registry";

const NEXT: Record<string, [string, string]> = { Draft: ["Submitted", "Submit"], Submitted: ["Approved", "Mark approved"], Approved: ["Paid", "Mark paid"], Rejected: ["Submitted", "Resubmit"] };

const def: ResourceDef = {
  collection: "shaClaims", title: "SHA claims", singular: "claim", readOnly: true,
  rowHref: undefined,
  extra: (r) => { const n = NEXT[r.status]; return n ? <button className="btn btn-secondary btn-sm" onClick={() => { db.update("shaClaims", r.id, { status: n[0], remarks: n[0] === "Submitted" ? "" : r.remarks }); toast(`Claim ${r.claimNo} ${n[0].toLowerCase()}`); }}>{n[1]}</button> : null; },
  tabs: [{ label: "All", test: () => true }, { label: "Draft", test: (r) => r.status === "Draft" }, { label: "Submitted", test: (r) => r.status === "Submitted" }, { label: "Approved", test: (r) => r.status === "Approved" }, { label: "Paid", test: (r) => r.status === "Paid" }, { label: "Rejected", test: (r) => r.status === "Rejected" }],
  stats: (r) => { const sum = (s: string[]) => r.filter((x) => s.includes(x.status)).reduce((a, x) => a + x.amount, 0); return [
    { label: "Ready to submit", value: kes(sum(["Draft"]), 0), hint: `${r.filter((x) => x.status === "Draft").length} draft claims`, icon: FileClock, tone: "mute" },
    { label: "Awaiting payment", value: kes(sum(["Submitted", "Approved"]), 0), hint: "Submitted or approved", icon: BadgeCheck, tone: "brand" },
    { label: "Paid by SHA", value: kes(sum(["Paid"]), 0), icon: Banknote, tone: "ok" },
    { label: "Rejected", value: kes(sum(["Rejected"]), 0), hint: "Correct and resubmit", icon: ShieldAlert, tone: "bad" }]; },
  filters: () => [{ key: "fund", label: "Fund", options: ["PHC Fund", "SHIF", "ECCIF"], get: (r) => r.fund }],
  cols: (c) => [
    { key: "claimNo", header: "Claim", render: (r) => <span className="font-semibold">{r.claimNo}</span> },
    { key: "patient", header: "Patient", render: (r) => <div className="leading-tight"><Link href={`/patients/${r.patientId}`} className="font-medium hover:underline">{c.patientName(r.patientId)}</Link><div className="text-xs text-muted">{c.patient(r.patientId)?.shaNumber || "No SHA number"}</div></div>, value: (r) => c.patientName(r.patientId) },
    { key: "invoiceNo", header: "Invoice", render: (r) => <Link href={`/billing/${r.invoiceNo}`} className="text-brand hover:underline">{r.invoiceNo}</Link>, value: (r) => r.invoiceNo },
    { key: "intervention", header: "Intervention" }, { key: "fund", header: "Fund" },
    { key: "submitted", header: "Service date", render: (r) => fmtDate(r.submitted) },
    { key: "amount", header: "Claim amount", render: (r) => kes(r.amount, 0), value: (r) => r.amount, align: "right" },
    { key: "status", header: "Status", render: (r) => <div><Status value={r.status} />{r.remarks && <div className="mt-1 max-w-[200px] text-xs text-bad">{r.remarks}</div>}</div>, value: (r) => r.status },
  ],
};

export default function Sha() {
  const d = useDB();
  const h = d.settings[0];
  const [tab, setTab] = useState("claims");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<null | { found: any | null }>(null);
  const check = () => { const n = q.replace(/\s/g, "").toLowerCase(); if (!n) return; setRes({ found: d.patients.find((p) => p.shaNumber.toLowerCase() === n || p.nationalId === n) || null }); };
  return (
    <div>
      <PageHeader title="SHA claims" description="Track every Social Health Authority claim from draft to payment. Draft claims are created from invoices." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "claims", label: "Claims", count: d.shaClaims.length }, { value: "eligibility", label: "Eligibility check" }, { value: "facility", label: "Facility details" }]} />
      <div className="mt-5">
        {tab === "claims" && <ResourcePage def={def} embedded />}
        {tab === "eligibility" && (
          <section className="card card-pad max-w-2xl">
            <h2 className="card-title">Check a patient&apos;s SHA number</h2>
            <p className="mt-1 text-[13px] text-muted">Search by SHA number or national ID. This checks the number against registered patients. Live verification with the SHA portal is switched on once the hospital receives API credentials.</p>
            <div className="mt-5 flex gap-2.5"><div className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input h-10 pl-9" placeholder="SHA12345678 or national ID" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check()} aria-label="SHA number or national ID" /></div><button className="btn btn-primary h-10" onClick={check}>Check</button></div>
            {res && (res.found ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#bfe3cc] bg-ok-50 p-4"><ShieldCheck className="mt-0.5 text-ok" size={20} /><div className="text-[13px]"><div className="font-semibold text-ok">Number found on the patient register</div><div className="mt-1">{res.found.name}, {res.found.mrn}</div><div className="text-muted">SHA {res.found.shaNumber}, ID {res.found.nationalId}</div><Link href={`/patients/${res.found.id}`} className="mt-2 inline-block text-brand hover:underline">Open patient chart</Link></div></div>
            ) : <div className="mt-5 rounded-lg border border-line bg-surface p-4 text-[13px]">No registered patient has this number. <Link href="/patients/new" className="text-brand hover:underline">Register the patient</Link> and add their SHA number.</div>)}
          </section>
        )}
        {tab === "facility" && (
          <section className="card card-pad max-w-2xl"><h2 className="card-title mb-4">Facility details used on claims</h2><dl className="kv"><dt>Facility name</dt><dd>{h.name}</dd><dt>Facility code</dt><dd>{h.facilityCode || "Not set"}</dd><dt>KRA PIN</dt><dd>{h.kra || "Not set"}</dd><dt>Registration</dt><dd>{h.registration || "Not set"}</dd><dt>Address</dt><dd>{h.address}</dd></dl><Link href="/settings" className="btn btn-secondary mt-5">Edit in settings</Link></section>
        )}
      </div>
    </div>
  );
}
