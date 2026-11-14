"use client";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { db, useDB } from "@/lib/store";
import { Badge, PageHeader, toast } from "@/components/ui";
import { ANCHOR, kes, nowISO } from "@/lib/format";

export default function Pos() {
  const d = useDB();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [patientId, setPatientId] = useState("");
  const [method, setMethod] = useState("M Pesa");
  const cats = ["All", ...new Set(d.medicines.map((m) => m.category))];
  const list = d.medicines.filter((m) => (cat === "All" || m.category === cat) && (m.name.toLowerCase().includes(q.toLowerCase()) || m.generic.toLowerCase().includes(q.toLowerCase())));
  const lines = Object.entries(cart).map(([id, qty]) => { const m = d.medicines.find((x) => x.id === Number(id))!; return { m, qty }; }).filter((l) => l.m);
  const total = lines.reduce((a, l) => a + l.qty * l.m.sale, 0);
  const add = (id: number, by = 1) => setCart((c) => { const m = d.medicines.find((x) => x.id === id)!; const n = Math.max(0, Math.min((c[id] || 0) + by, m.quantity)); const o = { ...c }; if (n === 0) delete o[id]; else o[id] = n; return o; });
  const complete = () => {
    if (!lines.length) return;
    db.add("pharmacySales", { date: nowISO(), patientId: patientId ? Number(patientId) : null, lines: lines.map((l) => ({ medicineId: l.m.id, name: l.m.name, qty: l.qty, price: l.m.sale })), total, method });
    lines.forEach((l) => db.update("medicines", l.m.id, { quantity: l.m.quantity - l.qty }));
    toast(`Sale of ${kes(total)} completed`); setCart({}); setPatientId("");
  };
  return (
    <div>
      <PageHeader title="Point of sale" crumbs={[{ label: "Pharmacy", href: "/pharmacy" }, { label: "Point of sale" }]} description="Dispense over the counter or against a patient. Stock reduces as soon as the sale is completed." actions={<Link href="/pharmacy" className="btn btn-secondary">Pharmacy dashboard</Link>} />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <div className="relative min-w-[240px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search by medicine or generic name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search medicines" /></div>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition-colors", cat === c ? "border-brand bg-brand text-white" : "border-line bg-white text-muted hover:text-text")}>{c}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((m) => { const out = m.quantity <= 0, expired = m.expiry && m.expiry < ANCHOR; const dis = out || expired; return (
              <button key={m.id} disabled={dis} onClick={() => add(m.id)} className={clsx("card p-3.5 text-left transition-colors", dis ? "opacity-55" : "hover:border-brand")}>
                <div className="text-[13px] font-semibold leading-snug">{m.name}</div><div className="mt-0.5 text-xs text-muted">{m.generic}</div>
                <div className="mt-3 flex items-end justify-between"><span className="text-[15px] font-semibold tabular-nums">{kes(m.sale, 0)}</span>{out ? <Badge tone="bad">Stock out</Badge> : expired ? <Badge tone="bad">Expired</Badge> : m.quantity <= m.reorder ? <Badge tone="warn">{m.quantity} left</Badge> : <span className="text-xs text-muted">{m.quantity} in stock</span>}</div>
              </button>); })}
          </div>
        </section>
        <aside className="card flex flex-col xl:sticky xl:top-20">
          <div className="card-head"><h2 className="card-title">Current sale</h2>{lines.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart({})}>Clear</button>}</div>
          <div className="min-h-[160px] flex-1 divide-y divide-line-2">
            {lines.map((l) => (
              <div key={l.m.id} className="flex items-center gap-3 px-5 py-3"><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{l.m.name}</div><div className="text-xs text-muted">{kes(l.m.sale, 0)} each</div></div>
                <div className="flex items-center gap-1"><button className="btn btn-secondary btn-sm btn-icon" onClick={() => add(l.m.id, -1)} aria-label="Remove one"><Minus size={13} /></button><span className="w-7 text-center text-[13px] font-medium tabular-nums">{l.qty}</span><button className="btn btn-secondary btn-sm btn-icon" onClick={() => add(l.m.id, 1)} aria-label="Add one"><Plus size={13} /></button></div>
                <div className="w-20 text-right text-[13px] font-semibold tabular-nums">{kes(l.qty * l.m.sale, 0)}</div><button className="btn btn-ghost btn-sm btn-icon hover:!text-bad" onClick={() => setCart((c) => { const o = { ...c }; delete o[l.m.id]; return o; })} aria-label="Remove"><Trash2 size={14} /></button></div>
            ))}
            {lines.length === 0 && <p className="px-5 py-12 text-center text-[13px] text-muted">Select a medicine to start a sale.</p>}
          </div>
          <div className="space-y-3 border-t border-line p-5">
            <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-label="Customer"><option value="">Walk in customer</option>{d.patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">{["M Pesa", "Cash", "Card"].map((m) => <option key={m}>{m}</option>)}</select>
            <div className="flex items-baseline justify-between"><span className="text-[13px] text-muted">Total</span><span className="text-2xl font-semibold tabular-nums">{kes(total)}</span></div>
            <button className="btn btn-primary h-11 w-full" disabled={!lines.length} onClick={complete}>Complete sale</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
