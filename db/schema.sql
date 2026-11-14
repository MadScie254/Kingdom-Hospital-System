-- Kingdom Hospital System: PostgreSQL schema (Neon or Supabase).
-- Money is stored in KES as numeric(12,2). Timestamps are timestamptz in UTC.

create extension if not exists pgcrypto;

create table departments (
  id serial primary key,
  name text not null unique,
  head_doctor_id int,
  description text
);

create table doctors (
  id serial primary key,
  name text not null,
  department_id int references departments(id),
  specialty text not null,
  kmpdc_number text,
  email text unique,
  phone text,
  consultation_fee numeric(12,2) not null default 0,
  status text not null default 'Active' check (status in ('Active','On leave','Inactive'))
);

create table patients (
  id serial primary key,
  mrn text not null unique,
  name text not null,
  gender text not null check (gender in ('Female','Male')),
  dob date not null,
  national_id text,
  phone text not null,
  email text,
  address text,
  blood_group text,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  allergies text not null default 'None known',
  chronic_conditions text,
  insurer text not null default 'SHA',
  sha_number text unique,
  member_number text,
  next_of_kin text, next_of_kin_phone text, next_of_kin_relationship text,
  registered_on date not null default current_date
);
create index on patients (lower(name));
create index on patients (phone);

create table appointments (
  id serial primary key,
  patient_id int not null references patients(id),
  doctor_id int not null references doctors(id),
  starts_at timestamptz not null,
  duration_minutes int not null default 30,
  type text not null default 'Consultation',
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Requested','Treated','Cancelled')),
  reason text
);
create index on appointments (doctor_id, starts_at);

create table visits (
  id serial primary key,
  patient_id int not null references patients(id),
  doctor_id int not null references doctors(id),
  seen_at timestamptz not null,
  complaint text, bp text, temperature_c numeric(3,1), pulse int, spo2 int, weight_kg numeric(5,1),
  diagnosis text, icd10 text, treatment text, advice text,
  status text not null default 'In consultation'
);
create index on visits (patient_id, seen_at desc);

create table service_items (
  id serial primary key, name text not null, category text not null, price numeric(12,2) not null
);

create table invoices (
  id serial primary key,
  invoice_no text not null unique,
  patient_id int not null references patients(id),
  doctor_id int references doctors(id),
  issued_on date not null,
  due_on date not null,
  source text not null default 'OPD',
  discount_pct numeric(5,2) not null default 0,
  vat_pct numeric(5,2) not null default 0,
  status text not null default 'Due' check (status in ('Draft','Due','Partial','Paid')),
  note text
);
create table invoice_lines (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  description text not null,
  qty numeric(10,2) not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);
create table payments (
  id serial primary key,
  invoice_id int not null references invoices(id),
  paid_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('M Pesa','Cash','Card','SHA','Insurance','Bank transfer')),
  reference text
);

create table lab_tests (
  id serial primary key,
  name text not null, category text not null, specimen text, unit text,
  ref_low numeric, ref_high numeric, ref_text text,
  price numeric(12,2) not null, turnaround_days int not null default 1
);
create table lab_orders (
  id serial primary key,
  patient_id int not null references patients(id),
  doctor_id int references doctors(id),
  test_id int not null references lab_tests(id),
  source text not null default 'OPD',
  priority text not null default 'Routine' check (priority in ('Routine','Urgent')),
  status text not null default 'Ordered' check (status in ('Ordered','Collected','Processing','Review','Released')),
  ordered_at timestamptz not null default now(),
  result_numeric numeric, result_text text,
  flag text check (flag in ('Normal','Low','High','Critical','Abnormal')),
  collected_by text, verified_by text, comment text
);
create index on lab_orders (patient_id, test_id, ordered_at);
create index on lab_orders (status);

create table beds (
  id serial primary key,
  code text not null unique, ward text not null, floor text not null,
  daily_rate numeric(12,2) not null,
  status text not null default 'Available' check (status in ('Available','Occupied','Cleaning','Reserved','Maintenance'))
);
create table admissions (
  id serial primary key,
  bed_id int not null references beds(id),
  patient_id int not null references patients(id),
  doctor_id int references doctors(id),
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  diagnosis text,
  status text not null default 'Admitted' check (status in ('Admitted','Discharged'))
);
create unique index one_active_admission_per_bed on admissions (bed_id) where status = 'Admitted';
create unique index one_active_admission_per_patient on admissions (patient_id) where status = 'Admitted';

create table medicines (
  id serial primary key,
  name text not null, generic text, category text, manufacturer text, shelf text, batch text,
  purchase_price numeric(12,2) not null, sale_price numeric(12,2) not null,
  quantity int not null default 0 check (quantity >= 0), reorder_level int not null default 0, expiry date
);
create table pharmacy_sales (
  id serial primary key, sold_at timestamptz not null default now(),
  patient_id int references patients(id), method text not null, total numeric(12,2) not null
);
create table pharmacy_sale_lines (
  id serial primary key, sale_id int not null references pharmacy_sales(id) on delete cascade,
  medicine_id int not null references medicines(id), qty int not null check (qty > 0), unit_price numeric(12,2) not null
);
create table prescriptions (
  id serial primary key, patient_id int not null references patients(id), doctor_id int not null references doctors(id),
  issued_on date not null, notes text, items jsonb not null
);

create table sha_claims (
  id serial primary key,
  claim_no text not null unique,
  invoice_id int references invoices(id),
  patient_id int not null references patients(id),
  intervention text, fund text, amount numeric(12,2) not null,
  status text not null default 'Draft' check (status in ('Draft','Submitted','Approved','Rejected','Paid')),
  service_date date, remarks text
);

create table expenses (
  id serial primary key, spent_on date not null, description text not null,
  category text not null, amount numeric(12,2) not null, method text
);
create table audit_log (
  id bigserial primary key, at timestamptz not null default now(),
  actor text not null, action text not null, entity text not null, entity_id text, detail jsonb
);

-- Patient data is sensitive personal data under the Kenya Data Protection Act, 2019.
-- Turn on row level security and restrict by role before storing real records.
