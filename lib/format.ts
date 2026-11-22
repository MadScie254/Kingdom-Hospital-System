const eat = () => new Date(Date.now() + 3 * 3600e3).toISOString();
/** Today in Nairobi time (UTC+3, no daylight saving). */
export const ANCHOR = eat().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function group(n: number, dp = 2): string {
  const neg = n < 0;
  const [i, d] = Math.abs(n).toFixed(dp).split(".");
  const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : "");
  return neg ? "(" + s + ")" : s;
}
export const kes = (n: number, dp = 2) => "KES " + group(n || 0, dp);
export const kesShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return "KES " + (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "KES " + (n / 1e3).toFixed(1) + "K";
  return "KES " + n.toFixed(0);
};

const parts = (iso: string) => {
  const [d, t = "00:00"] = iso.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return { y, m, d: dd, hh: hh || 0, mm: mm || 0 };
};
export function fmtDate(iso?: string | null): string {
  if (!iso) return "Not set";
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}
export function fmtShort(iso?: string | null): string {
  if (!iso) return "Not set";
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]}`;
}
export function fmtTime(iso?: string | null): string {
  if (!iso || !iso.includes("T")) return "";
  const p = parts(iso);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}
export const fmtDateTime = (iso?: string | null) => (iso ? `${fmtDate(iso)} at ${fmtTime(iso) || "00:00"}` : "Not set");
export function dayName(iso: string): string {
  const p = parts(iso);
  return DAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
}
export function addDays(iso: string, n: number): string {
  const p = parts(iso);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dt.toISOString().slice(0, 10);
}
export function age(dob: string, on = ANCHOR): number {
  const a = parts(dob), b = parts(on);
  let y = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) y--;
  return y;
}
export const initials = (name: string) =>
  name.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
export function download(name: string, text: string, mime = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function nowISO(): string {
  return eat().slice(0, 16);
}

export function daysBetween(a: string, b: string): number {
  const pa = parts(a.slice(0, 10)), pb = parts(b.slice(0, 10));
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
