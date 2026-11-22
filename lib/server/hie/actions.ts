import { HIE_ROLES, type Role } from "../../access";
import { HieError, friendlyMessage } from "../../hie/errors";
import { isIcd11, normalizeIcd11, toConcept } from "../../hie/icd";
import { claimStatus, emergencyDeadline, flowOf, mechanismOf, preauthApproved, tariffFor } from "../../hie/rules";
import {
  CLOSE_REASONS, ID_TYPES, INPATIENT_REASONS, MODES_OF_ARRIVAL, BROUGHT_BY, OUTPATIENT_REASONS, PREAUTH_KINDS, REGULATORS, SERVICE_TYPES, SURGICAL_ANAESTHESIA,
  CARCINOMA_STAGES, RENAL_FREQUENCIES, RENAL_INDICATIONS, TREATMENT_SETTINGS,
  type AttachmentInput, type Eligibility, type Intervention, type PreauthInput, type Regulator,
} from "../../hie/types";
import type { Session } from "../auth";
import { rowOf, type Sql } from "../db";
import { HttpError } from "../http";
import { approvedFor, createClaim, eatDate, foldClaim, foldPreauths, interventionFromCoverage, isoNow, loadClaim, needToken, preauthList, saveClaim, saveTokens, type ClaimRow } from "./claims";
import { buildCtx, hieConfigured, hieEnv, loadFacility, type HieCtx } from "./context";

type Json = Record<string, any>;
export type Out = { changes?: Record<string, Json[]>; result?: Json };
export type HieAction = { roles: Role[]; run: (c: HieCtx, b: Json) => Promise<Out> };
export type PlainAction = { roles: Role[]; run: (s: Sql, u: Session, b: Json) => Promise<Out> };

// ---- input checks

const txt = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const need = (v: unknown, what: string, max = 200) => { const x = txt(v, max); if (!x) throw new HttpError(400, `Enter ${what}.`); return x; };
const amount = (v: unknown, what: string) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) throw new HttpError(400, `Enter a valid ${what}.`); return Math.round(n * 100) / 100; };
const quantity = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0 || n > 10_000) throw new HttpError(400, "Enter a valid quantity."); return Math.round(n * 100) / 100; };
const pick = <T extends string>(v: unknown, list: readonly T[], what: string): T => { const x = txt(v, 80) as T; if (!list.includes(x)) throw new HttpError(400, `Choose ${what}.`); return x; };
const codeList = (v: unknown, what: string, max = 10): string[] => {
  const a = [...new Set((Array.isArray(v) ? v : []).map((x) => txt(x, 40)).filter(Boolean))];
  if (!a.length || a.length > max || a.some((c) => !/^[A-Za-z0-9._-]+$/.test(c))) throw new HttpError(400, `Choose ${what}.`);
  return a;
};
const otpOf = (v: unknown) => { const x = txt(v, 12).replace(/\s/g, ""); if (!/^\d{4,8}$/.test(x)) throw new HttpError(400, "Enter the one time password the patient received."); return x; };
const invoiceOf = (v: unknown) => { const x = need(v, "the invoice number", 40); if (!/^[A-Za-z0-9/_.-]+$/.test(x)) throw new HttpError(400, "The invoice number can use letters, digits, slash, dot, dash and underscore only."); return x; };
const crOf = (v: unknown) => need(v, "the patient's client registry number", 40);

/** Staff type a local date and time. SHA wants a timestamp with the Nairobi offset. */
function eatIso(v: unknown, what: string): string {
  const x = txt(v, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return `${x}T00:00:00+03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(x)) return `${x}${x.length === 16 ? ":00" : ""}+03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(x)) return x;
  throw new HttpError(400, `Enter a valid ${what}.`);
}

function diagnosesOf(v: unknown, min = 1): string[] {
  const a = [...new Set((Array.isArray(v) ? v : []).map((x) => normalizeIcd11(String(x))).filter(Boolean))];
  if (a.length < min || a.length > 12) throw new HttpError(400, min ? "Add at least one ICD-11 diagnosis." : "Too many diagnoses.");
  const bad = a.find((c) => !isIcd11(c));
  if (bad) throw new HttpError(400, `${bad} is not shaped like an ICD-11 code. Codes look like ca07.0 or 1a00.`);
  return a;
}

