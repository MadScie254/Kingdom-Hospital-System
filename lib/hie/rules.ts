import type { Intervention, PreauthKind, ServiceType } from "./types";

/** Facility level from text such as "Level 4", or a bare number. */
export function parseKephLevel(v: unknown): number | null {
  const m = String(v ?? "").match(/([2-6])/);
  return m ? Number(m[1]) : null;
}

/** The most SHA will pay for an intervention at this facility: a single overall amount where one is set, otherwise the amount for the facility level. */
export function tariffFor(i: Intervention, level?: number | null): number | null {
  const overall = Number(i.overallTariff);
  if (Number.isFinite(overall) && overall > 0) return overall;
  if (level && level >= 2 && level <= 6) {
    const v = Number((i as Record<string, unknown>)[`level${level}Tariff`]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const keph = Number(i.kephLevelTarriff);
  return Number.isFinite(keph) && keph > 0 ? keph : null;
}

export type Mechanism = "CAPITATION" | "PER_DIEM" | "FEE_FOR_SERVICE" | "CASE_BASED" | "OTHER";
export function mechanismOf(i: Intervention): Mechanism {
  const m = String(i.paymentMechanism || "").toUpperCase().replace(/[\s-]+/g, "_");
  if (m.includes("CAPITATION")) return "CAPITATION";
  if (m.includes("PER_DIEM")) return "PER_DIEM";
  if (m.includes("FEE_FOR_SERVICE")) return "FEE_FOR_SERVICE";
  if (m.includes("CASE")) return "CASE_BASED";
  return "OTHER";
}

export const isEmergencyCode = (code?: string) => /^SHA-01-/i.test(code || "");

/** Which preauth form an intervention needs, read from its flags. Null when it needs no preauth. */
export function preauthKindOf(i: Intervention): PreauthKind | null {
  if (!i.needsPreauth) return null;
  if (i.requiresSurgicalPreauth) return "surgical";
  if (i.requiresOncologyPreauth) return "oncology";
  if (i.requiresRenalPreauth) return "renal";
  if (i.requiresRadiologyPreauth) return "imaging";
  if (i.requiresOpticalPreauth) return "optical";
  return "normal";
}

export type Scenario =
  | "capitation" | "ip_per_diem" | "ip_ffs" | "ip_ffs_normal_preauth" | "ip_ffs_elective_preauth"
  | "op_ffs" | "op_ffs_normal_preauth" | "op_ffs_elective_preauth" | "emergency";

export type Flow = { scenario: Scenario; serviceType: ServiceType | null; preauth: PreauthKind | null; elective: boolean; dispatch: "submit" | "discharge"; perDiem: boolean };

/** Reads the intervention flags the way the DHA integration scenarios describe, to decide what the visit needs. */
export function flowOf(i: Intervention): Flow {
  const access = String(i.accessPoint || "").toUpperCase();
  const mech = mechanismOf(i);
  const preauth = preauthKindOf(i);
  const elective = !!(i.needsPreauth && i.needsManualPreauthApproval);
  if (isEmergencyCode(i.code)) return { scenario: "emergency", serviceType: "EMERGENCY", preauth: null, elective: false, dispatch: "submit", perDiem: false };
  if (mech === "CAPITATION") return { scenario: "capitation", serviceType: "CAPITATION", preauth: null, elective: false, dispatch: "submit", perDiem: false };
  const inpatient = access === "IP" || access === "INPATIENT";
  const outpatient = access === "OP" || access === "OUTPATIENT";
  const serviceType: ServiceType | null = inpatient ? "INPATIENT" : outpatient ? "OUTPATIENT" : null;
  if (inpatient && mech === "PER_DIEM") return { scenario: "ip_per_diem", serviceType, preauth: null, elective: false, dispatch: "discharge", perDiem: true };
  if (inpatient) return { scenario: preauth ? (elective ? "ip_ffs_elective_preauth" : "ip_ffs_normal_preauth") : "ip_ffs", serviceType, preauth, elective, dispatch: "discharge", perDiem: false };
  return { scenario: preauth ? (elective ? "op_ffs_elective_preauth" : "op_ffs_normal_preauth") : "op_ffs", serviceType, preauth, elective, dispatch: "submit", perDiem: false };
}

/** Emergency claims must reach SHA within 24 hours of the visit starting. */
export const EMERGENCY_WINDOW_MS = 24 * 3600_000;
export const emergencyDeadline = (startISO: string | number | Date) => new Date(new Date(startISO).getTime() + EMERGENCY_WINDOW_MS).toISOString();
export const hoursLeft = (deadlineISO: string, now = Date.now()) => (new Date(deadlineISO).getTime() - now) / 3600_000;

// ---- statuses. They come from SHA, never from a button on this system.

export type Tone = "mute" | "info" | "ok" | "warn" | "bad";
export type StatusView = { label: string; tone: Tone };

const PAYER: Record<string, StatusView> = {
  PAID: { label: "Paid", tone: "ok" },
  APPROVED: { label: "Approved", tone: "ok" },
  SENT_FOR_PAYMENT_PROCESSING: { label: "Sent for payment", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "bad" },
  APPEALED: { label: "Appealed", tone: "warn" },
  TIME_BARRED: { label: "Time barred", tone: "bad" },
  CLARIFICATION_AFTER_AUTOMATIC_CHECKS: { label: "Needs action", tone: "warn" },
  SENT_BACK: { label: "Needs action", tone: "warn" },
  MISSING_DOCUMENTS: { label: "Needs action", tone: "warn" },
  DRAFT_PROVIDER: { label: "Under review", tone: "info" }, SUBMITTED_PROVIDER: { label: "Under review", tone: "info" },
  AUTOMATIC_CHECKS_DONE: { label: "Under review", tone: "info" }, SUBMITTED_PAYER: { label: "Under review", tone: "info" },
  IN_REVIEW: { label: "Under review", tone: "info" }, CLINICAL_REVIEW: { label: "Under review", tone: "info" }, MEDICAL_REVIEW: { label: "Under review", tone: "info" },
  UNDER_COMMITTEE_REVIEW: { label: "Under review", tone: "info" }, SENT_TO_SURVEILLANCE: { label: "Under review", tone: "info" }, MANUAL_REVIEW: { label: "Under review", tone: "info" },
  DRAFT_PROVIDER_RESUBMITTED: { label: "Under review", tone: "info" }, DRAFT_PROVIDER_RESUBMITTED_MISSING_DOCUMENTS: { label: "Under review", tone: "info" }, RESUBMITTED_MISSING_DOCUMENTS: { label: "Under review", tone: "info" },
};
const PROVIDER: Record<string, StatusView> = {
  DRAFT: { label: "Draft", tone: "mute" },
  PENDING: { label: "Draft", tone: "mute" },
  SUBMISSION_READY: { label: "Ready to submit", tone: "info" },
  ON_HOLD: { label: "On hold", tone: "warn" },
  TIME_BARRED: { label: "Time barred", tone: "bad" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  DISPATCHED: { label: "Submitted", tone: "info" },
  SUBMITTED_PAYER: { label: "Under review", tone: "info" },
  AUTOMATIC_CHECKS_DONE: { label: "Under review", tone: "info" },
  FAILED_TO_SUBMIT: { label: "Failed to submit", tone: "bad" },
  DRAFT_RESUBMIT: { label: "Needs action", tone: "warn" },
  DRAFT_RESUBMIT_DOCUMENTS: { label: "Needs action", tone: "warn" },
  CLOSED: { label: "Closed", tone: "mute" },
};
const AUTH: Record<string, StatusView> = {
  AUTHORIZED_PENDING_VISIT: { label: "Awaiting visit", tone: "info" },
  AUTHORIZED_MULTISESSION: { label: "Visit open", tone: "info" },
  EMERGENCY_AUTHORIZED: { label: "Visit open", tone: "info" },
  AUTHORIZED: { label: "Visit open", tone: "info" },
  SUBMITTED_CLAIM: { label: "Submitted", tone: "info" },
  REJECTED: { label: "Authorization rejected", tone: "bad" },
  EXPIRED: { label: "Expired", tone: "bad" },
  CLOSED: { label: "Closed", tone: "mute" },
};

const key = (v?: string) => String(v || "").trim().toUpperCase();

/** The one status shown for a claim: the payer's answer when SHA has given one, then the hospital side workflow, then the visit authorisation. */
export function claimStatus(s: { workflowState?: string; authStatus?: string; payerState?: string }): StatusView {
  const payer = PAYER[key(s.payerState)];
  if (payer) return payer;
  const wf = key(s.workflowState);
  if (wf && wf !== "DRAFT" && wf !== "PENDING" && PROVIDER[wf]) return PROVIDER[wf];
  const auth = AUTH[key(s.authStatus)];
  if (auth && key(s.authStatus) !== "CLOSED") return auth;
  return PROVIDER[wf] || auth || { label: "Draft", tone: "mute" };
}

/** Labels that count as money still with SHA. Used by the dashboard. */
export const SHA_OPEN_LABELS = ["Submitted", "Under review", "Needs action", "Approved", "Sent for payment"];

const PREAUTH: Record<string, StatusView> = {
  DRAFT: { label: "Draft", tone: "mute" },
  PENDING_SUBMISSION: { label: "Ready to send", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "mute" },
  DOCTOR_REQUEST_SENT: { label: "Waiting for doctor", tone: "warn" },
  PENDING_DOCTOR_APPROVAL: { label: "Waiting for doctor", tone: "warn" },
  DOCTOR_REQUEST_FAILED: { label: "Doctor request failed", tone: "bad" },
  ACTIVE: { label: "With SHA", tone: "info" },
  CLARIFICATION_AFTER_AUTOMATIC_CHECKS: { label: "Needs action", tone: "warn" },
  FINALISED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "bad" },
  REJECTED_AFTER_APPROVAL: { label: "Revoked", tone: "bad" },
};
export const preauthStatus = (s?: string): StatusView => PREAUTH[key(s)] || { label: s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "Not started", tone: "mute" };
export const preauthApproved = (s?: string) => key(s) === "FINALISED";

/** States that belong to the hospital side workflow. Anything else in a claim callback is the payer's state. */
const PROVIDER_ONLY = new Set(["DRAFT", "PENDING", "SUBMISSION_READY", "ON_HOLD", "SUBMITTED", "DISPATCHED", "FAILED_TO_SUBMIT", "DRAFT_RESUBMIT", "DRAFT_RESUBMIT_DOCUMENTS", "CLOSED"]);
export const isProviderOnlyState = (s?: string) => PROVIDER_ONLY.has(key(s));
