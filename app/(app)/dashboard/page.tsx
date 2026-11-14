"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, BedDouble, CalendarPlus, Receipt, Users, UserPlus, Wallet, FlaskConical, Siren, ShieldAlert, Pill } from "lucide-react";
import { PageHeader, Stat, Status, Avatar } from "@/components/ui";
import { useDB, useLookup } from "@/lib/store";
import { ANCHOR, addDays, dayName, fmtDate, fmtShort, fmtTime, kes, kesShort } from "@/lib/format";
import { invoiceTotals } from "@/lib/billing";

const C = { brand: "#0d6e57", steel: "#1d6a96", gold: "#b58a2b", grid: "#e3ebe7", mute: "#566a63" };

function Meter({ label, value, total, tone = C.brand, right }: { label: string; value: number; total: number; tone?: string; right?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span className="text-text">{label}</span><span className="tabular-nums text-muted">{right ?? `${value} of ${total}`}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface" role="img" aria-label={`${label}: ${pct}%`}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} /></div>
    </div>
  );
}

export default function Dashboard() {
  const d = useDB();
  const L = useLookup();

  const m = useMemo(() => {
    const collectedToday = d.payments.filter((p) => p.date === ANCHOR).reduce((a, p) => a + p.amount, 0);
    const monthStart = ANCHOR.slice(0, 8) + "01";
    const collectedMonth = d.payments.filter((p) => p.date >= monthStart).reduce((a, p) => a + p.amount, 0);
    const outstanding = d.invoices.filter((i) => i.status !== "Draft").reduce((a, i) => a + (invoiceTotals(i).total - i.paid), 0);
    const overdue = d.invoices.filter((i) => i.status !== "Paid" && i.status !== "Draft" && i.dueDate < ANCHOR);
    const occupied = d.beds.filter((b) => b.status === "Occupied").length;
    const wards = [...new Set(d.beds.map((b) => b.ward))].map((w) => { const bs = d.beds.filter((b) => b.ward === w); return { ward: w, total: bs.length, occ: bs.filter((b) => b.status === "Occupied").length }; });
    const days = Array.from({ length: 14 }, (_, i) => { const dt = addDays(ANCHOR, i - 13); return { dt, label: fmtShort(dt), total: d.payments.filter((p) => p.date === dt).reduce((a, p) => a + p.amount, 0) }; });
    const todayAppts = d.appointments.filter((a) => a.date.startsWith(ANCHOR)).sort((a, b) => a.date.localeCompare(b.date));
    const dx: Record<string, number> = {};
    d.visits.forEach((v) => (dx[v.diagnosis] = (dx[v.diagnosis] || 0) + 1));
    const topDx = Object.entries(dx).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lab = ["Ordered", "Collected", "Processing", "Review", "Released"].map((s) => ({ s, n: d.labOrders.filter((l) => l.status === s && (s !== "Released" || l.orderedAt.slice(0, 10) >= addDays(ANCHOR, -3))).length }));
    const critical = d.labOrders.filter((l) => l.flag === "Critical").slice(0, 3);
    const lowStock = d.medicines.filter((x) => x.quantity <= x.reorder).length;
    const rejected = d.shaClaims.filter((c) => c.status === "Rejected").length;
    const shaOpen = d.shaClaims.filter((c) => c.status === "Submitted" || c.status === "Approved").reduce((a, c) => a + c.amount, 0);
    const emerg = d.emergencies.filter((e) => e.status !== "Resolved").length;
    return { collectedToday, collectedMonth, outstanding, overdue, occupied, wards, days, todayAppts, topDx, lab, critical, lowStock, rejected, shaOpen, emerg };
  }, [d]);

  const attention = [
    { icon: FlaskConical, tone: "bad", text: `${m.critical.length} critical lab results need clinician review`, href: "/lab" },
    { icon: Siren, tone: "bad", text: `${m.emerg} emergency cases are open in casualty`, href: "/emergency" },
    { icon: Receipt, tone: "warn", text: `${m.overdue.length} invoices are past due, ${kes(m.overdue.reduce((a, i) => a + invoiceTotals(i).total - i.paid, 0), 0)} outstanding`, href: "/billing" },
    { icon: Pill, tone: "warn", text: `${m.lowStock} medicines are at or below reorder level`, href: "/medicines" },
    { icon: ShieldAlert, tone: "warn", text: `${m.rejected} SHA claims were rejected and can be resubmitted`, href: "/sha" },
  ].filter((a) => !/^0 /.test(a.text));

  return (
    <div>
      <PageHeader title="Welcome back, Ruth" description={`${dayName(ANCHOR)}, ${fmtDate(ANCHOR)}. Here is how the hospital is running today.`}
        actions={<>
          <Link href="/patients/new" className="btn btn-secondary"><UserPlus size={16} />Register patient</Link>
          <Link href="/appointments" className="btn btn-secondary"><CalendarPlus size={16} />Book appointment</Link>
          <Link href="/billing/new" className="btn btn-primary"><Receipt size={16} />New invoice</Link>
        </>} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Collected today" value={kes(m.collectedToday, 0)} hint={`${kes(m.collectedMonth, 0)} this month`} icon={Wallet} tone="ok" href="/patients/payments" />
        <Stat label="Outstanding balances" value={kes(m.outstanding, 0)} hint={`${m.overdue.length} invoices past due`} icon={Receipt} tone="warn" href="/billing" />
        <Stat label="Bed occupancy" value={`${Math.round((m.occupied / d.beds.length) * 100)}%`} hint={`${m.occupied} of ${d.beds.length} beds occupied`} icon={BedDouble} tone="brand" href="/admissions" />
        <Stat label="Seen today" value={d.visits.filter((v) => v.date.startsWith(ANCHOR)).length} hint={`${m.todayAppts.length} appointments booked`} icon={Users} tone="steel" href="/appointments" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-head"><div><h2 className="card-title">Collections, last 14 days</h2><p className="text-xs text-muted">Payments received across cash, M Pesa, card and SHA</p></div><Link href="/reports" className="btn btn-ghost btn-sm">Open reports</Link></div>
          <div className="h-[260px] px-3 pb-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.mute }} interval={1} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.mute }} width={52} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
                <Tooltip cursor={{ fill: "#f2f5f3" }} formatter={(v) => [kes(Number(v), 0), "Collected"]} contentStyle={{ borderRadius: 8, border: "1px solid #d9e2de", fontSize: 12 }} />
                <Bar dataKey="total" fill={C.brand} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h2 className="card-title">Ward occupancy</h2><p className="text-xs text-muted">Live from the bed board</p></div><Link href="/admissions" className="btn btn-ghost btn-sm">Bed board</Link></div>
          <div className="space-y-4 p-5">
            {m.wards.map((w) => <Meter key={w.ward} label={w.ward} value={w.occ} total={w.total} tone={w.occ / w.total > 0.85 ? "#b42318" : C.brand} />)}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card xl:col-span-1">
          <div className="card-head"><h2 className="card-title">Needs attention</h2></div>
          <ul className="divide-y divide-line-2">
            {attention.map((a, i) => (
              <li key={i}><Link href={a.href} className="flex items-start gap-3 px-5 py-3 text-[13px] hover:bg-surface"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${a.tone === "bad" ? "bg-bad-50 text-bad" : "bg-warn-50 text-warn"}`}><a.icon size={15} /></span><span className="leading-snug">{a.text}</span></Link></li>
            ))}
          </ul>
        </section>

        <section className="card xl:col-span-1">
          <div className="card-head"><h2 className="card-title">Today&apos;s appointments</h2><Link href="/appointments" className="btn btn-ghost btn-sm">View all</Link></div>
          <ul className="divide-y divide-line-2">
            {m.todayAppts.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-11 text-[13px] font-medium tabular-nums text-brand">{fmtTime(a.date)}</div>
                <Avatar name={L.patientName(a.patientId)} size={28} />
                <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium">{L.patientName(a.patientId)}</div><div className="truncate text-xs text-muted">{L.doctorName(a.doctorId)}</div></div>
                <Status value={a.status} />
              </li>
            ))}
            {m.todayAppts.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">No appointments booked for today.</li>}
          </ul>
        </section>

        <section className="card xl:col-span-1">
          <div className="card-head"><h2 className="card-title">Laboratory pipeline</h2><Link href="/lab" className="btn btn-ghost btn-sm">Worklist</Link></div>
          <div className="space-y-4 p-5">
            {m.lab.map((x, i) => <Meter key={x.s} label={x.s} value={x.n} total={Math.max(...m.lab.map((y) => y.n), 1)} right={String(x.n)} tone={["#8fb8d0", "#5b9cc0", "#1d6a96", "#b58a2b", "#2f8a3e"][i]} />)}
            <p className="border-t border-line-2 pt-3 text-xs text-muted">Released shows the last three days. Open the worklist to collect samples and enter results.</p>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="card-head"><h2 className="card-title">Leading diagnoses</h2><span className="text-xs text-muted">All consultations on record</span></div>
          <div className="space-y-4 p-5">{m.topDx.map(([n, c], i) => <Meter key={n} label={n} value={c} total={m.topDx[0][1]} right={`${c} cases`} tone={i === 0 ? C.brand : "#6fae9c"} />)}</div>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="card-title">SHA claims</h2><Link href="/sha" className="btn btn-ghost btn-sm">Open claims</Link></div>
          <div className="grid grid-cols-2 gap-px bg-line-2 p-px sm:grid-cols-4">
            {["Draft", "Submitted", "Approved", "Paid"].map((s) => { const cs = d.shaClaims.filter((c) => c.status === s); return <div key={s} className="bg-white p-4"><div className="text-xs text-muted">{s}</div><div className="mt-1 text-lg font-semibold tabular-nums">{cs.length}</div><div className="mt-0.5 text-xs text-muted">{kesShort(cs.reduce((a, c) => a + c.amount, 0))}</div></div>; })}
          </div>
          <div className="flex items-center gap-3 border-t border-line-2 px-5 py-4 text-[13px]"><span className="grid h-8 w-8 place-items-center rounded-md bg-warn-50 text-warn"><AlertTriangle size={16} /></span><span>{kes(m.shaOpen, 0)} is submitted or approved and waiting for payment.</span></div>
        </section>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-faint"><Activity size={13} />Figures update as records are added anywhere in the system.</p>
    </div>
  );
}