function bytesOf(b64: string): Uint8Array {
  // Newer engines decode base64 natively, which matters on the Workers free plan (10 ms of CPU per request).
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (typeof native === "function") return native.call(Uint8Array, b64);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function filesOf(v: unknown): AttachmentInput[] {
  const a = Array.isArray(v) ? v : [];
  if (a.length > 6) throw new HttpError(400, "Attach at most 6 files at a time.");
  return a.map((f: Json) => {
    const filename = need(f?.filename, "a file name", 120).replace(/[\\/]/g, "_");
    const content = String(f?.content || "").replace(/^data:[^,]*,/, "");
    if (!content || content.length > 3_000_000) throw new HttpError(400, `${filename} is empty or larger than 2 MB.`);
    const type = txt(f?.type, 60).toUpperCase();
    if (!/^[A-Z_]{2,60}$/.test(type)) throw new HttpError(400, `Choose what ${filename} is.`);
    let bytes: Uint8Array;
    try { bytes = bytesOf(content); } catch { throw new HttpError(400, `${filename} could not be read.`); }
    return { title: txt(f?.title, 120) || filename, type, filename, bytes, contentType: txt(f?.contentType, 80) || undefined };
  });
}

async function localPatient(s: Sql, id: unknown) {
  const [r] = await s.query(`select id, data from patients where id = $1`, [Number(id) || 0]);
  if (!r) throw new HttpError(404, "Choose a registered patient. Register the patient first if they are new.");
  return r as { id: number; data: Json };
}

/** A doctor's registration number and regulator, as SHA asks for them. */
async function doctorOf(s: Sql, id: unknown) {
  const [r] = await s.query(`select id, data from doctors where id = $1`, [Number(id) || 0]);
  if (!r) throw new HttpError(400, "Choose the attending doctor.");
  const number = txt(r.data.licence, 40);
  if (!number) throw new HttpError(422, `${r.data.name} has no registration number yet. Add it on the Doctors screen.`);
  const body = pick(txt(r.data.regulator, 10) || "KMPDC", REGULATORS, "the regulator");
  return { id: r.id as number, name: String(r.data.name || ""), number, body: body as Regulator, practitioner: { identificationNumber: number, regulationBody: body as Regulator } };
}

const trail = (c: HieCtx, action: string, id: string | number) =>
  c.s.query(`insert into audit_log (actor, action, collection, record_id) values ($1, $2, 'shaClaims', $3)`, [c.u.email, `hie.${action}`, String(id)]).catch(() => {});

// ---- what the screens read

export function coverageRow(i: Intervention, level: number | null) {
  const f = flowOf(i);
  return {
    code: i.code || "", name: i.name || i.code || "", fund: i.fund || "", mechanism: mechanismOf(i), accessPoint: i.accessPoint || "", tariff: tariffFor(i, level),
    needsPreauth: !!i.needsPreauth, elective: f.elective, preauthKind: f.preauth, scenario: f.scenario, serviceType: f.serviceType, dispatch: f.dispatch, perDiem: f.perDiem,
    docTypes: i.applicableDocumentTypes || [], requiredPreauthDocs: i.requiredPreauthDocumentTypes || [], doctorsRequired: i.numberOfDoctorsRequired || 0, subBenefit: i.parentBenefitCode || i.benefitCode || "",
  };
}

export function eligibilityView(e: Eligibility) {
  const schemes = (e.schemes || []).map((s) => ({
    name: s.schemeName || "", memberType: s.memberType || "", status: s.coverage?.status || "", start: s.coverage?.startDate || "", end: s.coverage?.endDate || "",
    message: s.coverage?.message || "", reason: s.coverage?.reason || "", fix: s.coverage?.possibleSolution || "", policy: s.policy?.number || "", principal: s.principalContributor?.name || "",
  }));
  const active = schemes.some((s) => /^(active|eligible)/i.test(s.status));
  const blocked = schemes.length > 0 && !active && schemes.every((s) => /(in-?active|not|suspend|expire|lapse|ineligible)/i.test(s.status));
  return {
    crId: e.memberCrNumber || "", name: e.fullName || "", gender: e.gender || "", age: e.age ?? null, dob: e.dateOfBirth || "", alive: e.isAlive !== false,
    statusCode: e.statusCode || "", statusDesc: e.statusDesc || "", eligible: e.isAlive === false ? false : active ? true : blocked ? false : null,
    whitelistedForOtp: e.whitelistedForOTP !== false, biometricsEnforced: !!e.facilityBiometricsEnforced, otpAvailable: !e.facilityBiometricsEnforced || e.whitelistedForOTP === true, schemes,
  };
}

/** Applies a patch to the claim, recomputes the shown status from SHA's states and returns the row for the screen. */
async function finish(c: HieCtx, claim: ClaimRow, patch: Json, audit?: string): Promise<Out> {
  const merged = { ...claim.data, ...patch };
  const st = claimStatus({ workflowState: merged.workflowState, authStatus: merged.authStatus, payerState: merged.payerState });
  const row = await saveClaim(c.s, claim.id, { ...patch, status: st.label, statusTone: st.tone, lastSyncedAt: isoNow() });
  if (audit) await trail(c, audit, claim.id);
  return { changes: { shaClaims: [row] }, result: { claimId: claim.id } };
}

/** Pulls the visit and its preauthorizations from SHA, and the payer's view once the claim has gone. */
async function refresh(c: HieCtx, claim: ClaimRow, extra: Json = {}): Promise<Out> {
  const t = claim.tokens;
  let patch: Json = { ...extra };
  if (t.consent) patch = foldClaim(claim.data, await c.api.preview(t.consent), c.facility.kephLevel, extra);
  const needs = (claim.data.interventions || []).some((i: Json) => i.needsPreauth) || (claim.data.preauths || []).length > 0;
  const tokens = [t.consent, t.auth].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  if (needs) {
    let list: ReturnType<typeof preauthList> = [];
    for (const tok of tokens) {
      try { list = preauthList(await c.api.getPreauth(tok)); } catch (e) { if (!(e instanceof HieError && e.kind === "not_found")) throw e; }
      if (list.length) break;
    }
    if (list.length) patch.preauths = foldPreauths({ ...claim.data, ...patch }, list);
  }
  const wf = String(patch.workflowState ?? claim.data.workflowState ?? "");
  const invoice = patch.invoiceNo ?? claim.data.invoiceNo;
  if (invoice && /SUBMITTED|DISPATCHED/i.test(wf)) {
    try {
      const pr = await c.api.previewPayer({ providerClaimNo: String(invoice) });
      const first = (pr.results || [])[0] as Json | undefined;
      if (first) {
        patch.payerState = first.workflowState ?? first.workflow_state ?? patch.payerState ?? claim.data.payerState;
        const note = first.notes ?? first.reason ?? first.rejection_reason;
        if (typeof note === "string" && note) patch.remarks = note.slice(0, 300);
      }
    } catch (e) { if (!(e instanceof HieError)) throw e; /* the claim may not have reached the payer yet */ }
  }
  return finish(c, claim, patch);
}

async function claimWithToken(c: HieCtx, id: unknown) {
  const claim = await loadClaim(c.s, id);
  return { claim, token: needToken(claim) };
}

function interventionOf(claim: ClaimRow, code: unknown) {
  const x = txt(code, 40);
  const iv = (claim.data.interventions || []).find((i: Json) => i.code === x);
  if (!iv) throw new HttpError(400, "That intervention is not on this claim.");
  return iv as Json;
}

/** Looks up coverage details for the chosen codes so tariffs and preauth needs are known. A failed lookup does not stop the visit. */
async function coverageFor(c: HieCtx, crId: string, codes: string[]) {
  const out: Json[] = [];
  for (const code of codes.slice(0, 6)) {
    try {
      const page = await c.api.interventions(crId, { code });
      const hit = (page.results || []).find((i) => i.code === code) || (page.results || [])[0];
      out.push(hit ? interventionFromCoverage(hit, c.facility.kephLevel) : { code, name: code, active: true });
    } catch (e) { if (!(e instanceof HieError)) throw e; out.push({ code, name: code, active: true }); }
  }
  return out;
}

const baseClaim = (c: HieCtx, o: { patientId: number | null; crId: string; serviceType: string; interventions: Json[]; extra?: Json }): Json => {
  const first = o.interventions[0] || {};
  const f = flowOf({ code: first.code, paymentMechanism: first.mechanism, accessPoint: first.accessPoint, needsPreauth: first.needsPreauth, needsManualPreauthApproval: first.elective, requiresSurgicalPreauth: first.preauthKind === "surgical", requiresOncologyPreauth: first.preauthKind === "oncology", requiresRenalPreauth: first.preauthKind === "renal", requiresRadiologyPreauth: first.preauthKind === "imaging", requiresOpticalPreauth: first.preauthKind === "optical" });
  return {
    source: "hie", patientId: o.patientId, crId: o.crId, serviceType: o.serviceType, interventions: o.interventions, interventionCodes: o.interventions.map((i) => i.code),
    intervention: first.code ? `${first.code} ${first.name || ""}`.trim() : "", fund: first.fund || (o.serviceType === "EMERGENCY" ? "ECCIF" : ""), invoiceNo: "", amount: 0, submitted: eatDate(),
    remarks: "", lines: [], diagnoses: [], doctors: [], attachments: [], preauths: [], flow: { scenario: f.scenario, dispatch: o.serviceType === "INPATIENT" ? "discharge" : f.dispatch, perDiem: f.perDiem },
    createdBy: c.u.email, ...(o.extra || {}),
  };
};

// ---- the actions

const L = HIE_ROLES.lookup, C = HIE_ROLES.claim, A = HIE_ROLES.admin;

export const HIE_ACTIONS: Record<string, HieAction> = {
  // ---- registries and eligibility
  "patient.search": {
    roles: L,
    run: async (c, b) => {
      const identificationType = pick(b.identificationType, ID_TYPES.map((t) => t.value), "an identification type");
      const identificationNumber = need(b.identificationNumber, "the identification number", 40);
      const p = await c.api.searchPatient({ identificationNumber, identificationType });
      const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
      const view = { crId: String(p.id || ""), name, gender: p.gender || "", dob: p.date_of_birth || "", phone: p.phone || "", idNumber: p.identification_number || "", deceased: !!p.deceased_datetime };
      const changes: Record<string, Json[]> = {};
      if (b.patientId && view.crId) {
        const pt = await localPatient(c.s, b.patientId);
        const [row] = await c.s.query(`update patients set data = data || $2::jsonb, updated_at = now() where id = $1 returning id, data`, [pt.id, JSON.stringify({ crId: view.crId, crCheckedAt: isoNow() })]);
        changes.patients = [rowOf(row as any)];
      }
      const [local] = view.crId ? await c.s.query(`select id from patients where data->>'crId' = $1 limit 1`, [view.crId]) : [];
      return { changes, result: { patient: view, localPatientId: local?.id ?? null } };
    },
  },

  "eligibility.check": {
    roles: L,
    run: async (c, b) => {
      const identificationType = pick(b.identificationType, ID_TYPES.map((t) => t.value), "an identification type");
      const identificationNumber = need(b.identificationNumber, "the identification number", 40);
      const view = eligibilityView(await c.api.eligibility({ identificationNumber, identificationType }));
      const changes: Record<string, Json[]> = {};
      if (b.patientId && view.crId) {
        const pt = await localPatient(c.s, b.patientId);
        const [row] = await c.s.query(`update patients set data = data || $2::jsonb, updated_at = now() where id = $1 returning id, data`, [pt.id, JSON.stringify({ crId: view.crId, shaStatus: view.statusDesc || (view.eligible ? "Active" : ""), shaCheckedAt: isoNow() })]);
        changes.patients = [rowOf(row as any)];
      }
      const [local] = view.crId ? await c.s.query(`select id from patients where data->>'crId' = $1 limit 1`, [view.crId]) : [];
      return { changes, result: { eligibility: view, localPatientId: local?.id ?? null } };
    },
  },

  "eligibility.subBenefits": {
    roles: L,
    run: async (c, b) => {
      const page = await c.api.subBenefits(crOf(b.crId), txt(b.parentBenefitCode, 40) || undefined);
      return { result: { subBenefits: (page.results || []).map((s) => ({ code: s.code || "", name: s.name || s.code || "", fund: s.fund || "", accessPoint: s.accessPoint || "", parent: s.parentBenefit || "", parentCode: s.parentBenefitCode || "", active: s.active !== false })) } };
    },
  },

  "eligibility.interventions": {
    roles: L,
    run: async (c, b) => {
      const page = await c.api.interventions(crOf(b.crId), { subBenefitCode: txt(b.subBenefitCode, 40) || undefined, accessPoint: txt(b.accessPoint, 10) || undefined, search: txt(b.search, 80) || undefined, page: Number(b.page) || undefined, pageSize: 20 });
      return { result: { interventions: (page.results || []).map((i) => coverageRow(i, c.facility.kephLevel)), count: page.count ?? 0, page: page.currentPage ?? 1, totalPages: page.totalPages ?? 1 } };
    },
  },

  // ---- consent
  "consent.contacts": {
    roles: L,
    run: async (c, b) => {
      const page = await c.api.contacts(crOf(b.crId));
      return { result: { contacts: (page.results || []).filter((x) => x.active !== false).map((x) => ({ id: x.id, value: x.contactValue || "", type: x.contactType || "", confirmed: x.isConfirmed !== false })) } };
    },
  },

  "consent.sendOtp": {
    roles: C,
    run: async (c, b) => {
      await c.api.sendOtp({ crId: crOf(b.crId), interventionCodes: codeList(b.interventionCodes, "the services the patient is consenting to"), contactId: Number(b.contactId) || undefined });
      return { result: { sent: true } };
    },
  },

  /** Elective services: the patient consents before the day of the visit so the preauthorization can be raised. */
  "consent.authorize": {
    roles: C,
    run: async (c, b) => {
      const pt = await localPatient(c.s, b.patientId);
      const crId = crOf(b.crId || pt.data.crId);
      const serviceType = pick(b.serviceType, ["OUTPATIENT", "INPATIENT"] as const, "outpatient or inpatient");
      const codes = codeList(b.interventionCodes, "the elective service");
      const auth = await c.api.authorize({ crId, serviceType, otp: otpOf(b.otp), interventionCodes: codes });
      if (!auth.token) throw new HttpError(502, "SHA recorded the consent but did not return its reference. Ask SHA support to check the authorization.");
      const interventions = await coverageFor(c, crId, codes);
      const data = { ...baseClaim(c, { patientId: pt.id, crId, serviceType, interventions }), authStatus: auth.status || "AUTHORIZED_PENDING_VISIT", status: "Awaiting visit", statusTone: "info", lastSyncedAt: isoNow() };
      const row = await createClaim(c.s, data, { patientId: pt.id, crId, auth: auth.token, authGuid: auth.guid || null });
      await trail(c, "authorize", row.id);
      return { changes: { shaClaims: [row] }, result: { claimId: row.id } };
    },
  },

  // ---- visits
  "visit.start": {
    roles: C,
    run: async (c, b) => {
      const pt = await localPatient(c.s, b.patientId);
      const crId = crOf(b.crId || pt.data.crId);
      const serviceType = pick(b.serviceType, SERVICE_TYPES.filter((t) => t !== "EMERGENCY"), "the type of service");
      const codes = codeList(b.interventionCodes, "at least one service");
      const doctor = b.doctorId ? await doctorOf(c.s, b.doctorId) : null;
      const existing = b.claimId ? await loadClaim(c.s, b.claimId) : null; // an elective claim that was authorized earlier
      if (existing && existing.tokens.consent) throw new HttpError(409, "This visit has already started.");
      const hie = await c.api.createVisit({ interventionCodes: codes, crId, serviceType, otp: otpOf(b.otp), practitioner: doctor?.practitioner });
      const consent = hie.authorization_code;
      if (!consent) throw new HttpError(502, `SHA started the visit (${hie.visit_number || hie.claim_id || "no number"}) but did not return its reference. Ask SHA support to check it.`);
      const coverage = existing ? (existing.data.interventions as Json[]) : await coverageFor(c, crId, codes);
      const tokens = { consent, authGuid: hie.authorization_guid || null, claimGuid: hie.edi_claim_guid || null };
      let row: Json;
      if (existing) {
        await saveTokens(c.s, existing.id, tokens);
        const patch = foldClaim(existing.data, hie, c.facility.kephLevel, { serviceType, doctors: doctor ? [{ name: doctor.name, number: doctor.number, body: doctor.body }] : existing.data.doctors, visitStart: hie.visit_start || isoNow() });
        row = (await finish(c, { ...existing, tokens: { ...existing.tokens, consent } }, patch, "visit.start")).changes!.shaClaims[0];
      } else {
        const data = { ...baseClaim(c, { patientId: pt.id, crId, serviceType, interventions: coverage }), doctors: doctor ? [{ name: doctor.name, number: doctor.number, body: doctor.body }] : [], visitStart: hie.visit_start || isoNow() };
        const patch = foldClaim(data, hie, c.facility.kephLevel);
        const merged = { ...data, ...patch };
        row = await createClaim(c.s, merged, { patientId: pt.id, crId, consent, authGuid: tokens.authGuid, claimGuid: tokens.claimGuid });
        await trail(c, "visit.start", row.id);
      }
      return { changes: { shaClaims: [row] }, result: { claimId: row.id } };
    },
  },

  "claim.refresh": { roles: C, run: async (c, b) => refresh(c, await loadClaim(c.s, b.claimId)) },

  "claim.intervention": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const op = pick(b.op, ["add", "retire", "restore", "switch"] as const, "what to do with the service");
      const code = need(b.code, "the service code", 40);
      if (op === "add") await c.api.addIntervention(token, code);
      else if (op === "retire") await c.api.retireIntervention(token, code);
      else if (op === "restore") await c.api.restoreIntervention(token, code);
      else await c.api.switchIntervention({ consentToken: token, from: code, to: need(b.to, "the service to switch to", 40), retainBillItems: b.retainBillItems !== false });
      let extra: Json = {};
      if (op === "add" || op === "switch") {
        const crId = claim.tokens.crId || claim.data.crId;
        const target = op === "add" ? code : txt(b.to, 40);
        const known = await coverageFor(c, crId, [target]);
        extra = { interventions: [...(claim.data.interventions || []).filter((i: Json) => i.code !== target), ...known] };
      }
      return refresh(c, { ...claim, data: { ...claim.data, ...extra } }, extra);
    },
  },

  // ---- billing
  "claim.addLine": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const iv = interventionOf(claim, b.interventionCode);
      const unitPrice = amount(b.unitPrice, "unit price");
      if (iv.tariff && unitPrice > Number(iv.tariff) + 0.001) throw new HttpError(422, `The unit price is above the SHA tariff of KES ${iv.tariff} for ${iv.code}. SHA rejects the whole bill if it is higher.`);
      let current = claim;
      if (iv.needsPreauth && !approvedFor(claim.data, iv.code)) {
        current = { ...claim, data: { ...claim.data, ...(await refresh(c, claim)).changes!.shaClaims[0] } };
        if (!approvedFor(current.data, iv.code)) throw new HttpError(409, "SHA has not approved the preauthorization for this service yet. Billing opens once it is approved.");
      }
      const doctor = b.doctorId ? await doctorOf(c.s, b.doctorId) : null;
      await c.api.addLine({
        consentToken: token, interventionCode: iv.code, unitPrice, quantity: quantity(b.quantity), serviceName: txt(b.serviceName, 120) || undefined, serviceIdentifier: txt(b.serviceIdentifier, 60) || undefined,
        diagnoses: diagnosesOf(b.diagnoses, 0), attachments: filesOf(b.attachments), practitioner: doctor?.practitioner,
      });
      return refresh(c, current);
    },
  },

  "claim.removeLine": {
    roles: C,
    run: async (c, b) => { const { claim, token } = await claimWithToken(c, b.claimId); await c.api.removeLine(token, need(b.lineId, "the line", 80)); return refresh(c, claim); },
  },

  "claim.addDiagnosis": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const iv = interventionOf(claim, b.interventionCode);
      const doctor = b.doctorId ? await doctorOf(c.s, b.doctorId) : null;
      await c.api.addDiagnosis({ consentToken: token, icd: diagnosesOf([b.icd])[0], interventionCode: iv.code, practitioner: doctor?.practitioner });
      return refresh(c, claim);
    },
  },

  "claim.removeDiagnosis": {
    roles: C,
    run: async (c, b) => { const { claim, token } = await claimWithToken(c, b.claimId); await c.api.removeDiagnosis(token, interventionOf(claim, b.interventionCode).code, diagnosesOf([b.icd])[0]); return refresh(c, claim); },
  },

  "claim.addAttachment": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const [file] = filesOf([b.file]);
      if (!file) throw new HttpError(400, "Choose a file.");
      await c.api.addAttachment({ consentToken: token, interventionCode: interventionOf(claim, b.interventionCode).code, type: file.type, file });
      return refresh(c, claim);
    },
  },

  // ---- preauthorizations
  "preauth.create": {
    roles: C,
    run: async (c, b) => {
      const claim = await loadClaim(c.s, b.claimId);
      const token = claim.tokens.consent || claim.tokens.auth;
      if (!token) throw new HttpError(409, "Get the patient's consent first.");
      const iv = interventionOf(claim, b.interventionCode);
      const kind = pick(b.kind || iv.preauthKind || "normal", PREAUTH_KINDS, "a preauthorization form");
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25).map((i: Json) => ({ name: txt(i.name, 120) || undefined, unitPrice: amount(i.unitPrice, "item price"), quantity: i.quantity ? quantity(i.quantity) : undefined }));
      if (!items.length) throw new HttpError(400, "Add at least one item with its price.");
      const doctorIds = [...new Set((Array.isArray(b.doctorIds) ? b.doctorIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 4) as number[];
      if (!doctorIds.length) throw new HttpError(400, "Choose at least one attending doctor. SHA asks each one to consent.");
      const doctors = [];
      for (const [n, id] of doctorIds.entries()) { const d = await doctorOf(c.s, id); doctors.push({ identificationNumber: d.number, regulationBody: d.body, isPrimary: n === 0 }); }
      const email = txt(b.providerEmail, 120) || c.facility.email;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter the email address SHA should tell about this preauthorization.");
      const input: PreauthInput = {
        kind, consentToken: token, interventionCode: iv.code, serviceStart: eatIso(b.serviceStart, "service start"), serviceEnd: eatIso(b.serviceEnd, "service end"), providerEmail: email,
        items, diagnoses: diagnosesOf(b.diagnoses), doctors, attachments: filesOf(b.attachments), isCoInsured: b.isCoInsured === true ? true : undefined,
      };
      if (kind === "surgical") {
        input.surgical = {
          surgeryDate: eatIso(b.surgeryDate, "surgery date"), chiefComplaint: need(b.chiefComplaint, "the chief complaint", 500), vitalSigns: need(b.vitalSigns, "the vital signs", 300),
          historyOfPresentIllness: need(b.historyOfPresentIllness, "the history of the present illness", 1500), physicalExamination: need(b.physicalExamination, "the physical examination", 1500),
          investigationReportDetails: need(b.investigationReportDetails, "the investigations", 1500), typeOfAnaesthesia: pick(b.typeOfAnaesthesia, SURGICAL_ANAESTHESIA, "the type of anaesthesia"),
          relatedToEmployment: b.relatedToEmployment === true, relatedToAccident: b.relatedToAccident === true, coInsuranceDetails: txt(b.coInsuranceDetails, 300) || undefined,
        };
      } else if (kind === "oncology") {
        input.oncology = {
          carcinomaStaging: pick(b.carcinomaStaging, CARCINOMA_STAGES, "the carcinoma stage"), comorbidity: need(b.comorbidity, "the comorbidity (write None if there is none)", 300), metastases: need(b.metastases, "the metastases", 120),
          progressReport: txt(b.progressReport, 1500) || undefined, treatmentSetting: need(b.treatmentSetting, "the treatment setting", 80), startDate: eatIso(b.startDate, "start date"),
          numberOfSessions: Math.round(quantity(b.numberOfSessions)), costPerSession: amount(b.costPerSession, "cost per session"),
        };
      } else if (kind === "renal") {
        input.renal = { startDate: eatIso(b.startDate, "date of the first session"), sessionsRequired: Math.round(quantity(b.sessionsRequired)), frequency: pick(b.frequency, RENAL_FREQUENCIES, "how often"), clinicalIndications: pick(b.clinicalIndications, RENAL_INDICATIONS, "the clinical indication") };
      } else if (kind === "imaging") {
        input.imaging = { clinicalIndications: need(b.clinicalIndications, "the clinical indications", 1000) };
      } else if (kind === "optical") {
        input.optical = { clinicalIndications: need(b.clinicalIndications, "the clinical indications", 1000), necessityOfService: need(b.necessityOfService, "why the service is needed", 1000), newOrReplacement: b.newOrReplacement === "Replacement" ? "Replacement" : b.newOrReplacement === "New" ? "New" : undefined, lensPrescription: b.lensPrescription === "Contact" ? "Contact" : b.lensPrescription === "Framed" ? "Framed" : undefined, eyeExaminationAmount: txt(b.eyeExaminationAmount, 12) || undefined, frameAmount: txt(b.frameAmount, 12) || undefined, lensAmount: txt(b.lensAmount, 12) || undefined };
      }
      const created = await c.api.createPreauth(input);
      const list = preauthList(created);
      const preauths = foldPreauths(claim.data, list.length ? list.map((p) => ({ ...p, interventionCode: p.interventionCode || iv.code, preauthType: p.preauthType || kind })) : [{ interventionCode: iv.code, status: "ACTIVE", preauthType: kind }]);
      return finish(c, claim, { preauths }, "preauth.create");
    },
  },

  "preauth.cancel": {
    roles: C,
    run: async (c, b) => {
      const claim = await loadClaim(c.s, b.claimId);
      const token = claim.tokens.consent || claim.tokens.auth;
      if (!token) throw new HttpError(409, "There is no preauthorization to cancel.");
      const iv = interventionOf(claim, b.interventionCode);
      const res = await c.api.cancelPreauth(token, iv.code);
      return finish(c, claim, { preauths: foldPreauths(claim.data, [{ ...res, interventionCode: res.interventionCode || iv.code, status: res.status || "CANCELLED" }]) }, "preauth.cancel");
    },
  },

  "preauth.resendDoctor": {
    roles: C,
    run: async (c, b) => {
      const claim = await loadClaim(c.s, b.claimId);
      const token = claim.tokens.consent || claim.tokens.auth;
      if (!token) throw new HttpError(409, "There is no preauthorization yet.");
      const d = await doctorOf(c.s, b.doctorId);
      await c.api.resendDoctorConsent({ consentToken: token, interventionCode: interventionOf(claim, b.interventionCode).code, practitionerRegistrationNumber: d.number });
      return { result: { sent: true, to: d.name } };
    },
  },

  // ---- dispatch
  "claim.dischargeOtp": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      if (claim.data.serviceType === "EMERGENCY") throw new HttpError(400, "Emergency claims do not use a discharge OTP.");
      await c.api.sendDischargeOtp({ consentToken: token, crId: claim.tokens.crId || claim.data.crId });
      return { result: { sent: true } };
    },
  },

  "claim.submit": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const st = claim.data.serviceType;
      if (st === "INPATIENT") throw new HttpError(400, "Inpatient claims are sent by discharging the patient.");
      const reason = pick(b.reason, OUTPATIENT_REASONS, "why the visit ended");
      const emergency = st === "EMERGENCY";
      const hie = await c.api.submitClaim({
        consentToken: token, invoiceNumber: invoiceOf(b.invoiceNo), reason, otp: emergency ? undefined : otpOf(b.otp), notes: txt(b.notes, 300) || undefined, partial: b.partial === true,
        reasonForUnknownPatient: emergency && !claim.data.emergency?.identified ? need(b.reasonForUnknownPatient, "why the patient could not be identified", 300) : undefined,
      });
      return refresh(c, claim, { ...foldClaim(claim.data, hie, c.facility.kephLevel), invoiceNo: txt(b.invoiceNo, 40), submittedAt: isoNow(), dischargeReason: reason });
    },
  },

  "claim.discharge": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      if (claim.data.serviceType !== "INPATIENT") throw new HttpError(400, "Only inpatient claims are discharged. Submit this one instead.");
      const reason = pick(b.reason, INPATIENT_REASONS, "why the patient left");
      const hie = await c.api.dischargeInpatient({ consentToken: token, invoiceNumber: invoiceOf(b.invoiceNo), reason, dischargeDate: eatIso(b.dischargeDate, "discharge date and time"), otp: otpOf(b.otp) });
      return refresh(c, claim, { ...foldClaim(claim.data, hie, c.facility.kephLevel), invoiceNo: txt(b.invoiceNo, 40), submittedAt: isoNow(), dischargeReason: reason });
    },
  },

  "claim.close": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const hie = await c.api.closeClaim({ consentToken: token, reasonType: pick(b.reasonType, CLOSE_REASONS, "why the claim is being closed"), reasonText: need(b.reasonText, "a short explanation", 300) });
      return finish(c, claim, foldClaim(claim.data, hie, c.facility.kephLevel, { workflowState: hie.workflow_state || "CLOSED" }), "claim.close");
    },
  },

  // ---- emergency (ECCIF)
  "emergency.create": {
    roles: C,
    run: async (c, b) => {
      const doctor = await doctorOf(c.s, b.doctorId);
      const code = need(b.interventionCode, "the emergency service code", 40);
      if (!/^SHA-01-/i.test(code)) throw new HttpError(400, "Emergency services have codes that start with SHA-01.");
      const identified = !!(b.crId || b.patientId);
      let pt: { id: number; data: Json } | null = null;
      let crId = "";
      if (identified) { pt = b.patientId ? await localPatient(c.s, b.patientId) : null; crId = crOf(b.crId || pt?.data.crId); }
      const reference = need(b.referenceNumber, "the hospital's reference number for this emergency", 40);
      const hie = await c.api.createEmergencyClaim({
        interventionCode: code, modeOfArrival: pick(b.modeOfArrival, MODES_OF_ARRIVAL, "how the patient arrived"), broughtBy: pick(b.broughtBy, BROUGHT_BY, "who brought the patient"), referenceNumber: reference,
        notes: txt(b.notes, 500) || undefined, doctor: doctor.practitioner, patient: identified ? { crId, otp: otpOf(b.otp) } : undefined,
      });
      const consent = hie.authorization_code;
      if (!consent) throw new HttpError(502, `SHA opened the emergency claim (${hie.visit_number || hie.claim_id || "no number"}) but did not return its reference. Ask SHA support to check it.`);
      const start = hie.visit_start || isoNow();
      const interventions = [await coverageForEmergency(c, code)];
      const data = baseClaim(c, { patientId: pt?.id ?? null, crId, serviceType: "EMERGENCY", interventions, extra: { doctors: [{ name: doctor.name, number: doctor.number, body: doctor.body }], visitStart: start, emergency: { reference, mode: b.modeOfArrival, broughtBy: b.broughtBy, identified, deadline: hie.emergency_visit_expiry || emergencyDeadline(start) } } });
      const merged = { ...data, ...foldClaim(data, hie, c.facility.kephLevel), emergency: { ...data.emergency, deadline: hie.emergency_visit_expiry || data.emergency.deadline } };
      const row = await createClaim(c.s, merged, { patientId: pt?.id ?? null, crId: crId || null, consent, authGuid: hie.authorization_guid || null, claimGuid: hie.edi_claim_guid || null });
      await trail(c, "emergency.create", row.id);
      return { changes: { shaClaims: [row] }, result: { claimId: row.id } };
    },
  },

  "emergency.protocols": {
    roles: C,
    run: async (c, b) => {
      const page = await c.api.emergencyProtocols(need(b.interventionCode, "the emergency service code", 40));
      return { result: { protocols: (page.results || []).map((p: Json) => ({ code: String(p.protocolCode ?? p.protocol_code ?? p.code ?? ""), name: String(p.protocolName ?? p.name ?? p.description ?? p.protocolCode ?? ""), tariff: Number(p.applicableTariff ?? p.tariff ?? 0) || null })).filter((p) => p.code) } };
    },
  },

  "emergency.addProtocol": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      if (claim.data.serviceType !== "EMERGENCY") throw new HttpError(400, "This is not an emergency claim.");
      const iv = interventionOf(claim, b.interventionCode);
      const unitPrice = amount(b.unitPrice, "price");
      if (b.tariff && unitPrice > Number(b.tariff) + 0.001) throw new HttpError(422, `The price is above the approved tariff of KES ${b.tariff} for this protocol.`);
      await c.api.addEmergencyProtocol({ consentToken: token, protocolCode: need(b.protocolCode, "the protocol", 60), interventionCode: iv.code, unitPrice, quantity: quantity(b.quantity), diagnoses: diagnosesOf(b.diagnoses, 0), attachments: filesOf(b.attachments) });
      return refresh(c, claim);
    },
  },

  "emergency.doctor": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const op = pick(b.op, ["add", "remove", "resend"] as const, "what to do");
      if (op === "remove") await c.api.removeClaimDoctor(token);
      else {
        const d = await doctorOf(c.s, b.doctorId);
        if (op === "add") await c.api.addClaimDoctor(token, d.practitioner);
        else await c.api.resendDoctorConsent({ consentToken: token, interventionCode: interventionOf(claim, b.interventionCode).code, practitionerRegistrationNumber: d.number, emergency: true });
      }
      return refresh(c, claim);
    },
  },

  "emergency.identify": {
    roles: C,
    run: async (c, b) => {
      const { claim, token } = await claimWithToken(c, b.claimId);
      const pt = await localPatient(c.s, b.patientId);
      const crId = crOf(b.crId || pt.data.crId);
      const doctor = await doctorOf(c.s, b.doctorId);
      const em = claim.data.emergency || {};
      const iv = (claim.data.interventions || [])[0] || {};
      await c.api.identifyEmergencyPatient({
        consentToken: token, interventionCode: iv.code, modeOfArrival: em.mode || "OTHER", broughtBy: em.broughtBy || "UNKNOWN", referenceNumber: em.reference || claim.data.claimNo, doctor: doctor.practitioner, patient: { crId, otp: otpOf(b.otp) },
      });
      await c.s.query(`update hie_consents set cr_id = $2, patient_id = $3, updated_at = now() where claim_id = $1`, [claim.id, crId, pt.id]);
      return refresh(c, claim, { patientId: pt.id, crId, emergency: { ...em, identified: true } });
    },
  },

  // ---- terminology
  "terminology.search": {
    roles: L,
    run: async (c, b) => {
      const kind = pick(b.kind, ["icd11", "intervention"] as const, "what to search");
      const e = hieEnv();
      const source = kind === "icd11" ? e.icd11Source : e.interventionSource;
      if (!source) return { result: { results: [], note: "ICD-11 search is not switched on for this connection. Type the code instead." } };
      const page = await c.api.searchConcepts({ owner: e.terminologyOwner, source, search: need(b.search, "a word to search for", 80), limit: 20 });
      return { result: { results: (page.results || []).map((r) => toConcept(r as Json)).filter(Boolean) } };
    },
  },

  "practitioner.verify": {
    roles: A,
    run: async (c, b) => {
      const d = await doctorOf(c.s, b.doctorId);
      const r = await c.api.searchProfessional({ identificationNumber: d.number, regulator: d.body });
      const m = (r.message && typeof r.message === "object" ? r.message : r) as Json;
      const name = String(m.name ?? m.full_name ?? [m.first_name, m.last_name].filter(Boolean).join(" ") ?? "").trim();
      const status = String(m.license_status ?? m.licence_status ?? m.status ?? m.registration_status ?? "").trim();
      const [row] = await c.s.query(`update doctors set data = data || $2::jsonb, updated_at = now() where id = $1 returning id, data`, [d.id, JSON.stringify({ hwrVerifiedAt: isoNow(), hwrName: name, hwrStatus: status })]);
      return { changes: { doctors: [rowOf(row as any)] }, result: { name, status } };
    },
  },

  "facility.lookup": {
    roles: A,
    run: async (c, b) => {
      // The codes may be typed on the Settings screen and not saved yet, so they are taken from the request first.
      const mfl = txt(b.mflCode, 20) || c.facility.mflCode;
      const fr = txt(b.frCode, 40) || c.facility.frCode;
      const byFr = b.by === "fr-code" ? !!fr : !mfl && !!fr;
      const identifier = byFr ? fr : mfl;
      if (!identifier) throw new HttpError(400, "Enter the facility's MFL code or FR code first.");
      const r = await c.api.searchFacility({ identifier, identifierType: byFr ? "fr-code" : "mfl" });
      return { result: { facility: facilityView(r) } };
    },
  },
};

