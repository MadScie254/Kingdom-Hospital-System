import test from "node:test";
import assert from "node:assert/strict";
import { buildPreauthForm, hieApi, money, toForm } from "../../lib/hie/api";
import type { PreauthInput } from "../../lib/hie/types";
import { harness, json, tokenReply } from "./helpers";

const isToken = (c: { url: URL }) => c.url.pathname.endsWith("/tenants/token");
const api = () => { const h = harness((c) => (isToken(c) ? tokenReply() : json({ ok: true }))); return { ...h, hie: hieApi(h.client), last: () => h.calls.filter((c) => !isToken(c)).at(-1)! }; };
const parse = (b: unknown) => JSON.parse(String(b));
const pdf = new Uint8Array([37, 80, 68, 70]);

test("money has two decimals", () => {
  assert.equal(money(1500), "1500.00");
  assert.equal(money("12.345"), "12.35");
  assert.equal(money(0.1 + 0.2), "0.30");
});

test("registry and eligibility lookups use the documented query names", async () => {
  const t = api();
  await t.hie.searchPatient({ identificationNumber: "33333333", identificationType: "National ID" });
  assert.equal(t.last().url.pathname, "/api/v1/patients");
  assert.equal(t.last().url.searchParams.get("identification_number"), "33333333");
  assert.equal(t.last().url.searchParams.get("identification_type"), "National ID");
  await t.hie.eligibility({ identificationNumber: "CR2594484249725-2", identificationType: "ClientRegistry ID" });
  assert.equal(t.last().url.pathname, "/api/v1/patients/eligibility");
  await t.hie.subBenefits("CR1", "SHA-19");
  assert.equal(t.last().url.search, "?patient_id=CR1&parent_benefit_code=SHA-19");
  await t.hie.interventions("CR1", { subBenefitCode: "SHA-19-SC-13", accessPoint: "OP", search: "consult", page: 2, pageSize: 20 });
  assert.equal(t.last().url.searchParams.get("sub_benefit_code"), "SHA-19-SC-13");
  assert.equal(t.last().url.searchParams.get("access_point"), "OP");
  assert.equal(t.last().url.searchParams.get("page_size"), "20");
  await t.hie.searchFacility({ identifier: "112007", identifierType: "mfl" });
  assert.equal(t.last().url.searchParams.get("identifier-type"), "mfl");
  await t.hie.searchProfessional({ identificationNumber: "A00000", regulator: "KMPDC" });
  assert.equal(t.last().url.searchParams.get("identification_type"), "registration_number");
});

test("OTP consent calls", async () => {
  const t = api();
  await t.hie.contacts("CR1");
  assert.equal(t.last().url.pathname, "/api/v1/patients/contacts");
  await t.hie.sendOtp({ crId: "CR1", interventionCodes: ["SHA-18-005"], contactId: 675590 });
  assert.deepEqual(parse(t.last().body), { patient_id: "CR1", intervention_codes: ["SHA-18-005"], contact_id: 675590 });
  await t.hie.sendOtp({ crId: "CR1", interventionCodes: ["SHA-18-005"] });
  assert.equal("contact_id" in parse(t.last().body), false);
  await t.hie.sendDischargeOtp({ consentToken: "K5", crId: "CR1" });
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", patient_id: "CR1" });
  await t.hie.authorize({ crId: "CR1", serviceType: "OUTPATIENT", otp: "123456", interventionCodes: ["SHA-18-005"] });
  assert.equal(t.last().url.pathname, "/api/v1/claims/authorize");
  assert.deepEqual(parse(t.last().body), { patient_id: "CR1", service_type: "OUTPATIENT", otp: "123456", interventions: ["SHA-18-005"] });
});

test("a visit carries intervention codes, service type, otp and the doctor", async () => {
  const t = api();
  await t.hie.createVisit({ interventionCodes: ["SHA-12-001"], crId: "CR1", serviceType: "CAPITATION", otp: "123456", practitioner: { identificationNumber: "A00000", regulationBody: "KMPDC" } });
  assert.deepEqual(parse(t.last().body), {
    intervention_codes: ["SHA-12-001"], patient_id: "CR1", service_type: "CAPITATION", otp: "123456",
    practitioner_identification_number: "A00000", practitioner_identification_type: "registration_number", practitioner_regulation_body: "KMPDC",
  });
});

