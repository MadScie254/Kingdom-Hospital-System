import { COLLECTIONS, type CollectionName } from "../collections";
import { HttpError } from "./http";

/** Numbers handed out by the database, never accepted from the browser. */
export const AUTO_NUMBER: Partial<Record<CollectionName, { key: string; sql: string }>> = {
  patients: { key: "mrn", sql: `'KH' || nextval('patient_mrn_seq')` },
  invoices: { key: "no", sql: `'INV' || lpad(nextval('invoice_no_seq')::text, 4, '0')` },
  shaClaims: { key: "claimNo", sql: `'SHA2026' || lpad(nextval('sha_claim_seq')::text, 4, '0')` },
};
/** Money records change only through the billing workflows, which check balances and totals. */
export const ACTION_ONLY = new Set<CollectionName>(["invoices", "payments"]);
export const PROTECTED_KEYS = ["id", "mrn", "no", "claimNo"];

export function parseCollection(v: string): CollectionName {
  if (!(COLLECTIONS as readonly string[]).includes(v)) throw new HttpError(404, "Unknown record type.");
  return v as CollectionName;
}
export function cleanData(b: Record<string, any>, drop: string[] = PROTECTED_KEYS) {
  const o = { ...b };
  drop.forEach((k) => delete o[k]);
  return o;
}
