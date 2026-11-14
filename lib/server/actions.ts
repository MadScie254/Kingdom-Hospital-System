import { invoiceTotals, statusFor } from "../billing";
import type { Session } from "./auth";
import { audit, auditLast, guard, NOW_EAT, TODAY_EAT, rowOf, rowsOf, type Sql } from "./db";
import { HttpError } from "./http";

export type Out = { changes: Record<string, any[]>; result?: any };
type Action = (s: Sql, u: Session, b: any) => Promise<Out>;

const int = (v: any, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${label}.`);
  return n;
};
const str = (v: any, max = 200) => String(v ?? "").slice(0, max);
const day = (v: any, label: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new HttpError(400, `Enter a valid ${label}.`);
  return String(v);
};
const pct = (v: any) => Math.min(Math.max(Number(v) || 0, 0), 100);

function cleanItems(v: any) {
  if (!Array.isArray(v) || v.length === 0 || v.length > 100) throw new HttpError(400, "Add at least one item to the invoice.");
  return v.map((l: any) => {
    const description = str(l?.description), qty = Number(l?.qty), price = Number(l?.price);
    if (!description.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0)
      throw new HttpError(400, "Check the invoice items. Each needs a description, a quantity above zero and a price.");
    return { description, qty, price };
  });
}

function invoiceFields(b: any) {
  const items = cleanItems(b.items);
  const discountPct = pct(b.discountPct), vatPct = pct(b.vatPct);
  return {
    items, discountPct, vatPct, totals: invoiceTotals({ items, discountPct, vatPct }),
    base: { patientId: int(b.patientId, "patient"), doctorId: int(b.doctorId, "doctor"), source: str(b.source, 20) || "OPD", date: day(b.date, "issue date"), dueDate: day(b.dueDate, "due date"), items, discountPct, vatPct, method: str(b.method, 30) || "M Pesa", note: str(b.note, 500) },
  };
}

const invoiceCreate: Action = async (s, u, b) => {
  const f = invoiceFields(b);
  const draft = !!b.draft;
  const paid = draft ? 0 : Math.min(Math.max(Number(b.deposit) || 0, 0), f.totals.total);
  const inv = { ...f.base, paid, status: draft ? "Draft" : statusFor(f.totals.total, paid) };
  const labIds: number[] = !draft && Array.isArray(b.labTestIds) ? b.labTestIds.map(Number).filter(Number.isInteger).slice(0, 50) : [];
  const NO = `'INV' || lpad(currval('invoice_no_seq')::text, 4, '0')`;
  const names: string[] = ["__guard", "invoices"];
  const qs = [guard(s, u), s.query(`insert into invoices (data) values ($1::jsonb || jsonb_build_object('no', 'INV' || lpad(nextval('invoice_no_seq')::text, 4, '0'))) returning id, data`, [JSON.stringify(inv)])];
  if (paid > 0) {
    names.push("payments");
    qs.push(s.query(`insert into payments (data) values (jsonb_build_object('invoiceNo', ${NO}, 'patientId', $1::int, 'date', ${TODAY_EAT}, 'amount', $2::numeric, 'method', $3::text, 'reference', $4::text)) returning id, data`, [inv.patientId, paid, inv.method, str(b.reference, 60) || (inv.method === "Cash" ? "Counter receipt" : "Not recorded")]));
  }
  if (labIds.length) {
    names.push("labOrders");
    qs.push(s.query(`insert into lab_orders (data) select jsonb_build_object('patientId', $1::int, 'doctorId', $2::int, 'testId', c.id, 'source', $3::text, 'orderedAt', ${NOW_EAT}, 'status', 'Ordered', 'result', null, 'flag', '', 'collectedBy', '', 'verifiedBy', '', 'priority', 'Routine', 'notes', '') from lab_catalog c where c.id = any($4::int[]) returning id, data`, [inv.patientId, inv.doctorId, inv.source, labIds]));
  }
  if (!draft && b.billSha) {
    names.push("shaClaims");
    qs.push(s.query(`insert into sha_claims (data) values (jsonb_build_object('claimNo', 'SHA2026' || lpad(nextval('sha_claim_seq')::text, 4, '0'), 'invoiceNo', ${NO}, 'patientId', $1::int, 'intervention', 'Outpatient, primary care', 'fund', 'SHIF', 'amount', $2::numeric, 'status', 'Draft', 'submitted', $3::text, 'remarks', '')) returning id, data`, [inv.patientId, Math.round(f.totals.total * 0.85), inv.date]));
  }
  const audited = qs.length;
  qs.push(s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, 'invoice.create', 'invoices', 'INV' || lpad(currval('invoice_no_seq')::text, 4, '0'))`, [u.email]));
  const res = await s.transaction(qs);
  const changes: Record<string, any[]> = {};
  names.forEach((n, i) => { if (n !== "__guard") changes[n] = rowsOf(res[i]); });
  void audited;
  return { changes, result: { no: changes.invoices[0].no } };
};