async function coverageForEmergency(c: HieCtx, code: string): Promise<Json> {
  try {
    const page = await c.api.searchConcepts({ owner: hieEnv().terminologyOwner, source: hieEnv().interventionSource, search: code, limit: 5 });
    const hit = (page.results || []).map((r) => toConcept(r as Json)).find((x) => x && x.code.toLowerCase() === code.toLowerCase());
    return { code, name: hit?.name || code, fund: "ECCIF", mechanism: "FEE_FOR_SERVICE", accessPoint: "", tariff: null, needsPreauth: false, elective: false, preauthKind: null, preauthExists: false, docTypes: [], active: true, perDiemDays: null };
  } catch (e) {
    if (!(e instanceof HieError)) throw e;
    return { code, name: code, fund: "ECCIF", mechanism: "FEE_FOR_SERVICE", accessPoint: "", tariff: null, needsPreauth: false, elective: false, preauthKind: null, preauthExists: false, docTypes: [], active: true, perDiemDays: null };
  }
}

function facilityView(r: Json) {
  return {
    name: String(r.officialName ?? r.name ?? ""), frCode: String(r.frCode ?? ""), fidCode: String(r.fidCode ?? ""), kephLevel: String(r.kephLevel ?? ""), type: String(r.facilityType ?? ""), ownership: String(r.facilityOwnership ?? ""),
    licenseNumber: String(r.licenseNumber ?? ""), licenseStatus: String(r.facilityLicenseStatus ?? ""), licenseEnd: String(r.facilityLicenseEndDate ?? ""), operational: String(r.SHAOperationStatus?.operationalStatus ?? ""), county: String(r.address?.county ?? ""),
  };
}

