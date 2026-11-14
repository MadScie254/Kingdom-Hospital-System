"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, ClipboardCheck, FlaskConical, Plus, Search, Hourglass, Timer } from "lucide-react";
import { db, useDB, useLookup } from "@/lib/store";
import { Badge, Drawer, Field, PageHeader, Stat, toast } from "@/components/ui";
import { FlagBadge, RangeGauge, Trend } from "@/components/lab";
import { STAGES, STAGE_LABEL, flagFor, isQuant, rangeText } from "@/lib/lab";
import { ANCHOR, addDays, fmtShort, fmtTime, nowISO } from "@/lib/format";
import type { Row } from "@/lib/seed";

const ACTION: Record<string, string> = { Ordered: "Collect sample", Collected: "Start processing", Processing: "Enter result", Review: "Review and release", Released: "Open report" };

function ResultDrawer({ order, onClose }: { order: Row; onClose: () => void }) {
  const d = useDB();
  const L = useLookup();
  const test = d.labCatalog.find((t) => t.id === order.testId)!;
  const [val, setVal] = useState<string>(order.result === null ? "" : String(order.result));
  const [notes, setNotes] = useState(order.notes || "");
  const [told, setTold] = useState(false);
  const flag = flagFor(test, val);
  const history = d.labOrders.filter((o) => o.patientId === order.patientId && o.testId === order.testId && o.id !== order.id && o.status === "Released").sort((a, b) => a.orderedAt.localeCompare(b.orderedAt)).slice(-4);
  const quant = isQuant(test);
  const qualOptions = [test.refText || "Negative", test.name === "Urinalysis" ? "Leucocytes ++, nitrites positive" : test.name === "Malaria smear" ? "Positive, P. falciparum" : "Positive"];

  const commit = (status: "Review" | "Released") => {
    if (val === "") return;
    db.update("labOrders", order.id, { result: quant ? Number(val) : val, flag, notes, status, verifiedBy: status === "Released" ? "Martin Kariuki" : "" });
    toast(status === "Released" ? `${test.name} released for ${L.patientName(order.patientId)}` : `${test.name} saved for review`);
    onClose();
  };
  const reviewing = order.status === "Review";
  return (
    <Drawer open onClose={onClose} title={reviewing ? "Review and release result" : "Enter result"} subtitle={`${test.name}, ${test.specimen}`}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        {!reviewing && <button className="btn btn-secondary" disabled={val === ""} onClick={() => commit("Review")}>Save for review</button>}
        <button className="btn btn-primary" disabled={val === "" || (flag === "Critical" && !told)} onClick={() => commit("Released")}>Verify and release</button>
      </>}>
      <div className="rounded-lg bg-surface p-4 text-[13px]">
        <div className="font-medium">{L.patientName(order.patientId)}</div>
        <div className="text-muted">Requested by {L.doctorName(order.doctorId)}, {order.source}, ordered {fmtShort(order.orderedAt)} at {fmtTime(order.orderedAt)}</div>
      </div>
      <div className="mt-5">
        <label className="label" htmlFor="res">Result{test.unit ? ` (${test.unit})` : ""}</label>
        {quant ? <input id="res" className="input h-11 text-lg font-semibold" type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
          : <select id="res" className="input h-11" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Select result</option>{qualOptions.map((o) => <option key={o}>{o}</option>)}</select>}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-line px-4 py-3">
          <div><div className="text-xs text-muted">Reference range</div><div className="text-[13px] font-medium">{rangeText(test)}</div></div>
          <div className="flex items-center gap-3"><RangeGauge test={test} value={val === "" ? null : val} /><FlagBadge flag={flag} /></div>
        </div>
        {flag === "Critical" && (
          <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#f2c6c2] bg-bad-50 p-3 text-[13px] text-bad"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b42318]" checked={told} onChange={(e) => setTold(e.target.checked)} />I have informed the requesting clinician of this critical value.</label>
        )}
      </div>
      <div className="mt-5"><Field label="Technologist comment"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sample quality, repeat run, dilution" /></Field></div>
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold text-muted">Previous results for this patient</h3>
        {history.length === 0 ? <p className="text-[13px] text-muted">No earlier result on record for this test.</p> : (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
            <ul className="space-y-1 text-[13px]">{history.map((h) => <li key={h.id} className="flex gap-4"><span className="w-16 text-muted">{fmtShort(h.orderedAt)}</span><span className="font-medium tabular-nums">{String(h.result)}</span><FlagBadge flag={h.flag} /></li>)}</ul>
            {quant && <Trend test={test} points={[...history.map((h) => Number(h.result)), ...(val !== "" ? [Number(val)] : [])]} />}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function OrderDrawer({ onClose }: { onClose: () => void }) {
  const d = useDB();
  const [patientId, setP] = useState(""), [doctorId, setD] = useState(""), [priority, setPr] = useState("Routine"), [source, setS] = useState("OPD");
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const list = d.labCatalog.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const save = () => {
    if (!patientId || !doctorId || !picked.length) return;
    picked.forEach((testId) => db.add("labOrders", { patientId: Number(patientId), doctorId: Number(doctorId), testId, source, orderedAt: nowISO(), status: "Ordered", result: null, flag: "", collectedBy: "", verifiedBy: "", priority, notes: "" }));
    toast(`${picked.length} ${picked.length === 1 ? "test" : "tests"} ordered`);
    onClose();
  };
  return (
    <Drawer open onClose={onClose} title="Order laboratory tests" subtitle="Tests appear in the worklist as soon as they are saved. Billing is added from the invoice."
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!patientId || !doctorId || !picked.length} onClick={save}>Order {picked.length || ""} {picked.length === 1 ? "test" : "tests"}</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Patient" required><select className="input" value={patientId} onChange={(e) => setP(e.target.value)}><option value="">Select patient</option>{d.patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></Field>
        <Field label="Requesting doctor" required><select className="input" value={doctorId} onChange={(e) => setD(e.target.value)}><option value="">Select doctor</option>{d.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Priority"><select className="input" value={priority} onChange={(e) => setPr(e.target.value)}><option>Routine</option><option>Urgent</option></select></Field>
        <Field label="Source"><select className="input" value={source} onChange={(e) => setS(e.target.value)}>{["OPD", "Inpatient", "Emergency"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="mt-5"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search the test catalogue" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tests" /></div></div>
      <ul className="mt-3 divide-y divide-line-2 rounded-lg border border-line">
        {list.map((t) => (
          <li key={t.id}><label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[13px] hover:bg-surface"><input type="checkbox" className="h-4 w-4 accent-[#1b4f9c]" checked={picked.includes(t.id)} onChange={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))} /><span className="flex-1"><span className="font-medium">{t.name}</span> <span className="text-xs text-muted">{t.category}</span></span><span className="tabular-nums text-muted">KES {t.price}</span></label></li>
        ))}
      </ul>
    </Drawer>
  );
}

export default function Worklist() {
  const d = useDB();
  const L = useLookup();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [entry, setEntry] = useState<Row | null>(null);
  const [order, setOrder] = useState(false);
  const tests = useMemo(() => new Map(d.labCatalog.map((t) => [t.id, t])), [d.labCatalog]);

  const rows = d.labOrders.filter((o) => {
    const t = tests.get(o.testId); if (!t) return false;
    if (cat && t.category !== cat) return false;
    if (urgent && o.priority !== "Urgent") return false;
    if (q) { const n = q.toLowerCase(); if (!t.name.toLowerCase().includes(n) && !L.patientName(o.patientId).toLowerCase().includes(n)) return false; }
    return true;
  });
  const by = (s: string) => rows.filter((o) => o.status === s).sort((a, b) => (a.priority === b.priority ? a.orderedAt.localeCompare(b.orderedAt) : a.priority === "Urgent" ? -1 : 1));
  const queue = d.labOrders.filter((o) => ["Ordered", "Collected", "Processing"].includes(o.status)).length;
  const critical = d.labOrders.filter((o) => o.flag === "Critical" && o.status !== "Released").length;
  const releasedToday = d.labOrders.filter((o) => o.status === "Released" && o.orderedAt.startsWith(ANCHOR)).length;

  const advance = (o: Row) => {
    if (o.status === "Ordered") { db.update("labOrders", o.id, { status: "Collected", collectedBy: "Dorcas Moraa" }); toast("Sample collected"); }
    else if (o.status === "Collected") { db.update("labOrders", o.id, { status: "Processing" }); toast("Processing started"); }
    else setEntry(o);
  };

  return (
    <div>
      <PageHeader title="Laboratory worklist" description="Follow every request from order to released result. Urgent requests rise to the top of each column."
        actions={<><Link href="/lab/results" className="btn btn-secondary"><BarChart3 size={16} />Results and analysis</Link><button className="btn btn-primary" onClick={() => setOrder(true)}><Plus size={16} />Order tests</button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In the queue" value={queue} hint="Ordered, collected or processing" icon={Hourglass} tone="brand" />
        <Stat label="Awaiting review" value={d.labOrders.filter((o) => o.status === "Review").length} hint="Entered, not yet released" icon={ClipboardCheck} tone="warn" />
        <Stat label="Critical values" value={critical} hint={critical ? "Inform the clinician" : "None open"} icon={AlertTriangle} tone={critical ? "bad" : "ok"} />
        <Stat label="Released today" value={releasedToday} hint={`${d.labCatalog.length} tests in the catalogue`} icon={Timer} tone="ok" />
      </div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-[280px]"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search patient or test" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search worklist" /></div>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">Category: all</option>{[...new Set(d.labCatalog.map((t) => t.category))].map((c) => <option key={c}>{c}</option>)}</select>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#1b4f9c]" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Urgent only</label>
      </div>

      <div className="scroll-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-3 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {STAGES.map((s) => {
          const list = by(s).slice(0, s === "Released" ? 6 : 30);
          return (
            <section key={s} className="flex min-h-[320px] w-[272px] shrink-0 flex-col rounded-[10px] bg-[#e9eef5] p-2.5 xl:w-auto" aria-label={STAGE_LABEL[s]}>
              <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1"><h2 className="text-[13px] font-semibold">{STAGE_LABEL[s]}</h2><span className="rounded-full bg-white px-2 text-xs font-medium tabular-nums text-muted">{by(s).length}</span></header>
              <div className="space-y-2.5">
                {list.map((o) => {
                  const t = tests.get(o.testId)!;
                  return (
                    <article key={o.id} className="rounded-lg border border-line bg-white p-3 shadow-[0_1px_2px_rgba(12,31,58,0.05)]">
                      <div className="flex items-start justify-between gap-2"><h3 className="text-[13px] font-semibold leading-snug">{t.name}</h3>{o.priority === "Urgent" && s !== "Released" && <Badge tone="bad" plain>Urgent</Badge>}</div>
                      <div className="mt-1 text-[13px]">{L.patientName(o.patientId)}</div>
                      <div className="mt-0.5 text-xs text-muted">{L.patient(o.patientId)?.mrn}, {o.source}, {fmtShort(o.orderedAt)} {fmtTime(o.orderedAt)}</div>
                      {(s === "Review" || s === "Released") && o.result !== null && (
                        <div className="mt-2.5 flex items-center justify-between rounded-md bg-surface px-2.5 py-2"><span className="text-[13px] font-semibold tabular-nums">{String(o.result)} <span className="text-xs font-normal text-muted">{t.unit}</span></span><FlagBadge flag={o.flag} /></div>
                      )}
                      {s === "Released" ? (
                        <Link href={`/lab/report/${o.id}`} className="btn btn-secondary btn-sm mt-2.5 w-full">{ACTION[s]}</Link>
                      ) : (
                        <button className={`btn btn-sm mt-2.5 w-full ${s === "Review" || s === "Processing" ? "btn-primary" : "btn-secondary"}`} onClick={() => advance(o)}>{ACTION[s]}<ArrowRight size={13} /></button>
                      )}
                    </article>
                  );
                })}
                {list.length === 0 && <p className="px-2 py-8 text-center text-xs text-muted">Nothing here right now.</p>}
              </div>
            </section>
          );
        })}
      </div>
      {entry && <ResultDrawer order={entry} onClose={() => setEntry(null)} />}
      {order && <OrderDrawer onClose={() => setOrder(false)} />}
      <p className="mt-4 flex items-center gap-2 text-xs text-faint"><FlaskConical size={13} />Reference ranges come from the test catalogue. Change them under Test catalogue.</p>
    </div>
  );
}
