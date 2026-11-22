import type { HieClient } from "./client";
import type {
  AttachmentInput, Authorization, Contact, CrPatient, DischargeReason, DoctorInput, Eligibility, HieClaim, HiePreauth, IdType, Intervention, Page,
  PractitionerIdType, PreauthInput, Regulator, ServiceType, SubBenefit,
} from "./types";

/** Money goes to SHA as text with two decimals. */
export const money = (n: number | string) => (Math.round(Number(n) * 100) / 100).toFixed(2);

const text = (v: unknown) => (typeof v === "boolean" ? String(v) : String(v));

/** Builds a multipart body. Plain values become text parts, objects and arrays become JSON strings. */
export function toForm(fields: Record<string, unknown>, files: { field: string; filename: string; bytes: Uint8Array; type?: string }[] = []): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    f.append(k, typeof v === "object" ? JSON.stringify(v) : text(v));
  }
  for (const file of files) f.append(file.field, new Blob([file.bytes as BlobPart], { type: file.type || "application/octet-stream" }), file.filename);
  return f;
}

/** The attachments metadata array plus the binary parts it points at. Part names only need to match file_field_name. */
function attachmentParts(list: AttachmentInput[] = [], prefix = "attachments") {
  const meta = list.map((a, i) => ({ document_title: a.title, document_type: a.type, file_field_name: `${prefix}_${i}_file_blob` }));
  const files = list.map((a, i) => ({ field: `${prefix}_${i}_file_blob`, filename: a.filename, bytes: a.bytes, type: a.contentType }));
  return { meta, files };
}

const doctorJson = (d: DoctorInput, intervention?: string) => ({
  identification_number: d.identificationNumber,
  identification_type: d.identificationType || "registration_number",
  regulation_body: d.regulationBody,
  ...(intervention ? { intervention_code: intervention } : {}),
  ...(d.isPrimary !== undefined ? { is_primary: d.isPrimary } : {}),
});

/** Multipart body for POST /preauths. The six preauth forms share one endpoint and differ only in their extra clinical fields. */
export function buildPreauthForm(p: PreauthInput): FormData {
  const att = attachmentParts(p.attachments);
  const base: Record<string, unknown> = {
    consent_token: p.consentToken,
    intervention_code: p.interventionCode,
    service_start: p.serviceStart,
    service_end: p.serviceEnd,
    provider_notification_email: p.providerEmail,
    items: p.items.map((i) => ({ ...(i.name ? { name: i.name } : {}), unit_price: money(i.unitPrice), ...(i.quantity !== undefined ? { quantity: money(i.quantity) } : {}), ...(i.chargeDate ? { charge_date: i.chargeDate } : {}) })),
    diagnoses: p.diagnoses.map((icd) => ({ consent_token: p.consentToken, icd_code: icd })),
    doctors: p.doctors.map((d) => doctorJson(d, p.interventionCode)),
    attachments: att.meta,
    ...(p.isCoInsured !== undefined ? { is_co_insured: p.isCoInsured } : {}),
  };
  if (p.kind === "surgical" && p.surgical) {
    const s = p.surgical;
    Object.assign(base, {
      surgery_date: s.surgeryDate, chief_complaint: s.chiefComplaint, vital_signs: s.vitalSigns, history_of_present_illness: s.historyOfPresentIllness,
      physical_examination: s.physicalExamination, investigation_report_details: s.investigationReportDetails, type_of_anaesthesia: s.typeOfAnaesthesia,
      is_condition_related_to_employment: s.relatedToEmployment ?? false, is_condition_related_to_auto_or_other_accident: s.relatedToAccident ?? false,
      co_insurance_details: s.coInsuranceDetails,
    });
  } else if (p.kind === "oncology" && p.oncology) {
    const o = p.oncology;
    Object.assign(base, {
      carcinoma_staging: o.carcinomaStaging, comorbidity: o.comorbidity, metastases: o.metastases, progress_report: o.progressReport, treatment_setting: o.treatmentSetting,
      start_date: o.startDate, number_of_sessions: o.numberOfSessions, cost_per_session: money(o.costPerSession),
    });
  } else if (p.kind === "renal" && p.renal) {
    const r = p.renal;
    Object.assign(base, { start_date: r.startDate, number_of_sessions_required: r.sessionsRequired, frequency_of_sessions: r.frequency, clinical_indications: r.clinicalIndications });
  } else if (p.kind === "imaging" && p.imaging) {
    Object.assign(base, { clinical_indications: p.imaging.clinicalIndications });
  } else if (p.kind === "optical" && p.optical) {
    const o = p.optical;
    Object.assign(base, {
      clinical_indications: o.clinicalIndications, necessity_of_service: o.necessityOfService, new_or_replacement: o.newOrReplacement, lens_prescription: o.lensPrescription,
      eye_examination_amount: o.eyeExaminationAmount, frame_amount: o.frameAmount, lens_amount: o.lensAmount,
    });
  }
  return toForm(base, att.files);
}

