import type { CollectionName } from "./collections";

export const ROLES = ["admin", "doctor", "nurse", "lab", "pharmacy", "reception", "accounts", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator", doctor: "Doctor or clinical officer", nurse: "Nurse", lab: "Laboratory", pharmacy: "Pharmacy",
  reception: "Front desk", accounts: "Accounts", staff: "General staff",
};
export const ROLE_HINT: Record<Role, string> = {
  admin: "Everything, including staff accounts and settings",
  doctor: "Patients, consultations, prescriptions, lab requests, wards, billing",
  nurse: "Patients, vitals, appointments, wards, lab sample collection",
  lab: "Laboratory worklist and results",
  pharmacy: "Medicines, point of sale, prescriptions",
  reception: "Registration, appointments, billing, admissions desk",
  accounts: "Invoices, payments, expenses, SHA claims, reports",
  staff: "Sign in only. Nothing patient related",
};

/** What people choose when they request access. The administrator confirms the role. */
export const POSITIONS: { label: string; role: Role }[] = [
  { label: "Doctor", role: "doctor" }, { label: "Clinical officer", role: "doctor" }, { label: "Nurse", role: "nurse" },
  { label: "Laboratory technologist", role: "lab" }, { label: "Pharmacist or pharmaceutical technologist", role: "pharmacy" },
  { label: "Radiographer", role: "doctor" }, { label: "Receptionist or records officer", role: "reception" },
  { label: "Accounts or billing", role: "accounts" }, { label: "Ambulance driver", role: "staff" },
  { label: "Support staff", role: "staff" }, { label: "Administrator", role: "admin" }, { label: "Other", role: "staff" },
];

const REF: CollectionName[] = ["settings", "departments", "doctors", "nurses", "services", "labCatalog", "templates", "symptoms", "diagnoses", "treatments", "advice", "schedules", "holidays", "medicines"];
const CLINICAL: CollectionName[] = [...REF, "patients", "visits", "appointments", "emergencies", "prescriptions", "labOrders", "beds", "admissions", "dental", "imaging", "plans", "documents", "ambulances", "bookings", "inventory"];

export const READ: Record<Role, "*" | CollectionName[]> = {
  admin: "*", doctor: CLINICAL, nurse: CLINICAL,
  lab: [...REF, "patients", "labOrders"],
  pharmacy: [...REF, "patients", "prescriptions", "pharmacySales", "inventory"],
  reception: [...REF, "patients", "appointments", "emergencies", "invoices", "payments", "shaClaims", "admissions", "beds", "bookings", "ambulances", "documents"],
  accounts: [...REF, "patients", "invoices", "payments", "expenses", "shaClaims", "pharmacySales", "admissions"],
  staff: REF,
};
export const WRITE: Record<Role, "*" | CollectionName[]> = {
  admin: "*",
  doctor: ["patients", "visits", "appointments", "emergencies", "prescriptions", "labOrders", "imaging", "plans", "dental", "admissions", "beds", "documents", "holidays", "symptoms", "diagnoses", "treatments", "advice"],
  nurse: ["patients", "visits", "appointments", "emergencies", "labOrders", "admissions", "beds", "documents", "dental"],
  lab: ["labOrders", "labCatalog"],
  pharmacy: ["medicines", "pharmacySales", "inventory"],
  reception: ["patients", "appointments", "emergencies", "documents", "bookings"],
  accounts: ["expenses"],
  staff: [],
};
export const ACTION_ROLES: Record<string, Role[]> = {
  "invoice.create": ["admin", "reception", "accounts"],
  "invoice.update": ["admin", "reception", "accounts"],
  "payment.record": ["admin", "reception", "accounts"],
  "admission.admit": ["admin", "doctor", "nurse"],
  "admission.transfer": ["admin", "doctor", "nurse"],
  "admission.discharge": ["admin", "doctor", "nurse"],
  "pharmacy.sale": ["admin", "pharmacy"],
};

/** Who may use the SHA integration. Lookups are open to anyone who registers or treats patients, claims work to the claims desk. */
export const HIE_ROLES: Record<"lookup" | "claim" | "admin", Role[]> = {
  lookup: ["admin", "reception", "accounts", "doctor", "nurse"],
  claim: ["admin", "reception", "accounts"],
  admin: ["admin"],
};

export const canRead = (role: Role | undefined, c: CollectionName) => !!role && (READ[role] === "*" || (READ[role] as CollectionName[]).includes(c));
export const canWrite = (role: Role | undefined, c: CollectionName) => !!role && (WRITE[role] === "*" || (WRITE[role] as CollectionName[]).includes(c));

/** Screens by role. The longest matching path wins. Paths not listed are open to everyone signed in. */
const SCREENS: [string, Role[]][] = [
  ["/patients/payments", ["admin", "reception", "accounts"]],
  ["/patients/new", ["admin", "doctor", "nurse", "reception"]],
  ["/patients", ["admin", "doctor", "nurse", "reception"]],
  ["/billing/expenses", ["admin", "accounts"]],
  ["/billing/items", ["admin"]],
  ["/billing", ["admin", "reception", "accounts"]],
  ["/sha", ["admin", "accounts", "reception"]],
  ["/reports", ["admin", "accounts"]],
  ["/emergency", ["admin", "doctor", "nurse", "reception"]],
  ["/doctors", ["admin", "doctor", "nurse", "reception"]],
  ["/appointments", ["admin", "doctor", "nurse", "reception"]],
  ["/prescriptions", ["admin", "doctor", "nurse", "pharmacy"]],
  ["/dental", ["admin", "doctor", "nurse"]],
  ["/clinical", ["admin", "doctor", "nurse"]],
  ["/lab/catalogue", ["admin", "doctor", "nurse", "lab"]],
  ["/lab", ["admin", "doctor", "nurse", "lab"]],
  ["/admissions", ["admin", "doctor", "nurse", "reception"]],
  ["/ambulance", ["admin", "doctor", "nurse", "reception"]],
  ["/pharmacy", ["admin", "pharmacy"]],
  ["/medicines", ["admin", "pharmacy", "doctor"]],
  ["/inventory", ["admin", "pharmacy", "nurse"]],
  ["/hr", ["admin"]],
  ["/staff", ["admin"]],
  ["/communications", ["admin"]],
];
export const canOpen = (role: Role | undefined, pathname: string) => {
  if (!role) return false;
  const rule = SCREENS.filter(([p]) => pathname === p || pathname.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return !rule || rule[1].includes(role);
};

/** For the roles table on the Staff accounts page. */
export const ACCESS_ROWS: { label: string; path: string }[] = [
  { label: "Register patients and see the patient list", path: "/patients/new" },
  { label: "Appointments and emergency", path: "/appointments" },
  { label: "Consultations, dental, clinical tools", path: "/dental" },
  { label: "Laboratory worklist and results", path: "/lab" },
  { label: "Wards and admissions", path: "/admissions" },
  { label: "Prescriptions", path: "/prescriptions" },
  { label: "Pharmacy and point of sale", path: "/pharmacy" },
  { label: "Invoices and recording payments", path: "/billing" },
  { label: "Payments register", path: "/patients/payments" },
  { label: "Expenses", path: "/billing/expenses" },
  { label: "SHA claims", path: "/sha" },
  { label: "Financial reports", path: "/reports" },
  { label: "Staff accounts and settings", path: "/staff" },
];