// ---- actions that work before a connection exists

export const PLAIN_ACTIONS: Record<string, PlainAction> = {
  status: {
    roles: L,
    run: async (s) => {
      const e = hieEnv();
      const f = await loadFacility(s);
      let host = "";
      try { host = e.baseUrl ? new URL(e.baseUrl).host : ""; } catch { host = ""; }
      return { result: { configured: hieConfigured(), host, facility: { frCode: f.frCode, mflCode: f.mflCode, kephLevel: f.kephLevel, headers: e.sendFacilityHeaders && !!f.frCode }, icd11Search: !!e.icd11Source, callbacks: !!e.callbackSecret } };
    },
  },

  /** Admin only. Walks through the connection step by step and says exactly where it stops. */
  test: {
    roles: A,
    run: async (s, u) => {
      const steps: { name: string; ok: boolean; detail: string; ms: number }[] = [];
      const step = async (name: string, fn: () => Promise<string>) => {
        const t = Date.now();
        try { const detail = await fn(); steps.push({ name, ok: true, detail, ms: Date.now() - t }); return true; }
        catch (e) { steps.push({ name, ok: false, detail: e instanceof HieError ? friendlyMessage(e) : "Something went wrong.", ms: Date.now() - t }); return false; }
      };
      const e = hieEnv();
      const present = [e.baseUrl && "address", e.clientId && "client id", e.clientSecret && "client secret"].filter(Boolean);
      const ok1 = await step("Credentials are saved as Worker secrets", async () => { if (!hieConfigured()) throw new HieError({ kind: "not_configured", message: "" }); return `Found: ${present.join(", ")}`; });
      let facility: Json | null = null;
      if (ok1) {
        const c = await buildCtx(s, u, "test");
        const ok2 = await step("Access token", async () => { const t = await c.client.token(true); return t.token ? "Token issued. It is refreshed automatically before it expires." : "No token"; });
        if (ok2) {
          await step("Facility registry", async () => {
            if (!c.facility.frCode && !c.facility.mflCode) throw new HieError({ kind: "validation", message: "Enter the facility's MFL or FR code in Settings first." });
            const r = await c.api.searchFacility({ identifier: c.facility.frCode || c.facility.mflCode, identifierType: c.facility.frCode ? "fr-code" : "mfl" });
            facility = facilityView(r);
            return `${facility.name || "Facility found"}${facility.kephLevel ? `, level ${facility.kephLevel}` : ""}`;
          });
        }
      }
      let host = "";
      try { host = new URL(e.baseUrl).host; } catch { host = ""; }
      return { result: { ok: steps.length > 0 && steps.every((x) => x.ok), steps, facility, host } };
    },
  },

  "log.recent": {
    roles: A,
    run: async (s) => {
      const rows = await s.query(`select id, at, actor, action, method, path, status, ms, ok, attempt, error from hie_log order by id desc limit 40`);
      const [sum] = await s.query(`select count(*)::int as total, count(*) filter (where ok)::int as good from hie_log where at > now() - interval '7 days'`);
      return { result: { log: rows, week: sum } };
    },
  },
};
