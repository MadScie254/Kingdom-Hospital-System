import type { Role } from "./access";

export type Notice = { key: "requests" | "critical" | "stock"; count: number; text: string; href: string };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * What the bell lists for a person: only things their role can act on, each with a link to a page that role may open.
 * The numbers come from the records already loaded, so this is a pure function of the role and three counts.
 */
export function noticesFor(role: Role | undefined, counts: { pending: number; critical: number; lowStock: number }): Notice[] {
  if (!role) return [];
  const out: Notice[] = [];
  if (role === "admin" && counts.pending > 0) {
    out.push({ key: "requests", count: counts.pending, href: "/staff", text: `${counts.pending} ${plural(counts.pending, "staff request is", "staff requests are")} waiting for approval` });
  }
  if (["admin", "doctor", "nurse", "lab"].includes(role) && counts.critical > 0) {
    out.push({ key: "critical", count: counts.critical, href: "/lab", text: `${counts.critical} critical lab ${plural(counts.critical, "result is", "results are")} not released yet` });
  }
  if ((role === "admin" || role === "pharmacy") && counts.lowStock > 0) {
    out.push({ key: "stock", count: counts.lowStock, href: "/medicines", text: `${counts.lowStock} ${plural(counts.lowStock, "medicine is", "medicines are")} at or below reorder level` });
  }
  return out;
}
