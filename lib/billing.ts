import type { Row } from "./seed";

export type Line = { description: string; qty: number; price: number };
export function invoiceTotals(inv: { items?: Line[]; discountPct?: number; vatPct?: number; [k: string]: any }) {
  const sub = (inv.items || []).reduce((a: number, l: Line) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const discount = Math.round(sub * ((inv.discountPct || 0) / 100));
  const taxable = sub - discount;
  const vat = Math.round(taxable * ((inv.vatPct || 0) / 100));
  return { sub, discount, vat, total: taxable + vat };
}
export const balance = (inv: Row) => invoiceTotals(inv as any).total - (inv.paid || 0);
export function statusFor(total: number, paid: number): "Paid" | "Partial" | "Due" {
  return paid >= total && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Due";
}
export function nextInvoiceNo(list: Row[]): string {
  const max = list.reduce((m, i) => Math.max(m, parseInt(String(i.no).replace(/\D/g, ""), 10) || 0), 0);
  return `INV${String(max + 1).padStart(4, "0")}`;
}
