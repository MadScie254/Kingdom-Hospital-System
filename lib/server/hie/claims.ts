import { claimStatus, mechanismOf, preauthApproved, preauthKindOf, tariffFor, flowOf, type Flow } from "../../hie/rules";
import type { HieClaim, HiePreauth, Intervention } from "../../hie/types";
import { SHA_CLAIM_NO_SQL } from "../../claim-number";
import { rowOf, type Sql } from "../db";
import { HttpError } from "../http";

type Json = Record<string, any>;
export type Tokens = { consent: string | null; auth: string | null; authGuid: string | null; claimGuid: string | null; crId: string | null };
export type ClaimRow = { id: number; data: Json; tokens: Tokens };

export const eatNow = () => new Date(Date.now() + 3 * 3600e3);
export const eatDate = () => eatNow().toISOString().slice(0, 10);
export const isoNow = () => new Date().toISOString();

export async function loadClaim(s: Sql, id: unknown): Promise<ClaimRow> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Choose a claim.");
  const [r] = await s.query(
    `select c.id, c.data, k.consent_token, k.auth_token, k.auth_guid, k.claim_guid, k.cr_id from sha_claims c left join hie_consents k on k.claim_id = c.id where c.id = $1`,
    [n],
  );
  if (!r) throw new HttpError(404, "That claim no longer exists.");
  if (r.data?.source !== "hie") throw new HttpError(400, "This is an older record kept on this system only. It was never started with SHA.");
  return { id: r.id, data: r.data, tokens: { consent: r.consent_token, auth: r.auth_token, authGuid: r.auth_guid, claimGuid: r.claim_guid, crId: r.cr_id } };
}

/** The token that identifies the visit. Everything after the visit starts uses it. */
export function needToken(c: ClaimRow): string {
  if (!c.tokens.consent) throw new HttpError(409, "The visit has not started yet. Start it with the patient's consent first.");
  return c.tokens.consent;
}

export async function saveClaim(s: Sql, id: number, patch: Json): Promise<Json> {
  const [r] = await s.query(`update sha_claims set data = data || $2::jsonb, updated_at = now() where id = $1 returning id, data`, [id, JSON.stringify(patch)]);
  if (!r) throw new HttpError(404, "That claim no longer exists.");
  return rowOf(r as any);
}

/** Creates the local claim and its server side tokens in one statement, so a claim never exists without them. */
export async function createClaim(s: Sql, data: Json, t: { patientId?: number | null; crId?: string | null; consent?: string | null; auth?: string | null; authGuid?: string | null; claimGuid?: string | null }): Promise<Json> {
  const q = `with c as (insert into sha_claims (data) values ($1::jsonb || jsonb_build_object('claimNo', ${SHA_CLAIM_NO_SQL})) returning id, data),
    k as (insert into hie_consents (claim_id, patient_id, cr_id, consent_token, auth_token, auth_guid, claim_guid) select id, $2::int, $3::text, $4::text, $5::text, $6::text, $7::text from c)
    select id, data from c`;
  const params = [JSON.stringify(data), t.patientId ?? null, t.crId ?? null, t.consent ?? null, t.auth ?? null, t.authGuid ?? null, t.claimGuid ?? null];
  // The visit already exists at SHA by now, so one retry is worth it before giving up.
  try { return rowOf((await s.query(q, params))[0] as any); } catch { return rowOf((await s.query(q, params))[0] as any); }
}

export async function saveTokens(s: Sql, claimId: number, t: { consent?: string | null; auth?: string | null; authGuid?: string | null; claimGuid?: string | null }) {
  await s.query(
    `update hie_consents set consent_token = coalesce($2, consent_token), auth_token = coalesce($3, auth_token), auth_guid = coalesce($4, auth_guid), claim_guid = coalesce($5, claim_guid), updated_at = now() where claim_id = $1`,
    [claimId, t.consent ?? null, t.auth ?? null, t.authGuid ?? null, t.claimGuid ?? null],
  );
}

// ---- turning SHA's answers into the local record

