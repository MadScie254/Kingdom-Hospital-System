export type Row = { id: number; [k: string]: any };
export const COLLECTIONS = [
  "settings", "departments", "doctors", "nurses", "staff", "patients", "visits", "appointments", "emergencies",
  "prescriptions", "medicines", "inventory", "labCatalog", "labOrders", "beds", "admissions", "services", "invoices",
  "payments", "expenses", "pharmacySales", "ambulances", "bookings", "dental", "shaClaims", "holidays", "schedules",
  "symptoms", "diagnoses", "treatments", "advice", "documents", "templates", "imaging", "plans", "attendance",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
export type DB = Record<CollectionName, Row[]>;

/** Postgres table for each collection. */
export const TABLE: Record<CollectionName, string> = Object.fromEntries(
  COLLECTIONS.map((c) => [c, c.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())]),
) as Record<CollectionName, string>;

export const emptyDB = (): DB => Object.fromEntries(COLLECTIONS.map((c) => [c, [] as Row[]])) as DB;