test("intervention management", async () => {
  const t = api();
  await t.hie.addIntervention("K5", "SHA-18-005");
  assert.equal(t.last().url.pathname, "/api/v1/claims/interventions");
  await t.hie.retireIntervention("K5", "SHA-18-005");
  assert.equal(t.last().url.pathname, "/api/v1/claims/interventions/retire");
  await t.hie.restoreIntervention("K5", "SHA-18-005");
  assert.equal(t.last().url.pathname, "/api/v1/claims/interventions/restore");
  await t.hie.switchIntervention({ consentToken: "K5", from: "SHA-18-005", to: "SHA-18-006", retainBillItems: true });
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", existing_intervention_code: "SHA-18-005", new_intervention_code: "SHA-18-006", retain_bill_items: true });
});

test("a plain billing line goes as JSON with text amounts", async () => {
  const t = api();
  await t.hie.addLine({ consentToken: "K5", interventionCode: "SHA-09-021", unitPrice: 300, quantity: 2, serviceName: "Basic consultation" });
  assert.equal(t.last().headers.get("content-type"), "application/json");
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", intervention_code: "SHA-09-021", unit_price: "300.00", quantity: "2", service_name: "Basic consultation" });
});

test("combined billing goes as multipart with diagnoses and linked files", async () => {
  const t = api();
  await t.hie.addLine({ consentToken: "K5", interventionCode: "SHA-18-005", unitPrice: 1500, quantity: 1, diagnoses: ["ca07.0", "1a00"], attachments: [{ title: "Itemised bill", type: "FINAL_BILL", filename: "bill.pdf", bytes: pdf, contentType: "application/pdf" }] });
  const form = t.last().body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("consent_token"), "K5");
  assert.deepEqual(JSON.parse(String(form.get("diagnoses"))), [{ icd_code: "ca07.0" }, { icd_code: "1a00" }]);
  const meta = JSON.parse(String(form.get("attachments")));
  assert.equal(meta[0].document_type, "FINAL_BILL");
  const file = form.get(meta[0].file_field_name) as File;
  assert.equal(file.name, "bill.pdf");
  assert.equal(file.size, 4);
});

test("diagnosis, line and attachment edits", async () => {
  const t = api();
  await t.hie.addDiagnosis({ consentToken: "K5", icd: "ca07.0", interventionCode: "SHA-18-005" });
  assert.equal(t.last().url.pathname, "/api/v1/claims/diagnoses");
  await t.hie.removeDiagnosis("K5", "SHA-18-005", "ca07.0");
  assert.equal(t.last().method, "PATCH");
  await t.hie.removeLine("K5", "guid-1");
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", line_guid: "guid-1" });
  await t.hie.addAttachment({ consentToken: "K5", interventionCode: "SHA-18-005", type: "DISCHARGE_SUMMARY", file: { title: "x", type: "x", filename: "d.pdf", bytes: pdf } });
  const form = t.last().body as FormData;
  assert.equal((form.get("file_blob") as File).name, "d.pdf");
  assert.equal(form.get("document_type"), "DISCHARGE_SUMMARY");
});

test("outpatient submit and inpatient discharge", async () => {
  const t = api();
  await t.hie.submitClaim({ consentToken: "K5", invoiceNumber: "INV1271", reason: "RECOVERED", otp: "654321", notes: "stable" });
  assert.equal(t.last().url.pathname, "/api/v1/claims/submit");
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", invoice_number: "INV1271", discharge_reason: "RECOVERED", otp: "654321", notes: "stable" });
  await t.hie.submitClaim({ consentToken: "K5", invoiceNumber: "INV1272", reason: "OTHER", partial: true, reasonForUnknownPatient: "unconscious" });
  assert.equal(parse(t.last().body).discharge_status, "PARTIAL");
  assert.equal(parse(t.last().body).reason_for_unknown_patient, "unconscious");
  await t.hie.dischargeInpatient({ consentToken: "K5", invoiceNumber: "INV1273", reason: "DECEASED", dischargeDate: "2026-11-20T10:00:00+03:00", otp: "111111" });
  assert.equal(t.last().url.pathname, "/api/v1/claims/discharge");
  assert.equal(parse(t.last().body).discharge_reason, "DECEASED");
  await t.hie.closeClaim({ consentToken: "K5", reasonType: "WRONG_PATIENT", reasonText: "Wrong person registered" });
  assert.deepEqual(parse(t.last().body), { consent_token: "K5", cancel_reason_type: "WRONG_PATIENT", cancel_reason_text: "Wrong person registered" });
  await t.hie.preview("K5");
  assert.equal(t.last().url.pathname, "/api/v1/claims/preview");
});