const invoiceUpdate: Action = async (s, u, b) => {
  const no = str(b.no, 20);
  const f = invoiceFields(b);
  const [cur] = await s.query(`select id, data from invoices where data->>'no' = $1`, [no]);
  if (!cur) throw new HttpError(404, "Invoice not found.");
  const paid = Number(cur.data.paid) || 0;
  const patch = { ...f.base, status: b.draft ? "Draft" : statusFor(f.totals.total, paid) };
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(`update invoices set data = data || $1::jsonb, updated_at = now() where id = $2 returning id, data`, [JSON.stringify(patch), cur.id]),
    audit(s, u.email, "invoice.update", "invoices", cur.id),
  ]);
  return { changes: { invoices: rowsOf(rows) }, result: { no } };
};

const paymentRecord: Action = async (s, u, b) => {
  const no = str(b.invoiceNo, 20);
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Enter an amount above zero.");
  const method = str(b.method, 30) || "Cash";
  const reference = str(b.reference, 60) || (method === "Cash" ? "Counter receipt" : "Not recorded");
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(
      `with inv as (
         select id, data, invoice_total(data) as total, coalesce((data->>'paid')::numeric, 0) as paid
         from invoices where data->>'no' = $1 and data->>'status' <> 'Draft' for update
       ), pay as (
         insert into payments (data)
         select jsonb_build_object('invoiceNo', $1::text, 'patientId', (inv.data->>'patientId')::int, 'date', ${TODAY_EAT}, 'amount', least($2::numeric, inv.total - inv.paid), 'method', $3::text, 'reference', $4::text)
         from inv where inv.total - inv.paid > 0 returning id, data
       ), upd as (
         update invoices i set updated_at = now(), data = i.data || jsonb_build_object(
           'paid', inv.paid + (pay.data->>'amount')::numeric,
           'status', case when inv.paid + (pay.data->>'amount')::numeric >= inv.total then 'Paid' else 'Partial' end,
           'method', $3::text)
         from inv, pay where i.id = inv.id returning i.id, i.data
       )
       select (select to_jsonb(upd) from upd) as invoice, (select to_jsonb(pay) from pay) as payment`,
      [no, amount, method, reference],
    ),
    audit(s, u.email, "payment.record", "invoices", no),
  ]);
  const r = rows[0];
  if (!r?.invoice) throw new HttpError(409, "This invoice has no balance to pay, or it is still a draft.");
  return { changes: { invoices: [rowOf(r.invoice)], payments: [rowOf(r.payment)] } };
};

const admit: Action = async (s, u, b) => {
  const bedId = int(b.bedId, "bed"), patientId = int(b.patientId, "patient"), doctorId = int(b.doctorId, "doctor");
  const [, adm, bed] = await s.transaction([
    guard(s, u),
    s.query(`insert into admissions (data) select jsonb_build_object('bedId', $1::int, 'patientId', $2::int, 'doctorId', $3::int, 'admittedAt', ${NOW_EAT}, 'dischargedAt', '', 'diagnosis', $4::text, 'status', 'Admitted', 'due', 0) from beds b where b.id = $1 and b.data->>'status' = 'Available' returning id, data`, [bedId, patientId, doctorId, str(b.diagnosis, 300) || "Under assessment"]),
    s.query(`update beds set data = data || jsonb_build_object('status', 'Occupied', 'patientId', $2::int), updated_at = now() where id = $1 and data->>'status' = 'Available' returning id, data`, [bedId, patientId]),
    audit(s, u.email, "admission.admit", "admissions", bedId),
  ]);
  if (!adm.length) throw new HttpError(409, "That bed is no longer available.");
  return { changes: { admissions: rowsOf(adm), beds: rowsOf(bed) } };
};

const transfer: Action = async (s, u, b) => {
  const admissionId = int(b.admissionId, "admission"), toBedId = int(b.toBedId, "bed");
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(
      `with a as (select id, data from admissions where id = $1 and data->>'status' = 'Admitted' for update),
       nb as (update beds set data = data || jsonb_build_object('status', 'Occupied', 'patientId', (select (data->>'patientId')::int from a)), updated_at = now()
              where id = $2 and data->>'status' = 'Available' and exists (select 1 from a) returning id, data),
       ad as (update admissions x set data = x.data || jsonb_build_object('bedId', $2::int), updated_at = now() from a, nb where x.id = a.id returning x.id, x.data),
       ob as (update beds set data = data || jsonb_build_object('status', 'Cleaning', 'patientId', null), updated_at = now()
              where id = (select (data->>'bedId')::int from a) and exists (select 1 from nb) returning id, data)
       select (select coalesce(jsonb_agg(to_jsonb(ad)), '[]'::jsonb) from ad) as admissions,
              (select coalesce(jsonb_agg(to_jsonb(nb)), '[]'::jsonb) from nb) || (select coalesce(jsonb_agg(to_jsonb(ob)), '[]'::jsonb) from ob) as beds`,
      [admissionId, toBedId],
    ),
    audit(s, u.email, "admission.transfer", "admissions", admissionId),
  ]);
  const r = rows[0];
  if (!r?.admissions?.length) throw new HttpError(409, "The transfer could not be made. The target bed may be taken.");
  return { changes: { admissions: rowsOf(r.admissions), beds: rowsOf(r.beds) } };
};

