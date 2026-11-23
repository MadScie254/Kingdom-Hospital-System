import { SITE } from "./site";

/**
 * Everything the public page says, as data. `tests/site-copy.test.ts` walks every string here, so the house rules are checked in one place:
 * no dashes, no emojis, no prices, no outcome claims, no "best", and any phone number or email is the one in `lib/site.ts`.
 * Facts come from the owner, the hospital's old site and the public facility listing. Nothing here is invented.
 */

export type ChartRow = { text: string; acuity: string; href?: string; marker?: "24h" };

export const HERO = {
  /** Read straight after the first row by screen readers and search engines, so the heading says which hospital it is. */
  titleRest: "at Kingdom Faith Based Hospital, Webuye",
  /** The rows of the eye chart, largest first. The acuity labels are the ones on a real chart. */
  rows: [
    { text: "Eye care", acuity: "20/200" },
    { text: "Cataract surgery", acuity: "20/100" },
    { text: "Dental clinic", acuity: "20/70" },
    { text: "Operating theatre", acuity: "20/50" },
    { text: "Wards and clinics", acuity: "20/40" },
    { text: "Open 24 hours, every day", acuity: "20/30", marker: "24h" },
    { text: SITE.phoneDisplay, acuity: "20/20", href: `tel:${SITE.phoneTel}` },
  ] satisfies ChartRow[],
  lead: "Cataract surgery, dental, theatre, inpatient and outpatient care, open 24 hours.",
  place: "Malaha Shopping Centre, Webuye, Bungoma County",
  call: `Call ${SITE.phoneDisplay}`,
  directions: "Get directions",
} as const;

export const FACTS = [
  { title: "Open 24 hours", text: `Day or night, any day of the week. Call ${SITE.phoneDisplay} at any hour.` },
  { title: "SHA members welcome", text: "Ask at reception about other ways to pay." },
  { title: "Inpatient and outpatient", text: "See a doctor or clinical officer for a check up, or stay on the ward when you need more care." },
  { title: "Faith based", text: "Rooted in Christian faith, open to everyone." },
] as const;

export const COPY = {
  facts: { label: "At a glance" },
  services: { title: "Our services", intro: "Open a group to see what it includes." },
  eye: {
    title: "Eye care and cataract surgery",
    intro: "We test sight, treat eye problems and operate on cataracts, all in one hospital.",
    sliderCaption: "Drag the slider to compare clouded and clear sight. The picture only shows the effect.",
    signsTitle: "Signs of a cataract",
    stepsTitle: "What to expect",
    surgeryCaption: "Eye surgery in our operating theatre.",
  },
  about: {
    title: "About the hospital",
    flowTitle: "When you come to the hospital",
    groundsCaption: "The hospital grounds at Malaha.",
    buildingCaption: "The hospital at Malaha.",
  },
  insurance: { title: "Insurance and payment" },
  visit: {
    title: "Visit us",
    addressLabel: "Address",
    hoursLabel: "Hours",
    callLabel: "Call",
    emailLabel: "Email",
    facebookLabel: "Facebook",
    facebookText: "Kingdom Faith Based Hospital on Facebook",
    findTitle: "How to find us",
  },
  doors: {
    title: "Sign in",
    intro: "For hospital staff and administrators. Patients do not need an account.",
    request: "New staff member? Request access",
  },
  footer: {
    tagline: "Rooted in Christian faith, open to everyone.",
    photos: "Hospital photos by Kingdom Faith Based Hospital.",
    portal: "Staff sign in",
  },
} as const;

export type ServiceGroup = { id: string; title: string; summary: string; items: string[]; detail: string };

