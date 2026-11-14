"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crest } from "@/components/shell";

function FloorMotif() {
  const rooms = [[40, 60, 150, 100], [190, 60, 110, 100], [300, 60, 150, 100], [40, 160, 90, 120], [130, 160, 170, 120], [300, 160, 150, 120], [40, 300, 190, 90], [230, 300, 220, 90]];
  return (
    <svg viewBox="0 0 490 440" className="pointer-events-none absolute -right-24 -top-10 w-[480px] opacity-[0.13]" fill="none" stroke="#fff" strokeWidth="1.4" aria-hidden>
      {rooms.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}
      {[[70, 90], [215, 90], [330, 90], [330, 190], [70, 330], [260, 330]].map(([x, y], i) => <g key={i}><rect x={x} y={y} width="34" height="18" rx="2" /><path d={`M${x + 8} ${y} v18`} /></g>)}
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><Crest size={40} /><div><div className="text-lg font-semibold leading-tight">Kingdom Hospital</div><div className="text-[13px] text-[#92b8ac]">Level 4 hospital, Nairobi</div></div></div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15]">Every patient, bed and bill, in one record.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#b4cdc4]">Registration, clinics, laboratory, wards, pharmacy and SHA claims share one source of truth, so the front desk and the ward always see the same patient.</p>
        </div>
        <div className="relative z-10 text-xs text-[#78a094]">Kingdom Hospital Management System</div>
        <FloorMotif />
      </section>
      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <form className="w-full max-w-[380px]" onSubmit={(e) => { e.preventDefault(); setBusy(true); router.push("/dashboard"); }}>
          <div className="mb-8 flex items-center gap-3 lg:hidden"><Crest /><span className="text-lg font-semibold">Kingdom Hospital</span></div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1.5 text-[13px] text-muted">Use your hospital email to open your workspace.</p>
          <div className="mt-7 space-y-4">
            <label className="block"><span className="label">Email</span><input className="input h-10" type="email" defaultValue="ruth.njeri@kingdomhospital.co.ke" autoComplete="username" required /></label>
            <label className="block"><span className="label">Password</span><input className="input h-10" type="password" defaultValue="password" autoComplete="current-password" required /></label>
            <div className="flex items-center justify-between text-[13px]"><label className="flex items-center gap-2 text-muted"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[#0d6e57]" />Keep me signed in</label><span className="text-brand">Forgot password</span></div>
          </div>
          <button className="btn btn-primary mt-6 h-10 w-full" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
          <p className="mt-6 rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted">Demonstration mode. Authentication is not connected yet, so any credentials open the workspace.</p>
        </form>
      </section>
    </div>
  );
}