export function mapIntervention(raw: Json, level: number | null, prev?: Json): Json {
  const code = String(raw.intervention_code ?? raw.code ?? "");
  const asIntervention: Intervention = {
    code, paymentMechanism: raw.intervention_payment_mechanism ?? raw.paymentMechanism, accessPoint: raw.accessPoint ?? prev?.accessPoint,
    needsPreauth: raw.needs_preauth ?? raw.needsPreauth, needsManualPreauthApproval: raw.needsManualPreauthApproval ?? prev?.elective,
    requiresSurgicalPreauth: raw.requires_surgical_preauth ?? raw.requiresSurgicalPreauth, requiresOncologyPreauth: raw.requires_oncology_preauth ?? raw.requiresOncologyPreauth,
    requiresRenalPreauth: raw.requires_renal_preauth ?? raw.requiresRenalPreauth, requiresRadiologyPreauth: raw.requires_radiology_preauth ?? raw.requiresRadiologyPreauth,
    requiresOpticalPreauth: raw.requires_optical_preauth ?? raw.requiresOpticalPreauth,
  };
  const overall = Number(raw.intervention_overall_tariff ?? raw.overallTariff);
  const keph = Number(raw.keph_level_tarrif ?? raw.kephLevelTarriff);
  const tariff = (Number.isFinite(overall) && overall > 0 ? overall : Number.isFinite(keph) && keph > 0 ? keph : tariffFor(raw as Intervention, level)) ?? prev?.tariff ?? null;
  const state = String(raw.workflow_state ?? raw.status ?? "").toLowerCase();
  return {
    code,
    name: raw.intervention_name ?? raw.name ?? prev?.name ?? code,
    fund: raw.intervention_fund ?? raw.fund ?? prev?.fund ?? "",
    mechanism: mechanismOf(asIntervention) === "OTHER" && prev?.mechanism ? prev.mechanism : mechanismOf(asIntervention),
    accessPoint: asIntervention.accessPoint ?? "",
    tariff,
    needsPreauth: !!asIntervention.needsPreauth,
    elective: !!asIntervention.needsManualPreauthApproval,
    preauthKind: preauthKindOf(asIntervention) ?? prev?.preauthKind ?? null,
    preauthExists: !!(raw.preauth_exist ?? prev?.preauthExists),
    docTypes: raw.applicable_document_types ?? raw.applicableDocumentTypes ?? prev?.docTypes ?? [],
    active: state ? !/inactive|retired|cancel/.test(state) : prev?.active !== false,
    perDiemDays: raw.accrued_per_diem_days ?? prev?.perDiemDays ?? null,
  };
}

/** Intervention details from the eligibility lookup, saved when a visit starts so tariffs and flags are known without asking again. */
export function interventionFromCoverage(i: Intervention, level: number | null): Json {
  const f = flowOf(i);
  return {
    code: String(i.code || ""), name: i.name || i.code || "", fund: i.fund || "", mechanism: mechanismOf(i), accessPoint: i.accessPoint || "",
    tariff: tariffFor(i, level), needsPreauth: !!i.needsPreauth, elective: f.elective, preauthKind: f.preauth, preauthExists: false,
    docTypes: i.applicableDocumentTypes || [], active: true, perDiemDays: null,
  };
}

const lineOf = (l: Json): Json => ({
  id: String(l.id ?? ""), code: l.intervention_code ?? "", name: l.item_name ?? l.service_name ?? l.name ?? "", quantity: Number(l.quantity ?? 1),
  unitPrice: Number(l.unit_price ?? 0), total: Number(l.line_total_amount ?? Number(l.unit_price ?? 0) * Number(l.quantity ?? 1)), active: l.is_active !== false,
});
const diagnosisOf = (d: Json): Json => ({ code: String(d.diagnosis_code ?? d.icd_code ?? d.code ?? ""), name: String(d.diagnosis_name ?? d.name ?? d.diagnosis ?? ""), intervention: d.intervention_code ?? "" });
const doctorOf = (d: Json): Json => ({ name: String(d.doctor_name ?? d.name ?? ""), number: String(d.identification_number ?? d.doctor_code ?? d.registration_number ?? ""), body: String(d.regulation_body ?? d.regulator ?? "") });

