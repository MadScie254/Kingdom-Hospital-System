import { Activity, Ambulance, BarChart3, BedDouble, Building2, CalendarDays, ClipboardList, FlaskConical, HeartPulse, LayoutDashboard, Mail, Pill, Receipt, Settings, ShieldCheck, Siren, Stethoscope, Users, UserCog, Package, Smile, ScanLine, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; children?: { label: string; href: string }[] };
export type NavGroup = { heading: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { heading: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    heading: "Clinical",
    items: [
      { label: "Emergency", href: "/emergency", icon: Siren },
      { label: "Departments", href: "/departments", icon: Building2 },
      { label: "Doctors", href: "/doctors", icon: Stethoscope, children: [
        { label: "Directory", href: "/doctors" }, { label: "Schedules", href: "/doctors/schedules" }, { label: "Holidays", href: "/doctors/holidays" },
        { label: "Doctor visits", href: "/doctors/visits" }, { label: "Treatment history", href: "/doctors/history" },
      ] },
      { label: "Patients", href: "/patients", icon: Users, children: [
        { label: "Patient list", href: "/patients" }, { label: "Register patient", href: "/patients/new" }, { label: "Payments", href: "/patients/payments" },
        { label: "Cases", href: "/patients/cases" }, { label: "Symptoms", href: "/patients/symptoms" }, { label: "Diagnosis", href: "/patients/diagnosis" },
        { label: "Treatment", href: "/patients/treatment" }, { label: "Advice", href: "/patients/advice" }, { label: "Documents", href: "/patients/documents" },
      ] },
      { label: "Appointments", href: "/appointments", icon: CalendarDays, children: [{ label: "All appointments", href: "/appointments" }, { label: "Calendar", href: "/appointments/calendar" }] },
      { label: "Prescriptions", href: "/prescriptions", icon: ClipboardList },
      { label: "Dental", href: "/dental", icon: Smile, children: [{ label: "Examinations", href: "/dental" }, { label: "New examination", href: "/dental/new" }, { label: "Treatment plans", href: "/dental/plans" }] },
      { label: "Clinical tools", href: "/clinical/summary", icon: HeartPulse, children: [{ label: "Patient summary", href: "/clinical/summary" }, { label: "Imaging review", href: "/clinical/imaging" }, { label: "Treatment planning", href: "/clinical/planning" }] },
    ],
  },
  {
    heading: "Diagnostics and wards",
    items: [
      { label: "Laboratory", href: "/lab", icon: FlaskConical, children: [{ label: "Worklist", href: "/lab" }, { label: "Results and analysis", href: "/lab/results" }, { label: "Test catalogue", href: "/lab/catalogue" }] },
      { label: "Admissions", href: "/admissions", icon: BedDouble, children: [{ label: "Bed board", href: "/admissions" }, { label: "Admission register", href: "/admissions/register" }, { label: "Bed inventory", href: "/admissions/beds" }] },
      { label: "Ambulance", href: "/ambulance", icon: Ambulance },
    ],
  },
  {
    heading: "Pharmacy and stores",
    items: [
      { label: "Pharmacy", href: "/pharmacy", icon: Pill, children: [{ label: "Dashboard", href: "/pharmacy" }, { label: "Point of sale", href: "/pharmacy/sale" }, { label: "Medicines", href: "/medicines" }] },
      { label: "Inventory", href: "/inventory", icon: Package },
    ],
  },
  {
    heading: "Finance",
    items: [
      { label: "Billing", href: "/billing", icon: Receipt, children: [{ label: "Invoices", href: "/billing" }, { label: "New invoice", href: "/billing/new" }, { label: "Service items", href: "/billing/items" }, { label: "Expenses", href: "/billing/expenses" }] },
      { label: "SHA claims", href: "/sha", icon: ShieldCheck },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Human resources", href: "/hr", icon: UserCog, children: [{ label: "Staff", href: "/hr" }, { label: "Nurses", href: "/hr/nurses" }, { label: "Attendance", href: "/hr/attendance" }] },
      { label: "Communications", href: "/communications", icon: Mail },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_HREFS = NAV.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children || []).map((c) => c.href)]));
export function bestMatch(pathname: string): string {
  let best = "";
  for (const h of ALL_HREFS) if ((pathname === h || pathname.startsWith(h + "/")) && h.length > best.length) best = h;
  return best;
}
export { Activity };