const discharge: Action = async (s, u, b) => {
  const admissionId = int(b.admissionId, "admission");
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(
      `with a as (update admissions set data = data || jsonb_build_object('status', 'Discharged', 'dischargedAt', ${NOW_EAT}), updated_at = now()
                  where id = $1 and data->>'status' = 'Admitted' returning id, data),
       bd as (update beds set data = data || jsonb_build_object('status', 'Cleaning', 'patientId', null), updated_at = now()
              where id = (select (data->>'bedId')::int from a) returning id, data),
       iv as (insert into invoices (data)
              select jsonb_build_object('no', 'INV' || lpad(nextval('invoice_no_seq')::text, 4, '0'),
                       'patientId', (a.data->>'patientId')::int, 'doctorId', (a.data->>'doctorId')::int,
                       'date', ${TODAY_EAT}, 'dueDate', to_char((now() at time zone 'Africa/Nairobi')::date + 14, 'YYYY-MM-DD'),
                       'items', jsonb_build_array(jsonb_build_object('description', 'Bed charges, ' || (bd.data->>'ward') || ', ' || d.days::text || case when d.days = 1 then ' day' else ' days' end, 'qty', d.days, 'price', (bd.data->>'price')::numeric)),
                       'discountPct', 0, 'vatPct', 0, 'paid', 0, 'status', 'Due', 'source', 'Inpatient', 'method', 'SHA',
                       'note', 'Admission: ' || coalesce(a.data->>'diagnosis', ''))
              from a, bd, lateral (select greatest(1, (now() at time zone 'Africa/Nairobi')::date - substr(a.data->>'admittedAt', 1, 10)::date) as days) d
              returning id, data)
       select (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from a) as admissions,
              (select coalesce(jsonb_agg(to_jsonb(bd)), '[]'::jsonb) from bd) as beds,
              (select coalesce(jsonb_agg(to_jsonb(iv)), '[]'::jsonb) from iv) as invoices`,
      [admissionId],
    ),
    audit(s, u.email, "admission.discharge", "admissions", admissionId),
  ]);
  const r = rows[0];
  if (!r?.admissions?.length) throw new HttpError(409, "This patient is not currently admitted.");
  const invoices = rowsOf(r.invoices);
  return { changes: { admissions: rowsOf(r.admissions), beds: rowsOf(r.beds), invoices }, result: { no: invoices[0]?.no, total: invoiceTotals(invoices[0] as any).total } };
};

const pharmacySale: Action = async (s, u, b) => {
  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > 100) throw new HttpError(400, "Add at least one medicine to the sale.");
  const merged = new Map<number, number>();
  lines.forEach((l: any) => { const id = int(l?.medicineId, "medicine"); merged.set(id, (merged.get(id) || 0) + int(l?.qty, "quantity")); });
  const payload = [...merged].map(([medicineId, qty]) => ({ medicineId, qty }));
  const [, rows] = await s.transaction([
    guard(s, u),
    s.query(
      `with req as (select (l->>'medicineId')::int as id, (l->>'qty')::int as qty from jsonb_array_elements($1::jsonb) l),
       upd as (update medicines m set data = jsonb_set(m.data, '{quantity}', to_jsonb((m.data->>'quantity')::int - req.qty)), updated_at = now()
               from req where m.id = req.id returning m.id, m.data, req.qty),
       sale as (insert into pharmacy_sales (data)
                select jsonb_build_object('date', ${NOW_EAT}, 'patientId', $2::int, 'method', $3::text,
                         'total', sum((upd.data->>'sale')::numeric * upd.qty),
                         'lines', jsonb_agg(jsonb_build_object('medicineId', upd.id, 'name', upd.data->>'name', 'qty', upd.qty, 'price', (upd.data->>'sale')::numeric)))
                from upd having count(*) > 0 returning id, data)
       select (select jsonb_agg(jsonb_build_object('id', upd.id, 'data', upd.data)) from upd) as medicines, (select to_jsonb(sale) from sale) as sale`,
      [JSON.stringify(payload), b.patientId ? int(b.patientId, "patient") : null, str(b.method, 30) || "Cash"],
    ),
    audit(s, u.email, "pharmacy.sale", "pharmacySales", payload.length),
  ]);
  const r = rows[0];
  if (!r?.sale) throw new HttpError(409, "Some of those medicines were not found.");
  return { changes: { medicines: rowsOf(r.medicines), pharmacySales: [rowOf(r.sale)] } };
};

export const ACTIONS: Record<string, Action> = {
  "invoice.create": invoiceCreate,
  "invoice.update": invoiceUpdate,
  "payment.record": paymentRecord,
  "admission.admit": admit,
  "admission.transfer": transfer,
  "admission.discharge": discharge,
  "pharmacy.sale": pharmacySale,
};
void auditLast;
