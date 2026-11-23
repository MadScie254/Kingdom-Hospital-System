"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { db, useDB } from "@/lib/store";
import { Field, PageHeader, toast } from "@/components/ui";
import { invoiceTotals, nextInvoiceNo, statusFor, type Line } from "@/lib/billing";
import { ANCHOR, addDays, kes, nowISO } from "@/lib/format";

type Opt = { name: string; price: number; kind: string };

export default function NewInvoice() {
  const d = useDB();
  const router = useRouter();
  const [editNo, setEditNo] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [source, setSource] = useState("OPD");
  const [date, setDate] = useState(ANCHOR);
  const [dueDate, setDueDate] = useState(addDays(ANCHOR, 14));
  const [items, setItems] = useState<Line[]>([]);
  const [discountPct, setDiscountPct] = useState("0");
  const [vatPct, setVatPct] = useState("0");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("M Pesa");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get("edit");
    const inv = no && db.get().invoices.find((i) => i.no === no);
    if (inv) {
      setEditNo(inv.no); setPatientId(String(inv.patientId)); setDoctorId(String(inv.doctorId)); setSource(inv.source); setDate(inv.date); setDueDate(inv.dueDate);
      setItems(inv.items); setDiscountPct(String(inv.discountPct || 0)); setVatPct(String(inv.vatPct || 0)); setNote(inv.note || ""); setMethod(inv.method);
    }
  }, []);

  const catalog: Opt[] = useMemo(() => [
    ...d.services.map((s) => ({ name: s.name, price: s.price, kind: "Service" })),
    ...d.labCatalog.map((s) => ({ name: s.name, price: s.price, kind: "Laboratory" })),
    ...d.medicines.map((s) => ({ name: s.name, price: s.sale, kind: "Pharmacy" })),
  ], [d.services, d.labCatalog, d.medicines]);
  const hits = q.trim().length > 0 ? catalog.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];

  const totals = invoiceTotals({ items, discountPct: Number(discountPct), vatPct: Number(vatPct) });
  const paidNow = Math.min(Number(deposit) || 0, totals.total);
  const patient = d.patients.find((p) => p.id === Number(patientId));

  const add = (o: Opt) => { setItems((l) => { const i = l.findIndex((x) => x.description === o.name); return i >= 0 ? l.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)) : [...l, { description: o.name, qty: 1, price: o.price }]; }); setQ(""); };
  const upd = (i: number, p: Partial<Line>) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const save = async (mode: "save" | "print" | "draft") => {
    if (!patientId || !doctorId) { setErr("Choose a patient and the attending doctor."); return; }
    if (!items.length) { setErr("Add at least one item to the invoice."); return; }
    setErr("");
    const draft = mode === "draft";
    const base = { patientId: Number(patientId), doctorId: Number(doctorId), source, date, dueDate, items, discountPct: Number(discountPct) || 0, vatPct: Number(vatPct) || 0, note, method, draft };
    const labTestIds = draft ? [] : items.map((l) => d.labCatalog.find((x) => x.name === l.description)?.id).filter((x): x is number => !!x);
    const res = editNo
      ? await db.action("invoice.update", { ...base, no: editNo })
      : await db.action("invoice.create", { ...base, deposit: Number(deposit) || 0, reference, labTestIds });
    if (!res) return;
    const no = res.no as string;
    toast(editNo ? `Invoice ${no} updated` : draft ? `Draft ${no} saved` : `Invoice ${no} saved${labTestIds.length ? `, ${labTestIds.length} lab ${labTestIds.length === 1 ? "test" : "tests"} sent to the laboratory` : ""}`);
    router.push(`/billing/${no}${mode === "print" ? "?print=1" : ""}`);
  };

  return (
    <div>
      <PageHeader title={editNo ? `Edit invoice ${editNo}` : "New invoice"} crumbs={[{ label: "Billing", href: "/billing" }, { label: editNo ? "Edit invoice" : "New invoice" }]} description="Search the item list, adjust quantities and take a deposit in one step. Lab tests go straight to the laboratory worklist." />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="card-title mb-4">Patient and visit</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient" required><select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Select patient</option>{d.patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></Field>
              <Field label="Attending doctor" required><select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">Select doctor</option>{d.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Service area"><select className="input" value={source} onChange={(e) => setSource(e.target.value)}>{["OPD", "Inpatient", "Lab", "Pharmacy", "Emergency"].map((s) => <option key={s}>{s}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Issue date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Due date"><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field></div>
            </div>
            {patient && <p className="mt-4 rounded-md bg-surface px-3 py-2 text-xs text-muted">Cover on file: {patient.shaNumber ? `SHA ${patient.shaNumber}` : patient.insurer}. Allergies: {patient.allergies}.</p>}
          </section>

          <section className="card">
            <div className="card-head"><h2 className="card-title">Items</h2><button className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { description: "", qty: 1, price: 0 }])}><Plus size={14} />Custom line</button></div>
            <div className="border-b border-line-2 p-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input className="input pl-9" placeholder="Search services, lab tests and medicines" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
                {hits.length > 0 && (
                  <ul className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
                    {hits.map((h) => <li key={h.kind + h.name}><button className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-surface" onClick={() => add(h)}><span>{h.name} <span className="text-xs text-muted">{h.kind}</span></span><span className="tabular-nums text-muted">{kes(h.price, 0)}</span></button></li>)}
                  </ul>
                )}
              </div>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Description</th><th className="w-24 text-right">Qty</th><th className="w-36 text-right">Rate (KES)</th><th className="w-36 text-right">Amount</th><th className="w-12" /></tr></thead>
                <tbody>
                  {items.map((l, i) => (
                    <tr key={i}>
                      <td><input className="input" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} aria-label="Description" /></td>
                      <td><input className="input text-right" type="number" min={1} value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} aria-label="Quantity" /></td>
                      <td><input className="input text-right" type="number" min={0} value={l.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} aria-label="Rate" /></td>
                      <td className="num font-medium">{kes(l.qty * l.price)}</td>
                      <td><button className="btn btn-ghost btn-icon hover:!text-bad" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Remove line"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <div className="px-6 py-12 text-center text-[13px] text-muted">Search above to add the first item. Prices come from the service list, test catalogue and pharmacy.</div>}
            </div>
          </section>
          <Field label="Note on invoice"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown on the printed invoice" /></Field>
        </div>

        <aside className="card card-pad space-y-3.5 xl:sticky xl:top-20">
          <h2 className="card-title">Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (%)"><input className="input" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
            <Field label="VAT (%)"><input className="input" type="number" min={0} value={vatPct} onChange={(e) => setVatPct(e.target.value)} /></Field>
          </div>
          <dl className="space-y-2 border-y border-line-2 py-3 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{kes(totals.sub)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular-nums">{kes(-totals.discount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">VAT</dt><dd className="tabular-nums">{kes(totals.vat)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{kes(totals.total)}</dd></div>
          </dl>
          {!editNo && (<>
            <Field label="Deposit taken now (KES)"><input className="input" type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{["M Pesa", "Cash", "Card", "SHA", "Insurance"].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Reference"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M Pesa code" /></Field>
            </div>
            <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">SHA patients: start the visit from the SHA screen so the patient consents first. Enter this invoice number when the claim is submitted.</p>
          </>)}
          <div className="flex justify-between rounded-lg bg-brand-50 px-4 py-3 text-brand"><span className="font-semibold">Balance due</span><span className="text-lg font-semibold tabular-nums">{kes(totals.total - (editNo ? d.invoices.find((i) => i.no === editNo)?.paid || 0 : paidNow))}</span></div>
          {err && <p className="text-[13px] text-bad" role="alert">{err}</p>}
          <div className="grid gap-2">
            <button className="btn btn-primary h-10" onClick={() => save("save")}>Save invoice</button>
            <button className="btn btn-secondary h-10" onClick={() => save("print")}>Save and print</button>
            <button className="btn btn-ghost h-10" onClick={() => save("draft")}>Save as draft</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
