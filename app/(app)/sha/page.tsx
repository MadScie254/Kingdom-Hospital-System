"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, FileClock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge, PageHeader, Tabs, toneOf } from "@/components/ui";
import { ResourcePage } from "@/components/resource";
import { useDB, useUser } from "@/lib/store";
import { fmtDate, kes } from "@/lib/format";
import type { ResourceDef } from "@/lib/registry";
import { VisitWizard } from "@/components/sha/visit-wizard";
import { EmergencyForm } from "@/components/sha/emergency-form";
import { SERVICE_LABEL, Section, timeLeft, useHieStatus } from "@/components/sha/common";

const OPEN = ["Awaiting visit", "Visit open", "Draft", "Ready to submit"];
const WITH_SHA = ["Submitted", "Under review", "Needs action", "Approved", "Sent for payment"];
const PROBLEM = ["Rejected", "Failed to submit", "Time barred"];
const SENT = [...WITH_SHA, ...PROBLEM, "Paid", "Closed"];

const sum = (rows: Record<string, any>[], labels: string[]) => rows.filter((x) => labels.includes(x.status)).reduce((a, x) => a + (Number(x.amount) || 0), 0);
const count = (rows: Record<string, any>[], labels: string[]) => rows.filter((x) => labels.includes(x.status)).length;

const def: ResourceDef = {
  collection: "shaClaims", title: "SHA claims", singular: "claim", readOnly: true,
  rowHref: (r) => `/sha/${r.id}`,
  tabs: [
    { label: "All", test: () => true },
    { label: "Open visits", test: (r) => OPEN.includes(r.status) },
    { label: "With SHA", test: (r) => WITH_SHA.includes(r.status) },
    { label: "Paid", test: (r) => r.status === "Paid" },
    { label: "Problems", test: (r) => PROBLEM.includes(r.status) },
    { label: "Earlier records", test: (r) => r.source !== "hie" },
  ],
  stats: (r) => [
    { label: "Open visits", value: count(r, OPEN), hint: "Not yet sent to SHA", icon: FileClock, tone: "mute" },
    { label: "With SHA", value: kes(sum(r, WITH_SHA), 0), hint: `${count(r, WITH_SHA)} claims, status from SHA`, icon: ShieldCheck, tone: "brand" },
    { label: "Paid by SHA", value: kes(sum(r, ["Paid"]), 0), icon: Banknote, tone: "ok" },
    { label: "Needs attention", value: count(r, [...PROBLEM, "Needs action"]), hint: "Rejected, failed or sent back", icon: ShieldAlert, tone: "bad" },
  ],
  filters: (c) => [
    { key: "kind", label: "Visit", options: Object.values(SERVICE_LABEL), get: (r) => SERVICE_LABEL[r.serviceType] || "Earlier record" },
    { key: "fund", label: "Fund", options: [...new Set(c.db.shaClaims.map((r) => r.fund).filter(Boolean))] as string[], get: (r) => r.fund },
  ],
  cols: (c) => [
    { key: "claimNo", header: "Claim", render: (r) => <div className="leading-tight"><Link href={`/sha/${r.id}`} className="font-semibold text-brand hover:underline">{r.claimNo}</Link>{r.visitNumber && <div className="font-mono text-xs text-muted">{r.visitNumber}</div>}</div>, value: (r) => r.claimNo },
    { key: "patient", header: "Patient", render: (r) => <div className="leading-tight">{r.patientId ? <Link href={`/patients/${r.patientId}`} className="font-medium hover:underline">{c.patientName(r.patientId)}</Link> : <span className="font-medium text-muted">{r.serviceType === "EMERGENCY" ? "Not identified yet" : "Unknown patient"}</span>}<div className="font-mono text-xs text-muted">{r.crId || c.patient(r.patientId)?.shaNumber || ""}</div></div>, value: (r) => (r.patientId ? c.patientName(r.patientId) : "") },
    { key: "intervention", header: "Service", render: (r) => <div className="max-w-[260px] leading-tight"><div className="truncate">{r.intervention || "Not stated"}</div>{(r.interventions || []).length > 1 && <div className="text-xs text-muted">and {(r.interventions || []).length - 1} more</div>}</div>, value: (r) => r.intervention || "" },
    { key: "kind", header: "Visit", render: (r) => SERVICE_LABEL[r.serviceType] || <span className="text-muted">Earlier record</span>, value: (r) => SERVICE_LABEL[r.serviceType] || "" },
    { key: "fund", header: "Fund" },
    { key: "submitted", header: "Date", render: (r) => fmtDate(r.submitted), value: (r) => r.submitted || "" },
    { key: "amount", header: "Claim total", render: (r) => kes(Number(r.amount) || 0, 0), value: (r) => Number(r.amount) || 0, align: "right" },
    {
      key: "status", header: "Status", value: (r) => r.status,
      render: (r) => {
        const left = r.serviceType === "EMERGENCY" && r.emergency?.deadline && !SENT.includes(r.status) ? timeLeft(r.emergency.deadline) : null;
        return <div><Badge tone={r.statusTone || toneOf(r.status)}>{r.status || "Unknown"}</Badge>{left && <div className={`mt-1 text-xs ${left.tone === "bad" ? "text-bad" : left.tone === "warn" ? "text-warn" : "text-muted"}`}>{left.text}</div>}{r.remarks && <div className="mt-1 max-w-[220px] text-xs text-warn">{r.remarks}</div>}</div>;
      },
    },
  ],
};