export const SERVICE_GROUPS: readonly ServiceGroup[] = [
  {
    id: "eye",
    title: "Eye care",
    summary: "Eye clinic, cataract surgery, sight tests and spectacles.",
    items: [
      "Eye clinic for blurred sight, sore eyes and other eye problems",
      "Cataract surgery",
      "Sight tests by our optometrists",
      "Spectacles from the optical shop",
    ],
    detail:
      "In the eye clinic, a clinician examines your eyes and explains what is wrong. If you need an operation, the surgeon plans it with you and it is done in our theatre. After your sight test, the optical shop fits spectacles, with frames to choose from.",
  },
  {
    id: "theatre",
    title: "Operating theatre",
    summary: "A theatre for eye surgery and minor procedures.",
    items: ["Cataract and other eye surgery", "Minor procedures"],
    detail:
      "Operations are done in our own theatre by trained surgeons, with nurses who prepare you and look after you afterwards. Ask at reception, or call us, to find out whether the procedure you need can be done here.",
  },
  {
    id: "dental",
    title: "Dental clinic",
    summary: "Check ups and care for teeth and gums.",
    items: ["Dental check ups", "Care for toothache and gum problems"],
    detail:
      "Come for a check up, or when a tooth or gum hurts. The dentist looks at your mouth, tells you what is wrong and explains the treatment before it starts. Ask at reception which treatments are offered on the day you plan to come.",
  },
  {
    id: "hospital",
    title: "Outpatient and inpatient care",
    summary: "Clinics every day and wards for patients who need to stay.",
    items: [
      "Outpatient clinics, day and night",
      "Inpatient wards",
      "Clinics for long term illness such as high blood pressure and diabetes",
      "Meals cooked for inpatients",
    ],
    detail:
      "Doctors, clinical officers and nurses see outpatients every day. Patients who need more care stay on the ward, where meals are cooked for them. Special clinics follow people living with long term illnesses, such as high blood pressure and diabetes, so they can keep their medicine and check ups going.",
  },
  {
    id: "mother-child",
    title: "Mother and child care",
    summary: "Care for expectant mothers, babies and children.",
    items: ["Care for mothers during pregnancy", "Care for babies and young children"],
    detail:
      "Mothers and children are looked after by nurses and clinicians at the same hospital that is open day and night. Ask at reception about clinic days and what to bring with you.",
  },
  {
    id: "testing",
    title: "HIV and TB testing and treatment",
    summary: "Testing and treatment for HIV and TB.",
    items: ["HIV testing", "HIV treatment and care", "TB testing", "TB treatment"],
    detail:
      "You can ask for an HIV or TB test at the hospital. Staff keep your results private, and if you need treatment they will explain the next steps with you.",
  },
  {
    id: "lab-pharmacy",
    title: "Laboratory and pharmacy",
    summary: "Tests and medicines, with requests sent by computer.",
    items: [
      "Laboratory tests such as malaria, salmonella, brucella, blood sugar, haemoglobin, urine and pregnancy tests",
      "Pharmacy with antibiotics, antimalarial medicine, pain relief and blood pressure medicine",
    ],
    detail:
      "After the doctor sees you, your test request goes to the laboratory and your prescription goes to the pharmacy by computer. You do not carry papers from room to room. Ask the pharmacy whether the medicine you need is in stock.",
  },
];

export const CATARACT = {
  what: "A cataract is a clouding of the lens inside the eye. The lens sits behind the pupil and focuses light so that you can see clearly. When it clouds, light is scattered and sight turns blurred, dim and yellowish, as if you were looking through a dirty window. Cataracts grow slowly, most often with age. Stronger glasses may help for a while, but only an operation removes the cloudy lens.",
  signs: [
    "Blurred, cloudy or dim sight",
    "Colours that look faded or yellow",
    "Glare from sunlight or headlights, and rings around lights",
    "Trouble seeing at night",
    "Needing new glasses again and again",
  ],
  steps: [
    "A clinician examines your eyes to find out whether a cataract is the cause.",
    "The surgeon explains the operation, what to expect and how to prepare.",
    "In our theatre, your eye is numbed, the cloudy lens is taken out and a clear lens is usually put in its place.",
    "You rest and use eye drops as your surgeon advises.",
    "Check ups follow, to see that your eye is healing and to test your sight again.",
  ],
  note: "This guide is general. It does not replace an examination, and every eye is different. Your surgeon will tell you what is right for yours.",
} as const;

