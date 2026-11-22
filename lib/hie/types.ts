/** Shapes and value lists for the Kenya HIE middleware, taken from https://hie-docs.dha.go.ke/. Response objects are large, so only fields the system reads are typed. */

export const ID_TYPES = [
  { value: "ClientRegistry ID", label: "SHA number (Client Registry ID)" },
  { value: "National ID", label: "National ID" },
  { value: "Birth Notification", label: "Birth notification" },
  { value: "Birth Certificate", label: "Birth certificate" },
  { value: "Alien ID", label: "Alien ID" },
  { value: "Refugee ID", label: "Refugee ID" },
  { value: "Mandate Number", label: "Mandate number" },
] as const;
export type IdType = (typeof ID_TYPES)[number]["value"];

export const SERVICE_TYPES = ["CAPITATION", "OUTPATIENT", "INPATIENT", "EMERGENCY"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const REGULATORS = ["KMPDC", "COC", "NCK", "PPB"] as const;
export type Regulator = (typeof REGULATORS)[number];

export const PRACTITIONER_ID_TYPES = ["registration_number", "National ID", "Alien ID", "Refugee ID"] as const;
export type PractitionerIdType = (typeof PRACTITIONER_ID_TYPES)[number];

/** Reasons for ending an outpatient visit. DECEASED exists only on the inpatient discharge. */
export const OUTPATIENT_REASONS = ["RECOVERED", "REFERRED", "ABSCONDED", "OTHER"] as const;
export const INPATIENT_REASONS = ["RECOVERED", "REFERRED", "DECEASED", "ABSCONDED", "OTHER"] as const;
export type DischargeReason = (typeof INPATIENT_REASONS)[number];

export const CLOSE_REASONS = ["WRONG_PATIENT", "NO_SERVICE_GIVEN", "WRONG_BENEFIT", "EXPIRED_VISIT", "EXHAUSTED_BENEFIT", "TIME_BARRED", "OTHER_REASONS"] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const MODES_OF_ARRIVAL = ["AMBULANCE", "WALK-IN", "OTHER"] as const;
export const BROUGHT_BY = ["RELATIVE", "UNKNOWN", "SAMARITAN", "PARAMEDICS"] as const;

export const PREAUTH_KINDS = ["normal", "surgical", "oncology", "renal", "imaging", "optical"] as const;
export type PreauthKind = (typeof PREAUTH_KINDS)[number];

export const DOCUMENT_TYPES = [
  "BIOPSY_RESULT", "CASE_NOTES_JUSTIFYING_ADMISSION", "CASE_NOTES_INDICATING_NEED_FOR_DEVICE", "CASE_SUMMARY", "CLINICAL_DOCUMENTATION",
  "CRITICAL_CARE_UNIT_CASE_NOTES", "CONSULTANT_REPORT", "DIAGNOSTIC_REQUESTS", "DIALYSIS_CHART", "DISCHARGE_SUMMARY", "FINAL_BILL", "INTERIM_BILL",
  "HISTOPATHOLOGY_RESULTS", "IMAGING_ORDER", "IMAGING_RESULT", "KMPDC_FORM", "LOU", "LAB_ORDER", "LAB_RESULTS", "LAB_TESTS", "MEDICAL_REPORT",
  "PRESCRIPTION", "PRIOR_BASIC_DIAGNOSTIC_IMAGES", "PROFORMA_INVOICE", "RADIOLOGICAL_EXAM", "RADIOLOGY_REQUEST", "REFERRAL_LETTER", "RHESUS_FACTOR",
  "SHA_REFERRAL_FOR_OVERSEAS_TREATMENT_FORM", "STAGING_RESULTS", "TREATMENT_PLAN", "THEATRE_LIST", "ULTRASOUND", "PREAUTH_FORM", "OTHER",
] as const;

export type Page<T> = { count?: number; currentPage?: number; totalPages?: number; next?: string | null; results?: T[] };

export interface CrPatient {
  id?: string; first_name?: string; middle_name?: string; last_name?: string; gender?: string; date_of_birth?: string; phone?: string;
  identification_number?: string; identification_type?: string; deceased_datetime?: string; county?: string;
  [k: string]: unknown;
}

export interface Scheme {
  schemeId?: number; schemeName?: string; memberType?: string;
  coverage?: { status?: string; startDate?: string; endDate?: string; message?: string; reason?: string; possibleSolution?: string };
  policy?: { number?: string; startDate?: string; endDate?: string };
  principalContributor?: { crNumber?: string; name?: string; relationship?: string };
}
export interface Eligibility {
  fullName?: string; gender?: string; age?: number; dateOfBirth?: string; memberCrNumber?: string; isAlive?: boolean;
  statusCode?: string; statusDesc?: string; whitelistedForOTP?: boolean; facilityBiometricsEnforced?: boolean; schemes?: Scheme[];
  [k: string]: unknown;
}

export interface SubBenefit {
  code?: string; name?: string; fund?: string; accessPoint?: string; parentBenefit?: string; parentBenefitCode?: string; status?: string; active?: boolean;
  [k: string]: unknown;
}

export interface Intervention {
  code?: string; name?: string; accessPoint?: string; paymentMechanism?: string; fund?: string; status?: string; active?: boolean;
  parentBenefitCode?: string; benefitCode?: string; benefitName?: string; complexity?: string;
  needsPreauth?: boolean; needsManualPreauthApproval?: boolean; needsDoctorAuthorization?: boolean;
  requiresSurgicalPreauth?: boolean; requiresOncologyPreauth?: boolean; requiresRenalPreauth?: boolean; requiresRadiologyPreauth?: boolean; requiresOpticalPreauth?: boolean;
  level2Tariff?: number; level3Tariff?: number; level4Tariff?: number; level5Tariff?: number; level6Tariff?: number; overallTariff?: number; kephLevelTarriff?: number;
  applicableDocumentTypes?: string[]; optionalDocumentTypes?: string[]; requiredPreauthDocumentTypes?: string[]; numberOfDoctorsRequired?: number;
  [k: string]: unknown;
}

export interface Contact { id: number; contactValue?: string; contactType?: string; isConfirmed?: boolean; active?: boolean }

/** The claim object returned by visit, close, discharge, submit and emergency calls. */
export interface HieClaim {
  claim_id?: number; authorization_code?: string; authorization_guid?: string; claim_auth_status?: string; workflow_state?: string;
  visit_number?: string; invoice_number?: string; service_type?: string; total_claim_amount?: number; total_claim_net_amount?: number;
  edi_claim_guid?: string; visit_start?: string; visit_end?: string; discharge_reason?: string; patient_name?: string; member_number?: string;
  interventions?: Record<string, any>[]; claim_diagnoses?: Record<string, any>[]; invoices?: Record<string, any>[]; claim_doctors?: Record<string, any>[]; claim_attachments?: Record<string, any>[];
  [k: string]: unknown;
}

export interface HiePreauth {
  id?: number; guid?: string; status?: string; interventionCode?: string; token?: string; isElective?: boolean; needsDoctorApproval?: boolean;
  doctorReviewStatus?: string; finalApprovedAmount?: number; totalEstimatedAmountForPreauth?: number; preauthType?: string;
  preauthNotes?: { note?: string; message?: string; [k: string]: unknown }[];
  [k: string]: unknown;
}

export interface Authorization {
  token?: string; guid?: string; status?: string; authCode?: string; expiry?: string; isElective?: boolean; needsPreauth?: boolean;
  [k: string]: unknown;
}

export interface AttachmentInput { title: string; type: string; filename: string; bytes: Uint8Array; contentType?: string }

export interface DoctorInput { identificationNumber: string; identificationType?: PractitionerIdType; regulationBody: Regulator; isPrimary?: boolean }

export interface PreauthItem { name?: string; unitPrice: number; quantity?: number; chargeDate?: string }

export interface PreauthInput {
  kind: PreauthKind; consentToken: string; interventionCode: string; serviceStart: string; serviceEnd: string; providerEmail: string;
  items: PreauthItem[]; diagnoses: string[]; doctors: DoctorInput[]; attachments?: AttachmentInput[]; isCoInsured?: boolean;
  surgical?: {
    surgeryDate: string; chiefComplaint: string; vitalSigns: string; historyOfPresentIllness: string; physicalExamination: string; investigationReportDetails: string;
    typeOfAnaesthesia: "General Anaesthesia" | "Local Anaesthesia" | "Spinal Anaesthesia" | "Sedation";
    relatedToEmployment?: boolean; relatedToAccident?: boolean; coInsuranceDetails?: string;
  };
  oncology?: { carcinomaStaging: "Stage 1" | "Stage 2" | "Stage 3" | "Stage 4"; comorbidity: string; metastases: string; progressReport?: string; treatmentSetting: string; startDate: string; numberOfSessions: number; costPerSession: number };
  renal?: { startDate: string; sessionsRequired: number; frequency: string; clinicalIndications: "End-Stage renal disease" | "Acute kidney failure" | "Other" };
  imaging?: { clinicalIndications: string };
  optical?: { clinicalIndications: string; necessityOfService: string; newOrReplacement?: "New" | "Replacement"; lensPrescription?: "Framed" | "Contact"; eyeExaminationAmount?: string; frameAmount?: string; lensAmount?: string };
}

export const SURGICAL_ANAESTHESIA = ["General Anaesthesia", "Local Anaesthesia", "Spinal Anaesthesia", "Sedation"] as const;
export const CARCINOMA_STAGES = ["Stage 1", "Stage 2", "Stage 3", "Stage 4"] as const;
export const RENAL_FREQUENCIES = ["Twice a week", "Once a week", "One time every 2 weeks", "One time every 3 weeks", "One a month"] as const;
export const RENAL_INDICATIONS = ["End-Stage renal disease", "Acute kidney failure", "Other"] as const;
export const TREATMENT_SETTINGS = ["Day ward", "Reclining chair", "Side room"] as const;