export type LineInput = {
  consentToken: string; interventionCode: string; unitPrice: number; quantity: number; serviceName?: string; serviceIdentifier?: string;
  diagnoses?: string[]; attachments?: AttachmentInput[]; practitioner?: { identificationNumber: string; identificationType?: PractitionerIdType; regulationBody: Regulator };
};

const practitionerFields = (p?: LineInput["practitioner"]) =>
  p ? { practitioner_identification_number: p.identificationNumber, practitioner_identification_type: p.identificationType || "registration_number", practitioner_regulation_body: p.regulationBody } : {};

export type EmergencyInput = {
  interventionCode: string; modeOfArrival: string; broughtBy: string; referenceNumber: string; notes?: string;
  doctor: { identificationNumber: string; identificationType?: PractitionerIdType; regulationBody: Regulator };
  /** Identified patients send their client registry id and the OTP they received. Unidentified patients send neither. */
  patient?: { crId: string; otp: string };
};

/** One place for every endpoint the system uses. Paths and field names follow https://hie-docs.dha.go.ke/. */
export function hieApi(c: HieClient) {
  return {
    // ---- registries
    searchPatient: (p: { identificationNumber: string; identificationType: IdType }) =>
      c.get<CrPatient>("/patients", { identification_number: p.identificationNumber, identification_type: p.identificationType }),
    searchFacility: (p: { identifier?: string; identifierType?: string; name?: string }) =>
      c.get<Record<string, any>>("/facilities/search", { identifier: p.identifier, "identifier-type": p.identifierType, name: p.name }),
    searchProfessional: (p: { identificationNumber: string; identificationType?: PractitionerIdType; regulator?: Regulator }) =>
      c.get<Record<string, any>>("/professionals", { identification_number: p.identificationNumber, identification_type: p.identificationType || "registration_number", regulator: p.regulator }),

    // ---- eligibility and coverage
    eligibility: (p: { identificationNumber: string; identificationType: IdType }) =>
      c.get<Eligibility>("/patients/eligibility", { identification_number: p.identificationNumber, identification_type: p.identificationType }),
    benefits: (crId: string) => c.get<Page<{ parentBenefit?: string; parentBenefitCode?: string }>>("/patients/benefits", { patient_id: crId }),
    subBenefits: (crId: string, parentBenefitCode?: string) => c.get<Page<SubBenefit>>("/patients/sub-benefits", { patient_id: crId, parent_benefit_code: parentBenefitCode }),
    interventions: (crId: string, q: { subBenefitCode?: string; accessPoint?: string; search?: string; code?: string; page?: number; pageSize?: number } = {}) =>
      c.get<Page<Intervention>>("/patients/benefits/interventions", {
        patient_id: crId, sub_benefit_code: q.subBenefitCode, access_point: q.accessPoint, search: q.search, code: q.code, page: q.page, page_size: q.pageSize,
      }),
    utilization: (crId: string, interventionCode: string) => c.get<Record<string, any>>("/patients/benefits/utilization", { patient_id: crId, intervention_code: interventionCode }),

    // ---- consent
    contacts: (crId: string) => c.get<Page<Contact>>("/patients/contacts", { patient_id: crId }),
    sendOtp: (p: { crId: string; interventionCodes: string[]; contactId?: number }) =>
      c.post("/claims/otp", { patient_id: p.crId, intervention_codes: p.interventionCodes, ...(p.contactId ? { contact_id: p.contactId } : {}) }, { idempotent: true }),
    sendDischargeOtp: (p: { consentToken: string; crId: string }) => c.post("/claims/otp/discharge", { consent_token: p.consentToken, patient_id: p.crId }, { idempotent: true }),
    /** Pre visit consent for elective services. The returned token is the consent_token for the preauth. */
    authorize: (p: { crId: string; serviceType: "OUTPATIENT" | "INPATIENT"; otp: string; interventionCodes: string[] }) =>
      c.post<Authorization>("/claims/authorize", { patient_id: p.crId, service_type: p.serviceType, otp: p.otp, interventions: p.interventionCodes }),
    authorizations: (q: { token?: string; crId?: string; guid?: string }) => c.get<Page<Authorization> | Authorization[]>("/claims/authorizations", { token: q.token, patient_id: q.crId, guid: q.guid }),

    // ---- visits and interventions
    createVisit: (p: { interventionCodes: string[]; crId: string; serviceType: ServiceType; otp: string; practitioner?: LineInput["practitioner"] }) =>
      c.post<HieClaim>("/claims/visit", { intervention_codes: p.interventionCodes, patient_id: p.crId, service_type: p.serviceType, otp: p.otp, ...practitionerFields(p.practitioner) }),
    addIntervention: (consentToken: string, code: string) => c.post("/claims/interventions", { consent_token: consentToken, intervention_code: code }),
    retireIntervention: (consentToken: string, code: string) => c.post("/claims/interventions/retire", { consent_token: consentToken, intervention_code: code }),
    restoreIntervention: (consentToken: string, code: string) => c.post("/claims/interventions/restore", { consent_token: consentToken, intervention_code: code }),
    switchIntervention: (p: { consentToken: string; from: string; to: string; retainBillItems: boolean; billFrom?: string; billTo?: string }) =>
      c.post("/claims/interventions/switch", { consent_token: p.consentToken, existing_intervention_code: p.from, new_intervention_code: p.to, retain_bill_items: p.retainBillItems, ...(p.billFrom ? { bill_from: p.billFrom } : {}), ...(p.billTo ? { bill_to: p.billTo } : {}) }),

    // ---- preauthorisations
    createPreauth: (p: PreauthInput) => c.postForm<HiePreauth>("/preauths", buildPreauthForm(p)),
    getPreauth: (consentToken: string) => c.get<HiePreauth | Page<HiePreauth> | HiePreauth[]>("/preauths", { consent_token: consentToken }),
    cancelPreauth: (consentToken: string, interventionCode: string) => c.post<HiePreauth>("/preauths/cancel", { consent_token: consentToken, intervention_code: interventionCode }),
    removePreauthDiagnosis: (consentToken: string, interventionCode: string, icd: string) =>
      c.delete(`/preauths/diagnoses/${encodeURIComponent(icd)}`, { consent_token: consentToken, icd_code: icd, intervention_code: interventionCode }),
    removePreauthDoctor: (consentToken: string, interventionCode: string, registrationNumber: string) =>
      c.delete("/preauths/doctors", { consent_token: consentToken, intervention_code: interventionCode, practitioner_registration_number: registrationNumber }),
    resendDoctorConsent: (p: { consentToken: string; interventionCode: string; practitionerRegistrationNumber: string; emergency?: boolean }) =>
      c.post("/claims/doctor-consent", {
        practitioner_registration_number: p.practitionerRegistrationNumber, consent_token: p.consentToken, intervention_code: p.interventionCode,
        request_type: p.emergency ? "EMERGENCY_CLAIM_DOCTOR_APPROVAL_REQUEST" : "PREAUTH_DOCTOR_APPROVAL_REQUEST",
      }, { idempotent: true }),

    // ---- billing
    /** A plain line goes as JSON. With diagnoses or attachments it goes as multipart, as the combined billing call. */
    addLine: (l: LineInput) => {
      const common = {
        consent_token: l.consentToken, intervention_code: l.interventionCode, unit_price: money(l.unitPrice), quantity: String(l.quantity),
        service_name: l.serviceName, service_identifier: l.serviceIdentifier, ...practitionerFields(l.practitioner),
      };
      if (!l.diagnoses?.length && !l.attachments?.length) return c.post<Record<string, any>>("/claims/lines", common);
      const att = attachmentParts(l.attachments);
      return c.postForm<Record<string, any>>("/claims/lines", toForm({ ...common, diagnoses: (l.diagnoses || []).map((icd_code) => ({ icd_code })), attachments: att.meta }, att.files));
    },
    removeLine: (consentToken: string, lineGuid: string) => c.patch("/claims/lines", { consent_token: consentToken, line_guid: lineGuid }),
    addDiagnosis: (p: { consentToken: string; icd: string; interventionCode: string; practitioner?: LineInput["practitioner"] }) =>
      c.post("/claims/diagnoses", { consent_token: p.consentToken, icd_code: p.icd, intervention_code: p.interventionCode, ...practitionerFields(p.practitioner) }),
    removeDiagnosis: (consentToken: string, interventionCode: string, icd: string) => c.patch("/claims/diagnoses", { consent_token: consentToken, icd_code: icd, intervention_code: interventionCode }),
    addAttachment: (p: { consentToken: string; interventionCode: string; type: string; file: AttachmentInput }) =>
      c.postForm("/claims/attachments", toForm({ consent_token: p.consentToken, document_type: p.type, intervention_code: p.interventionCode }, [{ field: "file_blob", filename: p.file.filename, bytes: p.file.bytes, type: p.file.contentType }])),
    removeAttachment: (consentToken: string, interventionCode: string, attachmentId: string) => c.patch("/claims/attachments", { consent_token: consentToken, intervention_code: interventionCode, attachment_id: attachmentId }),
    preview: (consentToken: string) => c.post<HieClaim>("/claims/preview", { consent_token: consentToken }, { idempotent: true }),
    previewPayer: (q: { guid?: string; providerClaimNo?: string }) => c.get<Page<Record<string, any>>>("/claims/preview/payer", { guid: q.guid, provider_claim_no: q.providerClaimNo }),

    // ---- dispatch
    /** Outpatient, capitation and emergency claims end here. */
    submitClaim: (p: { consentToken: string; invoiceNumber: string; reason: Exclude<DischargeReason, "DECEASED">; otp?: string; dischargeAuthGuid?: string; contactId?: string; partial?: boolean; notes?: string; reasonForUnknownPatient?: string }) =>
      c.post<HieClaim>("/claims/submit", {
        consent_token: p.consentToken, invoice_number: p.invoiceNumber, discharge_reason: p.reason, ...(p.otp ? { otp: p.otp } : {}),
        ...(p.dischargeAuthGuid ? { discharge_auth_guid: p.dischargeAuthGuid } : {}), ...(p.contactId ? { beneficiary_contact_id: p.contactId } : {}),
        ...(p.partial ? { discharge_status: "PARTIAL" } : {}), ...(p.notes ? { notes: p.notes } : {}), ...(p.reasonForUnknownPatient ? { reason_for_unknown_patient: p.reasonForUnknownPatient } : {}),
      }),
    /** Inpatient claims are discharged, which also submits them. */
    dischargeInpatient: (p: { consentToken: string; invoiceNumber: string; reason: DischargeReason; dischargeDate: string; otp?: string; dischargeAuthGuid?: string }) =>
      c.post<HieClaim>("/claims/discharge", {
        consent_token: p.consentToken, invoice_number: p.invoiceNumber, discharge_reason: p.reason, discharge_date: p.dischargeDate,
        ...(p.otp ? { otp: p.otp } : {}), ...(p.dischargeAuthGuid ? { discharge_auth_guid: p.dischargeAuthGuid } : {}),
      }),
    closeClaim: (p: { consentToken: string; reasonType: string; reasonText: string }) => c.post<HieClaim>("/claims/close", { consent_token: p.consentToken, cancel_reason_type: p.reasonType, cancel_reason_text: p.reasonText }),

    // ---- emergency (ECCIF)
    createEmergencyClaim: (e: EmergencyInput) =>
      c.post<HieClaim>("/claims/emergency", {
        interventions: [e.interventionCode], mode_of_arrival: e.modeOfArrival, brought_by: e.broughtBy, reference_number: e.referenceNumber,
        identification_number: e.doctor.identificationNumber, identification_type: e.doctor.identificationType || "registration_number", regulation_body: e.doctor.regulationBody,
        ...(e.patient ? { beneficiary_cr_id: e.patient.crId, otp: e.patient.otp } : {}), ...(e.notes ? { notes: e.notes } : {}),
      }),
    /** Names the patient on an emergency claim that was started without an identity. */
    identifyEmergencyPatient: (e: EmergencyInput & { consentToken: string; patient: { crId: string; otp: string } }) =>
      c.post<HieClaim>("/claims/emergency", {
        interventions: [e.interventionCode], mode_of_arrival: e.modeOfArrival, brought_by: e.broughtBy, reference_number: e.referenceNumber,
        identification_number: e.doctor.identificationNumber, identification_type: e.doctor.identificationType || "registration_number", regulation_body: e.doctor.regulationBody,
        beneficiary_cr_id: e.patient.crId, otp: e.patient.otp, consent_token: e.consentToken,
      }),
    emergencyProtocols: (interventionCode: string) => c.get<Page<Record<string, any>>>("/claims/emergency/protocols", { intervention_code: interventionCode, active: "true" }),
    addEmergencyProtocol: (p: { consentToken: string; protocolCode: string; interventionCode: string; unitPrice: number; quantity: number; diagnoses?: string[]; attachments?: AttachmentInput[] }) => {
      const common = { consent_token: p.consentToken, protocol_code: p.protocolCode, intervention_code: p.interventionCode, unit_price: money(p.unitPrice), quantity: String(p.quantity) };
      if (!p.diagnoses?.length && !p.attachments?.length) return c.post<Record<string, any>>("/claims/emergency/protocols", common);
      const att = attachmentParts(p.attachments);
      return c.postForm<Record<string, any>>("/claims/emergency/protocols", toForm({ ...common, diagnoses: (p.diagnoses || []).map((icd_code) => ({ icd_code })), attachments: att.meta }, att.files));
    },
    addClaimDoctor: (consentToken: string, d: { identificationNumber: string; identificationType?: PractitionerIdType; regulationBody: Regulator }) =>
      c.post("/claims/doctors", { consent_token: consentToken, identification_number: d.identificationNumber, identification_type: d.identificationType || "registration_number", regulation_body: d.regulationBody }),
    removeClaimDoctor: (consentToken: string) => c.delete("/claims/doctors", { consent_token: consentToken }),

    // ---- terminology
    searchConcepts: (q: { owner: string; source?: string; collection?: string; search?: string; limit?: number; offset?: number }) =>
      c.get<Page<Record<string, any>>>("/clinical/concepts", { owner: q.owner, source: q.source, collection: q.collection, search: q.search, limit: q.limit, offset: q.offset }),
  };
}

export type HieApi = ReturnType<typeof hieApi>;
