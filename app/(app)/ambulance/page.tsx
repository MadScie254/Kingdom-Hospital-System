"use client";
import { useState } from "react";
import { Ambulance, CheckCircle2, PhoneCall, Wrench } from "lucide-react";
import { PageHeader, Stat, Status, Tabs } from "@/components/ui";
import { ResourcePage } from "@/components/resource";
import { useDB } from "@/lib/store";
import { fmtDateTime, kes } from "@/lib/format";
import type { ResourceDef } from "@/lib/registry";

const fleet: ResourceDef = {
  collection: "ambulances", title: "Fleet", singular: "ambulance", addLabel: "Add ambulance",
  fields: [{ name: "plate", label: "Registration plate", required: true }, { name: "type", label: "Type", type: "select", options: ["Basic life support", "Advanced life support", "Neonatal transport"], required: true }, { name: "driver", label: "Driver", required: true }, { name: "phone", label: "Driver phone", type: "tel" }, { name: "capacity", label: "Capacity (patients)", type: "number" }, { name: "status", label: "Status", type: "select", options: ["Available", "On call", "Maintenance"] }, { name: "equipment", label: "Equipment on board", type: "textarea", span: 2 }],
  defaults: { status: "Available", capacity: 2 },
  cols: () => [{ key: "plate", header: "Vehicle", render: (r) => <span className="font-semibold">{r.plate}</span> }, { key: "type", header: "Type" }, { key: "driver", header: "Driver", render: (r) => <div className="leading-tight"><div>{r.driver}</div><div className="text-xs text-muted">{r.phone}</div></div>, value: (r) => r.driver }, { key: "equipment", header: "Equipment", render: (r) => <span className="text-muted">{r.equipment}</span> }, { key: "capacity", header: "Capacity", align: "right" }, { key: "status", header: "Status", render: (r) => <Status value={r.status} /> }],
};
const bookings: ResourceDef = {
  collection: "bookings", title: "Bookings", singular: "booking", addLabel: "New booking",
  fields: [{ name: "patient", label: "Patient or caller", required: true }, { name: "ambulanceId", label: "Ambulance", from: "ambulances", required: true }, { name: "from", label: "Pickup", required: true }, { name: "to", label: "Destination", required: true }, { name: "date", label: "Dispatch time", type: "datetime-local", required: true }, { name: "fee", label: "Fee (KES)", type: "number" }, { name: "status", label: "Status", type: "select", options: ["Scheduled", "On trip", "Completed", "Cancelled"] }],
  defaults: { status: "Scheduled", fee: 6000 },
  filters: () => [{ key: "st", label: "Status", options: ["Scheduled", "On trip", "Completed", "Cancelled"], get: (r) => r.status }],
  cols: (c) => [{ key: "date", header: "Dispatch", render: (r) => fmtDateTime(r.date), value: (r) => r.date }, { key: "patient", header: "Patient", render: (r) => <span className="font-medium">{r.patient}</span> }, { key: "route", header: "Route", value: (r) => `${r.from} to ${r.to}` }, { key: "amb", header: "Ambulance", value: (r) => c.db.ambulances.find((a) => a.id === r.ambulanceId)?.plate ?? "" }, { key: "fee", header: "Fee", render: (r) => kes(r.fee, 0), value: (r) => r.fee, align: "right" }, { key: "status", header: "Status", render: (r) => <Status value={r.status} /> }],
};
const payments: ResourceDef = {
  collection: "bookings", title: "Payments", singular: "payment", readOnly: true, derive: (c) => c.db.bookings.filter((b) => b.status === "Completed" || b.status === "On trip"),
  cols: () => [{ key: "date", header: "Date", render: (r) => fmtDateTime(r.date), value: (r) => r.date }, { key: "patient", header: "Patient" }, { key: "route", header: "Route", value: (r) => `${r.from} to ${r.to}` }, { key: "fee", header: "Amount", render: (r) => kes(r.fee, 0), value: (r) => r.fee, align: "right" }, { key: "status", header: "Trip", render: (r) => <Status value={r.status} /> }],
};
const RATES: [string, string, number][] = [["Basic life support, within Nairobi", "Up to 20 km", 6000], ["Basic life support, beyond Nairobi", "Per km after 20 km", 120], ["Advanced life support, within Nairobi", "Up to 20 km", 12000], ["Neonatal transport", "Up to 20 km", 14000], ["Oxygen supply during transfer", "Per trip", 1500]];

export default function AmbulancePage() {
  const d = useDB();
  const [tab, setTab] = useState("fleet");
  const n = (s: string) => d.ambulances.filter((a) => a.status === s).length;
  return (
    <div>
      <PageHeader title="Ambulance service" description="Fleet status, dispatch bookings and trip payments." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available" value={n("Available")} icon={CheckCircle2} tone="ok" />
        <Stat label="On call" value={n("On call")} icon={PhoneCall} tone="warn" />
        <Stat label="Total vehicles" value={d.ambulances.length} icon={Ambulance} tone="brand" />
        <Stat label="In maintenance" value={n("Maintenance")} icon={Wrench} tone="bad" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "fleet", label: "Fleet" }, { value: "bookings", label: "Bookings", count: d.bookings.length }, { value: "payments", label: "Payments" }, { value: "rates", label: "Rate card" }]} />
      <div className="mt-5">
        {tab === "fleet" && <ResourcePage def={fleet} embedded />}
        {tab === "bookings" && <ResourcePage def={bookings} embedded />}
        {tab === "payments" && <ResourcePage def={payments} embedded />}
        {tab === "rates" && <section className="card overflow-x-auto"><table className="tbl"><thead><tr><th>Service</th><th>Basis</th><th className="text-right">Rate</th></tr></thead><tbody>{RATES.map(([a, b, c]) => <tr key={a}><td className="font-medium">{a}</td><td className="text-muted">{b}</td><td className="num">{kes(c, 0)}</td></tr>)}</tbody></table></section>}
      </div>
    </div>
  );
}
