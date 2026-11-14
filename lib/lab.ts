import type { Row } from "./seed";

export const isQuant = (t: Row) => t.refLow !== null && t.refLow !== undefined && t.refLow !== "";
export const rangeText = (t: Row) => (isQuant(t) ? `${t.refLow} to ${t.refHigh}${t.unit ? " " + t.unit : ""}` : t.refText || "See report");
export function flagFor(t: Row, value: string | number | null): string {
  if (value === null || value === "" || value === undefined) return "";
  if (isQuant(t)) {
    const v = Number(value);
    if (Number.isNaN(v)) return "";
    const span = t.refHigh - t.refLow || 1;
    if (v < t.refLow) return v < t.refLow - span * 0.4 ? "Critical" : "Low";
    if (v > t.refHigh) return v > t.refHigh + span * 0.6 ? "Critical" : "High";
    return "Normal";
  }
  return String(value).toLowerCase() === String(t.refText).toLowerCase() ? "Normal" : "Abnormal";
}
export const STAGES = ["Ordered", "Collected", "Processing", "Review", "Released"] as const;
export const STAGE_LABEL: Record<string, string> = { Ordered: "Ordered", Collected: "Sample collected", Processing: "Processing", Review: "Awaiting review", Released: "Released" };