const basePre: PreauthInput = {
  kind: "normal", consentToken: "J6", interventionCode: "SHA-11-001", serviceStart: "2026-11-20T08:00:00+03:00", serviceEnd: "2026-11-21T08:00:00+03:00", providerEmail: "claims@hospital.test",
  items: [{ name: "Theatre", unitPrice: 1500, quantity: 1 }], diagnoses: ["ca07.0"], doctors: [{ identificationNumber: "A00000", regulationBody: "KMPDC", isPrimary: true }],
  attachments: [{ title: "Lab results", type: "LAB_RESULTS", filename: "lab.pdf", bytes: pdf }],
};

test("normal preauth form follows the documented multipart fields", () => {
  const f = buildPreauthForm(basePre);
  assert.equal(f.get("consent_token"), "J6");
  assert.equal(f.get("provider_notification_email"), "claims@hospital.test");
  assert.deepEqual(JSON.parse(String(f.get("items"))), [{ name: "Theatre", unit_price: "1500.00", quantity: "1.00" }]);
  assert.deepEqual(JSON.parse(String(f.get("diagnoses"))), [{ consent_token: "J6", icd_code: "ca07.0" }]);
  assert.deepEqual(JSON.parse(String(f.get("doctors"))), [{ identification_number: "A00000", identification_type: "registration_number", regulation_body: "KMPDC", intervention_code: "SHA-11-001", is_primary: true }]);
  const meta = JSON.parse(String(f.get("attachments")));
  assert.equal((f.get(meta[0].file_field_name) as File).name, "lab.pdf");
  assert.equal(f.get("surgery_date"), null);
});

test("surgical preauth adds the surgical fields", () => {
  const f = buildPreauthForm({ ...basePre, kind: "surgical", surgical: { surgeryDate: "2026-11-22", chiefComplaint: "Pain", vitalSigns: "BP 120/80", historyOfPresentIllness: "Two days", physicalExamination: "Tender", investigationReportDetails: "Ultrasound", typeOfAnaesthesia: "General Anaesthesia", relatedToEmployment: false } });
  for (const k of ["surgery_date", "chief_complaint", "vital_signs", "history_of_present_illness", "physical_examination", "investigation_report_details", "type_of_anaesthesia"]) assert.ok(f.get(k), k);
  assert.equal(f.get("is_condition_related_to_employment"), "false");
  assert.equal(f.get("is_condition_related_to_auto_or_other_accident"), "false");
});

test("oncology and renal preauths add their own fields", () => {
  const onc = buildPreauthForm({ ...basePre, kind: "oncology", oncology: { carcinomaStaging: "Stage 2", comorbidity: "None", metastases: "Lung", treatmentSetting: "Day ward", startDate: "2026-12-01", numberOfSessions: 6, costPerSession: 45000 } });
  assert.equal(onc.get("carcinoma_staging"), "Stage 2");
  assert.equal(onc.get("number_of_sessions"), "6");
  assert.equal(onc.get("cost_per_session"), "45000.00");
  const ren = buildPreauthForm({ ...basePre, kind: "renal", renal: { startDate: "2026-12-01", sessionsRequired: 12, frequency: "Twice a week", clinicalIndications: "End-Stage renal disease" } });
  assert.equal(ren.get("number_of_sessions_required"), "12");
  assert.equal(ren.get("frequency_of_sessions"), "Twice a week");
  assert.equal(ren.get("clinical_indications"), "End-Stage renal disease");
});

