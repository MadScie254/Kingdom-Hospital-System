"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useDB, useLookup } from "@/lib/store";
import { DocFooter, DocHeader } from "@/components/documents";
import { FlagBadge, RangeGauge, Trend } from "@/components/lab";
import { isQuant, rangeText } from "@/lib/lab";
import { age, dayName, fmtDate, fmtDateTime, fmtTime } from "@/lib/format";

export default function LabReport() {
  const { id } = useParams<{ id: string }>();
  const d = useDB();
  const L = useLookup();
  const order = d.labOrders.find((o) => o.id === Number(id));
  if (!order) { if (d.labOrders.length) notFound(); return null; }
  const day = order.orderedAt.slice(0, 10);
  const p = L.patient(order.patientId);
  const rows = d.labOrders.filter((o) => o.patientId === order.patientId && o.orderedAt.startsWith(day) && o.status === "Released").map((o) => ({ o, t: d.labCatalog.find((t) => t.id === o.testId)! }));
  const groups = [...new Set(rows.map((r) => r.t.category))];
  const off = rows.filter((r) => r.o.flag && r.o.flag !== "Normal");
  const critical = rows.filter((r) => r.o.flag === "Critical");
  const prev = (r: (typeof rows)[number]) => d.labOrders.filter((x) => x.patientId === r.o.patientId && x.testId === r.o.testId && x.status === "Released" && x.orderedAt < r.o.orderedAt).sort((a, b) => a.orderedAt.localeCompare(b.orderedAt)).slice(-4);

  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Link href="/lab/results" className="btn btn-secondary btn-icon" aria-label="Back to results"><ArrowLeft size={16} /></Link><h1 className="text-xl font-semibold">Laboratory report</h1></div>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print or save PDF</button>
      </div>
      <article className="print-sheet mx-auto max-w-[900px] rounded-[10px] border border-line bg-white p-5 shadow-[0_2px_18px_rgba(11, 43, 38,0.07)] sm:p-12">
        <DocHeader title="Laboratory report" lines={[{ k: "Report number", v: `LAB${String(order.id).padStart(5, "0")}` }, { k: "Requested", v: fmtDate(order.orderedAt) }, { k: "Reported", v: fmtDate(day) }]} />
        <section className="mt-6 grid grid-cols-1 gap-6 border-b border-line-2 pb-6 text-[13px] sm:grid-cols-2 sm:gap-8">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5"><dt className="text-muted">Patient</dt><dd className="font-semibold">{p?.name}</dd><dt className="text-muted">Record number</dt><dd>{p?.mrn}</dd><dt className="text-muted">Age and sex</dt><dd>{p ? `${age(p.dob)} years, ${p.gender}` : ""}</dd><dt className="text-muted">Phone</dt><dd>{p?.phone}</dd></dl>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5"><dt className="text-muted">Requested by</dt><dd>{L.doctorName(order.doctorId)}</dd><dt className="text-muted">Source</dt><dd>{order.source}</dd><dt className="text-muted">Ordered</dt><dd>{dayName(day)} {fmtTime(order.orderedAt)}</dd><dt className="text-muted">Tests reported</dt><dd>{rows.length}</dd></dl>
        </section>

        {critical.length > 0 && <div className="mt-5 rounded-lg border border-[#f2c6c2] bg-bad-50 px-4 py-3 text-[13px] text-bad"><strong>Critical value reported.</strong> {critical.map((r) => `${r.t.name} ${r.o.result} ${r.t.unit}`).join(", ")}. The requesting clinician was informed before release.</div>}
        {off.length > 0 && critical.length === 0 && <div className="mt-5 rounded-lg bg-warn-50 px-4 py-3 text-[13px] text-warn">{off.length} of {rows.length} results are outside the reference range and are shaded below.</div>}

        {groups.map((g) => (
          <section key={g} className="mt-7 break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold text-ink">{g}</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b-2 border-brand text-left text-xs font-semibold text-muted"><th className="pb-2">Test</th><th className="w-28 pb-2 text-right">Result</th><th className="w-28 pb-2 pl-5">Flag</th><th className="w-36 pb-2">Reference range</th><th className="w-36 pb-2">Position in range</th><th className="w-28 pb-2">Trend</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.t.category === g).map((r) => {
                  const bad = r.o.flag && r.o.flag !== "Normal";
                  const h = prev(r);
                  return (
                    <tr key={r.o.id} className={`border-b border-line-2 ${bad ? "bg-[#fff8ec]" : ""}`}>
                      <td className="py-3 pr-2 font-medium">{r.t.name}{r.o.notes && <div className="text-xs font-normal text-muted">{r.o.notes}</div>}</td>
                      <td className={`py-3 text-right tabular-nums ${bad ? "font-semibold" : ""}`}>{String(r.o.result)} <span className="text-xs font-normal text-muted">{r.t.unit}</span></td>
                      <td className="py-3 pl-5"><FlagBadge flag={r.o.flag} /></td>
                      <td className="py-3 text-muted">{rangeText(r.t)}</td>
                      <td className="py-3">{isQuant(r.t) ? <RangeGauge test={r.t} value={r.o.result} /> : <span className="text-xs text-muted">Qualitative</span>}</td>
                      <td className="py-3">{isQuant(r.t) ? <Trend test={r.t} points={[...h.map((x) => Number(x.result)), Number(r.o.result)]} /> : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </section>
        ))}
        <section className="mt-9 grid grid-cols-2 gap-10 text-[13px]">
          <div><div className="mb-8 border-b border-line" /><div className="font-medium">{rows[0]?.o.verifiedBy || "Laboratory technologist"}</div><div className="text-xs text-muted">Verified and released, {fmtDateTime(order.orderedAt)}</div></div>
          <div><div className="mb-8 border-b border-line" /><div className="font-medium">Laboratory manager</div><div className="text-xs text-muted">Authorised signatory</div></div>
        </section>
        <DocFooter>Results must be interpreted with the clinical findings. Reference ranges are adult values. Shaded rows are outside the reference range.</DocFooter>
      </article>
    </div>
  );
}
