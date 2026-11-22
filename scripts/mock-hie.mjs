/* A small stand in for the DHA HIE UAT middleware, for development and tests. It follows the documented request and response shapes
 * (https://hie-docs.dha.go.ke/) closely enough to walk every UAT workflow, and is strict about field names so a wrong request fails here.
 * Run: node scripts/mock-hie.mjs   then set DHA_BASE_URL=http://localhost:4600/api/v1 DHA_CLIENT_ID=mock-client DHA_CLIENT_SECRET=mock-secret
 * Test patient: National ID 33333333 (eligible), 44444444 (not eligible). Visit OTP 123456, discharge OTP 654321. Not a certified simulation of SHA. */
import http from "node:http";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_HIE_PORT || 4600);
const CLIENT = { id: process.env.MOCK_CLIENT_ID || "mock-client", secret: process.env.MOCK_CLIENT_SECRET || "mock-secret" };
const FACILITY = process.env.MOCK_FACILITY || "FID-112007";
const VISIT_OTP = "123456", DISCHARGE_OTP = "654321";

const PATIENTS = {
  "33333333": { id: "CR2594484249725-2", first_name: "Jane", middle_name: "Wanjiru", last_name: "Mwangi", gender: "female", date_of_birth: "1988-04-12", phone: "+254714000898", eligible: true },
  "44444444": { id: "CR1111111111111-1", first_name: "Peter", middle_name: "", last_name: "Otieno", gender: "male", date_of_birth: "1975-09-30", phone: "+254722000111", eligible: false },
};
const byCr = (cr) => Object.values(PATIENTS).find((p) => p.id === cr);
const tariff = (n) => ({ level2Tariff: n, level3Tariff: n, level4Tariff: n, level5Tariff: n, level6Tariff: n, overallTariff: 0 });
const BASE_IV = { active: true, status: "ACTIVE", parentBenefitCode: "SHA-19", needsManualPreauthApproval: false, needsDoctorAuthorization: false, applicableDocumentTypes: ["LAB_RESULTS", "DISCHARGE_SUMMARY"], requiredPreauthDocumentTypes: [], numberOfDoctorsRequired: 0 };
const INTERVENTIONS = [
  { ...BASE_IV, code: "SHA-12-001", name: "Primary health care consultation", accessPoint: "OP", paymentMechanism: "CAPITATION", fund: "PHC", needsPreauth: false, ...tariff(300) },
  { ...BASE_IV, code: "SHA-09-021", name: "Outpatient specialist consultation", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", fund: "SHIF", needsPreauth: false, ...tariff(800) },
  { ...BASE_IV, code: "SHA-11-001", name: "Cataract surgery", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", fund: "SHIF", needsPreauth: true, requiresSurgicalPreauth: true, needsDoctorAuthorization: true, ...tariff(45000) },
  { ...BASE_IV, code: "SHA-19-404", name: "Chemotherapy session", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", fund: "SHIF", needsPreauth: true, requiresOncologyPreauth: true, needsDoctorAuthorization: true, ...tariff(60000) },
  { ...BASE_IV, code: "SHA-20-100", name: "Haemodialysis session", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", fund: "SHIF", needsPreauth: true, needsManualPreauthApproval: true, requiresRenalPreauth: true, needsDoctorAuthorization: true, ...tariff(9500) },
  { ...BASE_IV, code: "SHA-18-005", name: "General ward admission", accessPoint: "IP", paymentMechanism: "PER_DIEM", fund: "SHIF", needsPreauth: false, ...tariff(4500) },
  { ...BASE_IV, code: "SHA-18-006", name: "Intensive care admission", accessPoint: "IP", paymentMechanism: "PER_DIEM", fund: "SHIF", needsPreauth: false, ...tariff(12000) },
  { ...BASE_IV, code: "SHA-30-010", name: "Appendicectomy", accessPoint: "IP", paymentMechanism: "FEE_FOR_SERVICE", fund: "SHIF", needsPreauth: true, ...tariff(70000) },
  { ...BASE_IV, code: "SHA-01-005", name: "Shock states", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", fund: "ECCIF", needsPreauth: false, ...tariff(5000) },
];
const ivOf = (c) => INTERVENTIONS.find((i) => i.code === c);
const ICD = [["CA07.0", "Acute upper respiratory infection"], ["1A00", "Cholera"], ["1F40", "Malaria due to Plasmodium falciparum"], ["BA00", "Essential hypertension"], ["5A11", "Type 2 diabetes mellitus"], ["DB10", "Appendicitis"]];

let state;
const reset = () => { state = { tokens: new Set(), auths: new Map(), claims: new Map(), preauths: new Map(), payer: new Map(), forced: { preauth: null, payer: null }, log: [], seq: 1000, polls: new Map() }; };
reset();
const ref = () => Math.random().toString(36).slice(2, 12).toUpperCase();

const send = (res, status, data, extra = {}) => { res.writeHead(status, { "content-type": "application/json", ...extra }); res.end(data === undefined ? "" : JSON.stringify(data)); };
const bad = (res, msg, status = 400) => send(res, status, { error: msg });

async function readBody(req) {
  const type = req.headers["content-type"] || "";
  if (req.method === "GET" || req.method === "HEAD") return { fields: {}, files: {} };
  const r = new Request("http://mock" + req.url, { method: req.method, headers: req.headers, body: Readable.toWeb(req), duplex: "half" });
  if (type.includes("application/json")) { try { return { fields: await r.json(), files: {} }; } catch { return { fields: {}, files: {} }; } }
  if (type.includes("x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const f = await r.formData(); const fields = {}; const files = {};
    for (const [k, v] of f.entries()) { if (typeof v === "string") fields[k] = v; else files[k] = { name: v.name, size: v.size }; }
    return { fields, files };
  }
  return { fields: {}, files: {} };
}
const json = (v) => { try { return JSON.parse(v); } catch { return undefined; } };
const req_ = (f, names) => names.filter((n) => f[n] === undefined || f[n] === null || f[n] === "");

function claimView(c) {
  const lines = c.lines.filter((l) => l.is_active);
  const total = lines.reduce((a, l) => a + l.line_total_amount, 0);
  return {
    claim_id: c.claim_id, authorization_code: c.token, authorization_guid: c.guid, edi_claim_guid: c.claimGuid, claim_auth_status: c.authStatus, workflow_state: c.workflow, visit_number: c.visit, service_type: c.serviceType,
    visit_start: c.start, visit_end: c.end || "", discharge_reason: c.reason || "", total_claim_amount: total, total_claim_net_amount: total, invoice_number: c.invoice || "", emergency_visit_expiry: c.expiry || "",
    interventions: c.interventions.map((i) => ({ intervention_code: i.code, intervention_name: i.name, intervention_fund: i.fund, intervention_payment_mechanism: i.paymentMechanism, keph_level_tarrif: i.level4Tariff, intervention_overall_tariff: 0, needs_preauth: i.needsPreauth, requires_surgical_preauth: !!i.requiresSurgicalPreauth, requires_oncology_preauth: !!i.requiresOncologyPreauth, requires_renal_preauth: !!i.requiresRenalPreauth, requires_radiology_preauth: false, requires_optical_preauth: false, workflow_state: i.retired ? "INACTIVE" : "ACTIVE", applicable_document_types: i.applicableDocumentTypes })),
    claim_diagnoses: c.diagnoses.map((d) => ({ diagnosis_code: d.code, diagnosis_name: d.name, intervention_code: d.intervention })),
    claim_doctors: c.doctors, claim_attachments: c.attachments, invoices: [{ id: "INV-1", lines }], number_of_invoices: 1, patient_name: c.patientName, member_number: c.cr,
  };
}
const preauthView = (p) => ({ id: p.id, guid: p.guid, status: p.status, interventionCode: p.code, token: p.token, isElective: p.elective, needsDoctorApproval: p.needsDoctor, doctorReviewStatus: p.needsDoctor ? "PENDING" : "NOT_REQUIRED", finalApprovedAmount: p.status === "FINALISED" ? p.total : 0, totalEstimatedAmountForPreauth: p.total, preauthType: p.kind, preauthNotes: [] });

const claimFor = (token) => state.claims.get(token);
const doctorGate = (c) => c.doctors.length > 0;

async function route(req, res, url, b) {
  const p = url.pathname.replace(/^\/api\/v1/, "");
  const f = b.fields, q = url.searchParams;
  const m = req.method;

  if (p === "/tenants/token" && m === "POST") {
    if (f.client_id !== CLIENT.id || f.client_secret !== CLIENT.secret) return bad(res, "invalid client credentials", 401);
    const t = "tok-" + ref(); state.tokens.add(t);
    return send(res, 200, { access_token: t, expires_in: 300, token_type: "Bearer" });
  }
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!state.tokens.has(auth)) return bad(res, "invalid or expired token", 401);
  if (req.headers["x-facility-id"] !== FACILITY || req.headers["x-facility-id-type"] !== "fr-code") return bad(res, "X-Facility-Id and X-Facility-Id-Type are required for this token", 400);

  // ---- registries
  if (p === "/patients" && m === "GET") {
    const n = q.get("identification_number"), t = q.get("identification_type");
    if (!n || !t) return bad(res, "identification_number and identification_type are required");
    const hit = Object.entries(PATIENTS).find(([id, pt]) => (t === "National ID" && id === n) || (t === "ClientRegistry ID" && pt.id === n));
    if (!hit) return bad(res, "patient not found", 404);
    const pt = hit[1];
    return send(res, 200, { id: pt.id, first_name: pt.first_name, middle_name: pt.middle_name, last_name: pt.last_name, gender: pt.gender, date_of_birth: pt.date_of_birth, phone: pt.phone, identification_number: hit[0], identification_type: "National ID" });
  }
  if (p === "/facilities/search" && m === "GET") {
    const id = q.get("identifier");
    if (id !== FACILITY && id !== "112007") return bad(res, "facility not found", 404);
    return send(res, 200, { officialName: "Kingdom Faith Based Hospital", frCode: FACILITY, fidCode: FACILITY, kephLevel: "Level 4", facilityType: "Hospital", facilityOwnership: "Faith Based", licenseNumber: "LIC-1", facilityLicenseStatus: "Active", facilityLicenseEndDate: "2027-06-30", SHAOperationStatus: { operationalStatus: "OPERATIONAL" }, address: { county: "Bungoma" } });
  }
  if (p === "/professionals" && m === "GET") {
    if (!q.get("identification_number")) return bad(res, "identification_number is required");
    return send(res, 200, { message: { name: "Dr. Test Doctor", license_status: "ACTIVE", registration_number: q.get("identification_number") } });
  }

  // ---- eligibility and coverage
  if (p === "/patients/eligibility" && m === "GET") {
    const n = q.get("identification_number"), t = q.get("identification_type");
    const hit = Object.entries(PATIENTS).find(([id, pt]) => (t === "National ID" && id === n) || (t === "ClientRegistry ID" && pt.id === n));
    if (!hit) return bad(res, "patient not found", 404);
    const pt = hit[1];
    return send(res, 200, { fullName: `${pt.first_name} ${pt.last_name}`, gender: pt.gender, age: 38, dateOfBirth: pt.date_of_birth, memberCrNumber: pt.id, isAlive: true, statusCode: pt.eligible ? "ACTIVE" : "INACTIVE", statusDesc: pt.eligible ? "Contributions are up to date" : "Contributions are not up to date", whitelistedForOTP: true, facilityBiometricsEnforced: false,
      schemes: [{ schemeId: 1, schemeName: "SHIF", memberType: "PRINCIPAL", coverage: pt.eligible ? { status: "Active", startDate: "2026-01-01", endDate: "2026-12-31", message: "", reason: "", possibleSolution: "" } : { status: "Inactive", startDate: "2026-01-01", endDate: "2026-06-30", message: "Premiums are overdue", reason: "ARREARS", possibleSolution: "Pay the outstanding premium through the SHA self service channels" }, policy: { number: "POL-1", startDate: "2026-01-01", endDate: "2026-12-31" }, principalContributor: { crNumber: pt.id, name: pt.first_name } }] });
  }
  if (p === "/patients/benefits" && m === "GET") { if (!q.get("patient_id")) return bad(res, "patient_id is required"); return send(res, 200, { count: 1, results: [{ parentBenefit: "Outpatient", parentBenefitCode: "SHA-19" }] }); }
  if (p === "/patients/sub-benefits" && m === "GET") {
    if (!q.get("patient_id")) return bad(res, "patient_id is required");
    return send(res, 200, { count: 3, currentPage: 1, totalPages: 1, results: [{ code: "SHA-19-SC-13", name: "Outpatient services", fund: "SHIF", accessPoint: "OP", parentBenefit: "Outpatient", parentBenefitCode: "SHA-19", active: true }, { code: "SHA-18-SC-01", name: "Inpatient services", fund: "SHIF", accessPoint: "IP", parentBenefit: "Inpatient", parentBenefitCode: "SHA-18", active: true }, { code: "SHA-12-SC-01", name: "Primary health care", fund: "PHC", accessPoint: "OP", parentBenefit: "PHC", parentBenefitCode: "SHA-12", active: true }] });
  }
  if (p === "/patients/benefits/interventions" && m === "GET") {
    if (!q.get("patient_id")) return bad(res, "patient_id is required");
    const search = (q.get("search") || "").toLowerCase(), ap = q.get("access_point"), code = q.get("code");
    const list = INTERVENTIONS.filter((i) => i.fund !== "ECCIF" && (!code || i.code === code) && (!ap || i.accessPoint === ap) && (!search || i.name.toLowerCase().includes(search) || i.code.toLowerCase().includes(search)));
    return send(res, 200, { count: list.length, currentPage: 1, totalPages: 1, results: list });
  }
  if (p === "/patients/contacts" && m === "GET") { if (!q.get("patient_id")) return bad(res, "patient_id is required"); return send(res, 200, { count: 1, results: [{ id: 675590, contactValue: "+254714***898", contactType: "PHO", isConfirmed: true, active: true }] }); }

  // ---- consent
  if (p === "/claims/otp" && m === "POST") {
    const miss = req_(f, ["patient_id", "intervention_codes"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (!Array.isArray(f.intervention_codes)) return bad(res, "intervention_codes must be a list");
    return send(res, 200, { data: {}, message: "OTP sent" });
  }
  if (p === "/claims/otp/discharge" && m === "POST") {
    const miss = req_(f, ["consent_token", "patient_id"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (!claimFor(f.consent_token)) return bad(res, "unknown consent token", 404);
    return send(res, 200, { data: {}, message: "Discharge OTP sent" });
  }
  if (p === "/claims/authorize" && m === "POST") {
    const miss = req_(f, ["patient_id", "service_type", "otp", "interventions"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (f.otp !== VISIT_OTP) return bad(res, "invalid OTP");
    const token = "AUTH" + ref(), a = { token, guid: randomUUID(), status: "AUTHORIZED_PENDING_VISIT", patient: f.patient_id, interventions: f.interventions, used: false };
    state.auths.set(token, a);
    return send(res, 200, { token, guid: a.guid, status: a.status, isElective: true });
  }

  // ---- visits
  if (p === "/claims/visit" && m === "POST") {
    const miss = req_(f, ["intervention_codes", "patient_id", "service_type"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (!Array.isArray(f.intervention_codes)) return bad(res, "intervention_codes must be a list");
    if (!["CAPITATION", "OUTPATIENT", "INPATIENT", "EMERGENCY"].includes(f.service_type)) return bad(res, "invalid service_type");
    if (f.otp !== VISIT_OTP) return bad(res, "invalid OTP");
    const pt = byCr(f.patient_id); if (!pt) return bad(res, "patient not found", 404);
    if (!pt.eligible) return bad(res, "patient is not eligible");
    const ivs = f.intervention_codes.map(ivOf); if (ivs.some((x) => !x)) return bad(res, "unknown intervention code");
    const elective = ivs.find((x) => x.needsManualPreauthApproval);
    if (elective && ![...state.auths.values()].some((a) => a.patient === f.patient_id && a.interventions.includes(elective.code))) return bad(res, "elective services need a pre-visit authorization");
    const c = { token: ref(), guid: randomUUID(), claimGuid: randomUUID(), claim_id: ++state.seq, visit: "V" + state.seq, authStatus: "AUTHORIZED", workflow: "DRAFT", serviceType: f.service_type, start: new Date().toISOString(), interventions: ivs.map((x) => ({ ...x })), lines: [], diagnoses: [], doctors: [], attachments: [], cr: f.patient_id, patientName: `${pt.first_name} ${pt.last_name}` };
    if (f.practitioner_identification_number) c.doctors.push({ name: "Attending doctor", identification_number: f.practitioner_identification_number, regulation_body: f.practitioner_regulation_body });
    state.claims.set(c.token, c);
    const auth = [...state.auths.values()].find((a) => a.patient === f.patient_id); if (auth && elective) { c.preauthToken = auth.token; }
    return send(res, 200, claimView(c));
  }
  if (p.startsWith("/claims/interventions") && m === "POST") {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    if (p === "/claims/interventions") { const i = ivOf(f.intervention_code); if (!i) return bad(res, "unknown intervention code"); if (c.interventions.find((x) => x.code === i.code && !x.retired)) return bad(res, "intervention already on the claim"); c.interventions.push({ ...i }); return send(res, 200, { intervention_code: i.code, intervention_name: i.name, workflow_state: "ACTIVE" }); }
    if (p.endsWith("/retire") || p.endsWith("/restore")) { const i = c.interventions.find((x) => x.code === f.intervention_code); if (!i) return bad(res, "intervention not on the claim", 404); i.retired = p.endsWith("/retire"); return send(res, 200, { data: {}, message: "ok" }); }
    if (p.endsWith("/switch")) {
      const miss = req_(f, ["existing_intervention_code", "new_intervention_code"]); if (miss.length || typeof f.retain_bill_items !== "boolean") return bad(res, "existing_intervention_code, new_intervention_code and retain_bill_items are required");
      const old = c.interventions.find((x) => x.code === f.existing_intervention_code); const nw = ivOf(f.new_intervention_code); if (!old || !nw) return bad(res, "unknown intervention", 404);
      old.retired = true; c.interventions.push({ ...nw }); return send(res, 200, { data: {}, message: "switched" });
    }
  }

  // ---- billing
  if (p === "/claims/lines" && m === "POST") {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    const miss = req_(f, ["intervention_code", "unit_price", "quantity"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    const iv = c.interventions.find((x) => x.code === f.intervention_code && !x.retired); if (!iv) return bad(res, "intervention is not active on the claim");
    if (iv.needsPreauth) { const pa = [...state.preauths.values()].find((x) => x.token === c.token || x.token === c.preauthToken); if (!pa || pa.status !== "FINALISED") return bad(res, "the preauthorization must be approved before billing"); }
    const price = Number(f.unit_price), qty = Number(f.quantity);
    if (!(price > 0) || !(qty > 0)) return bad(res, "unit_price and quantity must be positive numbers");
    if (price > iv.level4Tariff) return bad(res, `unit_price ${price} exceeds the tariff of ${iv.level4Tariff}; the request was rolled back`);
    if (f.practitioner_identification_number) c.doctors.push({ name: "Attending doctor", identification_number: f.practitioner_identification_number, regulation_body: f.practitioner_regulation_body });
    const dx = typeof f.diagnoses === "string" ? json(f.diagnoses) : f.diagnoses;
    if (Array.isArray(dx)) for (const d of dx) if (d.icd_code && !c.diagnoses.find((x) => x.code === d.icd_code)) c.diagnoses.push({ code: d.icd_code, name: (ICD.find((i) => i[0].toLowerCase() === String(d.icd_code).toLowerCase()) || [])[1] || d.icd_code, intervention: iv.code });
    if (b.files && Object.keys(b.files).length) for (const [k, v] of Object.entries(b.files)) c.attachments.push({ id: randomUUID(), title: v.name, attachment_type: "LAB_RESULTS", field: k });
    const line = { id: randomUUID(), intervention_code: iv.code, item_name: f.service_name || iv.name, quantity: qty, unit_price: price, line_total_amount: Math.round(price * qty * 100) / 100, is_active: true };
    c.lines.push(line);
    return send(res, 200, line);
  }
  if (p === "/claims/lines" && m === "PATCH") { const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404); const l = c.lines.find((x) => x.id === f.line_guid); if (!l) return bad(res, "line not found", 404); l.is_active = false; return send(res, 200, { data: {}, message: "removed" }); }
  if (p === "/claims/diagnoses" && (m === "POST" || m === "PATCH")) {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    const miss = req_(f, ["icd_code", "intervention_code"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (m === "POST") { c.diagnoses.push({ code: f.icd_code, name: (ICD.find((i) => i[0].toLowerCase() === String(f.icd_code).toLowerCase()) || [])[1] || f.icd_code, intervention: f.intervention_code }); if (f.practitioner_identification_number) c.doctors.push({ name: "Attending doctor", identification_number: f.practitioner_identification_number }); return send(res, 200, { diagnosis_code: f.icd_code, intervention_code: f.intervention_code }); }
    c.diagnoses = c.diagnoses.filter((d) => d.code !== f.icd_code); return send(res, 200, { data: {}, message: "removed" });
  }
  if (p === "/claims/attachments" && m === "POST") { const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404); if (!b.files.file_blob) return bad(res, "file_blob is required"); c.attachments.push({ id: randomUUID(), title: b.files.file_blob.name, attachment_type: f.document_type }); return send(res, 200, { id: "att", attachment_type: f.document_type }); }
  if (p === "/claims/preview" && m === "POST") { const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404); return send(res, 200, claimView(c)); }

  // ---- preauths
  if (p === "/preauths" && m === "POST") {
    const miss = req_(f, ["consent_token", "intervention_code", "service_start", "service_end", "items", "diagnoses", "doctors", "provider_notification_email"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    const c = claimFor(f.consent_token) || [...state.auths.values()].find((a) => a.token === f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    const iv = ivOf(f.intervention_code); if (!iv || !iv.needsPreauth) return bad(res, "this intervention does not need a preauthorization");
    const need = iv.requiresSurgicalPreauth ? ["surgery_date", "chief_complaint", "vital_signs", "history_of_present_illness", "physical_examination", "investigation_report_details", "type_of_anaesthesia"] : iv.requiresOncologyPreauth ? ["carcinoma_staging", "comorbidity", "metastases", "treatment_setting", "start_date", "number_of_sessions", "cost_per_session"] : iv.requiresRenalPreauth ? ["start_date", "number_of_sessions_required", "frequency_of_sessions", "clinical_indications"] : [];
    const lack = req_(f, need); if (lack.length) return bad(res, `this preauthorization form also needs: ${lack.join(", ")}`);
    const items = json(f.items), docs = json(f.doctors); if (!Array.isArray(items) && typeof items !== "object") return bad(res, "items must be JSON");
    const list = Array.isArray(items) ? items : [items];
    const total = list.reduce((a, i) => a + Number(i.unit_price) * Number(i.quantity || 1), 0);
    const pa = { id: ++state.seq, guid: randomUUID(), token: f.consent_token, code: iv.code, kind: iv.requiresSurgicalPreauth ? "surgical" : iv.requiresOncologyPreauth ? "oncology" : iv.requiresRenalPreauth ? "renal" : "normal", status: iv.needsManualPreauthApproval || iv.needsDoctorAuthorization ? "PENDING_DOCTOR_APPROVAL" : "ACTIVE", elective: !!iv.needsManualPreauthApproval, needsDoctor: !!iv.needsDoctorAuthorization, total, doctors: docs };
    state.preauths.set(pa.id, pa); return send(res, 200, preauthView(pa));
  }
  if (p === "/preauths" && m === "GET") {
    const t = q.get("consent_token"); const pa = [...state.preauths.values()].filter((x) => x.token === t);
    if (!pa.length) return bad(res, "no preauthorization for this token", 404);
    for (const x of pa) { const n = (state.polls.get(x.id) || 0) + 1; state.polls.set(x.id, n); if (state.forced.preauth) x.status = state.forced.preauth; else if (n >= 2 && x.status !== "CANCELLED") x.status = "FINALISED"; }
    return send(res, 200, { count: pa.length, results: pa.map(preauthView) });
  }
  if (p === "/preauths/cancel" && m === "POST") { const pa = [...state.preauths.values()].find((x) => x.token === f.consent_token && x.code === f.intervention_code); if (!pa) return bad(res, "preauthorization not found", 404); if (pa.status === "CANCELLED") return bad(res, "already cancelled"); pa.status = "CANCELLED"; return send(res, 200, preauthView(pa)); }
  if (p === "/claims/doctor-consent" && m === "POST") { const miss = req_(f, ["practitioner_registration_number", "request_type", "consent_token"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`); return send(res, 200, { data: {}, message: "resent" }); }

  // ---- dispatch
  if (p === "/claims/submit" && m === "POST") {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    const miss = req_(f, ["invoice_number", "discharge_reason"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (c.serviceType === "INPATIENT") return bad(res, "inpatient claims are dispatched through /claims/discharge");
    if (!["RECOVERED", "REFERRED", "ABSCONDED", "OTHER"].includes(f.discharge_reason)) return bad(res, "invalid discharge_reason");
    if (c.serviceType !== "EMERGENCY" && f.otp !== DISCHARGE_OTP) return bad(res, "invalid discharge OTP");
    if (!doctorGate(c)) return bad(res, "a doctor must be attached to the claim before it is submitted");
    if (!c.diagnoses.length) return bad(res, "at least one diagnosis is required");
    if (!c.lines.some((l) => l.is_active)) return bad(res, "at least one billing line is required");
    c.workflow = "SUBMITTED"; c.authStatus = "SUBMITTED_CLAIM"; c.end = new Date().toISOString(); c.reason = f.discharge_reason; c.invoice = f.invoice_number; state.payer.set(f.invoice_number, { n: 0 });
    return send(res, 200, claimView(c));
  }
  if (p === "/claims/discharge" && m === "POST") {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    if (c.serviceType !== "INPATIENT") return bad(res, "only inpatient claims are discharged");
    const miss = req_(f, ["invoice_number", "discharge_reason", "discharge_date"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (f.otp !== DISCHARGE_OTP) return bad(res, "invalid discharge OTP");
    if (!doctorGate(c) || !c.diagnoses.length) return bad(res, "a doctor and a diagnosis are required before discharge");
    c.workflow = "SUBMITTED"; c.authStatus = "SUBMITTED_CLAIM"; c.end = f.discharge_date; c.reason = f.discharge_reason; c.invoice = f.invoice_number; state.payer.set(f.invoice_number, { n: 0 });
    return send(res, 200, claimView(c));
  }
  if (p === "/claims/close" && m === "POST") { const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404); const miss = req_(f, ["cancel_reason_type", "cancel_reason_text"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`); c.workflow = "CLOSED"; c.authStatus = "CLOSED"; return send(res, 200, claimView(c)); }
  if (p === "/claims/preview/payer" && m === "GET") {
    const inv = q.get("provider_claim_no"); const s = state.payer.get(inv); if (!s) return bad(res, "claim has not reached the payer", 404);
    s.n++; const seq = ["SUBMITTED_PAYER", "IN_REVIEW", "APPROVED", "PAID"]; const wf = state.forced.payer || seq[Math.min(s.n - 1, seq.length - 1)];
    return send(res, 200, { pageSize: 1, results: [{ workflowState: wf, notes: wf === "REJECTED" ? "Diagnosis does not match the intervention" : "" }] });
  }

  // ---- emergency
  if (p === "/claims/emergency" && m === "POST") {
    const miss = req_(f, ["interventions", "mode_of_arrival", "brought_by", "reference_number", "identification_number", "identification_type", "regulation_body"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    if (!Array.isArray(f.interventions) || f.interventions.length !== 1) return bad(res, "exactly one emergency intervention is allowed");
    const iv = ivOf(f.interventions[0]); if (!iv || !iv.code.startsWith("SHA-01-")) return bad(res, "not an emergency intervention");
    if (f.consent_token) { const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404); if (f.otp !== VISIT_OTP) return bad(res, "invalid OTP"); c.cr = f.beneficiary_cr_id; c.identified = true; return send(res, 200, claimView(c)); }
    let pt; if (f.beneficiary_cr_id || f.otp) { if (f.otp !== VISIT_OTP) return bad(res, "invalid OTP"); pt = byCr(f.beneficiary_cr_id); if (!pt) return bad(res, "patient not found", 404); }
    const start = new Date();
    const c = { token: ref(), guid: randomUUID(), claimGuid: randomUUID(), claim_id: ++state.seq, visit: "E" + state.seq, authStatus: "EMERGENCY_AUTHORIZED", workflow: "DRAFT", serviceType: "EMERGENCY", start: start.toISOString(), expiry: new Date(start.getTime() + 24 * 3600e3).toISOString(), interventions: [{ ...iv }], lines: [], diagnoses: [], doctors: [{ name: "Attending doctor", identification_number: f.identification_number, regulation_body: f.regulation_body }], attachments: [], cr: f.beneficiary_cr_id || "", patientName: pt ? `${pt.first_name} ${pt.last_name}` : "Unidentified", identified: !!pt };
    state.claims.set(c.token, c); return send(res, 200, claimView(c));
  }
  if (p === "/claims/emergency/protocols" && m === "GET") {
    if (!q.get("intervention_code") || !q.get("active")) return bad(res, "intervention_code and active are required");
    return send(res, 200, { count: 2, results: [{ protocolCode: "PROT-001", protocolName: "Initial stabilisation", applicableTariff: 5000 }, { protocolCode: "PROT-002", protocolName: "Resuscitation and monitoring", applicableTariff: 12000 }] });
  }
  if (p === "/claims/emergency/protocols" && m === "POST") {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    const miss = req_(f, ["protocol_code", "intervention_code", "unit_price", "quantity"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    const cap = f.protocol_code === "PROT-001" ? 5000 : f.protocol_code === "PROT-002" ? 12000 : 0; if (!cap) return bad(res, "unknown protocol");
    if (Number(f.unit_price) > cap) return bad(res, `unit_price exceeds the approved tariff of ${cap}`);
    const dx = typeof f.diagnoses === "string" ? json(f.diagnoses) : f.diagnoses; if (Array.isArray(dx)) for (const d of dx) c.diagnoses.push({ code: d.icd_code, name: d.icd_code, intervention: f.intervention_code });
    const line = { id: randomUUID(), intervention_code: f.intervention_code, item_name: f.protocol_code, quantity: Number(f.quantity), unit_price: Number(f.unit_price), line_total_amount: Number(f.unit_price) * Number(f.quantity), is_active: true }; c.lines.push(line); return send(res, 200, line);
  }
  if (p === "/claims/doctors" && (m === "POST" || m === "DELETE")) {
    const c = claimFor(f.consent_token); if (!c) return bad(res, "unknown consent token", 404);
    if (m === "DELETE") { c.doctors = []; res.writeHead(204); return res.end(); }
    const miss = req_(f, ["identification_number", "identification_type", "regulation_body"]); if (miss.length) return bad(res, `missing: ${miss.join(", ")}`);
    c.doctors.push({ name: "Attending doctor", identification_number: f.identification_number, regulation_body: f.regulation_body }); return send(res, 200, { data: {}, message: "added" });
  }

  // ---- terminology
  if (p === "/clinical/concepts" && m === "GET") {
    if (!q.get("owner")) return bad(res, "owner is required");
    const s = (q.get("search") || "").toLowerCase(); const src = q.get("source");
    if (src === "ICD11") return send(res, 200, { count: 6, results: ICD.filter((i) => !s || i[1].toLowerCase().includes(s) || i[0].toLowerCase().includes(s)).map(([id, name]) => ({ id, display_name: name })) });
    return send(res, 200, { count: 1, results: INTERVENTIONS.filter((i) => !s || i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s)).map((i) => ({ id: i.code, display_name: i.name })) });
  }
  return bad(res, `mock: no route for ${m} ${p}`, 404);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  if (url.pathname.startsWith("/__ctl/")) {
    const k = url.pathname.slice(7);
    if (k === "reset") { reset(); return send(res, 200, { ok: true }); }
    if (k === "expire") { state.tokens.clear(); return send(res, 200, { ok: true }); }
    if (k === "preauth") { state.forced.preauth = url.searchParams.get("state") || null; return send(res, 200, { ok: true }); }
    if (k === "payer") { state.forced.payer = url.searchParams.get("state") || null; return send(res, 200, { ok: true }); }
    if (k === "log") return send(res, 200, state.log);
    return bad(res, "unknown control", 404);
  }
  try {
    const b = await readBody(req);
    const started = Date.now();
    const origEnd = res.end.bind(res); let status = 0;
    const origWrite = res.writeHead.bind(res); res.writeHead = (s, ...a) => { status = s; return origWrite(s, ...a); };
    res.end = (...a) => { state.log.push({ method: req.method, path: url.pathname.replace(/^\/api\/v1/, ""), query: Object.fromEntries(url.searchParams), fields: b.fields, files: b.files, facility: req.headers["x-facility-id"] || null, status, ms: Date.now() - started }); return origEnd(...a); };
    await route(req, res, url, b);
  } catch (e) { console.error(e); if (!res.headersSent) bad(res, "mock error: " + e.message, 500); }
}).listen(PORT, () => console.log(`mock HIE on http://localhost:${PORT}/api/v1  (client ${CLIENT.id}, facility ${FACILITY})`));