test("imaging and optical preauths", () => {
  assert.equal(buildPreauthForm({ ...basePre, kind: "imaging", imaging: { clinicalIndications: "Suspected fracture" } }).get("clinical_indications"), "Suspected fracture");
  const opt = buildPreauthForm({ ...basePre, kind: "optical", optical: { clinicalIndications: "Myopia", necessityOfService: "Cannot read", newOrReplacement: "New", lensPrescription: "Framed", frameAmount: "3000" } });
  assert.equal(opt.get("necessity_of_service"), "Cannot read");
  assert.equal(opt.get("frame_amount"), "3000");
});

test("preauth calls: create, fetch, cancel, resend doctor consent", async () => {
  const t = api();
  await t.hie.createPreauth(basePre);
  assert.equal(t.last().url.pathname, "/api/v1/preauths");
  assert.ok(t.last().body instanceof FormData);
  await t.hie.getPreauth("J6");
  assert.equal(t.last().url.search, "?consent_token=J6");
  await t.hie.cancelPreauth("J6", "SHA-11-001");
  assert.equal(t.last().url.pathname, "/api/v1/preauths/cancel");
  await t.hie.resendDoctorConsent({ consentToken: "J6", interventionCode: "SHA-11-001", practitionerRegistrationNumber: "A00000" });
  assert.equal(parse(t.last().body).request_type, "PREAUTH_DOCTOR_APPROVAL_REQUEST");
  await t.hie.removePreauthDiagnosis("J6", "SHA-11-001", "ca07.0");
  assert.equal(t.last().url.pathname, "/api/v1/preauths/diagnoses/ca07.0");
  assert.equal(t.last().method, "DELETE");
});

test("emergency claim, protocols and doctors", async () => {
  const t = api();
  const doctor = { identificationNumber: "A00000", regulationBody: "KMPDC" as const };
  await t.hie.createEmergencyClaim({ interventionCode: "SHA-01-005", modeOfArrival: "AMBULANCE", broughtBy: "PARAMEDICS", referenceNumber: "EMG/1/2026", doctor, patient: { crId: "CR1", otp: "123456" } });
  const b = parse(t.last().body);
  assert.deepEqual(b.interventions, ["SHA-01-005"]);
  assert.equal(b.beneficiary_cr_id, "CR1");
  assert.equal(b.otp, "123456");
  assert.equal(b.regulation_body, "KMPDC");
  await t.hie.createEmergencyClaim({ interventionCode: "SHA-01-005", modeOfArrival: "WALK-IN", broughtBy: "UNKNOWN", referenceNumber: "EMG/2/2026", doctor });
  assert.equal("beneficiary_cr_id" in parse(t.last().body), false);
  await t.hie.emergencyProtocols("SHA-01-005");
  assert.equal(t.last().url.search, "?intervention_code=SHA-01-005&active=true");
  await t.hie.addEmergencyProtocol({ consentToken: "E1", protocolCode: "PROT-001", interventionCode: "SHA-01-005", unitPrice: 5000, quantity: 1 });
  assert.equal(parse(t.last().body).unit_price, "5000.00");
  await t.hie.addClaimDoctor("E1", doctor);
  assert.equal(t.last().url.pathname, "/api/v1/claims/doctors");
  await t.hie.removeClaimDoctor("E1");
  assert.equal(t.last().method, "DELETE");
});

test("terminology search", async () => {
  const t = api();
  await t.hie.searchConcepts({ owner: "ORG-00002", source: "BenefitsAndInterventions", search: "malaria", limit: 20 });
  assert.equal(t.last().url.pathname, "/api/v1/clinical/concepts");
  assert.equal(t.last().url.searchParams.get("owner"), "ORG-00002");
});

test("toForm skips empty values and stringifies objects", () => {
  const f = toForm({ a: "x", b: "", c: undefined, d: { k: 1 }, e: true, g: 0 });
  assert.equal(f.get("a"), "x");
  assert.equal(f.has("b"), false);
  assert.equal(f.get("d"), '{"k":1}');
  assert.equal(f.get("e"), "true");
  assert.equal(f.get("g"), "0");
});