export const EYE_URGENT = `Sudden loss of sight, a serious eye injury or severe eye pain cannot wait. Call ${SITE.phoneDisplay} or come straight away.`;

/** The story from the hospital's old site, in the owner's words, tidied. */
export const ABOUT = [
  "Kingdom Faith Based Hospital is a community hospital at Malaha, in Webuye, Bungoma County. We care for the people around us and for those who come from further away.",
  "We are rooted in Christian faith. Our hope is to share the love of Christ with the people we serve, and everyone is welcome here, whatever their faith.",
  "Eye care is our focus. Our aim is to become the referral eye hospital for Bungoma County, and we now have an eye clinic, an optical shop and a theatre for cataract surgery. Alongside eye services we give general care to outpatients and inpatients, with clinics for long term illnesses such as high blood pressure and diabetes.",
] as const;

/** The path of a visit, from the old site. A real sequence, so the page numbers it. */
export const VISIT_FLOW = [
  { title: "Reception", text: "You are welcomed at the gate and at reception. Only basic details are taken, such as your name, age and where you live." },
  { title: "Triage", text: "A nurse checks your vital signs and sends you to a doctor or clinical officer." },
  { title: "Doctor or clinical officer", text: "You are examined and told what is wrong and what to do next. Any tests or medicines are ordered on the computer." },
  { title: "Laboratory and pharmacy", text: "Your test request and prescription reach the laboratory and the pharmacy by computer, so you do not carry papers from room to room." },
] as const;

export const SHA_COPY = [
  "SHA members are welcome at Kingdom Faith Based Hospital. Tell reception that you have SHA when you arrive.",
  "Ask at reception what your SHA cover includes for the care you need, and about other ways to pay.",
  "We do not list prices here, because the cost depends on the care you need.",
] as const;

export const VISIT = {
  how: [
    "Look for Malaha Shopping Centre on the Webuye-Kitale road. The hospital is near Malaha Market.",
    "If you cannot find us, call and someone will help you.",
  ],
  note: `Emergencies cannot wait for a clinic day. Call ${SITE.phoneDisplay} or come straight away, day or night.`,
} as const;

export const META = {
  title: "Kingdom Faith Based Hospital | Eye care in Webuye",
  description: `Eye clinic, cataract surgery, dental clinic, operating theatre, inpatient and outpatient care at Malaha, Webuye. Open 24 hours. Call ${SITE.phoneDisplay}.`,
} as const;

export type Photo = { src: string; alt: string; width: number; height: number };

export const PHOTOS: Record<"building" | "eye-surgery" | "ward" | "laboratory" | "grounds", Photo> = {
  building: {
    src: "/images/home/building.webp",
    alt: "The front of Kingdom Faith Based Hospital, a single storey stone building with a covered veranda.",
    width: 1200,
    height: 900,
  },
  "eye-surgery": {
    src: "/images/home/eye-surgery.webp",
    alt: "Eye surgery in the operating theatre, with the surgeon at the microscope and the patient under a sterile drape.",
    width: 1200,
    height: 675,
  },
  ward: {
    src: "/images/home/ward.webp",
    alt: "A ward with beds made up and a member of staff preparing one of them.",
    width: 1200,
    height: 900,
  },
  laboratory: {
    src: "/images/home/laboratory.webp",
    alt: "The laboratory, with a microscope, testing equipment and shelves of supplies.",
    width: 1200,
    height: 900,
  },
  grounds: {
    src: "/images/home/grounds.webp",
    alt: "A van parked on the gravel drive in front of the Faith Based Hospital building, with palm trees and a water tank behind it.",
    width: 1040,
    height: 694,
  },
};
