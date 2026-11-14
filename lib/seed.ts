import { ANCHOR, addDays } from "./format";

export type Row = { id: number; [k: string]: any };
export const COLLECTIONS = [
  "settings", "departments", "doctors", "nurses", "staff", "patients", "visits", "appointments", "emergencies",
  "prescriptions", "medicines", "inventory", "labCatalog", "labOrders", "beds", "admissions", "services", "invoices",
  "payments", "expenses", "pharmacySales", "ambulances", "bookings", "dental", "shaClaims", "holidays", "schedules",
  "symptoms", "diagnoses", "treatments", "advice", "documents", "templates", "imaging", "plans", "attendance",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
export type DB = Record<CollectionName, Row[]>;

export function buildSeed(): DB {
  let s = 20261114;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const at = (off: number, h = 9, m = 0) => `${addDays(ANCHOR, off)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const day = (off: number) => addDays(ANCHOR, off);
  const phone = () => `+254 7${ri(10, 99)} ${ri(100, 999)} ${ri(100, 999)}`;
  const mk = <T extends object>(list: T[]): Row[] => list.map((x, i) => ({ id: i + 1, ...x }) as Row);

  const settings = [{
    id: 1, name: "Kingdom Hospital", tagline: "Care with dignity", address: "Mombasa Road, Nairobi", phone: "+254 20 555 0142",
    email: "accounts@kingdomhospital.co.ke", currency: "KES", vat: 16, discount: 0, timeFormat: "24 hour", kra: "P051234567K",
    facilityCode: "13579", footer: "Thank you for choosing Kingdom Hospital.", mpesaPaybill: "522533", mpesaAccount: "KINGDOM",
    bank: "Equity Bank, Account 0170123456789", registration: "Level 4 Hospital, KMPDC licensed",
  }];

  const departments = mk([
    { name: "Outpatient", head: "Dr. Amos Kiplagat", description: "General consultations and follow up clinics" },
    { name: "Emergency", head: "Dr. Hassan Mohamed", description: "24 hour casualty and trauma care" },
    { name: "Paediatrics", head: "Dr. Sarah Mutheu", description: "Infants, children and adolescent health" },
    { name: "Maternity", head: "Dr. Ann Wairimu", description: "Antenatal, delivery and postnatal care" },
    { name: "Surgery", head: "Dr. James Oloo", description: "General and orthopaedic surgery, theatre" },
    { name: "Internal Medicine", head: "Dr. Amos Kiplagat", description: "Adult chronic and acute medical conditions" },
    { name: "Cardiology", head: "Dr. Judy Wanjiku", description: "Heart clinic, ECG and echocardiography" },
    { name: "Dental", head: "Dr. Lydia Chepkoech", description: "Oral health, restorative and surgical dentistry" },
    { name: "Radiology", head: "Dr. Peter Kamau", description: "X ray, ultrasound and CT imaging" },
    { name: "Intensive Care", head: "Dr. Hassan Mohamed", description: "Critical care and high dependency" },
  ]);

  const doctors = mk([
    { name: "Dr. Amos Kiplagat", departmentId: 6, specialty: "Internal Medicine", email: "a.kiplagat@kingdomhospital.co.ke", phone: "+254 722 410 118", licence: "KMPDC 12044", fee: 2500, status: "Active" },
    { name: "Dr. Sarah Mutheu", departmentId: 3, specialty: "Paediatrics", email: "s.mutheu@kingdomhospital.co.ke", phone: "+254 733 560 291", licence: "KMPDC 13871", fee: 2500, status: "Active" },
    { name: "Dr. James Oloo", departmentId: 5, specialty: "General Surgery", email: "j.oloo@kingdomhospital.co.ke", phone: "+254 711 802 667", licence: "KMPDC 10932", fee: 3500, status: "Active" },
    { name: "Dr. Ann Wairimu", departmentId: 4, specialty: "Obstetrics and Gynaecology", email: "a.wairimu@kingdomhospital.co.ke", phone: "+254 720 334 905", licence: "KMPDC 14420", fee: 3000, status: "Active" },
    { name: "Dr. Hassan Mohamed", departmentId: 2, specialty: "Emergency Medicine", email: "h.mohamed@kingdomhospital.co.ke", phone: "+254 745 118 372", licence: "KMPDC 11659", fee: 3000, status: "Active" },
    { name: "Dr. Lydia Chepkoech", departmentId: 8, specialty: "Dental Surgery", email: "l.chepkoech@kingdomhospital.co.ke", phone: "+254 728 640 553", licence: "KMPDC 15208", fee: 2000, status: "Active" },
    { name: "Dr. Peter Kamau", departmentId: 9, specialty: "Radiology", email: "p.kamau@kingdomhospital.co.ke", phone: "+254 735 907 144", licence: "KMPDC 12786", fee: 2500, status: "On leave" },
    { name: "Dr. Judy Wanjiku", departmentId: 7, specialty: "Cardiology", email: "j.wanjiku@kingdomhospital.co.ke", phone: "+254 701 288 430", licence: "KMPDC 13095", fee: 4000, status: "Active" },
  ]);

  const nurses = mk([
    { name: "Mary Wangare", ward: "General Ward A", email: "m.wangare@kingdomhospital.co.ke", phone: "+254 712 330 441", licence: "NCK 88213", shift: "Day" },
    { name: "John Kiprotich", ward: "Intensive Care", email: "j.kiprotich@kingdomhospital.co.ke", phone: "+254 723 118 205", licence: "NCK 90417", shift: "Night" },
    { name: "Faith Nyawira", ward: "Maternity Ward", email: "f.nyawira@kingdomhospital.co.ke", phone: "+254 734 772 019", licence: "NCK 77654", shift: "Day" },
    { name: "Caroline Atieno", ward: "Paediatric Ward", email: "c.atieno@kingdomhospital.co.ke", phone: "+254 745 660 382", licence: "NCK 81930", shift: "Day" },
    { name: "Stephen Mwiti", ward: "Emergency", email: "s.mwiti@kingdomhospital.co.ke", phone: "+254 757 401 226", licence: "NCK 85572", shift: "Night" },
    { name: "Tabitha Chelimo", ward: "General Ward B", email: "t.chelimo@kingdomhospital.co.ke", phone: "+254 768 912 540", licence: "NCK 79116", shift: "Day" },
  ]);

  const staff = mk([
    { name: "Ruth Njeri", role: "Hospital Administrator", department: "Administration", phone: phone(), email: "r.njeri@kingdomhospital.co.ke", joined: "2019-02-04", salary: 185000, status: "Active" },
    { name: "Kennedy Otieno", role: "Accountant", department: "Finance", phone: phone(), email: "k.otieno@kingdomhospital.co.ke", joined: "2020-06-15", salary: 120000, status: "Active" },
    { name: "Lilian Wekesa", role: "Pharmacist", department: "Pharmacy", phone: phone(), email: "l.wekesa@kingdomhospital.co.ke", joined: "2021-01-11", salary: 140000, status: "Active" },
    { name: "Martin Kariuki", role: "Lab Technologist", department: "Laboratory", phone: phone(), email: "m.kariuki@kingdomhospital.co.ke", joined: "2021-09-01", salary: 110000, status: "Active" },
    { name: "Dorcas Moraa", role: "Lab Technologist", department: "Laboratory", phone: phone(), email: "d.moraa@kingdomhospital.co.ke", joined: "2022-03-21", salary: 105000, status: "Active" },
    { name: "Elijah Mutiso", role: "Radiographer", department: "Radiology", phone: phone(), email: "e.mutiso@kingdomhospital.co.ke", joined: "2022-07-18", salary: 115000, status: "Active" },
    { name: "Joyce Cherop", role: "Receptionist", department: "Front Office", phone: phone(), email: "j.cherop@kingdomhospital.co.ke", joined: "2023-01-09", salary: 55000, status: "Active" },
    { name: "Abdi Warsame", role: "Ambulance Driver", department: "Transport", phone: phone(), email: "a.warsame@kingdomhospital.co.ke", joined: "2020-11-02", salary: 48000, status: "Active" },
    { name: "Lucy Wambui", role: "Records Officer", department: "Health Records", phone: phone(), email: "l.wambui@kingdomhospital.co.ke", joined: "2022-10-24", salary: 62000, status: "Active" },
    { name: "Titus Ng'ang'a", role: "Procurement Officer", department: "Stores", phone: phone(), email: "t.nganga@kingdomhospital.co.ke", joined: "2021-05-17", salary: 90000, status: "On leave" },
  ]);

  const names: [string, "Female" | "Male"][] = [
    ["Wanjiru Njeri", "Female"], ["Brian Otieno", "Male"], ["Amina Hassan", "Female"], ["Kevin Kiprop", "Male"], ["Grace Achieng", "Female"],
    ["Peter Mwangi", "Male"], ["Faith Wambui", "Female"], ["Hassan Abdi", "Male"], ["Mercy Chebet", "Female"], ["Joseph Ochieng", "Male"],
    ["Lucy Muthoni", "Female"], ["Daniel Kariuki", "Male"], ["Esther Nyambura", "Female"], ["Samuel Kimani", "Male"], ["Rose Akinyi", "Female"],
    ["Victor Mutua", "Male"], ["Naomi Wafula", "Female"], ["Collins Omondi", "Male"], ["Jacinta Mwende", "Female"], ["Isaac Korir", "Male"],
    ["Halima Yusuf", "Female"], ["Simon Njoroge", "Male"], ["Beatrice Adhiambo", "Female"], ["Patrick Maina", "Male"],
  ];
  const areas = ["Embakasi", "South B", "Kileleshwa", "Rongai", "Kitengela", "Syokimau", "Githurai", "Donholm", "Ruaka", "Utawala"];
  const groups = ["O positive", "A positive", "B positive", "O negative", "AB positive", "A negative"];
  const patients = mk(names.map(([name, gender], i) => ({
    mrn: `KH${String(100124 + i * 7)}`, name, gender, phone: phone(), email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.co.ke`,
    dob: `${ri(1958, 2018)}-${String(ri(1, 12)).padStart(2, "0")}-${String(ri(1, 28)).padStart(2, "0")}`, nationalId: String(ri(20000000, 39999999)),
    shaNumber: i % 5 === 4 ? "" : `SHA${ri(10000000, 99999999)}`, bloodGroup: pick(groups), heightCm: ri(150, 188), weightKg: ri(48, 96),
    address: `${pick(areas)}, Nairobi`, nextOfKin: pick(names.filter((n) => n[0] !== name))[0], nextOfKinPhone: phone(), insurer: i % 4 === 0 ? "Jubilee Insurance" : i % 7 === 0 ? "AAR" : "SHA",
    allergies: i % 6 === 0 ? "Penicillin" : i % 9 === 0 ? "Sulphonamides" : "None known", registered: day(-ri(2, 400)),
  })));

  const complaints = ["Persistent headache", "Fever and chills", "Abdominal pain", "Cough for two weeks", "Lower back pain", "High blood pressure review", "Diabetes follow up", "Skin rash", "Chest tightness", "Joint pain", "Antenatal visit", "Child wellness check"];
  const diagnoses = ["Malaria", "Hypertension", "Type 2 diabetes mellitus", "Upper respiratory tract infection", "Gastritis", "Urinary tract infection", "Lumbar strain", "Asthma", "Typhoid fever", "Osteoarthritis", "Dermatitis", "Pneumonia"];
  const visits = mk(Array.from({ length: 36 }, (_, i) => ({
    patientId: (i % 24) + 1, doctorId: ((i * 3) % 8) + 1, date: at(-i, ri(8, 16), pick([0, 15, 30, 45])),
    complaint: pick(complaints), bp: `${ri(105, 165)}/${ri(65, 100)}`, temp: +(36 + r() * 3).toFixed(1), pulse: ri(62, 108), spo2: ri(93, 99), weight: ri(48, 96),
    diagnosis: pick(diagnoses), treatment: pick(["Oral antibiotics", "Antimalarials and fluids", "Antihypertensive adjusted", "Analgesics and rest", "Referral for imaging", "Nebulisation"]),
    advice: pick(["Return in two weeks", "Increase fluids and rest", "Reduce salt intake", "Review with lab results", "Return if symptoms worsen"]),
    status: i < 3 ? "In consultation" : "Completed",
  })));

  const aStat = ["Confirmed", "Confirmed", "Treated", "Pending", "Requested", "Cancelled"];
  const appointments = mk(Array.from({ length: 44 }, (_, i) => {
    const off = i < 8 ? 0 : i < 16 ? ri(1, 9) : -ri(1, 14);
    const status = off < 0 ? pick(["Treated", "Treated", "Cancelled", "Treated"]) : off === 0 ? pick(["Confirmed", "Confirmed", "Pending", "Treated"]) : pick(["Confirmed", "Pending", "Requested"]);
    return { patientId: ((i * 5) % 24) + 1, doctorId: ((i * 7) % 8) + 1, date: at(off, ri(8, 16), pick([0, 30])), status, reason: pick(complaints), type: pick(["Consultation", "Follow up", "Procedure", "Review"]), duration: pick([20, 30, 45]) };
  }));
  void aStat;

  const emergencies = mk(Array.from({ length: 12 }, (_, i) => ({
    patientId: ((i * 2) % 24) + 1, doctorId: pick([5, 3, 8]), type: pick(["Trauma", "Cardiac", "Respiratory", "Obstetric", "Paediatric", "Burns", "Poisoning"]),
    description: pick(["Road traffic accident, chest and leg injuries", "Severe chest pain radiating to left arm", "Difficulty breathing, wheeze", "Labour pains, 38 weeks", "High fever and convulsions", "Scald burns to forearm", "Suspected ingestion of paraffin"]),
    status: i < 3 ? "In progress" : i < 5 ? "Active" : "Resolved", priority: pick(["Critical", "High", "Medium", "Critical"]), arrived: at(-Math.floor(i / 3), ri(0, 23), pick([0, 10, 25, 40])),
  })));

  const medList: [string, string, string, string, number, number, number, number][] = [
    ["Paracetamol 500mg tablets", "Paracetamol", "Analgesic", "Cosmos", 2, 5, 4200, 1000], ["Amoxicillin 500mg capsules", "Amoxicillin", "Antibiotic", "Dawa Ltd", 14, 25, 1650, 600],
    ["Artemether Lumefantrine 80/480", "Artemether Lumefantrine", "Antimalarial", "Novartis", 95, 160, 320, 150], ["Metformin 500mg tablets", "Metformin", "Antidiabetic", "Cipla", 4, 9, 2100, 800],
    ["Amlodipine 5mg tablets", "Amlodipine", "Antihypertensive", "Cipla", 5, 12, 1480, 700], ["Omeprazole 20mg capsules", "Omeprazole", "Gastro", "Universal", 6, 15, 950, 500],
    ["Ciprofloxacin 500mg tablets", "Ciprofloxacin", "Antibiotic", "Dawa Ltd", 9, 22, 140, 300], ["ORS sachets", "Oral rehydration salts", "Rehydration", "Cosmos", 12, 30, 780, 400],
    ["Diclofenac 50mg tablets", "Diclofenac", "Analgesic", "Universal", 3, 10, 1260, 500], ["Salbutamol inhaler 100mcg", "Salbutamol", "Respiratory", "GSK", 320, 520, 38, 40],
    ["Insulin Mixtard 30", "Human insulin", "Antidiabetic", "Novo Nordisk", 1450, 1900, 22, 25], ["Ceftriaxone 1g injection", "Ceftriaxone", "Antibiotic", "Dawa Ltd", 85, 190, 0, 100],
    ["Metronidazole 400mg tablets", "Metronidazole", "Antibiotic", "Cosmos", 3, 9, 2300, 800], ["Cetirizine 10mg tablets", "Cetirizine", "Antihistamine", "Cipla", 4, 12, 880, 400],
    ["Zinc 20mg dispersible", "Zinc sulphate", "Supplement", "Universal", 6, 15, 610, 300], ["Ibuprofen 400mg tablets", "Ibuprofen", "Analgesic", "Cosmos", 3, 8, 90, 300],
  ];
  const medicines = mk(medList.map(([name, generic, category, company, purchase, sale, quantity, reorder], i) => ({
    name, generic, category, company, purchase, sale, quantity, reorder, batch: `B${2026}${String(i + 11)}`, store: `Shelf ${String.fromCharCode(65 + (i % 5))}${(i % 4) + 1}`,
    expiry: i === 6 ? day(24) : i === 15 ? day(-9) : i % 5 === 2 ? day(ri(50, 90)) : day(ri(180, 700)),
  })));

  const inventory = mk([
    ["Examination gloves, box of 100", "Consumables", 64, 40, "Box", "MedSupply Kenya", 600, "Store 1"], ["Syringes 5ml, box of 100", "Consumables", 38, 30, "Box", "MedSupply Kenya", 420, "Store 1"],
    ["IV cannula 20G", "Consumables", 210, 150, "Piece", "Surgi Kenya", 520, "Store 1"], ["Surgical face masks, box of 50", "PPE", 22, 30, "Box", "MedSupply Kenya", 300, "Store 2"],
    ["Gauze rolls", "Consumables", 120, 80, "Roll", "Surgi Kenya", 700, "Store 1"], ["Normal saline 500ml", "Fluids", 18, 120, "Bottle", "Kenya Fluids", 400, "Store 2"],
    ["Vicryl suture 2/0", "Theatre", 55, 30, "Pack", "Surgi Kenya", 800, "Theatre store"], ["Urine specimen bottles", "Laboratory", 400, 200, "Piece", "Lab Direct", 365, "Lab"],
    ["Oxygen cylinder, 10 litre", "Equipment", 9, 6, "Cylinder", "BOC Kenya", 0, "Plant room"], ["Bed linen set", "Linen", 46, 30, "Set", "Hospital Linen Ltd", 0, "Laundry"],
    ["Alcohol hand rub, 500ml", "PPE", 14, 25, "Bottle", "MedSupply Kenya", 450, "Store 2"], ["Blood collection tubes EDTA", "Laboratory", 760, 400, "Piece", "Lab Direct", 520, "Lab"],
  ].map(([item, category, quantity, reorder, unit, supplier, exp, location]: any[], i) => ({ item, category, quantity, reorder, unit, supplier, location, expiry: exp ? day(exp) : "", unitCost: [12, 6, 35, 9, 22, 85, 140, 8, 3800, 900, 320, 11][i] })));

  type L = [string, string, string, string, number, number | null, number | null, string, number];
  const labDefs: L[] = [
    ["Haemoglobin", "Haematology", "g/dL", "Whole blood", 450, 12, 16, "", 1], ["White cell count", "Haematology", "x10^9/L", "Whole blood", 450, 4, 11, "", 1],
    ["Platelet count", "Haematology", "x10^9/L", "Whole blood", 450, 150, 400, "", 1], ["Haematocrit", "Haematology", "%", "Whole blood", 450, 36, 46, "", 1],
    ["ESR", "Haematology", "mm/hr", "Whole blood", 350, 0, 20, "", 2], ["Fasting blood sugar", "Biochemistry", "mmol/L", "Plasma", 300, 3.9, 5.6, "", 1],
    ["Random blood sugar", "Biochemistry", "mmol/L", "Plasma", 300, 3.9, 7.8, "", 1], ["HbA1c", "Biochemistry", "%", "Whole blood", 1800, 4, 5.6, "", 4],
    ["Urea", "Biochemistry", "mmol/L", "Serum", 600, 2.5, 7.8, "", 3], ["Creatinine", "Biochemistry", "µmol/L", "Serum", 650, 53, 106, "", 3],
    ["ALT", "Biochemistry", "U/L", "Serum", 700, 7, 56, "", 3], ["AST", "Biochemistry", "U/L", "Serum", 700, 10, 40, "", 3],
    ["Total bilirubin", "Biochemistry", "µmol/L", "Serum", 650, 3, 21, "", 3], ["Total cholesterol", "Biochemistry", "mmol/L", "Serum", 800, 0, 5.2, "", 3],
    ["Triglycerides", "Biochemistry", "mmol/L", "Serum", 800, 0, 1.7, "", 3], ["Sodium", "Biochemistry", "mmol/L", "Serum", 500, 135, 145, "", 2],
    ["Potassium", "Biochemistry", "mmol/L", "Serum", 500, 3.5, 5.1, "", 2], ["Malaria smear", "Microbiology", "", "Whole blood", 300, null, null, "Negative", 1],
    ["HIV rapid test", "Serology", "", "Whole blood", 400, null, null, "Non reactive", 1], ["H. pylori antigen", "Serology", "", "Stool", 1200, null, null, "Negative", 2],
    ["Pregnancy test", "Serology", "", "Urine", 250, null, null, "Negative", 1], ["Urinalysis", "Microbiology", "", "Urine", 350, null, null, "Normal", 1],
  ];
  const labCatalog = mk(labDefs.map(([name, category, unit, specimen, price, refLow, refHigh, refText, tat]) => ({ name, category, unit, specimen, price, refLow, refHigh, refText, tat })));

  const labStatuses = ["Released", "Released", "Released", "Released", "Review", "Processing", "Collected", "Ordered"];
  const labOrders = mk(Array.from({ length: 46 }, (_, i) => {
    const testId = (i * 5 + Math.floor(i / 3)) % labCatalog.length + 1;
    const t = labCatalog[testId - 1];
    const status = i < 10 ? ["Ordered", "Ordered", "Collected", "Collected", "Processing", "Processing", "Processing", "Review", "Review", "Review"][i] : "Released";
    let result: string | number | null = null, flag = "";
    if (status === "Released" || status === "Review") {
      if (t.refLow !== null) {
        const span = t.refHigh - t.refLow;
        const mood = r();
        const v = mood < 0.62 ? t.refLow + r() * span : mood < 0.82 ? t.refHigh + r() * span * 0.35 : mood < 0.95 ? t.refLow - r() * span * 0.25 : t.refHigh + span * (0.8 + r());
        result = +Math.max(v, 0.1).toFixed(t.unit === "mmol/L" || t.unit === "g/dL" || t.unit === "%" ? 1 : 0);
        flag = result < t.refLow ? (result < t.refLow - span * 0.4 ? "Critical" : "Low") : result > t.refHigh ? (result > t.refHigh + span * 0.6 ? "Critical" : "High") : "Normal";
      } else {
        const abnormal = r() < 0.18;
        result = abnormal ? (t.name === "Malaria smear" ? "Positive, P. falciparum" : t.name === "Pregnancy test" ? "Positive" : t.name === "HIV rapid test" ? "Reactive" : t.name === "Urinalysis" ? "Leucocytes ++, nitrites positive" : "Positive") : t.refText;
        flag = abnormal ? "Abnormal" : "Normal";
      }
    }
    return {
      patientId: ((i * 7) % 24) + 1, doctorId: ((i * 3) % 8) + 1, testId, source: pick(["OPD", "OPD", "Inpatient", "Emergency"]), orderedAt: at(-Math.floor(i / 4), ri(8, 17), pick([0, 20, 40])),
      status, result, flag, collectedBy: status === "Ordered" ? "" : pick(["Dorcas Moraa", "Martin Kariuki"]), verifiedBy: status === "Released" ? "Martin Kariuki" : "", priority: i % 9 === 0 ? "Urgent" : "Routine", notes: "",
    };
  }));
  void labStatuses;
  const crit = labOrders.find((o) => o.status === "Review" && labCatalog[o.testId - 1].refLow !== null);
  if (crit) { const t = labCatalog[crit.testId - 1]; crit.result = +(t.refHigh * 2.4).toFixed(1); crit.flag = "Critical"; }

  const wards: [string, string, number, string, number][] = [
    ["General Ward A", "GA", 12, "First floor", 2500], ["General Ward B", "GB", 10, "First floor", 2500], ["Private Wing", "PW", 8, "Second floor", 8000],
    ["Maternity Ward", "MW", 10, "Ground floor", 4000], ["Paediatric Ward", "PD", 8, "Ground floor", 3000], ["Intensive Care", "IC", 6, "Second floor", 18000], ["High Dependency", "HD", 4, "Second floor", 12000],
  ];
  const beds: Row[] = [];
  wards.forEach(([ward, code, n, floor, price]) => {
    for (let k = 1; k <= n; k++) beds.push({ id: beds.length + 1, ward, code: `${code}${String(k).padStart(2, "0")}`, floor, price, status: "Available", patientId: null });
  });
  const admissions: Row[] = [];
  const dxs = ["Pneumonia", "Post operative care", "Severe malaria", "Diabetic ketoacidosis", "Pre eclampsia", "Cellulitis", "Acute gastroenteritis", "Heart failure", "Road traffic injury", "Typhoid fever"];
  let pi = 1;
  beds.forEach((b, i) => {
    const roll = (i * 37 + 11) % 100;
    if (roll < 52 && pi <= 24) {
      b.status = "Occupied"; b.patientId = pi;
      const off = -ri(0, 9);
      admissions.push({ id: admissions.length + 1, bedId: b.id, patientId: pi, doctorId: pick([1, 2, 3, 4, 5, 8]), admittedAt: at(off, ri(6, 20), pick([0, 15, 45])), dischargedAt: "", diagnosis: pick(dxs), status: "Admitted", due: ri(0, 6) * 4500 });
      pi++;
    } else if (roll < 60) b.status = "Cleaning";
    else if (roll < 66) b.status = "Reserved";
    else if (roll < 69) b.status = "Maintenance";
  });
  [[5, 3], [7, 2], [9, 6]].forEach(([p, off], k) => admissions.push({ id: admissions.length + 1, bedId: 3 + k, patientId: p, doctorId: 1, admittedAt: at(-off - 6, 10, 0), dischargedAt: at(-off, 11, 30), diagnosis: pick(dxs), status: "Discharged", due: 0 }));

  const services = mk([
    ["General consultation", "Consultation", 1500], ["Specialist consultation", "Consultation", 3000], ["Follow up consultation", "Consultation", 800], ["Chest X ray", "Radiology", 2500],
    ["Abdominal ultrasound", "Radiology", 3500], ["Obstetric ultrasound", "Radiology", 3000], ["ECG", "Cardiology", 1800], ["Echocardiogram", "Cardiology", 7500], ["Wound dressing", "Procedure", 700],
    ["Suturing, minor", "Procedure", 2500], ["Nebulisation", "Procedure", 900], ["Dental extraction", "Dental", 3500], ["Dental scaling and polishing", "Dental", 4500], ["Ambulance, within Nairobi", "Transport", 6000],
    ["Normal delivery package", "Maternity", 45000], ["Caesarean section package", "Maternity", 120000], ["Theatre fee, minor", "Theatre", 15000],
  ].map(([name, category, price]) => ({ name, category, price })));

  const itemsPool: [string, number][] = [["General consultation", 1500], ["Specialist consultation", 3000], ["Full haemogram", 1350], ["Malaria smear", 300], ["Chest X ray", 2500], ["Artemether Lumefantrine 80/480", 160], ["Amoxicillin 500mg capsules", 25], ["Abdominal ultrasound", 3500], ["Wound dressing", 700], ["Random blood sugar", 300], ["ECG", 1800], ["Metformin 500mg tablets", 9]];
  const invoices = mk(Array.from({ length: 90 }, (_, i) => {
    const n = ri(1, 4);
    const items = Array.from({ length: n }, () => { const [description, price] = pick(itemsPool); return { description, qty: price < 100 ? ri(6, 21) : 1, price }; });
    const sub = items.reduce((a, x) => a + x.qty * x.price, 0);
    const discountPct = i % 8 === 0 ? 10 : 0;
    const total = sub - Math.round(sub * (discountPct / 100));
    const st = i % 13 === 4 ? "Draft" : i % 6 === 5 ? "Due" : i % 7 === 3 ? "Partial" : "Paid";
    const paid = st === "Paid" ? total : st === "Partial" ? Math.round(total * 0.4) : 0;
    return {
      no: `INV${String(1180 + 90 - i).padStart(4, "0")}`, patientId: ((i * 11) % 24) + 1, doctorId: ((i * 3) % 8) + 1, date: day(-Math.floor(i * 0.5)), dueDate: day(-Math.floor(i * 0.5) + 14),
      items, discountPct, vatPct: 0, paid, status: st, source: pick(["OPD", "OPD", "Lab", "Pharmacy", "Inpatient"]), method: pick(["M Pesa", "Cash", "SHA", "Card", "Insurance"]), note: "",
    };
  }));
  const payments: Row[] = [];
  invoices.forEach((inv) => { if (inv.paid > 0) payments.push({ id: payments.length + 1, invoiceNo: inv.no, patientId: inv.patientId, date: inv.date, amount: inv.paid, method: inv.method, reference: inv.method === "M Pesa" ? `S${ri(10, 99)}${String.fromCharCode(65 + ri(0, 25))}${ri(100, 999)}${String.fromCharCode(65 + ri(0, 25))}${ri(10, 99)}` : inv.method === "Cash" ? "Counter receipt" : `REF${ri(100000, 999999)}` }); });

  const expenses = mk([
    ["Electricity, KPLC", "Utilities", 184000], ["Water and sewerage", "Utilities", 36500], ["Medical oxygen refill", "Supplies", 92000], ["Staff salaries, October", "Payroll", 1286000], ["Laundry services", "Services", 48000],
    ["Generator diesel", "Utilities", 62000], ["Medical waste disposal", "Services", 27500], ["Lab reagents", "Supplies", 210000], ["Security services", "Services", 78000], ["Internet and telephone", "Utilities", 24800],
    ["Equipment maintenance", "Maintenance", 56000], ["Kitchen and catering", "Services", 142000], ["Pharmacy restock", "Supplies", 318000], ["Cleaning supplies", "Supplies", 19200],
  ].map(([description, category, amount], i) => ({ date: day(-i * 2 - 1), description, category, amount, method: pick(["Bank transfer", "M Pesa", "Cheque"]) })));

  const pharmacySales = mk(Array.from({ length: 18 }, (_, i) => {
    const lines = Array.from({ length: ri(1, 3) }, () => { const m = pick(medicines); return { medicineId: m.id, name: m.name, qty: ri(1, 12), price: m.sale }; });
    return { date: at(-Math.floor(i / 2), ri(8, 18), pick([0, 25, 50])), patientId: ((i * 3) % 24) + 1, lines, total: lines.reduce((a, l) => a + l.qty * l.price, 0), method: pick(["M Pesa", "Cash", "Card"]) };
  }));

  const prescriptions = mk(Array.from({ length: 20 }, (_, i) => ({
    date: day(-i), patientId: ((i * 5) % 24) + 1, doctorId: ((i * 3) % 8) + 1, notes: pick(["Take after meals", "Complete the full course", "Review in one week", ""]),
    items: Array.from({ length: ri(1, 3) }, () => { const m = pick(medicines); return { medicine: m.name, dose: pick(["1 tablet", "2 tablets", "1 capsule", "5 ml"]), frequency: pick(["Twice daily", "Three times daily", "Once daily at night", "Every 8 hours"]), days: pick([3, 5, 7, 14]) }; }),
  })));

  const ambulances = mk([
    { plate: "KDA 214K", driver: "Abdi Warsame", phone: "+254 722 880 019", type: "Basic life support", equipment: "Oxygen, stretcher, first aid", capacity: 2, status: "Available" },
    { plate: "KDB 880M", driver: "Julius Kiprono", phone: "+254 733 154 906", type: "Advanced life support", equipment: "Defibrillator, ventilator, monitor", capacity: 3, status: "On call" },
    { plate: "KCZ 330P", driver: "Peter Wafula", phone: "+254 712 604 337", type: "Basic life support", equipment: "Oxygen, stretcher", capacity: 2, status: "Maintenance" },
    { plate: "KDD 105T", driver: "Moses Kioko", phone: "+254 745 021 778", type: "Neonatal transport", equipment: "Incubator, neonatal monitor", capacity: 2, status: "Available" },
  ]);
  const bookings = mk([
    ["Wanjiru Njeri", "Embakasi", "Kingdom Hospital", 2, "On trip", 0, 6000], ["Otieno Family", "Kenyatta Avenue", "Kingdom Hospital", 1, "Completed", -1, 4500], ["Amina Hassan", "Kingdom Hospital", "Kenyatta National Hospital", 2, "Completed", -2, 9500],
    ["Baby of Faith Wambui", "Kitengela", "Kingdom Hospital", 4, "Scheduled", 1, 12000], ["Peter Mwangi", "Syokimau", "Kingdom Hospital", 1, "Completed", -4, 7500], ["Naomi Wafula", "Kingdom Hospital", "Nairobi West Hospital", 1, "Cancelled", -5, 0],
  ].map(([patient, from, to, ambulanceId, status, off, fee]: any[]) => ({ patient, from, to, ambulanceId, status, date: at(off, 10, 20), fee })));

  const teeth = (o: Record<string, string>) => o;
  const dental = mk([
    { patientId: 2, doctorId: 6, date: at(-8, 10, 0), complaint: "Pain on lower right molar", history: "No known allergies, no anticoagulants", status: "Follow up required", nextAppointment: at(1, 14, 0), teeth: teeth({ "46": "Caries", "47": "Filled", "18": "Missing" }), plan: "Root canal treatment, tooth 46" },
    { patientId: 5, doctorId: 6, date: at(-3, 11, 30), complaint: "Routine check and cleaning", history: "Hypertensive, on amlodipine", status: "Completed", nextAppointment: "", teeth: teeth({ "16": "Filled", "26": "Crown" }), plan: "Scaling and polishing done" },
    { patientId: 9, doctorId: 6, date: at(-1, 9, 15), complaint: "Swollen gum, bleeding on brushing", history: "None", status: "Draft", nextAppointment: at(6, 9, 0), teeth: teeth({ "31": "Caries", "41": "Caries", "36": "Extracted" }), plan: "" },
    { patientId: 12, doctorId: 6, date: at(0, 8, 40), complaint: "Wisdom tooth pain", history: "Penicillin allergy", status: "Follow up required", nextAppointment: at(5, 10, 0), teeth: teeth({ "38": "Impacted", "48": "Impacted" }), plan: "Surgical removal of 38 and 48" },
  ]);

  const claimStat = ["Paid", "Approved", "Submitted", "Rejected", "Draft", "Paid"];
  const shaClaims = mk(invoices.filter((x) => x.method === "SHA" || x.id % 6 === 0).slice(0, 14).map((inv, i) => {
    const amt = inv.items.reduce((a: number, x: any) => a + x.qty * x.price, 0);
    const status = claimStat[i % claimStat.length];
    return { claimNo: `SHA2026${String(300 + i).padStart(4, "0")}`, invoiceNo: inv.no, patientId: inv.patientId, intervention: pick(["Outpatient, primary care", "Outpatient, specialist", "Inpatient admission", "Maternity package", "Imaging and diagnostics", "Chronic care, diabetes"]), fund: pick(["PHC Fund", "SHIF", "SHIF", "ECCIF"]), amount: Math.round(amt * 0.85), status, submitted: inv.date, remarks: status === "Rejected" ? "Pre authorisation missing for imaging" : "" };
  }));

  const holidays = mk([
    { doctorId: 7, from: day(-10), to: day(10), reason: "Annual leave" }, { doctorId: 1, from: day(18), to: day(24), reason: "Conference, Mombasa" }, { doctorId: 3, from: day(3), to: day(3), reason: "Personal day" }, { doctorId: 4, from: day(30), to: day(37), reason: "Annual leave" },
  ]);
  const schedules: Row[] = [];
  doctors.forEach((d) => ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach((w, k) => { if ((d.id + k) % 4 !== 3) schedules.push({ id: schedules.length + 1, doctorId: d.id, day: w, start: d.id % 2 ? "08:00" : "09:00", end: d.id % 2 ? "16:00" : "17:00", slot: d.id % 3 === 0 ? 30 : 20 }); }));

  const symptoms = mk(["Fever", "Headache", "Cough", "Chest pain", "Shortness of breath", "Abdominal pain", "Nausea and vomiting", "Diarrhoea", "Fatigue", "Joint pain", "Skin rash", "Dizziness"].map((name) => ({ name, description: "" })));
  const dx = mk([["Malaria", "B54"], ["Hypertension", "I10"], ["Type 2 diabetes mellitus", "E11"], ["Upper respiratory tract infection", "J06"], ["Gastritis", "K29"], ["Urinary tract infection", "N39.0"], ["Asthma", "J45"], ["Pneumonia", "J18"], ["Typhoid fever", "A01"], ["Osteoarthritis", "M19"]].map(([name, code]) => ({ name, code, description: "" })));
  const treatments = mk([["Oral rehydration therapy", "Hydration"], ["Antibiotic course", "Medication"], ["Nebulisation", "Procedure"], ["Wound care and dressing", "Procedure"], ["Physiotherapy", "Rehabilitation"], ["Intravenous fluids", "Medication"], ["Insulin titration", "Medication"], ["Oxygen therapy", "Procedure"]].map(([name, category]) => ({ name, category })));
  const advice = mk(["Increase fluid intake", "Reduce salt and processed food", "Complete the antibiotic course", "Return in two weeks for review", "Avoid strenuous activity for one week", "Sleep under a treated mosquito net", "Monitor blood sugar daily"].map((name) => ({ name, category: "General" })));

  const documents = mk([
    ["Consent form, surgery", "Consent", 3, "PDF", "182 KB"], ["Discharge summary", "Summary", 5, "PDF", "96 KB"], ["Referral letter", "Letter", 8, "PDF", "74 KB"], ["Chest X ray report", "Imaging", 2, "PDF", "1.2 MB"],
    ["SHA pre authorisation", "Insurance", 9, "PDF", "128 KB"], ["Birth notification", "Notification", 7, "PDF", "64 KB"],
  ].map(([title, type, p, format, size], i) => ({ title, type, patientId: p, format, size, uploaded: day(-i * 3) })));

  const templates = mk([
    ["Payment received", "Dear {name}, we received your payment of KES {amount}. Thank you. Please contact our support team for any questions."],
    ["Appointment confirmation", "Dear {name}, your appointment with {doctorname} on {appointmentdate} at {time_slot} is confirmed. Contact {hospital_name} for more information."],
    ["Appointment request received", "Dear {name}, we received your appointment request with {doctorname} on {appointmentdate}. Please confirm your slot with {hospital_name}."],
    ["Lab results ready", "Dear {name}, your laboratory results are ready for collection or viewing in the patient portal. Regards, {hospital_name}."],
    ["New doctor welcome", "Dear {name}, you are registered at {hospital_name} as a doctor in {department}. Please sign in to complete your profile."],
    ["Discharge instructions", "Dear {name}, thank you for staying with us. Please follow the discharge instructions provided and return for review on {appointmentdate}."],
  ].map(([category, message], i) => ({ category, message, status: i === 5 ? "Inactive" : "Active", channel: i % 2 ? "SMS" : "Email" })));

  const imaging = mk([
    { patientId: 3, kind: "Chest X ray", doctorId: 7, date: at(-2, 11, 0), indication: "Persistent cough, fever", findings: "Right lower zone consolidation with air bronchograms. No pleural effusion. Heart size normal.", impression: "Features consistent with lobar pneumonia.", status: "Reported" },
    { patientId: 8, kind: "Abdominal ultrasound", doctorId: 7, date: at(-1, 14, 30), indication: "Right upper quadrant pain", findings: "Gallbladder contains multiple stones, largest 11 mm. Wall thickness 3 mm. Common bile duct 4 mm.", impression: "Cholelithiasis without cholecystitis.", status: "Reported" },
    { patientId: 14, kind: "Knee X ray", doctorId: 7, date: at(0, 9, 45), indication: "Chronic knee pain", findings: "", impression: "", status: "Awaiting report" },
  ]);
  const plans = mk([
    { patientId: 6, doctorId: 1, date: day(-2), symptoms: "Fever, headache, joint pain for three days", assessment: "Uncomplicated malaria, confirmed by smear", plan: "Artemether Lumefantrine for three days, paracetamol, oral fluids, review in 48 hours if no improvement", status: "Active" },
    { patientId: 11, doctorId: 8, date: day(-6), symptoms: "Raised blood pressure readings at home", assessment: "Stage 2 hypertension", plan: "Start amlodipine 5mg daily, reduce salt, repeat blood pressure in two weeks, lipid profile", status: "Active" },
  ]);
  const attendance = mk(staff.map((st, i) => ({ staffId: st.id, date: ANCHOR, checkIn: `0${7 + (i % 2)}:${pick(["02", "15", "28", "41", "55"])}`, checkOut: i % 4 === 0 ? "" : `${16 + (i % 3)}:${pick(["05", "30", "48"])}`, status: st.status === "On leave" ? "On leave" : i % 7 === 3 ? "Late" : "Present" })));

  return { settings, departments, doctors, nurses, staff, patients, visits, appointments, emergencies, prescriptions, medicines, inventory, labCatalog, labOrders, beds, admissions, services, invoices, payments, expenses, pharmacySales, ambulances, bookings, dental, shaClaims, holidays, schedules, symptoms, diagnoses: dx, treatments, advice, documents, templates, imaging, plans, attendance };
}
