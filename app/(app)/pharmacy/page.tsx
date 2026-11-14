"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Clock, Pill, ShoppingCart, Wallet } from "lucide-react";
import { useDB, useLookup } from "@/lib/store";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { ANCHOR, addDays, fmtDate, fmtShort, fmtTime, kes } from "@/lib/format";

export default function Pharmacy() {
  const d = useDB();
  const L = useLookup();
  const m = useMemo(() => {
    const today = d.pharmacySales.filter((s) => s.date.startsWith(ANCHOR)).reduce((a, s) => a + s.total, 0);
    const month = d.pharmacySales.filter((s) => s.date >= ANCHOR.slice(0, 8) + "01").reduce((a, s) => a + s.total, 0);
    const days = Array.from({ length: 14 }, (_, i) => { const dt = addDays(ANCHOR, i - 13); return { label: fmtShort(dt), total: d.pharmacySales.filter((s) => s.date.startsWith(dt)).reduce((a, s) => a + s.total, 0) }; });
    const low = d.medicines.filter((x) => x.quantity <= x.reorder).sort((a, b) => a.quantity / (a.reorder || 1) - b.quantity / (b.reorder || 1));
    const exp = d.medicines.filter((x) => x.expiry && x.expiry < addDays(ANCHOR, 60)).sort((a, b) => a.expiry.localeCompare(b.expiry));
    return { today, month, days, low, exp };
  }, [d]);
  return (
    <div>
      <PageHeader title="Pharmacy" description="Dispensing, sales and stock health in one place." actions={<><Link href="/medicines" className="btn btn-secondary"><Pill size={16} />Medicines</Link><Link href="/pharmacy/sale" className="btn btn-primary"><ShoppingCart size={16} />Point of sale</Link></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales today" value={kes(m.today, 0)} icon={Wallet} tone="ok" />
        <Stat label="Sales this month" value={kes(m.month, 0)} icon={ShoppingCart} tone="brand" />
        <Stat label="Medicines in formulary" value={d.medicines.length} icon={Pill} tone="steel" href="/medicines" />
        <Stat label="Low or out of stock" value={m.low.length} hint={`${m.exp.length} expiring or expired`} icon={AlertTriangle} tone="warn" href="/medicines" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-head"><div><h2 className="card-title">Pharmacy sales, last 14 days</h2></div></div>
          <div className="h-[240px] px-3 pb-3 pt-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={m.days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e3ebe7" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#566a63" }} interval={1} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#566a63" }} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} /><Tooltip cursor={{ fill: "#f2f5f3" }} contentStyle={{ borderRadius: 8, border: "1px solid #d9e2de", fontSize: 12 }} formatter={(v) => [kes(Number(v), 0), "Sales"]} /><Bar dataKey="total" fill="#0d6e57" radius={[3, 3, 0, 0]} maxBarSize={26} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="card-title">Stock alerts</h2></div>
          <ul className="divide-y divide-line-2">
            {m.low.slice(0, 5).map((x) => <li key={x.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><span className="min-w-0 truncate pr-3">{x.name}</span>{x.quantity <= 0 ? <Badge tone="bad">Stock out</Badge> : <Badge tone="warn">{x.quantity} left</Badge>}</li>)}
            {m.exp.slice(0, 3).map((x) => <li key={"e" + x.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><span className="min-w-0 truncate pr-3">{x.name}</span><Badge tone={x.expiry < ANCHOR ? "bad" : "warn"}><Clock size={11} />{x.expiry < ANCHOR ? "Expired" : "Expires"} {fmtDate(x.expiry)}</Badge></li>)}
          </ul>
        </section>
      </div>
      <section className="card mt-5 overflow-x-auto">
        <div className="card-head"><h2 className="card-title">Latest sales</h2></div>
        <table className="tbl"><thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Paid by</th><th className="text-right">Total</th></tr></thead><tbody>{d.pharmacySales.slice(0, 8).map((s) => <tr key={s.id}><td>{fmtDate(s.date)} <span className="text-xs text-muted">{fmtTime(s.date)}</span></td><td>{s.patientId ? L.patientName(s.patientId) : "Walk in customer"}</td><td className="max-w-md truncate text-muted">{s.lines.map((l: any) => `${l.name} x${l.qty}`).join(", ")}</td><td>{s.method}</td><td className="num font-medium">{kes(s.total)}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
