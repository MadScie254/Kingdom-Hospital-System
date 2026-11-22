import { COLLECTIONS, type CollectionName } from "../collections";
import { SHA_CLAIM_NO_SQL } from "../claim-number";
import { HttpError } from "./http";

/** Numbers handed out by the database, never accepted from the browser. */
export const AUTO_NUMBER: Partial<Record<CollectionName, { key: string; sql: string }>> = {
  patients: { key: "mrn", sql: `'KH' || nextval('patient_mrn_seq')` },
  invoices: { key: "no", sql: `'INV' || lpad(nextval('invoice_no_seq')::text, 4, '0')` },
  shaClaims: { key: "claimNo", sql: SHA_CLAIM_NO_SQL },
};
/** Money records change only through the billing workflows, which check balances and totals. SHA claims change only through the SHA integration, so their status always comes from SHA. */
export const ACTION_ONLY = new Set<CollectionName>(["invoices", "payments", "shaClaims"]);
export const PROTECTED_KEYS = ["id", "mrn", "no", "claimNo"];

export function parseCollection(v: string): CollectionName {
  if (!(COLLECTIONS as readonly string[]).includes(v)) throw new HttpError(404, "Unknown record type.");
  return v as CollectionName;
}
/** Details every screen always sends. A row without them would break date filters and lists, so the server refuses it. */
const REQUIRED: Partial<Record<CollectionName, string[]>> = {
  patients: ["name"],
  visits: ["patientId", "date"],
  appointments: ["patientId", "date"],
  labOrders: ["patientId", "orderedAt"],
  prescriptions: ["patientId", "items"],
  emergencies: ["patientId"],
};
const LISTS: Partial<Record<CollectionName, string[]>> = { prescriptions: ["items"], invoices: ["items"], pharmacySales: ["lines"] };
const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
/** On create every required detail must be present. On update only the ones being changed are checked, so a detail cannot be blanked. */
export function requireFields(c: CollectionName, data: Record<string, any>, update = false) {
  for (const k of REQUIRED[c] || []) {
    if (update ? k in data && blank(data[k]) : blank(data[k])) throw new HttpError(400, "A required detail is missing. Fill in every field marked required.");
  }
  for (const k of LISTS[c] || []) if (k in data && !Array.isArray(data[k])) throw new HttpError(400, "A list in this record is not in the expected form.");
}
export function cleanData(b: Record<string, any>, drop: string[] = PROTECTED_KEYS) {
  const o = { ...b };
  drop.forEach((k) => delete o[k]);
  return o;
}
