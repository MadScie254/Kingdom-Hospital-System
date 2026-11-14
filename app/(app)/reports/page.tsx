"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, Receipt, TrendingUp, Wallet, Percent } from "lucide-react";
import { PageHeader, Stat, Tabs, Field } from "@/components/ui";
import { useDB } from "@/lib/store";
import type { Row } from "@/lib/seed";
import { invoiceTotals } from "@/lib/billing";
import { ANCHOR, addDays, fmtDate, fmtShort, kes } from "@/lib/format";

export default function Reports() {
  const d = useDB();
  const [tab, setTab] = useState("financial");
  const [from, setFrom] = useState(addDays(ANCHOR, -29));
  const [to, setTo] = useState(ANCHOR);
  const [rate, setRate] = useState("20");

  const r = useMemo(() => {
    const inRange = (dt: string) => dt.slice(0, 10) >= from && dt.slice(0, 10) <= to;
    const invs = d.invoices.filter((i) => i.status !== "Draft" && inRange(i.date)).map((i) => ({ ...i, t: invoiceTotals(i) }) as Row & { t: ReturnType<typeof invoiceTotals> });
    const pays = d.payments.filter((p) => inRange(p.date));
    const exps = d.expenses.filter((e) => inRange(e.date));
    const sources = [...new Set(invs.map((i) => i.source))].map((s) => { const x = invs.filter((i) => i.source === s); return { s, n: x.length, gross: x.reduce((a, i) => a + i.t.sub, 0), disc: x.reduce((a, i) => a + i.t.discount, 0), net: x.reduce((a, i) => a + i.t.total, 0), paid: x.reduce((a, i) => a + i.paid, 0) }; });
    const cats = [...new Set(exps.map((e) => e.category))].map((c) => ({ c, n: exps.filter((e) => e.category === c).length, amt: exps.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).sort((a, b) => b.amt - a.amt);
    const methods = [...new Set(pays.map((p) => p.method))].map((m) => ({ m, amt: pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0) })).sort((a, b) => b.amt - a.amt);
    const span = Math.max(0, Math.min(60, Math.round((Date.parse(to) - Date.parse(from)) / 864e5)));
    const days = Array.from({ length: span + 1 }, (_, i) => { const dt = addDays(from, i); return { dt, label: fmtShort(dt), collected: pays.filter((p) => p.date === dt).reduce((a, p) => a + p.amount, 0), expense: exps.filter((e) => e.date === dt).reduce((a, e) => a + e.amount, 0), inv: invs.filter((i) => i.date === dt).length, visits: d.visits.filter((v) => v.date.startsWith(dt)).length, labs: d.labOrders.filter((o) => o.orderedAt.startsWith(dt)).length, admits: d.admissions.filter((a) => a.admittedAt.startsWith(dt)).length, pays: pays.filter((p) => p.date === dt).length };});
    const docs = d.doctors.map((x) => { const mine = invs.filter((i) => i.doctorId === x.id); return { x, n: mine.length, billed: mine.reduce((a, i) => a + i.t.total, 0) }; }).sort((a, b) => b.billed - a.billed);
    const billed = invs.reduce((a, i) => a + i.t.total, 0), collected = pays.reduce((a, p) => a + p.amount, 0), expense = exps.reduce((a, e) => a + e.amount, 0);
    return { invs, sources, cats, methods, days, docs, billed, collected, expense, disc: invs.reduce((a, i) => a + i.t.discount, 0), out: invs.reduce((a, i) => a + i.t.total - i.paid, 0) };
  }, [d, from, to]);

  const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => <th className={right ? "text-right" : ""}>{children}</th>;
  return (
    <div>
      <PageHeader title="Reports" description="Financial position and activity for any date range." />
      <div className="no-print mb-5 flex flex-wrap items-end gap-3"><Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field><button className="btn btn-secondary" onClick={() => window.print()}>Print report</button></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Billed" value={kes(r.billed, 0)} hint={`${r.invs.length} invoices, ${kes(r.disc, 0)} discounts`} icon={Receipt} tone="brand" />
        <Stat label="Collected" value={kes(r.collected, 0)} icon={Wallet} tone="ok" />
        <Stat label="Outstanding" value={kes(r.out, 0)} icon={Banknote} tone="warn" />
        <Stat label="Net cash" value={kes(r.collected - r.expense, 0)} hint={`After ${kes(r.expense, 0)} expenses`} icon={TrendingUp} tone={r.collected - r.expense >= 0 ? "steel" : "bad"} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "financial", label: "Financial summary" }, { value: "sales", label: "Collections" }, { value: "expenses", label: "Expenses" }, { value: "doctors", label: "Doctor revenue" }, { value: "activity", label: "Daily activity" }]} />
      <div className="mt-5">
        {tab === "financial" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card overflow-x-auto"><div className="card-head"><h2 className="card-title">Income by service area</h2></div><table className="tbl"><thead><tr><Th>Service area</Th><Th right>Invoices</Th><Th right>Gross</Th><Th right>Discount</Th><Th right>Collected</Th></tr></thead><tbody>{r.sources.map((s) => <tr key={s.s}><td className="font-medium">{s.s}</td><td className="num">{s.n}</td><td className="num">{kes(s.gross, 0)}</td><td className="num">{kes(-s.disc, 0)}</td><td className="num">{kes(s.paid, 0)}</td></tr>)}<tr className="font-semibold"><td>Total</td><td className="num">{r.invs.length}</td><td className="num">{kes(r.sources.reduce((a, s) => a + s.gross, 0), 0)}</td><td className="num">{kes(-r.disc, 0)}</td><td className="num">{kes(r.sources.reduce((a, s) => a + s.paid, 0), 0)}</td></tr></tbody></table></section>
            <section className="card overflow-x-auto"><div className="card-head"><h2 className="card-title">Expenses by category</h2></div><table className="tbl"><thead><tr><Th>Category</Th><Th right>Entries</Th><Th right>Amount</Th></tr></thead><tbody>{r.cats.map((c) => <tr key={c.c}><td className="font-medium">{c.c}</td><td className="num">{c.n}</td><td className="num">{kes(c.amt, 0)}</td></tr>)}<tr className="font-semibold"><td>Total</td><td className="num">{r.cats.reduce((a, c) => a + c.n, 0)}</td><td className="num">{kes(r.expense, 0)}</td></tr></tbody></table></section>
          </div>
        )}
        {tab === "sales" && (
          <div className="grid gap-5 xl:grid-cols-3">
            <section className="card xl:col-span-2"><div className="card-head"><h2 className="card-title">Collected per day</h2></div><div className="h-[280px] px-3 pb-3 pt-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e3ebe7" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#566a63" }} interval="preserveStartEnd" /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#566a63" }} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} /><Tooltip cursor={{ fill: "#f2f5f3" }} contentStyle={{ borderRadius: 8, border: "1px solid #d9e2de", fontSize: 12 }} formatter={(v) => [kes(Number(v), 0), "Collected"]} /><Bar dataKey="collected" fill="#0d6e57" radius={[3, 3, 0, 0]} maxBarSize={22} /></BarChart></ResponsiveContainer></div></section>
            <section className="card"><div className="card-head"><h2 className="card-title">By payment method</h2></div><div className="space-y-4 p-5">{r.methods.map((m) => <div key={m.m}><div className="mb-1.5 flex justify-between text-[13px]"><span>{m.m}</span><span className="tabular-nums text-muted">{kes(m.amt, 0)}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand" style={{ width: `${(m.amt / (r.methods[0]?.amt || 1)) * 100}%` }} /></div></div>)}</div></section>
          </div>
        )}
        {tab === "expenses" && <section className="card overflow-x-auto"><table className="tbl"><thead><tr><Th>Date</Th><Th>Description</Th><Th>Category</Th><Th>Paid by</Th><Th right>Amount</Th></tr></thead><tbody>{d.expenses.filter((e) => e.date >= from && e.date <= to).map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td className="font-medium">{e.description}</td><td>{e.category}</td><td>{e.method}</td><td className="num">{kes(e.amount)}</td></tr>)}</tbody></table></section>}
        {tab === "doctors" && (
          <section className="card overflow-x-auto"><div className="card-head"><h2 className="card-title">Revenue by doctor</h2><label className="flex items-center gap-2 text-[13px]"><Percent size={14} className="text-faint" />Commission rate<input className="input w-20" type="number" min={0} max={100} value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Commission rate" /></label></div><table className="tbl"><thead><tr><Th>Doctor</Th><Th right>Invoices</Th><Th right>Billed</Th><Th right>Commission</Th></tr></thead><tbody>{r.docs.map((x) => <tr key={x.x.id}><td className="font-medium">{x.x.name}<div className="text-xs font-normal text-muted">{x.x.specialty}</div></td><td className="num">{x.n}</td><td className="num">{kes(x.billed, 0)}</td><td className="num font-semibold">{kes(x.billed * (Number(rate) / 100), 0)}</td></tr>)}</tbody></table></section>
        )}
        {tab === "activity" && <section className="card overflow-x-auto"><table className="tbl"><thead><tr><Th>Date</Th><Th right>Invoices</Th><Th right>Payments</Th><Th right>Collected</Th><Th right>Consultations</Th><Th right>Lab requests</Th><Th right>Admissions</Th></tr></thead><tbody>{[...r.days].reverse().map((x) => <tr key={x.dt}><td>{fmtDate(x.dt)}</td><td className="num">{x.inv}</td><td className="num">{x.pays}</td><td className="num">{kes(x.collected, 0)}</td><td className="num">{x.visits}</td><td className="num">{x.labs}</td><td className="num">{x.admits}</td></tr>)}</tbody></table></section>}
      </div>
    </div>
  );
}