/** Folds a visit, preview, submit, discharge or close answer into a patch for the local claim. Statuses are copied from SHA, never made up here. */
export function foldClaim(prev: Json, h: HieClaim | Json, level: number | null, extra: Json = {}): Json {
  const patch: Json = { ...extra };
  if (h.workflow_state) patch.workflowState = h.workflow_state;
  if (h.claim_auth_status) patch.authStatus = h.claim_auth_status;
  if (h.visit_number) patch.visitNumber = h.visit_number;
  if (h.visit_start) patch.visitStart = h.visit_start;
  if (h.visit_end) patch.visitEnd = h.visit_end;
  if (h.discharge_reason) patch.dischargeReason = h.discharge_reason;
  if (typeof h.total_claim_amount === "number") patch.amount = h.total_claim_amount;
  if (typeof h.total_claim_net_amount === "number") patch.netAmount = h.total_claim_net_amount;
  if (h.claim_id) patch.hieClaimId = h.claim_id;
  if (h.scheme_name) patch.scheme = h.scheme_name;
  if (h.emergency_visit_expiry) patch.emergency = { ...(prev.emergency || {}), ...(extra.emergency || {}), deadline: h.emergency_visit_expiry };
  if (Array.isArray(h.interventions) && h.interventions.length) {
    const before: Json[] = prev.interventions || [];
    patch.interventions = h.interventions.map((r: Json) => mapIntervention(r, level, before.find((p) => p.code === (r.intervention_code ?? r.code))));
    patch.interventionCodes = patch.interventions.filter((i: Json) => i.active).map((i: Json) => i.code);
    patch.intervention = patch.interventions[0]?.code ? `${patch.interventions[0].code} ${patch.interventions[0].name}`.trim() : prev.intervention;
    patch.fund = patch.interventions[0]?.fund || prev.fund;
  }
  if (Array.isArray(h.claim_diagnoses)) patch.diagnoses = h.claim_diagnoses.map(diagnosisOf).filter((d: Json) => d.code);
  if (Array.isArray(h.invoices)) patch.lines = h.invoices.flatMap((i: Json) => (Array.isArray(i.lines) ? i.lines : Array.isArray(i.invoice_lines) ? i.invoice_lines : [])).map(lineOf);
  if (Array.isArray(h.claim_doctors)) patch.doctors = h.claim_doctors.map(doctorOf);
  if (Array.isArray(h.claim_attachments)) patch.attachments = h.claim_attachments.map((a: Json) => ({ id: String(a.id ?? ""), title: String(a.title ?? a.description ?? a.attachment_type ?? "Attachment"), type: String(a.attachment_type ?? a.document_type ?? "") }));
  if (h.invoice_number) patch.invoiceNo = patch.invoiceNo || h.invoice_number;
  const merged = { ...prev, ...patch };
  const st = claimStatus({ workflowState: merged.workflowState, authStatus: merged.authStatus, payerState: merged.payerState });
  patch.status = st.label;
  patch.statusTone = st.tone;
  patch.lastSyncedAt = isoNow();
  return patch;
}

/** The preauth answer may be one object, a list or a page. */
export function preauthList(r: unknown): HiePreauth[] {
  if (Array.isArray(r)) return r as HiePreauth[];
  const o = r as Json | null;
  if (o && Array.isArray(o.results)) return o.results as HiePreauth[];
  return o && (o.status || o.guid || o.interventionCode) ? [o as HiePreauth] : [];
}

export function foldPreauths(prev: Json, list: HiePreauth[]): Json[] {
  const out: Json[] = [...(prev.preauths || [])];
  for (const p of list) {
    const code = String(p.interventionCode || "");
    const notes = (p.preauthNotes || []).map((n) => String(n.note ?? n.message ?? "")).filter(Boolean).slice(-3);
    const entry: Json = {
      interventionCode: code, kind: p.preauthType || out.find((o) => o.interventionCode === code)?.kind || "normal", status: String(p.status || ""), guid: p.guid || "",
      requested: p.totalEstimatedAmountForPreauth ?? null, approved: p.finalApprovedAmount ?? null, needsDoctorApproval: !!p.needsDoctorApproval, doctorStatus: p.doctorReviewStatus || "",
      elective: !!p.isElective, notes, updatedAt: isoNow(),
    };
    const i = out.findIndex((o) => o.interventionCode === code);
    if (i >= 0) out[i] = { ...out[i], ...entry }; else out.push(entry);
  }
  return out;
}

export const approvedFor = (data: Json, code: string) => (data.preauths || []).some((p: Json) => p.interventionCode === code && preauthApproved(p.status));
export const flowOfClaim = (data: Json): Flow | null => data.flow || null;
