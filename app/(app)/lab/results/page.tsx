"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, FlaskConical, Percent } from "lucide-react";
import { useDB, useLookup } from "@/lib/store";
import { Avatar, DataTable, PageHeader, Stat, type Col } from "@/components/ui";
import { FlagBadge, RangeGauge } from "@/components/lab";
import { rangeText } from "@/lib/lab";
import { ANCHOR, addDays, fmtDate, fmtShort } from "@/lib/format";
import type { Row } from "@/lib/seed";

export default function Results() {
  const d = useDB();
  const L = useLookup();
  const tests = useMemo(() => new Map(d.labCatalog.map((t) => [t.id, t])), [d.labCatalog]);
  const released = useMemo(() => d.labOrders.filter((o) => o.status === "Released").map((o) => ({ ...o, test: tests.get(o.testId)! }) as Row), [d.labOrders, tests]);

  const a = useMemo(() => {
    const abnormal = released.filter((o) => o.flag && o.flag !== "Normal");
    const byCat: Record<string, number> = {};
    released.forEach((o) => (byCat[o.test.category] = (byCat[o.test.category] || 0) + 1));
    const byTest: Record<string, { n: number; bad: number }> = {};
    released.forEach((o) => { const x = (byTest[o.test.name] ||= { n: 0, bad: 0 }); x.n++; if (o.flag && o.flag !== "Normal") x.bad++; });
    const volume = Array.from({ length: 14 }, (_, i) => { const dt = addDays(ANCHOR, i - 13); return { label: fmtShort(dt), n: d.labOrders.filter((o) => o.orderedAt.startsWith(dt)).length }; });
    return { abnormal, byCat: Object.entries(byCat).sort((x, y) => y[1] - x[1]), byTest: Object.entries(byTest).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ k, ...v, rate: Math.round((v.bad / v.n) * 100) })).sort((x, y) => y.rate - x.rate).slice(0, 6), volume };
  }, [released, d.labOrders]);

  const cols: Col<Row>[] = [
    { key: "date", header: "Date", render: (r) => fmtDate(r.orderedAt), value: (r) => r.orderedAt },
    { key: "patient", header: "Patient", render: (r) => <div className="flex items-center gap-2.5"><Avatar name={L.patientName(r.patientId)} size={28} /><span className="font-medium">{L.patientName(r.patientId)}</span></div>, value: (r) => L.patientName(r.patientId) },
    { key: "test", header: "Test", value: (r) => r.test.name },
    { key: "result", header: "Result", render: (r) => <span className="font-semibold tabular-nums">{String(r.result)} <span className="text-xs font-normal text-muted">{r.test.unit}</span></span>, value: (r) => String(r.result) },
    { key: "flag", header: "Flag", render: (r) => <FlagBadge flag={r.flag} />, value: (r) => r.flag },
    { key: "gauge", header: "Against range", render: (r) => <RangeGauge test={r.test} value={r.result} />, nosort: true },
    { key: "range", header: "Reference", render: (r) => <span className="text-muted">{rangeText(r.test)}</span>, value: (r) => rangeText(r.test) },
    { key: "by", header: "Verified by", value: (r) => r.verifiedBy },
    { key: "actions", header: "", render: (r) => <Link className="btn btn-ghost btn-sm" href={`/lab/report/${r.id}`}>Report</Link> },
  ];
  const rate = released.length ? Math.round((a.abnormal.length / released.length) * 100) : 0;
  const maxCat = a.byCat[0]?.[1] || 1;

  return (
    <div>
      <PageHeader title="Results and analysis" crumbs={[{ label: "Laboratory", href: "/lab" }, { label: "Results and analysis" }]} description="Released results with their reference ranges, plus volume and abnormal rate across the laboratory." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Results released" value={released.length} icon={CheckCircle2} tone="ok" />
        <Stat label="Outside range" value={`${rate}%`} hint={`${a.abnormal.length} of ${released.length} results`} icon={Percent} tone="warn" />
        <Stat label="Critical results" value={released.filter((o) => o.flag === "Critical").length} icon={AlertTriangle} tone="bad" />
        <Stat label="Tests in catalogue" value={d.labCatalog.length} icon={FlaskConical} tone="steel" />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-head"><div><h2 className="card-title">Requests per day</h2><p className="text-xs text-muted">All tests ordered, last 14 days</p></div></div>
          <div className="h-[220px] px-3 pb-3 pt-5">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={a.volume} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e6e9ed" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#59646e" }} interval={1} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#59646e" }} /><Tooltip cursor={{ fill: "#f4f5f7" }} contentStyle={{ borderRadius: 8, border: "1px solid #dde1e6", fontSize: 12 }} formatter={(v) => [String(v), "Requests"]} /><Bar dataKey="n" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={26} /></BarChart></ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="card-title">Volume by category</h2></div>
          <div className="space-y-4 p-5">{a.byCat.map(([c, n]) => <div key={c}><div className="mb-1.5 flex justify-between text-[13px]"><span>{c}</span><span className="tabular-nums text-muted">{n}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand" style={{ width: `${(n / maxCat) * 100}%` }} /></div></div>)}</div>
        </section>
      </div>
      <section className="card mb-5">
        <div className="card-head"><div><h2 className="card-title">Tests most often outside range</h2><p className="text-xs text-muted">Tests with at least two released results</p></div></div>
        <div className="grid gap-px bg-line-2 p-px sm:grid-cols-2 lg:grid-cols-3">{a.byTest.map((t) => <div key={t.k} className="bg-white p-4"><div className="flex items-baseline justify-between"><span className="text-[13px] font-medium">{t.k}</span><span className="text-lg font-semibold tabular-nums">{t.rate}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-warn" style={{ width: `${t.rate}%`, background: "#a35a06" }} /></div><div className="mt-1.5 text-xs text-muted">{t.bad} of {t.n} results</div></div>)}</div>
      </section>
      <div className="card overflow-hidden"><DataTable rows={released} cols={cols} exportName="lab_results" pageSize={10} filters={[{ key: "cat", label: "Category", options: [...new Set(d.labCatalog.map((t) => t.category))], get: (r) => r.test.category }, { key: "flag", label: "Flag", options: ["Normal", "Low", "High", "Critical", "Abnormal"], get: (r) => r.flag }]} searchPlaceholder="Search patient or test" /></div>
    </div>
  );
}
