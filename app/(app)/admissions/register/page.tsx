"use client";
import Link from "next/link";
import { BedDouble, CheckCircle2, LogOut, Wallet } from "lucide-react";
import { ResourcePage } from "@/components/resource";
import { Avatar, Status } from "@/components/ui";
import type { ResourceDef } from "@/lib/registry";
import { ANCHOR, daysBetween, fmtDateTime, kes } from "@/lib/format";

const def: ResourceDef = {
  collection: "admissions", title: "Admission register", singular: "admission", crumbs: [{ label: "Admissions", href: "/admissions" }, { label: "Register" }], description: "Every admission with length of stay and accrued bed charges. Discharge from the bed board.", readOnly: true,
  derive: (c) => c.db.admissions.map((a) => { const bed = c.db.beds.find((b) => b.id === a.bedId); const days = Math.max(1, daysBetween(a.admittedAt, a.dischargedAt || ANCHOR)); return { ...a, code: bed?.code ?? "", ward: bed?.ward ?? "", days, charges: days * (bed?.price ?? 0) }; }),
  stats: (r) => [{ label: "Currently admitted", value: r.filter((x) => x.status === "Admitted").length, icon: BedDouble, tone: "brand" }, { label: "Discharged", value: r.filter((x) => x.status === "Discharged").length, icon: LogOut, tone: "teal" }, { label: "Average stay", value: `${(r.reduce((a, x) => a + x.days, 0) / (r.length || 1)).toFixed(1)} days`, icon: CheckCircle2, tone: "ok" }, { label: "Bed charges accrued", value: kes(r.filter((x) => x.status === "Admitted").reduce((a, x) => a + x.charges, 0), 0), icon: Wallet, tone: "warn" }],
  filters: (c) => [{ key: "st", label: "Status", options: ["Admitted", "Discharged"], get: (r) => r.status }, { key: "ward", label: "Ward", options: [...new Set(c.db.beds.map((b) => b.ward))], get: (r) => r.ward }],
  cols: (c) => [
    { key: "code", header: "Bed", render: (r) => <div className="leading-tight"><div className="font-semibold">{r.code}</div><div className="text-xs text-muted">{r.ward}</div></div>, value: (r) => r.code },
    { key: "patient", header: "Patient", render: (r) => <Link href={`/patients/${r.patientId}`} className="flex items-center gap-2.5 hover:underline"><Avatar name={c.patientName(r.patientId)} size={28} /><span className="font-medium">{c.patientName(r.patientId)}</span></Link>, value: (r) => c.patientName(r.patientId) },
    { key: "doctor", header: "Doctor", value: (r) => c.doctorName(r.doctorId) }, { key: "diagnosis", header: "Diagnosis" },
    { key: "admittedAt", header: "Admitted", render: (r) => fmtDateTime(r.admittedAt) },
    { key: "dischargedAt", header: "Discharged", render: (r) => (r.dischargedAt ? fmtDateTime(r.dischargedAt) : "Still admitted"), value: (r) => r.dischargedAt },
    { key: "days", header: "Days", align: "right" }, { key: "charges", header: "Bed charges", render: (r) => kes(r.charges, 0), value: (r) => r.charges, align: "right" },
    { key: "status", header: "Status", render: (r) => <Status value={r.status} /> },
  ],
};
export default function Page() {
  return <ResourcePage def={def} />;
}