function Facility() {
  const d = useDB();
  const user = useUser();
  const h = d.settings[0] || {};
  const conn = useHieStatus();
  const row = (label: string, value: string) => <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 font-medium">{value || <span className="font-normal text-muted">Not set</span>}</dd></div>;
  return (
    <Section title="This facility, as SHA knows it" hint="SHA reads these codes with every request. They are set by an administrator.">
      <dl className="grid gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        {row("Hospital", h.name)}{row("MFL code", h.mflCode)}{row("FR code", h.frCode)}{row("Facility level", h.kephLevel)}
      </dl>
      <div className="flex flex-wrap gap-2 text-[13px]">
        <Badge tone={conn?.configured ? "ok" : "warn"}>{conn ? (conn.configured ? "Connected to SHA" : "Not connected to SHA yet") : "Checking"}</Badge>
        {conn?.host && <Badge tone="mute">{conn.host}</Badge>}
        {conn && <Badge tone={conn.callbacks ? "ok" : "mute"}>{conn.callbacks ? "SHA sends status updates" : "Status updates are read by pressing Refresh"}</Badge>}
      </div>
      {user?.role === "admin" ? <Link href="/settings" className="btn btn-secondary w-fit">Change in Settings</Link> : <p className="text-[13px] text-muted">Only an administrator can change these codes or test the connection.</p>}
    </Section>
  );
}

function OpenEmergencies() {
  const d = useDB();
  const rows = d.shaClaims.filter((c) => c.source === "hie" && c.serviceType === "EMERGENCY" && !SENT.includes(c.status));
  if (!rows.length) return null;
  return (
    <Section title="Emergency claims still to send" hint="Each must reach SHA within 24 hours of arrival.">
      <ul className="divide-y divide-line-2 rounded-lg border border-line">
        {rows.map((c) => { const t = c.emergency?.deadline ? timeLeft(c.emergency.deadline) : null; return (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
            <div><Link href={`/sha/${c.id}`} className="font-semibold text-brand hover:underline">{c.claimNo}</Link><div className="text-xs text-muted">{c.patientId ? d.patients.find((p) => p.id === c.patientId)?.name : "Patient not identified yet"}</div></div>
            {t && <span className={t.tone === "bad" ? "font-medium text-bad" : t.tone === "warn" ? "font-medium text-warn" : "text-muted"}>{t.text}</span>}
          </li>
        ); })}
      </ul>
    </Section>
  );
}

export default function Sha() {
  const d = useDB();
  const [tab, setTab] = useState("claims");
  const [patientId, setPatientId] = useState<number | undefined>();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = Number(q.get("patient"));
    if (p) { setPatientId(p); setTab("visit"); }
    else if (q.get("tab") && ["claims", "visit", "emergency", "facility"].includes(q.get("tab")!)) setTab(q.get("tab")!);
  }, []);
  const open = d.shaClaims.filter((c) => c.source === "hie" && c.serviceType === "EMERGENCY" && !SENT.includes(c.status)).length;
  return (
    <div>
      <PageHeader title="SHA" description="Check cover, take the patient's consent, request preauthorisation and send claims to the Social Health Authority. Every status comes from SHA." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "claims", label: "Claims", count: d.shaClaims.length }, { value: "visit", label: "Eligibility and new visit" }, { value: "emergency", label: "Emergency", count: open || undefined }, { value: "facility", label: "Facility" }]} />
      <div className="mt-5">
        {tab === "claims" && <ResourcePage def={def} embedded />}
        {tab === "visit" && <VisitWizard initialPatientId={patientId} />}
        {tab === "emergency" && <div className="space-y-5"><EmergencyForm /><OpenEmergencies /></div>}
        {tab === "facility" && <Facility />}
      </div>
    </div>
  );
}
