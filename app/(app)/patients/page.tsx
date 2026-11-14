"use client";
import { Users, AlertTriangle, ShieldCheck, UserPlus } from "lucide-react";
import { ResourcePage } from "@/components/resource";
import { Avatar } from "@/components/ui";
import type { ResourceDef } from "@/lib/registry";
import { invoiceTotals } from "@/lib/billing";
import { ANCHOR, addDays, age, fmtDate, kes } from "@/lib/format";

const def: ResourceDef = {
  collection: "patients", title: "Patients", singular: "patient", description: "Every registered patient with cover details and outstanding balance. Open a patient to see the full chart.",
  addLabel: "Register patient", addHref: "/patients/new", readOnly: true, rowHref: (r) => `/patients/${r.id}`, pageSize: 12,
  derive: (c) => c.db.patients.map((p) => {
    const inv = c.db.invoices.filter((i) => i.patientId === p.id && i.status !== "Draft");
    const visits = c.db.visits.filter((v) => v.patientId === p.id).map((v) => v.date).sort().reverse();
    return { ...p, balance: inv.reduce((a, i) => a + invoiceTotals(i).total - i.paid, 0), lastVisit: visits[0] || "", admitted: c.db.admissions.some((a) => a.patientId === p.id && a.status === "Admitted") };
  }),
  stats: (r) => [
    { label: "Registered patients", value: r.length, icon: Users, tone: "brand" },
    { label: "New this month", value: r.filter((p) => p.registered >= ANCHOR.slice(0, 8) + "01").length, icon: UserPlus, tone: "teal" },
    { label: "Covered by SHA", value: r.filter((p) => p.shaNumber).length, hint: `${r.filter((p) => !p.shaNumber).length} without a SHA number`, icon: ShieldCheck, tone: "ok" },
    { label: "With a balance", value: r.filter((p) => p.balance > 0).length, icon: AlertTriangle, tone: "warn" },
  ],
  filters: () => [{ key: "g", label: "Gender", options: ["Female", "Male"], get: (r) => r.gender }, { key: "cover", label: "Cover", options: ["SHA", "Jubilee Insurance", "AAR"], get: (r) => r.insurer }],
  cols: () => [
    { key: "mrn", header: "Record no", render: (r) => <span className="tabular-nums text-muted">{r.mrn}</span>, value: (r) => r.mrn },
    { key: "name", header: "Patient", render: (r) => <div className="flex items-center gap-2.5"><Avatar name={r.name} size={30} /><div className="leading-tight"><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{age(r.dob)} years, {r.gender}</div></div></div>, value: (r) => r.name },
    { key: "phone", header: "Phone" },
    { key: "cover", header: "Cover", render: (r) => <div className="leading-tight"><div>{r.insurer}</div><div className="text-xs text-muted">{r.shaNumber || "No SHA number"}</div></div>, value: (r) => r.insurer },
    { key: "lastVisit", header: "Last visit", render: (r) => (r.lastVisit ? fmtDate(r.lastVisit) : "No visits yet"), value: (r) => r.lastVisit },
    { key: "balance", header: "Balance", render: (r) => <span className={r.balance > 0 ? "font-semibold text-bad" : "text-muted"}>{kes(r.balance, 0)}</span>, value: (r) => r.balance, align: "right" },
  ],
};

export default function Patients() {
  return <ResourcePage def={def} />;
}
export const _d = addDays;
