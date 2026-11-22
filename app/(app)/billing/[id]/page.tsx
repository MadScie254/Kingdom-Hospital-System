"use client";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, Mail, Pencil, Printer, Copy } from "lucide-react";
import { db, useDB, useLookup } from "@/lib/store";
import { ResourcePage } from "@/components/resource";
import { RESOURCES } from "@/lib/registry";
import { Badge, Dialog, Field, Status, toast } from "@/components/ui";
import { DocFooter, DocHeader, useHospital } from "@/components/documents";
import { invoiceTotals, statusFor, nextInvoiceNo } from "@/lib/billing";
import { ANCHOR, fmtDate, kes, age } from "@/lib/format";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const key = `billing/${id}`;
  if (RESOURCES[key]) return <ResourcePage k={key} />;
  return <InvoiceView id={id} />;
}

function InvoiceView({ id }: { id: string }) {
  const d = useDB();
  const L = useLookup();
  const h = useHospital();
  const router = useRouter();
  const inv = d.invoices.find((i) => i.no === id);
  const [pay, setPay] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("M Pesa");
  const [ref, setRef] = useState("");

  useEffect(() => { if (typeof window !== "undefined" && window.location.search.includes("print=1")) setTimeout(() => window.print(), 400); }, []);
  if (!inv) { if (d.invoices.length) notFound(); return null; }

  const t = invoiceTotals(inv);
  const balance = t.total - inv.paid;
  const p = L.patient(inv.patientId);
  const receipts = d.payments.filter((x) => x.invoiceNo === inv.no);
  const claim = d.shaClaims.find((c) => c.invoiceNo === inv.no);
  const overdue = inv.status !== "Paid" && inv.status !== "Draft" && inv.dueDate < ANCHOR;

  const record = async () => {
    const amt = Math.min(Number(amount) || 0, balance);
    if (amt <= 0) return;
    const res = await db.action("payment.record", { invoiceNo: inv.no, amount: amt, method, reference: ref });
    if (!res) return;
    toast(`Payment of ${kes(amt)} recorded`);
    setPay(false); setAmount(""); setRef("");
  };
  const duplicate = async () => {
    const res = await db.action("invoice.create", { patientId: inv.patientId, doctorId: inv.doctorId, source: inv.source, date: ANCHOR, dueDate: ANCHOR, items: inv.items, discountPct: inv.discountPct, vatPct: inv.vatPct, method: inv.method, note: inv.note, draft: true });
    if (!res) return;
    toast(`Draft ${res.no} created`);
    router.push(`/billing/${res.no}`);
  };
  const mail = `mailto:${p?.email ?? ""}?subject=${encodeURIComponent(`Invoice ${inv.no} from ${h.name}`)}&body=${encodeURIComponent(`Dear ${p?.name},\n\nInvoice ${inv.no} for ${kes(t.total)} is attached. Balance due: ${kes(balance)}.\n\n${h.mpesaPaybill ? `Pay by M Pesa Paybill ${h.mpesaPaybill}, account ${p?.mrn}.\n\n` : ""}${h.name}`)}`;

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/billing" className="btn btn-secondary btn-icon" aria-label="Back to invoices"><ArrowLeft size={16} /></Link>
          <div><h1 className="text-xl font-semibold">Invoice {inv.no}</h1><div className="mt-0.5 flex items-center gap-2"><Status value={overdue ? "Overdue" : inv.status} /><span className="text-xs text-muted">Issued {fmtDate(inv.date)}</span></div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/billing/new?edit=${inv.no}`} className="btn btn-secondary"><Pencil size={15} />Edit</Link>
          <button className="btn btn-secondary" onClick={duplicate}><Copy size={15} />Duplicate</button>
          <a href={mail} className="btn btn-secondary"><Mail size={15} />Email</a>
          <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={15} />Print or save PDF</button>
          {balance > 0 && inv.status !== "Draft" && <button className="btn btn-primary" onClick={() => { setAmount(String(balance)); setPay(true); }}><CreditCard size={15} />Record payment</button>}
        </div>
      </div>

      <article className="print-sheet mx-auto max-w-[880px] rounded-[10px] border border-line bg-white p-5 shadow-[0_2px_18px_rgba(11, 43, 38,0.07)] sm:p-12">
        <DocHeader title="Invoice" lines={[{ k: "Invoice number", v: inv.no }, { k: "Date issued", v: fmtDate(inv.date) }, { k: "Payment due", v: fmtDate(inv.dueDate) }]} />

        <section className="mt-7 grid grid-cols-1 gap-6 text-[13px] sm:grid-cols-2 sm:gap-8">
          <div>
            <h2 className="mb-1.5 text-xs font-semibold text-muted">Bill to</h2>
            <div className="text-[15px] font-semibold">{p?.name}</div>
            <div className="mt-0.5 leading-relaxed text-muted">Record number {p?.mrn}<br />{p?.address}<br />{p?.phone}{p ? `, ${age(p.dob)} years, ${p.gender}` : ""}</div>
          </div>
          <div>
            <h2 className="mb-1.5 text-xs font-semibold text-muted">Visit details</h2>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1">
              <dt className="text-muted">Attending doctor</dt><dd>{L.doctorName(inv.doctorId)}</dd>
              <dt className="text-muted">Service area</dt><dd>{inv.source}</dd>
              <dt className="text-muted">Cover</dt><dd>{p?.crId ? `SHA, ${p.crId}` : p?.shaNumber ? `SHA, number ${p.shaNumber.replace(/^SHA/i, "")}` : p?.insurer || "Self pay"}</dd>
              {claim && (<><dt className="text-muted">SHA claim</dt><dd><Link href={`/sha/${claim.id}`} className="text-brand hover:underline">{claim.claimNo}</Link> <span className="text-muted">({claim.status})</span></dd></>)}
            </dl>
          </div>
        </section>

        <div className="mt-8 overflow-x-auto"><table className="w-full min-w-[480px] text-[13px]">
          <thead><tr className="border-b-2 border-brand text-left text-xs font-semibold text-muted"><th className="w-8 pb-2">No</th><th className="pb-2">Description</th><th className="w-16 pb-2 text-right">Qty</th><th className="w-28 pb-2 text-right">Rate</th><th className="w-32 pb-2 text-right">Amount</th></tr></thead>
          <tbody>
            {inv.items.map((l: any, i: number) => (
              <tr key={i} className="border-b border-line-2"><td className="py-3 text-muted tabular-nums">{i + 1}</td><td className="py-3 font-medium">{l.description}</td><td className="py-3 text-right tabular-nums">{l.qty}</td><td className="py-3 text-right tabular-nums">{kes(l.price)}</td><td className="py-3 text-right font-medium tabular-nums">{kes(l.qty * l.price)}</td></tr>
            ))}
          </tbody>
        </table></div>

        <section className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_300px] sm:gap-10">
          <div className="text-[13px] leading-relaxed">
            {h.mpesaPaybill || h.bank ? (<>
              <h2 className="mb-1.5 text-xs font-semibold text-muted">How to pay</h2>
              {h.mpesaPaybill && <p>M Pesa: Paybill <strong>{h.mpesaPaybill}</strong>, account number <strong>{p?.mrn}</strong></p>}
              {h.bank && <p className="mt-1">Bank transfer: {h.bank}</p>}
              <p className="mt-1 text-muted">Quote {inv.no} as the payment reference.</p>
            </>) : <p className="no-print text-xs text-muted">Add M Pesa or bank details in Settings to print payment instructions here.</p>}
            {inv.note && (<><h2 className="mb-1.5 mt-5 text-xs font-semibold text-muted">Note</h2><p>{inv.note}</p></>)}
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{kes(t.sub)}</dd></div>
            {t.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount ({inv.discountPct}%)</dt><dd className="tabular-nums">{kes(-t.discount)}</dd></div>}
            {t.vat > 0 && <div className="flex justify-between"><dt className="text-muted">VAT ({inv.vatPct}%)</dt><dd className="tabular-nums">{kes(t.vat)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{kes(t.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Payments received</dt><dd className="tabular-nums text-ok">{kes(-inv.paid)}</dd></div>
            <div className={`flex items-center justify-between rounded-lg px-4 py-3.5 ${balance <= 0 && inv.status !== "Draft" ? "bg-ok-50 text-ok" : overdue ? "bg-bad-50 text-bad" : "bg-brand text-white"}`}>
              <dt className="font-semibold">{balance <= 0 && inv.status !== "Draft" ? "Paid in full" : "Balance due"}</dt><dd className="text-xl font-semibold tabular-nums">{kes(Math.max(balance, 0))}</dd>
            </div>
          </dl>
        </section>

        {receipts.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-xs font-semibold text-muted">Payments received</h2>
            <table className="w-full text-[13px]"><tbody>{receipts.map((r) => <tr key={r.id} className="border-b border-line-2"><td className="py-2">{fmtDate(r.date)}</td><td className="py-2">{r.method}</td><td className="py-2 text-muted">{r.reference}</td><td className="py-2 text-right tabular-nums">{kes(r.amount)}</td></tr>)}</tbody></table>
          </section>
        )}
        <DocFooter><div>{h.footer}</div>{inv.status === "Draft" && <div className="mt-1"><Badge tone="mute" plain>Draft, not yet issued</Badge></div>}</DocFooter>
      </article>

      <Dialog open={pay} onClose={() => setPay(false)} title={`Record payment for ${inv.no}`}
        footer={<><button className="btn btn-secondary" onClick={() => setPay(false)}>Cancel</button><button className="btn btn-primary" onClick={record}>Save payment</button></>}>
        <div className="mt-3 space-y-3.5 text-text">
          <Field label="Amount received (KES)"><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Payment method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{["M Pesa", "Cash", "Card", "SHA", "Insurance", "Bank transfer"].map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Reference" hint="M Pesa code, card slip number or bank reference"><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <p className="text-xs text-muted">Balance after this payment: {kes(Math.max(balance - (Number(amount) || 0), 0))}</p>
        </div>
      </Dialog>
    </div>
  );
}
