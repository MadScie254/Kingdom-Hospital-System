"use client";
import { CalendarClock, CheckCircle2, ClipboardList, Pencil, Smile } from "lucide-react";
import Link from "next/link";
import { ResourcePage } from "@/components/resource";
import { Avatar, Status } from "@/components/ui";
import type { ResourceDef } from "@/lib/registry";
import { fmtDate, fmtDateTime } from "@/lib/format";

const def: ResourceDef = {
  collection: "dental", title: "Dental examinations", singular: "examination", description: "Chairside examinations with charted teeth, plan and next visit.", addLabel: "New examination", addHref: "/dental/new", readOnly: true,
  rowHref: (r) => `/dental/new?edit=${r.id}`,
  stats: (r) => [
    { label: "Total examinations", value: r.length, icon: Smile, tone: "teal" },
    { label: "Completed", value: r.filter((x) => x.status === "Completed").length, icon: CheckCircle2, tone: "ok" },
    { label: "Follow up required", value: r.filter((x) => x.status === "Follow up required").length, icon: CalendarClock, tone: "warn" },
    { label: "Drafts", value: r.filter((x) => x.status === "Draft").length, icon: ClipboardList, tone: "mute" },
  ],
  filters: () => [{ key: "st", label: "Status", options: ["Completed", "Follow up required", "Draft"], get: (r) => r.status }],
  cols: (c) => [
    { key: "id", header: "No", render: (r) => <span className="tabular-nums text-muted">DX{String(r.id).padStart(4, "0")}</span>, value: (r) => r.id },
    { key: "patient", header: "Patient", render: (r) => <Link href={`/patients/${r.patientId}`} className="flex items-center gap-2.5 hover:underline"><Avatar name={c.patientName(r.patientId)} size={28} /><span className="font-medium">{c.patientName(r.patientId)}</span></Link>, value: (r) => c.patientName(r.patientId) },
    { key: "doctor", header: "Dentist", value: (r) => c.doctorName(r.doctorId) },
    { key: "date", header: "Examined", render: (r) => fmtDate(r.date) },
    { key: "complaint", header: "Chief complaint" },
    { key: "teeth", header: "Teeth charted", value: (r) => Object.keys(r.teeth || {}).length, align: "right" },
    { key: "status", header: "Status", render: (r) => <Status value={r.status} /> },
    { key: "next", header: "Next visit", render: (r) => (r.nextAppointment ? fmtDateTime(r.nextAppointment) : "Not booked"), value: (r) => r.nextAppointment || "" },
  ],
};
export default function Page() {
  return <ResourcePage def={def} />;
}
export const _i = Pencil;
