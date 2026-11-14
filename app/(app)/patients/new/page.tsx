"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, useDB } from "@/lib/store";
import { Field, PageHeader, toast } from "@/components/ui";
import { ANCHOR } from "@/lib/format";

const BLANK = { name: "", gender: "", dob: "", nationalId: "", phone: "", email: "", address: "", bloodGroup: "", heightCm: "", weightKg: "", allergies: "None known", chronic: "", insurer: "SHA", shaNumber: "", memberNo: "", nextOfKin: "", nextOfKinPhone: "", relationship: "" };

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <div><h2 className="card-title">{title}</h2><p className="mt-1 text-[13px] text-muted">{hint}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function RegisterPatient() {
  const d = useDB();
  const router = useRouter();
  const [v, setV] = useState<Record<string, any>>(BLANK);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }));

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    const p = id && db.get().patients.find((x) => x.id === id);
    if (p) { setEditId(p.id); setV({ ...BLANK, ...p }); }
  }, []);

  const bmi = Number(v.heightCm) && Number(v.weightKg) ? (Number(v.weightKg) / (Number(v.heightCm) / 100) ** 2).toFixed(1) : "";
  const save = () => {
    const req: [string, string][] = [["name", "full name"], ["gender", "gender"], ["dob", "date of birth"], ["phone", "phone number"]];
    const errs: Record<string, string> = {};
    req.forEach(([k, l]) => { if (!String(v[k] || "").trim()) errs[k] = `Enter ${l}`; });
    if (v.shaNumber && !/^SHA\d{6,}$/i.test(v.shaNumber.replace(/\s/g, ""))) errs.shaNumber = "SHA numbers start with SHA followed by digits";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const row: Record<string, any> = { ...v, heightCm: Number(v.heightCm) || null, weightKg: Number(v.weightKg) || null };
    if (editId) { db.update("patients", editId, row); toast("Patient details updated"); router.push(`/patients/${editId}`); return; }
    const max = d.patients.reduce((m, p) => Math.max(m, parseInt(String(p.mrn).replace(/\D/g, ""), 10) || 0), 0);
    const created = db.add("patients", { ...row, mrn: `KH${max + 7}`, registered: ANCHOR });
    toast(`${row.name} registered as ${created.mrn}`);
    router.push(`/patients/${created.id}`);
  };
  const err = (k: string) => errors[k] && <span className="mt-1 block text-xs text-bad">{errors[k]}</span>;
  const inp = (k: string, type = "text", ph = "") => <input className="input" type={type} value={v[k] ?? ""} placeholder={ph} aria-invalid={!!errors[k]} onChange={(e) => set(k, e.target.value)} />;

  return (
    <div>
      <PageHeader title={editId ? "Edit patient details" : "Register patient"} crumbs={[{ label: "Patients", href: "/patients" }, { label: editId ? "Edit" : "Register" }]} description="Capture identity, contact, medical background and cover once. Every department sees the same record." />
      <div className="space-y-5">
        <Section title="Personal details" hint="As shown on the national ID or birth certificate.">
          <Field label="Full name" required span={2}>{inp("name", "text", "First and last name")}{err("name")}</Field>
          <Field label="Gender" required><select className="input" value={v.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select gender</option><option>Female</option><option>Male</option></select>{err("gender")}</Field>
          <Field label="Date of birth" required>{inp("dob", "date")}{err("dob")}</Field>
          <Field label="National ID or birth certificate number">{inp("nationalId")}</Field>
          <Field label="Phone number" required>{inp("phone", "tel", "+254 7XX XXX XXX")}{err("phone")}</Field>
          <Field label="Email">{inp("email", "email")}</Field>
          <Field label="Residence">{inp("address", "text", "Estate and town")}</Field>
        </Section>
        <Section title="Medical profile" hint="Used at triage and shown as an alert on the patient chart.">
          <Field label="Blood group"><select className="input" value={v.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}><option value="">Not tested</option>{["O positive", "O negative", "A positive", "A negative", "B positive", "B negative", "AB positive", "AB negative"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Known allergies">{inp("allergies")}</Field>
          <Field label="Height (cm)">{inp("heightCm", "number")}</Field>
          <Field label="Weight (kg)" hint={bmi ? `Body mass index ${bmi}` : undefined}>{inp("weightKg", "number")}</Field>
          <Field label="Chronic conditions" span={2}>{inp("chronic", "text", "Hypertension, diabetes, asthma")}</Field>
        </Section>
        <Section title="Cover" hint="SHA eligibility is checked from the SHA claims page before a claim is filed.">
          <Field label="Primary cover"><select className="input" value={v.insurer} onChange={(e) => set("insurer", e.target.value)}>{["SHA", "Jubilee Insurance", "AAR", "Britam", "CIC", "Self pay"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="SHA number">{inp("shaNumber", "text", "SHA12345678")}{err("shaNumber")}</Field>
          <Field label="Insurer member number" span={2}>{inp("memberNo")}</Field>
        </Section>
        <Section title="Next of kin" hint="Contacted in an emergency or when the patient cannot consent.">
          <Field label="Name">{inp("nextOfKin")}</Field>
          <Field label="Relationship"><select className="input" value={v.relationship} onChange={(e) => set("relationship", e.target.value)}><option value="">Select</option>{["Spouse", "Parent", "Child", "Sibling", "Friend", "Guardian"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Phone number">{inp("nextOfKinPhone", "tel")}</Field>
        </Section>
        <div className="flex justify-end gap-2.5 pb-4"><button className="btn btn-secondary h-10" onClick={() => router.back()}>Cancel</button><button className="btn btn-primary h-10 px-6" onClick={save}>{editId ? "Save changes" : "Register patient"}</button></div>
      </div>
    </div>
  );
}
