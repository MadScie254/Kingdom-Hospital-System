"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Receipt, Wallet } from "lucide-react";
import { ResourcePage } from "@/components/resource";
import type { ResourceDef } from "@/lib/registry";
import { Avatar, Status } from "@/components/ui";
import { invoiceTotals } from "@/lib/billing";
import { ANCHOR, addDays, fmtDate, kes } from "@/lib/format";

const def: ResourceDef = {
  collection: "invoices", title: "Invoices", singular: "invoice", description: "Bills for consultations, lab tests, medicines and admissions. Open an invoice to print it or record a payment.",
  addLabel: "New invoice", addHref: "/billing/new", readOnly: true, pageSize: 12,
  derive: (c) => c.db.invoices.map((i) => { const t = invoiceTotals(i); return { ...i, total: t.total, balance: t.total - i.paid, overdue: i.status !== "Paid" && i.status !== "Draft" && i.dueDate < ANCHOR }; }),
  rowHref: (r) => `/billing/${r.no}`,
  tabs: [
    { label: "All", test: () => true }, { label: "Draft", test: (r) => r.status === "Draft" }, { label: "Due", test: (r) => r.status === "Due" },
    { label: "Partial", test: (r) => r.status === "Partial" }, { label: "Paid", test: (r) => r.status === "Paid" }, { label: "Overdue", test: (r) => r.overdue },
  ],
  stats: (r) => {
    const open = r.filter((x) => x.status !== "Draft");
    return [
      { label: "Outstanding", value: kes(open.reduce((a, x) => a + x.balance, 0), 0), hint: `${open.filter((x) => x.balance > 0).length} unpaid invoices`, icon: Wallet, tone: "warn" },
      { label: "Overdue", value: kes(r.filter((x) => x.overdue).reduce((a, x) => a + x.balance, 0), 0), hint: `${r.filter((x) => x.overdue).length} past due date`, icon: AlertTriangle, tone: "bad" },
      { label: "Paid, last 30 days", value: kes(r.filter((x) => x.status === "Paid" && x.date >= addDays(ANCHOR, -30)).reduce((a, x) => a + x.total, 0), 0), icon: CheckCircle2, tone: "ok" },
      { label: "Drafts", value: r.filter((x) => x.status === "Draft").length, hint: "Not yet issued", icon: FileText, tone: "brand" },
    ];
  },
  filters: () => [{ key: "src", label: "Source", options: ["OPD", "Inpatient", "Lab", "Pharmacy"], get: (r) => r.source }],
  cols: (c) => [
    { key: "no", header: "Invoice", render: (r) => <Link href={`/billing/${r.no}`} className="font-semibold text-brand hover:underline">{r.no}</Link>, value: (r) => r.no },
    { key: "patient", header: "Patient", render: (r) => <div className="flex items-center gap-2.5"><Avatar name={c.patientName(r.patientId)} size={28} /><span className="font-medium">{c.patientName(r.patientId)}</span></div>, value: (r) => c.patientName(r.patientId) },
    { key: "date", header: "Issued", render: (r) => fmtDate(r.date) },
    { key: "dueDate", header: "Due", render: (r) => <span className={r.overdue ? "font-medium text-bad" : ""}>{fmtDate(r.dueDate)}</span> },
    { key: "source", header: "Source" },
    { key: "total", header: "Total", render: (r) => kes(r.total), value: (r) => r.total, align: "right" },
    { key: "paid", header: "Paid", render: (r) => <span className="text-ok">{kes(r.paid)}</span>, value: (r) => r.paid, align: "right" },
    { key: "balance", header: "Balance", render: (r) => <span className={r.balance > 0 ? "font-semibold" : "text-muted"}>{kes(r.balance)}</span>, value: (r) => r.balance, align: "right" },
    { key: "status", header: "Status", render: (r) => <Status value={r.overdue ? "Overdue" : r.status} /> },
  ],
};

export default function Billing() {
  return <ResourcePage def={def} />;
}
export const icon = Receipt;
