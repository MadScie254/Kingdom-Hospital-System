"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, BedDouble, CalendarCheck, CalendarPlus, FlaskConical, Pill, Receipt, ShieldAlert, Siren, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import { PageHeader, Stat, Status, Avatar } from "@/components/ui";
import { usePending, useDB, useLookup, useUser } from "@/lib/store";
import { ACTION_ROLES, canRead, canWrite, ROLE_LABEL } from "@/lib/access";
import { ANCHOR, addDays, dayName, fmtDate, fmtShort, fmtTime, kes, kesShort } from "@/lib/format";
import { invoiceTotals } from "@/lib/billing";
import { SHA_OPEN_LABELS, hoursLeft } from "@/lib/hie/rules";

/** Dashboard groups for SHA claims. The labels are the ones SHA reports through its own states. */
const SHA_GROUPS: [string, string[]][] = [["Visits open", ["Awaiting visit", "Visit open", "Draft", "Ready to submit"]], ["With SHA", ["Submitted", "Under review", "Needs action"]], ["Approved", ["Approved", "Sent for payment"]], ["Paid", ["Paid"]]];

const C = { brand: "#2a6fae", grid: "#e6e9ed", mute: "#59646e" };

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
  const user = useUser();
  const pendingRequests = usePending();
  const role = user?.role;
  const can = (c: Parameters<typeof canRead>[1]) => canRead(role, c);
  const billing = !!role && ACTION_ROLES["invoice.create"].includes(role);

  const m = useMemo(() => {
    const collectedToday = d.payments.filter((p) => p.date === ANCHOR).reduce((a, p) => a + p.amount, 0);
    const monthStart = ANCHOR.slice(0, 8) + "01";
    const collectedMonth = d.payments.filter((p) => p.date >= monthStart).reduce((a, p) => a + p.amount, 0);
    const outstanding = d.invoices.filter((i) => i.status !== "Draft").reduce((a, i) => a + (invoiceTotals(i).total - i.paid), 0);
    const overdue = d.invoices.filter((i) => i.status !== "Paid" && i.status !== "Draft" && i.dueDate < ANCHOR);
    const occupied = d.beds.filter((b) => b.status === "Occupied").length;
    const wards = [...new Set(d.beds.map((b) => b.ward))].map((w) => { const bs = d.beds.filter((b) => b.ward === w); return { ward: w, total: bs.length, occ: bs.filter((b) => b.status === "Occupied").length }; });
    const days = Array.from({ length: 14 }, (_, i) => { const dt = addDays(ANCHOR, i - 13); return { label: fmtShort(dt), total: d.payments.filter((p) => p.date === dt).reduce((a, p) => a + p.amount, 0) }; });
    const todayAppts = d.appointments.filter((a) => a.date.startsWith(ANCHOR)).sort((a, b) => a.date.localeCompare(b.date));
    const dx: Record<string, number> = {};
    d.visits.forEach((v) => (dx[v.diagnosis] = (dx[v.diagnosis] || 0) + 1));
    const topDx = Object.entries(dx).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lab = ["Ordered", "Collected", "Processing", "Review", "Released"].map((s) => ({ s, n: d.labOrders.filter((l) => l.status === s && (s !== "Released" || l.orderedAt.slice(0, 10) >= addDays(ANCHOR, -3))).length }));
    const critical = d.labOrders.filter((l) => l.flag === "Critical" && l.status !== "Released").length;
    const lowStock = d.medicines.filter((x) => x.quantity <= x.reorder).length;
    const rejected = d.shaClaims.filter((c) => c.status === "Rejected" || c.status === "Failed to submit").length;
    const shaNeeds = d.shaClaims.filter((c) => c.status === "Needs action").length;
    const shaDue = d.shaClaims.filter((c) => c.serviceType === "EMERGENCY" && c.emergency?.deadline && !["Submitted", "Under review", "Approved", "Sent for payment", "Paid", "Rejected", "Closed", "Time barred"].includes(c.status) && hoursLeft(c.emergency.deadline) < 6).length;
    const shaOpen = d.shaClaims.filter((c) => SHA_OPEN_LABELS.includes(c.status)).reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const emerg = d.emergencies.filter((e) => e.status !== "Resolved").length;
    return { collectedToday, collectedMonth, outstanding, overdue, occupied, wards, days, todayAppts, topDx, lab, critical, lowStock, rejected, shaNeeds, shaDue, shaOpen, emerg };
  }, [d]);

  const settings = d.settings[0];
  const attention = [
    role === "admin" && pendingRequests > 0 && { icon: UserCheck, tone: "bad", text: `${pendingRequests} ${pendingRequests === 1 ? "person is" : "people are"} waiting for access`, href: "/staff" },
    can("labOrders") && m.critical > 0 && { icon: FlaskConical, tone: "bad", text: `${m.critical} critical lab ${m.critical === 1 ? "result needs" : "results need"} clinician review`, href: "/lab" },
    can("emergencies") && m.emerg > 0 && { icon: Siren, tone: "bad", text: `${m.emerg} emergency cases are open in casualty`, href: "/emergency" },
    can("invoices") && m.overdue.length > 0 && { icon: Receipt, tone: "warn", text: `${m.overdue.length} invoices are past due, ${kes(m.overdue.reduce((a, i) => a + invoiceTotals(i).total - i.paid, 0), 0)} outstanding`, href: "/billing" },
    (role === "admin" || role === "pharmacy") && m.lowStock > 0 && { icon: Pill, tone: "warn", text: `${m.lowStock} medicines are at or below reorder level`, href: "/medicines" },
    can("shaClaims") && m.shaDue > 0 && { icon: ShieldAlert, tone: "bad", text: `${m.shaDue} emergency ${m.shaDue === 1 ? "claim has" : "claims have"} less than 6 hours left to reach SHA`, href: "/sha" },
    can("shaClaims") && m.rejected > 0 && { icon: ShieldAlert, tone: "warn", text: `${m.rejected} SHA ${m.rejected === 1 ? "claim was" : "claims were"} rejected or failed to send. Open ${m.rejected === 1 ? "it" : "them"} to see SHA's reason`, href: "/sha" },
    can("shaClaims") && m.shaNeeds > 0 && { icon: ShieldAlert, tone: "warn", text: `${m.shaNeeds} SHA ${m.shaNeeds === 1 ? "claim needs" : "claims need"} action from the hospital`, href: "/sha" },
  ].filter(Boolean) as { icon: typeof Receipt; tone: string; text: string; href: string }[];

  const tiles = [
    can("payments") && can("invoices") && <Stat key="c" label="Collected today" value={kes(m.collectedToday, 0)} hint={`${kes(m.collectedMonth, 0)} this month`} icon={Wallet} tone="ok" href="/patients/payments" />,
    can("invoices") && can("payments") && <Stat key="o" label="Outstanding balances" value={kes(m.outstanding, 0)} hint={`${m.overdue.length} invoices past due`} icon={Receipt} tone="warn" href="/billing" />,
    can("beds") && <Stat key="b" label="Bed occupancy" value={`${d.beds.length ? Math.round((m.occupied / d.beds.length) * 100) : 0}%`} hint={`${m.occupied} of ${d.beds.length} beds occupied`} icon={BedDouble} tone="brand" href="/admissions" />,
    can("visits") && <Stat key="s" label="Seen today" value={d.visits.filter((v) => v.date.startsWith(ANCHOR)).length} hint={can("appointments") ? `${m.todayAppts.length} appointments booked` : undefined} icon={Users} tone="steel" href="/appointments" />,
    can("appointments") && !can("visits") && <Stat key="a" label="Appointments today" value={m.todayAppts.length} icon={CalendarCheck} tone="steel" href="/appointments" />,
    can("labOrders") && <Stat key="l" label="Lab requests in the queue" value={m.lab.slice(0, 3).reduce((a, x) => a + x.n, 0)} hint={`${m.lab[3].n} awaiting review`} icon={FlaskConical} tone="brand" href="/lab" />,
    (role === "pharmacy") && <Stat key="p" label="Low or out of stock" value={m.lowStock} icon={Pill} tone="warn" href="/medicines" />,
  ].filter(Boolean).slice(0, 4);

  const first = (user?.name || "").split(" ")[0];
  return (
    <div>
      <PageHeader title={`Welcome back, ${first}`} description={`${dayName(ANCHOR)}, ${fmtDate(ANCHOR)}. ${role ? `Signed in as ${ROLE_LABEL[role].toLowerCase()}.` : ""}`}
        actions={<>
          {canWrite(role, "patients") && <Link href="/patients/new" className="btn btn-secondary"><UserPlus size={16} />Register patient</Link>}
          {canWrite(role, "appointments") && <Link href="/appointments" className="btn btn-secondary"><CalendarPlus size={16} />Book appointment</Link>}
          {billing && <Link href="/billing/new" className="btn btn-primary"><Receipt size={16} />New invoice</Link>}
        </>} />

      {role === "admin" && settings && !settings.kra && !settings.mpesaPaybill && !settings.bank && (
        <Link href="/settings" className="mb-5 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] hover:border-brand">
          <Activity size={17} className="mt-0.5 text-brand" /><span><strong className="font-semibold text-brand">Finish setting up.</strong> Add your KRA PIN, facility code and M Pesa or bank details so invoices print them.</span>
        </Link>
      )}

      {tiles.length > 0 && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{tiles}</div>}

      {(can("payments") || can("beds")) && (
        <div className={`mt-5 grid gap-5 ${can("payments") && can("beds") ? "xl:grid-cols-3" : ""}`}>
          {can("payments") && (
            <section className={`card ${can("beds") ? "xl:col-span-2" : ""}`}>
              <div className="card-head"><div><h2 className="card-title">Collections, last 14 days</h2><p className="text-xs text-muted">Payments received across cash, M Pesa, card and SHA</p></div>{can("expenses") && <Link href="/reports" className="btn btn-ghost btn-sm">Open reports</Link>}</div>
              <div className="h-[260px] px-3 pb-3 pt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.mute }} interval={1} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.mute }} width={52} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
                    <Tooltip cursor={{ fill: "#f4f5f7" }} formatter={(v) => [kes(Number(v), 0), "Collected"]} contentStyle={{ borderRadius: 8, border: "1px solid #dde1e6", fontSize: 12 }} />
                    <Bar dataKey="total" fill={C.brand} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {can("beds") && (
            <section className="card">
              <div className="card-head"><div><h2 className="card-title">Ward occupancy</h2><p className="text-xs text-muted">Live from the bed board</p></div><Link href="/admissions" className="btn btn-ghost btn-sm">Bed board</Link></div>
              <div className="space-y-4 p-5">{m.wards.map((w) => <Meter key={w.ward} label={w.ward} value={w.occ} total={w.total} tone={w.occ / w.total > 0.85 ? "#b42318" : C.brand} />)}</div>
            </section>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card">
          <div className="card-head"><h2 className="card-title">Needs attention</h2></div>
          {attention.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-muted">Nothing needs attention right now.</p> : (
            <ul className="divide-y divide-line-2">
              {attention.map((a, i) => (
                <li key={i}><Link href={a.href} className="flex items-start gap-3 px-5 py-3 text-[13px] hover:bg-surface"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${a.tone === "bad" ? "bg-bad-50 text-bad" : "bg-warn-50 text-warn"}`}><a.icon size={15} /></span><span className="leading-snug">{a.text}</span></Link></li>
              ))}
            </ul>
          )}
        </section>

        {can("appointments") && (
          <section className="card">
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
        )}

        {can("labOrders") && (
          <section className="card">
            <div className="card-head"><h2 className="card-title">Laboratory pipeline</h2><Link href="/lab" className="btn btn-ghost btn-sm">Worklist</Link></div>
            <div className="space-y-4 p-5">
              {m.lab.map((x, i) => <Meter key={x.s} label={x.s} value={x.n} total={Math.max(...m.lab.map((y) => y.n), 1)} right={String(x.n)} tone={["#9cc0e0", "#6aa3d3", "#2a6fae", "#b58a2b", "#2f8a3e"][i]} />)}
              <p className="border-t border-line-2 pt-3 text-xs text-muted">Released shows the last three days.</p>
            </div>
          </section>
        )}
      </div>

      {(can("visits") || can("shaClaims")) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {can("visits") && (
            <section className="card">
              <div className="card-head"><h2 className="card-title">Leading diagnoses</h2><span className="text-xs text-muted">All consultations on record</span></div>
              <div className="space-y-4 p-5">{m.topDx.length === 0 ? <p className="text-center text-[13px] text-muted">No consultations recorded yet.</p> : m.topDx.map(([n, c], i) => <Meter key={n} label={n} value={c} total={m.topDx[0][1]} right={`${c} cases`} tone={i === 0 ? C.brand : "#8fb4db"} />)}</div>
            </section>
          )}
          {can("shaClaims") && (
            <section className="card">
              <div className="card-head"><h2 className="card-title">SHA claims</h2><Link href="/sha" className="btn btn-ghost btn-sm">Open claims</Link></div>
              <div className="grid grid-cols-2 gap-px bg-line-2 p-px sm:grid-cols-4">
                {SHA_GROUPS.map(([label, labels]) => { const cs = d.shaClaims.filter((c) => labels.includes(c.status)); return <div key={label} className="bg-white p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{cs.length}</div><div className="mt-0.5 text-xs text-muted">{kesShort(cs.reduce((a, c) => a + (Number(c.amount) || 0), 0))}</div></div>; })}
              </div>
              <div className="flex items-center gap-3 border-t border-line-2 px-5 py-4 text-[13px]"><span className="grid h-8 w-8 place-items-center rounded-md bg-warn-50 text-warn"><AlertTriangle size={16} /></span><span>{kes(m.shaOpen, 0)} is submitted or approved and waiting for payment.</span></div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
