"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, ShieldCheck, Smartphone } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { POSITIONS } from "@/lib/access";

type Pub = { hospital: { name?: string; email?: string; phone?: string }; departments: { id: number; name: string }[] };

const STEPS = [
  { icon: ClipboardCheck, title: "Send your request", text: "Tell us who you are and which departments you work in." },
  { icon: ShieldCheck, title: "The administrator approves", text: "They confirm you and give you the right access." },
  { icon: Smartphone, title: "Sign in anywhere", text: "Use your phone, a tablet or any computer." },
];

export default function Signup() {
  const [pub, setPub] = useState<Pub | null>(null);
  const [v, setV] = useState({ name: "", email: "", phone: "", position: "", licence: "", password: "", again: "", website: "" });
  const [deps, setDeps] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }));
  useEffect(() => { api<Pub>("/api/public").then(setPub).catch(() => setPub({ hospital: {}, departments: [] })); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (v.password !== v.again) { setErr("The two passwords do not match."); return; }
    setBusy(true);
    try { await api("/api/signup", { method: "POST", body: { ...v, departments: deps } }); setDone(true); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not reach the server. Check your connection and try again."); }
    setBusy(false);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="hidden bg-brand-50 p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo height={84} />
        <div className="max-w-md">
          <h1 className="text-[32px] font-semibold leading-[1.15]">Join the Kingdom care team.</h1>
          <ol className="mt-8 space-y-6">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand ring-1 ring-brand-100"><s.icon size={18} /></span><div><div className="text-[15px] font-semibold">{s.title}</div><div className="text-[13px] text-muted">{s.text}</div></div></li>
            ))}
          </ol>
        </div>
        <div className="text-xs text-muted">{pub?.hospital.name || "Kingdom Faith Based Hospital"}</div>
      </section>

      <section className="flex items-start justify-center bg-white p-5 sm:p-10 lg:items-center">
        {done ? (
          <div className="w-full max-w-[420px] text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok-50 text-ok"><CheckCircle2 size={28} /></span>
            <h2 className="mt-5 text-2xl font-semibold">Request sent</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">The hospital administrator will review it, confirm your role and add you to your departments. You can sign in with the email and password you just chose once it is approved.</p>
            {pub?.hospital.email && <p className="mt-4 text-[13px] text-muted">Questions? Contact {pub.hospital.email}{pub.hospital.phone ? ` or ${pub.hospital.phone}` : ""}.</p>}
            <Link href="/login" className="btn btn-primary mt-7 h-10 px-6">Back to sign in</Link>
          </div>
        ) : (
          <form className="w-full max-w-[460px]" onSubmit={submit}>
            <div className="mb-6 lg:hidden"><Logo height={56} /></div>
            <h2 className="text-2xl font-semibold">Request access</h2>
            <p className="mt-1.5 text-[13px] text-muted">Use your own email address. Nothing opens until the administrator approves you.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="label">Full name <span className="text-bad">*</span></span><input className="input h-10" value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required /></label>
              <label className="block"><span className="label">Email <span className="text-bad">*</span></span><input className="input h-10" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required /></label>
              <label className="block"><span className="label">Phone</span><input className="input h-10" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="+254 7XX XXX XXX" /></label>
              <label className="block"><span className="label">Position <span className="text-bad">*</span></span><select className="input h-10" value={v.position} onChange={(e) => set("position", e.target.value)} required><option value="">Choose your position</option>{POSITIONS.map((p) => <option key={p.label}>{p.label}</option>)}</select></label>
              <label className="block"><span className="label">Licence number</span><input className="input h-10" value={v.licence} onChange={(e) => set("licence", e.target.value)} placeholder="KMPDC, NCK, PPB" /></label>
              <fieldset className="sm:col-span-2">
                <legend className="label">Departments you work in <span className="text-bad">*</span></legend>
                <div className="flex flex-wrap gap-2">
                  {(pub?.departments || []).map((d) => {
                    const on = deps.includes(d.id);
                    return <button type="button" key={d.id} aria-pressed={on} onClick={() => setDeps(on ? deps.filter((x) => x !== d.id) : [...deps, d.id])} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors", on ? "border-brand bg-brand text-white" : "border-line bg-white text-text hover:border-[#c7ced6]")}>{d.name}</button>;
                  })}
                  {pub && pub.departments.length === 0 && <p className="text-[13px] text-muted">Departments could not be loaded. Refresh the page.</p>}
                </div>
              </fieldset>
              <label className="block"><span className="label">Password <span className="text-bad">*</span></span><input className="input h-10" type="password" value={v.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" minLength={10} required /></label>
              <label className="block"><span className="label">Repeat password <span className="text-bad">*</span></span><input className="input h-10" type="password" value={v.again} onChange={(e) => set("again", e.target.value)} autoComplete="new-password" minLength={10} required /></label>
              <p className="text-xs text-muted sm:col-span-2">At least 10 characters. A long phrase is best. Do not reuse a password from another account.</p>
              <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} name="website" />
            </div>
            {err && <p className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
            <button className="btn btn-primary mt-5 h-11 w-full" disabled={busy || !deps.length}>{busy ? "Sending" : "Send request"}</button>
            <p className="mt-5 text-center text-[13px] text-muted">Already approved? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
          </form>
        )}
      </section>
    </div>
  );
}
