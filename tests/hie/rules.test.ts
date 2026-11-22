import test from "node:test";
import assert from "node:assert/strict";
import { claimStatus, emergencyDeadline, flowOf, hoursLeft, isEmergencyCode, parseKephLevel, preauthApproved, preauthKindOf, preauthStatus, tariffFor } from "../../lib/hie/rules";
import { isIcd11, normalizeIcd11, toConcept } from "../../lib/hie/icd";

test("facility level is read from text", () => {
  assert.equal(parseKephLevel("Level 4"), 4);
  assert.equal(parseKephLevel("KEPH 5"), 5);
  assert.equal(parseKephLevel(6), 6);
  assert.equal(parseKephLevel("Level 1"), null);
  assert.equal(parseKephLevel(""), null);
});

test("tariff uses the single overall amount, else the facility level, else the older field", () => {
  assert.equal(tariffFor({ overallTariff: 800, level4Tariff: 500 }, 4), 800);
  assert.equal(tariffFor({ overallTariff: 0, level4Tariff: 500, level5Tariff: 700 }, 4), 500);
  assert.equal(tariffFor({ level5Tariff: 700 }, 4), null);
  assert.equal(tariffFor({ kephLevelTarriff: 650 }, null), 650);
  assert.equal(tariffFor({}, 4), null);
});

test("preauth form follows the intervention flags", () => {
  assert.equal(preauthKindOf({ needsPreauth: false, requiresSurgicalPreauth: true }), null);
  assert.equal(preauthKindOf({ needsPreauth: true }), "normal");
  assert.equal(preauthKindOf({ needsPreauth: true, requiresSurgicalPreauth: true }), "surgical");
  assert.equal(preauthKindOf({ needsPreauth: true, requiresOncologyPreauth: true }), "oncology");
  assert.equal(preauthKindOf({ needsPreauth: true, requiresRenalPreauth: true }), "renal");
  assert.equal(preauthKindOf({ needsPreauth: true, requiresRadiologyPreauth: true }), "imaging");
  assert.equal(preauthKindOf({ needsPreauth: true, requiresOpticalPreauth: true }), "optical");
});

test("the eight integration scenarios are recognised from the flags", () => {
  const f = (i: object) => flowOf({ code: "SHA-19-404", ...i });
  assert.deepEqual([f({ accessPoint: "IP", paymentMechanism: "PER_DIEM" }).scenario, f({ accessPoint: "IP", paymentMechanism: "PER_DIEM" }).dispatch], ["ip_per_diem", "discharge"]);
  assert.equal(f({ accessPoint: "IP", paymentMechanism: "FEE_FOR_SERVICE", needsPreauth: true }).scenario, "ip_ffs_normal_preauth");
  assert.equal(f({ accessPoint: "IP", paymentMechanism: "FEE_FOR_SERVICE", needsPreauth: true, needsManualPreauthApproval: true }).scenario, "ip_ffs_elective_preauth");
  assert.equal(f({ accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", needsPreauth: true, needsManualPreauthApproval: true }).scenario, "op_ffs_elective_preauth");
  const opNormal = f({ accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE", needsPreauth: true });
  assert.deepEqual([opNormal.scenario, opNormal.serviceType, opNormal.dispatch, opNormal.elective], ["op_ffs_normal_preauth", "OUTPATIENT", "submit", false]);
  const cap = f({ accessPoint: "OP", paymentMechanism: "CAPITATION" });
  assert.deepEqual([cap.scenario, cap.serviceType, cap.preauth], ["capitation", "CAPITATION", null]);
  const emergency = flowOf({ code: "SHA-01-005", accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE" });
  assert.deepEqual([emergency.scenario, emergency.serviceType], ["emergency", "EMERGENCY"]);
  assert.equal(f({ accessPoint: "OP", paymentMechanism: "FEE_FOR_SERVICE" }).scenario, "op_ffs");
  assert.equal(f({ accessPoint: "OP/IP", paymentMechanism: "FEE FOR SERVICE" }).serviceType, null);
  assert.equal(f({ accessPoint: "IP", paymentMechanism: "Per Diem" }).perDiem, true);
});

test("emergency codes belong to the SHA-01 family", () => {
  assert.equal(isEmergencyCode("SHA-01-005"), true);
  assert.equal(isEmergencyCode("SHA-10-005"), false);
});

test("emergency claims have a 24 hour window", () => {
  const start = "2026-11-20T08:00:00.000Z";
  assert.equal(emergencyDeadline(start), "2026-11-21T08:00:00.000Z");
  assert.equal(hoursLeft(emergencyDeadline(start), Date.parse("2026-11-20T20:00:00.000Z")), 12);
  assert.ok(hoursLeft(emergencyDeadline(start), Date.parse("2026-11-21T09:00:00.000Z")) < 0);
});

test("claim status prefers the payer's answer, then the hospital workflow, then the visit authorisation", () => {
  assert.equal(claimStatus({ workflowState: "SUBMITTED", payerState: "PAID" }).label, "Paid");
  assert.equal(claimStatus({ workflowState: "SUBMITTED", payerState: "IN_REVIEW" }).label, "Under review");
  assert.equal(claimStatus({ workflowState: "SUBMITTED", payerState: "SENT_BACK" }).tone, "warn");
  assert.equal(claimStatus({ workflowState: "SUBMITTED" }).label, "Submitted");
  assert.equal(claimStatus({ workflowState: "FAILED_TO_SUBMIT" }).tone, "bad");
  assert.equal(claimStatus({ workflowState: "DRAFT", authStatus: "AUTHORIZED" }).label, "Visit open");
  assert.equal(claimStatus({ workflowState: "DRAFT", authStatus: "AUTHORIZED_PENDING_VISIT" }).label, "Awaiting visit");
  assert.equal(claimStatus({ authStatus: "REJECTED" }).tone, "bad");
  assert.equal(claimStatus({}).label, "Draft");
  assert.equal(claimStatus({ workflowState: "CLOSED", authStatus: "CLOSED" }).label, "Closed");
});

test("preauth statuses", () => {
  assert.equal(preauthStatus("FINALISED").label, "Approved");
  assert.equal(preauthApproved("FINALISED"), true);
  assert.equal(preauthApproved("ACTIVE"), false);
  assert.equal(preauthStatus("PENDING_DOCTOR_APPROVAL").label, "Waiting for doctor");
  assert.equal(preauthStatus(undefined).label, "Not started");
  assert.equal(preauthStatus("SOMETHING_NEW").label, "Something new");
});

test("ICD-11 codes are tidied and shape checked", () => {
  assert.equal(normalizeIcd11(" CA07.0 "), "ca07.0");
  assert.equal(isIcd11("CA07.0"), true);
  assert.equal(isIcd11("1A00"), true);
  assert.equal(isIcd11("ME24.9Z"), true);
  assert.equal(isIcd11("malaria"), false);
  assert.equal(isIcd11("A"), false);
  assert.equal(isIcd11(""), false);
});

test("terminology concepts of different shapes", () => {
  assert.deepEqual(toConcept({ id: "CA07.0", display_name: "Acute upper respiratory infection" }), { code: "CA07.0", name: "Acute upper respiratory infection" });
  assert.deepEqual(toConcept({ code: "X1", name: "Thing" }), { code: "X1", name: "Thing" });
  assert.equal(toConcept({}), null);
});
